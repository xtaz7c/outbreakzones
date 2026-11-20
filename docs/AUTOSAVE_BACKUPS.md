# Autosave and backup system

## Goals
- Keep progress in the persistent user-data directory for desktop builds; never inside a version's install directory.
- Maintain up to three distinct rotating snapshots, skipping duplicate snapshots.
- Restore only validated, namespaced game-save keys.
- Keep browser-only builds using browser storage and backup snapshots.
- Use atomic writes for desktop files and recover from invalid primary data using the latest valid backup.

## Initial implementation
The snapshot utility captures keys under `outbreakzones:`, excludes its own backup metadata, rotates up to three snapshots, and supports restoring a snapshot. The utility is intentionally isolated pending integration into the desktop save endpoint and campaign/gameplay lifecycle.

## Integration requirements
1. Snapshot before replacing the primary desktop save.
2. Use temp-file write + atomic rename; never overwrite backup files until the new snapshot has been validated.
3. Validate schema, key namespace, payload size, timestamps and entry limits before restoration.
4. On startup, recover from backups only when primary save is missing or invalid; avoid silently overwriting valid newer saves.
5. Trigger autosave after meaningful progress changes and on safe lifecycle events, with debounce; avoid save calls every frame.
6. Provide a recovery log/notification if recovery occurred, and manual recovery option in settings.
7. Test migration, corruption, interrupted writes, backup rotation, chapter/progress persistence, and desktop/browser behavior.
