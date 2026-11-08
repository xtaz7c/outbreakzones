import Phaser from 'phaser';
import { Simulation } from '../../simulation/Simulation';

/**
 * Cena principal da missão.
 * Responsável por input, renderização e por avançar a simulação com delta time.
 */
export class MissionScene extends Phaser.Scene {
  private simulation!: Simulation;
  private statusText!: Phaser.GameObjects.Text;
  private isPaused = false;

  constructor() {
    super('MissionScene');
  }

  create(): void {
    this.simulation = new Simulation();

    // Texto de status (HUD mínimo)
    this.statusText = this.add
      .text(16, 16, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#e0e0e0',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(1000);

    // Pausa com Espaço
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.isPaused = !this.isPaused;
      this.simulation.setPaused(this.isPaused);
    });

    this.updateStatusText(0);
  }

  update(_time: number, delta: number): void {
    // delta vem em milissegundos; convertemos para segundos
    const dt = delta / 1000;

    // A simulação respeita o estado de pausa internamente
    this.simulation.update(dt);

    this.updateStatusText(dt);
  }

  private updateStatusText(dt: number): void {
    const state = this.simulation.getState();
    const fps = dt > 0 ? (1 / dt).toFixed(0) : '—';

    this.statusText.setText(
      [
        `Testgame — Mission (foundation)`,
        `Paused: ${state.paused ? 'YES' : 'NO'}  (Space)`,
        `Sim time: ${state.elapsed.toFixed(2)}s`,
        `Approx FPS: ${fps}`,
        `Officers: ${state.officerCount}  |  Infected: ${state.infectedCount}`,
      ].join('\n'),
    );
  }
}
