import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { Simulation } from '../../simulation/Simulation';
import type { CombatEvent } from '../../simulation/CombatSystem';
import { GridMap } from '../../simulation/world/GridMap';
import type { TilePosition } from '../../simulation/world/WorldConfig';
import { buildGridFromTiledLayers } from '../../simulation/world/WorldMapLoader';
import { getAvailableEntryPoints, MISSION_ENTRY_POINTS } from '../../simulation/world/MissionEntryPoints';
import { BuildingSystem, type AccessKind } from '../../simulation/world/BuildingSystem';
import type { WaveSpawnPoint } from '../../simulation/WaveSystem';

const CAMERA_SPEED = 600;
const MIN_CAMERA_ZOOM = 0.5;
const MAX_CAMERA_ZOOM = 2.5;
const SELECTION_DRAG_THRESHOLD = 8;

interface TacticalOfficer {
  readonly id: number;
  readonly container: Phaser.GameObjects.Container;
  readonly selectionRing: Phaser.GameObjects.Arc;
  readonly body: Phaser.GameObjects.Arc;
  readonly leftLeg: Phaser.GameObjects.Rectangle;
  readonly rightLeg: Phaser.GameObjects.Rectangle;
}

interface TacticalCivilian {
  readonly id: number;
  readonly container: Phaser.GameObjects.Container;
}

interface TacticalInfected {
  readonly id: number;
  readonly container: Phaser.GameObjects.Container;
}

export class MissionScene extends Phaser.Scene {
  private simulation!: Simulation;
  private audio!: AudioManager;
  private readonly playedCombatEvents = new WeakSet<CombatEvent>();
  private statusText!: Phaser.GameObjects.Text;
  private fullscreenText!: Phaser.GameObjects.Text;
  private cameraKeys!: Record<string, Phaser.Input.Keyboard.Key>;
  private selectionGraphics!: Phaser.GameObjects.Graphics;
  private combatGraphics!: Phaser.GameObjects.Graphics;
  private accessGraphics!: Phaser.GameObjects.Graphics;
  private buildingSystem!: BuildingSystem;
  private officers: TacticalOfficer[] = [];
  private readonly infectedVisuals = new Map<number, TacticalInfected>();
  private readonly civilianVisuals = new Map<number, TacticalCivilian>();
  private debugInfectedSpawnIndex = 0;
  private selectedOfficerIds = new Set<number>();
  private worldGrid!: GridMap;
  private tileSize = 32;
  private cameraWorldWidth = 0;
  private cameraWorldHeight = 0;
  private selectionStart: { x: number; y: number; screenX: number; screenY: number } | null = null;
  private isPaused = false;
  private resultPanel!: Phaser.GameObjects.Rectangle;
  private resultText!: Phaser.GameObjects.Text;
  private resultShown = false;

  constructor() {
    super('MissionScene');
  }

