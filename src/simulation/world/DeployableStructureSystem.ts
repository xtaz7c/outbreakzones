import type { Infected } from '../Infected';
import { hasLineOfSight } from '../CombatSystem';
import type { GridMap } from './GridMap';
import type { TilePosition } from './WorldConfig';

export type DeployableKind = 'shelter-tent' | 'resource-tent' | 'sniper-post' | 'barricade';

export interface DeployableCost {
  readonly scrap: number;
  readonly parts: number;
}

export interface DeployableResources {
  readonly scrap: number;
  readonly parts: number;
}

export interface DeployableSnapshot {
  readonly id: number;
  readonly kind: DeployableKind;
  readonly tile: TilePosition;
  readonly position: { readonly x: number; readonly y: number };
  readonly health: number;
  readonly maxHealth: number;
  readonly isDestroyed: boolean;
  readonly capacity: number;
}

export interface DeployableRecord {
  readonly id: number;
  readonly kind: DeployableKind;
  readonly tile: TilePosition;
  readonly health: number;
  readonly destroyed: boolean;
}

export interface DeployableState {
  readonly resources: DeployableResources;
  readonly structures: readonly DeployableRecord[];
  readonly nextId: number;
}

export interface DeployableEvent {
  readonly kind: 'sniper-shot' | 'barricade-hit';
  readonly deployableId: number;
  readonly infectedId: number;
  readonly damage: number;
}

interface DeployableDefinition {
  readonly cost: DeployableCost;
  readonly health: number;
  readonly capacity: number;
  readonly range: number;
  readonly damage: number;
  readonly interval: number;
}

const DEFINITIONS: Readonly<Record<DeployableKind, DeployableDefinition>> = {
  'shelter-tent': {
    cost: { scrap: 30, parts: 8 }, health: 120, capacity: 2,
    range: 0, damage: 0, interval: 0,
  },
  'resource-tent': {
    cost: { scrap: 20, parts: 5 }, health: 90, capacity: 0,
    range: 0, damage: 0, interval: 30,
  },
  'sniper-post': {
    cost: { scrap: 45, parts: 20 }, health: 140, capacity: 0,
    range: 280, damage: 20, interval: 1.25,
  },
  barricade: {
    cost: { scrap: 12, parts: 3 }, health: 180, capacity: 0,
    range: 0, damage: 0, interval: 0,
  },
};

interface MutableDeployable {
  id: number;
  kind: DeployableKind;
  tile: TilePosition;
  health: number;
  productionTimer: number;
  cooldown: number;
  destroyed: boolean;
}

/** Domain system for paid, persistent field structures. It has no Phaser dependency. */
export class DeployableStructureSystem {
  private scrap: number;
  private parts: number;
  private nextId = 1;
  private readonly structures: MutableDeployable[] = [];
  private readonly barricadeTimers = new Map<string, number>();
  private cachedNavigationGrid: GridMap | null = null;
  private cachedBaseGrid: GridMap | null = null;

  constructor(
    private readonly worldGrid: GridMap,
    private readonly tileSize: number,
    initialResources: DeployableResources = { scrap: 90, parts: 36 },
  ) {
    if (!Number.isFinite(tileSize) || tileSize <= 0) throw new RangeError('Tile size must be positive.');
    if (!Number.isInteger(initialResources.scrap) || initialResources.scrap < 0 ||
        !Number.isInteger(initialResources.parts) || initialResources.parts < 0) {
      throw new RangeError('Deployable resources must be non-negative integers.');
    }
    this.scrap = initialResources.scrap;
    this.parts = initialResources.parts;
  }

  getResources(): DeployableResources {
    return { scrap: this.scrap, parts: this.parts };
  }

  getShelterCapacity(): number {
    return this.structures.reduce((total, structure) =>
      total + (!structure.destroyed && structure.kind === 'shelter-tent' ? DEFINITIONS['shelter-tent'].capacity : 0), 0);
  }

