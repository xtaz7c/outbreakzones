import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HUD_SCALE,
  MAX_HUD_SCALE,
  MIN_HUD_SCALE,
  normalizeHudScale,
} from './HudScale';

describe('HUD scale settings', () => {
  it('uses the default scale when persisted data is absent or invalid', () => {
    expect(normalizeHudScale(null)).toBe(DEFAULT_HUD_SCALE);
    expect(normalizeHudScale('')).toBe(DEFAULT_HUD_SCALE);
    expect(normalizeHudScale('invalid')).toBe(DEFAULT_HUD_SCALE);
  });

  it('clamps the scale to safe minimum and maximum values', () => {
    expect(normalizeHudScale(0.1)).toBe(MIN_HUD_SCALE);
    expect(normalizeHudScale(3)).toBe(MAX_HUD_SCALE);
  });

  it('preserves supported fractional scale values', () => {
    expect(normalizeHudScale('1.15')).toBe(1.15);
  });
});
