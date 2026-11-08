import { describe, it, expect, beforeEach } from 'vitest';
import { Simulation } from './Simulation';

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

  it('advances elapsed time when not paused', () => {
    sim.update(0.016);
    sim.update(0.016);
    expect(sim.getState().elapsed).toBeCloseTo(0.032, 5);
  });

  it('does not advance while paused', () => {
    sim.setPaused(true);
    sim.update(1);
    expect(sim.getState().elapsed).toBe(0);
    expect(sim.getState().paused).toBe(true);
  });

  it('clamps large delta to avoid instability', () => {
    sim.update(10); // 10 segundos de uma vez
    expect(sim.getState().elapsed).toBeLessThanOrEqual(0.05);
  });
});
