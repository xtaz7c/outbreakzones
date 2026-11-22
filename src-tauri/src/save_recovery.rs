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


impl Default for SaveEnvelope {
    fn default() -> Self { Self { schema_version: 1, entries: std::collections::HashMap::new() } }
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupInfo {
    pub id: String,
    pub created_at: u64,
}

pub fn list_valid_backups(save: &Path) -> Result<Vec<SaveBackupInfo>, String> {
    let dir = backup_dir(save);
    if !dir.exists() { return Ok(Vec::new()); }
    let mut backups = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else { continue };
        let Some(stamp) = name.strip_prefix("backup-").and_then(|value| value.strip_suffix(".json")) else { continue };
        if stamp.is_empty() || !stamp.chars().all(|character| character.is_ascii_digit()) { continue; }
        let Ok(raw) = fs::read(&path) else { continue };
        if validate(&raw).is_err() { continue; }
        let created_at = stamp.parse::<u64>().unwrap_or_else(|_| {
            entry.metadata().ok().and_then(|metadata| metadata.modified().ok())
                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_secs()).unwrap_or_default()
        });
        backups.push(SaveBackupInfo { id: name.to_string(), created_at });
    }
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

pub fn restore_backup(save: &Path, backup_id: &str) -> Result<(), String> {
    let stamp = backup_id.strip_prefix("backup-")
        .and_then(|value| value.strip_suffix(".json"))
        .ok_or_else(|| "Identificador de backup inválido.".to_string())?;
    if stamp.is_empty() || !stamp.chars().all(|character| character.is_ascii_digit()) {
        return Err("Identificador de backup inválido.".into());
    }
    let source = backup_dir(save).join(format!("backup-{stamp}.json"));
    let raw = fs::read(&source).map_err(|e| format!("Não foi possível ler o backup: {e}"))?;
    validate(&raw).map_err(|_| "O backup selecionado está inválido.".to_string())?;
    preserve_valid_save(save)?;
    let temporary = save.with_extension("restore.tmp");
    fs::write(&temporary, raw).map_err(|e| format!("Não foi possível preparar a restauração: {e}"))?;
    if let Err(error) = fs::rename(&temporary, save) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Não foi possível concluir a restauração: {error}"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn rejects_invalid_json() { assert!(validate(b"broken").is_err()); }
    #[test] fn rejects_wrong_schema() { assert!(validate(br#"{"schemaVersion":2,"entries":{}}"#).is_err()); }
    #[test] fn accepts_valid_empty_envelope() { assert!(validate(br#"{"schemaVersion":1,"entries":{}}"#).is_ok()); }
}
