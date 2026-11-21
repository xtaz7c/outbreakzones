# Automatic saves and recovery

- Snapshots are stored in browser localStorage under a namespaced metadata key.
- Up to three distinct snapshots are retained; unchanged save contents are skipped.
- Snapshot entries are limited to the game's namespace, count, entry size, and total payload.
- Snapshots are triggered when persistence is scheduled, on a 30-second interval, and on pagehide/hidden visibility.
- Desktop persistence writes the existing namespaced localStorage envelope to the launcher's user-data save file; backups remain outside the installed game-version folder.
- Recovery utility validates snapshot metadata and entry limits before restoring. Restoration removes stale namespaced entries and attempts rollback if storage writes fail.

## Scope / remaining work
This PR integrates snapshot creation with the existing save scheduling and lifecycle hooks. It does not automatically detect corruption of the desktop primary file, nor provide a player-facing recovery UI. The desktop server save file should be backed up and validated in a later native-layer improvement; current snapshots are browser-storage-level snapshots.
