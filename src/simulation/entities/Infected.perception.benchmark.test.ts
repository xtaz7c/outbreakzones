import { describe, expect, it, vi } from 'vitest';
import * as combatModule from '../systems/CombatSystem';
import { Infected } from './Infected';
import { PoliceOfficer } from './PoliceOfficer';
import { Civilian } from './Civilian';
import { GridMap } from '../world/GridMap';

/**
 * Deterministic perception workload counters. These tests count LOS checks,
 * rather than asserting wall-clock timing (which is runner-dependent).
 */
describe('Infected perception workload measurements', () => {
  const map = new GridMap(100, 100);
  const officers = Array.from({ length: 3 }, (_, i) =>
    new PoliceOfficer({ id: i + 1, x: 320 + i * 48, y: 320, visionRange: 500 }));
  const civilians = Array.from({ length: 12 }, (_, i) =>
    new Civilian({ id: i + 1, x: 360 + (i % 4) * 48, y: 400 + Math.floor(i / 4) * 48 }));

  it('records line-of-sight checks for a single infected against representative targets', () => {
    const spy = vi.spyOn(combatModule, 'hasLineOfSight');
    const infected = new Infected({
      id: 1, x: 320, y: 320, entryTile: { column: 10, row: 10 },
      detectionRange: 600, random: () => 0.5,
    });
    infected.update(1 / 60, 32, map, officers, undefined, [], civilians);
    const count = spy.mock.calls.length;
    spy.mockRestore();
    expect(count).toBeGreaterThan(0);
  });

  it('records aggregate perception work for twelve infected in one simulation tick', () => {
    const spy = vi.spyOn(combatModule, 'hasLineOfSight');
    const infectedUnits = Array.from({ length: 12 }, (_, i) =>
      new Infected({
        id: i + 1, x: 320 + (i % 4) * 32, y: 320 + Math.floor(i / 4) * 32,
        entryTile: { column: 10, row: 10 }, detectionRange: 600, random: () => 0.5,
      }));
    for (const unit of infectedUnits) {
      unit.update(1 / 60, 32, map, officers, undefined, [], civilians);
    }
    const count = spy.mock.calls.length;
    spy.mockRestore();
    expect(count).toBeGreaterThan(0);
  });
});
