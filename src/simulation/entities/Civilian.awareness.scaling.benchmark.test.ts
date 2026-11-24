import { performance } from 'node:perf_hooks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasLineOfSight } from '../systems/CombatSystem';
import { findPath } from '../systems/navigation/Pathfinder';
import { GridMap } from '../world/GridMap';
import { Civilian } from './Civilian';
import { PoliceOfficer } from './PoliceOfficer';

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
  };
});

const lineOfSightMock = vi.mocked(hasLineOfSight);
const findPathMock = vi.mocked(findPath);
const TILE_SIZE = 32;
const WARMUP_ITERATIONS = 10;
const ITERATIONS = 30;

interface CivilianAwarenessResult {
  readonly map: string;
  readonly civilians: number;
  readonly iterations: number;
  readonly averageMs: number;
  readonly p95Ms: number;
  readonly lineOfSightCallsPerTick: number;
  readonly pathSearchesPerTick: number;
  readonly pathfinderWorkspaceTypedArrayBytes: number;
}

function benchmarkAwareness(
  columns: number,
  rows: number,
  civilianCount: number,
): CivilianAwarenessResult {
  const map = new GridMap(columns, rows);
  const officer = new PoliceOfficer({
    id: 1,
    x: 448,
    y: 320,
    visionRange: 420,
  });
  const civilians = Array.from({ length: civilianCount }, (_, index) => {
    const civilian = new Civilian({
      id: index + 1,
      x: 320,
      y: 320,
    });
    civilian.beginFollowing();
    civilian.assignEscort(officer.id);
    return civilian;
  });
  const samples: number[] = [];

  // Warm up first so lazy workspace creation and JIT compilation do not skew samples.
  for (let iteration = 0; iteration < WARMUP_ITERATIONS; iteration += 1) {
    for (const civilian of civilians) {
      civilian.updateAwareness(1 / 60, TILE_SIZE, map, [officer], []);
    }
  }

  lineOfSightMock.mockClear();
  findPathMock.mockClear();

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const start = performance.now();
    for (const civilian of civilians) {
      civilian.updateAwareness(1 / 60, TILE_SIZE, map, [officer], []);
    }
    samples.push(performance.now() - start);
  }

  samples.sort((a, b) => a - b);
  const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const p95Ms = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)]!;

  expect(lineOfSightMock).toHaveBeenCalledTimes(civilianCount * ITERATIONS);
  expect(findPathMock).toHaveBeenCalledTimes(civilianCount * ITERATIONS);

  return {
    map: `${columns}x${rows}`,
    civilians: civilianCount,
    iterations: ITERATIONS,
    averageMs,
    p95Ms,
    lineOfSightCallsPerTick: lineOfSightMock.mock.calls.length / ITERATIONS,
    pathSearchesPerTick: findPathMock.mock.calls.length / ITERATIONS,
    // One retained workspace per map: Float64Array + Int32Array + Uint8Array.
    // This excludes heap nodes, paths and other transient allocations.
    pathfinderWorkspaceTypedArrayBytes: columns * rows * 13,
  };
}

describe('Civilian awareness scaling baseline (informational)', () => {
  beforeEach(() => {
    lineOfSightMock.mockClear();
    findPathMock.mockClear();
  });

  it('records awareness cost across larger grids and civilian populations', () => {
    const results = [
      benchmarkAwareness(120, 90, 1),
      benchmarkAwareness(120, 90, 12),
      benchmarkAwareness(240, 180, 1),
      benchmarkAwareness(240, 180, 12),
      benchmarkAwareness(400, 300, 1),
      benchmarkAwareness(400, 300, 12),
    ];

    console.info('[Civilian awareness scaling baseline]', JSON.stringify(results));
    expect(results).toHaveLength(6);
    expect(results.every((result) =>
      Number.isFinite(result.averageMs) &&
      result.averageMs > 0 &&
      Number.isFinite(result.p95Ms) &&
      result.p95Ms > 0,
    )).toBe(true);
  });
});
