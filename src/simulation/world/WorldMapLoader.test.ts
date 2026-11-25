import { describe, expect, it } from 'vitest';
import { buildGridFromTiledLayers, scaleTiledObjectLayer } from './WorldMapLoader';

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

  it('accepts null or undefined layers returned for missing Tiled layers', () => {
    const grid = buildGridFromTiledLayers(4, 4, 32, [
      null,
      undefined,
      { objects: [{ x: 32, y: 32, width: 32, height: 32 }] },
    ]);

    expect(grid.isWalkable({ column: 0, row: 0 })).toBe(true);
    expect(grid.isWalkable({ column: 1, row: 1 })).toBe(false);
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

  it('maps collision rectangles correctly on a 64 px tile grid', () => {
    const grid = buildGridFromTiledLayers(8, 6, 64, [
      { objects: [{ x: 128, y: 64, width: 128, height: 64 }] },
    ]);

    expect(grid.isWalkable({ column: 1, row: 1 })).toBe(true);
    expect(grid.isWalkable({ column: 2, row: 1 })).toBe(false);
    expect(grid.isWalkable({ column: 3, row: 1 })).toBe(false);
    expect(grid.isWalkable({ column: 4, row: 1 })).toBe(true);
  });

  it('normalizes 64px map objects into unchanged 32px simulation coordinates', () => {
    const source = { objects: [{ x: 128, y: 64, width: 128, height: 64 }] };
    const normalized = scaleTiledObjectLayer(source, 0.5);

    expect(normalized?.objects).toEqual([{ x: 64, y: 32, width: 64, height: 32 }]);
    expect(source.objects[0]).toEqual({ x: 128, y: 64, width: 128, height: 64 });
    expect(() => scaleTiledObjectLayer(source, 0)).toThrow(RangeError);
  });

  it('rejects an invalid tile size', () => {
    expect(() => buildGridFromTiledLayers(4, 4, 0, [])).toThrow(RangeError);
  });
});
