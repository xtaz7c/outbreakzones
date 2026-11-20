import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../systems/buildings/BuildingSystem';
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
  readonly tilesets: readonly { readonly name: string; readonly image: string; readonly imageheight: number; readonly tilecount: number }[];
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
  it('renders the property fence separately from the garage roof, walls, and sectional door', () => {
    const fence = getLayer('Fence').data;
    const structures = getLayer('Structures').data;
    expect(fence).toBeDefined();
    expect(structures).toBeDefined();
    expect(fence?.[42 * tutorialMap.width + 50]).toBe(5);
    expect(fence?.[55 * tutorialMap.width + 80]).toBe(5);
    expect(fence?.[68 * tutorialMap.width + 60]).toBe(0);
    expect(structures?.[46 * tutorialMap.width + 75]).toBe(18);
    expect(structures?.[47 * tutorialMap.width + 75]).toBe(17);
    expect(structures?.[49 * tutorialMap.width + 75]).toBe(19);
    expect(tutorialMap.tilesets[0]).toMatchObject({
      name: 'mission-tiles',
      image: '../assets/tiles/terrain/mission-tiles.svg',
      imageheight: 160,
      tilecount: 19,
    });
  });

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

  it('opens and closes the detached garage gate through BuildingSystem', () => {
    const grid = buildGridFromTiledLayers(
      tutorialMap.width,
      tutorialMap.height,
      tutorialMap.tilewidth,
      [getLayer('Collision')],
    );
    const garageDoor = getLayer('Entrances').objects?.find((object) => object.name === 'garage-door');
    if (!garageDoor) throw new Error('Detached garage entrance is missing.');

    const buildings = new BuildingSystem([{
      id: garageDoor.name ?? 'garage-door',
      kind: 'garage',
      x: garageDoor.x ?? 0,
      y: garageDoor.y ?? 0,
      width: garageDoor.width ?? 0,
      height: garageDoor.height ?? 0,
      maxHealth: 160,
    }], grid, tutorialMap.tilewidth, 42);
    buildings.restoreState([{ id: 'garage-door', state: 'closed', health: 160 }]);

    expect(buildings.getNavigationGrid('police').isWalkable({ column: 75, row: 49 })).toBe(false);
    expect(buildings.interact('garage-door', 'police')).toBe(true);
    expect(buildings.getNavigationGrid('police').isWalkable({ column: 75, row: 49 })).toBe(true);
    expect(buildings.interact('garage-door', 'police')).toBe(true);
    expect(buildings.getNavigationGrid('police').isWalkable({ column: 75, row: 49 })).toBe(false);
  });

  it('keeps every road segment in one connected road network', () => {
    const ground = getLayer('Ground').data;
    if (!ground) throw new Error('Ground layer is missing.');
    const roadIndexes = ground.flatMap((gid, index) => gid === 2 || gid === 13 ? [index] : []);
    expect(roadIndexes.length).toBeGreaterThan(0);

    const roadSet = new Set(roadIndexes);
    const visited = new Set<number>();
    const pending = [roadIndexes[0]!];
    while (pending.length > 0) {
      const index = pending.pop()!;
      if (visited.has(index)) continue;
      visited.add(index);
      const column = index % tutorialMap.width;
      const row = Math.floor(index / tutorialMap.width);
      const neighbors = [
        column > 0 ? index - 1 : -1,
        column + 1 < tutorialMap.width ? index + 1 : -1,
        row > 0 ? index - tutorialMap.width : -1,
        row + 1 < tutorialMap.height ? index + tutorialMap.width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && roadSet.has(neighbor) && !visited.has(neighbor)) pending.push(neighbor);
      }
    }

    expect(visited.size).toBe(roadIndexes.length);
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
