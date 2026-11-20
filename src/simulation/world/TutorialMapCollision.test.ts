import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildGridFromTiledLayers } from './WorldMapLoader';

interface TiledMapFixture {
  readonly width: number;
  readonly height: number;
  readonly tilewidth: number;
  readonly tileheight: number;
  readonly layers: readonly {
    readonly name: string;
    readonly type: string;
    readonly data?: readonly number[];
    readonly objects?: readonly {
      readonly x?: number;
      readonly y?: number;
      readonly width?: number;
      readonly height?: number;
    }[];
  }[];
}

const tutorialMap = JSON.parse(
  readFileSync(new URL('../../../public/maps/mission-01.tmj', import.meta.url), 'utf8'),
) as TiledMapFixture;

describe('tutorial rural map collision', () => {
  it('blocks every wooden fence tile while preserving the south gate opening', () => {
    const structures = tutorialMap.layers.find((layer) => layer.name === 'Structures');
    const collision = tutorialMap.layers.find((layer) => layer.name === 'Collision');
    expect(structures?.type).toBe('tilelayer');
    expect(collision?.type).toBe('objectgroup');
    expect(structures?.data).toBeDefined();

    const grid = buildGridFromTiledLayers(
      tutorialMap.width,
      tutorialMap.height,
      tutorialMap.tilewidth,
      [collision],
    );

    let fenceTileCount = 0;
    structures?.data?.forEach((gid, index) => {
      if (gid !== 5) return;
      fenceTileCount += 1;
      const column = index % tutorialMap.width;
      const row = Math.floor(index / tutorialMap.width);
      expect(grid.isWalkable({ column, row })).toBe(false);
    });

    expect(fenceTileCount).toBe(370);
    for (const column of [59, 60, 61, 62]) {
      expect(grid.isWalkable({ column, row: 68 })).toBe(true);
    }
  });
});
