/**
 * Ciclo dia/noite da simulação.
 *
 * Tempo de jogo avança em minutos por segundo real (configurável).
 * Fases influenciam gameplay (visão, spawn) e o visual (tint de texturas).
 *
 * Integração prevista:
 * - Simulation.tick → dayNight.update(dt)
 * - MissionScene → DayNightVisuals.apply(phase, layers, lights)
 */

export type DayPhase =
  | 'dawn' // amanhecer
  | 'day' // dia pleno
  | 'dusk' // entardecer
  | 'night'; // noite

export interface DayNightConfig {
  /** Minutos de jogo avançados por segundo real. Default 1 → 24 min reais = 1 dia. */
  readonly minutesPerRealSecond: number;
  /** Hora inicial (0–24). */
  readonly startHour: number;
  /** Dia inicial (1-based). */
  readonly startDay: number;
}

export interface DayNightState {
  readonly day: number;
  /** Hora contínua 0–24. */
  readonly hour: number;
  readonly phase: DayPhase;
  /** 0 = meia-noite, 0.5 = meio-dia, 1 = meia-noite seguinte. */
  readonly normalizedTime: number;
  /** Label HUD, ex: "DIA 1 · 14:30". */
  readonly hudLabel: string;
}

export const DEFAULT_DAY_NIGHT_CONFIG: DayNightConfig = Object.freeze({
  minutesPerRealSecond: 1,
  startHour: 14.5, // 14:30 como na referência de UI
  startDay: 1,
});

/** Limites de fase em horas (início inclusivo). */
export const PHASE_WINDOWS: ReadonlyArray<{ phase: DayPhase; start: number; end: number }> = [
  { phase: 'night', start: 0, end: 5 },
  { phase: 'dawn', start: 5, end: 7 },
  { phase: 'day', start: 7, end: 18 },
  { phase: 'dusk', start: 18, end: 20 },
  { phase: 'night', start: 20, end: 24 },
];

export function phaseAtHour(hour: number): DayPhase {
  const h = ((hour % 24) + 24) % 24;
  for (const window of PHASE_WINDOWS) {
    if (h >= window.start && h < window.end) return window.phase;
  }
  return 'night';
}

export function formatHudClock(day: number, hour: number): string {
  const h = Math.floor(((hour % 24) + 24) % 24);
  const m = Math.floor((((hour % 24) + 24) % 24 - h) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `DIA ${day} · ${hh}:${mm}`;
}

/**
 * Multiplicadores de gameplay por fase (hooks futuros).
 * night: infectados mais agressivos / visão reduzida conceptualmente.
 */
export interface PhaseGameplayModifiers {
  readonly infectedSpeedMul: number;
  readonly officerVisionMul: number;
  readonly ambientThreatMul: number;
}

export function gameplayModifiersFor(phase: DayPhase): PhaseGameplayModifiers {
  switch (phase) {
    case 'dawn':
      return { infectedSpeedMul: 1.05, officerVisionMul: 0.9, ambientThreatMul: 1.1 };
    case 'day':
      return { infectedSpeedMul: 1.0, officerVisionMul: 1.0, ambientThreatMul: 1.0 };
    case 'dusk':
      return { infectedSpeedMul: 1.1, officerVisionMul: 0.85, ambientThreatMul: 1.2 };
    case 'night':
      return { infectedSpeedMul: 1.2, officerVisionMul: 0.7, ambientThreatMul: 1.35 };
  }
}

export class DayNightSystem {
  private day: number;
  private hour: number;
  private readonly minutesPerRealSecond: number;

  constructor(config: Partial<DayNightConfig> = {}) {
    const cfg = { ...DEFAULT_DAY_NIGHT_CONFIG, ...config };
    this.day = cfg.startDay;
    this.hour = cfg.startHour;
    this.minutesPerRealSecond = cfg.minutesPerRealSecond;
  }

  /** dt em segundos reais de simulação. */
  update(dt: number): DayNightState {
    if (dt > 0 && Number.isFinite(dt)) {
      const deltaHours = (this.minutesPerRealSecond * dt) / 60;
      this.hour += deltaHours;
      while (this.hour >= 24) {
        this.hour -= 24;
        this.day += 1;
      }
    }
    return this.getState();
  }

  getState(): DayNightState {
    const hour = ((this.hour % 24) + 24) % 24;
    return {
      day: this.day,
      hour,
      phase: phaseAtHour(hour),
      normalizedTime: hour / 24,
      hudLabel: formatHudClock(this.day, hour),
    };
  }

  /** Força hora (debug / missões com horário fixo). */
  setHour(hour: number): void {
    this.hour = ((hour % 24) + 24) % 24;
  }

  setDay(day: number): void {
    this.day = Math.max(1, Math.floor(day));
  }
}
