import { describe, expect, it } from 'vitest';
import { getGraphicsPresentation } from './GraphicsPresentation';

describe('graphics presentation', () => {
  it('keeps the camera at 1:1 for both source tile resolutions', () => {
    expect(getGraphicsPresentation({ tileResolution: 32, quality: 'medium' }).cameraZoom).toBe(1);
    expect(getGraphicsPresentation({ tileResolution: 64, quality: 'medium' }).cameraZoom).toBe(1);
  });

  it('reduces optional combat rendering in low quality', () => {
    expect(getGraphicsPresentation({ tileResolution: 32, quality: 'low' })).toEqual({
      cameraZoom: 1,
      roundPixels: true,
      showCombatTracers: false,
      showImpactRings: false,
    });
  });

  it('keeps standard effects in medium quality without magnifying the HUD', () => {
    expect(getGraphicsPresentation({ tileResolution: 64, quality: 'medium' })).toEqual({
      cameraZoom: 1,
      roundPixels: true,
      showCombatTracers: true,
      showImpactRings: false,
    });
  });

  it('enables the additional impact effect in high quality without changing camera scale', () => {
    expect(getGraphicsPresentation({ tileResolution: 64, quality: 'high' })).toEqual({
      cameraZoom: 1,
      roundPixels: false,
      showCombatTracers: true,
      showImpactRings: true,
    });
  });
});
