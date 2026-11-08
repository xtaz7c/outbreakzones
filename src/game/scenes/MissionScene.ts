import Phaser from 'phaser';
import { Simulation } from '../../simulation/Simulation';
import { buildGridFromTiledLayers } from '../../simulation/world/WorldMapLoader';

const CAMERA_SPEED = 600;
const MIN_CAMERA_ZOOM = 0.5;
const MAX_CAMERA_ZOOM = 2.5;

export class MissionScene extends Phaser.Scene {
  private simulation!: Simulation;
  private statusText!: Phaser.GameObjects.Text;
  private fullscreenText!: Phaser.GameObjects.Text;
  private cameraKeys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cameraWorldWidth = 0;
  private cameraWorldHeight = 0;
  private isPaused = false;

  constructor() {
    super('MissionScene');
  }

  create(): void {
    this.simulation = new Simulation();
    this.createWorld();
    this.createHud();
    this.createCameraControls();

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.isPaused = !this.isPaused;
      this.simulation.setPaused(this.isPaused);
    });

    this.updateStatusText(0);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    this.simulation.update(dt);
    this.updateCamera(dt);
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

    this.registry.set('worldGrid', collisionGrid);

    this.cameraWorldWidth = map.widthInPixels;
    this.cameraWorldHeight = map.heightInPixels;
    this.cameras.main
      .setBounds(0, 0, this.cameraWorldWidth, this.cameraWorldHeight)
      .setZoom(1)
      .centerOn(this.cameraWorldWidth / 2, this.cameraWorldHeight / 2);
  }

  private createHud(): void {
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

    this.fullscreenText = this.add
      .text(this.scale.width - 16, 16, 'Fullscreen [F]', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 10, y: 8 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });

    this.fullscreenText.on('pointerdown', () => this.toggleFullscreen());
    this.scale.on('enterfullscreen', () => this.fullscreenText.setText('Exit fullscreen [F]'));
    this.scale.on('leavefullscreen', () => this.fullscreenText.setText('Fullscreen [F]'));
  }

  private createCameraControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    this.cameraKeys = keyboard.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT',
    ) as Record<string, Phaser.Input.Keyboard.Key>;

    keyboard.on('keydown-F', () => this.toggleFullscreen());

    // A roda do mouse aproxima/afasta a câmera sem afetar a simulação.
    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _currentlyOver: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        const camera = this.cameras.main;
        const nextZoom = camera.zoom * (deltaY > 0 ? 0.9 : 1.1);
        camera.setZoom(Phaser.Math.Clamp(nextZoom, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM));
        this.clampCamera();
      },
    );
  }

  private updateCamera(dt: number): void {
    if (!this.cameraKeys) {
      return;
    }

    const left = this.cameraKeys.A.isDown || this.cameraKeys.LEFT.isDown;
    const right = this.cameraKeys.D.isDown || this.cameraKeys.RIGHT.isDown;
    const up = this.cameraKeys.W.isDown || this.cameraKeys.UP.isDown;
    const down = this.cameraKeys.S.isDown || this.cameraKeys.DOWN.isDown;

    const horizontal = Number(right) - Number(left);
    const vertical = Number(down) - Number(up);

    if (horizontal === 0 && vertical === 0) {
      return;
    }

    const length = Math.hypot(horizontal, vertical);
    const camera = this.cameras.main;
    const distance = (CAMERA_SPEED * dt) / camera.zoom;

    camera.scrollX += (horizontal / length) * distance;
    camera.scrollY += (vertical / length) * distance;
    this.clampCamera();
  }

  private clampCamera(): void {
    const camera = this.cameras.main;
    const maxScrollX = Math.max(0, this.cameraWorldWidth - camera.width / camera.zoom);
    const maxScrollY = Math.max(0, this.cameraWorldHeight - camera.height / camera.zoom);

    camera.setScroll(
      Phaser.Math.Clamp(camera.scrollX, 0, maxScrollX),
      Phaser.Math.Clamp(camera.scrollY, 0, maxScrollY),
    );
  }

  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
    } else {
      this.scale.startFullscreen();
    }
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
        'WASD / Arrows: move camera | Mouse wheel: zoom',
      ].join('\n'),
    );
  }
}
