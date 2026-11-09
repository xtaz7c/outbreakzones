import { describe, expect, it } from 'vitest';
import { Civilian } from './Civilian';
import { GridMap } from './world/GridMap';

describe('Civilian navigation', () => {
  it('panics and moves away from a visible infected threat', () => {
    const grid = new GridMap(20, 20);
    const civilian = new Civilian({ id: 1, x: 160, y: 160, moveSpeed: 96 });
    civilian.updateAutonomous(1, 32, grid, [], [{ x: 96, y: 160 }], () => 0.5);
    expect(civilian.behaviorState).toBe('panic');
    expect(civilian.position.x).toBeGreaterThan(160);
  });

  it('automatically follows a nearby police officer when calm', () => {
    const grid = new GridMap(20, 20);
    const civilian = new Civilian({ id: 1, x: 160, y: 160, moveSpeed: 96 });
    const officer = { id: 7, position: { x: 190, y: 160 }, facingAngle: 0, isIncapacitated: false };
    civilian.updateAutonomous(1, 32, grid, [officer], [], () => 0.5);
    expect(civilian.state).toBe('following');
    expect(civilian.escortId).toBe(7);
  });

  it('can lose an escort when separated and resume calm wandering', () => {
    const civilian = new Civilian({ id: 1, x: 160, y: 160 });
    civilian.beginFollowing(7);
    expect(civilian.loseEscort()).toBe(true);
    expect(civilian.state).toBe('sheltered');
    expect(civilian.escortId).toBeNull();
  });

  it('can be attacked and incapacitated by infected', () => {
    const civilian = new Civilian({ id: 1, x: 160, y: 160 });
    expect(civilian.takeDamage(20)).toBe(20);
    expect(civilian.health).toBe(40);
    expect(civilian.takeDamage(100)).toBe(40);
    expect(civilian.isIncapacitated).toBe(true);
    expect(civilian.takeDamage(10)).toBe(0);
  });
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
