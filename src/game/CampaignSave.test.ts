import { describe, expect, it } from 'vitest';
import {
  completeChapter,
  createDefaultCampaignProgress,
  normalizeCampaignProgress,
  selectChapter,
  unlockChapter,
} from './CampaignSave';

describe('campaign save data', () => {
  it('starts with no campaign chapter unlocked', () => {
    expect(createDefaultCampaignProgress()).toMatchObject({
      currentChapter: 0,
      highestUnlockedChapter: 0,
      completedChapters: [],
    });
  });

  it('unlocks the first chapter without resetting later progress', () => {
    const progress = normalizeCampaignProgress({
      schemaVersion: 1,
      currentChapter: 10,
      highestUnlockedChapter: 10,
      completedChapters: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    });
    expect(unlockChapter(progress, 1).currentChapter).toBe(10);
    expect(unlockChapter(progress, 1).highestUnlockedChapter).toBe(10);
  });

  it('restores and selects a saved chapter such as chapter 10', () => {
    const progress = normalizeCampaignProgress({
      schemaVersion: 1,
      currentChapter: 10,
      highestUnlockedChapter: 10,
      completedChapters: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    });
    expect(selectChapter(progress, 10).currentChapter).toBe(10);
    expect(selectChapter(progress, 11).currentChapter).toBe(10);
  });

  it('records completion and unlocks the next available chapter', () => {
    const progress = unlockChapter(createDefaultCampaignProgress(), 1);
    const completed = completeChapter(progress, 1, 10);
    expect(completed.completedChapters).toContain(1);
    expect(completed.currentChapter).toBe(2);
    expect(completed.highestUnlockedChapter).toBe(2);
  });

  it('does not move a chapter ten save backwards when an older chapter completes', () => {
    const progress = normalizeCampaignProgress({
      schemaVersion: 1,
      currentChapter: 10,
      highestUnlockedChapter: 10,
      completedChapters: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    });
    expect(completeChapter(progress, 1, 10).currentChapter).toBe(10);
  });

  it('does not lower progress when an older save is loaded', () => {
    const progress = normalizeCampaignProgress({
      schemaVersion: 1,
      currentChapter: 10,
      highestUnlockedChapter: 10,
      completedChapters: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    });
    const older = normalizeCampaignProgress({
      schemaVersion: 1,
      currentChapter: 2,
      highestUnlockedChapter: 2,
      completedChapters: [1],
    });
    expect(progress.highestUnlockedChapter).toBeGreaterThan(older.highestUnlockedChapter);
  });
});
