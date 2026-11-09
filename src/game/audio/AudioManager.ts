import Phaser from 'phaser';

const AUDIO_VARIANTS = {
  ambience: ['ambient-loop-1', 'ambient-loop-2', 'ambient-loop-3', 'ambient-loop-4'],
  gunshots: ['pistol-shot-1', 'pistol-shot-2', 'pistol-shot-3', 'pistol-shot-4'],
  infected: ['infected-groan-1', 'infected-groan-2', 'infected-groan-3', 'infected-groan-4'],
} as const;

/**
 * Camada de apresentação sonora. A simulação não conhece Phaser nem
 * reproduz áudio; a cena traduz eventos do jogo em efeitos sonoros.
 */
export class AudioManager {
  private ambient: Phaser.Sound.BaseSound | null = null;
  private lastGroanAt = Number.NEGATIVE_INFINITY;
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  get isMuted(): boolean {
    return this.scene.sound.mute;
  }

  startAmbient(): void {
    if (this.destroyed || this.ambient) return;
    const key = this.pickAvailable(AUDIO_VARIANTS.ambience);
    if (!key) return;

    this.ambient = this.scene.sound.add(key, {
      loop: true,
      volume: 0.12,
    });
    this.ambient.play();
  }

  playGunshot(): void {
    if (this.destroyed || this.isMuted) return;
    const key = this.pickAvailable(AUDIO_VARIANTS.gunshots);
    if (!key) return;

    this.scene.sound.play(key, {
      volume: 0.2,
      detune: Phaser.Math.Between(-90, 90),
    });
  }

  playInfectedGroan(): void {
    if (this.destroyed || this.isMuted) return;
    const now = this.scene.time.now;
    if (now - this.lastGroanAt < 1800 || Math.random() > 0.65) return;
    const key = this.pickAvailable(AUDIO_VARIANTS.infected);
    if (!key) return;

    this.lastGroanAt = now;
    this.scene.sound.play(key, {
      volume: 0.14,
      detune: Phaser.Math.Between(-160, 160),
    });
  }

  toggleMute(): boolean {
    if (this.destroyed) return this.isMuted;
    this.scene.sound.mute = !this.scene.sound.mute;
    return this.isMuted;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.ambient?.stop();
    this.ambient?.destroy();
    this.ambient = null;
  }

  private pickAvailable(keys: readonly string[]): string | null {
    const available = keys.filter((key) => this.scene.cache.audio.exists(key));
    if (available.length === 0) return null;
    return available[Phaser.Math.Between(0, available.length - 1)] ?? null;
  }
}
