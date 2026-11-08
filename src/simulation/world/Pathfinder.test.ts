import { describe, expect, it } from 'vitest';
import { GridMap } from './GridMap';
import { findPath } from './Pathfinder';

describe('GridMap', () => {
  it('tracks walkable and blocked cells', () => {
    const map = new GridMap(4, 3);
    const cell = { column: 2, row: 1 };

    expect(map.isWalkable(cell)).toBe(true);
    map.setBlocked(cell);
    expect(map.isWalkable(cell)).toBe(false);
    map.setBlocked(cell, false);
    expect(map.isWalkable(cell)).toBe(true);
  });

  it('rejects invalid dimensions and out-of-bounds writes', () => {
    expect(() => new GridMap(0, 4)).toThrow(RangeError);
    expect(() => new GridMap(4, -1)).toThrow(RangeError);

    const map = new GridMap(4, 3);
    expect(map.isWalkable({ column: -1, row: 0 })).toBe(false);
    expect(() => map.setBlocked({ column: 4, row: 0 })).toThrow(RangeError);
  });
});

describe('findPath', () => {
  it('returns a path from start to goal without including the start', () => {
    const map = new GridMap(5, 5);
    const path = findPath(map, { column: 0, row: 0 }, { column: 4, row: 4 });

    expect(path).not.toBeNull();
    expect(path).toHaveLength(4);
    expect(path?.[0]).toEqual({ column: 1, row: 1 });
    expect(path?.at(-1)).toEqual({ column: 4, row: 4 });
  });

  it('returns an empty path when start equals goal', () => {
    const map = new GridMap(3, 3);
    expect(findPath(map, { column: 1, row: 1 }, { column: 1, row: 1 })).toEqual([]);
  });

  it('routes around blocked cells', () => {
    const map = new GridMap(5, 3);
    map.setBlocked({ column: 2, row: 0 });
    map.setBlocked({ column: 2, row: 1 });
    map.setBlocked({ column: 2, row: 2 });

    expect(findPath(map, { column: 0, row: 1 }, { column: 4, row: 1 })).toBeNull();

    map.setBlocked({ column: 2, row: 2 }, false);
    const path = findPath(map, { column: 0, row: 1 }, { column: 4, row: 1 });
    expect(path).not.toBeNull();
    expect(path?.some((cell) => cell.column === 2 && cell.row === 1)).toBe(false);
  });

  it('does not cut diagonally between two blocked cells', () => {
    const map = new GridMap(2, 2);
    map.setBlocked({ column: 1, row: 0 });
    map.setBlocked({ column: 0, row: 1 });

    expect(findPath(map, { column: 0, row: 0 }, { column: 1, row: 1 })).toBeNull();
  });

  it('supports cardinal-only movement', () => {
    const map = new GridMap(3, 3);
    const path = findPath(
      map,
      { column: 0, row: 0 },
      { column: 2, row: 2 },
      { allowDiagonal: false },
    );

    expect(path).toHaveLength(4);
    expect(path?.every((cell, index) => {
      const previous = index === 0 ? { column: 0, row: 0 } : path[index - 1]!;
      return Math.abs(cell.column - previous.column) + Math.abs(cell.row - previous.row) === 1;
    })).toBe(true);
  });

  it('rejects blocked or out-of-bounds endpoints', () => {
    const map = new GridMap(3, 3);
    map.setBlocked({ column: 1, row: 1 });

    expect(findPath(map, { column: 0, row: 0 }, { column: 1, row: 1 })).toBeNull();
    expect(findPath(map, { column: -1, row: 0 }, { column: 2, row: 2 })).toBeNull();
  });
});
