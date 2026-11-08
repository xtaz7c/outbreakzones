import Phaser from 'phaser';
import { Simulation } from '../../simulation/Simulation';
import { GridMap } from '../../simulation/world/GridMap';
import { findPath } from '../../simulation/world/Pathfinder';
import type { TilePosition } from '../../simulation/world/WorldConfig';
import { buildGridFromTiledLayers } from '../../simulation/world/WorldMapLoader';

const CAMERA_SPEED = 600;
const MIN_CAMERA_ZOOM = 0.5;
const MAX_CAMERA_ZOOM = 2.5;
const OFFICER_SPEED = 105;
const SELECTION_DRAG_THRESHOLD = 8;

interface TacticalOfficer {
  readonly id: number;
  readonly container: Phaser.GameObjects.Container;
  readonly selectionRing: Phaser.GameObjects.Arc;
  path: TilePosition[];
  waypointIndex: number;
}

export class MissionScene extends Phaser.Scene {
  private simulation!: Simulation;
  private statusText!: Phaser.GameObjects.Text;
  private fullscreenText!: Phaser.GameObjects.Text;
  private cameraKeys!: Record<string, Phaser.Input.Keyboard.Key>;
  private selectionKeys!: Record<string, Phaser.Input.Keyboard.Key>;
  private selectionGraphics!: Phaser.GameObjects.Graphics;
  private officers: TacticalOfficer[] = [];
  private selectedOfficerIds = new Set<number>();
  private worldGrid!: GridMap;
  private tileSize = 32;
  private cameraWorldWidth = 0;
  private cameraWorldHeight = 0;
  private selectionStart: { x: number; y: number; screenX: number; screenY: number } | null = null;
  private isPaused = false;

  constructor() {
    super('MissionScene');
  }

  create(): void {
    this.simulation = new Simulation();
    this.createWorld();
    this.createOfficers();
    this.createHud();
    this.createCameraControls();
    this.createSelectionControls();

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
    if (!this.isPaused) {
      this.updateOfficers(dt);
    }
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

    this.tileSize = map.tileWidth;
    this.worldGrid = buildGridFromTiledLayers(
      map.width,
      map.height,
      map.tileWidth,
      [
        map.getObjectLayer('Collision'),
        map.getObjectLayer('Entrances'),
        map.getObjectLayer('Obstacles'),
      ],
    );

    this.registry.set('worldGrid', this.worldGrid);
    this.cameraWorldWidth = map.widthInPixels;
    this.cameraWorldHeight = map.heightInPixels;
    this.cameras.main
      .setBounds(0, 0, this.cameraWorldWidth, this.cameraWorldHeight)
      .setZoom(1)
      .centerOn(this.cameraWorldWidth / 2, this.cameraWorldHeight / 2);
  }

  private createOfficers(): void {
    const spawnTiles: TilePosition[] = [
      { column: 29, row: 33 },
      { column: 32, row: 33 },
      { column: 35, row: 33 },
    ];

    this.officers = spawnTiles.map((tile, index) => {
      const x = tile.column * this.tileSize + this.tileSize / 2;
      const y = tile.row * this.tileSize + this.tileSize / 2;
      const ring = this.add.circle(0, 0, 15).setStrokeStyle(3, 0xffdf70).setVisible(false);
      const body = this.add.circle(0, 0, 10, 0x3f83d5).setStrokeStyle(2, 0xe8f2ff);
      const label = this.add.text(0, 13, String(index + 1), {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#172033',
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 0);
      const container = this.add.container(x, y, [ring, body, label]).setDepth(100);
      return {
        id: index + 1,
        container,
        selectionRing: ring,
        path: [],
        waypointIndex: 0,
      };
    });
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

    this.selectionGraphics = this.add.graphics().setScrollFactor(0).setDepth(999);
  }

  private createCameraControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    this.cameraKeys = keyboard.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT',
    ) as Record<string, Phaser.Input.Keyboard.Key>;

    keyboard.on('keydown-F', () => this.toggleFullscreen());

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

