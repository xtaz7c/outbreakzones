import { describe, expect, it } from 'vitest';
import {
  DayNightSystem,
  formatHudClock,
  phaseAtHour,
  gameplayModifiersFor,
} from './DayNightSystem';

describe('phaseAtHour', () => {
  it('classifica fases nos limites esperados', () => {
    expect(phaseAtHour(0)).toBe('night');
    expect(phaseAtHour(5)).toBe('dawn');
    expect(phaseAtHour(8)).toBe('day');
    expect(phaseAtHour(18)).toBe('dusk');
    expect(phaseAtHour(21)).toBe('night');
  });
});

describe('formatHudClock', () => {
  it('formata no padrão da UI de referência', () => {
    expect(formatHudClock(1, 14.5)).toBe('DIA 1 · 14:30');
    expect(formatHudClock(2, 0)).toBe('DIA 2 · 00:00');
  });
});

describe('DayNightSystem', () => {
  it('inicia em 14:30 do dia 1 por padrão', () => {
    const sys = new DayNightSystem();
    const s = sys.getState();
    expect(s.day).toBe(1);
    expect(s.hudLabel).toBe('DIA 1 · 14:30');
    expect(s.phase).toBe('day');
  });

  it('avança o dia após 24h de jogo', () => {
    const sys = new DayNightSystem({ startHour: 23.5, minutesPerRealSecond: 60 });
    // 60 min de jogo por segundo real → 0.5 h em 0.5 s
    sys.update(0.5);
    const s = sys.getState();
    expect(s.day).toBe(2);
    expect(s.hour).toBeCloseTo(0, 5);
  });

  it('expõe modificadores de gameplay por fase', () => {
    expect(gameplayModifiersFor('night').infectedSpeedMul).toBeGreaterThan(
      gameplayModifiersFor('day').infectedSpeedMul,
    );
  });
});
