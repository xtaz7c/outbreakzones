import type { DayPhase } from '../../simulation/systems/DayNightSystem';

export interface PhaseTint {
  readonly mulR: number;
  readonly mulG: number;
  readonly mulB: number;
  readonly overlay: number;
  readonly overlayAlpha: number;
  readonly localLightMul: number;
}

export const PHASE_TINTS: Readonly<Record<DayPhase, PhaseTint>> = Object.freeze({
  dawn: {
    mulR: 1.05, mulG: 0.95, mulB: 0.9,
    overlay: 0xc8a080, overlayAlpha: 0.12, localLightMul: 0.35,
  },
  day: {
    mulR: 1, mulG: 1, mulB: 1,
    overlay: 0x00000000, overlayAlpha: 0, localLightMul: 0,
  },
  dusk: {
    mulR: 1.08, mulG: 0.85, mulB: 0.75,
    overlay: 0x402010, overlayAlpha: 0.18, localLightMul: 0.55,
  },
  night: {
    mulR: 0.55, mulG: 0.62, mulB: 0.85,
    overlay: 0x0a1020, overlayAlpha: 0.42, localLightMul: 1,
  },
});

export function tintFromMul(r: number, g: number, b: number): number {
  const R = Math.max(0, Math.min(255, Math.round(r * 255)));
  const G = Math.max(0, Math.min(255, Math.round(g * 255)));
  const B = Math.max(0, Math.min(255, Math.round(b * 255)));
  return (R << 16) | (G << 8) | B;
}

export function phaseTintColor(phase: DayPhase): number {
  const tint = PHASE_TINTS[phase];
  return tintFromMul(tint.mulR, tint.mulG, tint.mulB);
}

function lerpColor(a: number, b: number, t: number): number {
  const channel = (shift: number) => {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    return Math.round(from + (to - from) * t);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function lerpTint(a: PhaseTint, b: PhaseTint, t: number): PhaseTint {
  const u = Math.max(0, Math.min(1, t));
  const mix = (from: number, to: number) => from + (to - from) * u;
  return {
    mulR: mix(a.mulR, b.mulR),
    mulG: mix(a.mulG, b.mulG),
    mulB: mix(a.mulB, b.mulB),
    overlay: lerpColor(a.overlay & 0xffffff, b.overlay & 0xffffff, u),
    overlayAlpha: mix(a.overlayAlpha, b.overlayAlpha),
    localLightMul: mix(a.localLightMul, b.localLightMul),
  };
}

const VISUAL_STOPS: ReadonlyArray<{ hour: number; tint: PhaseTint }> = [
  { hour: 0, tint: PHASE_TINTS.night },
  { hour: 5, tint: PHASE_TINTS.night },
  { hour: 6, tint: PHASE_TINTS.dawn },
  { hour: 7, tint: PHASE_TINTS.day },
  { hour: 18, tint: PHASE_TINTS.day },
  { hour: 19, tint: PHASE_TINTS.dusk },
  { hour: 20, tint: PHASE_TINTS.night },
  { hour: 24, tint: PHASE_TINTS.night },
];

/** Interpola luz, cor ambiente e intensidade das lâmpadas ao longo do dia. */
export function visualTintAtHour(hour: number): PhaseTint {
  const normalized = ((hour % 24) + 24) % 24;
  for (let index = 1; index < VISUAL_STOPS.length; index += 1) {
    const next = VISUAL_STOPS[index]!;
    if (normalized <= next.hour) {
      const previous = VISUAL_STOPS[index - 1]!;
      const progress = (normalized - previous.hour) / (next.hour - previous.hour);
      return lerpTint(previous.tint, next.tint, progress);
    }
  }
  return PHASE_TINTS.night;
}

export function applyWorldTint(
  targets: ReadonlyArray<{
    setTint?: (topLeft?: number, topRight?: number, bottomLeft?: number, bottomRight?: number) => unknown;
    clearTint?: () => unknown;
  }>,
  tint: PhaseTint,
): void {
  const color = tintFromMul(tint.mulR, tint.mulG, tint.mulB);
  for (const target of targets) {
    if (tint.mulR === 1 && tint.mulG === 1 && tint.mulB === 1) {
      target.clearTint?.();
    } else {
      target.setTint?.(color);
    }
  }
}

export function applyPhaseVisuals(
  phase: DayPhase,
  worldTargets: Parameters<typeof applyWorldTint>[0],
  hooks?: {
    onLights?: (localLightMul: number, phase: DayPhase) => void;
    onOverlay?: (alpha: number, color: number, phase: DayPhase) => void;
    onAmbientFx?: (strength: number, phase: DayPhase) => void;
  },
): void {
  const tint = PHASE_TINTS[phase];
  applyWorldTint(worldTargets, tint);
  hooks?.onLights?.(tint.localLightMul, phase);
  hooks?.onOverlay?.(tint.overlayAlpha, tint.overlay & 0xffffff, phase);
  const ambientStrength = phase === 'night' ? 0.7 : phase === 'dusk' ? 0.35 : phase === 'dawn' ? 0.2 : 0;
  hooks?.onAmbientFx?.(ambientStrength, phase);
}
