/**
 * Catálogo expandido de missões (mapas 01–04).
 * Mantém compatibilidade com MissionId 0|1 em MissionProgression.
 */

export type ExtendedMissionId = 0 | 1 | 2 | 3;

export interface MapBinding {
  readonly missionId: ExtendedMissionId;
  readonly mapUrl: string;
  readonly title: string;
  readonly theme: string;
  /** Hora inicial sugerida (0–24). */
  readonly startHour: number;
}

export const MAP_CATALOG: readonly MapBinding[] = Object.freeze([
  {
    missionId: 0,
    mapUrl: '/maps/mission-01.tmj',
    title: 'O Resgate',
    theme: 'residential',
    startHour: 14.5,
  },
  {
    missionId: 1,
    mapUrl: '/maps/mission-01.tmj',
    title: 'Refúgio',
    theme: 'residential',
    startHour: 17.0,
  },
  {
    missionId: 2,
    mapUrl: '/maps/mission-02.tmj',
    title: 'Subúrbio',
    theme: 'suburb',
    startHour: 9.0,
  },
  {
    missionId: 3,
    mapUrl: '/maps/mission-03.tmj',
    title: 'Zona Industrial',
    theme: 'industrial',
    startHour: 20.0,
  },
]);

/** Missão bônus / quarto mapa (parque). */
export const MISSION_04_MAP = Object.freeze({
  mapUrl: '/maps/mission-04.tmj',
  title: 'Parque Ribeirinho',
  theme: 'riverside',
  startHour: 6.0,
});

export function getMapBinding(id: ExtendedMissionId): MapBinding {
  const found = MAP_CATALOG.find((m) => m.missionId === id);
  if (!found) throw new Error(`Mapa não catalogado: ${id}`);
  return found;
}
