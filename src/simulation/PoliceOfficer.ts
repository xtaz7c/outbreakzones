import type { TilePosition } from './world/WorldConfig';
import { GridMap } from './world/GridMap';
import { findPath } from './world/Pathfinder';

export type PoliceOfficerState = 'idle' | 'moving' | 'attacking' | 'incapacitated';
export type TacticalPosture = 'engage' | 'hold_fire';

export interface PoliceOfficerConfig {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly maxHealth?: number;
  readonly moveSpeed?: number;
  readonly attackRange?: number;
  readonly accuracy?: number;
  /** Tempo entre disparos, em segundos. O sistema de combate será implementado na Fase 6. */
  readonly fireInterval?: number;
}

export interface OfficerPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Entidade de domínio do policial.
 * Mantém atributos, estado, vida, orientação e deslocamento sem depender do Phaser.
 */
export class PoliceOfficer {
  readonly id: number;
  readonly maxHealth: number;
  readonly moveSpeed: number;
  readonly attackRange: number;
  readonly accuracy: number;
  readonly fireInterval: number;

  private currentHealth: number;
  private currentState: PoliceOfficerState = 'idle';
  private currentTacticalPosture: TacticalPosture = 'engage';
  private currentPosition: { x: number; y: number };
  private currentFacingAngle = -Math.PI / 2;
  private path: TilePosition[] = [];
  private waypointIndex = 0;

  constructor(config: PoliceOfficerConfig) {
    this.assertPositiveFinite(config.x, 'x');
    this.assertPositiveFinite(config.y, 'y');

    this.id = config.id;
    if (!Number.isInteger(this.id) || this.id <= 0) {
      throw new RangeError('Police officer id must be a positive integer.');
    }

    this.maxHealth = config.maxHealth ?? 100;
    this.moveSpeed = config.moveSpeed ?? 105;
    this.attackRange = config.attackRange ?? 180;
    this.accuracy = config.accuracy ?? 0.75;
    this.fireInterval = config.fireInterval ?? 0.8;

    this.assertPositiveFinite(this.maxHealth, 'maxHealth');
    this.assertPositiveFinite(this.moveSpeed, 'moveSpeed');
    this.assertPositiveFinite(this.attackRange, 'attackRange');
    this.assertPositiveFinite(this.fireInterval, 'fireInterval');
    if (!Number.isFinite(this.accuracy) || this.accuracy < 0 || this.accuracy > 1) {
      throw new RangeError('accuracy must be between 0 and 1.');
    }

    this.currentHealth = this.maxHealth;
    this.currentPosition = { x: config.x, y: config.y };
  }

  get state(): PoliceOfficerState {
    return this.currentState;
  }

  get health(): number {
    return this.currentHealth;
  }

  get tacticalPosture(): TacticalPosture {
    return this.currentTacticalPosture;
  }

  setTacticalPosture(posture: TacticalPosture): boolean {
    if (this.isIncapacitated) return false;
    this.currentTacticalPosture = posture;
    return true;
  }

  holdPosition(): boolean {
    if (this.isIncapacitated) return false;
    this.path = [];
    this.waypointIndex = 0;
    this.currentState = 'idle';
    return true;
  }

  get isIncapacitated(): boolean {
    return this.currentState === 'incapacitated';
  }

  get facingAngle(): number {
    return this.currentFacingAngle;
  }

  get position(): OfficerPosition {
    return { ...this.currentPosition };
  }

  get hasMoveOrder(): boolean {
    return this.currentState === 'moving' && this.waypointIndex < this.path.length;
  }

  get remainingWaypoints(): number {
    return Math.max(0, this.path.length - this.waypointIndex);
  }

  setFacingAngle(angle: number): void {
    if (Number.isFinite(angle)) this.currentFacingAngle = angle;
  }

  /** Calcula e aceita uma nova ordem somente se existir uma rota válida. */
  issueMoveOrder(destination: TilePosition, map: GridMap, tileSize: number): boolean {
    if (this.isIncapacitated) return false;
    this.assertPositiveFinite(tileSize, 'tileSize');

    const start = {
      column: Math.floor(this.currentPosition.x / tileSize),
      row: Math.floor(this.currentPosition.y / tileSize),
    };
    const nextPath = findPath(map, start, destination, { allowDiagonal: true });
    if (nextPath === null) return false;

    this.path = nextPath;
    this.waypointIndex = 0;
    this.currentState = nextPath.length > 0 ? 'moving' : 'idle';
    return true;
  }

  /** Atualiza o deslocamento em segundos; chamado pelo fixed timestep da Simulation. */
  update(dt: number, tileSize: number): void {
    if (this.currentState !== 'moving' || !Number.isFinite(dt) || dt <= 0) return;
    this.assertPositiveFinite(tileSize, 'tileSize');

    let distanceRemaining = this.moveSpeed * dt;
    while (distanceRemaining > 0 && this.waypointIndex < this.path.length) {
      const waypoint = this.path[this.waypointIndex]!;
      const targetX = waypoint.column * tileSize + tileSize / 2;
      const targetY = waypoint.row * tileSize + tileSize / 2;
      const dx = targetX - this.currentPosition.x;
      const dy = targetY - this.currentPosition.y;
      const distance = Math.hypot(dx, dy);

      if (distance > 0) {
        this.currentFacingAngle = Math.atan2(dy, dx);
      }

      if (distance <= distanceRemaining || distance === 0) {
        this.currentPosition = { x: targetX, y: targetY };
        distanceRemaining -= distance;
        this.waypointIndex += 1;
      } else {
        const ratio = distanceRemaining / distance;
        this.currentPosition = {
          x: this.currentPosition.x + dx * ratio,
          y: this.currentPosition.y + dy * ratio,
        };
        distanceRemaining = 0;
      }
    }

    if (this.waypointIndex >= this.path.length) {
      this.path = [];
      this.waypointIndex = 0;
      this.currentState = 'idle';
    }
  }

  /** Marca o policial como ocupado em combate; o sistema de combate vem na Fase 6. */
  setAttacking(attacking: boolean): boolean {
    if (this.isIncapacitated) return false;

    if (attacking) {
      this.path = [];
      this.waypointIndex = 0;
      this.currentState = 'attacking';
    } else if (this.currentState === 'attacking') {
      this.currentState = 'idle';
    }
    return true;
  }

  /** Aplica dano e retorna a quantidade efetivamente recebida. */
  takeDamage(amount: number): number {
    if (this.isIncapacitated || !Number.isFinite(amount) || amount <= 0) return 0;

    const appliedDamage = Math.min(amount, this.currentHealth);
    this.currentHealth = Math.max(0, this.currentHealth - appliedDamage);

    if (this.currentHealth === 0) {
      this.currentState = 'incapacitated';
      this.path = [];
      this.waypointIndex = 0;
    }

    return appliedDamage;
  }

  private assertPositiveFinite(value: number, name: string): void {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${name} must be a positive finite number.`);
    }
  }
}
