import { describe, expect, it } from 'vitest';
import { canStartCampaign, getMissionDefinition } from './MissionProgression';

describe('Mission progression', () => {
  it('keeps the tutorial focused on civilian extraction', () => {
    const tutorial = getMissionDefinition(0);
    expect(tutorial.title).toBe('O Resgate');
    expect(tutorial.requiresCivilianExtraction).toBe(true);
    expect(tutorial.waves).toHaveLength(3);
  });

  it('defines Refuge as a separate four-wave campaign mission', () => {
    const refuge = getMissionDefinition(1);
    expect(refuge.title).toBe('Refúgio');
    expect(refuge.requiresCivilianExtraction).toBe(false);
    expect(refuge.waves).toHaveLength(4);
    expect(refuge.preparationDuration).toBeGreaterThan(getMissionDefinition(0).preparationDuration);
  });

  it('only starts the campaign after tutorial victory and an unlock', () => {
    expect(canStartCampaign(0, 'victory', true)).toBe(true);
    expect(canStartCampaign(0, 'playing', true)).toBe(false);
    expect(canStartCampaign(0, 'defeat', true)).toBe(false);
    expect(canStartCampaign(0, 'victory', false)).toBe(false);
    expect(canStartCampaign(1, 'victory', true)).toBe(false);
  });
});
