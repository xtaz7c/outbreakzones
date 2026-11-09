import type { TilePosition } from './world/WorldConfig';
import { GridMap } from './world/GridMap';
import { findPath } from './world/Pathfinder';

export type CivilianState = 'sheltered' | 'following' | 'extracted' | 'dead';

export interface CivilianConfig {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly moveSpeed?: number;
}

export interface CivilianPosition {
  readonly x: number;
  readonly y: number;
}

export class Civilian {
  readonly id: number;
  readonly moveSpeed: number;
  readonly maxHealth: number;
  private currentHealth: number;
  private currentPosition: { x: number; y: number };
  private currentState: CivilianState = 'sheltered';
  private escortOfficerId: number | null = null;
  private path: TilePosition[] = [];
  private waypointIndex = 0;
  private pathGoal: TilePosition | null = null;

  constructor(config: CivilianConfig) {
    if (!Number.isInteger(config.id) || config.id <= 0) {
      throw new RangeError('Civilian id must be a positive integer.');
    }
    if (!Number.isFinite(config.x) || !Number.isFinite(config.y)) {
      throw new RangeError('Civilian coordinates must be finite.');
    }
    this.moveSpeed = config.moveSpeed ?? 72;
    this.maxHealth = 60;
    this.currentHealth = this.maxHealth;
    if (!Number.isFinite(this.moveSpeed) || this.moveSpeed <= 0) {
      throw new RangeError('Civilian moveSpeed must be positive.');
    }
    this.id = config.id;
    this.currentPosition = { x: config.x, y: config.y };
  }

  get state(): CivilianState { return this.currentState; }
  get position(): CivilianPosition { return { ...this.currentPosition }; }
  get isRescued(): boolean { return this.currentState === 'extracted'; }
  get isIncapacitated(): boolean { return this.currentState === 'dead'; }
  get health(): number { return this.currentHealth; }
  get escortId(): number | null { return this.escortOfficerId; }

  takeDamage(amount: number): number {
    if (this.isIncapacitated || !Number.isFinite(amount) || amount <= 0) return 0;
    const applied = Math.min(amount, this.currentHealth);
    this.currentHealth = Math.max(0, this.currentHealth - applied);
    if (this.currentHealth === 0) {
      this.currentState = 'dead';
      this.path = [];
      this.waypointIndex = 0;
      this.escortOfficerId = null;
    }
    return applied;
  }

  beginFollowing(officerId?: number): boolean {
    if (this.currentState !== 'sheltered') return false;
    this.currentState = 'following';
    this.escortOfficerId = officerId ?? null;
    return true;
  }

  assignEscort(officerId: number): boolean {
    if (this.currentState !== 'following' || !Number.isInteger(officerId) || officerId <= 0) return false;
    if (this.escortOfficerId === officerId) return false;
    this.escortOfficerId = officerId;
    this.path = [];
    this.waypointIndex = 0;
    this.pathGoal = null;
    return true;
  }

  updatePosition(position: CivilianPosition): boolean {
    if (this.currentState !== 'following') return false;
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
    this.currentPosition = { ...position };
    return true;
  }

  updateFollowing(dt: number, tileSize: number, map: GridMap, target: CivilianPosition): void {
    if (this.currentState !== 'following' || !Number.isFinite(dt) || dt <= 0) return;
    if (!Number.isFinite(tileSize) || tileSize <= 0 ||
        !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;

    const goal = {
      column: Math.floor(target.x / tileSize),
      row: Math.floor(target.y / tileSize),
    };
    const currentTile = {
      column: Math.floor(this.currentPosition.x / tileSize),
      row: Math.floor(this.currentPosition.y / tileSize),
    };
    if (currentTile.column === goal.column && currentTile.row === goal.row) {
      this.path = [];
      this.waypointIndex = 0;
      this.pathGoal = { ...goal };
      return;
    }

    if (!this.pathGoal || this.pathGoal.column !== goal.column || this.pathGoal.row !== goal.row ||
        this.waypointIndex >= this.path.length) {
      this.path = findPath(map, currentTile, goal, { allowDiagonal: true }) ?? [];
      this.waypointIndex = 0;
      this.pathGoal = { ...goal };
    }

    let distanceRemaining = this.moveSpeed * dt;
    while (distanceRemaining > 0 && this.waypointIndex < this.path.length) {
      const waypoint = this.path[this.waypointIndex]!;
      const targetX = waypoint.column * tileSize + tileSize / 2;
      const targetY = waypoint.row * tileSize + tileSize / 2;
      const dx = targetX - this.currentPosition.x;
      const dy = targetY - this.currentPosition.y;
      const distance = Math.hypot(dx, dy);
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
  }

  replan(map: GridMap, tileSize: number, target: CivilianPosition): boolean {
    if (this.currentState !== 'following') return false;
    const start = {
      column: Math.floor(this.currentPosition.x / tileSize),
      row: Math.floor(this.currentPosition.y / tileSize),
    };
    const goal = { column: Math.floor(target.x / tileSize), row: Math.floor(target.y / tileSize) };
    const nextPath = findPath(map, start, goal, { allowDiagonal: true });
    this.path = nextPath ?? [];
    this.waypointIndex = 0;
    this.pathGoal = { ...goal };
    return nextPath !== null;
  }

  extract(): boolean {
    if (this.currentState !== 'following') return false;
    this.currentState = 'extracted';
    this.path = [];
    this.waypointIndex = 0;
    return true;
  }
}
