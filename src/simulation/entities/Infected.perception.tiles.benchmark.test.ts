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
const EXPECTED_LINE_OF_SIGHT_CALLS = 30;
const EXPECTED_TILE_TRAVERSAL_CHECKS = 18;

function createScenario() {
  const map = new GridMap(100, 100);
  const officers = Array.from({ length: 3 }, (_, index) =>
    new PoliceOfficer({
      id: index + 1,
      x: 320 + index * 48,
      y: 320,
      visionRange: 500,
    }));
  const civilians = Array.from({ length: 12 }, (_, index) =>
    new Civilian({
      id: index + 1,
      x: 360 + (index % 4) * 48,
      y: 400 + Math.floor(index / 4) * 48,
    }));
  const infected = Array.from({ length: 12 }, (_, index) =>
    new Infected({
      id: index + 1,
      x: 320 + (index % 4) * TILE_SIZE,
      y: 320 + Math.floor(index / 4) * TILE_SIZE,
      entryTile: { column: 10, row: 10 },
      detectionRange: 600,
      random: () => 0.5,
    }));

  return { map, officers, civilians, infected };
}

describe('Infected line-of-sight tile workload', () => {
  it('measures traversed grid cells for 12 infected against 3 officers and 12 civilians', () => {
    const { map, officers, civilians, infected } = createScenario();
    metrics.tileChecks = 0;
    lineOfSightMock.mockClear();

    for (const unit of infected) {
      unit.update(1 / 60, TILE_SIZE, map, officers, undefined, [], civilians);
    }

    expect(lineOfSightMock).toHaveBeenCalledTimes(EXPECTED_LINE_OF_SIGHT_CALLS);
    expect(metrics.tileChecks).toBe(EXPECTED_TILE_TRAVERSAL_CHECKS);
  });
});
