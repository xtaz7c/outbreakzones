import type { TilePosition } from '../world/WorldConfig';

export interface WaveSpawnPoint {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly entryTile: TilePosition;
}

export interface WaveDefinition {
  readonly infectedCount: number;
  readonly spawnInterval: number;
}

export type WavePhase = 'preparing' | 'spawning' | 'active' | 'completed';

export interface WaveState {
  readonly phase: WavePhase;
  readonly waveNumber: number;
  readonly totalWaves: number;
  readonly preparationRemaining: number;
  readonly remainingToSpawn: number;
}

export interface WaveSpawnRequest {
  readonly point: WaveSpawnPoint;
  readonly waveNumber: number;
  readonly index: number;
}

/**
 * Deterministic wave scheduler. It owns pacing and progression only;
 * entity creation remains the responsibility of the Simulation.
 */
export class WaveSystem {
  private phase: WavePhase = 'preparing';
  private waveIndex = 0;
  private preparationRemaining: number;
  private remainingToSpawn = 0;
  private spawnTimer = 0;

  constructor(
    private readonly spawnPoints: readonly WaveSpawnPoint[],
    private readonly waves: readonly WaveDefinition[],
    preparationDuration: number,
    private readonly random: () => number,
  ) {
    if (spawnPoints.length === 0) throw new RangeError('At least one wave spawn point is required.');
    if (waves.length === 0) throw new RangeError('At least one wave is required.');
    if (!Number.isFinite(preparationDuration) || preparationDuration < 0) {
      throw new RangeError('Preparation duration must be finite and non-negative.');
    }
    for (const point of spawnPoints) {
      if (!point.id.trim() || ![point.x, point.y].every(Number.isFinite)) {
        throw new RangeError('Wave spawn points require an id and finite coordinates.');
      }
    }
    for (const wave of waves) {
      if (!Number.isInteger(wave.infectedCount) || wave.infectedCount <= 0 ||
          !Number.isFinite(wave.spawnInterval) || wave.spawnInterval <= 0) {
        throw new RangeError('Each wave requires a positive infected count and spawn interval.');
      }
    }
    this.preparationRemaining = preparationDuration;
    this.remainingToSpawn = waves[0]!.infectedCount;
  }

  update(dt: number, aliveCount: number, spawn: (request: WaveSpawnRequest) => void): void {
    if (this.phase === 'completed' || !Number.isFinite(dt) || dt <= 0) return;
    if (!Number.isInteger(aliveCount) || aliveCount < 0) {
      throw new RangeError('Alive count must be a non-negative integer.');
    }

    if (this.phase === 'preparing') {
      this.preparationRemaining = Math.max(0, this.preparationRemaining - dt);
      if (this.preparationRemaining > 0) return;
      this.phase = 'spawning';
      this.spawnTimer = 0;
    }

    if (this.phase === 'spawning') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.remainingToSpawn > 0) {
        const wave = this.waves[this.waveIndex]!;
        const roll = this.random();
        if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
          throw new RangeError('Wave random source must return a value in [0, 1).');
        }
        const index = wave.infectedCount - this.remainingToSpawn;
        const point = this.spawnPoints[Math.floor(roll * this.spawnPoints.length)]!;
        spawn({ point, waveNumber: this.waveIndex + 1, index });
        this.remainingToSpawn -= 1;
        this.spawnTimer = wave.spawnInterval;
      }
      if (this.remainingToSpawn === 0) this.phase = 'active';
      return;
    }

    if (this.phase === 'active' && aliveCount === 0) {
      if (this.waveIndex >= this.waves.length - 1) {
        this.phase = 'completed';
        return;
      }
      this.waveIndex += 1;
      this.remainingToSpawn = this.waves[this.waveIndex]!.infectedCount;
      this.preparationRemaining = this.waves[this.waveIndex - 1]!.spawnInterval * 4;
      this.phase = 'preparing';
      this.spawnTimer = 0;
    }
  }

  getState(): WaveState {
    return {
      phase: this.phase,
      waveNumber: this.waveIndex + 1,
      totalWaves: this.waves.length,
      preparationRemaining: this.preparationRemaining,
      remainingToSpawn: this.remainingToSpawn,
    };
  }
}
