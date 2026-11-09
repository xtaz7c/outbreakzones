import { describe, expect, it } from 'vitest';
import { Infected } from '../Infected';
import { GridMap } from './GridMap';
import { DeployableStructureSystem } from './DeployableStructureSystem';

describe('DeployableStructureSystem', () => {
  it('charges resources and rejects occupied, blocked, or unaffordable placement', () => {
    const grid = new GridMap(12, 12);
    grid.setBlocked({ column: 3, row: 3 });
    const system = new DeployableStructureSystem(grid, 32, { scrap: 50, parts: 20 });
    expect(system.place('shelter-tent', { column: 3, row: 3 })).toBeNull();
    const placed = system.place('shelter-tent', { column: 4, row: 4 });
    expect(placed?.capacity).toBe(2);
    expect(system.getResources()).toEqual({ scrap: 20, parts: 12 });
    expect(system.place('sniper-post', { column: 4, row: 4 })).toBeNull();
    expect(system.place('sniper-post', { column: 5, row: 5 })).toBeNull();
  });

  it('persists structure placement and resources', () => {
    const grid = new GridMap(12, 12);
    const system = new DeployableStructureSystem(grid, 32);
    system.place('barricade', { column: 2, row: 2 });
    const restored = new DeployableStructureSystem(grid, 32);
    restored.restoreState(system.exportState());
    expect(restored.getSnapshots()).toHaveLength(1);
    expect(restored.getSnapshots()[0]?.kind).toBe('barricade');
    expect(restored.getInfectedNavigationGrid().isWalkable({ column: 2, row: 2 })).toBe(false);
  });

  it('generates scrap from resource tents over time', () => {
    const system = new DeployableStructureSystem(new GridMap(12, 12), 32);
    system.place('resource-tent', { column: 2, row: 2 });
    const before = system.getResources().scrap;
    system.update(30, []);
    expect(system.getResources().scrap).toBe(before + 2);
  });

  it('uses sniper posts to attack the nearest visible infected', () => {
    const grid = new GridMap(20, 20);
    const system = new DeployableStructureSystem(grid, 32);
    system.place('sniper-post', { column: 4, row: 4 });
    const infected = new Infected({
      id: 1, x: 160, y: 160, entryTile: { column: 18, row: 18 },
      detectionRange: 1,
    });
    system.update(1.25, [infected]);
    expect(infected.health).toBe(40);
  });

  it('lets nearby infected damage and eventually destroy barricades', () => {
    const grid = new GridMap(12, 12);
    const system = new DeployableStructureSystem(grid, 32);
    const barricade = system.place('barricade', { column: 4, row: 4 })!;
    const infected = new Infected({
      id: 1, x: 112, y: 144, entryTile: { column: 10, row: 10 },
      detectionRange: 1, damage: 60, attackInterval: 1,
    });
    system.update(1, [infected]);
    expect(system.getSnapshots().find((item) => item.id === barricade.id)?.health).toBe(120);
    system.update(1, [infected]);
    system.update(1, [infected]);
    expect(system.getSnapshots().find((item) => item.id === barricade.id)?.isDestroyed).toBe(true);
    expect(system.getInfectedNavigationGrid().isWalkable({ column: 4, row: 4 })).toBe(true);
  });

  it('restores destroyed structures without re-blocking the infected route', () => {
    const grid = new GridMap(12, 12);
    const system = new DeployableStructureSystem(grid, 32);
    const barricade = system.place('barricade', { column: 4, row: 4 })!;
    system.damage(barricade.id, 1000);
    const restored = new DeployableStructureSystem(grid, 32);
    restored.restoreState(system.exportState());
    expect(restored.getSnapshots()[0]?.isDestroyed).toBe(true);
    expect(restored.getInfectedNavigationGrid().isWalkable({ column: 4, row: 4 })).toBe(true);
    expect(restored.dismantle(barricade.id)).toBe(true);
  });

  it('refunds part of the cost when a structure is dismantled', () => {
    const system = new DeployableStructureSystem(new GridMap(12, 12), 32);
    const before = system.getResources().scrap;
    const placed = system.place('barricade', { column: 2, row: 2 })!;
    expect(system.dismantle(placed.id)).toBe(true);
    expect(system.getResources().scrap).toBe(before - 6);
    expect(system.dismantle(placed.id)).toBe(false);
  });
});
