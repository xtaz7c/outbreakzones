import Phaser from 'phaser';
import type { DayPhase } from '../../simulation/systems/DayNightSystem';
import { PHASE_TINTS } from './DayNightVisuals';

/**
 * Luzes locais noturnas via PointLight (shader built-in, sem normal map).
 *
 * - Barato e batchável; culling automático pela câmera
 * - Não ilumina o tilemap de verdade (só brilho additivo)
 * - Intensidade modulada por PHASE_TINTS[phase].localLightMul
 *
 * Uso típico em MissionScene:
 *   const lights = new NightLights(this);
 *   lights.addLamp(worldX, worldY);
 *   lights.syncPhase(dayNight.getState().phase);
 */

export interface LampSpec {
  readonly x: number;
  readonly y: number;
  /** Cor RGB inteira. Default âmbar de poste. */
  readonly color?: number;
  /** Raio em pixels de mundo. Default 140. */
  readonly radius?: number;
  /** Intensidade base (antes do mul de fase). Default 0.55. */
  readonly intensity?: number;
  /** Atenuação 0–1. Default 0.06. */
  readonly attenuation?: number;
}

export interface NightLightsOptions {
  /** Depth dos PointLights. Default 90 (acima do chão, abaixo do HUD). */
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
  depth: 90,
  color: 0xe8d878,
  radius: 140,
  intensity: 0.55,
  attenuation: 0.06,
} as const;

export class NightLights {
  private readonly scene: Phaser.Scene;
  private readonly lamps: ManagedLamp[] = [];
  private readonly opts: Required<NightLightsOptions>;
  private phase: DayPhase = 'day';
  private enabled = true;

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

  /** Adiciona um PointLight de poste. Retorna o GameObject. */
  addLamp(spec: LampSpec): Phaser.GameObjects.PointLight {
    const color = spec.color ?? this.opts.defaultColor;
    const radius = spec.radius ?? this.opts.defaultRadius;
    const intensity = spec.intensity ?? this.opts.defaultIntensity;
    const attenuation = spec.attenuation ?? this.opts.defaultAttenuation;

    const light = this.scene.add.pointlight(spec.x, spec.y, color, radius, 0, attenuation);
    light.setDepth(this.opts.depth);
    this.lamps.push({ light, baseIntensity: intensity });
    this.applyIntensity(this.lamps[this.lamps.length - 1]!);
    return light;
  }

  addLamps(specs: readonly LampSpec[]): void {
    for (const spec of specs) this.addLamp(spec);
  }

  /** Sincroniza intensidade com a fase do ciclo dia/noite. */
  syncPhase(phase: DayPhase): void {
    this.phase = phase;
    for (const lamp of this.lamps) this.applyIntensity(lamp);
  }

  /** Liga/desliga todas (ex.: menu pausado com fade). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    for (const lamp of this.lamps) this.applyIntensity(lamp);
  }

  getLampCount(): number {
    return this.lamps.length;
  }

  /** Remove e destrói todos os PointLights. */
  destroy(): void {
    for (const { light } of this.lamps) light.destroy();
    this.lamps.length = 0;
  }

  private applyIntensity(lamp: ManagedLamp): void {
    const mul = this.enabled ? PHASE_TINTS[this.phase].localLightMul : 0;
    const next = lamp.baseIntensity * mul;
    lamp.light.intensity = next;
    lamp.light.setVisible(next > 0.001);
  }
}

/**
 * Gera posições de postes ao longo de uma grade (fallback quando o mapa
 * ainda não marca props de lâmpada).
 */
export function gridLampPositions(
  columns: number,
  rows: number,
  tileSize: number,
  stepTiles: number,
  insetTiles = 2,
): LampSpec[] {
  const specs: LampSpec[] = [];
  for (let row = insetTiles; row < rows - insetTiles; row += stepTiles) {
    for (let col = insetTiles; col < columns - insetTiles; col += stepTiles) {
      specs.push({
        x: col * tileSize + tileSize / 2,
        y: row * tileSize + tileSize / 2,
      });
    }
  }
  return specs;
}
