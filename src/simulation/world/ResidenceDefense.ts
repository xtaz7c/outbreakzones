import type { InfectedStructureTarget, InfectedPosition } from '../Infected';
import type { TilePosition } from './WorldConfig';
import { MISSION_ENTRY_POINTS } from './MissionEntryPoints';

export type EntranceKind = 'door' | 'window';
export type EntranceState = 'intact' | 'damaged' | 'breached';

export interface ResidenceEntranceConfig {
  readonly id: string;
  readonly kind: EntranceKind;
  readonly position: InfectedPosition;
  readonly structureTile: TilePosition;
  readonly approachTile: TilePosition;
  readonly interiorTile: TilePosition;
  readonly maxHealth: number;
}

/** Porta ou janela individual, com integridade independente. */
export class ResidenceEntrance implements InfectedStructureTarget {
  readonly id: string;
  readonly kind: EntranceKind;
  readonly position: InfectedPosition;
  readonly structureTile: TilePosition;
  readonly approachTile: TilePosition;
  readonly interiorTile: TilePosition;
  readonly maxHealth: number;

  private currentHealth: number;

  constructor(config: ResidenceEntranceConfig) {
    if (!config.id.trim()) throw new RangeError('Entrance id cannot be empty.');
    if (config.kind !== 'door' && config.kind !== 'window') {
      throw new RangeError('Entrance kind must be door or window.');
    }
    if (!Number.isFinite(config.maxHealth) || config.maxHealth <= 0) {
      throw new RangeError('Entrance maxHealth must be positive and finite.');
    }
    for (const [name, tile] of Object.entries({
      structureTile: config.structureTile,
      approachTile: config.approachTile,
      interiorTile: config.interiorTile,
    })) {
      if (!Number.isInteger(tile.column) || !Number.isInteger(tile.row)) {
        throw new RangeError(`${name} must contain integer grid coordinates.`);
      }
    }

    this.id = config.id;
    this.kind = config.kind;
    this.position = { ...config.position };
    this.structureTile = { ...config.structureTile };
    this.approachTile = { ...config.approachTile };
    this.interiorTile = { ...config.interiorTile };
    this.maxHealth = config.maxHealth;
    this.currentHealth = config.maxHealth;
  }

  get health(): number {
    return this.currentHealth;
  }

  get isDestroyed(): boolean {
    return this.currentHealth <= 0;
  }

  get state(): EntranceState {
    if (this.isDestroyed) return 'breached';
    return this.currentHealth < this.maxHealth ? 'damaged' : 'intact';
  }

  takeDamage(amount: number): number {
    if (this.isDestroyed || !Number.isFinite(amount) || amount <= 0) return 0;
    const applied = Math.min(amount, this.currentHealth);
    this.currentHealth = Math.max(0, this.currentHealth - applied);
    return applied;
  }
}

export interface ResidenceDefenseStatus {
  readonly state: 'secure' | 'damaged' | 'breached' | 'overrun';
  readonly health: number;
  readonly maxHealth: number;
  readonly breachedCount: number;
  readonly entranceCount: number;
  readonly isOverrun: boolean;
}

/**
 * Estado lógico da residência. A primeira entrada de um infectado no interior
 * caracteriza invasão e encerra a defesa (derrota no MVP).
 */
export class ResidenceDefense {
  private readonly entrances: ResidenceEntrance[];
  private overrun = false;

  constructor() {
    this.entrances = MISSION_ENTRY_POINTS.map((point) => new ResidenceEntrance({
      id: point.id,
      kind: point.kind,
      position: point.structurePosition,
      structureTile: point.structureTile,
      approachTile: point.approachTile,
      interiorTile: point.interiorTile,
      maxHealth: point.kind === 'door' ? 120 : 60,
    }));
  }

  getEntrances(): readonly ResidenceEntrance[] {
    return this.entrances;
  }

  getEntrance(id: string): ResidenceEntrance | undefined {
    return this.entrances.find((entrance) => entrance.id === id);
  }

  markOverrun(): void {
    this.overrun = true;
  }

  getStatus(): ResidenceDefenseStatus {
    const health = this.entrances.reduce((total, entrance) => total + entrance.health, 0);
    const maxHealth = this.entrances.reduce((total, entrance) => total + entrance.maxHealth, 0);
    const breachedCount = this.entrances.filter((entrance) => entrance.isDestroyed).length;
    const state = this.overrun
      ? 'overrun'
      : breachedCount > 0
        ? 'breached'
        : health < maxHealth
          ? 'damaged'
          : 'secure';

    return {
      state,
      health,
      maxHealth,
      breachedCount,
      entranceCount: this.entrances.length,
      isOverrun: this.overrun,
    };
  }
}
