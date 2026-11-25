import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  normalizeGraphicsSettings,
  parseGraphicsSettings,
  serializeGraphicsSettings,
} from './GraphicsSettings';

describe('graphics settings', () => {
  it('uses 64px tiles and high quality as the default preferences', () => {
    expect(DEFAULT_GRAPHICS_SETTINGS).toEqual({
      tileResolution: 64,
      quality: 'high',
    });
  });

  it('accepts both supported tile resolutions and all quality profiles', () => {
    expect(normalizeGraphicsSettings({ tileResolution: 32, quality: 'low' })).toEqual({
      tileResolution: 32,
      quality: 'low',
    });
    expect(normalizeGraphicsSettings({ tileResolution: 64, quality: 'medium' })).toEqual({
      tileResolution: 64,
      quality: 'medium',
    });
    expect(normalizeGraphicsSettings({ tileResolution: 64, quality: 'high' })).toEqual({
      tileResolution: 64,
      quality: 'high',
    });
  });

  it('falls back independently for unsupported fields', () => {
    expect(normalizeGraphicsSettings({ tileResolution: 128, quality: 'ultra' })).toEqual(
      DEFAULT_GRAPHICS_SETTINGS,
    );
    expect(normalizeGraphicsSettings({ tileResolution: 32, quality: 'ultra' })).toEqual({
      tileResolution: 32,
      quality: 'high',
    });
  });

  it('rejects null, arrays, primitives and malformed JSON safely', () => {
    expect(normalizeGraphicsSettings(null)).toEqual(DEFAULT_GRAPHICS_SETTINGS);
    expect(normalizeGraphicsSettings([])).toEqual(DEFAULT_GRAPHICS_SETTINGS);
    expect(normalizeGraphicsSettings('64')).toEqual(DEFAULT_GRAPHICS_SETTINGS);
    expect(parseGraphicsSettings(null)).toEqual(DEFAULT_GRAPHICS_SETTINGS);
    expect(parseGraphicsSettings('')).toEqual(DEFAULT_GRAPHICS_SETTINGS);
    expect(parseGraphicsSettings('{invalid')).toEqual(DEFAULT_GRAPHICS_SETTINGS);
  });

  it('round-trips valid preferences through serialized storage', () => {
    const settings = { tileResolution: 32, quality: 'medium' } as const;
    expect(parseGraphicsSettings(serializeGraphicsSettings(settings))).toEqual(settings);
  });

  it('ignores unknown persisted properties', () => {
    expect(normalizeGraphicsSettings({
      tileResolution: 32,
      quality: 'low',
      unexpected: true,
    })).toEqual({ tileResolution: 32, quality: 'low' });
  });
});
