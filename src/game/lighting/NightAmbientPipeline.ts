import Phaser from 'phaser';

/**
 * PostFX: multiplica a cena por uma cor ambient (escuridão noturna).
 *
 * Não substitui PointLights — complementa: o chão fica mais escuro e os
 * PointLights continuam additivos por cima do resultado da câmera.
 *
 * Registro (uma vez, no boot do game ou BootScene):
 *   if (game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
 *     game.renderer.pipelines.addPostPipeline('NightAmbient', NightAmbientPipeline);
 *   }
 *
 * Aplicar na câmera de mundo (não na UI):
 *   camera.setPostPipeline(NightAmbientPipeline);
 *   const fx = camera.getPostPipeline(NightAmbientPipeline) as NightAmbientPipeline;
 *   fx.setAmbient(0.35, 0.40, 0.55, 1);
 */

const NIGHT_AMBIENT_FRAG = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec3 uAmbient;
uniform float uStrength;

varying vec2 outTexCoord;

void main() {
  vec4 tex = texture2D(uMainSampler, outTexCoord);
  // strength 0 = identidade; 1 = full ambient multiply
  vec3 lit = mix(tex.rgb, tex.rgb * uAmbient, uStrength);
  gl_FragColor = vec4(lit, tex.a);
}
`;

export class NightAmbientPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private ambientR = 1;
  private ambientG = 1;
  private ambientB = 1;
  private strength = 0;

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'NightAmbient',
      fragShader: NIGHT_AMBIENT_FRAG,
    });
  }

  onPreRender(): void {
    this.set3f('uAmbient', this.ambientR, this.ambientG, this.ambientB);
    this.set1f('uStrength', this.strength);
  }

  /**
   * @param r,g,b multiplicadores 0–1
   * @param strength 0 = off (dia), 1 = full (noite profunda)
   */
  setAmbient(r: number, g: number, b: number, strength: number): void {
    this.ambientR = r;
    this.ambientG = g;
    this.ambientB = b;
    this.strength = Math.max(0, Math.min(1, strength));
  }

  /** Atalho a partir da fase (valores alinhados a PHASE_TINTS). */
  setFromPhaseStrength(strength: number, cool = true): void {
    if (cool) {
      this.setAmbient(0.45, 0.52, 0.72, strength);
    } else {
      this.setAmbient(1, 0.9, 0.8, strength);
    }
  }
}

/** Strength sugerida do PostFX por fase (0–1). */
export const PHASE_AMBIENT_STRENGTH: Readonly<Record<string, number>> = Object.freeze({
  dawn: 0.2,
  day: 0,
  dusk: 0.35,
  night: 0.7,
});
