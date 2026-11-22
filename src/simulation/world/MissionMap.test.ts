import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MISSION_ENTRY_POINTS } from './MissionEntryPoints';
import { buildGridFromTiledLayers } from './WorldMapLoader';

interface MissionMapObject {
  readonly name?: string;
  readonly type?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
}

interface MissionMapLayer {
  readonly name: string;
  readonly type: string;
  readonly width?: number;
  readonly height?: number;
  readonly data?: readonly number[];
  readonly objects?: readonly MissionMapObject[];
}

interface MissionMapData {
  readonly width: number;
  readonly height: number;
  readonly tilewidth: number;
  readonly tileheight: number;
  readonly layers: readonly MissionMapLayer[];
}

const missionMap = JSON.parse(
  readFileSync(new URL('../../../public/maps/mission-01.tmj', import.meta.url), 'utf8'),
) as MissionMapData;

describe('mission-01 Tiled map', () => {
  it('keeps map dimensions and tile-layer data synchronized', () => {
    expect(missionMap).toMatchObject({
      width: 120,
      height: 90,
      tilewidth: 32,
      tileheight: 32,
    });

    const tileLayers = missionMap.layers.filter((layer) => layer.type === 'tilelayer');
    expect(tileLayers.length).toBeGreaterThan(0);
    for (const layer of tileLayers) {
      expect(layer.width).toBe(missionMap.width);
      expect(layer.height).toBe(missionMap.height);
      expect(layer.data).toHaveLength(missionMap.width * missionMap.height);
    }
  });

  it('defines access objects as valid Tiled rectangles inside the map', () => {
    const entranceLayer = missionMap.layers.find((layer) => layer.name === 'Entrances');
    const accesses = (entranceLayer?.objects ?? []).filter((object) =>
      ['door', 'window', 'garage'].includes(object.type ?? ''),
    );

    expect(accesses.length).toBeGreaterThan(0);
    for (const object of accesses) {
      const x = object.x ?? Number.NaN;
      const y = object.y ?? Number.NaN;
      const width = object.width ?? Number.NaN;
      const height = object.height ?? Number.NaN;
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      expect(Number.isFinite(width)).toBe(true);
      expect(Number.isFinite(height)).toBe(true);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(missionMap.width * missionMap.tilewidth);
      expect(y + height).toBeLessThanOrEqual(missionMap.height * missionMap.tileheight);
    }

    const garageEntry = accesses.find((object) => object.name === 'garage-entry');
    expect(garageEntry).toMatchObject({ width: 96, height: 32 });
  });

  it('keeps all configured house approach tiles inside walkable cells', () => {
    const collisionLayers = missionMap.layers.filter(
      (layer) => layer.name === 'Collision' || layer.name === 'Obstacles',
    );
    const grid = buildGridFromTiledLayers(
      missionMap.width,
      missionMap.height,
      missionMap.tilewidth,
      collisionLayers,
    );

    for (const entry of MISSION_ENTRY_POINTS) {
      expect(grid.isWalkable(entry.approachTile), entry.id).toBe(true);
    }
  });
});
