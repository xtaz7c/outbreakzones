import Phaser from 'phaser';

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
    this.ambient = this.scene.sound.add('ambient-loop', {
      loop: true,
      volume: 0.16,
    });
    this.ambient.play();
  }

  playGunshot(): void {
    if (this.destroyed || this.isMuted) return;
    this.scene.sound.play('pistol-shot', {
      volume: 0.2,
      detune: Phaser.Math.Between(-90, 90),
    });
  }

  playInfectedGroan(): void {
    if (this.destroyed || this.isMuted) return;
    const now = this.scene.time.now;
    if (now - this.lastGroanAt < 1800 || Math.random() > 0.65) return;
    this.lastGroanAt = now;
    this.scene.sound.play('infected-groan', {
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
}
