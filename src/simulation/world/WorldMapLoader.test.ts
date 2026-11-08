import { describe, expect, it } from 'vitest';
import { buildGridFromTiledLayers } from './WorldMapLoader';

describe('buildGridFromTiledLayers', () => {
  it('converts Tiled rectangles into blocked grid cells', () => {
    const grid = buildGridFromTiledLayers(8, 6, 32, [
      { objects: [{ x: 64, y: 32, width: 64, height: 32 }] },
    ]);

    expect(grid.isWalkable({ column: 1, row: 1 })).toBe(true);
    expect(grid.isWalkable({ column: 2, row: 1 })).toBe(false);
    expect(grid.isWalkable({ column: 3, row: 1 })).toBe(false);
    expect(grid.isWalkable({ column: 4, row: 1 })).toBe(true);
  });

  it('combines multiple object layers and clips objects at map edges', () => {
    const grid = buildGridFromTiledLayers(4, 3, 32, [
      { objects: [{ x: 0, y: 0, width: 32, height: 32 }] },
      { objects: [{ x: 96, y: 32, width: 64, height: 64 }] },
    ]);

    expect(grid.isWalkable({ column: 0, row: 0 })).toBe(false);
    expect(grid.isWalkable({ column: 3, row: 1 })).toBe(false);
    expect(grid.isWalkable({ column: 3, row: 2 })).toBe(false);
  });

  it('ignores invalid and zero-area objects', () => {
    const grid = buildGridFromTiledLayers(4, 4, 32, [
      {
        objects: [
          { x: Number.NaN, y: 0, width: 32, height: 32 },
          { x: 32, y: 32, width: 0, height: 32 },
        ],
      },
    ]);

    expect(grid.isWalkable({ column: 1, row: 1 })).toBe(true);
  });

  it('rejects an invalid tile size', () => {
    expect(() => buildGridFromTiledLayers(4, 4, 0, [])).toThrow(RangeError);
  });
});
