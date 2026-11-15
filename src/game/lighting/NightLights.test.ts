import { describe, expect, it } from 'vitest';
import { PHASE_TINTS, phaseTintColor, applyPhaseVisuals } from './DayNightVisuals';
import { gridLampPositions } from './NightLights';
import { PHASE_AMBIENT_STRENGTH } from './NightAmbientPipeline';

describe('PHASE_TINTS lights', () => {
  it('apaga luzes de dia e acende à noite', () => {
    expect(PHASE_TINTS.day.localLightMul).toBe(0);
    expect(PHASE_TINTS.night.localLightMul).toBe(1);
    expect(PHASE_TINTS.dusk.localLightMul).toBeGreaterThan(PHASE_TINTS.dawn.localLightMul);
  });

  it('gera tint noturno com canal B dominante', () => {
    const night = phaseTintColor('night');
    const r = (night >> 16) & 0xff;
    const b = night & 0xff;
    expect(b).toBeGreaterThan(r);
  });
});

describe('applyPhaseVisuals', () => {
  it('dispara hooks com mul de fase', () => {
    let lightsMul = -1;
    let ambient = -1;
    applyPhaseVisuals('night', [], {
      onLights: (mul) => {
        lightsMul = mul;
      },
      onAmbientFx: (s) => {
        ambient = s;
      },
    });
    expect(lightsMul).toBe(1);
    expect(ambient).toBeGreaterThan(0.5);
  });
});

describe('gridLampPositions', () => {
  it('respeita step e inset', () => {
    const specs = gridLampPositions(20, 12, 32, 5, 2);
    expect(specs.length).toBeGreaterThan(0);
    expect(specs.every((s) => s.x >= 0 && s.y >= 0)).toBe(true);
  });
});

describe('PHASE_AMBIENT_STRENGTH', () => {
  it('dia zerado e noite alta', () => {
    expect(PHASE_AMBIENT_STRENGTH.day).toBe(0);
    expect(PHASE_AMBIENT_STRENGTH.night).toBeGreaterThan(0.5);
  });
});
