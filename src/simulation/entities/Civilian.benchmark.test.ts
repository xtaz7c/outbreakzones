import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GridMap } from '../world/GridMap';

vi.mock('../systems/navigation/Pathfinder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../systems/navigation/Pathfinder')>();
  return {
    ...actual,
    findPath: vi.fn(actual.findPath),
  };
});

import { findPath } from '../systems/navigation/Pathfinder';
import { Civilian } from './Civilian';

const measuredFindPath = vi.mocked(findPath);

describe('Civilian panic pathfinding measurements', () => {
  beforeEach(() => {
    measuredFindPath.mockClear();
  });

  it('measures candidate reachability and movement searches for one panicked civilian', () => {
    const map = new GridMap(30, 30);
    const civilian = new Civilian({ id: 1, x: 480, y: 480 });

    civilian.updateAwareness(1 / 60, 32, map, [], [{ x: 528, y: 480 }]);

    // The 9x9 candidate window triggers one A* call per walkable tile.
    // Moving toward the selected flee tile triggers one additional call.
    expect(measuredFindPath).toHaveBeenCalledTimes(82);
  });

  it('measures the aggregate cost when twelve civilians panic in the same tick', () => {
    const map = new GridMap(30, 30);
    const civilians = Array.from(
      { length: 12 },
      (_, index) => new Civilian({ id: index + 1, x: 480, y: 480 }),
    );

    for (const civilian of civilians) {
      civilian.updateAwareness(1 / 60, 32, map, [], [{ x: 528, y: 480 }]);
    }

    expect(measuredFindPath).toHaveBeenCalledTimes(984);
  });
});
