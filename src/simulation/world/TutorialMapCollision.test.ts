import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildGridFromTiledLayers } from './WorldMapLoader';

interface TiledObject {
  readonly id?: number;
  readonly name?: string;
  readonly type?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
}
interface TiledLayer {
  readonly name: string;
  readonly type: string;
  readonly data?: readonly number[];
  readonly objects?: readonly TiledObject[];
}
interface TiledMapFixture {
  readonly width: number;
  readonly height: number;
  readonly tilewidth: number;
  readonly tileheight: number;
  readonly layers: readonly TiledLayer[];
}

const tutorialMap = JSON.parse(
  readFileSync(new URL('../../../public/maps/mission-01.tmj', import.meta.url), 'utf8'),
) as TiledMapFixture;
const getLayer = (name: string): TiledLayer => {
  const layer = tutorialMap.layers.find((candidate) => candidate.name === name);
  if (!layer) throw new Error(`Missing Tiled layer: ${name}`);
  return layer;
};

describe('tutorial rural map collision and navigation', () => {
  it('blocks the perimeter fence and keeps the south gate passable', () => {
    const grid = buildGridFromTiledLayers(
      tutorialMap.width,
      tutorialMap.height,
      tutorialMap.tilewidth,
      [getLayer('Collision')],
    );

    for (const position of [
      { column: 50, row: 42 },
      { column: 45, row: 55 },
      { column: 80, row: 55 },
      { column: 50, row: 68 },
      { column: 70, row: 68 },
    ]) {
      expect(grid.isWalkable(position)).toBe(false);
    }

    for (let column = 57; column <= 63; column += 1) {
      expect(grid.isWalkable({ column, row: 68 })).toBe(true);
    }
  });

  it('defines the detached garage walls and a functional garage entrance', () => {
    const grid = buildGridFromTiledLayers(
      tutorialMap.width,
      tutorialMap.height,
      tutorialMap.tilewidth,
      [getLayer('Collision')],
    );
    const garageDoor = getLayer('Entrances').objects?.find((object) => object.name === 'garage-door');

    expect(garageDoor).toMatchObject({
      type: 'garage',
      x: 74 * 32,
      y: 49 * 32,
      width: 3 * 32,
      height: 32,
    });
    for (const position of [
      { column: 75, row: 46 },
      { column: 73, row: 47 },
      { column: 78, row: 48 },
      { column: 73, row: 49 },
      { column: 77, row: 49 },
    ]) {
      expect(grid.isWalkable(position)).toBe(false);
    }
    for (const column of [74, 75, 76]) {
      expect(grid.isWalkable({ column, row: 49 })).toBe(true);
    }
    expect(grid.isWalkable({ column: 75, row: 47 })).toBe(true);
  });

  it('connects the property driveway to the south road through the gate', () => {
    const ground = getLayer('Ground').data;
    expect(ground).toBeDefined();

    for (let row = 62; row <= 89; row += 1) {
      const gid = ground?.[row * tutorialMap.width + 60];
      expect([2, 13]).toContain(gid);
    }
    for (let row = 66; row <= 70; row += 1) {
      for (let column = 57; column <= 63; column += 1) {
        expect(ground?.[row * tutorialMap.width + column]).toBe(2);
      }
    }
  });
});
