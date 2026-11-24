import { describe, expect, it, vi } from 'vitest';
import { hasLineOfSight } from '../systems/CombatSystem';
import { findPath } from '../systems/navigation/Pathfinder';
import { GridMap } from '../world/GridMap';
import { Civilian } from './Civilian';
import { Infected, type InfectedStimulus } from './Infected';
import { PoliceOfficer } from './PoliceOfficer';

vi.mock('../systems/CombatSystem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../systems/CombatSystem')>();
  return { ...actual, hasLineOfSight: vi.fn(actual.hasLineOfSight) };
});

vi.mock('../systems/navigation/Pathfinder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../systems/navigation/Pathfinder')>();
  return { ...actual, findPath: vi.fn(actual.findPath) };
});

const lineOfSightMock = vi.mocked(hasLineOfSight);
const findPathMock = vi.mocked(findPath);
const TILE_SIZE = 32;
const INFECTED_COUNT = 12;
const HUMAN_TARGET_COUNT = 15;
const STIMULUS_TICKS = 30;

function createInfected(count: number, detectionRange = 1200): Infected[] {
  return Array.from({ length: count }, (_, index) => new Infected({
    id: index + 1,
    x: 336,
    y: 336,
    entryTile: { column: 10, row: 10 },
    detectionRange,
    random: () => 0.5,
  }));
}

describe('Infected scaling diagnostic workloads', () => {
  it('counts perception rays when 12 infected can see all 15 human targets', () => {
    const map = new GridMap(100, 100);
    const officers = Array.from({ length: 3 }, (_, index) =>
      new PoliceOfficer({ id: index + 1, x: 800, y: 800, visionRange: 1200 }));
    const civilians = Array.from({ length: 12 }, (_, index) =>
      new Civilian({ id: index + 1, x: 800, y: 800 }));
    const infected = createInfected(INFECTED_COUNT);

    lineOfSightMock.mockClear();
    for (const unit of infected) {
      unit.update(1 / 60, TILE_SIZE, map, officers, undefined, [], civilians);
    }

    // Co-located targets all tie for nearest distance, so every ray is evaluated.
    expect(lineOfSightMock).toHaveBeenCalledTimes(INFECTED_COUNT * HUMAN_TARGET_COUNT);
  });

  it('counts repeated A* searches while the same stimulus remains active', () => {
    const map = new GridMap(100, 100);
    const infected = createInfected(INFECTED_COUNT, 100);
    const stimulus: InfectedStimulus = {
      id: 'diagnostic-gunshot',
      position: { x: 656, y: 336 },
      radius: 1000,
      strength: 1,
    };

    findPathMock.mockClear();
    for (let tick = 0; tick < STIMULUS_TICKS; tick += 1) {
      for (const unit of infected) {
        unit.update(1 / 60, TILE_SIZE, map, [], undefined, [stimulus]);
      }
    }

    // Each infected resolves the stimulus once and creates its movement route once.
    // The unchanged active stimulus must not trigger another reachability search.
    expect(findPathMock).toHaveBeenCalledTimes(INFECTED_COUNT * 2);
  });

  it('re-resolves the destination when an active stimulus moves', () => {
    const map = new GridMap(100, 100);
    const infected = createInfected(1, 100);
    const stimulus: InfectedStimulus = {
      id: 'moving-stimulus',
      position: { x: 656, y: 336 },
      radius: 1000,
      strength: 1,
    };

    findPathMock.mockClear();
    infected[0]!.update(1 / 60, TILE_SIZE, map, [], undefined, [stimulus]);
    const firstPosition = { ...stimulus.position };
    const movedStimulus: InfectedStimulus = {
      ...stimulus,
      position: { x: firstPosition.x + TILE_SIZE, y: firstPosition.y },
    };
    infected[0]!.update(1 / 60, TILE_SIZE, map, [], undefined, [movedStimulus]);

    // The changed position triggers one new reachability search and one new route.
    expect(findPathMock).toHaveBeenCalledTimes(4);
  });

  it('rebuilds the cached route when a navigation obstacle blocks its next step', () => {
    const map = new GridMap(100, 100);
    const infected = createInfected(1, 100);
    const stimulus: InfectedStimulus = {
      id: 'persistent-gunshot',
      position: { x: 656, y: 336 },
      radius: 1000,
      strength: 1,
    };

    findPathMock.mockClear();
    infected[0]!.update(1 / 60, TILE_SIZE, map, [], undefined, [stimulus]);
    map.setBlocked({ column: 11, row: 10 });
    infected[0]!.update(1 / 60, TILE_SIZE, map, [], undefined, [stimulus]);

    // A blocked waypoint invalidates the cached route and triggers a fresh
    // reachability check plus a replacement movement route.
    expect(findPathMock).toHaveBeenCalledTimes(4);
  });
});
