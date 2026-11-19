import Phaser from 'phaser';
import './home.css';
import { gameConfig } from './game/config';
import { BUILD_LABEL } from './buildInfo';
import { CAMPAIGN_PROGRESS_KEY, normalizeCampaignProgress, selectChapter, unlockChapter } from './game/CampaignSave';
import { initializeGamePersistence, scheduleGamePersistence } from './persistence/GamePersistence';

const homeScreen = document.querySelector<HTMLElement>('#home-screen');
const gameContainer = document.querySelector<HTMLElement>('#game-container');
const startButton = document.querySelector<HTMLButtonElement>('#start-game');
const controlsButton = document.querySelector<HTMLButtonElement>('#open-controls');
const controlsDialog = document.querySelector<HTMLDialogElement>('#controls-dialog');
const closeControlsButton = document.querySelector<HTMLButtonElement>('#close-controls');
const buildVersion = document.querySelector<HTMLElement>('#build-version');
const modeDialog = document.querySelector<HTMLDialogElement>('#mode-dialog');
const closeModesButton = document.querySelector<HTMLButtonElement>('#close-modes');
const tutorialButton = document.querySelector<HTMLButtonElement>('#start-tutorial');
const campaignButton = document.querySelector<HTMLButtonElement>('#start-campaign');
const campaignDescription = document.querySelector<HTMLElement>('#campaign-description');
const campaignAction = document.querySelector<HTMLElement>('#campaign-action');

let game: Phaser.Game | null = null;

if (
  !homeScreen ||
  !gameContainer ||
  !startButton ||
  !controlsButton ||
  !controlsDialog ||
  !closeControlsButton ||
  !buildVersion ||
  !modeDialog ||
  !closeModesButton ||
  !tutorialButton ||
  !campaignButton ||
  !campaignDescription ||
  !campaignAction
) {
  throw new Error('Required home screen elements are missing.');
}

buildVersion.textContent = BUILD_LABEL;

const SUPPORTED_CAMPAIGN_CHAPTERS = 1;

function readCampaignProgress() {
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_PROGRESS_KEY);
    const progress = normalizeCampaignProgress(raw ? JSON.parse(raw) : null);
    if (window.localStorage.getItem('outbreakzones:campaign-unlocked') === '1' && progress.highestUnlockedChapter < 1) {
      const migrated = unlockChapter(progress, 1);
      window.localStorage.setItem(CAMPAIGN_PROGRESS_KEY, JSON.stringify(migrated));
      scheduleGamePersistence();
      return migrated;
    }
    return progress;
  } catch {
    return normalizeCampaignProgress(null);
  }
}

function writeCampaignProgress(progress: ReturnType<typeof normalizeCampaignProgress>): void {
  try {
    window.localStorage.setItem(CAMPAIGN_PROGRESS_KEY, JSON.stringify(progress));
    scheduleGamePersistence();
  } catch (error) {
    console.error('[CampaignSave] Não foi possível salvar o progresso.', error);
  }
}

function refreshCampaignAvailability(): void {
  const progress = readCampaignProgress();
  const unlocked = progress.highestUnlockedChapter > 0;
  const savedChapterAvailable = progress.currentChapter > 0 && progress.currentChapter <= SUPPORTED_CAMPAIGN_CHAPTERS;
  const needsNewerVersion = unlocked && !savedChapterAvailable;
  campaignButton!.disabled = !unlocked || needsNewerVersion;
  campaignButton!.setAttribute('aria-disabled', String(campaignButton!.disabled));
  campaignDescription!.textContent = !unlocked
    ? 'Conclua o tutorial para desbloquear a campanha.'
    : needsNewerVersion
      ? `Seu progresso está no capítulo ${progress.currentChapter}. Atualize o jogo para continuar sem perder seu salvamento.`
      : `Continue do capítulo ${progress.currentChapter}.`;
  campaignAction!.textContent = !unlocked
    ? 'BLOQUEADO · CONCLUA O TUTORIAL'
    : needsNewerVersion
      ? 'ATUALIZAÇÃO NECESSÁRIA'
      : `CONTINUAR NO CAPÍTULO ${progress.currentChapter} ↗`;
}

function startOperation(missionId: 0 | 1): void {
  if (game) return;
  if (missionId === 1) {
    try { window.localStorage.removeItem('outbreakzones:mission-seed'); } catch { /* storage indisponível */ }
  }
  // Campanha deve iniciar com um seed independente; não herdar persistência do tutorial.
  if (missionId === 1) {
    try { window.localStorage.removeItem('outbreakzones:mission-seed'); } catch { /* storage indisponível */ }
  }
  modeDialog!.close();
  startButton!.disabled = true;
  startButton!.setAttribute('aria-busy', 'true');
  startButton!.innerHTML = '<span>PREPARANDO OPERAÇÃO</span><span class="loading-dots" role="status" aria-label="Preparando"><i></i><i></i><i></i></span>';
  homeScreen!.hidden = true;
  gameContainer!.hidden = false;
  game = new Phaser.Game({
    ...gameConfig,
    callbacks: {
      ...gameConfig.callbacks,
      preBoot: (instance) => instance.registry.set('missionId', missionId),
    },
  });
  (window as unknown as { game: Phaser.Game }).game = game;
}

startButton.addEventListener('click', async () => {
  if (game) return;
  await persistenceReady;
  refreshCampaignAvailability();
  modeDialog!.showModal();
});
tutorialButton!.addEventListener('click', () => startOperation(0));
campaignButton!.addEventListener('click', () => {
  const progress = readCampaignProgress();
  if (progress.currentChapter > 0 && progress.currentChapter <= SUPPORTED_CAMPAIGN_CHAPTERS) {
    writeCampaignProgress(selectChapter(progress, progress.currentChapter));
    startOperation(1);
  }
});
closeModesButton!.addEventListener('click', () => modeDialog!.close());
const persistenceReady = initializeGamePersistence();
void persistenceReady.then(refreshCampaignAvailability);

window.addEventListener('outbreakzones:return-home', () => {
  game?.destroy(true);
  game = null;
  gameContainer.hidden = true;
  homeScreen.hidden = false;
  startButton.disabled = false;
  startButton.removeAttribute('aria-busy');
  refreshCampaignAvailability();
  startButton.innerHTML = `
    <span>INICIAR OPERAÇÃO</span>
    <span class="primary-button__arrow" aria-hidden="true">↗</span>
  `;
});

controlsButton.addEventListener('click', () => {
  controlsDialog.showModal();
});

closeControlsButton.addEventListener('click', () => {
  controlsDialog.close();
});
