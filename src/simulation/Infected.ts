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
  readonly maxHealth?: number;
  readonly moveSpeed?: number;
  readonly damage?: number;
  readonly attackRange?: number;
  readonly detectionRange?: number;
  readonly attackInterval?: number;
  readonly wanderRadiusTiles?: number;
  readonly random?: () => number;
}

const DEFAULTS = Object.freeze({
  maxHealth: 60,
  moveSpeed: 55,
  damage: 8,
  attackRange: 40,
  detectionRange: 220,
  attackInterval: 1.2,
  wanderRadiusTiles: 5,
});

/**
 * Infectado básico: vaga pelo cenário escolhendo destinos caminháveis aleatórios.
 * Ao detectar um policial ativo, interrompe a ronda e persegue/ataca esse alvo.
 * Paredes, portas e janelas permanecem bloqueios do GridMap; o infectado nunca
 * recebe uma ordem para entrar na residência nem danifica suas estruturas.
 */
export class Infected {
  readonly id: number;
  readonly maxHealth: number;
  readonly moveSpeed: number;
  readonly damage: number;
  readonly attackRange: number;
  readonly detectionRange: number;
  readonly attackInterval: number;
  readonly wanderRadiusTiles: number;

  private readonly random: () => number;
  private currentHealth: number;
  private currentState: InfectedState = 'idle';
  private currentPosition: { x: number; y: number };
  private path: TilePosition[] = [];
  private waypointIndex = 0;
  private pathTargetKey = '';
  private attackTimer = 0;
  private wanderTimer = 0;

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
    this.wanderRadiusTiles = config.wanderRadiusTiles ?? DEFAULTS.wanderRadiusTiles;
    this.random = config.random ?? Math.random;

    for (const [name, value] of Object.entries({
      maxHealth: this.maxHealth,
      moveSpeed: this.moveSpeed,
      damage: this.damage,
      attackRange: this.attackRange,
      detectionRange: this.detectionRange,
      attackInterval: this.attackInterval,
      wanderRadiusTiles: this.wanderRadiusTiles,
    })) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} must be a positive finite number.`);
      }
    }
    if (typeof this.random !== 'function') {
      throw new TypeError('random must be a function.');
    }

    this.currentHealth = this.maxHealth;
    this.currentPosition = { x: config.x, y: config.y };
  }

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
  ): void {
    if (this.isDead || !Number.isFinite(dt) || dt <= 0) return;
    if (!Number.isFinite(tileSize) || tileSize <= 0) {
      throw new RangeError('tileSize must be a positive finite number.');
    }

    const target = this.findOfficerTarget(officers);
    if (target) {
      this.updatePursuit(dt, tileSize, map, target);
      return;
    }

    this.attackTimer = 0;
    this.updateWandering(dt, tileSize, map);
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

  private findOfficerTarget(officers: readonly PoliceOfficer[]): PoliceOfficer | undefined {
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
    return nearest;
  }

  private updatePursuit(
    dt: number,
    tileSize: number,
    map: GridMap,
    officer: PoliceOfficer,
  ): void {
    const targetPosition = officer.position;
    const distance = this.distanceTo(targetPosition);
    const targetTile = {
      column: Math.floor(targetPosition.x / tileSize),
      row: Math.floor(targetPosition.y / tileSize),
    };
    const targetKey = `officer:${officer.id}:${targetTile.column}:${targetTile.row}`;

    if (distance <= this.attackRange) {
      this.path = [];
      this.waypointIndex = 0;
      this.pathTargetKey = '';
      this.currentState = 'attacking';
      this.attackTimer += dt;
      while (this.attackTimer >= this.attackInterval) {
        this.attackTimer -= this.attackInterval;
        officer.takeDamage(this.damage);
        if (officer.isIncapacitated) break;
      }
      return;
    }

    this.attackTimer = 0;
    if (targetKey !== this.pathTargetKey) {
      const start = this.currentTile(tileSize);
      this.path = findPath(map, start, targetTile, { allowDiagonal: true }) ?? [];
      this.waypointIndex = 0;
      this.pathTargetKey = targetKey;
    }

    const moving = this.moveAlongPath(dt, tileSize);
    this.currentState = moving ? 'moving' : 'idle';
  }

  private updateWandering(dt: number, tileSize: number, map: GridMap): void {
    this.wanderTimer -= dt;

    if (this.path.length === 0 || this.waypointIndex >= this.path.length) {
      if (this.wanderTimer > 0) {
        this.currentState = 'idle';
        return;
      }
      this.chooseWanderDestination(tileSize, map);
    }

    const moving = this.moveAlongPath(dt, tileSize);
    if (moving) {
      this.currentState = 'moving';
    } else {
      this.currentState = 'idle';
      this.wanderTimer = 0.75 + this.random() * 1.75;
    }
  }

  private chooseWanderDestination(tileSize: number, map: GridMap): void {
    const start = this.currentTile(tileSize);
    this.path = [];
    this.waypointIndex = 0;
    this.pathTargetKey = '';

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const offsetX = Math.floor(this.random() * (this.wanderRadiusTiles * 2 + 1)) - this.wanderRadiusTiles;
      const offsetY = Math.floor(this.random() * (this.wanderRadiusTiles * 2 + 1)) - this.wanderRadiusTiles;
      if (offsetX === 0 && offsetY === 0) continue;

      const destination = {
        column: start.column + offsetX,
        row: start.row + offsetY,
      };
      if (!map.isWalkable(destination)) continue;

      const path = findPath(map, start, destination, { allowDiagonal: true });
      if (!path || path.length === 0) continue;

      this.path = path;
      this.waypointIndex = 0;
      this.pathTargetKey = `wander:${destination.column}:${destination.row}`;
      return;
    }

    this.wanderTimer = 1;
  }

  private currentTile(tileSize: number): TilePosition {
    return {
      column: Math.floor(this.currentPosition.x / tileSize),
      row: Math.floor(this.currentPosition.y / tileSize),
    };
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

  private distanceTo(position: InfectedPosition): number {
    return Math.hypot(position.x - this.currentPosition.x, position.y - this.currentPosition.y);
  }

  private assertFinite(value: number, name: string): void {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
  }
}
