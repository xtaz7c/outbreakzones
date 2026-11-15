import type { DayPhase } from '../../simulation/systems/DayNightSystem';

/**
 * Como o ciclo dia/noite afeta texturas e camadas Phaser.
 *
 * Estratégia:
 * 1. Tint multiplicativo nas tile layers e sprites de mundo
 * 2. Overlay de ambient (Graphics) e/ou PostFX NightAmbientPipeline
 * 3. PointLights locais (NightLights) — intensidade ∝ localLightMul
 *
 * NÃO duplicamos SVGs por fase — a fonte de arte continua única.
 */

export interface PhaseTint {
  readonly mulR: number;
  readonly mulG: number;
  readonly mulB: number;
  /** Overlay ARGB (0xAARRGGBB) sobre o mundo. */
  readonly overlay: number;
  readonly overlayAlpha: number;
  /** Intensidade relativa de luzes locais (postes / PointLight). */
  readonly localLightMul: number;
}

export const PHASE_TINTS: Readonly<Record<DayPhase, PhaseTint>> = Object.freeze({
  dawn: {
    mulR: 1.05,
    mulG: 0.95,
    mulB: 0.9,
    overlay: 0xffc8a080,
    overlayAlpha: 0.12,
    localLightMul: 0.35,
  },
  day: {
    mulR: 1.0,
    mulG: 1.0,
    mulB: 1.0,
    overlay: 0x00000000,
    overlayAlpha: 0,
    localLightMul: 0,
  },
  dusk: {
    mulR: 1.08,
    mulG: 0.85,
    mulB: 0.75,
    overlay: 0xff402010,
    overlayAlpha: 0.18,
    localLightMul: 0.55,
  },
  night: {
    mulR: 0.55,
    mulG: 0.62,
    mulB: 0.85,
    overlay: 0xff0a1020,
    overlayAlpha: 0.42,
    localLightMul: 1.0,
  },
});

export function tintFromMul(r: number, g: number, b: number): number {
  const R = Math.max(0, Math.min(255, Math.round(r * 255)));
  const G = Math.max(0, Math.min(255, Math.round(g * 255)));
  const B = Math.max(0, Math.min(255, Math.round(b * 255)));
  return (R << 16) | (G << 8) | B;
}

export function phaseTintColor(phase: DayPhase): number {
  const t = PHASE_TINTS[phase];
  return tintFromMul(t.mulR, t.mulG, t.mulB);
}

export function applyWorldTint(
  phase: DayPhase,
  targets: ReadonlyArray<{
    setTint?: (topLeft?: number, topRight?: number, bottomLeft?: number, bottomRight?: number) => unknown;
    clearTint?: () => unknown;
  }>,
): void {
  const tint = phaseTintColor(phase);
  const isNeutral = phase === 'day';
  for (const target of targets) {
    if (isNeutral) {
      target.clearTint?.();
    } else if (target.setTint) {
      target.setTint(tint);
    }
  }
}

export function lerpTint(a: PhaseTint, b: PhaseTint, t: number): PhaseTint {
  const u = Math.max(0, Math.min(1, t));
  const mix = (x: number, y: number) => x + (y - x) * u;
  return {
    mulR: mix(a.mulR, b.mulR),
    mulG: mix(a.mulG, b.mulG),
    mulB: mix(a.mulB, b.mulB),
    overlay: b.overlay,
    overlayAlpha: mix(a.overlayAlpha, b.overlayAlpha),
    localLightMul: mix(a.localLightMul, b.localLightMul),
  };
}

/**
 * Aplica o pacote visual completo de uma fase:
 * tint de mundo + callback opcional para lights/postfx/overlay.
 */
export function applyPhaseVisuals(
  phase: DayPhase,
  worldTargets: Parameters<typeof applyWorldTint>[1],
  hooks?: {
    onLights?: (localLightMul: number, phase: DayPhase) => void;
    onOverlay?: (alpha: number, color: number, phase: DayPhase) => void;
    onAmbientFx?: (strength: number, phase: DayPhase) => void;
  },
): void {
  applyWorldTint(phase, worldTargets);
  const tint = PHASE_TINTS[phase];
  hooks?.onLights?.(tint.localLightMul, phase);
  hooks?.onOverlay?.(tint.overlayAlpha, tint.overlay, phase);
  const ambientStrength =
    phase === 'night' ? 0.7 : phase === 'dusk' ? 0.35 : phase === 'dawn' ? 0.2 : 0;
  hooks?.onAmbientFx?.(ambientStrength, phase);
}
