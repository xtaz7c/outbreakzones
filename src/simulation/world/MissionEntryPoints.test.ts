import { describe, expect, it } from 'vitest';
import { GridMap } from './GridMap';
import { getAvailableEntryPoints, MISSION_ENTRY_POINTS } from './MissionEntryPoints';

describe('mission entry points', () => {
  it('defines approach cells for the front door and four exterior windows', () => {
    expect(MISSION_ENTRY_POINTS).toHaveLength(5);
    expect(MISSION_ENTRY_POINTS.filter((point) => point.kind === 'door')).toHaveLength(1);
    expect(MISSION_ENTRY_POINTS.filter((point) => point.kind === 'window')).toHaveLength(4);
  });

  it('returns only entry points with walkable approach cells', () => {
    const map = new GridMap(64, 40);
    map.setBlocked({ column: 32, row: 28 });
    const available = getAvailableEntryPoints(map);
    expect(available).toHaveLength(4);
    expect(available.some((point) => point.id === 'front-door')).toBe(false);
  });
});
