import type { TilePosition } from './world/WorldConfig';
import { GridMap } from './world/GridMap';
import { findPath } from './world/Pathfinder';

export type CivilianState = 'sheltered' | 'following' | 'extracted' | 'dead';
export type CivilianBehaviorState = 'calm' | 'panic';

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

export interface CivilianEscort {
  readonly id: number;
  readonly position: CivilianPosition;
  readonly facingAngle: number;
  readonly isIncapacitated: boolean;
}

export class Civilian {
  readonly id: number;
  readonly moveSpeed: number;
  readonly maxHealth = 60;
  private currentHealth = this.maxHealth;
  private currentPosition: { x: number; y: number };
  private currentState: CivilianState = 'sheltered';
  private currentBehaviorState: CivilianBehaviorState = 'calm';
  private escortOfficerId: number | null = null;
  private path: TilePosition[] = [];
  private waypointIndex = 0;
  private pathGoal: TilePosition | null = null;
  private wanderTimer = 0;
  private wanderGoal: CivilianPosition | null = null;

  constructor(config: CivilianConfig) {
    if (!Number.isInteger(config.id) || config.id <= 0) throw new RangeError('Civilian id must be a positive integer.');
    if (!Number.isFinite(config.x) || !Number.isFinite(config.y)) throw new RangeError('Civilian coordinates must be finite.');
    this.moveSpeed = config.moveSpeed ?? 72;
    if (!Number.isFinite(this.moveSpeed) || this.moveSpeed <= 0) throw new RangeError('Civilian moveSpeed must be positive.');
    this.id = config.id;
    this.currentPosition = { x: config.x, y: config.y };
  }

  get state(): CivilianState { return this.currentState; }
  get behaviorState(): CivilianBehaviorState { return this.currentBehaviorState; }
  get position(): CivilianPosition { return { ...this.currentPosition }; }
  get isRescued(): boolean { return this.currentState === 'extracted'; }
  get isIncapacitated(): boolean { return this.currentState === 'dead'; }
  get health(): number { return this.currentHealth; }
  get escortId(): number | null { return this.escortOfficerId; }

  takeDamage(amount: number): number {
    if (this.isIncapacitated || this.isRescued || !Number.isFinite(amount) || amount <= 0) return 0;
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
    this.clearPath();
    return true;
  }

  loseEscort(): boolean {
    if (this.currentState !== 'following') return false;
    this.currentState = 'sheltered';
    this.escortOfficerId = null;
    this.clearPath();
    this.wanderGoal = null;
    return true;
  }

