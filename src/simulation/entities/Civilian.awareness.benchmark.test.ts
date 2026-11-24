import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GridMap } from '../world/GridMap';

vi.mock('../systems/CombatSystem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../systems/CombatSystem')>();
  return {
    ...actual,
    hasLineOfSight: vi.fn(actual.hasLineOfSight),
  };
});

vi.mock('../systems/navigation/Pathfinder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../systems/navigation/Pathfinder')>();
  return {
    ...actual,
    findPath: vi.fn(actual.findPath),
    findReachableTiles: vi.fn(actual.findReachableTiles),
  };
});

import { hasLineOfSight } from '../systems/CombatSystem';
import { findPath, findReachableTiles } from '../systems/navigation/Pathfinder';
import { Civilian } from './Civilian';
import { PoliceOfficer } from './PoliceOfficer';

const measuredLineOfSight = vi.mocked(hasLineOfSight);
const measuredFindPath = vi.mocked(findPath);
const measuredReachability = vi.mocked(findReachableTiles);

describe('Civilian awareness workload measurements', () => {
  beforeEach(() => {
    measuredLineOfSight.mockClear();
    measuredFindPath.mockClear();
    measuredReachability.mockClear();
  });

  it('measures visibility and escort-route work for twelve civilians in one tick', () => {
    const map = new GridMap(40, 40);
    const officer = new PoliceOfficer({
      id: 1,
      x: 480,
      y: 480,
      visionRange: 1200,
    });
    const civilians = Array.from(
      { length: 12 },
      (_, index) => new Civilian({ id: index + 1, x: 320, y: 480 }),
    );

    for (const civilian of civilians) {
      expect(civilian.beginFollowing(officer.id)).toBe(true);
      civilian.updateAwareness(1 / 60, 32, map, [officer], []);
    }

    expect(measuredLineOfSight).toHaveBeenCalledTimes(12);
    expect(measuredFindPath).toHaveBeenCalledTimes(12);
    expect(measuredReachability).not.toHaveBeenCalled();
  });
});
