export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface SaveSnapshot { schemaVersion: 1; createdAt: string; entries: Record<string, string>; }
const BACKUP_KEY = 'outbreakzones:save-backups';
const SAVE_PREFIX = 'outbreakzones:';
const MAX_BACKUPS = 3;
const MAX_ENTRIES = 512;
const MAX_ENTRY_BYTES = 256 * 1024;
const MAX_SNAPSHOT_BYTES = 1024 * 1024;

function isValidSnapshot(value: unknown): value is SaveSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<SaveSnapshot>;
  if (snapshot.schemaVersion !== 1 || typeof snapshot.createdAt !== 'string'
      || !Number.isFinite(Date.parse(snapshot.createdAt)) || !snapshot.entries
      || typeof snapshot.entries !== 'object' || Array.isArray(snapshot.entries)) return false;
  const entries = snapshot.entries as Record<string, unknown>;
  const keys = Object.keys(entries);
  if (keys.length > MAX_ENTRIES) return false;
  if (!keys.every(key => key.startsWith(SAVE_PREFIX) && key !== BACKUP_KEY && key.length <= 160
    && typeof entries[key] === 'string' && new Blob([entries[key] as string]).size <= MAX_ENTRY_BYTES)) return false;
  return new Blob([JSON.stringify(snapshot)]).size <= MAX_SNAPSHOT_BYTES;
}
export function captureSaveSnapshot(storage: StorageLike, now = new Date()): SaveSnapshot | null {
  const entries: Record<string, string> = {};
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith(SAVE_PREFIX) || key === BACKUP_KEY) continue;
      const value = storage.getItem(key);
      if (value !== null) entries[key] = value;
    }
    if (!Object.keys(entries).length || Object.keys(entries).length > MAX_ENTRIES) return null;
    const snapshot: SaveSnapshot = { schemaVersion: 1, createdAt: now.toISOString(), entries };
    return isValidSnapshot(snapshot) ? snapshot : null;
  } catch { return null; }
}
export function readSaveBackups(storage: StorageLike): SaveSnapshot[] {
  try {
    const raw = storage.getItem(BACKUP_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSnapshot).slice(0, MAX_BACKUPS);
  } catch { return []; }
}
export function createSaveBackup(storage: StorageLike, now = new Date()): SaveSnapshot | null {
  const snapshot = captureSaveSnapshot(storage, now);
  if (!snapshot) return null;
  try {
    const previous = readSaveBackups(storage);
    if (previous[0] && JSON.stringify(previous[0].entries) === JSON.stringify(snapshot.entries)) return null;
    storage.setItem(BACKUP_KEY, JSON.stringify([snapshot, ...previous].slice(0, MAX_BACKUPS)));
    return snapshot;
  } catch { return null; }
}
export function restoreSaveBackup(storage: StorageLike, index = 0): boolean {
  const snapshot = readSaveBackups(storage)[index];
  if (!snapshot || !isValidSnapshot(snapshot)) return false;
  const original: Record<string, string> = {};
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(SAVE_PREFIX) && key !== BACKUP_KEY) {
        const value = storage.getItem(key);
        if (value !== null) original[key] = value;
      }
    }
    for (const key of Object.keys(original)) if (!(key in snapshot.entries)) storage.removeItem(key);
    for (const [key, value] of Object.entries(snapshot.entries)) storage.setItem(key, value);
    return true;
  } catch {
    try {
      for (const key of Object.keys(snapshot.entries)) storage.removeItem(key);
      for (const [key, value] of Object.entries(original)) storage.setItem(key, value);
    } catch { /* rollback may fail if storage is unavailable */ }
    return false;
  }
}
