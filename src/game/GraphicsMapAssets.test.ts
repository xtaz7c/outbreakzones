import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readMap = (name: string) => JSON.parse(
  readFileSync(new URL(`../../public/maps/${name}.tmj`, import.meta.url), 'utf8'),
) as {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: Array<{
    name: string;
    type: string;
    data?: number[];
    objects?: Array<{ id: number; x: number; y: number; width?: number; height?: number }>;
  }>;
  tilesets: Array<{ tilewidth: number; tileheight: number; imagewidth: number; imageheight: number }>;
};

describe('64px mission map variants', () => {
  it.each(['mission-01', 'sector-04'])('%s keeps logical topology and scales authored geometry', (name) => {
    const base = readMap(name);
    const high = readMap(`${name}-64`);

    expect(base.tilewidth).toBe(32);
    expect(base.tileheight).toBe(32);
    expect(high.tilewidth).toBe(64);
    expect(high.tileheight).toBe(64);
    expect(high.width).toBe(base.width);
    expect(high.height).toBe(base.height);
    expect(high.tilesets[0]?.tilewidth).toBe(64);
    expect(high.tilesets[0]?.tileheight).toBe(64);
    expect(high.tilesets[0]?.imagewidth).toBe((base.tilesets[0]?.imagewidth ?? 0) * 2);
    expect(high.tilesets[0]?.imageheight).toBe((base.tilesets[0]?.imageheight ?? 0) * 2);

    expect(high.layers.map((layer) => layer.name)).toEqual(base.layers.map((layer) => layer.name));
    for (const layer of base.layers) {
      const highLayer = high.layers.find((candidate) => candidate.name === layer.name);
      expect(highLayer).toBeDefined();
      if (layer.type === 'tilelayer') {
        expect(highLayer?.data).toEqual(layer.data);
      } else if (layer.type === 'objectgroup') {
        expect(highLayer?.objects).toHaveLength(layer.objects?.length ?? 0);
        for (const object of layer.objects ?? []) {
          const scaled = highLayer?.objects?.find((candidate) => candidate.id === object.id);
          expect(scaled?.x).toBe(object.x * 2);
          expect(scaled?.y).toBe(object.y * 2);
          if (typeof object.width === 'number') expect(scaled?.width).toBe(object.width * 2);
          if (typeof object.height === 'number') expect(scaled?.height).toBe(object.height * 2);
        }
      }
    }
  });

  it('provides native 64px SVG viewports for terrain and character sprites', () => {
    const terrain = readFileSync(new URL('../../public/assets/tiles/terrain/mission-tiles-64.svg', import.meta.url), 'utf8');
    const characters = readFileSync(new URL('../../public/assets/sprites/characters-64.svg', import.meta.url), 'utf8');

    expect(terrain).toContain('width="256" height="320" viewBox="0 0 128 160"');
    expect(characters).toContain('width="384" height="192" viewBox="0 0 192 96"');
  });
});
