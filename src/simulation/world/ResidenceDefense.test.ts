import { describe, expect, it } from 'vitest';
import { ResidenceDefense } from './ResidenceDefense';

describe('ResidenceDefense', () => {
  it('creates five independent vulnerable entrances', () => {
    const residence = new ResidenceDefense();
    expect(residence.getEntrances()).toHaveLength(5);
    expect(residence.getEntrance('front-door')?.maxHealth).toBe(120);
    expect(residence.getEntrance('west-window')?.maxHealth).toBe(60);
    expect(residence.getStatus().state).toBe('secure');
  });

  it('tracks damage independently for each entrance', () => {
    const residence = new ResidenceDefense();
    const door = residence.getEntrance('front-door')!;
    const window = residence.getEntrance('west-window')!;

    expect(door.takeDamage(40)).toBe(40);
    expect(door.health).toBe(140);
    expect(door.state).toBe('damaged');
    expect(window.health).toBe(90);
    expect(residence.getStatus().state).toBe('damaged');
  });

  it('marks an entrance as breached when its integrity reaches zero', () => {
    const residence = new ResidenceDefense();
    const window = residence.getEntrance('west-window')!;

    expect(window.takeDamage(200)).toBe(90);
    expect(window.health).toBe(0);
    expect(window.isDestroyed).toBe(true);
    expect(window.state).toBe('breached');
    expect(window.takeDamage(10)).toBe(0);
    expect(residence.getStatus().breachedCount).toBe(1);
    expect(residence.getStatus().state).toBe('breached');
  });

  it('marks the residence as overrun after an infected enters', () => {
    const residence = new ResidenceDefense();
    residence.markOverrun();

    expect(residence.getStatus().isOverrun).toBe(true);
    expect(residence.getStatus().state).toBe('overrun');
  });

  it('ignores invalid damage values', () => {
    const residence = new ResidenceDefense();
    const door = residence.getEntrance('front-door')!;

    expect(door.takeDamage(0)).toBe(0);
    expect(door.takeDamage(Number.NaN)).toBe(0);
    expect(door.health).toBe(180);
  });
});
