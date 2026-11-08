import type { PoliceOfficer } from './PoliceOfficer';
import type { Infected } from './Infected';
import type { GridMap } from './world/GridMap';
import type { TilePosition } from './world/WorldConfig';

export interface CombatEvent {
  readonly officerId: number;
  readonly infectedId: number;
  readonly hit: boolean;
  readonly damage: number;
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
}

export interface CombatSystemOptions {
  readonly damagePerShot?: number;
  readonly random?: () => number;
}

/** Supercover/Bresenham visibility check over blocked world-grid cells. */
export function hasLineOfSight(
  map: GridMap,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  tileSize: number,
): boolean {
  if (!Number.isFinite(tileSize) || tileSize <= 0) {
    throw new RangeError('tileSize must be a positive finite number.');
  }

  let x = Math.floor(from.x / tileSize);
  let y = Math.floor(from.y / tileSize);
  const endX = Math.floor(to.x / tileSize);
  const endY = Math.floor(to.y / tileSize);

  if (!map.contains({ column: x, row: y }) || !map.contains({ column: endX, row: endY })) {
    return false;
  }

  const dx = Math.abs(endX - x);
  const dy = Math.abs(endY - y);
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  let error = dx - dy;

  while (x !== endX || y !== endY) {
    const twiceError = 2 * error;
    if (twiceError > -dy) {
      error -= dy;
      x += stepX;
    }
    if (twiceError < dx) {
      error += dx;
      y += stepY;
    }
    if ((x !== endX || y !== endY) && !map.isWalkable({ column: x, row: y })) {
      return false;
    }
  }

  return true;
}

/**
 * Automatic firearm combat. Each officer chooses the closest visible infected,
 * unless a player-issued priority target is still alive and in weapon range.
 * Randomness is injectable so hit resolution remains deterministic in tests.
 */
export class CombatSystem {
  readonly damagePerShot: number;
  private readonly random: () => number;
  private readonly cooldowns = new Map<number, number>();
  private readonly priorities = new Map<number, number>();

  constructor(options: CombatSystemOptions = {}) {
    this.damagePerShot = options.damagePerShot ?? 25;
    this.random = options.random ?? Math.random;
    if (!Number.isFinite(this.damagePerShot) || this.damagePerShot <= 0) {
      throw new RangeError('damagePerShot must be a positive finite number.');
    }
  }

  setTargetPriority(officerId: number, infectedId: number | null): void {
    if (infectedId === null) this.priorities.delete(officerId);
    else this.priorities.set(officerId, infectedId);
  }

  getTargetPriority(officerId: number): number | null {
    return this.priorities.get(officerId) ?? null;
  }

  update(
    dt: number,
    officers: readonly PoliceOfficer[],
    infected: readonly Infected[],
    map: GridMap,
    tileSize: number,
  ): CombatEvent[] {
    if (!Number.isFinite(dt) || dt <= 0) return [];
    const events: CombatEvent[] = [];
    const livingTargets = infected.filter((target) => !target.isDead);

    for (const officer of officers) {
      if (officer.isIncapacitated) continue;
      const origin = officer.position;
      const priorityId = this.priorities.get(officer.id);
      const priority = priorityId === undefined
        ? undefined
        : livingTargets.find((target) => target.id === priorityId);
      const target = priority && this.isValidTarget(officer, priority, origin, map, tileSize)
        ? priority
        : this.findNearestTarget(officer, livingTargets, origin, map, tileSize);

      if (!target) {
        officer.setAttacking(false);
        this.cooldowns.set(officer.id, 0);
        continue;
      }

      const destination = target.position;
      const dx = destination.x - origin.x;
      const dy = destination.y - origin.y;
      officer.setFacingAngle(Math.atan2(dy, dx));
      officer.setAttacking(true);

      const cooldown = (this.cooldowns.get(officer.id) ?? 0) + dt;
      if (cooldown + Number.EPSILON < officer.fireInterval) {
        this.cooldowns.set(officer.id, cooldown);
        continue;
      }

      this.cooldowns.set(officer.id, cooldown % officer.fireInterval);
      const hit = this.random() <= officer.accuracy;
      const damage = hit ? target.takeDamage(this.damagePerShot) : 0;
      events.push({
        officerId: officer.id,
        infectedId: target.id,
        hit,
        damage,
        from: origin,
        to: destination,
      });
    }

    for (const [officerId, targetId] of this.priorities) {
      if (!livingTargets.some((target) => target.id === targetId)) {
        this.priorities.delete(officerId);
      }
    }
    return events;
  }

  private findNearestTarget(
    officer: PoliceOfficer,
    targets: readonly Infected[],
    origin: { readonly x: number; readonly y: number },
    map: GridMap,
    tileSize: number,
  ): Infected | undefined {
    let selected: Infected | undefined;
    let selectedDistance = officer.attackRange;
    for (const target of targets) {
      if (!this.isValidTarget(officer, target, origin, map, tileSize)) continue;
      const position = target.position;
      const distance = Math.hypot(position.x - origin.x, position.y - origin.y);
      if (distance < selectedDistance) {
        selected = target;
        selectedDistance = distance;
      }
    }
    return selected;
  }

  private isValidTarget(
    officer: PoliceOfficer,
    target: Infected,
    origin: { readonly x: number; readonly y: number },
    map: GridMap,
    tileSize: number,
  ): boolean {
    const destination = target.position;
    return (
      Math.hypot(destination.x - origin.x, destination.y - origin.y) <= officer.attackRange &&
      hasLineOfSight(map, origin, destination, tileSize)
    );
  }
}
