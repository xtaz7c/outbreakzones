import { describe, expect, it } from 'vitest';
import { Infected } from './Infected';
import { PoliceOfficer } from './PoliceOfficer';
import { GridMap } from './world/GridMap';

describe('Infected roaming and combat AI', () => {
  it('starts alive with the configured base attributes', () => {
    const infected = new Infected({ id: 1, x: 16, y: 16 });
    expect(infected.health).toBe(60);
    expect(infected.state).toBe('idle');
    expect(infected.isDead).toBe(false);
  });

  it('chooses a random walkable destination and wanders without a target', () => {
    const map = new GridMap(20, 20);
    const infected = new Infected({
      id: 1,
      x: 16,
      y: 16,
      moveSpeed: 32,
      random: () => 0.99,
    });

    infected.update(1, 32, map, []);

    expect(infected.state).toBe('moving');
    expect(infected.position).not.toEqual({ x: 16, y: 16 });
  });

  it('does not cross a solid shelter perimeter while wandering', () => {
    const map = new GridMap(20, 20);
    for (let column = 5; column <= 14; column += 1) {
      map.setBlocked({ column, row: 5 });
      map.setBlocked({ column, row: 14 });
    }
    for (let row = 5; row <= 14; row += 1) {
      map.setBlocked({ column: 5, row });
      map.setBlocked({ column: 14, row });
    }

    const infected = new Infected({
      id: 1,
      x: 9 * 32 + 16,
      y: 15 * 32 + 16,
      moveSpeed: 64,
      wanderRadiusTiles: 8,
      random: () => 0,
    });

    for (let index = 0; index < 180; index += 1) {
      infected.update(1 / 60, 32, map, []);
    }

    expect(infected.position.y).toBeGreaterThan(14 * 32);
    expect(map.isWalkable({
      column: Math.floor(infected.position.x / 32),
      row: Math.floor(infected.position.y / 32),
    })).toBe(true);
  });

  it('detects a nearby officer and attacks at the configured interval', () => {
    const infected = new Infected({
      id: 1,
      x: 16,
      y: 16,
      detectionRange: 100,
      attackRange: 30,
      attackInterval: 0.5,
      damage: 12,
    });
    const officer = new PoliceOfficer({ id: 1, x: 40, y: 16 });

    infected.update(0.5, 32, new GridMap(10, 10), [officer]);

    expect(infected.state).toBe('attacking');
    expect(officer.health).toBe(88);
  });

  it('pursues an officer that is detected outside attack range', () => {
    const infected = new Infected({
      id: 1,
      x: 16,
      y: 16,
      detectionRange: 200,
      attackRange: 10,
      moveSpeed: 32,
      random: () => 0.5,
    });
    const officer = new PoliceOfficer({ id: 1, x: 120, y: 16 });

    infected.update(0.5, 32, new GridMap(10, 10), [officer]);

    expect(infected.state).toBe('moving');
    expect(infected.position.x).toBeGreaterThan(16);
  });

  it('ignores incapacitated officers and resumes random wandering', () => {
    const infected = new Infected({
      id: 1,
      x: 16,
      y: 16,
      moveSpeed: 32,
      random: () => 0.99,
    });
    const officer = new PoliceOfficer({ id: 1, x: 24, y: 16 });
    officer.takeDamage(100);

    infected.update(0.5, 32, new GridMap(10, 10), [officer]);

    expect(infected.state).toBe('moving');
    expect(infected.position).not.toEqual({ x: 16, y: 16 });
  });

  it('clamps damage to remaining health and enters dead state', () => {
    const infected = new Infected({ id: 1, x: 16, y: 16 });
    expect(infected.takeDamage(100)).toBe(60);
    expect(infected.health).toBe(0);
    expect(infected.state).toBe('dead');
    expect(infected.takeDamage(10)).toBe(0);
  });

  it('ignores invalid damage and non-positive update deltas', () => {
    const infected = new Infected({ id: 1, x: 16, y: 16 });
    infected.update(0, 32, new GridMap(10, 10), []);
    expect(infected.takeDamage(Number.NaN)).toBe(0);
    expect(infected.health).toBe(60);
    expect(infected.state).toBe('idle');
  });
});
