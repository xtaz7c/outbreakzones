import { describe, it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { GridMap } from '../../world/GridMap';
import { findPath } from './Pathfinder';

interface BenchmarkResult {
  map: string;
  iterations: number;
  averageMs: number;
  p95Ms: number;
}

/** Informational baseline only: timing assertions are intentionally avoided. */
function benchmarkRoute(columns: number, rows: number, iterations: number): BenchmarkResult {
  const map = new GridMap(columns, rows);
  // Deterministic sparse obstacles, leaving a clear route across the middle.
  for (let row = 1; row < rows - 1; row += 1) {
    for (let column = 1; column < columns - 1; column += 1) {
      const hash = (column * 31 + row * 17) % 97;
      if (hash < 8 && row !== Math.floor(rows / 2)) map.setBlocked({ column, row });
    }
  }
  const start = { column: 1, row: 1 };
  const goal = { column: columns - 2, row: rows - 2 };
  const samples: number[] = [];

  // Warm-up is not recorded.
  expect(findPath(map, start, goal)).not.toBeNull();
  for (let index = 0; index < iterations; index += 1) {
    const begin = performance.now();
    const path = findPath(map, start, goal);
    samples.push(performance.now() - begin);
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual(goal);
  }

  samples.sort((a, b) => a - b);
  const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const p95Ms = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)]!;
  return { map: `${columns}x${rows}`, iterations, averageMs, p95Ms };
}

describe('pathfinding performance baseline (informational)', () => {
  it('records route-search timings across increasing grid sizes', () => {
    const results = [
      benchmarkRoute(120, 90, 20),
      benchmarkRoute(240, 180, 12),
      benchmarkRoute(400, 300, 6),
    ];
    console.info('[Pathfinding baseline]', JSON.stringify(results));
    expect(results).toHaveLength(3);
    expect(results.every((result) => Number.isFinite(result.averageMs) && result.averageMs > 0)).toBe(true);
  });
});
