import Phaser from 'phaser';
import { Simulation } from '../../simulation/Simulation';
import type { TilePosition } from '../../simulation/world/WorldConfig';
import { buildGridFromTiledLayers } from '../../simulation/world/WorldMapLoader';

const CAMERA_SPEED = 600;
const MIN_CAMERA_ZOOM = 0.5;
const MAX_CAMERA_ZOOM = 2.5;
const SELECTION_DRAG_THRESHOLD = 8;

interface TacticalOfficer {
  readonly id: number;
  readonly container: Phaser.GameObjects.Container;
  readonly selectionRing: Phaser.GameObjects.Arc;
}

interface TacticalInfected {
  readonly id: number;
  readonly container: Phaser.GameObjects.Container;
}

export class MissionScene extends Phaser.Scene {
  private simulation!: Simulation;
  private statusText!: Phaser.GameObjects.Text;
  private fullscreenText!: Phaser.GameObjects.Text;
  private cameraKeys!: Record<string, Phaser.Input.Keyboard.Key>;
  private selectionGraphics!: Phaser.GameObjects.Graphics;
  private combatGraphics!: Phaser.GameObjects.Graphics;
  private officers: TacticalOfficer[] = [];
  private readonly infectedVisuals = new Map<number, TacticalInfected>();
  private debugInfectedSpawnIndex = 0;
  private selectedOfficerIds = new Set<number>();
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
    this.input.keyboard?.on('keydown-I', () => this.spawnDebugInfected());

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.isPaused = !this.isPaused;
      this.simulation.setPaused(this.isPaused);
    });

    this.updateStatusText(0);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    this.simulation.update(dt);
    this.updateCombatFeedback();
    this.updateCamera(dt);
    if (!this.isPaused) {
      this.updateOfficers(dt);
    }
    this.updateInfectedVisuals();
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
    const worldGrid = buildGridFromTiledLayers(
      map.width,
      map.height,
      map.tileWidth,
      [
        map.getObjectLayer('Collision'),
        map.getObjectLayer('Entrances'),
        map.getObjectLayer('Obstacles'),
      ],
    );

    this.registry.set('worldGrid', worldGrid);
    this.simulation.setWorldGrid(worldGrid, this.tileSize);
    this.cameraWorldWidth = map.widthInPixels;
    this.cameraWorldHeight = map.heightInPixels;
    this.cameras.main
      .setBounds(0, 0, this.cameraWorldWidth, this.cameraWorldHeight)
      .setZoom(1)
      .centerOn(this.cameraWorldWidth / 2, this.cameraWorldHeight / 2);
  }

  private createOfficers(): void {
    this.officers = this.simulation.getOfficers().map((officer) => {
      const position = officer.position;
      const ring = this.add.circle(0, 0, 15).setStrokeStyle(3, 0xffdf70).setVisible(false);
      const body = this.add.circle(0, 0, 10, 0x3f83d5).setStrokeStyle(2, 0xe8f2ff);
      const direction = this.add.triangle(0, -13, 0, -5, -4, 4, 4, 4, 0xffe0a3);
      const label = this.add.text(0, 13, String(officer.id), {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#172033',
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 0);
      const container = this.add.container(position.x, position.y, [ring, body, direction, label]).setDepth(100);
      return { id: officer.id, container, selectionRing: ring };
    });
  }

  private createHud(): void {
    // O Dev Hub pertence ao mundo: acompanha o movimento da câmera e
    // também respeita o zoom, em vez de ficar preso à viewport.
    this.statusText = this.add
      .text(16, 16, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#e0e0e0',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 6 },
      })
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
    this.combatGraphics = this.add.graphics().setDepth(120);
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
        this.selectBox(start.x, start.y, pointer.worldX, pointer.worldY, (pointer.event as MouseEvent).shiftKey);
      } else {
        this.selectAt(pointer.worldX, pointer.worldY, (pointer.event as MouseEvent).shiftKey);
      }
    });
  }

  private selectOfficer(id: number): void {
    this.selectedOfficerIds.clear();
    const officer = this.simulation.getOfficers().find((candidate) => candidate.id === id);
    if (officer && !officer.isIncapacitated) this.selectedOfficerIds.add(id);
    this.refreshSelectionVisuals();
  }

  private selectAt(x: number, y: number, additive: boolean): void {
    const hitRadius = 22;
    const hit = [...this.officers]
      .reverse()
      .find((officer) => Phaser.Math.Distance.Between(x, y, officer.container.x, officer.container.y) <= hitRadius);

    if (!additive) this.selectedOfficerIds.clear();
    if (hit && !this.simulation.getOfficers().find((officer) => officer.id === hit.id)?.isIncapacitated) {
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
      const model = this.simulation.getOfficers().find((candidate) => candidate.id === officer.id);
      if (
        model && !model.isIncapacitated &&
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
      officer.selectionRing.setVisible(
        this.selectedOfficerIds.has(officer.id) &&
        !this.simulation.getOfficers().find((candidate) => candidate.id === officer.id)?.isIncapacitated,
      );
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
    if (this.isPaused) return;
    const selected = this.simulation.getOfficers().filter(
      (officer) => this.selectedOfficerIds.has(officer.id) && !officer.isIncapacitated,
    );
    const prioritizedTarget = [...this.simulation.getInfected()]
      .reverse()
      .find((infected) => Phaser.Math.Distance.Between(
        worldX, worldY, infected.position.x, infected.position.y,
      ) <= 24);
    if (prioritizedTarget) {
      for (const officer of selected) {
        this.simulation.setTargetPriority(officer.id, prioritizedTarget.id);
      }
      return;
    }
    for (const officer of selected) this.simulation.setTargetPriority(officer.id, null);
    const target = this.worldToTile(worldX, worldY);
    const centerOffset = (selected.length - 1) / 2;
    selected.forEach((officer, index) => {
      const destination = {
        column: Math.round(target.column + index - centerOffset),
        row: target.row,
      };
      this.simulation.issueMoveOrder(officer.id, destination);
    });
  }


  private worldToTile(x: number, y: number): TilePosition {
    return {
      column: Math.floor(x / this.tileSize),
      row: Math.floor(y / this.tileSize),
    };
  }

  private spawnDebugInfected(): void {
    const spawnPlans = [
      { x: 128, y: 640 },
      { x: 1920, y: 640 },
      { x: 1024, y: 64 },
      { x: 1024, y: 1216 },
    ] as const;
    const plan = spawnPlans[this.debugInfectedSpawnIndex % spawnPlans.length]!;
    this.debugInfectedSpawnIndex += 1;

    this.simulation.spawnInfected({
      x: plan.x,
      y: plan.y,
    });
  }

  private updateInfectedVisuals(): void {
    const activeIds = new Set<number>();
    for (const infected of this.simulation.getInfected()) {
      activeIds.add(infected.id);
      let visual = this.infectedVisuals.get(infected.id);
      if (!visual) {
        const body = this.add.circle(0, 0, 11, 0xb83b3b).setStrokeStyle(2, 0x2a1010);
        const core = this.add.circle(0, 0, 4, 0x451818);
        const container = this.add.container(infected.position.x, infected.position.y, [body, core])
          .setDepth(110);
        visual = { id: infected.id, container };
        this.infectedVisuals.set(infected.id, visual);
      }
      visual.container.setPosition(infected.position.x, infected.position.y);
    }

    for (const [id, visual] of this.infectedVisuals) {
      if (activeIds.has(id)) continue;
      visual.container.destroy();
      this.infectedVisuals.delete(id);
    }
  }

  private updateCombatFeedback(): void {
    this.combatGraphics.clear();
    for (const event of this.simulation.getCombatEvents()) {
      this.combatGraphics.lineStyle(event.hit ? 2 : 1, event.hit ? 0xffd166 : 0x9aa0a6, 0.9);
      this.combatGraphics.beginPath();
      this.combatGraphics.moveTo(event.from.x, event.from.y);
      this.combatGraphics.lineTo(event.to.x, event.to.y);
      this.combatGraphics.strokePath();
      if (event.hit) {
        this.combatGraphics.fillStyle(0xffe08a, 0.95);
        this.combatGraphics.fillCircle(event.to.x, event.to.y, 3);
      }
    }
  }

  private updateOfficers(_dt: number): void {
    for (const visual of this.officers) {
      const officer = this.simulation.getOfficers().find((candidate) => candidate.id === visual.id);
      if (!officer) continue;
      const position = officer.position;
      visual.container.setPosition(position.x, position.y);
      visual.container.setRotation(officer.facingAngle + Math.PI / 2);
      visual.container.setAlpha(officer.isIncapacitated ? 0.35 : 1);
      visual.selectionRing.setVisible(
        this.selectedOfficerIds.has(officer.id) && !officer.isIncapacitated,
      );
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
        'Shelter: safe zone | Interior inaccessible',
        ...(this.simulation.isMissionDefeated() ? ['MISSION DEFEATED — all officers incapacitated'] : []),
        `Selected: ${this.selectedOfficerIds.size} | 1-3: select | Shift: add | Right click: move/target`,
        ...this.simulation.getOfficers().map((officer) => {
          const ammo = this.simulation.getOfficerAmmoStatus(officer.id);
          return `Officer ${officer.id}: HP ${officer.health} | Ammo ${ammo.current}/${ammo.capacity}${ammo.reloading ? ' | Reloading' : ''}`;
        }),
        'WASD / Arrows: camera | Wheel: zoom | F: fullscreen | I: debug spawn',
      ].join('\\n'),
    );
  }
}
