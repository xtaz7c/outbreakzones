import { describe, it, expect, beforeEach } from 'vitest';
import { FIXED_DT, Simulation } from './Simulation';
import { Civilian } from './Civilian';
import { GridMap } from './world/GridMap';
import { BuildingSystem } from './world/BuildingSystem';

describe('Simulation', () => {
  let sim: Simulation;

  beforeEach(() => {
    sim = new Simulation();
  });

  it('advances building maintenance jobs on the fixed simulation timestep', () => {
    const buildings = new BuildingSystem([{
      id: 'front-door', kind: 'door', x: 32, y: 32, width: 32, height: 32,
      weights: { open: 0, closed: 1, locked: 0 },
    }], new GridMap(8, 8), 32, 1);
    sim.setBuildingSystem(buildings);
    sim.damageAccess('front-door', 60);
    expect(sim.startBuildingMaintenance('front-door', 'repair')).toBe(true);

    for (let index = 0; index < 300; index += 1) sim.update(FIXED_DT);

    expect(buildings.getAccess('front-door')?.health).toBe(120);
    expect(sim.getMaintenanceState()?.jobs).toHaveLength(0);
  });

  it('starts with three officers and zero infected', () => {
    const state = sim.getState();
    expect(state.officerCount).toBe(3);
    expect(state.infectedCount).toBe(0);
    expect(state.civilianCount).toBe(2);
    expect(state.rescuedCivilianCount).toBe(0);
    expect(state.elapsed).toBe(0);
    expect(state.paused).toBe(false);
  });

  it('advances elapsed time when not paused (fixed timestep)', () => {
    sim.update(FIXED_DT);
    sim.update(FIXED_DT);
    expect(sim.getState().elapsed).toBeCloseTo(FIXED_DT * 2, 5);
  });

  it('accumulates partial frames before stepping', () => {
    sim.update(FIXED_DT * 0.4);
    expect(sim.getState().elapsed).toBe(0);
    sim.update(FIXED_DT * 0.4);
    expect(sim.getState().elapsed).toBe(0);
    sim.update(FIXED_DT * 0.3);
    expect(sim.getState().elapsed).toBeCloseTo(FIXED_DT, 5);
  });

  it('does not advance while paused', () => {
    sim.setPaused(true);
    sim.update(1);
    expect(sim.getState().elapsed).toBe(0);
    expect(sim.getState().paused).toBe(true);
  });

  it('resumes correctly after pause', () => {
    sim.update(FIXED_DT);
    expect(sim.getState().elapsed).toBeCloseTo(FIXED_DT, 5);

    sim.setPaused(true);
    sim.update(FIXED_DT * 5);
    expect(sim.getState().elapsed).toBeCloseTo(FIXED_DT, 5);

    sim.setPaused(false);
    sim.update(FIXED_DT);
    expect(sim.getState().elapsed).toBeCloseTo(FIXED_DT * 2, 5);
  });

  it('ignores negative delta', () => {
    sim.update(FIXED_DT);
    const before = sim.getState().elapsed;
    sim.update(-1);
    expect(sim.getState().elapsed).toBe(before);
  });

  it('ignores NaN delta', () => {
    sim.update(FIXED_DT);
    const before = sim.getState().elapsed;
    sim.update(Number.NaN);
    expect(sim.getState().elapsed).toBe(before);
  });

  it('ignores Infinity delta', () => {
    sim.update(FIXED_DT);
    const before = sim.getState().elapsed;
    sim.update(Number.POSITIVE_INFINITY);
    expect(sim.getState().elapsed).toBe(before);
    sim.update(Number.NEGATIVE_INFINITY);
    expect(sim.getState().elapsed).toBe(before);
  });

  it('clamps very large frame dt to avoid spiral of death', () => {
    sim.update(10);
    const elapsed = sim.getState().elapsed;
    expect(elapsed).toBeLessThanOrEqual(12 * FIXED_DT + 1e-9);
    expect(elapsed).toBeGreaterThan(0);
  });

  it('accepts zero delta without advancing', () => {
    sim.update(0);
    expect(sim.getState().elapsed).toBe(0);
  });

  it('owns three independent police officer entities', () => {
    const officers = sim.getOfficers();
    expect(officers).toHaveLength(3);
    expect(officers.map((officer) => officer.id)).toEqual([1, 2, 3]);
    expect(new Set(officers.map((officer) => officer.position.x)).size).toBe(3);
  });

  it('routes movement through the world grid and advances it on fixed steps', () => {
    const map = new GridMap(64, 40);
    sim.setWorldGrid(map, 32);
    const officer = sim.getOfficers()[0]!;

    expect(sim.issueMoveOrder(officer.id, { column: 30, row: 33 })).toBe(true);
    expect(officer.state).toBe('moving');

    for (let index = 0; index < 40; index += 1) sim.update(FIXED_DT);
    expect(officer.position.x).toBeGreaterThan(29 * 32 + 16);
  });

  it('does not move officers while paused but accepts queued orders', () => {
    sim.setWorldGrid(new GridMap(64, 40), 32);
    const officer = sim.getOfficers()[0]!;
    expect(sim.issueMoveOrder(officer.id, { column: 30, row: 33 })).toBe(true);
    sim.setPaused(true);
    const before = officer.position;
    sim.update(1);
    expect(officer.position).toEqual(before);
    expect(sim.issueMoveOrder(officer.id, { column: 31, row: 33 })).toBe(true);
    expect(officer.state).toBe('moving');
    sim.setPaused(false);
    sim.update(FIXED_DT);
    expect(officer.position).not.toEqual(before);
  });

  it('spawns infected entities and advances their AI on fixed steps', () => {
    sim.setWorldGrid(new GridMap(64, 40), 32);
    const infected = sim.spawnInfected({
      x: 16, y: 16, entryTile: { column: 4, row: 1 }, moveSpeed: 32,
    });
    expect(sim.getState().infectedCount).toBe(1);
    sim.update(FIXED_DT);
    expect(infected.state).toBe('moving');
    expect(infected.position).not.toEqual({ x: 16, y: 16 });
  });

  it('replays infected patrol choices with the same mission seed', () => {
    const patrolPosition = (seed: number) => {
      const seeded = new Simulation();
      seeded.setRandomSeed(seed);
      seeded.setWorldGrid(new GridMap(20, 20), 32);
      const infected = seeded.spawnInfected({
        x: 144, y: 144, entryTile: { column: 1, row: 1 }, moveSpeed: 32,
      });
      seeded.update(FIXED_DT);
      return infected.position;
    };

    expect(patrolPosition(12345)).toEqual(patrolPosition(12345));
  });

  it('routes infected toward a generic emitted sound stimulus', () => {
    sim.setWorldGrid(new GridMap(20, 20), 32);
    const infected = sim.spawnInfected({
      x: 16, y: 16, entryTile: { column: 8, row: 8 },
      moveSpeed: 55, detectionRange: 1,
    });
    sim.emitStimulus({ x: 112, y: 16 }, 180, 1, 1);
    sim.update(FIXED_DT);
    expect(infected.position.x).toBeGreaterThan(16);
  });

  it('removes dead infected entities safely during simulation updates', () => {
    const infected = sim.spawnInfected({
      x: 16, y: 16, entryTile: { column: 4, row: 1 },
    });
    infected.takeDamage(100);
    sim.update(FIXED_DT);
    expect(sim.getInfected()).toHaveLength(0);
    expect(sim.getState().infectedCount).toBe(0);
  });

  it('runs automatic officer combat inside the fixed-step simulation', () => {
    sim = new Simulation({ random: () => 0 });
    sim.setWorldGrid(new GridMap(64, 40), 32);
    const infected = sim.spawnInfected({
      x: 1000, y: 1072, entryTile: { column: 29, row: 33 },
      moveSpeed: 1, detectionRange: 1,
    });
    let observedShot = false;
    for (let index = 0; index < 60; index += 1) {
      sim.update(FIXED_DT);
      observedShot ||= sim.getCombatEvents().length > 0;
    }
    expect(infected.health).toBeLessThan(60);
    expect(observedShot).toBe(true);
  });

  it('does not emit combat events while paused', () => {
    sim.setWorldGrid(new GridMap(64, 40), 32);
    sim.spawnInfected({
      x: 1000, y: 1072, entryTile: { column: 29, row: 33 },
      moveSpeed: 1, detectionRange: 1,
    });
    sim.setPaused(true);
    sim.update(1);
    expect(sim.getCombatEvents()).toHaveLength(0);
  });


  it('does not cancel a movement order when a target priority is assigned', () => {
    sim.setWorldGrid(new GridMap(64, 40), 32);
    const officer = sim.getOfficers()[0]!;
    const infected = sim.spawnInfected({
      x: 900, y: 1072, entryTile: { column: 28, row: 33 }, detectionRange: 1,
    });
    expect(sim.issueMoveOrder(officer.id, { column: 31, row: 33 })).toBe(true);
    sim.setTargetPriority(officer.id, infected.id);
    expect(officer.state).toBe('moving');
    expect(officer.hasMoveOrder).toBe(true);
  });

  it('tracks active officers after individual incapacitation', () => {
    expect(sim.damageOfficer(2, 100)).toBe(100);
    expect(sim.getState().officerCount).toBe(3);
    expect(sim.getState().activeOfficerCount).toBe(2);
    expect(sim.getOfficers()[1]!.state).toBe('incapacitated');
  });

  it('holds selected officer position by cancelling its current path', () => {
    sim.setWorldGrid(new GridMap(64, 40), 32);
    const officer = sim.getOfficers()[0]!;
    expect(sim.issueMoveOrder(officer.id, { column: 32, row: 33 })).toBe(true);
    expect(sim.holdOfficerPosition(officer.id)).toBe(true);
    expect(officer.state).toBe('idle');
    const position = officer.position;
    sim.update(FIXED_DT * 5);
    expect(officer.position).toEqual(position);
  });

  it('holds automatic fire but still honors a manual target priority', () => {
    sim = new Simulation({ random: () => 0 });
    sim.setWorldGrid(new GridMap(64, 40), 32);
    const officer = sim.getOfficers()[0]!;
    for (const member of sim.getOfficers()) {
      sim.setOfficerTacticalPosture(member.id, 'hold_fire');
    }
    const infected = sim.spawnInfected({
      x: 1000, y: 1072, entryTile: { column: 31, row: 33 },
      moveSpeed: 1, detectionRange: 1,
    });
    expect(sim.setOfficerTacticalPosture(officer.id, 'hold_fire')).toBe(true);
    for (let index = 0; index < 60; index += 1) sim.update(FIXED_DT);
    expect(infected.health).toBe(60);
    sim.setTargetPriority(officer.id, infected.id);
    for (let index = 0; index < 60; index += 1) sim.update(FIXED_DT);
    expect(infected.health).toBeLessThan(60);
  });

  it('does not resume automatic fire for an invalid manual priority in hold-fire mode', () => {
    sim = new Simulation({ random: () => 0 });
    sim.setWorldGrid(new GridMap(64, 40), 32);
    const officer = sim.getOfficers()[0]!;
    for (const member of sim.getOfficers()) {
      sim.setOfficerTacticalPosture(member.id, 'hold_fire');
    }
    const infected = sim.spawnInfected({
      x: 1000, y: 1072, entryTile: { column: 31, row: 33 },
      moveSpeed: 1, detectionRange: 1,
    });
    sim.setOfficerTacticalPosture(officer.id, 'hold_fire');
    sim.setTargetPriority(officer.id, 99999);
    for (let index = 0; index < 60; index += 1) sim.update(FIXED_DT);
    expect(infected.health).toBe(60);
  });

  it('stops simulation updates and rejects movement after all officers are incapacitated', () => {
    for (const officer of sim.getOfficers()) sim.damageOfficer(officer.id, 100);
    expect(sim.isMissionDefeated()).toBe(true);
    const before = sim.getState().elapsed;
    sim.update(FIXED_DT * 10);
    expect(sim.getState().elapsed).toBe(before);
    sim.setWorldGrid(new GridMap(64, 40), 32);
    expect(sim.issueMoveOrder(1, { column: 30, row: 33 })).toBe(false);
  });

  it('attracts nearby infected to a noisy access and remembers it after the noise fades', () => {
    const grid = new GridMap(64, 40);
    const buildings = new BuildingSystem([
      { id: 'front', kind: 'door', x: 960, y: 864, width: 128, height: 32,
        maxHealth: 50, weights: { open: 0, closed: 1 } },
    ], grid, 32, 42);
    sim.setWorldGrid(grid, 32);
    sim.setBuildingSystem(buildings);
    const infected = sim.spawnInfected({
      x: 976, y: 848, entryTile: { column: 30, row: 26 },
      detectionRange: 1, attackRange: 40, attackInterval: 0.25, damage: 5,
    });
    const target = buildings.getInfectedTarget(
      'front', { column: 30, row: 26 }, { column: 30, row: 28 },
    );
    expect(target).toBeDefined();
    sim.emitNoiseAtStructure(target!, 100, 0.1);
    for (let index = 0; index < 30; index += 1) sim.update(FIXED_DT);
    expect(buildings.getAccess('front')?.health).toBeLessThan(50);
    const healthAfterNoise = buildings.getAccess('front')!.health;
    for (let index = 0; index < 30; index += 1) sim.update(FIXED_DT);
    expect(buildings.getAccess('front')!.health).toBeLessThan(healthAfterNoise);
    expect(infected.state).toBe('attacking');
  });


  it('requires all civilians to be extracted before declaring wave victory', () => {
    sim.setWorldGrid(new GridMap(64, 40), 32);
    sim.configureWaves([
      { id: 'west', x: 64, y: 640, entryTile: { column: 21, row: 18 } },
    ], [{ infectedCount: 1, spawnInterval: 1 }], 0);
    sim.update(FIXED_DT);
    expect(sim.getState().infectedCount).toBe(1);
    expect(sim.getState().wavePhase).toBe('active');
    sim.getInfected()[0]!.takeDamage(1000);
    sim.update(FIXED_DT);
    expect(sim.getState().missionStatus).toBe('playing');
    for (const civilian of sim.getCivilians()) {
      civilian.beginFollowing();
      civilian.extract();
    }
    sim.update(FIXED_DT);
    expect(sim.getState().missionStatus).toBe('victory');
    expect(sim.isMissionVictory()).toBe(true);
  });

  it('allows the Refuge campaign mission to win after its waves without tutorial extraction', () => {
    sim.setWorldGrid(new GridMap(64, 40), 32);
    sim.configureWaves([
      { id: 'west', x: -48, y: 640, entryTile: { column: 21, row: 18 } },
    ], [{ infectedCount: 1, spawnInterval: 1 }], 0, false);
    sim.update(FIXED_DT);
    expect(sim.getState().infectedCount).toBe(1);
    sim.getInfected()[0]!.takeDamage(1000);
    sim.update(FIXED_DT);
    expect(sim.getState().missionStatus).toBe('victory');
    expect(sim.getState().rescuedCivilianCount).toBe(0);
  });

  it('lets infected attack civilians and makes them flee from visible threats', () => {
    sim.setWorldGrid(new GridMap(64, 40), 32);
    const civilian = sim.getCivilians()[0]!;
    const infected = sim.spawnInfected({
      x: 816, y: 480, entryTile: { column: 25, row: 15 },
      detectionRange: 200, attackRange: 40, attackInterval: 0.25, damage: 10,
    });
    for (let index = 0; index < 30; index += 1) sim.update(FIXED_DT);
    expect(civilian.health).toBeLessThan(civilian.maxHealth);
    expect(civilian.mood).toBe('panicked');
    expect(civilian.position.x).not.toBe(800);
    expect(infected.state).toBe('attacking');
  });

  it('declares defeat as soon as all officers are incapacitated', () => {
    for (const officer of sim.getOfficers()) sim.damageOfficer(officer.id, 100);
    sim.update(FIXED_DT);
    expect(sim.getState().missionStatus).toBe('defeat');
  });

  it('does not advance waves while paused', () => {
    sim.setWorldGrid(new GridMap(64, 40), 32);
    sim.configureWaves([
      { id: 'west', x: 64, y: 640, entryTile: { column: 21, row: 18 } },
    ], [{ infectedCount: 1, spawnInterval: 1 }], 0);
    sim.setPaused(true);
    sim.update(FIXED_DT * 10);
    expect(sim.getState().infectedCount).toBe(0);
    expect(sim.getState().wavePhase).toBe('preparing');
  });

  it('starts with two sheltered civilians inside the tutorial house', () => {
    const civilians = sim.getCivilians();
    expect(civilians.map((civilian) => civilian.id)).toEqual([1, 2]);
    expect(civilians.map((civilian) => civilian.state)).toEqual(['sheltered', 'sheltered']);
    expect(civilians.map((civilian) => civilian.position)).toEqual([
      { x: 800, y: 480 },
      { x: 1200, y: 480 },
    ]);
  });

  it('rescues a nearby civilian, escorts them through the civil grid, and extracts them', () => {
    sim.setWorldGrid(new GridMap(64, 40), 32);
    const officer = sim.getOfficers()[0]!;
    const civilian = sim.getCivilians()[0]!;

    expect(sim.rescueCivilian(civilian.id, officer.id)).toBe(false);
    expect(sim.issueMoveOrder(officer.id, { column: 25, row: 15 })).toBe(true);
    for (let index = 0; index < 500; index += 1) sim.update(FIXED_DT);

    expect(sim.rescueCivilian(civilian.id, officer.id)).toBe(true);
    expect(civilian.state).toBe('following');
    expect(civilian.escortId).toBe(officer.id);

    expect(sim.issueMoveOrder(officer.id, { column: 32, row: 35 })).toBe(true);
    for (let index = 0; index < 1000; index += 1) sim.update(FIXED_DT);

    expect(civilian.state).toBe('extracted');
    expect(sim.getState().rescuedCivilianCount).toBe(1);
  });

  it('tracks the rescue state of civilians independently', () => {
    const [first, second] = sim.getCivilians();
    expect(first!.beginFollowing()).toBe(true);
    expect(first!.extract()).toBe(true);
    expect(first!.state).toBe('extracted');
    expect(second!.state).toBe('sheltered');
    expect(sim.getState().rescuedCivilianCount).toBe(1);
  });

  it('validates civilian identity and coordinates', () => {
    expect(() => new Civilian({ id: 0, x: 10, y: 10 })).toThrow(RangeError);
    expect(() => new Civilian({ id: 1, x: Number.NaN, y: 10 })).toThrow(RangeError);
  });

  it('only allows a following civilian to change position or be extracted', () => {
    const civilian = new Civilian({ id: 1, x: 10, y: 20 });
    expect(civilian.updatePosition({ x: 20, y: 30 })).toBe(false);
    expect(civilian.beginFollowing()).toBe(true);
    expect(civilian.updatePosition({ x: 20, y: 30 })).toBe(true);
    expect(civilian.position).toEqual({ x: 20, y: 30 });
    expect(civilian.updatePosition({ x: Number.NaN, y: 30 })).toBe(false);
    expect(civilian.extract()).toBe(true);
    expect(civilian.beginFollowing()).toBe(false);
    expect(civilian.updatePosition({ x: 40, y: 50 })).toBe(false);
    expect(civilian.extract()).toBe(false);
  });

});
