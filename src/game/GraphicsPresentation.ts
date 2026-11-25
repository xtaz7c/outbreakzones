import type { GraphicsSettings } from './GraphicsSettings';

export interface GraphicsPresentation {
  /** Camera remains at 1:1; 64px assets are normalized by the map/sprite scale. */
  readonly cameraZoom: number;
  readonly roundPixels: boolean;
  readonly showCombatTracers: boolean;
  readonly showImpactRings: boolean;
}

/**
 * Maps user-facing graphics preferences to rendering-only behavior.
 * Tile resolution changes source asset detail, not the logical world or camera zoom.
 */
export function getGraphicsPresentation(settings: GraphicsSettings): GraphicsPresentation {
  return {
    cameraZoom: 1,
    roundPixels: settings.quality !== 'high',
    showCombatTracers: settings.quality !== 'low',
    showImpactRings: settings.quality === 'high',
  };
}