  create(): void {
    // Scene restarts reuse this scene instance; discard entity visuals keyed by old simulation IDs.
    this.infectedVisuals.clear();
    this.civilianVisuals.clear();
    this.officers = [];
    this.isPaused = false;
    this.resultShown = false;
    this.selectedOfficerIds.clear();
    this.debugInfectedSpawnIndex = 0;
    this.simulation = new Simulation();
    this.audio = new AudioManager(this);
    this.audio.startAmbient();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.audio.destroy());
    this.createWorld();
    this.createOfficers();
    this.createCivilians();
    this.createHud();
    this.createCameraControls();
    this.createSelectionControls();
    this.input.keyboard?.on('keydown-I', () => this.spawnDebugInfected());
    this.input.keyboard?.on('keydown-N', () => this.emitNoiseAtHouse());
    this.input.keyboard?.on('keydown-E', () => this.interactWithNearestAccess());
    this.input.keyboard?.on('keydown-B', () => this.breachNearestAccess());
    this.input.keyboard?.on('keydown-H', () => this.setSelectedPosture('hold_fire'));
    this.input.keyboard?.on('keydown-G', () => this.setSelectedPosture('engage'));
    this.input.keyboard?.on('keydown-X', () => this.holdSelectedPositions());
    this.input.keyboard?.on('keydown-M', () => this.audio.toggleMute());
    this.input.keyboard?.on('keydown-R', () => {
      if (this.simulation.getState().missionStatus !== 'playing') this.scene.restart();
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.simulation.getState().missionStatus !== 'playing') return;
      this.isPaused = !this.isPaused;
      this.simulation.setPaused(this.isPaused);
    });

    this.updateStatusText(0);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    this.simulation.update(dt);
    this.updateCombatFeedback();
    this.updateMissionResult();
    this.updateCamera(dt);
    if (!this.isPaused) {
      this.updateOfficers(dt);
    }
    this.updateInfectedVisuals();
    this.updateCivilianVisuals();
    this.updateAccessVisuals();
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
      [map.getObjectLayer('Collision'), map.getObjectLayer('Obstacles')],
    );

    const entrances = map.getObjectLayer('Entrances');
    const definitions = (entrances?.objects ?? []).flatMap((object) => {
      const kind = object.type as AccessKind;
      if (!['door', 'window', 'garage'].includes(kind)) return [];
      const { x, y, width, height } = object;
      if (
        typeof x !== 'number' || !Number.isFinite(x) ||
        typeof y !== 'number' || !Number.isFinite(y) ||
        typeof width !== 'number' || !Number.isFinite(width) || width <= 0 ||
        typeof height !== 'number' || !Number.isFinite(height) || height <= 0
      ) return [];
      const health = object.properties?.health;
      return [{
        id: object.name || `access-${object.id}`,
        kind,
        x,
        y,
        width,
        height,
        ...(typeof health === 'number' ? { maxHealth: health } : {}),
      }];
    });
    const configuredSeed = this.registry.get('missionSeed');
    const missionSeed = typeof configuredSeed === 'number' && Number.isInteger(configuredSeed)
      ? configuredSeed
      : Date.now();
    this.registry.set('missionSeed', missionSeed);
    this.simulation.setRandomSeed(missionSeed);
    this.buildingSystem = new BuildingSystem(definitions, this.worldGrid, this.tileSize, missionSeed);
    this.simulation.setBuildingSystem(this.buildingSystem);
    this.registry.set('worldGrid', this.worldGrid);
    this.simulation.setWorldGrid(this.worldGrid, this.tileSize);
    const spawnPoints: WaveSpawnPoint[] = [
      { id: 'west', x: 128, y: 640, entryTile: { column: 21, row: 18 } },
      { id: 'east', x: 1920, y: 640, entryTile: { column: 42, row: 18 } },
      { id: 'north', x: 1024, y: 64, entryTile: { column: 32, row: 9 } },
      { id: 'south', x: 1024, y: 1216, entryTile: { column: 32, row: 28 } },
    ];
    this.simulation.configureWaves(spawnPoints, [
      { infectedCount: 3, spawnInterval: 1.4 },
      { infectedCount: 4, spawnInterval: 1.15 },
      { infectedCount: 5, spawnInterval: 0.9 },
    ], 8);
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
      const leftLeg = this.add.rectangle(-5, 9, 5, 9, 0x24364c).setOrigin(0.5, 0.25);
      const rightLeg = this.add.rectangle(5, 9, 5, 9, 0x24364c).setOrigin(0.5, 0.25);
      const body = this.add.circle(0, 0, 10, 0x3f83d5).setStrokeStyle(2, 0xe8f2ff);
      const direction = this.add.triangle(0, -13, 0, -5, -4, 4, 4, 4, 0xffe0a3);
      const label = this.add.text(0, 13, String(officer.id), {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#172033',
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 0);
      const container = this.add.container(position.x, position.y, [ring, leftLeg, rightLeg, body, direction, label]).setDepth(100);
      return { id: officer.id, container, selectionRing: ring, body, leftLeg, rightLeg };
    });
  }

  private createCivilians(): void {
    for (const civilian of this.simulation.getCivilians()) {
      const position = civilian.position;
      const body = this.add.circle(0, 0, 9, 0xe7c66a).setStrokeStyle(2, 0x493b1c);
      const head = this.add.circle(0, -10, 5, 0xf1d4b1).setStrokeStyle(1, 0x493b1c);
      const label = this.add.text(0, 13, `C${civilian.id}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
        backgroundColor: '#493b1c',
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 0);
      const container = this.add.container(position.x, position.y, [body, head, label])
        .setDepth(105);
      this.civilianVisuals.set(civilian.id, { id: civilian.id, container });
    }
  }

  private updateCivilianVisuals(): void {
    for (const civilian of this.simulation.getCivilians()) {
      const visual = this.civilianVisuals.get(civilian.id);
      if (!visual) continue;
      visual.container.setPosition(civilian.position.x, civilian.position.y);
      visual.container.setAlpha(civilian.state === 'extracted' ? 0.45 : 1);
    }
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
    this.accessGraphics = this.add.graphics().setDepth(80);

    this.resultPanel = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 520, 190, 0x080b10, 0.92)
      .setScrollFactor(0).setDepth(2000).setStrokeStyle(2, 0xd7e0ea).setVisible(false);
    this.resultText = this.add.text(this.scale.width / 2, this.scale.height / 2, '', {
      fontFamily: 'monospace', fontSize: '26px', color: '#ffffff', align: 'center',
      padding: { x: 18, y: 12 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setVisible(false);
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




  private setSelectedPosture(posture: 'engage' | 'hold_fire'): void {
    for (const officer of this.simulation.getOfficers()) {
      if (this.selectedOfficerIds.has(officer.id)) {
        this.simulation.setOfficerTacticalPosture(officer.id, posture);
      }
    }
  }

  private holdSelectedPositions(): void {
    for (const officer of this.simulation.getOfficers()) {
      if (this.selectedOfficerIds.has(officer.id)) {
        this.simulation.holdOfficerPosition(officer.id);
      }
    }
  }

  private emitNoiseAtHouse(): void {
    const entry = MISSION_ENTRY_POINTS.find((point) => point.id === 'front-door');
    if (!entry) return;
    const target = this.buildingSystem.getInfectedTarget(entry.id, entry.approachTile, entry.breachTile);
    if (target) this.simulation.emitNoiseAtStructure(target, 1000, 10);
  }

  private findNearestAccess(): { id: string; distance: number } | null {
    const selected = this.simulation.getOfficers().filter((officer) =>
      this.selectedOfficerIds.has(officer.id) && !officer.isIncapacitated);
    if (selected.length === 0) return null;
    let nearest: { id: string; distance: number } | null = null;
    for (const access of this.simulation.getBuildingSnapshots()) {
      const cell = access.cells[0];
      if (!cell) continue;
      const x = cell.column * this.tileSize + this.tileSize / 2;
      const y = cell.row * this.tileSize + this.tileSize / 2;
      for (const officer of selected) {
        const distance = Phaser.Math.Distance.Between(x, y, officer.position.x, officer.position.y);
        if (distance <= 88 && (!nearest || distance < nearest.distance)) nearest = { id: access.id, distance };
      }
    }
    return nearest;
  }

  private interactWithNearestAccess(): void {
    if (this.isPaused) return;
    const nearest = this.findNearestAccess();
    if (nearest) this.simulation.interactWithAccess(nearest.id, 'police');
  }

  private breachNearestAccess(): void {
    if (this.isPaused) return;
    const nearest = this.findNearestAccess();
    if (nearest) this.simulation.damageAccess(nearest.id, 30);
  }

  private updateAccessVisuals(): void {
    this.accessGraphics.clear();
    const colors = { open: 0x55c878, closed: 0xe4c35b, locked: 0xe05b5b,
      barricaded: 0xd88a42, broken: 0x777777 } as const;
    for (const access of this.simulation.getBuildingSnapshots()) {
      this.accessGraphics.fillStyle(colors[access.state], 0.65);
      for (const cell of access.cells) {
        this.accessGraphics.fillRect(cell.column * this.tileSize + 4,
          cell.row * this.tileSize + 4, this.tileSize - 8, this.tileSize - 8);
      }
    }
  }

  private worldToTile(x: number, y: number): TilePosition {
    return {
      column: Math.floor(x / this.tileSize),
      row: Math.floor(y / this.tileSize),
    };
  }

  private spawnDebugInfected(): void {
    const entries = getAvailableEntryPoints(this.worldGrid);
    if (entries.length === 0) return;

    const spawnPlans = [
      { x: 128, y: 640, entryId: 'west-window' },
      { x: 1920, y: 640, entryId: 'east-window' },
      { x: 1024, y: 64, entryId: 'north-window-west' },
      { x: 1024, y: 1216, entryId: 'front-door' },
    ] as const;
    const plan = spawnPlans[this.debugInfectedSpawnIndex % spawnPlans.length]!;
    this.debugInfectedSpawnIndex += 1;
    const entry = entries.find((candidate) => candidate.id === plan.entryId) ?? entries[0]!;
    this.simulation.spawnInfected({
      x: plan.x,
      y: plan.y,
      entryTile: entry.approachTile,
    });
  }

  private updateInfectedVisuals(): void {
    const activeIds = new Set<number>();
    for (const infected of this.simulation.getInfected()) {
      activeIds.add(infected.id);
      let visual = this.infectedVisuals.get(infected.id);
      if (!visual) {
        this.audio.playInfectedGroan();
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
      if (!this.playedCombatEvents.has(event)) {
        this.playedCombatEvents.add(event);
        this.audio.playGunshot();
      }
      this.combatGraphics.lineStyle(event.hit ? 2 : 1, event.hit ? 0xffd166 : 0x9aa0a6, 0.9);
      this.combatGraphics.beginPath();
      this.combatGraphics.moveTo(event.from.x, event.from.y);
      this.combatGraphics.lineTo(event.to.x, event.to.y);
      this.combatGraphics.strokePath();
      this.combatGraphics.fillStyle(0xffdf70, 0.95);
      this.combatGraphics.fillCircle(event.from.x, event.from.y, 4);
      this.combatGraphics.lineStyle(2, 0xffdf70, 0.9);
      for (const angle of [-0.8, 0, 0.8]) {
        this.combatGraphics.beginPath();
        this.combatGraphics.moveTo(event.from.x + Math.cos(angle) * 5, event.from.y + Math.sin(angle) * 5);
        this.combatGraphics.lineTo(event.from.x + Math.cos(angle) * 10, event.from.y + Math.sin(angle) * 10);
        this.combatGraphics.strokePath();
      }
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
      const walking = officer.state === 'moving' && !officer.isIncapacitated;
      const gait = walking ? Math.sin(this.simulation.getState().elapsed * 13 + officer.id) * 0.55 : 0;
      visual.leftLeg.setRotation(gait);
      visual.rightLeg.setRotation(-gait);
      visual.body.setScale(1, walking ? 1 + Math.abs(gait) * 0.06 : 1);
      visual.body.setFillStyle(officer.isIncapacitated ? 0x65707b : 0x3f83d5);
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

  private updateMissionResult(): void {
    const status = this.simulation.getState().missionStatus;
    if (status === 'playing') return;
    if (this.resultShown) return;
    this.resultShown = true;
    this.isPaused = true;
    this.resultPanel.setVisible(true).setPosition(this.scale.width / 2, this.scale.height / 2);
    this.resultText
      .setText(status === 'victory' ? 'MISSION COMPLETE\nAll waves eliminated\n\nPress R to restart' : 'MISSION FAILED\nAll officers incapacitated\n\nPress R to restart')
      .setPosition(this.scale.width / 2, this.scale.height / 2)
      .setVisible(true);
  }

  private updateStatusText(dt: number): void {
    const state = this.simulation.getState();
    const fps = dt > 0 ? (1 / dt).toFixed(0) : '—';
    this.statusText.setText(
      [
        'Outbreak Zones — Mission',
        `Paused: ${state.paused ? 'YES' : 'NO'}  (Space) | Audio: ${this.audio.isMuted ? 'OFF' : 'ON'} (M)`,
        `Sim time: ${state.elapsed.toFixed(2)}s | Seed: ${this.registry.get('missionSeed')}`,
        `Approx FPS: ${fps}`,
        `Officers: ${state.activeOfficerCount}/${state.officerCount}  |  Infected: ${state.infectedCount}`,
        `Wave: ${state.waveNumber}/${state.totalWaves} | ${state.wavePhase.toUpperCase()} | Spawn queue: ${state.remainingToSpawn}`,
        state.wavePhase === 'preparing' ? `Next wave in: ${state.preparationRemaining.toFixed(1)}s` : `Mission: ${state.missionStatus.toUpperCase()}`,
        `Civilians: ${state.rescuedCivilianCount}/${state.civilianCount} extracted`,
        `Selected: ${this.selectedOfficerIds.size} | 1-3: select | Shift: add | Right click: move/target`,
        ...this.simulation.getOfficers().map((officer) => {
          const ammo = this.simulation.getOfficerAmmoStatus(officer.id);
          const posture = officer.tacticalPosture === 'hold_fire' ? 'HOLD FIRE' : 'ENGAGE';
          return `Officer ${officer.id}: HP ${officer.health} | Ammo ${ammo.current}/${ammo.capacity}${ammo.reloading ? ' | Reloading' : ''} | ${posture}`;
        }),
        'WASD / Arrows: camera | Wheel: zoom | F: fullscreen | I: spawn | N: noise lure | E: interact | B: breach',
        'Tactics: X hold position | H hold fire | G auto-engage | Right click infected: target priority | R: restart after result',
      ].join('\n'),
    );
  }
}
