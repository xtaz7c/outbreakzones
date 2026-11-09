import { describe, expect, it } from 'vitest';
import {
  WORLD_CONFIG,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  isInsideWorld,
  tileToWorldCenter,
  worldToTile,
} from './WorldConfig';

describe('world dimensions', () => {
  it('defines an 80 × 45 grid of 32 px cells', () => {
    expect(WORLD_CONFIG.columns).toBe(80);
    expect(WORLD_CONFIG.rows).toBe(45);
    expect(WORLD_CONFIG.tileSize).toBe(32);
    expect(WORLD_WIDTH).toBe(2560);
    expect(WORLD_HEIGHT).toBe(1440);
  });

  it('keeps the world larger than the logical viewport', () => {
    expect(WORLD_WIDTH).toBeGreaterThan(WORLD_CONFIG.viewportWidth);
    expect(WORLD_HEIGHT).toBeGreaterThan(WORLD_CONFIG.viewportHeight);
  });
});

describe('world boundaries', () => {
  it('includes the origin and the last point inside the world', () => {
    expect(isInsideWorld({ x: 0, y: 0 })).toBe(true);
    expect(isInsideWorld({ x: WORLD_WIDTH - 1, y: WORLD_HEIGHT - 1 })).toBe(true);
  });

  it('uses exclusive maximum boundaries', () => {
    expect(isInsideWorld({ x: WORLD_WIDTH, y: 10 })).toBe(false);
    expect(isInsideWorld({ x: 10, y: WORLD_HEIGHT })).toBe(false);
    expect(isInsideWorld({ x: -1, y: 10 })).toBe(false);
    expect(isInsideWorld({ x: 10, y: -1 })).toBe(false);
  });

  it('rejects non-finite world coordinates', () => {
    expect(isInsideWorld({ x: Number.NaN, y: 0 })).toBe(false);
    expect(isInsideWorld({ x: 0, y: Number.POSITIVE_INFINITY })).toBe(false);
  });
});

describe('world and tile coordinate conversion', () => {
  it('converts world coordinates to the expected tile', () => {
    expect(worldToTile({ x: 0, y: 0 })).toEqual({ column: 0, row: 0 });
    expect(worldToTile({ x: 63, y: 95 })).toEqual({ column: 1, row: 2 });
    expect(worldToTile({ x: 2559, y: 1439 })).toEqual({ column: 79, row: 44 });
  });

  it('returns null for positions outside the world', () => {
    expect(worldToTile({ x: 2560, y: 0 })).toBeNull();
    expect(worldToTile({ x: 0, y: 1440 })).toBeNull();
  });

  it('returns the center of a valid tile', () => {
    expect(tileToWorldCenter({ column: 0, row: 0 })).toEqual({ x: 16, y: 16 });
    expect(tileToWorldCenter({ column: 79, row: 44 })).toEqual({ x: 2544, y: 1424 });
  });

  it('rejects invalid tile coordinates', () => {
    expect(tileToWorldCenter({ column: -1, row: 0 })).toBeNull();
    expect(tileToWorldCenter({ column: 80, row: 0 })).toBeNull();
    expect(tileToWorldCenter({ column: 0, row: 45 })).toBeNull();
    expect(tileToWorldCenter({ column: 1.5, row: 0 })).toBeNull();
  });
});
