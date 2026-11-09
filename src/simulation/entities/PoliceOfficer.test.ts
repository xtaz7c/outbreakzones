import { describe, expect, it } from 'vitest';
import { PoliceOfficer } from './PoliceOfficer';
import { GridMap } from '../world/GridMap';

describe('PoliceOfficer', () => {
  it('initializes independent attributes and health', () => {
    const officer = new PoliceOfficer({ id: 1, x: 10, y: 20 });
    expect(officer.health).toBe(100);
    expect(officer.state).toBe('idle');
    expect(officer.position).toEqual({ x: 10, y: 20 });
    expect(officer.moveSpeed).toBeGreaterThan(0);
    expect(officer.attackRange).toBeGreaterThan(0);
    expect(officer.accuracy).toBeGreaterThanOrEqual(0);
    expect(officer.fireInterval).toBeGreaterThan(0);
  });

  it('validates identifiers and combat attributes', () => {
    expect(() => new PoliceOfficer({ id: 0, x: 1, y: 1 })).toThrow(RangeError);
    expect(() => new PoliceOfficer({ id: 1, x: 1, y: 1, accuracy: 1.1 })).toThrow(RangeError);
    expect(() => new PoliceOfficer({ id: 1, x: 1, y: 1, moveSpeed: 0 })).toThrow(RangeError);
  });

  it('moves along a path and returns to idle at its destination', () => {
    const officer = new PoliceOfficer({ id: 1, x: 16, y: 16, moveSpeed: 32 });
    const map = new GridMap(4, 4);
    expect(officer.issueMoveOrder({ column: 2, row: 0 }, map, 32)).toBe(true);
    expect(officer.state).toBe('moving');

    // São dois tiles de deslocamento (64 px) a 32 px/s.
    officer.update(2, 32);
    expect(officer.position).toEqual({ x: 80, y: 16 });
    expect(officer.state).toBe('idle');
  });

  it('does not accept a path through blocked cells', () => {
    const officer = new PoliceOfficer({ id: 1, x: 16, y: 16 });
    const map = new GridMap(3, 1);
    map.setBlocked({ column: 1, row: 0 });
    expect(officer.issueMoveOrder({ column: 2, row: 0 }, map, 32)).toBe(false);
    expect(officer.state).toBe('idle');
  });

  it('applies damage and incapacitates at zero health', () => {
    const officer = new PoliceOfficer({ id: 1, x: 16, y: 16 });
    expect(officer.takeDamage(35)).toBe(35);
    expect(officer.health).toBe(65);
    expect(officer.takeDamage(100)).toBe(65);
    expect(officer.health).toBe(0);
    expect(officer.state).toBe('incapacitated');
    expect(officer.isIncapacitated).toBe(true);
    expect(officer.takeDamage(10)).toBe(0);
  });

  it('cancels movement when incapacitated and rejects new orders', () => {
    const officer = new PoliceOfficer({ id: 1, x: 16, y: 16 });
    const map = new GridMap(5, 5);
    officer.issueMoveOrder({ column: 4, row: 4 }, map, 32);
    officer.takeDamage(100);
    officer.update(10, 32);
    expect(officer.position).toEqual({ x: 16, y: 16 });
    expect(officer.issueMoveOrder({ column: 1, row: 1 }, map, 32)).toBe(false);
  });

  it('supports the attacking state and clears it safely', () => {
    const officer = new PoliceOfficer({ id: 1, x: 16, y: 16 });
    expect(officer.setAttacking(true)).toBe(true);
    expect(officer.state).toBe('attacking');
    expect(officer.setAttacking(false)).toBe(true);
    expect(officer.state).toBe('idle');
    expect(officer.issueMoveOrder({ column: 2, row: 2 }, new GridMap(4, 4), 32)).toBe(true);
    expect(officer.state).toBe('moving');
  });
  it('can hold position and cancel an active movement order', () => {
    const officer = new PoliceOfficer({ id: 1, x: 16, y: 16, moveSpeed: 32 });
    const map = new GridMap(5, 5);
    expect(officer.issueMoveOrder({ column: 4, row: 4 }, map, 32)).toBe(true);
    expect(officer.holdPosition()).toBe(true);
    expect(officer.state).toBe('idle');
    officer.update(1, 32);
    expect(officer.position).toEqual({ x: 16, y: 16 });
  });

  it('supports engage and hold-fire tactical postures', () => {
    const officer = new PoliceOfficer({ id: 1, x: 16, y: 16 });
    expect(officer.tacticalPosture).toBe('engage');
    expect(officer.setTacticalPosture('hold_fire')).toBe(true);
    expect(officer.tacticalPosture).toBe('hold_fire');
    officer.takeDamage(100);
    expect(officer.setTacticalPosture('engage')).toBe(false);
  });

});


describe('PoliceOfficer dynamic navigation', () => {
  it('replans an active route when a previously blocked access opens', () => {
    const map = new GridMap(5, 3);
    for (let row = 0; row < 3; row += 1) map.setBlocked({ column: 2, row });
    const officer = new PoliceOfficer({ id: 1, x: 48, y: 48 });
    expect(officer.issueMoveOrder({ column: 4, row: 1 }, map, 32)).toBe(false);
    map.setBlocked({ column: 2, row: 1 }, false);
    expect(officer.issueMoveOrder({ column: 4, row: 1 }, map, 32)).toBe(true);
    map.setBlocked({ column: 2, row: 1 });
    expect(officer.replanMoveOrder(map, 32)).toBe(false);
    expect(officer.state).toBe('idle');
  });
});
