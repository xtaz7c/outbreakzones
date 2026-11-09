import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MissionScene } from './scenes/MissionScene';

/** Resolução lógica base do jogo (independente da tela). */
export const LOGICAL_WIDTH = 1920;
export const LOGICAL_HEIGHT = 1080;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: LOGICAL_WIDTH,
  height: LOGICAL_HEIGHT,
  backgroundColor: '#2e2e2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MissionScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
};
