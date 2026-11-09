import type { WaveDefinition } from '../simulation/WaveSystem';

export type MissionId = 0 | 1;
export type MissionStatus = 'playing' | 'victory' | 'defeat';

export interface MissionDefinition {
  readonly id: MissionId;
  readonly title: string;
  readonly preparationDuration: number;
  readonly requiresCivilianExtraction: boolean;
  readonly waves: readonly WaveDefinition[];
}

export const MISSION_DEFINITIONS: Readonly<Record<MissionId, MissionDefinition>> = {
  0: {
    id: 0,
    title: 'O Resgate',
    preparationDuration: 8,
    requiresCivilianExtraction: true,
    waves: [
      { infectedCount: 3, spawnInterval: 1.4 },
      { infectedCount: 4, spawnInterval: 1.15 },
      { infectedCount: 5, spawnInterval: 0.9 },
    ],
  },
  1: {
    id: 1,
    title: 'Refúgio',
    preparationDuration: 10,
    requiresCivilianExtraction: false,
    waves: [
      { infectedCount: 4, spawnInterval: 1.25 },
      { infectedCount: 5, spawnInterval: 1.05 },
      { infectedCount: 6, spawnInterval: 0.85 },
      { infectedCount: 7, spawnInterval: 0.7 },
    ],
  },
};

export function getMissionDefinition(id: MissionId): MissionDefinition {
  return MISSION_DEFINITIONS[id];
}

export function canStartCampaign(
  missionId: MissionId,
  status: MissionStatus,
  campaignUnlocked: boolean,
): boolean {
  return missionId === 0 && status === 'victory' && campaignUnlocked;
}