  updatePosition(position: CivilianPosition): boolean {
    if (this.currentState !== 'following' || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
    this.currentPosition = { ...position };
    return true;
  }

  updateAutonomous(
    dt: number,
    tileSize: number,
    map: GridMap,
    officers: readonly CivilianEscort[],
    threats: readonly CivilianPosition[],
    random: () => number = Math.random,
  ): void {
    if (this.isIncapacitated || this.isRescued || !Number.isFinite(dt) || dt <= 0) return;
    const threat = threats
      .map((position) => ({ position, distance: this.distanceTo(position) }))
      .filter((candidate) => candidate.distance <= 280)
      .sort((a, b) => a.distance - b.distance)[0];

    if (threat) {
      this.currentBehaviorState = 'panic';
      const dx = this.currentPosition.x - threat.position.x;
      const dy = this.currentPosition.y - threat.position.y;
      const length = Math.hypot(dx, dy) || 1;
      const travel = tileSize * 6;
      const target = {
        x: Math.max(tileSize / 2, Math.min(map.columns * tileSize - tileSize / 2, this.currentPosition.x + dx / length * travel)),
        y: Math.max(tileSize / 2, Math.min(map.rows * tileSize - tileSize / 2, this.currentPosition.y + dy / length * travel)),
      };
      this.moveToward(dt, tileSize, map, target);
      return;
    }

    this.currentBehaviorState = 'calm';
    let escort = officers.find((officer) => officer.id === this.escortOfficerId && !officer.isIncapacitated);
    if (this.currentState === 'following' && escort) {
      const distance = this.distanceTo(escort.position);
      if (distance > 420) {
        this.loseEscort();
        escort = undefined;
      } else {
        this.updateFollowing(dt, tileSize, map, {
          x: escort.position.x - Math.cos(escort.facingAngle) * 28,
          y: escort.position.y - Math.sin(escort.facingAngle) * 28,
        });
        return;
      }
    }

    if (this.currentState === 'following' && !escort) this.loseEscort();
    const nearestOfficer = officers
      .filter((officer) => !officer.isIncapacitated)
      .map((officer) => ({ officer, distance: this.distanceTo(officer.position) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (this.currentState === 'sheltered' && nearestOfficer && nearestOfficer.distance <= 260) {
      this.beginFollowing(nearestOfficer.officer.id);
      this.updateFollowing(dt, tileSize, map, nearestOfficer.officer.position);
      return;
    }

    this.wanderTimer -= dt;
    if (!this.wanderGoal || this.wanderTimer <= 0 ||
        this.distanceTo(this.wanderGoal) <= tileSize * 0.6) {
      this.wanderGoal = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const rollX = random();
        const rollY = random();
        if (![rollX, rollY].every((value) => Number.isFinite(value) && value >= 0 && value < 1)) break;
        const origin = {
          column: Math.floor(this.currentPosition.x / tileSize),
          row: Math.floor(this.currentPosition.y / tileSize),
        };
        const goal = {
          column: Math.max(0, Math.min(map.columns - 1, origin.column + Math.round((rollX * 2 - 1) * 5))),
          row: Math.max(0, Math.min(map.rows - 1, origin.row + Math.round((rollY * 2 - 1) * 5))),
        };
        if (map.isWalkable(goal) && findPath(map, origin, goal, { allowDiagonal: true })) {
          this.wanderGoal = { x: goal.column * tileSize + tileSize / 2, y: goal.row * tileSize + tileSize / 2 };
          this.wanderTimer = 2.5 + random() * 2.5;
          break;
        }
      }
    }
    if (this.wanderGoal) this.moveToward(dt, tileSize, map, this.wanderGoal);
  }

  updateFollowing(dt: number, tileSize: number, map: GridMap, target: CivilianPosition): void {
    if (this.currentState !== 'following' || !Number.isFinite(dt) || dt <= 0) return;
    if (!Number.isFinite(tileSize) || tileSize <= 0 || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
    this.moveToward(dt, tileSize, map, target);
  }

  replan(map: GridMap, tileSize: number, target: CivilianPosition): boolean {
    if (this.currentState !== 'following') return false;
    const start = { column: Math.floor(this.currentPosition.x / tileSize), row: Math.floor(this.currentPosition.y / tileSize) };
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
    this.clearPath();
    return true;
  }

  private moveToward(dt: number, tileSize: number, map: GridMap, target: CivilianPosition): void {
    const goal = { column: Math.floor(target.x / tileSize), row: Math.floor(target.y / tileSize) };
    const currentTile = { column: Math.floor(this.currentPosition.x / tileSize), row: Math.floor(this.currentPosition.y / tileSize) };
    if (!map.contains(goal) || !map.isWalkable(goal)) return;
    if (currentTile.column === goal.column && currentTile.row === goal.row) {
      this.clearPath();
      this.pathGoal = { ...goal };
      return;
    }
    if (!this.pathGoal || this.pathGoal.column !== goal.column || this.pathGoal.row !== goal.row || this.waypointIndex >= this.path.length) {
      this.path = findPath(map, currentTile, goal, { allowDiagonal: true }) ?? [];
      this.waypointIndex = 0;
      this.pathGoal = { ...goal };
    }
    let remaining = this.moveSpeed * dt;
    while (remaining > 0 && this.waypointIndex < this.path.length) {
      const waypoint = this.path[this.waypointIndex]!;
      const x = waypoint.column * tileSize + tileSize / 2;
      const y = waypoint.row * tileSize + tileSize / 2;
      const dx = x - this.currentPosition.x;
      const dy = y - this.currentPosition.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= remaining || distance === 0) {
        this.currentPosition = { x, y };
        remaining -= distance;
        this.waypointIndex += 1;
      } else {
        const ratio = remaining / distance;
        this.currentPosition = { x: this.currentPosition.x + dx * ratio, y: this.currentPosition.y + dy * ratio };
        remaining = 0;
      }
    }
  }

  private clearPath(): void {
    this.path = [];
    this.waypointIndex = 0;
    this.pathGoal = null;
  }

  private distanceTo(position: CivilianPosition): number {
    return Math.hypot(position.x - this.currentPosition.x, position.y - this.currentPosition.y);
  }
}
