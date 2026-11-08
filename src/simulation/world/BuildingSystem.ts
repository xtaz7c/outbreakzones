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
export interface AccessSnapshot {
  readonly id: string;
  readonly kind: AccessKind;
  readonly state: AccessState;
  readonly health: number;
  readonly maxHealth: number;
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
  readonly maxHealth: number;
  readonly cells: readonly TilePosition[];
  private currentHealth: number;
  private currentState: AccessState;
  constructor(definition: AccessDefinition, state: AccessState, cells: readonly TilePosition[]) {
    if (!definition.id.trim()) throw new RangeError('Access id cannot be empty.');
    this.id = definition.id;
    this.kind = definition.kind;
    this.maxHealth = definition.maxHealth ?? (definition.kind === 'window' ? 60 : 120);
    if (!Number.isFinite(this.maxHealth) || this.maxHealth <= 0) throw new RangeError('Access maxHealth must be positive.');
    this.currentHealth = this.maxHealth;
    this.currentState = state;
    this.cells = cells.map((cell) => ({ ...cell }));
  }
  get state(): AccessState { return this.currentState; }
  get health(): number { return this.currentHealth; }
  get isPassable(): boolean { return this.currentState === 'open' || this.currentState === 'broken'; }
  get isDestroyed(): boolean { return this.currentState === 'broken'; }
  canTraverse(actor: ActorKind): boolean {
    if (!this.isPassable) return false;
    if (this.kind === 'window') return actor !== 'civil';
    return true;
  }
  interact(actor: ActorKind, hasKey = false): boolean {
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
    const applied = Math.min(amount, this.currentHealth);
    this.currentHealth -= applied;
    if (this.currentHealth === 0) this.currentState = 'broken';
    return applied;
  }
  snapshot(): AccessSnapshot {
    return { id: this.id, kind: this.kind, state: this.currentState, health: this.currentHealth,
      maxHealth: this.maxHealth, cells: this.cells.map((cell) => ({ ...cell })) };
  }
}
export class BuildingSystem {
  readonly accesses: readonly BuildingAccess[];
  private readonly byId = new Map<string, BuildingAccess>();
  private readonly baseGrid: GridMap;
  constructor(
    definitions: readonly AccessDefinition[], grid: GridMap, tileSize: number, seed: number,
    private readonly weights: AccessWeightConfig = DEFAULT_WEIGHTS,
  ) {
    if (!Number.isInteger(seed)) throw new RangeError('Building seed must be an integer.');
    if (!Number.isFinite(tileSize) || tileSize <= 0) throw new RangeError('Tile size must be positive.');
    this.baseGrid = grid.clone();
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
  getNavigationGrid(actor: ActorKind): GridMap {
    const grid = this.baseGrid.clone();
    for (const access of this.accesses)
      if (!access.canTraverse(actor))
        for (const cell of access.cells) grid.setBlocked(cell);
    return grid;
  }
  interact(id: string, actor: ActorKind, hasKey = false): boolean {
    return this.byId.get(id)?.interact(actor, hasKey) ?? false;
  }
  damage(id: string, amount: number): number {
    return this.byId.get(id)?.takeDamage(amount) ?? 0;
  }
  getInfectedTarget(id: string, approachTile: TilePosition): {
    readonly position: { readonly x: number; readonly y: number };
    readonly approachTile: TilePosition;
    readonly isDestroyed: boolean;
    takeDamage(amount: number): number;
  } | undefined {
    const access = this.byId.get(id);
    if (!access) return undefined;
    const cell = access.cells[0];
    if (!cell) return undefined;
    return {
      position: { x: cell.column * 32 + 16, y: cell.row * 32 + 16 },
      approachTile,
      get isDestroyed() { return access.isDestroyed; },
      takeDamage: (amount) => access.takeDamage(amount),
    };
  }
}
export const DEFAULT_ACCESS_WEIGHTS = DEFAULT_WEIGHTS;
