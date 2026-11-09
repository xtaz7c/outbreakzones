import Phaser from 'phaser';
import './home.css';
import { gameConfig } from './game/config';

const homeScreen = document.querySelector<HTMLElement>('#home-screen');
const gameContainer = document.querySelector<HTMLElement>('#game-container');
const startButton = document.querySelector<HTMLButtonElement>('#start-game');
const campaignButton = document.querySelector<HTMLButtonElement>('#start-campaign');
const controlsButton = document.querySelector<HTMLButtonElement>('#open-controls');
const controlsDialog = document.querySelector<HTMLDialogElement>('#controls-dialog');
const closeControlsButton = document.querySelector<HTMLButtonElement>('#close-controls');

let game: Phaser.Game | null = null;

if (!homeScreen || !gameContainer || !startButton || !campaignButton || !controlsButton || !controlsDialog || !closeControlsButton) {
  throw new Error('Required home screen elements are missing.');
}

function launchMission(missionId: 'tutorial' | 'campaign'): void {
  if (game) return;
  startButton.disabled = true;
  campaignButton.disabled = true;
  startButton.textContent = 'PREPARANDO OPERAÇÃO…';
  homeScreen.hidden = true;
  gameContainer.hidden = false;
  game = new Phaser.Game({
    ...gameConfig,
    callbacks: {
      preBoot: (instance) => instance.registry.set('missionId', missionId),
    },
  });
  (window as unknown as { game: Phaser.Game }).game = game;
}

startButton.addEventListener('click', () => launchMission('tutorial'));
campaignButton.addEventListener('click', () => launchMission('campaign'));

window.addEventListener('outbreakzones:return-home', () => {
  game?.destroy(true);
  game = null;
  gameContainer.hidden = true;
  homeScreen.hidden = false;
  startButton.disabled = false;
  campaignButton.disabled = false;
  startButton.textContent = 'MISSÃO 0 · O RESGATE';
});

window.addEventListener('outbreakzones:start-campaign', () => {
  game?.destroy(true);
  game = null;
  launchMission('campaign');
});

controlsButton.addEventListener('click', () => {
  controlsDialog.showModal();
});

closeControlsButton.addEventListener('click', () => {
  controlsDialog.close();
});
