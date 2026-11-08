import { describe, it, expect, beforeEach } from 'vitest';
import { FIXED_DT, Simulation } from './Simulation';
import { GridMap } from './world/GridMap';

describe('Simulation', () => {
  let sim: Simulation;

  beforeEach(() => {
    sim = new Simulation();
  });

  it('starts with three officers and zero infected', () => {
    const state = sim.getState();
    expect(state.officerCount).toBe(3);
    expect(state.infectedCount).toBe(0);
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

  it('does not move officers while paused and rejects new orders', () => {
    sim.setWorldGrid(new GridMap(64, 40), 32);
    const officer = sim.getOfficers()[0]!;
    expect(sim.issueMoveOrder(officer.id, { column: 30, row: 33 })).toBe(true);
    sim.setPaused(true);
    const before = officer.position;
    sim.update(1);
    expect(officer.position).toEqual(before);
    expect(sim.issueMoveOrder(officer.id, { column: 31, row: 33 })).toBe(false);
  });

  it('spawns infected entities and advances their AI on fixed steps', () => {
    sim.setWorldGrid(new GridMap(64, 40), 32);
    const infected = sim.spawnInfected({
      x: 16, y: 16, entryTile: { column: 4, row: 1 }, moveSpeed: 32,
    });
    expect(sim.getState().infectedCount).toBe(1);
    sim.update(FIXED_DT);
    expect(infected.state).toBe('moving');
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

  it('tracks active officers after individual incapacitation', () => {
    expect(sim.damageOfficer(2, 100)).toBe(100);
    expect(sim.getState().officerCount).toBe(3);
    expect(sim.getState().activeOfficerCount).toBe(2);
    expect(sim.getOfficers()[1]!.state).toBe('incapacitated');
  });

  it('lets infected roam randomly when no active officer is detected', () => {
    sim.setWorldGrid(new GridMap(64, 40), 32);
    const infected = sim.spawnInfected({
      x: 16,
      y: 16,
      moveSpeed: 55,
      random: () => 0.99,
    });

    for (let index = 0; index < 60; index += 1) sim.update(FIXED_DT);

    expect(infected.state).toBe('moving');
    expect(infected.position).not.toEqual({ x: 16, y: 16 });
  });

  it('does not allow police movement through a closed shelter perimeter', () => {
    const map = new GridMap(64, 40);
    for (let column = 20; column <= 40; column += 1) {
      map.setBlocked({ column, row: 20 });
      map.setBlocked({ column, row: 30 });
    }
    for (let row = 20; row <= 30; row += 1) {
      map.setBlocked({ column: 20, row });
      map.setBlocked({ column: 40, row });
    }
    sim.setWorldGrid(map, 32);

    const officer = sim.getOfficers()[0]!;
    expect(sim.issueMoveOrder(officer.id, { column: 29, row: 25 })).toBe(false);
    expect(officer.position).toEqual({ x: 29 * 32 + 16, y: 33 * 32 + 16 });
  });

  it('keeps the shelter perimeter blocked during infected roaming', () => {
    const map = new GridMap(64, 40);
    for (let column = 20; column <= 40; column += 1) {
      map.setBlocked({ column, row: 20 });
      map.setBlocked({ column, row: 30 });
    }
    for (let row = 20; row <= 30; row += 1) {
      map.setBlocked({ column: 20, row });
      map.setBlocked({ column: 40, row });
    }
    sim.setWorldGrid(map, 32);
    const infected = sim.spawnInfected({
      x: 32 * 32 + 16,
      y: 33 * 32 + 16,
      moveSpeed: 55,
      wanderRadiusTiles: 8,
      random: () => 0,
    });

    for (let index = 0; index < 180; index += 1) sim.update(FIXED_DT);

    const tile = {
      column: Math.floor(infected.position.x / 32),
      row: Math.floor(infected.position.y / 32),
    };
    expect(tile.column <= 20 || tile.column >= 40 || tile.row <= 20 || tile.row >= 30).toBe(true);
    expect(map.isWalkable({ column: 30, row: 20 })).toBe(false);
    expect(map.isWalkable({ column: 30, row: 30 })).toBe(false);
  });

  it('defeats the mission when all three officers are incapacitated', () => {
    sim.damageOfficer(1, 100);
    sim.damageOfficer(2, 100);
    sim.damageOfficer(3, 100);
    expect(sim.isMissionDefeated()).toBe(true);
  });

});