  getSnapshots(): DeployableSnapshot[] {
    return this.structures.map((structure) => this.snapshot(structure));
  }

  place(kind: DeployableKind, tile: TilePosition): DeployableSnapshot | null {
    const definition = DEFINITIONS[kind];
    if (!definition || !this.worldGrid.isWalkable(tile) ||
        this.structures.some((structure) => !structure.destroyed &&
          structure.tile.column === tile.column && structure.tile.row === tile.row) ||
        this.scrap < definition.cost.scrap || this.parts < definition.cost.parts) {
      return null;
    }

    this.scrap -= definition.cost.scrap;
    this.parts -= definition.cost.parts;
    const structure: MutableDeployable = {
      id: this.nextId++,
      kind,
      tile: { ...tile },
      health: definition.health,
      productionTimer: definition.interval,
      cooldown: definition.interval,
      destroyed: false,
    };
    this.structures.push(structure);
    this.cachedNavigationGrid = null;
    return this.snapshot(structure);
  }

  damage(id: number, amount: number): number {
    const structure = this.structures.find((candidate) => candidate.id === id && !candidate.destroyed);
    if (!structure || !Number.isFinite(amount) || amount <= 0) return 0;
    const applied = Math.min(structure.health, amount);
    structure.health = Math.max(0, structure.health - applied);
    if (structure.health === 0) {
      structure.destroyed = true;
      this.cachedNavigationGrid = null;
    }
    return applied;
  }

  dismantle(id: number): boolean {
    const index = this.structures.findIndex((candidate) => candidate.id === id);
    if (index < 0) return false;
    const structure = this.structures[index]!;
    if (!structure.destroyed) {
      const cost = DEFINITIONS[structure.kind].cost;
      this.scrap += Math.floor(cost.scrap * 0.5);
      this.parts += Math.floor(cost.parts * 0.5);
    }
    this.structures.splice(index, 1);
    this.cachedNavigationGrid = null;
    return true;
  }

  getInfectedNavigationGrid(baseGrid: GridMap = this.worldGrid): GridMap {
    if (this.cachedNavigationGrid && this.cachedBaseGrid === baseGrid) return this.cachedNavigationGrid;
    const navigation = baseGrid.clone();
    for (const structure of this.structures) {
      if (!structure.destroyed && structure.kind === 'barricade') {
        navigation.setBlocked(structure.tile, true);
      }
    }
    this.cachedBaseGrid = baseGrid;
    this.cachedNavigationGrid = navigation;
    return navigation;
  }

  update(dt: number, infected: readonly Infected[]): readonly DeployableEvent[] {
    if (!Number.isFinite(dt) || dt <= 0) return [];
    const events: DeployableEvent[] = [];

    for (const structure of this.structures) {
      if (structure.destroyed) continue;
      const definition = DEFINITIONS[structure.kind];
      if (structure.kind === 'resource-tent') {
        structure.productionTimer -= dt;
        while (structure.productionTimer <= 0) {
          this.scrap += 2;
          structure.productionTimer += definition.interval;
        }
      }

      if (structure.kind === 'sniper-post') {
        structure.cooldown = Math.max(0, structure.cooldown - dt);
        if (structure.cooldown > 0) continue;
        const origin = this.position(structure.tile);
        const target = infected
          .filter((candidate) => !candidate.isDead &&
            Math.hypot(candidate.position.x - origin.x, candidate.position.y - origin.y) <= definition.range &&
            hasLineOfSight(this.worldGrid, origin, candidate.position, this.tileSize))
          .sort((a, b) =>
            Math.hypot(a.position.x - origin.x, a.position.y - origin.y) -
            Math.hypot(b.position.x - origin.x, b.position.y - origin.y))[0];
        if (target) {
          const damage = target.takeDamage(definition.damage);
          if (damage > 0) events.push({ kind: 'sniper-shot', deployableId: structure.id, infectedId: target.id, damage });
          structure.cooldown = definition.interval;
        }
      }
    }

    for (const zombie of infected) {
      if (zombie.isDead) continue;
      for (const barricade of this.structures) {
        if (barricade.destroyed || barricade.kind !== 'barricade') continue;
        const point = this.position(barricade.tile);
        const distance = Math.hypot(zombie.position.x - point.x, zombie.position.y - point.y);
        const timerKey = `${zombie.id}:${barricade.id}`;
        if (distance > this.tileSize * 1.5) {
          this.barricadeTimers.delete(timerKey);
          continue;
        }
        const timer = (this.barricadeTimers.get(timerKey) ?? 0) + dt;
        if (timer >= zombie.attackInterval) {
          const damage = this.damage(barricade.id, zombie.damage);
          if (damage > 0) events.push({
            kind: 'barricade-hit', deployableId: barricade.id, infectedId: zombie.id, damage,
          });
          this.barricadeTimers.set(timerKey, timer - zombie.attackInterval);
        } else {
          this.barricadeTimers.set(timerKey, timer);
        }
      }
    }

    return events;
  }

