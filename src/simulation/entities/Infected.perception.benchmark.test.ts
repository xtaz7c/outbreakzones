import { describe, expect, it, vi } from 'vitest';
import { hasLineOfSight } from '../systems/CombatSystem';
import { Infected } from './Infected';
import { PoliceOfficer } from './PoliceOfficer';
import { Civilian } from './Civilian';
import { GridMap } from '../world/GridMap';

vi.mock('../systems/CombatSystem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../systems/CombatSystem')>();
  return {
    ...actual,
    hasLineOfSight: vi.fn(actual.hasLineOfSight),
  };
});

const lineOfSightMock = vi.mocked(hasLineOfSight);
const TILE_SIZE = 32;
const EXPECTED_SINGLE_INFECTED_CHECKS = 1;
const EXPECTED_TWELVE_INFECTED_CHECKS = 30;

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

  return { map, officers, civilians };
}

function createInfected(count: number): Infected[] {
  return Array.from({ length: count }, (_, index) =>
    new Infected({
      id: index + 1,
      x: 320 + (index % 4) * TILE_SIZE,
      y: 320 + Math.floor(index / 4) * TILE_SIZE,
      entryTile: { column: 10, row: 10 },
      detectionRange: 600,
      random: () => 0.5,
    }));
}

/**
 * Deterministic workload measurement: counts line-of-sight evaluations
 * made by infected perception. It intentionally does not claim to measure
 * CPU time, frame rate, or total game-loop cost.
 */
describe('Infected perception workload measurements', () => {
  it('measures line-of-sight checks for one infected against 3 officers and 12 civilians', () => {
    const { map, officers, civilians } = createScenario();
    const [infected] = createInfected(1);
    lineOfSightMock.mockClear();

    infected!.update(
      1 / 60,
      TILE_SIZE,
      map,
      officers,
      undefined,
      [],
      civilians,
    );

    expect(lineOfSightMock).toHaveBeenCalledTimes(EXPECTED_SINGLE_INFECTED_CHECKS);
  });

  it('measures aggregate line-of-sight checks for 12 infected in one simulation tick', () => {
    const { map, officers, civilians } = createScenario();
    const infectedUnits = createInfected(12);
    lineOfSightMock.mockClear();

    for (const infected of infectedUnits) {
      infected.update(
        1 / 60,
        TILE_SIZE,
        map,
        officers,
        undefined,
        [],
        civilians,
      );
    }

    expect(lineOfSightMock).toHaveBeenCalledTimes(
      EXPECTED_TWELVE_INFECTED_CHECKS,
    );
  });
});
