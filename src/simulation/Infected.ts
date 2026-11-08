import type { PoliceOfficer } from './PoliceOfficer';
import type { GridMap } from './world/GridMap';
import { findPath } from './world/Pathfinder';
import type { TilePosition } from './world/WorldConfig';

export type InfectedState = 'idle' | 'moving' | 'attacking' | 'dead';

export interface InfectedPosition {
  readonly x: number;
  readonly y: number;
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
}

/** Contract implemented by each destructible residence entrance. */
export interface InfectedStructureTarget {
  readonly id: string;
  readonly position: InfectedPosition;
  readonly approachTile: TilePosition;
  /** Walkable cell just inside the residence. */
  readonly interiorTile: TilePosition;
  readonly isDestroyed: boolean;
  takeDamage(amount: number): number;
}

type Target =
  | { readonly kind: 'officer'; readonly officer: PoliceOfficer; readonly position: InfectedPosition }
  | { readonly kind: 'structure'; readonly structure: InfectedStructureTarget; readonly position: InfectedPosition; readonly tile: TilePosition }
  | { readonly kind: 'entry' | 'breach'; readonly position: InfectedPosition; readonly tile: TilePosition };

const DEFAULTS = Object.freeze({
  maxHealth: 60,
  moveSpeed: 55,
  damage: 8,
  attackRange: 40,
  detectionRange: 220,
  attackInterval: 1.2,
});

/**
 * Entidade de domínio do infectado básico. A IA prioriza policiais detectados;
 * caso contrário, avança até a entrada atribuída e tenta rompê-la. Quando a
 * entrada cede, atravessa a célula aberta e registra a invasão da residência.
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
  private enteredResidence = false;

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

    for (const [name, value] of Object.entries({
      maxHealth: this.maxHealth,
      moveSpeed: this.moveSpeed,
      damage: this.damage,
      attackRange: this.attackRange,
      detectionRange: this.detectionRange,
      attackInterval: this.attackInterval,
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

  get hasEnteredResidence(): boolean {
    return this.enteredResidence;
  }

  get position(): InfectedPosition {
    return { ...this.currentPosition };
  }

  update(
    dt: number,
    tileSize: number,
    map: GridMap,
    officers: readonly PoliceOfficer[],
    structureTargets: readonly InfectedStructureTarget[] = [],
  ): void {
    if (this.isDead || this.enteredResidence || !Number.isFinite(dt) || dt <= 0) return;
    if (!Number.isFinite(tileSize) || tileSize <= 0) {
      throw new RangeError('tileSize must be a positive finite number.');
    }

    const target = this.chooseTarget(officers, structureTargets, tileSize);
    const distance = this.distanceTo(target.position);

    if ((target.kind === 'officer' || target.kind === 'structure') && distance <= this.attackRange) {
      this.path = [];
      this.waypointIndex = 0;
      this.pathTargetKey = '';
      this.currentState = 'attacking';
      this.attackTimer += dt;
      while (this.attackTimer >= this.attackInterval) {
        this.attackTimer -= this.attackInterval;
        if (target.kind === 'officer') target.officer.takeDamage(this.damage);
        else target.structure.takeDamage(this.damage);
        if (target.kind === 'structure' && target.structure.isDestroyed) break;
        if (target.kind === 'officer' && target.officer.isIncapacitated) break;
      }
      return;
    }

    this.attackTimer = 0;
    const targetTile = target.kind === 'entry' || target.kind === 'breach'
      ? target.tile
      : target.kind === 'structure'
        ? target.tile
        : {
            column: Math.floor(target.position.x / tileSize),
            row: Math.floor(target.position.y / tileSize),
          };
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
    const closingDistance = !followingPath && target.kind === 'officer'
      ? this.moveWithinTargetTile(dt, target.position, tileSize)
      : false;

    if (target.kind === 'breach' && this.isAtTile(target.tile, tileSize)) {
      this.enteredResidence = true;
    }
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
    structureTargets: readonly InfectedStructureTarget[],
    tileSize: number,
  ): Target {
    let nearest: PoliceOfficer | undefined;
    let nearestDistance = this.detectionRange;
    for (const officer of officers) {
      if (officer.isIncapacitated) continue;
      const distance = this.distanceTo(officer.position);
      if (distance <= nearestDistance) {
        nearest = officer;
        nearestDistance = distance;
      }
    }
    if (nearest) {
      return { kind: 'officer', officer: nearest, position: nearest.position };
    }

    const assignedEntrance = [...structureTargets].sort((a, b) =>
      this.tileDistance(a.approachTile, this.entryTile) -
      this.tileDistance(b.approachTile, this.entryTile),
    )[0];

    if (assignedEntrance) {
      if (!assignedEntrance.isDestroyed) {
        return {
          kind: 'structure',
          structure: assignedEntrance,
          position: assignedEntrance.position,
          tile: assignedEntrance.approachTile,
        };
      }
      return {
        kind: 'breach',
        tile: assignedEntrance.interiorTile,
        position: {
          x: assignedEntrance.interiorTile.column * tileSize + tileSize / 2,
          y: assignedEntrance.interiorTile.row * tileSize + tileSize / 2,
        },
      };
    }

    return {
      kind: 'entry',
      tile: this.entryTile,
      position: {
        x: this.entryTile.column * tileSize + tileSize / 2,
        y: this.entryTile.row * tileSize + tileSize / 2,
      },
    };
  }

  private isAtTile(tile: TilePosition, tileSize: number): boolean {
    return (
      Math.floor(this.currentPosition.x / tileSize) === tile.column &&
      Math.floor(this.currentPosition.y / tileSize) === tile.row
    );
  }

  private tileDistance(a: TilePosition, b: TilePosition): number {
    return Math.abs(a.column - b.column) + Math.abs(a.row - b.row);
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
