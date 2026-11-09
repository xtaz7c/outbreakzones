import { describe, expect, it } from 'vitest';
import { Infected } from './Infected';
import { PoliceOfficer } from './PoliceOfficer';
import { GridMap } from './world/GridMap';

describe('Infected', () => {
  const map = new GridMap(10, 10);

  it('enters the map from beyond the western boundary before using normal navigation', () => {
    const infected = new Infected({
      id: 1, x: -48, y: 80, entryTile: { column: 0, row: 2 }, moveSpeed: 32,
    });
    infected.update(0.5, 32, map, []);
    expect(infected.state).toBe('moving');
    expect(infected.position.x).toBeGreaterThan(-48);
    expect(infected.position.x).toBeLessThan(16);
    for (let index = 0; index < 120; index += 1) infected.update(1 / 60, 32, map, []);
    expect(infected.position.x).toBeCloseTo(16, 8);
    expect(infected.position.y).toBe(80);
  });

  it('starts alive with the configured base attributes', () => {
    const infected = new Infected({ id: 1, x: 16, y: 16, entryTile: { column: 8, row: 8 } });
    expect(infected.health).toBe(60);
    expect(infected.state).toBe('idle');
    expect(infected.isDead).toBe(false);
  });

  it('patrols to a deterministic random walkable tile when no target is perceived', () => {
    const infected = new Infected({
      id: 1, x: 16, y: 16, entryTile: { column: 1, row: 1 }, moveSpeed: 32,
      random: () => 0.5, patrolRadiusTiles: 3,
    });
    infected.update(1, 32, map, []);
    expect(infected.state).toBe('moving');
    expect(infected.position).not.toEqual({ x: 16, y: 16 });
  });

  it('investigates a heard stimulus before resuming patrol', () => {
    const infected = new Infected({
      id: 1, x: 16, y: 16, entryTile: { column: 8, row: 8 }, moveSpeed: 32,
      detectionRange: 20, hearingRange: 200, random: () => 0.5,
    });
    infected.update(0.5, 32, map, [], undefined, [{
      id: 'gunshot-1', position: { x: 112, y: 16 }, radius: 180, strength: 1,
    }]);
    expect(infected.state).toBe('moving');
    expect(infected.position.x).toBeGreaterThan(16);
  });

  it('keeps patrolling without requiring a fixed entry destination', () => {
    const infected = new Infected({
      id: 1, x: 16, y: 16, entryTile: { column: 3, row: 1 }, moveSpeed: 32, random: () => 0.5,
    });
    infected.update(1, 32, map, []);
    expect(infected.state).toBe('moving');
    expect(infected.position).not.toEqual({ x: 16, y: 16 });
    expect(map.isWalkable({ column: Math.floor(infected.position.x / 32), row: Math.floor(infected.position.y / 32) })).toBe(true);
  });

  it('does not visually detect an officer through a blocked wall', () => {
    const blockedMap = new GridMap(10, 10);
    blockedMap.setBlocked({ column: 1, row: 0 });
    const infected = new Infected({
      id: 1, x: 16, y: 16, entryTile: { column: 8, row: 8 }, moveSpeed: 32,
      detectionRange: 200, random: () => 0.5,
    });
    const officer = new PoliceOfficer({ id: 1, x: 80, y: 16 });
    infected.update(0.5, 32, blockedMap, [officer]);
    expect(infected.state).not.toBe('attacking');
  });

  it('detects a nearby officer and attacks at the configured interval', () => {
    const infected = new Infected({
      id: 1, x: 16, y: 16, entryTile: { column: 8, row: 8 },
      detectionRange: 100, attackRange: 30, attackInterval: 0.5, damage: 12,
    });
    const officer = new PoliceOfficer({ id: 1, x: 40, y: 16 });
    infected.update(0.5, 32, map, [officer]);
    expect(infected.state).toBe('attacking');
    expect(officer.health).toBe(88);
  });

  it('detects and attacks a civilian using the same line-of-sight rules as officers', () => {
    const infected = new Infected({
      id: 2, x: 16, y: 16, entryTile: { column: 8, row: 8 },
      detectionRange: 100, attackRange: 30, attackInterval: 0.5, damage: 12,
    });
    const civilian = {
      id: 1,
      position: { x: 40, y: 16 },
      isIncapacitated: false,
      health: 60,
      takeDamage(amount: number) {
        const applied = Math.min(amount, this.health);
        this.health -= applied;
        if (this.health <= 0) this.isIncapacitated = true;
        return applied;
      },
    };
    infected.update(0.5, 32, map, [civilian]);
    expect(infected.state).toBe('attacking');
    expect(civilian.health).toBe(48);
  });

  it('ignores incapacitated officers when selecting targets', () => {
    const infected = new Infected({
      id: 1, x: 16, y: 16, entryTile: { column: 8, row: 8 }, moveSpeed: 32,
    });
    const officer = new PoliceOfficer({ id: 1, x: 24, y: 16 });
    officer.takeDamage(100);
    infected.update(0.5, 32, map, [officer]);
    expect(infected.state).toBe('moving');
    expect(infected.position).not.toEqual({ x: 16, y: 16 });
  });

  it('closes the remaining distance when target shares its current tile', () => {
    const infected = new Infected({
      id: 1, x: 16, y: 16, entryTile: { column: 8, row: 8 },
      detectionRange: 100, attackRange: 10, moveSpeed: 20,
    });
    const officer = new PoliceOfficer({ id: 1, x: 30, y: 16 });
    infected.update(0.25, 32, map, [officer]);
    expect(infected.state).toBe('moving');
    expect(infected.position.x).toBeGreaterThan(16);
    expect(infected.position.x).toBeLessThan(30);
  });

  it('attacks a supplied destructible structure target', () => {
    const infected = new Infected({
      id: 1, x: 880, y: 304, entryTile: { column: 8, row: 8 },
      detectionRange: 10, attackInterval: 0.5, damage: 7,
    });
    let health = 20;
    const structure = {
      position: { x: 864, y: 336 },
      approachTile: { column: 27, row: 9 },
      get isDestroyed() { return health <= 0; },
      takeDamage(amount: number) {
        const applied = Math.min(amount, health);
        health -= applied;
        return applied;
      },
    };
    infected.update(0.5, 32, new GridMap(40, 40), [], structure);
    expect(infected.state).toBe('attacking');
    expect(health).toBe(13);
  });


  it('moves through a breached access to the interior tile', () => {
    const infected = new Infected({
      id: 1, x: 48, y: 48, entryTile: { column: 1, row: 1 }, moveSpeed: 32,
    });
    const breached = {
      position: { x: 48, y: 48 },
      approachTile: { column: 1, row: 1 },
      breachTile: { column: 2, row: 1 },
      isDestroyed: true,
      takeDamage: () => 0,
    };
    infected.update(1, 32, map, [], breached);
    expect(infected.position.x).toBeGreaterThan(48);
    expect(infected.state).toBe('idle');
  });

  it('clamps damage to remaining health and enters dead state', () => {
    const infected = new Infected({ id: 1, x: 16, y: 16, entryTile: { column: 8, row: 8 } });
    expect(infected.takeDamage(100)).toBe(60);
    expect(infected.health).toBe(0);
    expect(infected.state).toBe('dead');
    expect(infected.takeDamage(10)).toBe(0);
  });

  it('ignores invalid damage and non-positive update deltas', () => {
    const infected = new Infected({ id: 1, x: 16, y: 16, entryTile: { column: 8, row: 8 } });
    infected.update(0, 32, map, []);
    expect(infected.takeDamage(Number.NaN)).toBe(0);
    expect(infected.health).toBe(60);
    expect(infected.state).toBe('idle');
  });
});
