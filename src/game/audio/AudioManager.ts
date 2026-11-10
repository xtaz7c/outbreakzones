import Phaser from 'phaser';

/** Camada de apresentação sonora; a simulação não conhece Phaser nem reproduz áudio. */
export class AudioManager {
  private ambient: Phaser.Sound.BaseSound | null = null;
  private lastGroanAt = Number.NEGATIVE_INFINITY;
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  get isMuted(): boolean {
    return this.scene.sound.mute;
  }

  private playRandomVariant(prefix: string, volume: number, detune = 0): void {
    if (this.destroyed || this.isMuted) {
      return;
    }

    const variants = [1, 2, 3, 4]
      .map((number) => `${prefix}-${number}`)
      .filter((key) => this.scene.cache.audio.exists(key));

    if (variants.length === 0) {
      return;
    }

    this.scene.sound.play(Phaser.Utils.Array.GetRandom(variants), {
      volume,
      detune: detune ? Phaser.Math.Between(-detune, detune) : 0,
    });
  }

  startAmbient(): void {
    if (this.destroyed || this.ambient) {
      return;
    }

    const ambientTrackKey = this.scene.registry.get('ambientTrackKey');
    if (
      typeof ambientTrackKey !== 'string' ||
      !this.scene.cache.audio.exists(ambientTrackKey)
    ) {
      return;
    }

    this.ambient = this.scene.sound.add(ambientTrackKey, {
      loop: true,
      volume: 0.16,
    });
    this.ambient.play();
  }

  playGunshot(): void {
    this.playRandomVariant('pistol-shot', 0.2, 90);
  }

  playInfectedGroan(): void {
    if (this.destroyed || this.isMuted) {
      return;
    }

    const now = this.scene.time.now;
    if (now - this.lastGroanAt < 1800 || Math.random() > 0.65) {
      return;
    }

    this.lastGroanAt = now;
    this.playRandomVariant('infected-groan', 0.14, 160);
  }

  toggleMute(): boolean {
    if (!this.destroyed) {
      this.scene.sound.mute = !this.scene.sound.mute;
    }
    return this.isMuted;
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.ambient?.stop();
    this.ambient?.destroy();
    this.ambient = null;
  }
}
