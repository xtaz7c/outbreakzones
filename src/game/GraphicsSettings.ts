export type TileResolution = 32 | 64;
export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface GraphicsSettings {
  readonly tileResolution: TileResolution;
  readonly quality: GraphicsQuality;
}

export const GRAPHICS_SETTINGS_STORAGE_KEY = 'outbreakzones:graphics-settings:v1';

export const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = Object.freeze({
  tileResolution: 64,
  quality: 'high',
});

const TILE_RESOLUTIONS: readonly TileResolution[] = [32, 64];
const GRAPHICS_QUALITIES: readonly GraphicsQuality[] = ['low', 'medium', 'high'];

/**
 * Validates persisted graphics preferences without allowing malformed storage
 * to affect the game boot sequence. Unknown fields are intentionally ignored.
 */
export function normalizeGraphicsSettings(value: unknown): GraphicsSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_GRAPHICS_SETTINGS;
  }

  const candidate = value as Record<string, unknown>;
  const tileResolution = TILE_RESOLUTIONS.includes(candidate.tileResolution as TileResolution)
    ? candidate.tileResolution as TileResolution
    : DEFAULT_GRAPHICS_SETTINGS.tileResolution;
  const quality = GRAPHICS_QUALITIES.includes(candidate.quality as GraphicsQuality)
    ? candidate.quality as GraphicsQuality
    : DEFAULT_GRAPHICS_SETTINGS.quality;

  return Object.freeze({ tileResolution, quality });
}

/** Reads and validates a serialized preference object; invalid JSON is safe. */
export function parseGraphicsSettings(serialized: string | null | undefined): GraphicsSettings {
  if (typeof serialized !== 'string' || serialized.trim().length === 0) {
    return DEFAULT_GRAPHICS_SETTINGS;
  }

  try {
    return normalizeGraphicsSettings(JSON.parse(serialized) as unknown);
  } catch {
    return DEFAULT_GRAPHICS_SETTINGS;
  }
}

/** Produces the canonical JSON representation used by local persistence. */
export function serializeGraphicsSettings(settings: unknown): string {
  return JSON.stringify(normalizeGraphicsSettings(settings));
}
