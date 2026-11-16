import type { WaveDefinition } from '../simulation/systems/WaveSystem';

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
    title: 'Setor 07 — O Resgate',
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
    title: 'Setor 04 — Investigação',
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

export function getMissionResultMessage(missionId: MissionId, status: MissionStatus): string {
  if (status === 'defeat') {
    return ['GAME OVER', 'Equipe de resgate incapacitada'].join('\n');
  }

  if (missionId === 0) {
    return ['SETOR 07 CONCLUÍDO', 'Todos os civis resgatados', 'Equipe de resgate sobreviveu'].join('\n');
  }

  return ['SETOR 04 CONCLUÍDO', 'Investigação encerrada', 'Área sob controle'].join('\n');
}
