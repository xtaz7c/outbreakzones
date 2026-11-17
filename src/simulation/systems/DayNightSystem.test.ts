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

  it('normaliza horários negativos e acima de 24 horas', () => {
    expect(phaseAtHour(-1)).toBe('night');
    expect(phaseAtHour(29)).toBe('dawn');
  });
});

describe('formatHudClock', () => {
  it('formata no padrão da interface', () => {
    expect(formatHudClock(1, 14.5)).toBe('DIA 1 · 14:30');
    expect(formatHudClock(2, 0)).toBe('DIA 2 · 00:00');
  });
});

describe('DayNightSystem', () => {
  it('mantém 14:30 como horário inicial padrão', () => {
    const system = new DayNightSystem();
    expect(system.getState().hudLabel).toBe('DIA 1 · 14:30');
    expect(system.getState().phase).toBe('day');
  });

  it('avança minutos e troca de dia corretamente', () => {
    const system = new DayNightSystem({ startHour: 23.5, minutesPerRealSecond: 60 });
    const state = system.update(0.5);
    expect(state.day).toBe(2);
    expect(state.hour).toBeCloseTo(0, 5);
  });

  it('normaliza horário inicial fora do intervalo', () => {
    const system = new DayNightSystem({ startHour: 26 });
    expect(system.getState().hudLabel).toBe('DIA 2 · 02:00');
  });

  it('não avança com delta inválido ou negativo', () => {
    const system = new DayNightSystem();
    system.update(-1);
    system.update(Number.NaN);
    system.update(Number.POSITIVE_INFINITY);
    expect(system.getState().hudLabel).toBe('DIA 1 · 14:30');
  });

  it('rejeita configurações inválidas', () => {
    expect(() => new DayNightSystem({ minutesPerRealSecond: -1 })).toThrow(RangeError);
    expect(() => new DayNightSystem({ startHour: Number.NaN })).toThrow(RangeError);
    expect(() => new DayNightSystem({ startDay: 0 })).toThrow(RangeError);
  });

  it('expõe modificadores de gameplay por fase', () => {
    expect(gameplayModifiersFor('night').infectedSpeedMul)
      .toBeGreaterThan(gameplayModifiersFor('day').infectedSpeedMul);
  });
});
