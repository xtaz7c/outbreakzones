import { describe, expect, it } from 'vitest';
import { PHASE_TINTS, phaseTintColor, visualTintAtHour } from './DayNightVisuals';
import { gridLampPositions } from './NightLights';

describe('phase lighting values', () => {
  it('apaga luzes de dia e aumenta intensidade à noite', () => {
    expect(PHASE_TINTS.day.localLightMul).toBe(0);
    expect(PHASE_TINTS.night.localLightMul).toBe(1);
    expect(PHASE_TINTS.dusk.localLightMul).toBeGreaterThan(PHASE_TINTS.dawn.localLightMul);
  });

  it('gera tint noturno com canal azul dominante', () => {
    const night = phaseTintColor('night');
    const red = (night >> 16) & 0xff;
    const blue = night & 0xff;
    expect(blue).toBeGreaterThan(red);
  });
});

describe('visualTintAtHour', () => {
  it('mantém dia e noite estáveis fora das transições', () => {
    expect(visualTintAtHour(12)).toEqual(PHASE_TINTS.day);
    expect(visualTintAtHour(2)).toEqual(PHASE_TINTS.night);
  });

  it('interpola gradualmente no amanhecer e entardecer', () => {
    const beforeDawn = visualTintAtHour(5.25);
    const afterDawn = visualTintAtHour(6.75);
    const beforeDusk = visualTintAtHour(18.25);
    const afterDusk = visualTintAtHour(19.75);
    expect(beforeDawn.overlayAlpha).toBeLessThan(PHASE_TINTS.night.overlayAlpha);
    expect(afterDawn.overlayAlpha).toBeLessThan(beforeDawn.overlayAlpha);
    expect(beforeDusk.overlayAlpha).toBeGreaterThan(0);
    expect(afterDusk.localLightMul).toBeGreaterThan(beforeDusk.localLightMul);
  });
});

describe('gridLampPositions', () => {
  it('respeita espaçamento e margem', () => {
    const specs = gridLampPositions(20, 12, 32, 5, 2);
    expect(specs.length).toBeGreaterThan(0);
    expect(specs.every((spec) => spec.x >= 0 && spec.y >= 0)).toBe(true);
  });

  it('rejeita dimensões inválidas', () => {
    expect(() => gridLampPositions(0, 10, 32, 4)).toThrow(RangeError);
  });
});
