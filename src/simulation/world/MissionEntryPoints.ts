import type { GridMap } from './GridMap';
import type { TilePosition } from './WorldConfig';

export interface MissionEntryPoint {
  readonly id: string;
  readonly kind: 'door' | 'window';
  readonly approachTile: TilePosition;
  readonly structurePosition: { readonly x: number; readonly y: number };
}

/**
 * Approach cells are outside the blocked entrance rectangles in mission-01.tmj.
 * The map grid is checked at runtime so invalid/blocked approaches are excluded.
 */
export const MISSION_ENTRY_POINTS: readonly MissionEntryPoint[] = Object.freeze([
  {
    id: 'front-door',
    kind: 'door',
    approachTile: { column: 32, row: 28 },
    structurePosition: { x: 1024, y: 880 },
  },
  {
    id: 'north-window-west',
    kind: 'window',
    approachTile: { column: 27, row: 9 },
    structurePosition: { x: 864, y: 336 },
  },
  {
    id: 'north-window-east',
    kind: 'window',
    approachTile: { column: 36, row: 9 },
    structurePosition: { x: 1152, y: 336 },
  },
  {
    id: 'west-window',
    kind: 'window',
    approachTile: { column: 21, row: 18 },
    structurePosition: { x: 720, y: 576 },
  },
  {
    id: 'east-window',
    kind: 'window',
    approachTile: { column: 42, row: 18 },
    structurePosition: { x: 1328, y: 576 },
  },
]);

export function getAvailableEntryPoints(map: GridMap): MissionEntryPoint[] {
  return MISSION_ENTRY_POINTS.filter((point) => map.isWalkable(point.approachTile));
}