  exportState(): DeployableState {
    return {
      resources: this.getResources(),
      structures: this.structures.map(({ id, kind, tile, health, destroyed }) => ({
        id, kind, tile: { ...tile }, health, destroyed,
      })),
      nextId: this.nextId,
    };
  }

  restoreState(state: DeployableState): void {
    if (!state || !state.resources ||
        !Number.isInteger(state.resources.scrap) || state.resources.scrap < 0 ||
        !Number.isInteger(state.resources.parts) || state.resources.parts < 0 ||
        !Array.isArray(state.structures) || !Number.isInteger(state.nextId) || state.nextId <= 0) {
      throw new RangeError('Invalid persisted deployable state.');
    }
    const ids = new Set<number>();
    const occupied = new Set<string>();
    const restored: MutableDeployable[] = [];
    let maxId = 0;
    const records = state.structures as readonly DeployableRecord[];
    for (const record of records) {
      const definition = DEFINITIONS[record.kind];
      const key = `${record.tile?.column}:${record.tile?.row}`;
      if (!definition || !Number.isInteger(record.id) || record.id <= 0 || ids.has(record.id) ||
          !this.worldGrid.isWalkable(record.tile) || occupied.has(key) ||
          !Number.isFinite(record.health) || record.health < 0 || record.health > definition.health ||
          (record.health === 0) !== record.destroyed) {
        throw new RangeError('Invalid persisted deployable structure.');
      }
      ids.add(record.id);
      occupied.add(key);
      maxId = Math.max(maxId, record.id);
      restored.push({
        id: record.id, kind: record.kind, tile: { ...record.tile }, health: record.health,
        productionTimer: definition.interval, cooldown: definition.interval, destroyed: record.destroyed,
      });
    }
    if (state.nextId <= maxId) throw new RangeError('Persisted deployable nextId must exceed all structure ids.');
    this.scrap = state.resources.scrap;
    this.parts = state.resources.parts;
    this.nextId = state.nextId;
    this.structures.splice(0, this.structures.length, ...restored);
    this.barricadeTimers.clear();
    this.cachedNavigationGrid = null;
  }

  private snapshot(structure: MutableDeployable): DeployableSnapshot {
    const definition = DEFINITIONS[structure.kind];
    return {
      id: structure.id,
      kind: structure.kind,
      tile: { ...structure.tile },
      position: this.position(structure.tile),
      health: structure.health,
      maxHealth: definition.health,
      isDestroyed: structure.destroyed,
      capacity: definition.capacity,
    };
  }

  private position(tile: TilePosition): { x: number; y: number } {
    return {
      x: tile.column * this.tileSize + this.tileSize / 2,
      y: tile.row * this.tileSize + this.tileSize / 2,
    };
  }
}
