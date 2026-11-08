import { describe, expect, it } from 'vitest';
import { Infected } from './Infected';
import { PoliceOfficer } from './PoliceOfficer';
import { GridMap } from './world/GridMap';

describe('Infected', () => {
  const map = new GridMap(10, 10);

  it('starts alive with the configured base attributes', () => {
    const infected = new Infected({ id: 1, x: 16, y: 16, entryTile: { column: 8, row: 8 } });
    expect(infected.health).toBe(60);
    expect(infected.state).toBe('idle');
    expect(infected.isDead).toBe(false);
  });

  it('moves along the grid toward its configured entry point', () => {
    const infected = new Infected({
      id: 1, x: 16, y: 16, entryTile: { column: 3, row: 1 }, moveSpeed: 32,
    });
    infected.update(1, 32, map, []);
    expect(infected.state).toBe('moving');
    expect(infected.position.x).toBeGreaterThan(16);
    expect(infected.position.y).toBeGreaterThan(16);
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
      id: 'north-window-west',
      position: { x: 864, y: 336 },
      approachTile: { column: 27, row: 9 },
      interiorTile: { column: 27, row: 11 },
      get isDestroyed() { return health <= 0; },
      takeDamage(amount: number) {
        const applied = Math.min(amount, health);
        health -= applied;
        return applied;
      },
    };
    infected.update(0.5, 32, map, [], [structure]);
    expect(infected.state).toBe('attacking');
    expect(health).toBe(13);
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


describe('Infected residence breach', () => {
  it('moves through an opened entrance and records that it entered the residence', () => {
    const map = new GridMap(10, 10);
    const structureTile = { column: 2, row: 2 };
    map.setBlocked(structureTile);
    const infected = new Infected({
      id: 2,
      x: 80,
      y: 48,
      entryTile: { column: 2, row: 1 },
      moveSpeed: 64,
      detectionRange: 1,
    });
    let health = 1;
    const entrance = {
      id: 'test-door',
      position: { x: 80, y: 80 },
      approachTile: { column: 2, row: 1 },
      interiorTile: { column: 2, row: 3 },
      get isDestroyed() { return health <= 0; },
      takeDamage(amount: number) {
        const applied = Math.min(amount, health);
        health -= applied;
        return applied;
      },
    };

    infected.update(0.1, 32, map, [], [entrance]);
    expect(entrance.isDestroyed).toBe(true);
    map.setBlocked(structureTile, false);
    infected.update(1, 32, map, [], [entrance]);

    expect(infected.hasEnteredResidence).toBe(true);
    expect(infected.position.y).toBeGreaterThan(48);
  });
});
