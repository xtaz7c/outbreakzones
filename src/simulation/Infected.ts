import type { PoliceOfficer } from './PoliceOfficer';
import type { Civilian } from './Civilian';
import type { HumanTarget } from './HumanTarget';
import type { GridMap } from './world/GridMap';
import { findPath } from './world/Pathfinder';
import { hasLineOfSight } from './CombatSystem';
import type { TilePosition } from './world/WorldConfig';

export type InfectedState = 'idle' | 'moving' | 'attacking' | 'dead';

export interface InfectedPosition {
  readonly x: number;
  readonly y: number;
}

export interface InfectedStimulus {
  readonly id: string;
  readonly position: InfectedPosition;
  readonly radius: number;
  readonly strength: number;
  readonly structure?: InfectedStructureTarget;
}

export interface InfectedConfig {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly entryTile: TilePosition;
  readonly maxHealth?: number;
  readonly moveSpeed?: number;
  readonly damage?: number;
  readonly attackRange?: number;
  readonly detectionRange?: number;
  readonly attackInterval?: number;
  readonly patrolRadiusTiles?: number;
  readonly hearingRange?: number;
  readonly memoryDuration?: number;
  readonly random?: () => number;
}

/** Contrato para portas/janelas destrutíveis, implementado na Fase 7. */
export interface InfectedStructureTarget {
  readonly position: InfectedPosition;
  /** Walkable tile adjacent to the door/window; the structure tile may be blocked. */
  readonly approachTile: TilePosition;
  readonly breachTile?: TilePosition;
  readonly isPassable?: boolean;
  readonly isDestroyed: boolean;
  takeDamage(amount: number): number;
}

type Target =
  | { readonly kind: 'human'; readonly human: HumanTarget; readonly position: InfectedPosition }
  | { readonly kind: 'structure'; readonly structure: InfectedStructureTarget; readonly position: InfectedPosition; readonly tile: TilePosition }
  | { readonly kind: 'entry'; readonly position: InfectedPosition; readonly tile: TilePosition };

const DEFAULTS = Object.freeze({
  maxHealth: 60,
  moveSpeed: 55,
  damage: 8,
  attackRange: 40,
  detectionRange: 220,
  attackInterval: 1.2,
  patrolRadiusTiles: 8,
  hearingRange: 360,
  memoryDuration: 8,
});

/**
 * Entidade de domínio do infectado básico.
 * A IA prioriza policiais visíveis, investiga estímulos audíveis e, na
 * ausência de ameaças, patrulha células caminháveis. Não depende do Phaser.
 */
export class Infected {
  readonly id: number;
  readonly maxHealth: number;
  readonly moveSpeed: number;
  readonly damage: number;
  readonly attackRange: number;
  readonly detectionRange: number;
  readonly attackInterval: number;

  private currentHealth: number;
  private currentState: InfectedState = 'idle';
  private currentPosition: { x: number; y: number };
  private path: TilePosition[] = [];
  private waypointIndex = 0;
  private pathTargetKey = '';
  private attackTimer = 0;
  private attractedStructureTarget: InfectedStructureTarget | undefined;
  private readonly patrolRadiusTiles: number;
  private readonly hearingRange: number;
  private readonly memoryDuration: number;
  private readonly random: () => number;
  private patrolTarget: TilePosition | null = null;
  private investigationTarget: InfectedPosition | null = null;
  private investigationRemaining = 0;

