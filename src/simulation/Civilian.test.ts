import { describe, expect, it } from 'vitest';
import { Civilian } from './Civilian';
import { GridMap } from './world/GridMap';

describe('Civilian navigation', () => {
  it('follows a target through a walkable door cell', () => {
    const grid = new GridMap(10, 10);
    for (let row = 0; row < 10; row += 1) grid.setBlocked({ column: 4, row });
    grid.setBlocked({ column: 4, row: 5 }, false);
    const civilian = new Civilian({ id: 1, x: 48, y: 48, moveSpeed: 96 });
    expect(civilian.beginFollowing(2)).toBe(true);

    for (let index = 0; index < 240; index += 1) {
      civilian.updateFollowing(1 / 60, 32, grid, { x: 208, y: 176 });
    }

    expect(civilian.position.x).toBeGreaterThan(160);
    expect(civilian.position.y).toBeGreaterThan(144);
    expect(civilian.escortId).toBe(2);
  });

  it('does not cross a blocked window or wall', () => {
    const grid = new GridMap(10, 10);
    for (let row = 0; row < 10; row += 1) grid.setBlocked({ column: 4, row });
    const civilian = new Civilian({ id: 1, x: 48, y: 48 });
    civilian.beginFollowing(1);

    for (let index = 0; index < 300; index += 1) {
      civilian.updateFollowing(1 / 60, 32, grid, { x: 208, y: 176 });
    }

    expect(civilian.position).toEqual({ x: 48, y: 48 });
  });

  it('replans when the navigation grid changes', () => {
    const grid = new GridMap(10, 10);
    for (let row = 0; row < 10; row += 1) grid.setBlocked({ column: 4, row });
    const civilian = new Civilian({ id: 1, x: 48, y: 48 });
    civilian.beginFollowing(1);
    expect(civilian.replan(grid, 32, { x: 208, y: 176 })).toBe(false);

    grid.setBlocked({ column: 4, row: 5 }, false);
    expect(civilian.replan(grid, 32, { x: 208, y: 176 })).toBe(true);
    for (let index = 0; index < 240; index += 1) {
      civilian.updateFollowing(1 / 60, 32, grid, { x: 208, y: 176 });
    }
    expect(civilian.position.x).toBeGreaterThan(160);
  });
});


describe('Civilian awareness and survival', () => {
  it('automatically follows a nearby visible police officer while calm', () => {
    const grid = new GridMap(10, 10);
    const civilian = new Civilian({ id: 1, x: 48, y: 48 });
    const officer = new PoliceOfficer({ id: 1, x: 96, y: 48 });
    civilian.updateAwareness(1 / 60, 32, grid, [officer], []);
    expect(civilian.state).toBe('following');
    expect(civilian.escortId).toBe(1);
    expect(civilian.mood).toBe('calm');
  });

  it('panics and flees along a reachable route from a visible infected', () => {
    const grid = new GridMap(12, 12);
    const civilian = new Civilian({ id: 1, x: 160, y: 160 });
    civilian.updateAwareness(1 / 60, 32, grid, [], [{ x: 208, y: 160 }]);
    expect(civilian.mood).toBe('panicked');
    expect(civilian.state).toBe('following');
    expect(civilian.position.x).toBeLessThan(160);
  });

  it('loses an escort when the officer is too far away', () => {
    const grid = new GridMap(20, 20);
    const civilian = new Civilian({ id: 1, x: 48, y: 48 });
    civilian.beginFollowing(1);
    const officer = new PoliceOfficer({ id: 1, x: 500, y: 500 });
    civilian.updateAwareness(1 / 60, 32, grid, [officer], []);
    expect(civilian.escortId).toBeNull();
    expect(civilian.mood).toBe('panicked');
  });

  it('takes damage, panics, and becomes incapacitated at zero health', () => {
    const civilian = new Civilian({ id: 1, x: 48, y: 48, maxHealth: 20 });
    expect(civilian.takeDamage(8)).toBe(8);
    expect(civilian.health).toBe(12);
    expect(civilian.mood).toBe('panicked');
    expect(civilian.takeDamage(20)).toBe(12);
    expect(civilian.isIncapacitated).toBe(true);
    expect(civilian.takeDamage(1)).toBe(0);
  });
});
