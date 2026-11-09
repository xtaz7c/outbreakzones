import { describe, expect, it } from 'vitest';
import { BuildingSystem } from './BuildingSystem';
import { BuildingMaintenanceSystem } from './BuildingMaintenanceSystem';
import { GridMap } from '../../world/GridMap';

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

  it('repairs a breached access and clears destroyed lock and barricade hardware', () => {
    const { buildings, maintenance } = createSystems({ scrap: 80, parts: 20 });
    const door = buildings.getAccess('front-door')!;
    expect(maintenance.start('front-door', 'barricade')).toBe(true);
    maintenance.update(8);
    expect(door.state).toBe('barricaded');
    buildings.damage('front-door', 1000);
    expect(door.state).toBe('broken');
    expect(door.barricadeLevel).toBe(0);

    expect(maintenance.start('front-door', 'repair')).toBe(true);
    maintenance.update(10);
    expect(door.state).toBe('closed');
    expect(door.health).toBe(door.maxHealth);
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

    expect(buildings.interact('front-door', 'police')).toBe(true);
    expect(maintenance.start('front-door', 'upgrade-lock')).toBe(true);
    maintenance.update(8);
    expect(door.state).toBe('locked');
    expect(door.lockLevel).toBe(1);
  });

  it('gives barricades and upgraded locks measurable damage resistance', () => {
    const { buildings, maintenance } = createSystems({ scrap: 60, parts: 20 });
    const door = buildings.getAccess('front-door')!;
    expect(maintenance.start('front-door', 'barricade')).toBe(true);
    maintenance.update(8);
    expect(buildings.damage('front-door', 30)).toBe(15);
    expect(door.health).toBe(105);

    expect(door.removeBarricade()).toBe(true);
    expect(maintenance.start('front-door', 'upgrade-lock')).toBe(true);
    maintenance.update(8);
    expect(maintenance.start('front-door', 'upgrade-lock')).toBe(true);
    maintenance.update(12);
    expect(door.lockLevel).toBe(2);
    expect(buildings.damage('front-door', 30)).toBe(21);
    expect(door.health).toBe(84);
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

  it('refunds all materials when an access changes before a job completes', () => {
    const { buildings, maintenance } = createSystems();
    const initialResources = maintenance.getState().resources;

    expect(maintenance.start('front-door', 'barricade')).toBe(true);
    expect(maintenance.getState().resources).not.toEqual(initialResources);

    // A police officer opens the door while the barricade is being installed.
    expect(buildings.interact('front-door', 'police')).toBe(true);
    expect(buildings.getAccess('front-door')?.state).toBe('open');

    maintenance.update(8);

    expect(buildings.getAccess('front-door')?.barricadeLevel).toBe(0);
    expect(maintenance.getState().jobs).toHaveLength(0);
    expect(maintenance.getState().resources).toEqual(initialResources);
  });

  it('caps repair completion to the amount paid for when the job started', () => {
    const { buildings, maintenance } = createSystems({ scrap: 80, parts: 20 });
    const door = buildings.getAccess('front-door')!;
    buildings.damage('front-door', 60);
    expect(maintenance.start('front-door', 'repair')).toBe(true);
    buildings.damage('front-door', 60);
    maintenance.update(5);
    expect(door.health).toBe(60);
    expect(maintenance.getState().jobs).toHaveLength(0);
  });

  it('persists a window that is generated in the broken state', () => {
    const brokenWindow = [{
      id: 'broken-window', kind: 'window' as const, x: 32, y: 32, width: 32, height: 32,
      weights: { open: 0, closed: 0, barricaded: 0, broken: 1 },
    }];
    const buildings = new BuildingSystem(brokenWindow, new GridMap(8, 8), 32, 1);
    const access = buildings.getAccess('broken-window')!;

    expect(access.state).toBe('broken');
    expect(access.health).toBe(0);

    const saved = buildings.exportState();
    const restored = new BuildingSystem(brokenWindow, new GridMap(8, 8), 32, 99);
    expect(() => restored.restoreState(saved)).not.toThrow();
    expect(restored.getAccess('broken-window')?.state).toBe('broken');
    expect(restored.getAccess('broken-window')?.health).toBe(0);
  });

  it('migrates a legacy broken-access snapshot without discarding other access changes', () => {
    const definitions = [
      { id: 'front-door', kind: 'door' as const, x: 32, y: 32, width: 32, height: 32,
        weights: { open: 0, closed: 1, locked: 0 } },
      { id: 'side-window', kind: 'window' as const, x: 64, y: 32, width: 32, height: 32,
        weights: { open: 0, closed: 1, barricaded: 0, broken: 0 } },
    ];
    const restored = new BuildingSystem(definitions, new GridMap(8, 8), 32, 1);
    expect(() => restored.restoreState([
      { id: 'front-door', state: 'broken', health: 120 },
      { id: 'side-window', state: 'open', health: 60 },
    ])).not.toThrow();
    expect(restored.getAccess('front-door')?.health).toBe(0);
    expect(restored.getAccess('side-window')?.state).toBe('open');
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
