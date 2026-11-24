import type { TilePosition } from '../../world/WorldConfig';
import { GridMap } from '../../world/GridMap';

export interface PathOptions {
  /** Permite movimentos diagonais. Padrão: true. */
  allowDiagonal?: boolean;
}

interface QueueNode {
  readonly index: number;
  readonly score: number;
}

/** Min-heap binário para retirar o nó de menor custo sem ordenar toda a fila. */
class MinHeap {
  private readonly values: QueueNode[] = [];

  get size(): number {
    return this.values.length;
  }

  push(value: QueueNode): void {
    this.values.push(value);
    let index = this.values.length - 1;

    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent]!.score <= value.score) break;
      this.values[index] = this.values[parent]!;
      index = parent;
    }

    this.values[index] = value;
  }

  pop(): QueueNode | undefined {
    const first = this.values[0];
    const last = this.values.pop();
    if (!first || !last || this.values.length === 0) return first;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;

      let child = left;
      if (
        right < this.values.length &&
        this.values[right]!.score < this.values[left]!.score
      ) {
        child = right;
      }
      if (this.values[child]!.score >= last.score) break;

      this.values[index] = this.values[child]!;
      index = child;
    }

    this.values[index] = last;
    return first;
  }
}

const CARDINAL_DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

const DIAGONAL_DIRECTIONS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;

function heuristic(a: TilePosition, b: TilePosition, diagonal: boolean): number {
  const dx = Math.abs(a.column - b.column);
  const dy = Math.abs(a.row - b.row);

  if (!diagonal) return dx + dy;
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function toIndex(position: TilePosition, columns: number): number {
  return position.row * columns + position.column;
}

function toPosition(index: number, columns: number): TilePosition {
  return { column: index % columns, row: Math.floor(index / columns) };
}

interface PathfindingWorkspace {
  readonly costs: Float64Array;
  readonly parents: Int32Array;
  readonly closed: Uint8Array;
}

// A* calls are synchronous; one workspace per map avoids reallocating grid-sized
// buffers for every civilian route while keeping different maps isolated.
const workspaces = new WeakMap<GridMap, PathfindingWorkspace>();

function getWorkspace(map: GridMap, total: number): PathfindingWorkspace {
  let workspace = workspaces.get(map);
  if (!workspace || workspace.costs.length !== total) {
    workspace = {
      costs: new Float64Array(total),
      parents: new Int32Array(total),
      closed: new Uint8Array(total),
    };
    workspaces.set(map, workspace);
  }
  workspace.costs.fill(Number.POSITIVE_INFINITY);
  workspace.parents.fill(-1);
  workspace.closed.fill(0);
  return workspace;
}

/**
 * A* em grade. Retorna células do próximo passo até o destino, sem incluir
 * a origem. Retorna null se origem/destino forem inválidos ou não houver rota.
 */
export function findPath(
  map: GridMap,
  start: TilePosition,
  goal: TilePosition,
  options: PathOptions = {},
): TilePosition[] | null {
  const diagonal = options.allowDiagonal ?? true;

  if (!map.isWalkable(start) || !map.isWalkable(goal)) return null;
  if (start.column === goal.column && start.row === goal.row) return [];

  const total = map.columns * map.rows;
  const startIndex = toIndex(start, map.columns);
  const goalIndex = toIndex(goal, map.columns);
  const workspace = getWorkspace(map, total);
  const { costs, parents, closed } = workspace;
  costs[startIndex] = 0;
  const queue = new MinHeap();
  queue.push({ index: startIndex, score: heuristic(start, goal, diagonal) });

  const directions: readonly (readonly [number, number])[] = diagonal
    ? [...CARDINAL_DIRECTIONS, ...DIAGONAL_DIRECTIONS]
    : CARDINAL_DIRECTIONS;

  while (queue.size > 0) {
    const currentNode = queue.pop()!;
    const currentIndex = currentNode.index;
    if (closed[currentIndex]) continue;
    if (currentIndex === goalIndex) break;

    closed[currentIndex] = 1;
    const current = toPosition(currentIndex, map.columns);

    for (const [dx, dy] of directions) {
      const next = { column: current.column + dx, row: current.row + dy };
      if (!map.isWalkable(next)) continue;

      const isDiagonal = dx !== 0 && dy !== 0;
      if (isDiagonal) {
        // Não permite atravessar o canto entre dois obstáculos sólidos.
        if (
          !map.isWalkable({ column: current.column + dx, row: current.row }) ||
          !map.isWalkable({ column: current.column, row: current.row + dy })
        ) {
          continue;
        }
      }

      const nextIndex = toIndex(next, map.columns);
      if (closed[nextIndex]) continue;

      const candidate = costs[currentIndex]! + (isDiagonal ? Math.SQRT2 : 1);
      if (candidate >= costs[nextIndex]!) continue;

      costs[nextIndex] = candidate;
      parents[nextIndex] = currentIndex;
      queue.push({
        index: nextIndex,
        score: candidate + heuristic(next, goal, diagonal),
      });
    }
  }

  if (parents[goalIndex] === -1) return null;

  const path: TilePosition[] = [];
  let cursor = goalIndex;
  while (cursor !== startIndex) {
    path.push(toPosition(cursor, map.columns));
    cursor = parents[cursor]!;
    if (cursor < 0) return null;
  }

  path.reverse();
  return path;
}


/**
 * Returns linear tile indices (row * map.columns + column) reachable from start.
 * Uses the same diagonal and corner-blocking rules as findPath.
 * When targets are provided, traversal stops as soon as all walkable targets are found.
 */
export function findReachableTiles(
  map: GridMap,
  start: TilePosition,
  options: PathOptions = {},
  targets?: readonly TilePosition[],
): ReadonlySet<number> {
  const reachable = new Set<number>();
  if (!map.isWalkable(start)) return reachable;

  const diagonal = options.allowDiagonal ?? true;
  const directions: readonly (readonly [number, number])[] = diagonal
    ? [...CARDINAL_DIRECTIONS, ...DIAGONAL_DIRECTIONS]
    : CARDINAL_DIRECTIONS;
  const queue: number[] = [];
  const startIndex = toIndex(start, map.columns);
  const pendingTargets = targets === undefined
    ? null
    : new Set(targets.filter((target) => map.isWalkable(target)).map((target) => toIndex(target, map.columns)));
  let head = 0;

  reachable.add(startIndex);
  queue.push(startIndex);
  pendingTargets?.delete(startIndex);

  while (head < queue.length && (pendingTargets === null || pendingTargets.size > 0)) {
    const currentIndex = queue[head++]!;
    const current = toPosition(currentIndex, map.columns);

    for (const [dx, dy] of directions) {
      const next = { column: current.column + dx, row: current.row + dy };
      if (!map.isWalkable(next)) continue;

      const isDiagonal = dx !== 0 && dy !== 0;
      if (isDiagonal && (
        !map.isWalkable({ column: current.column + dx, row: current.row }) ||
        !map.isWalkable({ column: current.column, row: current.row + dy })
      )) {
        continue;
      }

      const nextIndex = toIndex(next, map.columns);
      if (reachable.has(nextIndex)) continue;

      reachable.add(nextIndex);
      pendingTargets?.delete(nextIndex);
      queue.push(nextIndex);
    }
  }

  return reachable;
}
