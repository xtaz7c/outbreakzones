import Phaser from 'phaser';
import { Simulation } from '../../simulation/Simulation';
import { buildGridFromTiledLayers } from '../../simulation/world/WorldMapLoader';

export class MissionScene extends Phaser.Scene {
  private simulation!: Simulation;
  private statusText!: Phaser.GameObjects.Text;
  private isPaused = false;

  constructor() {
    super('MissionScene');
  }

  create(): void {
    this.simulation = new Simulation();
    this.createWorld();

    this.statusText = this.add
      .text(16, 16, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#e0e0e0',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.isPaused = !this.isPaused;
      this.simulation.setPaused(this.isPaused);
    });

    this.updateStatusText(0);
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.simulation.update(dt);
    this.updateStatusText(dt);
  }

  private createWorld(): void {
    const map = this.make.tilemap({ key: 'mission-01' });
    const tileset = map.addTilesetImage('mission-tiles', 'mission-tiles');

    if (!tileset) {
      throw new Error('Unable to attach the mission tileset to the Tiled map.');
    }

    for (const layerName of ['Ground', 'Terrain', 'Structures']) {
      const layer = map.createLayer(layerName, tileset, 0, 0);
      if (!layer) {
        throw new Error(`Required Tiled layer "${layerName}" is missing.`);
      }
    }

    const collisionGrid = buildGridFromTiledLayers(
      map.width,
      map.height,
      map.tileWidth,
      [
        map.getObjectLayer('Collision'),
        map.getObjectLayer('Entrances'),
        map.getObjectLayer('Obstacles'),
      ],
    );

    // Guardamos la grade para os sistemas de movimento/pathfinding das próximas tarefas.
    this.registry.set('worldGrid', collisionGrid);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  }

  private updateStatusText(dt: number): void {
    const state = this.simulation.getState();
    const fps = dt > 0 ? (1 / dt).toFixed(0) : '—';

    this.statusText.setText(
      [
        'Testgame — Mission',
        `Paused: ${state.paused ? 'YES' : 'NO'}  (Space)`,
        `Sim time: ${state.elapsed.toFixed(2)}s`,
        `Approx FPS: ${fps}`,
        `Officers: ${state.officerCount}  |  Infected: ${state.infectedCount}`,
      ].join('\n'),
    );
  }
}
