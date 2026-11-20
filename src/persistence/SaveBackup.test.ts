import { describe, expect, it } from 'vitest';
import { createSaveBackup, readSaveBackups, restoreSaveBackup, captureSaveSnapshot } from './SaveBackup';
class MemoryStorage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
describe('save backups', () => {
 it('captures namespaced keys and skips identical snapshots', () => {
  const storage = new MemoryStorage(); storage.setItem('outbreakzones:campaign','{"chapter":4}');
  expect(captureSaveSnapshot(storage)).not.toBeNull();
  expect(createSaveBackup(storage,new Date('2026-01-01T00:00:00Z'))).not.toBeNull();
  expect(createSaveBackup(storage,new Date('2026-01-02T00:00:00Z'))).toBeNull();
  expect(readSaveBackups(storage)).toHaveLength(1);
 });
 it('rotates to at most three distinct snapshots', () => {
  const storage = new MemoryStorage();
  for(let chapter=1;chapter<=4;chapter++){storage.setItem('outbreakzones:campaign',JSON.stringify({chapter}));createSaveBackup(storage,new Date(2026,0,chapter));}
  expect(readSaveBackups(storage)).toHaveLength(3);
 });
 it('restores a snapshot and removes save keys absent in the snapshot', () => {
  const storage = new MemoryStorage(); storage.setItem('outbreakzones:campaign','{"chapter":2}'); createSaveBackup(storage);
  storage.setItem('outbreakzones:campaign','{"chapter":9}'); storage.setItem('outbreakzones:extra','orphan');
  expect(restoreSaveBackup(storage)).toBe(true); expect(storage.getItem('outbreakzones:campaign')).toBe('{"chapter":2}');
  expect(storage.getItem('outbreakzones:extra')).toBeNull(); expect(readSaveBackups(storage)[0].entries).not.toHaveProperty('outbreakzones:save-backups');
 });
 it('returns false when no backups exist',()=>expect(restoreSaveBackup(new MemoryStorage())).toBe(false));
 it('rejects malformed snapshots and excessive entry sets',()=>{
  const storage=new MemoryStorage(); storage.setItem('outbreakzones:campaign','x'); storage.setItem('outbreakzones:save-backups','[{"schemaVersion":1,"createdAt":"invalid","entries":{}}]');
  expect(readSaveBackups(storage)).toHaveLength(0);
 });
});
