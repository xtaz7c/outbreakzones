export interface CampaignProgress {
  readonly schemaVersion: 1;
  readonly currentChapter: number;
  readonly highestUnlockedChapter: number;
  readonly completedChapters: readonly number[];
  readonly updatedAt: string;
}

export const CAMPAIGN_PROGRESS_KEY = 'outbreakzones:campaign-progress';

export function createDefaultCampaignProgress(): CampaignProgress {
  return {
    schemaVersion: 1,
    currentChapter: 0,
    highestUnlockedChapter: 0,
    completedChapters: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function isValidChapter(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 10_000;
}

export function normalizeCampaignProgress(value: unknown): CampaignProgress {
  const fallback = createDefaultCampaignProgress();
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<CampaignProgress>;
  if (candidate.schemaVersion !== 1) return fallback;

  const completed = Array.isArray(candidate.completedChapters)
    ? [...new Set(candidate.completedChapters.filter(isValidChapter))].sort((a, b) => a - b)
    : [];
  const highest = isValidChapter(candidate.highestUnlockedChapter)
    ? Math.max(candidate.highestUnlockedChapter, completed.length ? Math.max(...completed) : 0)
    : completed.length ? Math.max(...completed) : 0;
  const current = isValidChapter(candidate.currentChapter) && highest > 0
    ? Math.min(candidate.currentChapter, highest)
    : 0;

  return {
    schemaVersion: 1,
    currentChapter: current,
    highestUnlockedChapter: highest,
    completedChapters: completed,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : fallback.updatedAt,
  };
}

export function unlockChapter(progress: CampaignProgress, chapter: number): CampaignProgress {
  if (!isValidChapter(chapter)) return progress;
  const highestUnlockedChapter = Math.max(progress.highestUnlockedChapter, chapter);
  return {
    ...progress,
    currentChapter: progress.currentChapter || chapter,
    highestUnlockedChapter,
    updatedAt: new Date().toISOString(),
  };
}

export function selectChapter(progress: CampaignProgress, chapter: number): CampaignProgress {
  if (!isValidChapter(chapter) || chapter > progress.highestUnlockedChapter) return progress;
  return { ...progress, currentChapter: chapter, updatedAt: new Date().toISOString() };
}

export function completeChapter(
  progress: CampaignProgress,
  chapter: number,
  availableChapterCount: number,
): CampaignProgress {
  if (!isValidChapter(chapter) || chapter > progress.highestUnlockedChapter) return progress;
  const completedChapters = [...new Set([...progress.completedChapters, chapter])].sort((a, b) => a - b);
  const nextChapter = chapter + 1;
  const highestUnlockedChapter = nextChapter <= availableChapterCount
    ? Math.max(progress.highestUnlockedChapter, nextChapter)
    : progress.highestUnlockedChapter;
  const currentChapter = progress.currentChapter > chapter
    ? progress.currentChapter
    : nextChapter <= highestUnlockedChapter ? nextChapter : chapter;

  return {
    ...progress,
    currentChapter,
    highestUnlockedChapter,
    completedChapters,
    updatedAt: new Date().toISOString(),
  };
}
