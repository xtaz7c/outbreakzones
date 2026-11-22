use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};

const MAX_BACKUPS: usize = 5;
const MAX_SAVE_BYTES: usize = 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SaveEnvelope {
    pub schema_version: u32,
    pub entries: std::collections::HashMap<String, String>,
}

pub fn validate(raw: &[u8]) -> Result<SaveEnvelope, String> {
    if raw.len() > MAX_SAVE_BYTES { return Err("Save excede 1 MiB".into()); }
    let data: SaveEnvelope = serde_json::from_slice(raw).map_err(|e| format!("JSON inválido: {e}"))?;
    if data.schema_version != 1 || data.entries.len() > 512 ||
       !data.entries.iter().all(|(k,v)| k.starts_with("outbreakzones:") && k.len() <= 160 && v.len() <= 256 * 1024) {
        return Err("Estrutura de save inválida".into());
    }
    Ok(data)
}

fn backup_dir(save: &Path) -> PathBuf {
    save.parent().unwrap_or_else(|| Path::new(".")).join("save-backups")
}

pub fn preserve_valid_save(save: &Path) -> Result<(), String> {
    if !save.exists() { return Ok(()); }
    let raw = fs::read(save).map_err(|e| e.to_string())?;
    validate(&raw)?;
    let dir = backup_dir(save);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    let destination = dir.join(format!("backup-{stamp}.json"));
    if destination.exists() { return Ok(()); }
    fs::write(&destination, raw).map_err(|e| e.to_string())?;
    let mut backups: Vec<_> = fs::read_dir(&dir).map_err(|e| e.to_string())?
        .filter_map(|e| e.ok()).filter(|e| e.path().extension().is_some_and(|x| x == "json")).collect();
    backups.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
    while backups.len() > MAX_BACKUPS {
        if let Some(old) = backups.first() { let _ = fs::remove_file(old.path()); }
        backups.remove(0);
    }
    Ok(())
}

pub fn newest_valid_backup(save: &Path) -> Option<SaveEnvelope> {
    let dir = backup_dir(save);
    let mut files: Vec<_> = fs::read_dir(dir).ok()?.filter_map(|e| e.ok()).collect();
    files.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
    files.reverse();
    files.into_iter().find_map(|e| fs::read(e.path()).ok().and_then(|raw| validate(&raw).ok()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn rejects_invalid_json() { assert!(validate(b"broken").is_err()); }
    #[test] fn rejects_wrong_schema() { assert!(validate(br#"{"schemaVersion":2,"entries":{}}"#).is_err()); }
    #[test] fn accepts_valid_empty_envelope() { assert!(validate(br#"{"schemaVersion":1,"entries":{}}"#).is_ok()); }
}
