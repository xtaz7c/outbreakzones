/**
 * Núcleo da simulação do jogo.
 * Não depende de Phaser nem de qualquer API de renderização.
 */
export interface SimulationState {
  elapsed: number;
  paused: boolean;
  officerCount: number;
  infectedCount: number;
}

export class Simulation {
  private elapsed = 0;
  private paused = false;

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
   * Avança a simulação.
   * @param dt Delta time em segundos. Valores muito altos são limitados para estabilidade.
   */
  update(dt: number): void {
    if (this.paused) return;

    // Clamp para evitar "spiral of death" em picos de lag
    const safeDt = Math.min(dt, 0.05);
    this.elapsed += safeDt;

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
