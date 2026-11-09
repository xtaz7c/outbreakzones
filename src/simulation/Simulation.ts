/**
 * Núcleo da simulação do jogo.
 * Não depende de Phaser nem de qualquer API de renderização.
 *
 * Timestep: fixed timestep com acumulador (ADR7).
 */
import { PoliceOfficer, type TacticalPosture } from './PoliceOfficer';
import { Infected } from './Infected';
import { CombatSystem, type AmmoStatus, type CombatEvent, type CombatSystemOptions } from './CombatSystem';
import type { InfectedConfig, InfectedStructureTarget } from './Infected';
import type { GridMap } from './world/GridMap';
import { BuildingSystem, type AccessSnapshot, type ActorKind } from './world/BuildingSystem';
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
  private combatEvents: CombatEvent[] = [];
  private nextInfectedId = 1;
  private noiseAttraction: { target: InfectedStructureTarget; radius: number; remaining: number } | null = null;
  private worldGrid: GridMap | null = null;
  private buildingSystem: BuildingSystem | null = null;
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

  setBuildingSystem(system: BuildingSystem): void {
    this.buildingSystem = system;
  }

  getBuildingSnapshots(): AccessSnapshot[] {
    return this.buildingSystem?.getSnapshots() ?? [];
  }

  interactWithAccess(accessId: string, actor: ActorKind, hasKey = false): boolean {
    return this.buildingSystem?.interact(accessId, actor, hasKey) ?? false;
  }

  damageAccess(accessId: string, amount: number): number {
    return this.buildingSystem?.damage(accessId, amount) ?? 0;
  }

  getOfficers(): readonly PoliceOfficer[] {
    return this.officers;
  }

  getInfected(): readonly Infected[] {
    return this.infected;
  }

  isMissionDefeated(): boolean {
    return this.officers.every((officer) => officer.isIncapacitated);
  }

  spawnInfected(config: Omit<InfectedConfig, 'id'>): Infected {
    const infected = new Infected({ ...config, id: this.nextInfectedId++ });
    this.infected.push(infected);
    return infected;
  }

  setTargetPriority(officerId: number, infectedId: number | null): void {
    this.combat.setTargetPriority(officerId, infectedId);
  }

  getCombatEvents(): readonly CombatEvent[] {
    return this.combatEvents;
  }

  getOfficerAmmoStatus(officerId: number): AmmoStatus {
    return this.combat.getAmmoStatus(officerId);
  }

  emitNoiseAtStructure(target: InfectedStructureTarget, radius = 1000, duration = 10): void {
    if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Noise radius must be positive.');
    if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Noise duration must be positive.');
    this.noiseAttraction = { target, radius, remaining: duration };
  }

  damageInfected(infectedId: number, amount: number): number {
    const infected = this.infected.find((candidate) => candidate.id === infectedId);
    return infected?.takeDamage(amount) ?? 0;
  }

  issueMoveOrder(officerId: number, destination: TilePosition): boolean {
    const officer = this.officers.find((candidate) => candidate.id === officerId);
    if (!officer || !this.worldGrid || this.paused || this.isMissionDefeated()) return false;
    const navigationGrid = this.buildingSystem?.getNavigationGrid('police') ?? this.worldGrid;
    return officer.issueMoveOrder(destination, navigationGrid, this.tileSize);
  }

  setOfficerAttacking(officerId: number, attacking: boolean): boolean {
    const officer = this.officers.find((candidate) => candidate.id === officerId);
    return officer ? officer.setAttacking(attacking) : false;
  }

  setOfficerTacticalPosture(officerId: number, posture: TacticalPosture): boolean {
    const officer = this.officers.find((candidate) => candidate.id === officerId);
    return officer ? officer.setTacticalPosture(posture) : false;
  }

  holdOfficerPosition(officerId: number): boolean {
    const officer = this.officers.find((candidate) => candidate.id === officerId);
    return officer ? officer.holdPosition() : false;
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
      const infectedGrid = this.buildingSystem?.getNavigationGrid('infected') ?? this.worldGrid;
      const policeGrid = this.buildingSystem?.getNavigationGrid('police') ?? this.worldGrid;
      if (this.noiseAttraction) {
        this.noiseAttraction.remaining -= dt;
        if (this.noiseAttraction.remaining <= 0) this.noiseAttraction = null;
      }
      for (const infected of this.infected) {
        const attraction = this.noiseAttraction;
        const attractedTarget = attraction && Math.hypot(
          infected.position.x - attraction.target.position.x,
          infected.position.y - attraction.target.position.y,
        ) <= attraction.radius ? attraction.target : undefined;
        infected.update(dt, this.tileSize, infectedGrid, this.officers, attractedTarget);
      }
      this.combatEvents.push(...this.combat.update(dt, this.officers, this.infected, policeGrid, this.tileSize));
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
