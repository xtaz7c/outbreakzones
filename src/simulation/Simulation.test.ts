import { describe, it, expect, beforeEach } from 'vitest';
import { FIXED_DT, Simulation } from './Simulation';

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
});
