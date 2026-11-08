/**
 * Núcleo da simulação do jogo.
 * Não depende de Phaser nem de qualquer API de renderização.
 *
 * Timestep: fixed timestep com acumulador (ADR7).
 */
import { PoliceOfficer } from './PoliceOfficer';
import { Infected } from './Infected';
import { CombatSystem, type AmmoStatus, type CombatEvent, type CombatSystemOptions } from './CombatSystem';
import type { InfectedConfig } from './Infected';
import type { GridMap } from './world/GridMap';
import { ResidenceDefense, type ResidenceDefenseStatus } from './world/ResidenceDefense';
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
  private readonly infected: Infected[] = [];
  private readonly combat: CombatSystem;
  private readonly residence = new ResidenceDefense();
  private readonly openedEntranceIds = new Set<string>();
  private combatEvents: CombatEvent[] = [];
  private nextInfectedId = 1;
  private worldGrid: GridMap | null = null;
  private tileSize = WORLD_TILE_SIZE;

  constructor(combatOptions: CombatSystemOptions = {}) {
    this.combat = new CombatSystem(combatOptions);
  }

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

  getInfected(): readonly Infected[] {
    return this.infected;
  }

  getResidenceDefense(): ResidenceDefense {
    return this.residence;
  }

  getResidenceStatus(): ResidenceDefenseStatus {
    return this.residence.getStatus();
  }

  isMissionDefeated(): boolean {
    return this.residence.getStatus().isOverrun ||
      this.officers.every((officer) => officer.isIncapacitated);
  }

  spawnInfected(config: Omit<InfectedConfig, 'id'>): Infected {
    const infected = new Infected({ ...config, id: this.nextInfectedId++ });
    this.infected.push(infected);
    return infected;
  }

  setTargetPriority(officerId: number, infectedId: number | null): void {
    this.combat.setTargetPriority(officerId, infectedId);
    if (infectedId !== null) {
      this.officers.find((officer) => officer.id === officerId)?.setAttacking(true);
    }
  }

  getCombatEvents(): readonly CombatEvent[] {
    return this.combatEvents;
  }

  getOfficerAmmoStatus(officerId: number): AmmoStatus {
    return this.combat.getAmmoStatus(officerId);
  }

  damageInfected(infectedId: number, amount: number): number {
    const infected = this.infected.find((candidate) => candidate.id === infectedId);
    return infected?.takeDamage(amount) ?? 0;
  }

  issueMoveOrder(officerId: number, destination: TilePosition): boolean {
    const officer = this.officers.find((candidate) => candidate.id === officerId);
    if (!officer || !this.worldGrid || this.paused || this.isMissionDefeated()) return false;
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
    this.combatEvents = [];
    if (this.paused || !isValidDt(dt) || this.isMissionDefeated()) return;

    this.accumulator += Math.min(dt, MAX_FRAME_DT);
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_UPDATE) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps += 1;
      if (this.isMissionDefeated()) {
        this.accumulator = 0;
        break;
      }
    }
    if (steps >= MAX_STEPS_PER_UPDATE) this.accumulator = 0;
  }

  private step(dt: number): void {
    this.elapsed += dt;
    for (const officer of this.officers) {
      officer.update(dt, this.tileSize);
    }
    if (this.worldGrid) {
      const entrances = this.residence.getEntrances();
      for (const infected of this.infected) {
        infected.update(dt, this.tileSize, this.worldGrid, this.officers, entrances);
      }

      // A breached opening becomes walkable so A* can route through the wall.
      for (const entrance of entrances) {
        if (entrance.isDestroyed && !this.openedEntranceIds.has(entrance.id)) {
          if (this.worldGrid.contains(entrance.structureTile)) {
            this.worldGrid.setBlocked(entrance.structureTile, false);
          }
          this.openedEntranceIds.add(entrance.id);
        }
      }

      if (this.infected.some((infected) => infected.hasEnteredResidence)) {
        this.residence.markOverrun();
      }

      this.combatEvents.push(...this.combat.update(
        dt, this.officers, this.infected, this.worldGrid, this.tileSize,
      ));
    }
    for (let index = this.infected.length - 1; index >= 0; index -= 1) {
      if (this.infected[index]!.isDead) this.infected.splice(index, 1);
    }
  }

  getState(): SimulationState {
    return {
      elapsed: this.elapsed,
      paused: this.paused,
      officerCount: this.officers.length,
      activeOfficerCount: this.officers.filter((officer) => !officer.isIncapacitated).length,
      infectedCount: this.infected.length,
    };
  }
}
