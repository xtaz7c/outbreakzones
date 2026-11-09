export const DEFAULT_HUD_SCALE = 1;
export const MIN_HUD_SCALE = 0.8;
export const MAX_HUD_SCALE = 1.2;

/** Parse persisted HUD scale and clamp it to safe, camera-independent bounds. */
export function normalizeHudScale(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim().length > 0
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_HUD_SCALE;
  return Math.round(Math.max(MIN_HUD_SCALE, Math.min(MAX_HUD_SCALE, parsed)) * 100) / 100;
}
