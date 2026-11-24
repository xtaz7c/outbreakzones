import { describe, expect, it, vi } from 'vitest';
import { hasLineOfSight } from '../systems/CombatSystem';
import { Infected } from './Infected';
import { PoliceOfficer } from './PoliceOfficer';
import { Civilian } from './Civilian';
import { GridMap } from '../world/GridMap';

const metrics = vi.hoisted(() => ({ tileChecks: 0 }));

vi.mock('../systems/CombatSystem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../systems/CombatSystem')>();
  return {
    ...actual,
    hasLineOfSight: vi.fn((...args: Parameters<typeof actual.hasLineOfSight>) => {
      const [map] = args;
      const walkabilitySpy = vi.spyOn(map, 'isWalkable');
      const visible = actual.hasLineOfSight(...args);
      metrics.tileChecks += walkabilitySpy.mock.calls.length;
      walkabilitySpy.mockRestore();
      return visible;
    }),
  };
});

const lineOfSightMock = vi.mocked(hasLineOfSight);
const TILE_SIZE = 32;
const EXPECTED_LINE_OF_SIGHT_CALLS = 15;
const EXPECTED_TILE_TRAVERSAL_CHECKS = 210;

/**
 * Long-range deterministic workload: one infected at tile (10, 10), with
 * 15 human targets grouped in tile (25, 25). Every ray crosses 14
 * intermediate cells before reaching the target tile.
 */
describe('Infected long-range perception workload', () => {
  it('measures grid traversal for distant officers and civilians', () => {
    const map = new GridMap(100, 100);
    const officers = Array.from({ length: 3 }, (_, index) =>
      new PoliceOfficer({
        id: index + 1,
        x: 800 + index,
        y: 800,
        visionRange: 1200,
      }));
    const civilians = Array.from({ length: 12 }, (_, index) =>
      new Civilian({
        id: index + 1,
        x: 800 + index,
        y: 801,
      }));
    const infected = new Infected({
      id: 1,
      x: 320,
      y: 320,
      entryTile: { column: 10, row: 10 },
      detectionRange: 1200,
      random: () => 0.5,
    });

    metrics.tileChecks = 0;
    lineOfSightMock.mockClear();

    infected.update(1 / 60, TILE_SIZE, map, officers, undefined, [], civilians);

    expect(lineOfSightMock).toHaveBeenCalledTimes(EXPECTED_LINE_OF_SIGHT_CALLS);
    expect(metrics.tileChecks).toBe(EXPECTED_TILE_TRAVERSAL_CHECKS);
  });
});
