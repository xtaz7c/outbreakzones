/**
 * Núcleo da simulação do jogo.
 * Não depende de Phaser nem de qualquer API de renderização.
 *
 * Timestep: fixed timestep com acumulador (ADR7).
 * - FIXED_DT = 1/60 s
 * - dt inválido (NaN, Infinity, negativo) é ignorado
 * - dt muito grande é limitado por MAX_FRAME_DT para evitar spiral of death
 */

export interface SimulationState {
  elapsed: number;
  paused: boolean;
  officerCount: number;
  infectedCount: number;
}

/** Duração de um passo fixo da simulação (segundos). */
export const FIXED_DT = 1 / 60;

/** Máximo de tempo real processado por frame (segundos). */
const MAX_FRAME_DT = 0.25;

/** Máximo de passos fixos por chamada a update (proteção extra). */
const MAX_STEPS_PER_UPDATE = 12;

function isValidDt(dt: number): boolean {
  return Number.isFinite(dt) && dt >= 0;
}

export class Simulation {
  private elapsed = 0;
  private paused = false;
  private accumulator = 0;

  // Placeholders até as fases de entidades
  private officerCount = 3;
  private infectedCount = 0;

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Avança a simulação com fixed timestep.
   * @param dt Delta time em segundos (tempo real desde o último frame).
   */
  update(dt: number): void {
    if (this.paused) return;
    if (!isValidDt(dt)) return;

    // Limita o tempo real processado neste frame
    const frameDt = Math.min(dt, MAX_FRAME_DT);
    this.accumulator += frameDt;

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_UPDATE) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps += 1;
    }

    // Evita acumular residual enorme se MAX_STEPS for atingido
    if (steps >= MAX_STEPS_PER_UPDATE) {
      this.accumulator = 0;
    }
  }

  /** Um passo determinístico da simulação. */
  private step(dt: number): void {
    this.elapsed += dt;
    // Futuro: systems de movimento, combate, ondas, etc.
  }

  getState(): SimulationState {
    return {
      elapsed: this.elapsed,
      paused: this.paused,
      officerCount: this.officerCount,
      infectedCount: this.infectedCount,
    };
  }
}
