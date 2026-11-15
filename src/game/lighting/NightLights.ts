import type Phaser from 'phaser';
import type { DayPhase } from '../../simulation/systems/DayNightSystem';
import { PHASE_TINTS } from './DayNightVisuals';

export interface LampSpec {
  readonly x: number;
  readonly y: number;
  readonly color?: number;
  readonly radius?: number;
  readonly intensity?: number;
  readonly attenuation?: number;
}

export interface NightLightsOptions {
  readonly depth?: number;
  readonly defaultColor?: number;
  readonly defaultRadius?: number;
  readonly defaultIntensity?: number;
  readonly defaultAttenuation?: number;
}

interface ManagedLamp {
  readonly light: Phaser.GameObjects.PointLight;
  readonly baseIntensity: number;
}

const DEFAULTS = {
  depth: 1401,
  color: 0xe8d878,
  radius: 140,
  intensity: 0.55,
  attenuation: 0.06,
} as const;

export class NightLights {
  private readonly scene: Phaser.Scene;
  private readonly lamps: ManagedLamp[] = [];
  private readonly opts: Required<NightLightsOptions>;
  private enabled = true;
  private intensityMultiplier = 0;

  constructor(scene: Phaser.Scene, options: NightLightsOptions = {}) {
    this.scene = scene;
    this.opts = {
      depth: options.depth ?? DEFAULTS.depth,
      defaultColor: options.defaultColor ?? DEFAULTS.color,
      defaultRadius: options.defaultRadius ?? DEFAULTS.radius,
      defaultIntensity: options.defaultIntensity ?? DEFAULTS.intensity,
      defaultAttenuation: options.defaultAttenuation ?? DEFAULTS.attenuation,
    };
  }

  addLamp(spec: LampSpec): Phaser.GameObjects.PointLight {
    if (!Number.isFinite(spec.x) || !Number.isFinite(spec.y)) {
      throw new RangeError('Lamp coordinates must be finite numbers.');
    }
    const radius = spec.radius ?? this.opts.defaultRadius;
    const intensity = spec.intensity ?? this.opts.defaultIntensity;
    const attenuation = spec.attenuation ?? this.opts.defaultAttenuation;
    if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(intensity) || intensity < 0 ||
        !Number.isFinite(attenuation) || attenuation < 0 || attenuation > 1) {
      throw new RangeError('Lamp radius, intensity or attenuation is invalid.');
    }

    const light = this.scene.add.pointlight(
      spec.x,
      spec.y,
      spec.color ?? this.opts.defaultColor,
      radius,
      0,
      attenuation,
    );
    light.setDepth(this.opts.depth);
    this.lamps.push({ light, baseIntensity: intensity });
    this.applyIntensity(this.lamps[this.lamps.length - 1]!);
    return light;
  }

  addLamps(specs: readonly LampSpec[]): void {
    for (const spec of specs) this.addLamp(spec);
  }

  syncPhase(phase: DayPhase): void {
    this.syncIntensity(PHASE_TINTS[phase].localLightMul);
  }

  syncIntensity(multiplier: number): void {
    this.intensityMultiplier = Math.max(0, Math.min(1, Number.isFinite(multiplier) ? multiplier : 0));
    for (const lamp of this.lamps) this.applyIntensity(lamp);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    for (const lamp of this.lamps) this.applyIntensity(lamp);
  }

  getLampCount(): number {
    return this.lamps.length;
  }

  destroy(): void {
    for (const { light } of this.lamps) light.destroy();
    this.lamps.length = 0;
  }

  private applyIntensity(lamp: ManagedLamp): void {
    const next = this.enabled ? lamp.baseIntensity * this.intensityMultiplier : 0;
    lamp.light.intensity = next;
    lamp.light.setVisible(next > 0.001);
  }
}

/** Gera posições de lâmpadas regulares para mapas de teste ou protótipos. */
export function gridLampPositions(
  columns: number,
  rows: number,
  tileSize: number,
  stepTiles: number,
  insetTiles = 2,
): LampSpec[] {
  if (![columns, rows, tileSize, stepTiles, insetTiles].every(Number.isFinite) ||
      columns <= 0 || rows <= 0 || tileSize <= 0 || stepTiles <= 0 || insetTiles < 0) {
    throw new RangeError('Grid lamp dimensions and spacing must be valid positive numbers.');
  }
  const specs: LampSpec[] = [];
  for (let row = insetTiles; row < rows - insetTiles; row += stepTiles) {
    for (let col = insetTiles; col < columns - insetTiles; col += stepTiles) {
      specs.push({ x: col * tileSize + tileSize / 2, y: row * tileSize + tileSize / 2 });
    }
  }
  return specs;
}
