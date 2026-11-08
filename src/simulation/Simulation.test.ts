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

  it('tracks active officers after individual incapacitation', () => {
    expect(sim.damageOfficer(2, 100)).toBe(100);
    expect(sim.getState().officerCount).toBe(3);
    expect(sim.getState().activeOfficerCount).toBe(2);
    expect(sim.getOfficers()[1]!.state).toBe('incapacitated');
  });

});
