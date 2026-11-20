export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveSnapshot {
  schemaVersion: 1;
  createdAt: string;
  entries: Record<string, string>;
}

const BACKUP_KEY = 'outbreakzones:save-backups';
const SAVE_PREFIX = 'outbreakzones:';
const BACKUP_PREFIX = 'outbreakzones:save-backups';
const MAX_BACKUPS = 3;

export function captureSaveSnapshot(storage: StorageLike, now = new Date()): SaveSnapshot | null {
  const entries: Record<string, string> = {};
  try {
    for (let i = 0; i < (storage as StorageLike & { length?: number }).length!; i++) {
      const key = (storage as StorageLike & { key?: (index: number) => string | null }).key?.(i);
      if (!key || !key.startsWith(SAVE_PREFIX) || key.startsWith(BACKUP_PREFIX)) continue;
      const value = storage.getItem(key);
      if (value !== null) entries[key] = value;
    }
  } catch {
    return null;
  }
  if (!Object.keys(entries).length) return null;
  return { schemaVersion: 1, createdAt: now.toISOString(), entries };
}

export function readSaveBackups(storage: StorageLike): SaveSnapshot[] {
  try {
    const raw = storage.getItem(BACKUP_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SaveSnapshot =>
      !!item && typeof item === 'object' && (item as SaveSnapshot).schemaVersion === 1
      && typeof (item as SaveSnapshot).createdAt === 'string'
      && (item as SaveSnapshot).entries && typeof (item as SaveSnapshot).entries === 'object'
    ).slice(0, MAX_BACKUPS);
  } catch {
    return [];
  }
}

export function createSaveBackup(storage: StorageLike, now = new Date()): SaveSnapshot | null {
  const snapshot = captureSaveSnapshot(storage, now);
  if (!snapshot) return null;
  try {
    const previous = readSaveBackups(storage);
    if (previous[0]?.entries && JSON.stringify(previous[0].entries) === JSON.stringify(snapshot.entries)) return null;
    storage.setItem(BACKUP_KEY, JSON.stringify([snapshot, ...previous].slice(0, MAX_BACKUPS)));
    return snapshot;
  } catch {
    return null;
  }
}

export function restoreSaveBackup(storage: StorageLike, index = 0): boolean {
  const backups = readSaveBackups(storage);
  const snapshot = backups[index];
  if (!snapshot) return false;
  try {
    for (const key of Object.keys(snapshot.entries)) {
      if (key.startsWith(SAVE_PREFIX) && !key.startsWith(BACKUP_PREFIX)) storage.setItem(key, snapshot.entries[key]);
    }
    return true;
  } catch {
    return false;
  }
}
