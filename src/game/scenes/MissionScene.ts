import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { DEFAULT_HUD_SCALE, normalizeHudScale } from '../HudScale';
import { canStartCampaign, getMissionDefinition, getMissionResultMessage, type MissionId } from '../MissionProgression';
import { Simulation } from '../../simulation/Simulation';
import type { CombatEvent } from '../../simulation/systems/CombatSystem';
import { GridMap } from '../../simulation/world/GridMap';
import type { TilePosition } from '../../simulation/world/WorldConfig';
import { buildGridFromTiledLayers } from '../../simulation/world/WorldMapLoader';
import { getAvailableEntryPoints, MISSION_ENTRY_POINTS } from '../../simulation/world/MissionEntryPoints';
import { BuildingSystem, type AccessKind } from '../../simulation/systems/buildings/BuildingSystem';
import type { WaveSpawnPoint } from '../../simulation/systems/WaveSystem';
import type { MaintenanceAction, MaintenanceState } from '../../simulation/systems/buildings/BuildingMaintenanceSystem';
import { DeployableStructureSystem, type DeployableKind, type DeployableState } from '../../simulation/systems/buildings/DeployableStructureSystem';

const CAMERA_SPEED = 600;
const MIN_CAMERA_ZOOM = 0.5;
const MAX_CAMERA_ZOOM = 2.5;
const SELECTION_DRAG_THRESHOLD = 8;
const MISSION_SEED_STORAGE_KEY = 'outbreakzones:mission-seed';
const CAMPAIGN_UNLOCK_STORAGE_KEY = 'outbreakzones:campaign-unlocked';
const BUILDING_STATE_STORAGE_PREFIX = 'outbreakzones:building-state:';
const MAINTENANCE_STATE_STORAGE_PREFIX = 'outbreakzones:maintenance-state:';
const DEPLOYABLE_STATE_STORAGE_PREFIX = 'outbreakzones:deployable-state:';

interface TacticalOfficer {
  readonly id: number;
  readonly container: Phaser.GameObjects.Container;
  readonly selectionRing: Phaser.GameObjects.Arc;
  readonly sprite: Phaser.GameObjects.Sprite;
}

interface TacticalCivilian {
  readonly id: number;
  readonly container: Phaser.GameObjects.Container;
  readonly sprite: Phaser.GameObjects.Sprite;
  lastX: number;
  lastY: number;
}

interface TacticalInfected {
  readonly id: number;
  readonly container: Phaser.GameObjects.Container;
  readonly sprite: Phaser.GameObjects.Sprite;
}

interface MinimapVisibility {
  officers: boolean;
  civilians: boolean;
  infected: boolean;
}

const MINIMAP_CONFIG_KEY = 'outbreakzones:minimap-visibility';
const HUD_SCALE_STORAGE_KEY = 'outbreakzones:hud-scale';
const HUD_COLORS = {
  ink: 0x111415,
  panel: 0x101516,
  metal: 0xb9b9b0,
  muted: 0xc0c5bd,
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
  private deployableGraphics!: Phaser.GameObjects.Graphics;
  private placementMode: DeployableKind | null = null;
  private selectedDeployableId: number | null = null;
  private buildStatus = '';
  private readonly buildButtons: Phaser.GameObjects.Text[] = [];
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
  private resultHomeButton!: Phaser.GameObjects.Text;
  private resultCampaignButton!: Phaser.GameObjects.Text;
  private resultRestartButton!: Phaser.GameObjects.Text;
  private missionId: MissionId = 0;
  private resultShown = false;
  private lastPersistedBuildingState = '';
  private lastPersistedMaintenanceState = '';
  private lastPersistedDeployableState = '';
  private hudRoot!: Phaser.GameObjects.Container;
  private hudScale = DEFAULT_HUD_SCALE;
  private hudScaleDownButton!: Phaser.GameObjects.Text;
  private hudScaleUpButton!: Phaser.GameObjects.Text;
  private hudPanels!: Phaser.GameObjects.Graphics;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private missionText!: Phaser.GameObjects.Text;
  private teamText!: Phaser.GameObjects.Text;
  private settingsButton!: Phaser.GameObjects.Text;
  private fullscreenButton!: Phaser.GameObjects.Text;
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
    settings: { x: 20, y: 20, width: 124, height: 56 },
    mission: { x: 20, y: 88, width: 276, height: 142 },
    minimap: { x: 0, y: 20, width: 320, height: 354 },
    team: { x: 0, y: 384, width: 320, height: 154 },
    build: { x: 20, y: 0, width: 440, height: 64 },
  };

  constructor() {
    super('MissionScene');
  }

  create(): void {
    this.infectedVisuals.clear();
    this.civilianVisuals.clear();
    this.officers = [];
    this.isPaused = false;
    this.resultShown = false;
    this.selectedOfficerIds.clear();
    this.debugInfectedSpawnIndex = 0;
    this.placementMode = null;
    this.selectedDeployableId = null;
    this.buildStatus = '';
    this.missionId = this.registry.get('missionId') === 1 ? 1 : 0;
    this.hudScale = normalizeHudScale(this.readStorage(HUD_SCALE_STORAGE_KEY));
    this.simulation = new Simulation();
    this.audio = new AudioManager(this);
    this.audio.startAmbient();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.audio.destroy());
    this.createCharacterAnimations();
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
    this.input.keyboard?.on('keydown-Y', () => this.startMaintenance('repair'));
    this.input.keyboard?.on('keydown-U', () => this.startMaintenance('reinforce'));
    this.input.keyboard?.on('keydown-V', () => this.startMaintenance('barricade'));
    this.input.keyboard?.on('keydown-L', () => this.startMaintenance('upgrade-lock'));
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
    this.persistMaintenanceState();
    this.persistDeployableState();
    this.updateCamera(dt);
    this.clampCamera();
    if (!this.isPaused) {
      this.updateOfficers(dt);
    }
    this.updateInfectedVisuals();
    this.updateCivilianVisuals();
    this.updateAccessVisuals();
    this.updateDeployableVisuals();
    this.updateHud();
  }

  private createWorld(): void {
    const map = this.make.tilemap({ key: 'mission-01' });
    // Atlas experimental 64×64; world tile size stays 32 — scale layers by 0.5.
    const tileset = map.addTilesetImage('mission-tiles', 'mission-tiles', 64, 64);

    if (!tileset) {
      throw new Error('Unable to attach the mission tileset to the Tiled map.');
    }

    for (const layerName of ['Ground', 'Terrain', 'Structures']) {
      const layer = map.createLayer(layerName, tileset, 0, 0);
      if (!layer) {
        throw new Error(`Required Tiled layer "${layerName}" is missing.`);
      }
      layer.setScale(0.5);
    }

    this.tileSize = map.tileWidth;
    this.worldGrid = buildGridFromTiledLayers(
      map.width,
      map.height,
      map.tileWidth,
      [map.getObjectLayer('Collision'), map.getObjectLayer('Obstacles')],
    );

    // NOTE: remainder of MissionScene omitted due to tool size limits — this branch needs full file from local MissionScene_64.ts
    // Temporary: throw to avoid silent broken gameplay
    throw new Error('MissionScene incomplete on branch — re-apply full file from PR description');
  }

  private readStorage(key: string): string | null {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
}
