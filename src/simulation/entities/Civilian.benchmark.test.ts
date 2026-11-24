import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GridMap } from '../world/GridMap';

vi.mock('../systems/navigation/Pathfinder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../systems/navigation/Pathfinder')>();
  return {
    ...actual,
    findPath: vi.fn(actual.findPath),
    findReachableTiles: vi.fn(actual.findReachableTiles),
  };
});

import { findPath, findReachableTiles } from '../systems/navigation/Pathfinder';
import { Civilian } from './Civilian';

const measuredFindPath = vi.mocked(findPath);
const measuredReachability = vi.mocked(findReachableTiles);

describe('Civilian panic pathfinding measurements', () => {
  beforeEach(() => {
    measuredFindPath.mockClear();
    measuredReachability.mockClear();
  });

  it('uses one reachability search and one route search for a panicked civilian', () => {
    const map = new GridMap(30, 30);
    const civilian = new Civilian({ id: 1, x: 480, y: 480 });
    civilian.updateAwareness(1 / 60, 32, map, [], [{ x: 528, y: 480 }]);
    expect(measuredReachability).toHaveBeenCalledTimes(1);
    expect(measuredFindPath).toHaveBeenCalledTimes(1);
  });

  it('keeps the search count linear when twelve civilians panic in the same tick', () => {
    const map = new GridMap(30, 30);
    const civilians = Array.from(
      { length: 12 },
      (_, index) => new Civilian({ id: index + 1, x: 480, y: 480 }),
    );
    for (const civilian of civilians) {
      civilian.updateAwareness(1 / 60, 32, map, [], [{ x: 528, y: 480 }]);
    }
    expect(measuredReachability).toHaveBeenCalledTimes(12);
    expect(measuredFindPath).toHaveBeenCalledTimes(12);
  });
});
