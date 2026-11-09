import Phaser from 'phaser';
import './home.css';
import { gameConfig } from './game/config';

const homeScreen = document.querySelector<HTMLElement>('#home-screen');
const gameContainer = document.querySelector<HTMLElement>('#game-container');
const startButton = document.querySelector<HTMLButtonElement>('#start-game');
const controlsButton = document.querySelector<HTMLButtonElement>('#open-controls');
const controlsDialog = document.querySelector<HTMLDialogElement>('#controls-dialog');
const closeControlsButton = document.querySelector<HTMLButtonElement>('#close-controls');

let game: Phaser.Game | null = null;

if (!homeScreen || !gameContainer || !startButton || !controlsButton || !controlsDialog || !closeControlsButton) {
  throw new Error('Required home screen elements are missing.');
}

startButton.addEventListener('click', () => {
  if (game) return;

  startButton.disabled = true;
  startButton.textContent = 'PREPARANDO OPERAÇÃO…';
  homeScreen.hidden = true;
  gameContainer.hidden = false;

  game = new Phaser.Game(gameConfig);
  (window as unknown as { game: Phaser.Game }).game = game;
});

controlsButton.addEventListener('click', () => {
  controlsDialog.showModal();
});

closeControlsButton.addEventListener('click', () => {
  controlsDialog.close();
});
