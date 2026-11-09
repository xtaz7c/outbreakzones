import { GridMap } from './GridMap';
import type { TilePosition } from './WorldConfig';

export type AccessKind = 'door' | 'window' | 'garage';
export type AccessState = 'open' | 'closed' | 'locked' | 'barricaded' | 'broken';
export type ActorKind = 'police' | 'civil' | 'infected';
export interface AccessWeights {
  readonly open: number;
  readonly closed: number;
  readonly locked?: number;
  readonly barricaded?: number;
  readonly broken?: number;
}
export type AccessWeightConfig = Readonly<Record<AccessKind, AccessWeights>>;
export interface AccessDefinition {
  readonly id: string;
  readonly kind: AccessKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly maxHealth?: number;
  readonly weights?: AccessWeights;
}
export interface AccessPersistentState {
  readonly id: string;
  readonly state: AccessState;
  readonly health: number;
  readonly reinforcementLevel?: number;
  readonly barricadeLevel?: number;
  readonly lockLevel?: number;
}
export interface AccessSnapshot {
  readonly id: string;
  readonly kind: AccessKind;
  readonly state: AccessState;
  readonly health: number;
  readonly maxHealth: number;
  readonly reinforcementLevel: number;
  readonly barricadeLevel: number;
  readonly lockLevel: number;
  readonly cells: readonly TilePosition[];
}
const DEFAULT_WEIGHTS: AccessWeightConfig = {
  door: { open: 0.2, closed: 0.55, locked: 0.25 },
  window: { open: 0.15, closed: 0.45, barricaded: 0.25, broken: 0.15 },
  garage: { open: 0.1, closed: 0.65, locked: 0.25 },
};
function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function chooseState(kind: AccessKind, weights: AccessWeights, random: () => number): AccessState {
  const entries = Object.entries(weights).filter((entry): entry is [AccessState, number] =>
    Number.isFinite(entry[1]) && entry[1] >= 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) throw new RangeError(`Access weights for ${kind} must have a positive total.`);
  let roll = random() * total;
  for (const [state, weight] of entries) {
    roll -= weight;
    if (roll < 0) return state;
  }
  return entries[entries.length - 1]![0];
}
function toCells(definition: AccessDefinition, tileSize: number, grid: GridMap): TilePosition[] {
  if (![definition.x, definition.y, definition.width, definition.height].every(Number.isFinite) ||
      definition.width <= 0 || definition.height <= 0)
    throw new RangeError(`Access ${definition.id} must have finite coordinates and positive dimensions.`);
  const firstColumn = Math.max(0, Math.floor(definition.x / tileSize));
  const firstRow = Math.max(0, Math.floor(definition.y / tileSize));
  const lastColumn = Math.min(grid.columns - 1, Math.ceil((definition.x + definition.width) / tileSize) - 1);
  const lastRow = Math.min(grid.rows - 1, Math.ceil((definition.y + definition.height) / tileSize) - 1);
  const cells: TilePosition[] = [];
  for (let row = firstRow; row <= lastRow; row += 1)
    for (let column = firstColumn; column <= lastColumn; column += 1)
      if (grid.contains({ column, row })) cells.push({ column, row });
  return cells;
}
export class BuildingAccess {
  readonly id: string;
  readonly kind: AccessKind;
  private readonly baseMaxHealth: number;
  private currentMaxHealth: number;
  readonly cells: readonly TilePosition[];
  private currentHealth: number;
  private currentState: AccessState;
  private currentReinforcementLevel = 0;
  private currentBarricadeLevel = 0;
  private currentLockLevel = 0;
  constructor(definition: AccessDefinition, state: AccessState, cells: readonly TilePosition[]) {
    if (!definition.id.trim()) throw new RangeError('Access id cannot be empty.');
    this.id = definition.id;
    this.kind = definition.kind;
    this.baseMaxHealth = definition.maxHealth ?? (definition.kind === 'window' ? 60 : 120);
    if (!Number.isFinite(this.baseMaxHealth) || this.baseMaxHealth <= 0) throw new RangeError('Access maxHealth must be positive.');
    this.currentMaxHealth = this.baseMaxHealth;
    this.currentHealth = state === 'broken' ? 0 : this.currentMaxHealth;
    this.currentState = state;
    this.cells = cells.map((cell) => ({ ...cell }));
  }
  get state(): AccessState { return this.currentState; }
  get health(): number { return this.currentHealth; }
  get maxHealth(): number { return this.currentMaxHealth; }
  get reinforcementLevel(): number { return this.currentReinforcementLevel; }
  get barricadeLevel(): number { return this.currentBarricadeLevel; }
  get lockLevel(): number { return this.currentLockLevel; }
  get isPassable(): boolean { return this.currentState === 'open' || this.currentState === 'broken'; }
  get isDestroyed(): boolean { return this.currentState === 'broken'; }
  canTraverse(actor: ActorKind): boolean {
    if (!this.isPassable) return false;
    if (this.kind === 'window') return actor !== 'civil';
    return true;
  }
  interact(actor: ActorKind, hasKey = false): boolean {
    if (this.currentState === 'broken') return false;
    if (this.currentState === 'barricaded' && actor === 'police') return this.removeBarricade();
    if (this.isPassable) {
      this.currentState = 'closed';
      return true;
    }
    if (this.currentState === 'closed') {
      this.currentState = 'open';
      return true;
    }
    if (this.currentState === 'locked' && actor === 'police' && hasKey) {
      this.currentState = 'open';
      return true;
    }
    return false;
  }
  takeDamage(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0 || this.isDestroyed) return 0;
    const damageMultiplier = this.currentState === 'barricaded'
      ? 0.5
      : this.currentState === 'locked' ? 1 - this.currentLockLevel * 0.15 : 1;
    const applied = Math.min(amount * damageMultiplier, this.currentHealth);
    this.currentHealth -= applied;
    if (this.currentHealth === 0) {
      this.currentState = 'broken';
      this.currentBarricadeLevel = 0;
      this.currentLockLevel = 0;
    }
    return applied;
  }
  repair(maxAmount = Number.POSITIVE_INFINITY): number {
    if (!Number.isFinite(maxAmount) && maxAmount !== Number.POSITIVE_INFINITY || maxAmount <= 0) return 0;
    const missing = this.currentMaxHealth - this.currentHealth;
    const restored = Math.min(missing, maxAmount);
    if (restored <= 0) return 0;
    this.currentHealth += restored;
    if (this.currentState === 'broken') this.currentState = 'closed';
    return restored;
  }
  reinforce(): boolean {
    if (this.currentReinforcementLevel >= 2 || this.currentState === 'broken') return false;
    const increase = Math.ceil(this.currentMaxHealth * 0.2);
    this.currentMaxHealth += increase;
    this.currentHealth += increase;
    this.currentReinforcementLevel += 1;
    return true;
  }
  installBarricade(): boolean {
    if (this.currentBarricadeLevel >= 1 || this.currentState !== 'closed') return false;
    this.currentBarricadeLevel = 1;
    this.currentState = 'barricaded';
    return true;
  }
  upgradeLock(): boolean {
    if (this.currentLockLevel >= 2 || !['closed', 'locked'].includes(this.currentState)) return false;
    this.currentLockLevel += 1;
    this.currentState = 'locked';
    return true;
  }
  removeBarricade(): boolean {
    if (this.currentBarricadeLevel === 0 || this.currentState !== 'barricaded') return false;
    this.currentBarricadeLevel = 0;
    this.currentState = 'closed';
    return true;
  }
  restoreState(state: AccessState, health: number, upgrades?: {
    readonly reinforcementLevel?: number; readonly barricadeLevel?: number; readonly lockLevel?: number;
  }): void {
    const reinforcementLevel = upgrades?.reinforcementLevel ?? 0;
    const barricadeLevel = upgrades?.barricadeLevel ?? (state === 'barricaded' ? 1 : 0);
    const lockLevel = upgrades?.lockLevel ?? 0;
    if (!['open', 'closed', 'locked', 'barricaded', 'broken'].includes(state) ||
        !Number.isInteger(reinforcementLevel) || reinforcementLevel < 0 || reinforcementLevel > 2 ||
        !Number.isInteger(barricadeLevel) || barricadeLevel < 0 || barricadeLevel > 1 ||
        !Number.isInteger(lockLevel) || lockLevel < 0 || lockLevel > 2 ||
        ((health === 0) !== (state === 'broken')) ||
        ((state === 'barricaded') !== (barricadeLevel === 1))) {
      throw new RangeError(`Invalid persisted state for access ${this.id}.`);
    }
    let restoredMaxHealth = this.baseMaxHealth;
    for (let level = 0; level < reinforcementLevel; level += 1) {
      restoredMaxHealth += Math.ceil(restoredMaxHealth * 0.2);
    }
    if (!Number.isFinite(health) || health < 0 || health > restoredMaxHealth) {
      throw new RangeError(`Invalid persisted health for access ${this.id}.`);
    }
    this.currentReinforcementLevel = reinforcementLevel;
    this.currentBarricadeLevel = barricadeLevel;
    this.currentLockLevel = lockLevel;
    this.currentMaxHealth = restoredMaxHealth;
    this.currentState = state;
    this.currentHealth = health;
  }
  snapshot(): AccessSnapshot {
    return { id: this.id, kind: this.kind, state: this.currentState, health: this.currentHealth,
      maxHealth: this.maxHealth, reinforcementLevel: this.reinforcementLevel,
      barricadeLevel: this.barricadeLevel, lockLevel: this.lockLevel,
      cells: this.cells.map((cell) => ({ ...cell })) };
  }
}
export class BuildingSystem {
  readonly accesses: readonly BuildingAccess[];
  private readonly tileSize: number;
  private readonly byId = new Map<string, BuildingAccess>();
  private readonly baseGrid: GridMap;
  constructor(
    definitions: readonly AccessDefinition[], grid: GridMap, tileSize: number, seed: number,
    private readonly weights: AccessWeightConfig = DEFAULT_WEIGHTS,
  ) {
    if (!Number.isInteger(seed)) throw new RangeError('Building seed must be an integer.');
    if (!Number.isFinite(tileSize) || tileSize <= 0) throw new RangeError('Tile size must be positive.');
    this.baseGrid = grid.clone();
    this.tileSize = tileSize;
    const random = mulberry32(seed);
    this.accesses = definitions.map((definition) => {
      if (!['door', 'window', 'garage'].includes(definition.kind)) throw new RangeError('Unknown access kind.');
      const state = chooseState(definition.kind, definition.weights ?? this.weights[definition.kind], random);
      const access = new BuildingAccess(definition, state, toCells(definition, tileSize, grid));
      if (this.byId.has(access.id)) throw new RangeError(`Duplicate access id: ${access.id}`);
      this.byId.set(access.id, access);
      return access;
    });
  }
  getAccess(id: string): BuildingAccess | undefined { return this.byId.get(id); }
  getSnapshots(): AccessSnapshot[] { return this.accesses.map((access) => access.snapshot()); }
  exportState(): AccessPersistentState[] {
    return this.accesses.map((access) => ({
      id: access.id,
      state: access.state,
      health: access.health,
      reinforcementLevel: access.reinforcementLevel,
      barricadeLevel: access.barricadeLevel,
      lockLevel: access.lockLevel,
    }));
  }
  restoreState(states: readonly AccessPersistentState[]): void {
    if (states.length !== this.accesses.length) {
      throw new RangeError('Persisted building state does not match the current map.');
    }
    const byId = new Map<string, AccessPersistentState>();
    for (const state of states) {
      if (!state.id || byId.has(state.id)) throw new RangeError('Persisted building state contains invalid or duplicate ids.');
      byId.set(state.id, state);
    }
    for (const access of this.accesses) {
      const saved = byId.get(access.id);
      if (!saved) throw new RangeError(`Persisted state is missing access ${access.id}.`);
      const reinforcementLevel = saved.reinforcementLevel ?? 0;
      const barricadeLevel = saved.barricadeLevel ?? (saved.state === 'barricaded' ? 1 : 0);
      const lockLevel = saved.lockLevel ?? 0;
      let maximumHealth = access.maxHealth;
      if (Number.isInteger(reinforcementLevel) && reinforcementLevel >= 0 && reinforcementLevel <= 2) {
        for (let level = 0; level < reinforcementLevel; level += 1) {
          maximumHealth += Math.ceil(maximumHealth * 0.2);
        }
      }
      const legacyBrokenHealth = saved.state === 'broken' &&
        saved.reinforcementLevel === undefined && saved.barricadeLevel === undefined &&
        saved.lockLevel === undefined && saved.health === access.maxHealth;
      const normalizedHealth = legacyBrokenHealth ? 0 : saved.health;
      if (!['open', 'closed', 'locked', 'barricaded', 'broken'].includes(saved.state) ||
          !Number.isFinite(normalizedHealth) || normalizedHealth < 0 || normalizedHealth > maximumHealth ||
          !Number.isInteger(reinforcementLevel) || reinforcementLevel < 0 || reinforcementLevel > 2 ||
          !Number.isInteger(barricadeLevel) || barricadeLevel < 0 || barricadeLevel > 1 ||
          !Number.isInteger(lockLevel) || lockLevel < 0 || lockLevel > 2 ||
          ((saved.state === 'barricaded') !== (barricadeLevel === 1)) ||
          ((normalizedHealth === 0) !== (saved.state === 'broken'))) {
        throw new RangeError(`Invalid persisted state for access ${access.id}.`);
      }
    }
    for (const access of this.accesses) {
      const saved = byId.get(access.id)!;
      const legacyBrokenHealth = saved.state === 'broken' &&
        saved.reinforcementLevel === undefined && saved.barricadeLevel === undefined &&
        saved.lockLevel === undefined && saved.health === access.maxHealth;
      access.restoreState(saved.state, legacyBrokenHealth ? 0 : saved.health, saved);
    }
  }
  getNavigationGrid(actor: ActorKind): GridMap {
    const grid = this.baseGrid.clone();
    for (const access of this.accesses) {
      const blocked = !access.canTraverse(actor);
      for (const cell of access.cells) grid.setBlocked(cell, blocked);
    }
    return grid;
  }
  interact(id: string, actor: ActorKind, hasKey = false): boolean {
    return this.byId.get(id)?.interact(actor, hasKey) ?? false;
  }
  damage(id: string, amount: number): number {
    return this.byId.get(id)?.takeDamage(amount) ?? 0;
  }
  getInfectedTarget(id: string, approachTile: TilePosition, breachTile?: TilePosition): {
    readonly position: { readonly x: number; readonly y: number };
    readonly approachTile: TilePosition;
    readonly breachTile?: TilePosition;
    readonly isPassable: boolean;
    readonly isDestroyed: boolean;
    takeDamage(amount: number): number;
  } | undefined {
    const access = this.byId.get(id);
    if (!access) return undefined;
    if (access.cells.length === 0) return undefined;
    const approachX = approachTile.column * this.tileSize + this.tileSize / 2;
    const approachY = approachTile.row * this.tileSize + this.tileSize / 2;
    const cell = access.cells.reduce((nearest, candidate) => {
      const candidateDistance = Math.hypot(
        candidate.column * this.tileSize + this.tileSize / 2 - approachX,
        candidate.row * this.tileSize + this.tileSize / 2 - approachY,
      );
      const nearestDistance = Math.hypot(
        nearest.column * this.tileSize + this.tileSize / 2 - approachX,
        nearest.row * this.tileSize + this.tileSize / 2 - approachY,
      );
      return candidateDistance < nearestDistance ? candidate : nearest;
    });
    return {
      position: { x: cell.column * this.tileSize + this.tileSize / 2, y: cell.row * this.tileSize + this.tileSize / 2 },
      approachTile,
      ...(breachTile ? { breachTile } : {}),
      get isPassable() { return access.isPassable; },
      get isDestroyed() { return access.isDestroyed; },
      takeDamage: (amount) => access.takeDamage(amount),
    };
  }
}
export const DEFAULT_ACCESS_WEIGHTS = DEFAULT_WEIGHTS;
