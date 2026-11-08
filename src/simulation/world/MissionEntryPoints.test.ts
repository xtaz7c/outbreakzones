import { describe, expect, it } from 'vitest';
import { GridMap } from './GridMap';
import { getAvailableEntryPoints, MISSION_ENTRY_POINTS } from './MissionEntryPoints';

describe('mission entry points', () => {
  it('defines approach cells for the front door and four exterior windows', () => {
    expect(MISSION_ENTRY_POINTS).toHaveLength(5);
    expect(MISSION_ENTRY_POINTS.filter((point) => point.kind === 'door')).toHaveLength(1);
    expect(MISSION_ENTRY_POINTS.filter((point) => point.kind === 'window')).toHaveLength(4);
  });

  it('returns only entry points with walkable approach and interior cells', () => {
    const map = new GridMap(64, 40);
    map.setBlocked({ column: 32, row: 28 });
    const available = getAvailableEntryPoints(map);
    expect(available).toHaveLength(4);
    expect(available.some((point) => point.id === 'front-door')).toBe(false);
  });

  it('excludes an entrance whose interior approach cell is blocked', () => {
    const map = new GridMap(64, 40);
    map.setBlocked({ column: 27, row: 11 });
    const available = getAvailableEntryPoints(map);
    expect(available.some((point) => point.id === 'north-window-west')).toBe(false);
    expect(available).toHaveLength(4);
  });
});
