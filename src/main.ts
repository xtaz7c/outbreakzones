import Phaser from 'phaser';
import { gameConfig } from './game/config';

const game = new Phaser.Game(gameConfig);

// Exposto apenas para debug no console do navegador
(window as unknown as { game: Phaser.Game }).game = game;
