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
const MISSION_SEED_STORAGE_KEY = 'outbreakzones:mission-seed';
const BUILDING_STATE_STORAGE_PREFIX = 'outbreakzones:building-state:';

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

interface MinimapVisibility {
  officers: boolean;
  civilians: boolean;
  infected: boolean;
}

const MINIMAP_CONFIG_KEY = 'outbreakzones:minimap-visibility';
const HUD_COLORS = {
  ink: 0x111415,
  panel: 0x1b2021,
  metal: 0xb9b9b0,
  muted: 0x858a87,
  paper: 0xe8e3d8,
  red: 0xc33a36,
  officer: 0x5c9be6,
  civilian: 0xe7c66a,
  infected: 0xc33a36,
} as const;

export class MissionScene extends Phaser.Scene {
  private simulation!: Simulation;
  private audio!: AudioManager;
  private readonly playedCombatEvents = new WeakSet<CombatEvent>();
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
  private lastPersistedBuildingState = '';
  private hudPanels!: Phaser.GameObjects.Graphics;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private missionText!: Phaser.GameObjects.Text;
  private teamText!: Phaser.GameObjects.Text;
  private settingsButton!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Rectangle;
  private pausePanel!: Phaser.GameObjects.Rectangle;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pauseSubtitle!: Phaser.GameObjects.Text;
  private resumeButton!: Phaser.GameObjects.Text;
  private resetButton!: Phaser.GameObjects.Text;
  private settingsMenuButton!: Phaser.GameObjects.Text;
  private homeButton!: Phaser.GameObjects.Text;
  private settingsBackButton!: Phaser.GameObjects.Text;
  private pauseSettingsOpen = false;
  private officerToggle!: Phaser.GameObjects.Text;
  private civilianToggle!: Phaser.GameObjects.Text;
  private infectedToggle!: Phaser.GameObjects.Text;
  private minimapVisibility: MinimapVisibility = {
    officers: true,
    civilians: true,
    infected: true,
  };
  private pauseMenuOpen = false;
  private readonly hudBounds = {
    settings: { x: 20, y: 20, width: 56, height: 56 },
    mission: { x: 20, y: 88, width: 276, height: 142 },
    minimap: { x: 0, y: 20, width: 320, height: 354 },
    team: { x: 0, y: 384, width: 320, height: 154 },
  };

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
      if (this.simulation.getState().missionStatus !== 'playing') this.restartMission();
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.simulation.getState().missionStatus !== 'playing') return;
      this.setPausedFromKeyboard();
    });

    this.updateHud();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    this.simulation.update(dt);
    this.updateCombatFeedback();
    this.updateMissionResult();
    this.persistBuildingState();
    this.updateCamera(dt);
    this.clampCamera();
    if (!this.isPaused) {
      this.updateOfficers(dt);
    }
    this.updateInfectedVisuals();
    this.updateCivilianVisuals();
    this.updateAccessVisuals();
    this.updateHud();
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
    const storedSeed = this.readStoredMissionSeed();
    const missionSeed = typeof configuredSeed === 'number' && Number.isInteger(configuredSeed)
      ? configuredSeed
      : storedSeed ?? Date.now();
    this.registry.set('missionSeed', missionSeed);
    this.writeStorage(MISSION_SEED_STORAGE_KEY, String(missionSeed));
    this.simulation.setRandomSeed(missionSeed);
    this.buildingSystem = new BuildingSystem(definitions, this.worldGrid, this.tileSize, missionSeed);
    const savedBuildingState = this.readStorage(`${BUILDING_STATE_STORAGE_PREFIX}${missionSeed}`);
    if (savedBuildingState) {
      try {
        this.buildingSystem.restoreState(JSON.parse(savedBuildingState) as ReturnType<BuildingSystem['exportState']>);
      } catch {
        this.removeStorage(`${BUILDING_STATE_STORAGE_PREFIX}${missionSeed}`);
      }
    }
    this.lastPersistedBuildingState = JSON.stringify(this.buildingSystem.exportState());
    this.simulation.setBuildingSystem(this.buildingSystem);
    this.registry.set('worldGrid', this.worldGrid);
    this.simulation.setWorldGrid(this.worldGrid, this.tileSize);
    this.simulation.setExtractionZone({ x: 1280, y: 720, radius: 72 });
    this.add.circle(1280, 720, 72, 0x55c878, 0.08)
      .setStrokeStyle(3, 0x55c878, 0.85).setDepth(70);
    const spawnPoints: WaveSpawnPoint[] = [
      { id: 'west', x: 128, y: 640, entryTile: { column: 21, row: 18 } },
      { id: 'east', x: 2496, y: 720, entryTile: { column: 77, row: 22 } },
      { id: 'north', x: 1024, y: 64, entryTile: { column: 32, row: 9 } },
      { id: 'south', x: 1280, y: 1408, entryTile: { column: 40, row: 43 } },
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

  private readStorage(key: string): string | null {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable in private browsing or restricted contexts.
    }
  }

  private removeStorage(key: string): void {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    } catch {
      // Storage can be unavailable in private browsing or restricted contexts.
    }
  }

  private readStoredMissionSeed(): number | null {
    const raw = this.readStorage(MISSION_SEED_STORAGE_KEY);
    if (!raw) return null;
    const seed = Number(raw);
    return Number.isInteger(seed) ? seed : null;
  }

  private persistBuildingState(): void {
    if (!this.buildingSystem) return;
    const serialized = JSON.stringify(this.buildingSystem.exportState());
    if (serialized === this.lastPersistedBuildingState) return;
    const seed = this.registry.get('missionSeed');
    if (typeof seed !== 'number' || !Number.isInteger(seed)) return;
    this.writeStorage(`${BUILDING_STATE_STORAGE_PREFIX}${seed}`, serialized);
    this.lastPersistedBuildingState = serialized;
  }

  private restartMission(): void {
    const seed = this.registry.get('missionSeed');
    if (typeof seed === 'number' && Number.isInteger(seed)) {
      this.removeStorage(`${BUILDING_STATE_STORAGE_PREFIX}${seed}`);
    }
    this.removeStorage(MISSION_SEED_STORAGE_KEY);
    this.registry.remove('missionSeed');
    this.scene.restart();
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
    const width = this.scale.width;
    const height = this.scale.height;
    const viewX = this.cameras.main.scrollX;
    const viewY = this.cameras.main.scrollY;
    const mapX = viewX + width - 340;
    const mapY = viewY + 20;

    this.hudBounds.settings.x = viewX + 20;
    this.hudBounds.settings.y = viewY + 20;
    this.hudBounds.mission.x = viewX + 20;
    this.hudBounds.mission.y = viewY + 88;
    this.hudBounds.minimap.x = mapX;
    this.hudBounds.minimap.y = mapY;
    this.hudBounds.team.x = mapX;
    this.hudBounds.team.y = mapY + 364;

    // The tactical HUD belongs to the world layer and moves with the camera.
    this.hudPanels = this.add.graphics().setDepth(1500);
    this.minimapGraphics = this.add.graphics().setDepth(1502);
    this.selectionGraphics = this.add.graphics().setScrollFactor(0).setDepth(999);
    this.combatGraphics = this.add.graphics().setDepth(120);
    this.accessGraphics = this.add.graphics().setDepth(80);

    this.hudPanels.fillStyle(HUD_COLORS.panel, 0.94);
    this.hudPanels.lineStyle(1, HUD_COLORS.metal, 0.24);
    this.hudPanels.fillRoundedRect(viewX + 20, viewY + 20, 56, 56, 8);
    this.hudPanels.strokeRoundedRect(viewX + 20, viewY + 20, 56, 56, 8);
    this.hudPanels.fillRoundedRect(viewX + 20, viewY + 88, 276, 142, 8);
    this.hudPanels.strokeRoundedRect(viewX + 20, viewY + 88, 276, 142, 8);
    this.hudPanels.fillRoundedRect(mapX, mapY, 320, 354, 12);
    this.hudPanels.strokeRoundedRect(mapX, mapY, 320, 354, 12);
    this.hudPanels.fillStyle(HUD_COLORS.officer, 1);
    this.hudPanels.fillCircle(mapX + 18, mapY + 338, 3);
    this.hudPanels.fillStyle(HUD_COLORS.civilian, 1);
    this.hudPanels.fillCircle(mapX + 112, mapY + 338, 3);
    this.hudPanels.fillStyle(HUD_COLORS.infected, 1);
    this.hudPanels.fillCircle(mapX + 194, mapY + 338, 3);
    this.hudPanels.fillRoundedRect(mapX, mapY + 364, 320, 154, 8);
    this.hudPanels.strokeRoundedRect(mapX, mapY + 364, 320, 154, 8);

    this.settingsButton = this.add.text(viewX + 48, viewY + 48, '⚙', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '29px',
      color: '#e8e3d8',
    }).setOrigin(0.5).setDepth(1505)
      .setInteractive({ useHandCursor: true });
    this.settingsButton.on('pointerdown', () => this.openPauseMenu());

    this.missionText = this.add.text(viewX + 36, viewY + 102, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#e8e3d8',
      lineSpacing: 8,
      wordWrap: { width: 244 },
    }).setDepth(1505);

    this.add.text(mapX + 12, mapY + 9, 'ÁREA DE OPERAÇÃO', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#b9b9b0',
      letterSpacing: 1.4,
    }).setDepth(1505);
    [
      { x: mapX + 28, label: 'POLICIAIS' },
      { x: mapX + 122, label: 'CIVIS' },
      { x: mapX + 204, label: 'INFECTADOS' },
    ].forEach(({ x, label }) => {
      this.add.text(x, mapY + 211, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '7px',
        color: '#858a87',
      }).setDepth(1505);
    });

    this.teamText = this.add.text(mapX + 12, mapY + 376, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#e8e3d8',
      lineSpacing: 8,
    }).setDepth(1505);

    const teamHitArea = this.add.rectangle(mapX + 160, mapY + 441, 296, 142, 0xffffff, 0.001)
      .setDepth(1507)
      .setInteractive({ useHandCursor: true });
    teamHitArea.on('pointerdown', () => this.selectAllOfficers());

    this.pauseOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x080a0a, 0.72)
      .setScrollFactor(0).setDepth(1900).setVisible(false);
    this.pausePanel = this.add.rectangle(width / 2, height / 2, 410, 440, HUD_COLORS.panel, 1)
      .setScrollFactor(0).setDepth(1901).setStrokeStyle(1, HUD_COLORS.red, 0.8).setVisible(false);
    this.pauseTitle = this.add.text(width / 2, height / 2 - 188, 'OPERAÇÃO PAUSADA', {
      fontFamily: 'Barlow Condensed, Impact, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#e8e3d8',
      letterSpacing: 1.5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1902).setVisible(false);
    this.pauseSubtitle = this.add.text(width / 2, height / 2 - 148, 'ESCOLHA UMA AÇÃO', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      color: '#858a87',
      letterSpacing: 1.4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1902).setVisible(false);

    this.officerToggle = this.createPauseToggle(width / 2, height / 2 - 64, 'POLICIAIS', 'officers');
    this.civilianToggle = this.createPauseToggle(width / 2, height / 2 - 8, 'CIVIS', 'civilians');
    this.infectedToggle = this.createPauseToggle(width / 2, height / 2 + 48, 'INFECTADOS', 'infected');

    this.resumeButton = this.createPauseAction(width / 2, height / 2 - 92, 'RETOMAR', () => this.closePauseMenu());
    this.resetButton = this.createPauseAction(width / 2, height / 2 - 24, 'RESETAR', () => this.restartMission());
    this.settingsMenuButton = this.createPauseAction(width / 2, height / 2 + 44, 'CONFIGURAÇÕES', () => {
      this.pauseSettingsOpen = true;
      this.setPauseMenuVisible(true);
    });
    this.homeButton = this.createPauseAction(width / 2, height / 2 + 112, 'VOLTAR À TELA INICIAL', () => this.returnToHome());
    this.settingsBackButton = this.createPauseAction(width / 2, height / 2 + 128, 'VOLTAR', () => {
      this.pauseSettingsOpen = false;
      this.setPauseMenuVisible(true);
    });

    this.resultPanel = this.add.rectangle(width / 2, height / 2, 520, 190, 0x111415, 0.96)
      .setScrollFactor(0).setDepth(2000).setStrokeStyle(2, HUD_COLORS.red).setVisible(false);
    this.resultText = this.add.text(width / 2, height / 2, '', {
      fontFamily: 'Barlow Condensed, Impact, sans-serif',
      fontSize: '26px',
      color: '#e8e3d8',
      align: 'center',
      padding: { x: 18, y: 12 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setVisible(false);

    this.loadMinimapVisibility();
    this.refreshPauseMenuLabels();
  }

  private createPauseAction(
    x: number,
    y: number,
    label: string,
    action: () => void,
  ): Phaser.GameObjects.Text {
    const button = this.add.text(x, y, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#fff5e9',
      backgroundColor: '#252c2d',
      padding: { x: 22, y: 12 },
      fixedWidth: 280,
      align: 'center',
      letterSpacing: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1902).setVisible(false)
      .setInteractive({ useHandCursor: true });
    button.on('pointerdown', action);
    return button;
  }

  private createPauseToggle(
    x: number,
    y: number,
    label: string,
    key: keyof MinimapVisibility,
  ): Phaser.GameObjects.Text {
    const toggle = this.add.text(x, y, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: '#e8e3d8',
      backgroundColor: '#252c2d',
      padding: { x: 16, y: 10 },
      fixedWidth: 230,
      align: 'left',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1902).setVisible(false)
      .setInteractive({ useHandCursor: true });
    toggle.on('pointerdown', () => {
      this.minimapVisibility[key] = !this.minimapVisibility[key];
      this.saveMinimapVisibility();
      this.refreshPauseMenuLabels();
      this.updateHud();
    });
    return toggle;
  }

  private loadMinimapVisibility(): void {
    const saved = this.readStorage(MINIMAP_CONFIG_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Partial<MinimapVisibility>;
      this.minimapVisibility = {
        officers: parsed.officers !== false,
        civilians: parsed.civilians !== false,
        infected: parsed.infected !== false,
      };
    } catch {
      this.minimapVisibility = { officers: true, civilians: true, infected: true };
    }
  }

  private saveMinimapVisibility(): void {
    this.writeStorage(MINIMAP_CONFIG_KEY, JSON.stringify(this.minimapVisibility));
  }

  private refreshPauseMenuLabels(): void {
    const label = (name: string, enabled: boolean) => `${name}     [${enabled ? 'ATIVO' : 'OCULTO'}]`;
    this.officerToggle.setText(label('POLICIAIS', this.minimapVisibility.officers));
    this.civilianToggle.setText(label('CIVIS', this.minimapVisibility.civilians));
    this.infectedToggle.setText(label('INFECTADOS', this.minimapVisibility.infected));
  }

  private openPauseMenu(): void {
    if (this.simulation.getState().missionStatus !== 'playing' || this.pauseMenuOpen) return;
    this.pauseMenuOpen = true;
    this.pauseSettingsOpen = false;
    this.isPaused = true;
    this.simulation.setPaused(true);
    this.setPauseMenuVisible(true);
  }

  private returnToHome(): void {
    window.dispatchEvent(new Event('outbreakzones:return-home'));
  }

  private closePauseMenu(): void {
    this.pauseMenuOpen = false;
    this.isPaused = false;
    this.simulation.setPaused(false);
    this.setPauseMenuVisible(false);
  }

  private setPauseMenuVisible(visible: boolean): void {
    [
      this.pauseOverlay, this.pausePanel, this.pauseTitle, this.pauseSubtitle,
    ].forEach((object) => object.setVisible(visible));
    const mainActions = [this.resumeButton, this.resetButton, this.settingsMenuButton, this.homeButton];
    const settingsActions = [
      this.officerToggle, this.civilianToggle, this.infectedToggle, this.settingsBackButton,
    ];
    mainActions.forEach((object) => object.setVisible(visible && !this.pauseSettingsOpen));
    settingsActions.forEach((object) => object.setVisible(visible && this.pauseSettingsOpen));
    this.pauseSubtitle.setText(this.pauseSettingsOpen ? 'CONFIGURAÇÕES DO MINIMAPA' : 'ESCOLHA UMA AÇÃO');
  }

  private setPausedFromKeyboard(): void {
    if (this.pauseMenuOpen) {
      this.closePauseMenu();
      return;
    }
    this.openPauseMenu();
  }

  private selectAllOfficers(): void {
    this.selectedOfficerIds.clear();
    for (const officer of this.simulation.getOfficers()) {
      if (!officer.isIncapacitated) this.selectedOfficerIds.add(officer.id);
    }
    this.refreshSelectionVisuals();
  }

  private isHudPoint(x: number, y: number): boolean {
    const worldPoint = this.cameras.main.getWorldPoint(x, y);
    const inside = (rect: { x: number; y: number; width: number; height: number }) =>
      worldPoint.x >= rect.x && worldPoint.x <= rect.x + rect.width &&
      worldPoint.y >= rect.y && worldPoint.y <= rect.y + rect.height;
    return inside(this.hudBounds.settings) || inside(this.hudBounds.mission) ||
      inside(this.hudBounds.minimap) || inside(this.hudBounds.team) ||
      this.pauseMenuOpen;
  }

  private updateHud(): void {
    if (!this.simulation || !this.minimapGraphics) return;
    const state = this.simulation.getState();
    const civilians = this.simulation.getCivilians();
    const officers = this.simulation.getOfficers();
    const waveLabel = state.wavePhase === 'preparing'
      ? `PRÓXIMA ONDA EM ${state.preparationRemaining.toFixed(0)}s`
      : `ONDA ${state.waveNumber || 1} / ${state.totalWaves}`;
    const objective = state.missionStatus === 'victory'
      ? 'MISSÃO CONCLUÍDA'
      : state.missionStatus === 'defeat'
        ? 'EQUIPE INCAPACITADA'
        : 'RESGATAR SOBREVIVENTES';
    this.missionText.setText([
      'MISSÃO 01  /  SETOR 07',
      objective,
      `CIVIS RESGATADOS  ${state.rescuedCivilianCount} / ${state.civilianCount}`,
      `AMEAÇAS ATIVAS  ${state.infectedCount}`,
      waveLabel,
    ].join('\n'));

    const teamLines = officers.map((officer) => {
      const selected = this.selectedOfficerIds.has(officer.id) && !officer.isIncapacitated;
      const status = officer.isIncapacitated ? 'FORA DE COMBATE' : selected ? 'SELECIONADO' : 'OPERACIONAL';
      const health = Math.max(0, Math.round((officer.health / officer.maxHealth) * 100));
      return `[${selected ? '◆' : ' '}]${officer.id}  ${status.padEnd(16)} ${health}%`;
    });
    this.teamText.setText(['EQUIPE  /  CLIQUE PARA SELECIONAR TODOS', ...teamLines].join('\n'));

    this.minimapGraphics.clear();
    const mapX = this.hudBounds.minimap.x + 12;
    const mapY = this.hudBounds.minimap.y + 30;
    const mapWidth = 296;
    const mapHeight = 296;
    const markerInset = 14;
    this.minimapGraphics.fillStyle(0x101516, 1);
    this.minimapGraphics.fillRoundedRect(mapX, mapY, mapWidth, mapHeight, 12);
    this.minimapGraphics.lineStyle(1, HUD_COLORS.metal, 0.3);
    this.minimapGraphics.strokeRoundedRect(mapX, mapY, mapWidth, mapHeight, 12);

    const toMinimap = (position: { x: number; y: number }) => ({
      x: mapX + markerInset + Phaser.Math.Clamp(position.x / this.cameraWorldWidth, 0, 1) * (mapWidth - markerInset * 2),
      y: mapY + markerInset + Phaser.Math.Clamp(position.y / this.cameraWorldHeight, 0, 1) * (mapHeight - markerInset * 2),
    });

    if (this.minimapVisibility.civilians) {
      for (const civilian of civilians) {
        if (civilian.state === 'extracted') continue;
        const point = toMinimap(civilian.position);
        this.minimapGraphics.fillStyle(HUD_COLORS.civilian, 1);
        this.minimapGraphics.fillCircle(point.x, point.y, 3.5);
      }
    }
    if (this.minimapVisibility.infected) {
      for (const infected of this.simulation.getInfected()) {
        const point = toMinimap(infected.position);
        this.minimapGraphics.fillStyle(HUD_COLORS.infected, 1);
        this.minimapGraphics.fillCircle(point.x, point.y, 3.5);
      }
    }
    if (this.minimapVisibility.officers) {
      for (const officer of officers) {
        const point = toMinimap(officer.position);
        this.minimapGraphics.fillStyle(officer.isIncapacitated ? HUD_COLORS.muted : HUD_COLORS.officer, 1);
        this.minimapGraphics.fillCircle(point.x, point.y, this.selectedOfficerIds.has(officer.id) ? 5 : 4);
        if (this.selectedOfficerIds.has(officer.id)) {
          this.minimapGraphics.lineStyle(1, HUD_COLORS.paper, 0.95);
          this.minimapGraphics.strokeCircle(point.x, point.y, 7);
        }
      }
    }

    const camera = this.cameras.main;
    const viewX = mapX + Phaser.Math.Clamp(camera.scrollX / this.cameraWorldWidth, 0, 1) * mapWidth;
    const viewY = mapY + Phaser.Math.Clamp(camera.scrollY / this.cameraWorldHeight, 0, 1) * mapHeight;
    const viewWidth = Phaser.Math.Clamp((camera.width / camera.zoom) / this.cameraWorldWidth * mapWidth, 2, mapWidth);
    const viewHeight = Phaser.Math.Clamp((camera.height / camera.zoom) / this.cameraWorldHeight * mapHeight, 2, mapHeight);
    this.minimapGraphics.lineStyle(1, HUD_COLORS.paper, 0.8);
    this.minimapGraphics.strokeRoundedRect(
      Phaser.Math.Clamp(viewX, mapX + markerInset, mapX + mapWidth - markerInset - viewWidth),
      Phaser.Math.Clamp(viewY, mapY + markerInset, mapY + mapHeight - markerInset - viewHeight),
      Math.min(viewWidth, mapWidth - markerInset * 2),
      Math.min(viewHeight, mapHeight - markerInset * 2),
      4,
    );

    this.settingsButton.setColor(this.pauseMenuOpen ? '#c33a36' : '#e8e3d8');
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
        const minimumZoom = Math.max(
          MIN_CAMERA_ZOOM,
          camera.width / this.cameraWorldWidth,
          camera.height / this.cameraWorldHeight,
        );
        const nextZoom = camera.zoom * (deltaY > 0 ? 0.9 : 1.1);
        camera.setZoom(Phaser.Math.Clamp(nextZoom, minimumZoom, MAX_CAMERA_ZOOM));
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
      if (this.isHudPoint(pointer.x, pointer.y)) return;
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
    const selected = this.simulation.getOfficers().filter((officer) =>
      this.selectedOfficerIds.has(officer.id) && !officer.isIncapacitated);
    let nearestCivilian: { id: number; officerId: number; distance: number } | null = null;
    for (const civilian of this.simulation.getCivilians()) {
      if (civilian.state !== 'sheltered') continue;
      for (const officer of selected) {
        const distance = Phaser.Math.Distance.Between(
          civilian.position.x, civilian.position.y, officer.position.x, officer.position.y,
        );
        if (distance <= 80 && (!nearestCivilian || distance < nearestCivilian.distance)) {
          nearestCivilian = { id: civilian.id, officerId: officer.id, distance };
        }
      }
    }
    if (nearestCivilian) {
      this.simulation.rescueCivilian(nearestCivilian.id, nearestCivilian.officerId);
      return;
    }
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
    const minimumZoom = Math.max(
      MIN_CAMERA_ZOOM,
      camera.width / this.cameraWorldWidth,
      camera.height / this.cameraWorldHeight,
    );
    if (camera.zoom < minimumZoom) camera.setZoom(minimumZoom);
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
    this.simulation.setPaused(true);
    this.pauseMenuOpen = false;
    this.setPauseMenuVisible(false);
    this.resultPanel.setVisible(true).setPosition(this.scale.width / 2, this.scale.height / 2);
    this.resultText
      .setText(status === 'victory' ? 'MISSION COMPLETE\nAll civilians rescued\nAll waves eliminated\n\nPress R to restart' : 'MISSION FAILED\nAll officers incapacitated\n\nPress R to restart')
      .setPosition(this.scale.width / 2, this.scale.height / 2)
      .setVisible(true);
  }


}
