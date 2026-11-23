import { describe, expect, it } from 'vitest';
import { GridMap } from '../../world/GridMap';
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


describe('findPath on larger maps', () => {
  it('finds a valid route through a single opening in a full-height barrier', () => {
    const map = new GridMap(120, 90);
    for (let row = 0; row < map.rows; row += 1) {
      if (row !== 60) map.setBlocked({ column: 60, row });
    }

    const start = { column: 2, row: 45 };
    const goal = { column: 117, row: 45 };
    const path = findPath(map, start, goal);

    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual(goal);
    expect(path?.some((cell) => cell.column === 60 && cell.row === 60)).toBe(true);

    let previous = start;
    for (const cell of path ?? []) {
      const dx = Math.abs(cell.column - previous.column);
      const dy = Math.abs(cell.row - previous.row);
      expect(Math.max(dx, dy)).toBe(1);
      expect(map.isWalkable(cell)).toBe(true);
      if (dx === 1 && dy === 1) {
        expect(map.isWalkable({ column: cell.column, row: previous.row })).toBe(true);
        expect(map.isWalkable({ column: previous.column, row: cell.row })).toBe(true);
      }
      previous = cell;
    }
  });
});


describe('findReachableTiles', () => {
  it('matches findPath reachability for every tile in deterministic obstacle maps', () => {
    for (let seed = 1; seed <= 8; seed += 1) {
      const map = new GridMap(9, 8);
      for (let row = 0; row < map.rows; row += 1) {
        for (let column = 0; column < map.columns; column += 1) {
          const hash = (column * 17 + row * 29 + seed * 13) % 11;
          if (hash < 3) map.setBlocked({ column, row });
        }
      }
      const start = { column: 4, row: 4 };
      const reachable = findReachableTiles(map, start);
      for (let row = 0; row < map.rows; row += 1) {
        for (let column = 0; column < map.columns; column += 1) {
          const goal = { column, row };
          const expected = findPath(map, start, goal) !== null;
          expect(reachable[row * map.columns + column] === 1).toBe(expected);
        }
      }
    }
  });

  it('respects blocked corners and cardinal-only movement', () => {
    const map = new GridMap(3, 3);
    map.setBlocked({ column: 1, row: 0 });
    map.setBlocked({ column: 0, row: 1 });
    const start = { column: 0, row: 0 };
    expect(findReachableTiles(map, start)[4]).toBe(0);
    expect(findReachableTiles(map, { column: 1, row: 1 })[0]).toBe(0);
    expect(findReachableTiles(map, start, { allowDiagonal: false })[4]).toBe(0);
  });

  it('returns an empty mask for a blocked or invalid start', () => {
    const map = new GridMap(3, 3);
    map.setBlocked({ column: 1, row: 1 });
    expect(findReachableTiles(map, { column: 1, row: 1 }).every((value) => value === 0)).toBe(true);
    expect(findReachableTiles(map, { column: -1, row: 0 }).every((value) => value === 0)).toBe(true);
  });
});


describe('findReachableTiles target-limited search', () => {
  it('stops after all requested local candidates are reached', () => {
    const map = new GridMap(40, 40);
    const start = { column: 20, row: 20 };
    const targets = [
      { column: 18, row: 18 },
      { column: 22, row: 18 },
      { column: 18, row: 22 },
      { column: 22, row: 22 },
    ];
    const reachable = findReachableTiles(map, start, { allowDiagonal: true }, targets);
    for (const target of targets) {
      expect(reachable[target.row * map.columns + target.column]).toBe(1);
    }
    expect(reachable[39 * map.columns + 39]).toBe(0);
  });
});
