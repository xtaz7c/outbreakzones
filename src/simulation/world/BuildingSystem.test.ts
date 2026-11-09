import { describe, expect, it } from 'vitest';
import { BuildingSystem, type AccessDefinition } from './BuildingSystem';
import { GridMap } from './GridMap';

const definitions: AccessDefinition[] = [
  { id: 'front', kind: 'door', x: 32, y: 32, width: 32, height: 32 },
  { id: 'window', kind: 'window', x: 64, y: 32, width: 32, height: 32 },
];

describe('BuildingSystem', () => {
  it('generates repeatable independent access states from a seed', () => {
    const first = new BuildingSystem(definitions, new GridMap(8, 8), 32, 1234);
    const second = new BuildingSystem(definitions, new GridMap(8, 8), 32, 1234);
    expect(first.getSnapshots().map((item) => item.state))
      .toEqual(second.getSnapshots().map((item) => item.state));
  });

  it('updates actor navigation when a closed access is opened', () => {
    const grid = new GridMap(8, 8);
    const system = new BuildingSystem([{ ...definitions[0]!, weights: { open: 0, closed: 1 } }], grid, 32, 1);
    expect(system.getNavigationGrid('police').isWalkable({ column: 1, row: 1 })).toBe(false);
    expect(system.interact('front', 'police')).toBe(true);
    expect(system.getNavigationGrid('police').isWalkable({ column: 1, row: 1 })).toBe(true);
  });

  it('does not allow civilians through windows', () => {
    const grid = new GridMap(8, 8);
    const system = new BuildingSystem([{ ...definitions[1]!, weights: { open: 1, closed: 0 } }], grid, 32, 1);
    expect(system.getAccess('window')?.canTraverse('civil')).toBe(false);
    expect(system.getAccess('window')?.canTraverse('police')).toBe(true);
  });

  it('keeps locked access closed until damaged', () => {
    const grid = new GridMap(8, 8);
    const system = new BuildingSystem([{ ...definitions[0]!, maxHealth: 10, weights: { open: 0, closed: 0, locked: 1 } }], grid, 32, 1);
    expect(system.interact('front', 'police')).toBe(false);
    expect(system.damage('front', 10)).toBe(10);
    expect(system.getAccess('front')?.isPassable).toBe(true);
  });


  it('keeps a broken access permanently passable', () => {
    const system = new BuildingSystem([
      { ...definitions[0]!, maxHealth: 10, weights: { open: 0, closed: 1 } },
    ], new GridMap(8, 8), 32, 9);
    system.damage('front', 10);
    expect(system.getAccess('front')?.state).toBe('broken');
    expect(system.interact('front', 'police')).toBe(false);
    expect(system.getAccess('front')?.state).toBe('broken');
  });

  it('allows police through an open window but blocks civilians', () => {
    const system = new BuildingSystem([
      { ...definitions[1]!, weights: { open: 1, closed: 0 } },
    ], new GridMap(8, 8), 32, 9);
    expect(system.getNavigationGrid('police').isWalkable({ column: 2, row: 1 })).toBe(true);
    expect(system.getNavigationGrid('civil').isWalkable({ column: 2, row: 1 })).toBe(false);
  });

  it('requires a key to unlock a locked door', () => {
    const system = new BuildingSystem([
      { ...definitions[0]!, weights: { open: 0, closed: 0, locked: 1 } },
    ], new GridMap(8, 8), 32, 9);
    expect(system.interact('front', 'police')).toBe(false);
    expect(system.interact('front', 'police', true)).toBe(true);
    expect(system.getAccess('front')?.state).toBe('open');
  });

  it('rejects invalid access geometry', () => {
    expect(() => new BuildingSystem([
      { ...definitions[0]!, width: 0 },
    ], new GridMap(8, 8), 32, 9)).toThrow(RangeError);
  });

  it('rejects duplicate identifiers', () => {
    expect(() => new BuildingSystem([definitions[0]!, definitions[0]!], new GridMap(8, 8), 32, 1)).toThrow();
  });
  it('treats a garage as an independent access shared by valid actor types', () => {
    const system = new BuildingSystem([
      { id: 'garage', kind: 'garage', x: 96, y: 32, width: 32, height: 32,
        weights: { open: 1, closed: 0 } },
    ], new GridMap(8, 8), 32, 77);
    const cell = { column: 3, row: 1 };
    expect(system.getNavigationGrid('police').isWalkable(cell)).toBe(true);
    expect(system.getNavigationGrid('civil').isWalkable(cell)).toBe(true);
    expect(system.getNavigationGrid('infected').isWalkable(cell)).toBe(true);
  });

});
