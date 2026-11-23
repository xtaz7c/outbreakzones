import type { PoliceOfficer } from './PoliceOfficer';
import type { Infected } from './Infected';
import { hasLineOfSight } from '../systems/CombatSystem';
import type { TilePosition } from '../world/WorldConfig';
import { GridMap } from '../world/GridMap';
import { findPath, findReachableTiles } from '../systems/navigation/Pathfinder';

export type CivilianState = 'sheltered' | 'following' | 'extracted' | 'incapacitated';
export type CivilianMood = 'calm' | 'panicked';

export interface CivilianConfig {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly moveSpeed?: number;
  readonly maxHealth?: number;
  readonly armed?: boolean;
}

export interface CivilianPosition {
  readonly x: number;
  readonly y: number;
}

export class Civilian {
  readonly id: number;
  readonly moveSpeed: number;
  readonly maxHealth: number;
  readonly isArmed: boolean;
  private fireCooldown = 0;
  private stamina = 100;
  private running = false;
  private static readonly MAX_STAMINA = 100;
  private static readonly SPRINT_DRAIN_PER_SECOND = 30;
  private static readonly STAMINA_RECOVERY_PER_SECOND = 18;
  private static readonly SPRINT_SPEED_MULTIPLIER = 1.65;
  private currentHealth: number;
  private currentPosition: { x: number; y: number };
  private currentState: CivilianState = 'sheltered';
  private currentMood: CivilianMood = 'calm';
  private panicRemaining = 0;
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
    this.maxHealth = config.maxHealth ?? 60;
    if (!Number.isFinite(this.moveSpeed) || this.moveSpeed <= 0) {
      throw new RangeError('Civilian moveSpeed must be positive.');
    }
    if (!Number.isFinite(this.maxHealth) || this.maxHealth <= 0) {
      throw new RangeError('Civilian maxHealth must be positive.');
    }
    this.id = config.id;
    this.isArmed = config.armed ?? false;
    this.currentHealth = this.maxHealth;
    this.currentPosition = { x: config.x, y: config.y };
  }

  get state(): CivilianState { return this.currentState; }
  get mood(): CivilianMood { return this.currentMood; }
  get health(): number { return this.currentHealth; }
  get isIncapacitated(): boolean { return this.currentState === 'incapacitated'; }
  get position(): CivilianPosition { return { ...this.currentPosition }; }
  get isRescued(): boolean { return this.currentState === 'extracted'; }
  get escortId(): number | null { return this.escortOfficerId; }
  get currentStamina(): number { return this.stamina; }
  get isRunning(): boolean { return this.running; }

  private recoverStamina(dt: number): void {
    this.stamina = Math.min(
      Civilian.MAX_STAMINA,
      this.stamina + Civilian.STAMINA_RECOVERY_PER_SECOND * dt,
    );
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

  /** Armed civilians defend themselves against nearby visible infected. */
  updateCombat(dt: number, infected: readonly Infected[], map: GridMap, tileSize: number): boolean {
    if (!this.isArmed || this.isIncapacitated || this.isRescued || !Number.isFinite(dt) || dt <= 0) return false;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.fireCooldown > 0) return false;
    const target = infected
      .filter((candidate) => !candidate.isDead)
      .map((candidate) => ({ candidate, distance: Math.hypot(candidate.position.x - this.currentPosition.x, candidate.position.y - this.currentPosition.y) }))
      .filter(({ candidate, distance }) => distance <= 300 && hasLineOfSight(map, this.currentPosition, candidate.position, tileSize))
      .sort((a, b) => a.distance - b.distance)[0]?.candidate;
    if (!target) return false;
    target.takeDamage(12);
    this.fireCooldown = 1.8;
    return true;
  }

  takeDamage(amount: number): number {
    if (this.isIncapacitated || this.isRescued || !Number.isFinite(amount) || amount <= 0) return 0;
    const applied = Math.min(amount, this.currentHealth);
    this.currentHealth = Math.max(0, this.currentHealth - applied);
    this.currentMood = 'panicked';
    this.panicRemaining = Math.max(this.panicRemaining, 3);
    this.escortOfficerId = null;
    if (this.currentState === 'sheltered') this.currentState = 'following';
    if (this.currentHealth === 0) {
      this.currentState = 'incapacitated';
      this.path = [];
      this.waypointIndex = 0;
      this.pathGoal = null;
    }
    return applied;
  }

  /**
   * Civilian perception uses the same grid line-of-sight rule as infected.
   * Panic breaks the current escort and chooses a reachable tile away from
   * the nearest visible infected. Calm civilians can join a nearby officer.
   */
  updateAwareness(
    dt: number,
    tileSize: number,
    map: GridMap,
    officers: readonly PoliceOfficer[],
    threats: readonly CivilianPosition[],
  ): void {
    if (this.isIncapacitated || this.isRescued || !Number.isFinite(dt) || dt <= 0) return;
    this.running = false;

    const threat = threats
      .filter((candidate) =>
        Math.hypot(candidate.x - this.currentPosition.x, candidate.y - this.currentPosition.y) <= 260 &&
        hasLineOfSight(map, this.currentPosition, candidate, tileSize))
      .sort((a, b) =>
        Math.hypot(a.x - this.currentPosition.x, a.y - this.currentPosition.y) -
        Math.hypot(b.x - this.currentPosition.x, b.y - this.currentPosition.y))[0];

    if (threat) {
      this.currentMood = 'panicked';
      this.panicRemaining = 3;
      this.escortOfficerId = null;
      if (this.currentState === 'sheltered') this.currentState = 'following';
      const start = {
        column: Math.floor(this.currentPosition.x / tileSize),
        row: Math.floor(this.currentPosition.y / tileSize),
      };
      const candidateTiles: TilePosition[] = [];
      for (let row = Math.max(0, start.row - 4); row <= Math.min(map.rows - 1, start.row + 4); row += 1) {
        for (let column = Math.max(0, start.column - 4); column <= Math.min(map.columns - 1, start.column + 4); column += 1) {
          const candidate = { column, row };
          if (map.isWalkable(candidate)) candidateTiles.push(candidate);
        }
      }
      const reachable = findReachableTiles(map, start, { allowDiagonal: true }, candidateTiles);
      const candidates = candidateTiles.filter((candidate) =>
        reachable[candidate.row * map.columns + candidate.column] === 1);
      candidates.sort((a, b) => {
        const distanceA = Math.hypot(
          a.column * tileSize + tileSize / 2 - threat.x,
          a.row * tileSize + tileSize / 2 - threat.y,
        );
        const distanceB = Math.hypot(
          b.column * tileSize + tileSize / 2 - threat.x,
          b.row * tileSize + tileSize / 2 - threat.y,
        );
        return distanceB - distanceA;
      });
      const fleeTile = candidates.find((candidate) =>
        Math.hypot(candidate.column - start.column, candidate.row - start.row) >= 2);
      if (fleeTile) {
        const fleeTarget = {
          x: fleeTile.column * tileSize + tileSize / 2,
          y: fleeTile.row * tileSize + tileSize / 2,
        };
        const sprintDuration = Math.min(dt, this.stamina / Civilian.SPRINT_DRAIN_PER_SECOND);
        if (sprintDuration > 0) {
          this.running = true;
          this.moveTo(sprintDuration, tileSize, map, fleeTarget,
            this.moveSpeed * Civilian.SPRINT_SPEED_MULTIPLIER);
          this.stamina = Math.max(0, this.stamina - sprintDuration * Civilian.SPRINT_DRAIN_PER_SECOND);
        }
        const walkingDuration = dt - sprintDuration;
        if (walkingDuration > 0) this.moveTo(walkingDuration, tileSize, map, fleeTarget);
      }
      return;
    }

    this.recoverStamina(dt);
    if (this.panicRemaining > 0) {
      this.panicRemaining = Math.max(0, this.panicRemaining - dt);
      if (this.panicRemaining > 0) return;
    }
    this.currentMood = 'calm';

    const visibleOfficers = officers
      .filter((officer) => !officer.isIncapacitated &&
        Math.hypot(officer.position.x - this.currentPosition.x, officer.position.y - this.currentPosition.y) <= 260 &&
        hasLineOfSight(map, this.currentPosition, officer.position, tileSize))
      .sort((a, b) =>
        Math.hypot(a.position.x - this.currentPosition.x, a.position.y - this.currentPosition.y) -
        Math.hypot(b.position.x - this.currentPosition.x, b.position.y - this.currentPosition.y));

    if (this.currentState === 'sheltered') {
      const nearby = visibleOfficers.find((officer) => findPath(
        map,
        { column: Math.floor(this.currentPosition.x / tileSize), row: Math.floor(this.currentPosition.y / tileSize) },
        { column: Math.floor(officer.position.x / tileSize), row: Math.floor(officer.position.y / tileSize) },
        { allowDiagonal: true },
      ) !== null);
      if (nearby) this.beginFollowing(nearby.id);
      return;
    }

    if (this.currentState !== 'following') return;
    const escort = officers.find((officer) => officer.id === this.escortOfficerId && !officer.isIncapacitated);
    if (escort) {
      const distance = Math.hypot(escort.position.x - this.currentPosition.x, escort.position.y - this.currentPosition.y);
      const route = findPath(
        map,
        { column: Math.floor(this.currentPosition.x / tileSize), row: Math.floor(this.currentPosition.y / tileSize) },
        { column: Math.floor(escort.position.x / tileSize), row: Math.floor(escort.position.y / tileSize) },
        { allowDiagonal: true },
      );
      if (distance > 340 || route === null) {
        this.escortOfficerId = null;
        this.currentMood = 'panicked';
        this.panicRemaining = 1.5;
        return;
      }
    }
    if (!escort) {
      const nearby = visibleOfficers.find((officer) => findPath(
        map,
        { column: Math.floor(this.currentPosition.x / tileSize), row: Math.floor(this.currentPosition.y / tileSize) },
        { column: Math.floor(officer.position.x / tileSize), row: Math.floor(officer.position.y / tileSize) },
        { allowDiagonal: true },
      ) !== null);
      if (nearby) this.assignEscort(nearby.id);
    }
  }

  updateFollowing(dt: number, tileSize: number, map: GridMap, target: CivilianPosition): void {
    if (this.currentState !== 'following' || !Number.isFinite(dt) || dt <= 0) return;
    if (!Number.isFinite(tileSize) || tileSize <= 0 ||
        !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
    this.recoverStamina(dt);
    this.moveTo(dt, tileSize, map, target);
  }

  private moveTo(
    dt: number,
    tileSize: number,
    map: GridMap,
    target: CivilianPosition,
    speed = this.moveSpeed,
  ): void {
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

    let distanceRemaining = speed * dt;
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
    if (this.currentState !== 'following' || this.isIncapacitated) return false;
    this.currentState = 'extracted';
    this.path = [];
    this.waypointIndex = 0;
    return true;
  }
}
