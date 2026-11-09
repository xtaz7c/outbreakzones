import { describe, expect, it } from 'vitest';
import { CombatSystem, hasLineOfSight } from './CombatSystem';
import { Infected } from './Infected';
import { PoliceOfficer } from './PoliceOfficer';
import { GridMap } from './world/GridMap';

describe('hasLineOfSight', () => {
  it('allows a clear ray between walkable cells', () => {
    const map = new GridMap(8, 8);
    expect(hasLineOfSight(map, { x: 16, y: 16 }, { x: 112, y: 16 }, 32)).toBe(true);
  });

  it('blocks a ray when an intermediate wall cell is blocked', () => {
    const map = new GridMap(8, 8);
    map.setBlocked({ column: 2, row: 0 });
    expect(hasLineOfSight(map, { x: 16, y: 16 }, { x: 112, y: 16 }, 32)).toBe(false);
  });

  it('does not treat the target cell itself as an intervening wall', () => {
    const map = new GridMap(8, 8);
    map.setBlocked({ column: 3, row: 0 });
    expect(hasLineOfSight(map, { x: 16, y: 16 }, { x: 112, y: 16 }, 32)).toBe(true);
  });

  it('rejects positions outside the map', () => {
    const map = new GridMap(8, 8);
    expect(hasLineOfSight(map, { x: -1, y: 16 }, { x: 112, y: 16 }, 32)).toBe(false);
  });
});

describe('CombatSystem', () => {
  const map = new GridMap(12, 8);

  it('automatically acquires the nearest visible infected and applies damage', () => {
    const officer = new PoliceOfficer({ id: 1, x: 16, y: 16, attackRange: 180, fireInterval: 0.5 });
    const far = new Infected({ id: 1, x: 120, y: 16, entryTile: { column: 3, row: 0 } });
    const near = new Infected({ id: 2, x: 80, y: 16, entryTile: { column: 2, row: 0 } });
    const combat = new CombatSystem({ random: () => 0, damagePerShot: 20 });

    const events = combat.update(0.5, [officer], [far, near], map, 32);
    expect(events).toHaveLength(1);
    expect(events[0]?.infectedId).toBe(2);
    expect(events[0]?.damage).toBe(20);
    expect(near.health).toBe(40);
    expect(far.health).toBe(60);
    expect(officer.state).toBe('attacking');
  });

  it('does not fire through a blocked intermediate cell', () => {
    const officer = new PoliceOfficer({ id: 1, x: 16, y: 16, attackRange: 180, fireInterval: 0.1 });
    const infected = new Infected({ id: 1, x: 112, y: 16, entryTile: { column: 3, row: 0 } });
    map.setBlocked({ column: 2, row: 0 });
    const combat = new CombatSystem({ random: () => 0 });
    expect(combat.update(1, [officer], [infected], map, 32)).toHaveLength(0);
    expect(infected.health).toBe(60);
    map.setBlocked({ column: 2, row: 0 }, false);
  });

  it('honors a player target priority over a nearer target', () => {
    const officer = new PoliceOfficer({ id: 1, x: 16, y: 16, attackRange: 180, fireInterval: 0.5 });
    const near = new Infected({ id: 1, x: 64, y: 16, entryTile: { column: 2, row: 0 } });
    const priority = new Infected({ id: 2, x: 112, y: 16, entryTile: { column: 3, row: 0 } });
    const combat = new CombatSystem({ random: () => 0 });
    combat.setTargetPriority(1, 2);
    const events = combat.update(0.5, [officer], [near, priority], map, 32);
    expect(events[0]?.infectedId).toBe(2);
    expect(priority.health).toBe(35);
    expect(near.health).toBe(60);
  });

  it('respects weapon range, fire cadence and accuracy', () => {
    const officer = new PoliceOfficer({
      id: 1, x: 16, y: 16, attackRange: 80, fireInterval: 1, accuracy: 0,
    });
    const infected = new Infected({ id: 1, x: 80, y: 16, entryTile: { column: 2, row: 0 } });
    const combat = new CombatSystem({ random: () => 0.5 });
    expect(combat.update(0.5, [officer], [infected], map, 32)).toHaveLength(0);
    const miss = combat.update(0.5, [officer], [infected], map, 32);
    expect(miss).toHaveLength(1);
    expect(miss[0]?.hit).toBe(false);
    expect(infected.health).toBe(60);
    const outOfRange = new Infected({ id: 2, x: 200, y: 16, entryTile: { column: 6, row: 0 } });
    expect(combat.update(2, [officer], [outOfRange], map, 32)).toHaveLength(0);
  });

  it('preserves an explicit movement order while an infected is nearby', () => {
    const officer = new PoliceOfficer({ id: 1, x: 16, y: 16, attackRange: 180 });
    const infected = new Infected({ id: 1, x: 64, y: 16, entryTile: { column: 2, row: 0 } });
    expect(officer.issueMoveOrder({ column: 2, row: 0 }, map, 32)).toBe(true);
    const combat = new CombatSystem({ random: () => 0 });
    expect(combat.update(0.5, [officer], [infected], map, 32)).toHaveLength(0);
    expect(officer.state).toBe('moving');
    expect(infected.health).toBe(60);
  });

  it('uses limited magazines and completes timed reloads', () => {
    const officer = new PoliceOfficer({
      id: 1, x: 16, y: 16, attackRange: 180, fireInterval: 0.1,
    });
    const infected = new Infected({ id: 1, x: 64, y: 16, entryTile: { column: 2, row: 0 } });
    const combat = new CombatSystem({
      random: () => 0,
      magazineSize: 1,
      reloadDuration: 1,
    });

    expect(combat.update(0.1, [officer], [infected], map, 32)).toHaveLength(1);
    expect(combat.getAmmoStatus(1)).toMatchObject({ current: 0, capacity: 1, reloading: false });

    combat.update(0.1, [officer], [infected], map, 32);
    expect(combat.getAmmoStatus(1).reloading).toBe(true);
    combat.update(0.5, [officer], [infected], map, 32);
    expect(combat.getAmmoStatus(1).current).toBe(0);
    combat.update(0.5, [officer], [infected], map, 32);
    expect(combat.getAmmoStatus(1)).toMatchObject({ current: 1, capacity: 1, reloading: false });
  });

  it('clears a priority when its target dies', () => {
    const officer = new PoliceOfficer({ id: 1, x: 16, y: 16 });
    const infected = new Infected({ id: 1, x: 64, y: 16, entryTile: { column: 2, row: 0 } });
    const combat = new CombatSystem();
    combat.setTargetPriority(1, 1);
    infected.takeDamage(100);
    combat.update(0.1, [officer], [infected], map, 32);
    expect(combat.getTargetPriority(1)).toBeNull();
  });
});
