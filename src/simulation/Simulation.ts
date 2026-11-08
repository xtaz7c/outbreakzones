/**
 * Núcleo da simulação do jogo.
 * Não depende de Phaser nem de qualquer API de renderização.
 *
 * Timestep: fixed timestep com acumulador (ADR7).
 */
import { PoliceOfficer } from './PoliceOfficer';
import type { GridMap } from './world/GridMap';
import type { TilePosition } from './world/WorldConfig';

export interface SimulationState {
  elapsed: number;
  paused: boolean;
  officerCount: number;
  activeOfficerCount: number;
  infectedCount: number;
}

export const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.25;
const MAX_STEPS_PER_UPDATE = 12;
const WORLD_TILE_SIZE = 32;

function isValidDt(dt: number): boolean {
  return Number.isFinite(dt) && dt >= 0;
}

export class Simulation {
  private elapsed = 0;
  private paused = false;
  private accumulator = 0;
  private readonly officers: PoliceOfficer[] = [
    new PoliceOfficer({ id: 1, x: 29 * WORLD_TILE_SIZE + 16, y: 33 * WORLD_TILE_SIZE + 16 }),
    new PoliceOfficer({ id: 2, x: 32 * WORLD_TILE_SIZE + 16, y: 33 * WORLD_TILE_SIZE + 16 }),
    new PoliceOfficer({ id: 3, x: 35 * WORLD_TILE_SIZE + 16, y: 33 * WORLD_TILE_SIZE + 16 }),
  ];
  private infectedCount = 0;
  private worldGrid: GridMap | null = null;
  private tileSize = WORLD_TILE_SIZE;

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  setWorldGrid(map: GridMap, tileSize: number): void {
    if (!Number.isFinite(tileSize) || tileSize <= 0) {
      throw new RangeError('Tile size must be a positive finite number.');
    }
    this.worldGrid = map;
    this.tileSize = tileSize;
  }

  getOfficers(): readonly PoliceOfficer[] {
    return this.officers;
  }

  issueMoveOrder(officerId: number, destination: TilePosition): boolean {
    const officer = this.officers.find((candidate) => candidate.id === officerId);
    if (!officer || !this.worldGrid || this.paused) return false;
    return officer.issueMoveOrder(destination, this.worldGrid, this.tileSize);
  }

  setOfficerAttacking(officerId: number, attacking: boolean): boolean {
    const officer = this.officers.find((candidate) => candidate.id === officerId);
    return officer ? officer.setAttacking(attacking) : false;
  }

  damageOfficer(officerId: number, amount: number): number {
    const officer = this.officers.find((candidate) => candidate.id === officerId);
    return officer?.takeDamage(amount) ?? 0;
  }

  update(dt: number): void {
    if (this.paused || !isValidDt(dt)) return;

    this.accumulator += Math.min(dt, MAX_FRAME_DT);
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_UPDATE) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps += 1;
    }
    if (steps >= MAX_STEPS_PER_UPDATE) this.accumulator = 0;
  }

  private step(dt: number): void {
    this.elapsed += dt;
    for (const officer of this.officers) {
      officer.update(dt, this.tileSize);
    }
  }

  getState(): SimulationState {
    return {
      elapsed: this.elapsed,
      paused: this.paused,
      officerCount: this.officers.length,
      activeOfficerCount: this.officers.filter((officer) => !officer.isIncapacitated).length,
      infectedCount: this.infectedCount,
    };
  }
}
