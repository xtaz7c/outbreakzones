import { describe, expect, it, vi } from 'vitest';
import { WaveSystem, type WaveSpawnPoint } from './WaveSystem';

const points: WaveSpawnPoint[] = [
  { id: 'west', x: 32, y: 320, entryTile: { column: 2, row: 10 } },
  { id: 'east', x: 640, y: 320, entryTile: { column: 18, row: 10 } },
];

describe('WaveSystem', () => {
  it('waits through preparation before spawning the first wave', () => {
    const waves = new WaveSystem(points, [{ infectedCount: 2, spawnInterval: 1 }], 3, () => 0);
    const spawn = vi.fn();
    waves.update(2, 0, spawn);
    expect(spawn).not.toHaveBeenCalled();
    expect(waves.getState().phase).toBe('preparing');
    waves.update(1, 0, spawn);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(waves.getState().phase).toBe('spawning');
    expect(waves.getState().remainingToSpawn).toBe(1);
  });

  it('spawns deterministic waves and completes only after the last infected is defeated', () => {
    const waves = new WaveSystem(points, [
      { infectedCount: 2, spawnInterval: 0.5 },
      { infectedCount: 1, spawnInterval: 0.5 },
    ], 0, () => 0.75);
    const spawned: Array<{ waveNumber: number; pointId: string }> = [];
    const spawn = (request: { waveNumber: number; point: WaveSpawnPoint }) => {
      spawned.push({ waveNumber: request.waveNumber, pointId: request.point.id });
    };
    waves.update(1 / 60, 0, spawn);
    expect(spawned).toEqual([{ waveNumber: 1, pointId: 'east' }]);
    waves.update(0.5, 1, spawn);
    expect(spawned).toHaveLength(2);
    expect(waves.getState().phase).toBe('active');
    waves.update(1 / 60, 0, spawn);
    expect(waves.getState().phase).toBe('preparing');
    waves.update(2, 0, spawn);
    expect(spawned[2]).toEqual({ waveNumber: 2, pointId: 'east' });
    waves.update(0.5, 1, spawn);
    expect(waves.getState().phase).toBe('active');
    waves.update(1 / 60, 0, spawn);
    expect(waves.getState().phase).toBe('completed');
  });

  it('rejects invalid configuration and random values', () => {
    expect(() => new WaveSystem([], [{ infectedCount: 1, spawnInterval: 1 }], 0, () => 0))
      .toThrow(RangeError);
    expect(() => new WaveSystem(points, [{ infectedCount: 0, spawnInterval: 1 }], 0, () => 0))
      .toThrow(RangeError);
    const waves = new WaveSystem(points, [{ infectedCount: 1, spawnInterval: 1 }], 0, () => 1);
    expect(() => waves.update(1 / 60, 0, () => undefined)).toThrow(RangeError);
  });
});
