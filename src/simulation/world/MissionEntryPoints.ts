import type { GridMap } from './GridMap';
import type { TilePosition } from './WorldConfig';

export interface MissionEntryPoint {
  readonly id: string;
  readonly kind: 'door' | 'window';
  /** Walkable cell outside the structure. */
  readonly approachTile: TilePosition;
  /** Blocked cell occupied by the door/window in the collision grid. */
  readonly structureTile: TilePosition;
  /** Walkable cell just inside the residence. */
  readonly interiorTile: TilePosition;
  readonly structurePosition: { readonly x: number; readonly y: number };
}

/**
 * Entrance geometry is explicit so a breached entrance can be opened in the
 * navigation grid and infected can path through it into the house.
 */
export const MISSION_ENTRY_POINTS: readonly MissionEntryPoint[] = Object.freeze([
  {
    id: 'front-door',
    kind: 'door',
    approachTile: { column: 32, row: 28 },
    structureTile: { column: 32, row: 27 },
    interiorTile: { column: 32, row: 26 },
    structurePosition: { x: 1024, y: 880 },
  },
  {
    id: 'north-window-west',
    kind: 'window',
    approachTile: { column: 27, row: 9 },
    structureTile: { column: 27, row: 10 },
    interiorTile: { column: 27, row: 11 },
    structurePosition: { x: 864, y: 336 },
  },
  {
    id: 'north-window-east',
    kind: 'window',
    approachTile: { column: 36, row: 9 },
    structureTile: { column: 36, row: 10 },
    interiorTile: { column: 36, row: 11 },
    structurePosition: { x: 1152, y: 336 },
  },
  {
    id: 'west-window',
    kind: 'window',
    approachTile: { column: 21, row: 18 },
    structureTile: { column: 22, row: 18 },
    interiorTile: { column: 23, row: 18 },
    structurePosition: { x: 720, y: 576 },
  },
  {
    id: 'east-window',
    kind: 'window',
    approachTile: { column: 42, row: 18 },
    structureTile: { column: 41, row: 18 },
    interiorTile: { column: 40, row: 18 },
    structurePosition: { x: 1328, y: 576 },
  },
]);

export function getAvailableEntryPoints(map: GridMap): MissionEntryPoint[] {
  return MISSION_ENTRY_POINTS.filter(
    (point) => map.isWalkable(point.approachTile) && map.isWalkable(point.interiorTile),
  );
}
