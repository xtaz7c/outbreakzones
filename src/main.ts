import Phaser from 'phaser';
import './home.css';
import { gameConfig } from './game/config';
import { APP_VERSION } from './buildInfo';

const CAMPAIGN_UNLOCK_STORAGE_KEY = 'outbreakzones:campaign-unlocked';

const homeScreen = document.querySelector<HTMLElement>('#home-screen');
const gameContainer = document.querySelector<HTMLElement>('#game-container');
const startButton = document.querySelector<HTMLButtonElement>('#start-game');
const controlsButton = document.querySelector<HTMLButtonElement>('#open-controls');
const controlsDialog = document.querySelector<HTMLDialogElement>('#controls-dialog');
const closeControlsButton = document.querySelector<HTMLButtonElement>('#close-controls');
const modeDialog = document.querySelector<HTMLDialogElement>('#mode-dialog');
const closeModesButton = document.querySelector<HTMLButtonElement>('#close-modes');
const tutorialButton = document.querySelector<HTMLButtonElement>('#start-tutorial');
const campaignButton = document.querySelector<HTMLButtonElement>('#start-campaign');
const campaignDescription = document.querySelector<HTMLElement>('#campaign-description');
const campaignAction = document.querySelector<HTMLElement>('#campaign-action');
const releaseButton = document.querySelector<HTMLButtonElement>('#open-release');
const releaseDialog = document.querySelector<HTMLDialogElement>('#release-dialog');
const closeReleaseButton = document.querySelector<HTMLButtonElement>('#close-release');
const buildVersion = document.querySelector<HTMLElement>('#build-version');
const releaseVersion = document.querySelector<HTMLElement>('#release-version');
const releaseDialogVersion = document.querySelector<HTMLElement>('#release-dialog-version');

let game: Phaser.Game | null = null;

if (
  !homeScreen ||
  !gameContainer ||
  !startButton ||
  !controlsButton ||
  !controlsDialog ||
  !closeControlsButton ||
  !modeDialog ||
  !closeModesButton ||
  !tutorialButton ||
  !campaignButton ||
  !campaignDescription ||
  !campaignAction ||
  !releaseButton ||
  !releaseDialog ||
  !closeReleaseButton ||
  !buildVersion ||
  !releaseVersion ||
  !releaseDialogVersion
) {
  throw new Error('Required home screen elements are missing.');
}

buildVersion.textContent = `ÚLTIMA RELEASE · v${APP_VERSION}`;
releaseVersion.textContent = `v${APP_VERSION}`;
releaseDialogVersion.textContent = `v${APP_VERSION}`;

function isCampaignUnlocked(): boolean {
  try {
    return window.localStorage.getItem(CAMPAIGN_UNLOCK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function refreshCampaignAvailability(): void {
  const unlocked = isCampaignUnlocked();
  campaignButton.disabled = !unlocked;
  campaignButton.setAttribute('aria-disabled', String(!unlocked));
  campaignDescription.textContent = unlocked
    ? 'Continue a história e defenda o primeiro refúgio da equipe.'
    : 'Conclua o tutorial para desbloquear a campanha e continuar a história.';
  campaignAction.innerHTML = unlocked
    ? 'CONTINUAR CAMPANHA <b>↗</b>'
    : 'BLOQUEADO <b>⌑</b>';
}

function startOperation(missionId: 0 | 1): void {
  if (game) return;

  (window as unknown as { __OZ_SELECTED_MISSION__?: number }).__OZ_SELECTED_MISSION__ = missionId;
  modeDialog.close();
  startButton.disabled = true;
  startButton.setAttribute('aria-busy', 'true');
  startButton.innerHTML = `
    <span>PREPARANDO OPERAÇÃO</span>
    <span class="loading-dots" role="status" aria-label="Carregando">
      <i></i><i></i><i></i>
    </span>
  `;
  homeScreen.hidden = true;
  gameContainer.hidden = false;

  game = new Phaser.Game(gameConfig);
  (window as unknown as { game: Phaser.Game }).game = game;
}

refreshCampaignAvailability();

startButton.addEventListener('click', () => {
  refreshCampaignAvailability();
  modeDialog.showModal();
});

tutorialButton.addEventListener('click', () => startOperation(0));

campaignButton.addEventListener('click', () => {
  if (isCampaignUnlocked()) startOperation(1);
});

window.addEventListener('outbreakzones:return-home', () => {
  game?.destroy(true);
  game = null;
  gameContainer.hidden = true;
  homeScreen.hidden = false;
  startButton.disabled = false;
  startButton.removeAttribute('aria-busy');
  startButton.innerHTML = `
    <span>ESCOLHER OPERAÇÃO</span>
    <span class="primary-button__arrow" aria-hidden="true">↗</span>
  `;
  refreshCampaignAvailability();
});

controlsButton.addEventListener('click', () => controlsDialog.showModal());
closeControlsButton.addEventListener('click', () => controlsDialog.close());
closeModesButton.addEventListener('click', () => modeDialog.close());
releaseButton.addEventListener('click', () => releaseDialog.showModal());
closeReleaseButton.addEventListener('click', () => releaseDialog.close());
