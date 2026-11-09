import { describe, expect, it } from 'vitest';
import { BuildingSystem } from './BuildingSystem';
import { BuildingMaintenanceSystem } from './BuildingMaintenanceSystem';
import { GridMap } from './GridMap';

const definitions = [
  { id: 'front-door', kind: 'door' as const, x: 32, y: 32, width: 32, height: 32,
    weights: { open: 0, closed: 1, locked: 0 } },
  { id: 'side-window', kind: 'window' as const, x: 64, y: 32, width: 32, height: 32,
    weights: { open: 0, closed: 1, barricaded: 0, broken: 0 } },
];

function createSystems(resources = { scrap: 40, parts: 12 }) {
  const buildings = new BuildingSystem(definitions, new GridMap(8, 8), 32, 1);
  const maintenance = new BuildingMaintenanceSystem(buildings, resources);
  return { buildings, maintenance };
}

describe('BuildingMaintenanceSystem', () => {
  it('charges materials and completes a timed repair', () => {
    const { buildings, maintenance } = createSystems();
    buildings.damage('front-door', 60);

    expect(maintenance.start('front-door', 'repair')).toBe(true);
    const started = maintenance.getState();
    expect(started.resources.scrap).toBeLessThan(40);
    expect(started.resources.parts).toBeLessThan(12);
    expect(started.jobs).toHaveLength(1);

    maintenance.update(2);
    expect(buildings.getAccess('front-door')?.health).toBe(60);
    expect(maintenance.getState().jobs).toHaveLength(1);

    maintenance.update(3);
    expect(buildings.getAccess('front-door')?.health).toBe(120);
    expect(buildings.getAccess('front-door')?.state).toBe('closed');
    expect(maintenance.getState().jobs).toHaveLength(0);
  });

  it('limits reinforcement and increases maximum durability', () => {
    const { buildings, maintenance } = createSystems();
    const access = buildings.getAccess('front-door')!;
    expect(maintenance.start('front-door', 'reinforce')).toBe(true);
    maintenance.update(10);
    expect(access.reinforcementLevel).toBe(1);
    expect(access.maxHealth).toBe(144);
    expect(access.health).toBe(144);

    expect(maintenance.start('front-door', 'reinforce')).toBe(true);
    maintenance.update(15);
    expect(access.reinforcementLevel).toBe(2);
    expect(access.maxHealth).toBe(173);
    expect(maintenance.start('front-door', 'reinforce')).toBe(false);
  });

  it('installs a barricade and upgrades a lock through separate timed jobs', () => {
    const { buildings, maintenance } = createSystems();
    const door = buildings.getAccess('front-door')!;
    expect(maintenance.start('front-door', 'barricade')).toBe(true);
    maintenance.update(8);
    expect(door.state).toBe('barricaded');
    expect(door.barricadeLevel).toBe(1);
    expect(maintenance.start('front-door', 'barricade')).toBe(false);

    expect(door.removeBarricade()).toBe(true);
    expect(maintenance.start('front-door', 'upgrade-lock')).toBe(true);
    maintenance.update(8);
    expect(door.state).toBe('locked');
    expect(door.lockLevel).toBe(1);
  });

  it('rejects jobs with insufficient resources or invalid targets', () => {
    const { buildings, maintenance } = createSystems({ scrap: 0, parts: 0 });
    expect(maintenance.start('missing', 'repair')).toBe(false);
    expect(maintenance.start('front-door', 'reinforce')).toBe(false);
    buildings.damage('side-window', 60);
    expect(maintenance.start('side-window', 'repair')).toBe(false);
    expect(maintenance.getState().resources).toEqual({ scrap: 0, parts: 0 });
  });

  it('prevents overlapping jobs on the same access', () => {
    const { buildings, maintenance } = createSystems();
    buildings.damage('front-door', 30);
    expect(maintenance.start('front-door', 'repair')).toBe(true);
    expect(maintenance.start('front-door', 'reinforce')).toBe(false);
  });

  it('restores the resource wallet and an in-progress job', () => {
    const first = createSystems();
    expect(first.maintenance.start('front-door', 'reinforce')).toBe(true);
    first.maintenance.update(4);
    const saved = first.maintenance.getState();

    const second = createSystems();
    second.maintenance.restoreState(saved);
    expect(second.maintenance.getState().resources).toEqual(saved.resources);
    expect(second.maintenance.getState().jobs[0]?.remaining).toBe(6);

    second.maintenance.update(6);
    expect(second.buildings.getAccess('front-door')?.reinforcementLevel).toBe(1);
    expect(second.maintenance.getState().jobs).toHaveLength(0);
  });

  it('rejects malformed persisted jobs without changing the wallet', () => {
    const { maintenance } = createSystems();
    expect(() => maintenance.restoreState({
      resources: { scrap: 999, parts: 0 },
      jobs: [{ id: 1, accessId: 'missing', action: 'repair', cost: { scrap: 1, parts: 1 },
        duration: 5, remaining: 4 }],
    })).toThrow(RangeError);
    expect(maintenance.getState().resources).toEqual({ scrap: 40, parts: 12 });
  });

  it('persists upgrade levels and the upgraded health ceiling', () => {
    const { buildings, maintenance } = createSystems();
    expect(maintenance.start('front-door', 'reinforce')).toBe(true);
    maintenance.update(10);
    const saved = buildings.exportState();

    const restored = new BuildingSystem(definitions, new GridMap(8, 8), 32, 99);
    restored.restoreState(saved);
    expect(restored.getAccess('front-door')?.reinforcementLevel).toBe(1);
    expect(restored.getAccess('front-door')?.maxHealth).toBe(144);
    expect(restored.getAccess('front-door')?.health).toBe(144);
  });
});
