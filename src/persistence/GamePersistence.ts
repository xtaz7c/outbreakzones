import { createSaveBackup } from './SaveBackup';
const STORAGE_PREFIX = 'outbreakzones:';
const SAVE_ENDPOINT = '/__save';
const MAX_SAVE_BYTES = 1024 * 1024;
interface DesktopSaveEnvelope { schemaVersion: 1; entries: Record<string, string>; }
let desktopPersistenceAvailable = false;
let initialized = false;
let pendingSave: number | undefined;
let backupTimer: number | undefined;
function readLocalEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      const value = window.localStorage.getItem(key);
      if (value !== null) entries[key] = value;
    }
  } catch (error) { console.warn('[GameSave] Não foi possível ler o armazenamento local.', error); }
  return entries;
}
async function writeDesktopSave(keepalive = false): Promise<void> {
  if (!desktopPersistenceAvailable) return;
  const payload: DesktopSaveEnvelope = { schemaVersion: 1, entries: readLocalEntries() };
  const body = JSON.stringify(payload);
  if (new Blob([body]).size > MAX_SAVE_BYTES) { console.error('[GameSave] Salvamento excedeu o limite de 1 MiB; dados não enviados.'); return; }
  try {
    const response = await fetch(SAVE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) { console.error('[GameSave] Falha ao gravar o salvamento no armazenamento do launcher.', error); }
}
function makeBackup(): void {
  try { createSaveBackup(window.localStorage); } catch (error) { console.warn('[GameSave] Backup automático indisponível.', error); }
}
export async function initializeGamePersistence(): Promise<void> {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  try {
    const response = await fetch(SAVE_ENDPOINT, { method: 'GET', cache: 'no-store' });
    if (response.ok) {
      const envelope = await response.json() as Partial<DesktopSaveEnvelope>;
      if (envelope.schemaVersion !== 1 || !envelope.entries || typeof envelope.entries !== 'object' || Array.isArray(envelope.entries)) throw new Error('Formato de salvamento inválido.');
      desktopPersistenceAvailable = true;
      const savedEntries = Object.fromEntries(Object.entries(envelope.entries).filter(([key, value]) => key.startsWith(STORAGE_PREFIX) && typeof value === 'string));
      if (Object.keys(savedEntries).length) {
        for (const [key, value] of Object.entries(savedEntries)) window.localStorage.setItem(key, value);
      } else await writeDesktopSave();
    }
  } catch { desktopPersistenceAvailable = false; }
  makeBackup();
  backupTimer = window.setInterval(makeBackup, 30_000);
  window.addEventListener('pagehide', () => { makeBackup(); void writeDesktopSave(true); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { makeBackup(); void writeDesktopSave(true); } });
}
export function scheduleGamePersistence(): void {
  if (typeof window === 'undefined') return;
  makeBackup();
  if (!desktopPersistenceAvailable) return;
  if (pendingSave !== undefined) window.clearTimeout(pendingSave);
  pendingSave = window.setTimeout(() => { pendingSave = undefined; void writeDesktopSave(); }, 250);
}
export function flushGamePersistence(): void {
  makeBackup();
  if (pendingSave !== undefined && typeof window !== 'undefined') { window.clearTimeout(pendingSave); pendingSave = undefined; }
  void writeDesktopSave(true);
}
