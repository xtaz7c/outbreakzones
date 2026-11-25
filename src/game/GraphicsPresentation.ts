import type { GraphicsSettings } from './GraphicsSettings';

export interface GraphicsPresentation {
  /** Visual camera scale; simulation coordinates remain in 32px world units. */
  readonly cameraZoom: number;
  readonly roundPixels: boolean;
  readonly showCombatTracers: boolean;
  readonly showImpactRings: boolean;
}

/**
 * Maps user-facing graphics preferences to rendering-only behavior.
 * Tile resolution is a presentation scale, not a change to Tiled/world units.
 */
export function getGraphicsPresentation(settings: GraphicsSettings): GraphicsPresentation {
  return {
    cameraZoom: settings.tileResolution / 32,
    roundPixels: settings.quality !== 'high',
    showCombatTracers: settings.quality !== 'low',
    showImpactRings: settings.quality === 'high',
  };
}