  constructor(config: InfectedConfig) {
    this.assertFinite(config.x, 'x');
    this.assertFinite(config.y, 'y');
    if (!Number.isInteger(config.id) || config.id <= 0) {
      throw new RangeError('Infected id must be a positive integer.');
    }
    this.id = config.id;
    this.maxHealth = config.maxHealth ?? DEFAULTS.maxHealth;
    this.moveSpeed = config.moveSpeed ?? DEFAULTS.moveSpeed;
    this.damage = config.damage ?? DEFAULTS.damage;
    this.attackRange = config.attackRange ?? DEFAULTS.attackRange;
    this.detectionRange = config.detectionRange ?? DEFAULTS.detectionRange;
    this.attackInterval = config.attackInterval ?? DEFAULTS.attackInterval;
    this.patrolRadiusTiles = config.patrolRadiusTiles ?? DEFAULTS.patrolRadiusTiles;
    this.hearingRange = config.hearingRange ?? DEFAULTS.hearingRange;
    this.memoryDuration = config.memoryDuration ?? DEFAULTS.memoryDuration;
    this.random = config.random ?? Math.random;

    for (const [name, value] of Object.entries({
      maxHealth: this.maxHealth,
      moveSpeed: this.moveSpeed,
      damage: this.damage,
      attackRange: this.attackRange,
      detectionRange: this.detectionRange,
      attackInterval: this.attackInterval,
      patrolRadiusTiles: this.patrolRadiusTiles,
      hearingRange: this.hearingRange,
      memoryDuration: this.memoryDuration,
    })) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} must be a positive finite number.`);
      }
    }

    if (
      !Number.isInteger(config.entryTile.column) ||
      !Number.isInteger(config.entryTile.row)
    ) {
      throw new RangeError('entryTile must contain integer grid coordinates.');
    }

    this.currentHealth = this.maxHealth;
    this.currentPosition = { x: config.x, y: config.y };
    this.entryTile = { ...config.entryTile };
  }

  readonly entryTile: TilePosition;

  get state(): InfectedState {
    return this.currentState;
  }

  get health(): number {
    return this.currentHealth;
  }

  get isDead(): boolean {
    return this.currentState === 'dead';
  }

  get position(): InfectedPosition {
    return { ...this.currentPosition };
  }

  update(
    dt: number,
    tileSize: number,
    map: GridMap,
    officers: readonly PoliceOfficer[],
    structureTarget?: InfectedStructureTarget,
    stimuli: readonly InfectedStimulus[] = [],
    civilians: readonly Civilian[] = [],
    additionalHumanTargets: readonly HumanTarget[] = [],
  ): void {
    if (this.isDead || !Number.isFinite(dt) || dt <= 0) return;
    if (!Number.isFinite(tileSize) || tileSize <= 0) {
      throw new RangeError('tileSize must be a positive finite number.');
    }

    // Wave units start beyond the playable boundary and visibly walk to their
    // assigned entry tile before normal navigation/perception takes over.
    const worldWidth = map.columns * tileSize;
    const worldHeight = map.rows * tileSize;
    const outsideWorld = this.currentPosition.x < 0 || this.currentPosition.y < 0 ||
      this.currentPosition.x >= worldWidth || this.currentPosition.y >= worldHeight;
    if (outsideWorld) {
      const entry = {
        x: this.entryTile.column * tileSize + tileSize / 2,
        y: this.entryTile.row * tileSize + tileSize / 2,
      };
      const dx = entry.x - this.currentPosition.x;
      const dy = entry.y - this.currentPosition.y;
      const distance = Math.hypot(dx, dy);
      const travel = Math.min(this.moveSpeed * dt, distance);
      if (distance > 0 && travel > 0) {
        this.currentPosition = {
          x: this.currentPosition.x + (dx / distance) * travel,
          y: this.currentPosition.y + (dy / distance) * travel,
        };
      }
      this.currentState = 'moving';
      return;
    }

    const target = this.chooseTarget(officers, civilians, additionalHumanTargets, structureTarget, tileSize, map, stimuli, dt);
    const distance = this.distanceTo(target.position);

    if (target.kind !== 'entry' && distance <= this.attackRange) {
      this.path = [];
      this.waypointIndex = 0;
      this.pathTargetKey = '';
      this.currentState = 'attacking';
      this.attackTimer += dt;
      while (this.attackTimer >= this.attackInterval) {
        this.attackTimer -= this.attackInterval;
        if (target.kind === 'human') target.human.takeDamage(this.damage);
        else target.structure.takeDamage(this.damage);
        if (target.kind === 'structure' && target.structure.isDestroyed) break;
        if (target.kind === 'human' && target.human.isIncapacitated) break;
      }
      return;
    }

    this.attackTimer = 0;
    const targetTile = target.kind === 'entry' || target.kind === 'structure'
      ? target.tile
      : { column: Math.floor(target.position.x / tileSize), row: Math.floor(target.position.y / tileSize) };
    const targetKey = `${targetTile.column}:${targetTile.row}`;

    if (targetKey !== this.pathTargetKey) {
      const start = {
        column: Math.floor(this.currentPosition.x / tileSize),
        row: Math.floor(this.currentPosition.y / tileSize),
      };
      const nextPath = findPath(map, start, targetTile, { allowDiagonal: true });
      this.path = nextPath ?? [];
      this.waypointIndex = 0;
      this.pathTargetKey = targetKey;
    }

    const followingPath = this.moveAlongPath(dt, tileSize);
    const closingDistance = !followingPath && target.kind !== 'entry'
      ? this.moveWithinTargetTile(dt, target.position, tileSize)
      : false;
    this.currentState = followingPath || closingDistance ? 'moving' : 'idle';
  }

  takeDamage(amount: number): number {
    if (this.isDead || !Number.isFinite(amount) || amount <= 0) return 0;
    const applied = Math.min(amount, this.currentHealth);
    this.currentHealth = Math.max(0, this.currentHealth - applied);
    if (this.currentHealth === 0) {
      this.currentState = 'dead';
      this.path = [];
      this.waypointIndex = 0;
    }
    return applied;
  }

  private chooseTarget(
    officers: readonly PoliceOfficer[],
    civilians: readonly Civilian[],
    additionalHumanTargets: readonly HumanTarget[],
    structureTarget: InfectedStructureTarget | undefined,
    tileSize: number,
    map: GridMap,
    stimuli: readonly InfectedStimulus[],
    dt: number,
  ): Target {
    let nearestHuman: HumanTarget | undefined;
    let nearestDistance = this.detectionRange;
    for (const human of [...officers, ...civilians, ...additionalHumanTargets]) {
      if (human.isIncapacitated || ('isRescued' in human && human.isRescued)) continue;
      const distance = this.distanceTo(human.position);
      if (distance <= nearestDistance && hasLineOfSight(map, this.currentPosition, human.position, tileSize)) {
        nearestHuman = human;
        nearestDistance = distance;
      }
    }
    if (nearestHuman) {
      this.investigationTarget = null;
      this.investigationRemaining = 0;
      this.patrolTarget = null;
      return { kind: 'human', human: nearestHuman, position: nearestHuman.position };
    }

    let strongestStimulus: InfectedStimulus | undefined;
    let strongestScore = 0;
    for (const stimulus of stimuli) {
      if (
        !Number.isFinite(stimulus.radius) || stimulus.radius <= 0 ||
        !Number.isFinite(stimulus.strength) || stimulus.strength <= 0
      ) continue;
      const distance = this.distanceTo(stimulus.position);
      const effectiveRange = Math.min(stimulus.radius, this.hearingRange);
      if (distance > effectiveRange) continue;
      const score = stimulus.strength * (1 - distance / effectiveRange);
      if (score > strongestScore) {
        strongestScore = score;
        strongestStimulus = stimulus;
      }
    }
    if (strongestStimulus) {
      const walkablePosition = this.resolveWalkablePosition(strongestStimulus.position, map, tileSize);
      if (walkablePosition) {
        this.investigationTarget = walkablePosition;
        this.investigationRemaining = this.memoryDuration;
        this.patrolTarget = null;
      }
    }

    if (strongestStimulus?.structure) this.attractedStructureTarget = strongestStimulus.structure;
    else if (structureTarget) this.attractedStructureTarget = structureTarget;
    const attracted = this.attractedStructureTarget;
    if (attracted && !attracted.isDestroyed && !attracted.isPassable) {
      return {
        kind: 'structure',
        structure: attracted,
        position: attracted.position,
        tile: attracted.approachTile,
      };
    }
    if (attracted && (attracted.isDestroyed || attracted.isPassable) && attracted.breachTile) {
      const tile = attracted.breachTile;
      return { kind: 'entry', tile, position: { x: tile.column * tileSize + tileSize / 2, y: tile.row * tileSize + tileSize / 2 } };
    }

    if (this.investigationTarget && this.investigationRemaining > 0) {
      const target = this.investigationTarget;
      const tile = { column: Math.floor(target.x / tileSize), row: Math.floor(target.y / tileSize) };
      if (this.distanceTo(target) <= tileSize * 0.6) {
        this.investigationRemaining = Math.max(0, this.investigationRemaining - dt);
      }
      if (this.investigationRemaining > 0) return { kind: 'entry', tile, position: target };
    }
    this.investigationTarget = null;

    const currentTile = {
      column: Math.floor(this.currentPosition.x / tileSize),
      row: Math.floor(this.currentPosition.y / tileSize),
    };
    if (
      !this.patrolTarget ||
      (currentTile.column === this.patrolTarget.column && currentTile.row === this.patrolTarget.row)
    ) {
      this.patrolTarget = this.choosePatrolTile(map, currentTile);
    }
    const patrolTile = this.patrolTarget ?? (
      map.isWalkable(this.entryTile) && findPath(map, currentTile, this.entryTile) !== null
        ? this.entryTile
        : currentTile
    );
    return {
      kind: 'entry',
      tile: patrolTile,
      position: {
        x: patrolTile.column * tileSize + tileSize / 2,
        y: patrolTile.row * tileSize + tileSize / 2,
      },
    };
  }

  private resolveWalkablePosition(
    position: InfectedPosition,
    map: GridMap,
    tileSize: number,
  ): InfectedPosition | null {
    const desired = {
      column: Math.floor(position.x / tileSize),
      row: Math.floor(position.y / tileSize),
    };
    const start = {
      column: Math.floor(this.currentPosition.x / tileSize),
      row: Math.floor(this.currentPosition.y / tileSize),
    };
    if (map.isWalkable(desired) && findPath(map, start, desired, { allowDiagonal: true }) !== null) {
      return {
        x: desired.column * tileSize + tileSize / 2,
        y: desired.row * tileSize + tileSize / 2,
      };
    }

    for (let radius = 1; radius <= 4; radius += 1) {
      const candidates: TilePosition[] = [];
      for (let row = desired.row - radius; row <= desired.row + radius; row += 1) {
        for (let column = desired.column - radius; column <= desired.column + radius; column += 1) {
          const candidate = { column, row };
          if (
            Math.max(Math.abs(column - desired.column), Math.abs(row - desired.row)) === radius &&
            map.isWalkable(candidate)
          ) candidates.push(candidate);
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) =>
          Math.hypot(a.column - desired.column, a.row - desired.row) -
          Math.hypot(b.column - desired.column, b.row - desired.row),
        );
        const nearest = candidates.find((candidate) =>
          findPath(map, start, candidate, { allowDiagonal: true }) !== null,
        );
        if (nearest) {
          return {
            x: nearest.column * tileSize + tileSize / 2,
            y: nearest.row * tileSize + tileSize / 2,
          };
        }
      }
    }
    return null;
  }

  private choosePatrolTile(map: GridMap, origin: TilePosition): TilePosition | null {
    const candidates: TilePosition[] = [];
    for (let row = Math.max(0, origin.row - this.patrolRadiusTiles);
      row <= Math.min(map.rows - 1, origin.row + this.patrolRadiusTiles); row += 1) {
      for (let column = Math.max(0, origin.column - this.patrolRadiusTiles);
        column <= Math.min(map.columns - 1, origin.column + this.patrolRadiusTiles); column += 1) {
        const candidate = { column, row };
        if (
          map.isWalkable(candidate) &&
          Math.hypot(column - origin.column, row - origin.row) >= 2 &&
          Math.hypot(column - origin.column, row - origin.row) <= this.patrolRadiusTiles
        ) candidates.push(candidate);
      }
    }
    while (candidates.length > 0) {
      const value = this.random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) {
        throw new RangeError('Infected random source must return a value in [0, 1).');
      }
      const candidate = candidates.splice(Math.floor(value * candidates.length), 1)[0]!;
      if (findPath(map, origin, candidate, { allowDiagonal: true }) !== null) return candidate;
    }
    return null;
  }

  private moveAlongPath(dt: number, tileSize: number): boolean {
    let remaining = this.moveSpeed * dt;
    while (remaining > 0 && this.waypointIndex < this.path.length) {
      const tile = this.path[this.waypointIndex]!;
      const x = tile.column * tileSize + tileSize / 2;
      const y = tile.row * tileSize + tileSize / 2;
      const dx = x - this.currentPosition.x;
      const dy = y - this.currentPosition.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= remaining || distance === 0) {
        this.currentPosition = { x, y };
        remaining -= distance;
        this.waypointIndex += 1;
      } else {
        const ratio = remaining / distance;
        this.currentPosition = {
          x: this.currentPosition.x + dx * ratio,
          y: this.currentPosition.y + dy * ratio,
        };
        remaining = 0;
      }
    }
    if (this.waypointIndex >= this.path.length) {
      this.path = [];
      this.waypointIndex = 0;
      return false;
    }
    return true;
  }

  private moveWithinTargetTile(
    dt: number,
    target: InfectedPosition,
    tileSize: number,
  ): boolean {
    const sameTile =
      Math.floor(this.currentPosition.x / tileSize) === Math.floor(target.x / tileSize) &&
      Math.floor(this.currentPosition.y / tileSize) === Math.floor(target.y / tileSize);
    if (!sameTile) return false;

    const dx = target.x - this.currentPosition.x;
    const dy = target.y - this.currentPosition.y;
    const distance = Math.hypot(dx, dy);
    const travel = Math.min(this.moveSpeed * dt, Math.max(0, distance - this.attackRange));
    if (travel <= 0 || distance === 0) return false;
    const ratio = travel / distance;
    this.currentPosition = {
      x: this.currentPosition.x + dx * ratio,
      y: this.currentPosition.y + dy * ratio,
    };
    return true;
  }

  private distanceTo(position: InfectedPosition): number {
    return Math.hypot(position.x - this.currentPosition.x, position.y - this.currentPosition.y);
  }

  private assertFinite(value: number, name: string): void {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
  }
}
