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