  private createSelectionControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    this.selectionKeys = keyboard.addKeys('ONE,TWO,THREE') as Record<string, Phaser.Input.Keyboard.Key>;
    keyboard.on('keydown-ONE', () => this.selectOfficer(1));
    keyboard.on('keydown-TWO', () => this.selectOfficer(2));
    keyboard.on('keydown-THREE', () => this.selectOfficer(3));

    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 2) {
        this.issueMoveOrder(pointer.worldX, pointer.worldY);
        return;
      }
      if (pointer.button !== 0) return;

      this.selectionStart = {
        x: pointer.worldX,
        y: pointer.worldY,
        screenX: pointer.x,
        screenY: pointer.y,
      };
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.selectionStart || !pointer.leftButtonDown()) return;
      this.drawSelectionBox(this.selectionStart.screenX, this.selectionStart.screenY, pointer.x, pointer.y);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.selectionStart || pointer.button !== 0) return;
      const start = this.selectionStart;
      this.selectionStart = null;
      this.selectionGraphics.clear();

      const distance = Phaser.Math.Distance.Between(start.screenX, start.screenY, pointer.x, pointer.y);
      if (distance >= SELECTION_DRAG_THRESHOLD) {
        this.selectBox(start.x, start.y, pointer.worldX, pointer.worldY, pointer.shiftKey);
      } else {
        this.selectAt(pointer.worldX, pointer.worldY, pointer.shiftKey);
      }
    });
  }

  private selectOfficer(id: number): void {
    this.selectedOfficerIds.clear();
    this.selectedOfficerIds.add(id);
    this.refreshSelectionVisuals();
  }

  private selectAt(x: number, y: number, additive: boolean): void {
    const hitRadius = 22;
    const hit = [...this.officers]
      .reverse()
      .find((officer) => Phaser.Math.Distance.Between(x, y, officer.container.x, officer.container.y) <= hitRadius);

    if (!additive) this.selectedOfficerIds.clear();
    if (hit) {
      if (additive && this.selectedOfficerIds.has(hit.id)) {
        this.selectedOfficerIds.delete(hit.id);
      } else {
        this.selectedOfficerIds.add(hit.id);
      }
    }
    this.refreshSelectionVisuals();
  }

  private selectBox(x1: number, y1: number, x2: number, y2: number, additive: boolean): void {
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);

    if (!additive) this.selectedOfficerIds.clear();
    for (const officer of this.officers) {
      if (
        officer.container.x >= left &&
        officer.container.x <= right &&
        officer.container.y >= top &&
        officer.container.y <= bottom
      ) {
        this.selectedOfficerIds.add(officer.id);
      }
    }
    this.refreshSelectionVisuals();
  }

  private refreshSelectionVisuals(): void {
    for (const officer of this.officers) {
      officer.selectionRing.setVisible(this.selectedOfficerIds.has(officer.id));
    }
  }

  private drawSelectionBox(x1: number, y1: number, x2: number, y2: number): void {
    this.selectionGraphics.clear();
    this.selectionGraphics.fillStyle(0x65a9ff, 0.15);
    this.selectionGraphics.lineStyle(1, 0x8fc4ff, 0.95);
    this.selectionGraphics.fillRect(x1, y1, x2 - x1, y2 - y1);
    this.selectionGraphics.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }

  private issueMoveOrder(worldX: number, worldY: number): void {
    const selected = this.officers.filter((officer) => this.selectedOfficerIds.has(officer.id));
    if (selected.length === 0) return;

    const target = this.worldToTile(worldX, worldY);
    const centerOffset = (selected.length - 1) / 2;

    selected.forEach((officer, index) => {
      const offset = index - centerOffset;
      const goal = this.findNearestWalkable({
        column: Math.round(target.column + offset),
        row: target.row,
      });
      if (!goal) return;

      const start = this.worldToTile(officer.container.x, officer.container.y);
      const path = findPath(this.worldGrid, start, goal, { allowDiagonal: true });
      if (path) {
        officer.path = path;
        officer.waypointIndex = 0;
      }
    });
  }

  private findNearestWalkable(origin: TilePosition, maxRadius = 5): TilePosition | null {
    for (let radius = 0; radius <= maxRadius; radius += 1) {
      for (let row = origin.row - radius; row <= origin.row + radius; row += 1) {
        for (let column = origin.column - radius; column <= origin.column + radius; column += 1) {
          if (Math.max(Math.abs(column - origin.column), Math.abs(row - origin.row)) !== radius) continue;
          const candidate = { column, row };
          if (this.worldGrid.isWalkable(candidate)) return candidate;
        }
      }
    }
    return null;
  }

  private worldToTile(x: number, y: number): TilePosition {
    return {
      column: Math.floor(x / this.tileSize),
      row: Math.floor(y / this.tileSize),
    };
  }

  private updateOfficers(dt: number): void {
    for (const officer of this.officers) {
      const waypoint = officer.path[officer.waypointIndex];
      if (!waypoint) continue;

      const targetX = waypoint.column * this.tileSize + this.tileSize / 2;
      const targetY = waypoint.row * this.tileSize + this.tileSize / 2;
      const dx = targetX - officer.container.x;
      const dy = targetY - officer.container.y;
      const distance = Math.hypot(dx, dy);
      const step = OFFICER_SPEED * dt;

      if (distance <= step) {
        officer.container.setPosition(targetX, targetY);
        officer.waypointIndex += 1;
        if (officer.waypointIndex >= officer.path.length) {
          officer.path = [];
          officer.waypointIndex = 0;
        }
      } else {
        officer.container.x += (dx / distance) * step;
        officer.container.y += (dy / distance) * step;
      }
    }
  }

  private updateCamera(dt: number): void {
    if (!this.cameraKeys) return;

    const left = this.cameraKeys.A.isDown || this.cameraKeys.LEFT.isDown;
    const right = this.cameraKeys.D.isDown || this.cameraKeys.RIGHT.isDown;
    const up = this.cameraKeys.W.isDown || this.cameraKeys.UP.isDown;
    const down = this.cameraKeys.S.isDown || this.cameraKeys.DOWN.isDown;
    const horizontal = Number(right) - Number(left);
    const vertical = Number(down) - Number(up);

    if (horizontal === 0 && vertical === 0) return;

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
    if (this.scale.isFullscreen) this.scale.stopFullscreen();
    else this.scale.startFullscreen();
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
        `Selected: ${this.selectedOfficerIds.size} | 1-3: select | Shift: add | Right click: move`,
        'WASD / Arrows: camera | Wheel: zoom | F: fullscreen',
      ].join('\\n'),
    );
  }
}
