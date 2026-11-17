/**
 * Relógio e fases do ciclo dia/noite.
 * O tempo avança em minutos de jogo por segundo real de simulação.
 */

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface DayNightConfig {
  readonly minutesPerRealSecond: number;
  readonly startHour: number;
  readonly startDay: number;
}

export interface DayNightState {
  readonly day: number;
  readonly hour: number;
  readonly phase: DayPhase;
  readonly normalizedTime: number;
  readonly hudLabel: string;
}

export const DEFAULT_DAY_NIGHT_CONFIG: DayNightConfig = Object.freeze({
  minutesPerRealSecond: 1,
  startHour: 14.5,
  startDay: 1,
});

export const PHASE_WINDOWS: ReadonlyArray<{ phase: DayPhase; start: number; end: number }> = [
  { phase: 'night', start: 0, end: 5 },
  { phase: 'dawn', start: 5, end: 7 },
  { phase: 'day', start: 7, end: 18 },
  { phase: 'dusk', start: 18, end: 20 },
  { phase: 'night', start: 20, end: 24 },
];

export function phaseAtHour(hour: number): DayPhase {
  const h = ((hour % 24) + 24) % 24;
  return PHASE_WINDOWS.find((window) => h >= window.start && h < window.end)?.phase ?? 'night';
}

export function formatHudClock(day: number, hour: number): string {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const h = Math.floor(normalizedHour);
  const m = Math.floor((normalizedHour - h) * 60);
  return `DIA ${day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

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
      return { infectedSpeedMul: 1, officerVisionMul: 1, ambientThreatMul: 1 };
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
    if (!Number.isFinite(cfg.minutesPerRealSecond) || cfg.minutesPerRealSecond < 0) {
      throw new RangeError('minutesPerRealSecond must be a finite non-negative number.');
    }
    if (!Number.isFinite(cfg.startHour)) {
      throw new RangeError('startHour must be a finite number.');
    }
    if (!Number.isInteger(cfg.startDay) || cfg.startDay < 1) {
      throw new RangeError('startDay must be a positive integer.');
    }

    const totalStartHours = cfg.startHour;
    const daysBeforeStart = Math.floor(totalStartHours / 24);
    this.day = cfg.startDay + daysBeforeStart;
    this.hour = ((totalStartHours % 24) + 24) % 24;
    this.minutesPerRealSecond = cfg.minutesPerRealSecond;
  }

  /** dt em segundos reais de simulação. */
  update(dt: number): DayNightState {
    if (!Number.isFinite(dt) || dt < 0) return this.getState();
    const totalHours = this.hour + (this.minutesPerRealSecond * dt) / 60;
    if (!Number.isFinite(totalHours)) return this.getState();

    const elapsedDays = Math.floor(totalHours / 24);
    this.hour = totalHours - elapsedDays * 24;
    this.day += elapsedDays;
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

  setHour(hour: number): void {
    if (!Number.isFinite(hour)) throw new RangeError('hour must be a finite number.');
    this.hour = ((hour % 24) + 24) % 24;
  }

  setDay(day: number): void {
    if (!Number.isInteger(day) || day < 1) throw new RangeError('day must be a positive integer.');
    this.day = day;
  }
}
