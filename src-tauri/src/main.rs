#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    io::{Cursor, Read},
    net::SocketAddr,
    path::{Component, Path, PathBuf},
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tiny_http::{Header, Method, Response, Server};
use zip::ZipArchive;

const MAX_SAVE_BYTES: u64 = 1024 * 1024;
const MANIFEST_URL: &str = "https://raw.githubusercontent.com/xtaz7c/outbreakzones/main/releases/manifest.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GameRelease {
    version: String,
    archive_url: String,
    sha256: String,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    released_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReleaseManifest {
    schema: u32,
    latest_version: Option<String>,
    versions: Vec<GameRelease>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct InstalledVersion {
    version: String,
    installed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveEnvelope {
    schema_version: u32,
    entries: HashMap<String, String>,
}

impl Default for SaveEnvelope {
    fn default() -> Self {
        Self { schema_version: 1, entries: HashMap::new() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct LauncherSettings {
    preferred_version: Option<String>,
}

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("outbreak-zones");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

fn versions_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = data_dir(app)?.join("versions");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

fn read_settings(app: &tauri::AppHandle) -> Result<LauncherSettings, String> {
    let path = data_dir(app)?.join("settings.json");
    if !path.exists() {
        return Ok(LauncherSettings::default());
    }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

fn write_settings(app: &tauri::AppHandle, settings: &LauncherSettings) -> Result<(), String> {
    let path = data_dir(app)?.join("settings.json");
    let raw = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_manifest() -> Result<ReleaseManifest, String> {
    let response = reqwest::Client::new()
        .get(MANIFEST_URL)
        .header(reqwest::header::USER_AGENT, "Outbreak-Zones-Launcher")
        .send().await.map_err(|e| format!("Falha ao consultar versões: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("Manifesto indisponível (HTTP {}).", response.status()));
    }
    response.json::<ReleaseManifest>().await.map_err(|e| format!("Manifesto inválido: {e}"))
}

#[tauri::command]
fn list_installed_versions(app: tauri::AppHandle) -> Result<Vec<InstalledVersion>, String> {
    let root = versions_dir(&app)?;
    let mut installed = Vec::new();
    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().map_err(|e| e.to_string())?.is_dir() { continue; }
        let metadata = entry.path().join("version.json");
        if !metadata.is_file() { continue; }
        let raw = fs::read_to_string(metadata).map_err(|e| e.to_string())?;
        if let Ok(version) = serde_json::from_str::<InstalledVersion>(&raw) {
            if entry.path().join("game.html").is_file() { installed.push(version); }
        }
    }
    installed.sort_by(|a, b| b.version.cmp(&a.version));
    Ok(installed)
}

#[tauri::command]
fn get_preferred_version(app: tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(read_settings(&app)?.preferred_version)
}

#[tauri::command]
fn set_preferred_version(app: tauri::AppHandle, version: String) -> Result<(), String> {
    let path = versions_dir(&app)?.join(&version);
    if !path.join("game.html").is_file() {
        return Err("Essa versão não está instalada.".into());
    }
    let mut settings = read_settings(&app)?;
    settings.preferred_version = Some(version);
    write_settings(&app, &settings)
}

#[tauri::command]
async fn download_game_version(app: tauri::AppHandle, version: String) -> Result<InstalledVersion, String> {
    if version.len() > 32 || semver::Version::parse(&version).is_err() {
        return Err("Versão inválida. Use o formato semântico, por exemplo 0.2.0.".into());
    }
    let manifest = fetch_manifest().await?;
    let release = manifest.versions.iter().find(|item| item.version == version)
        .ok_or_else(|| "Versão não encontrada no manifesto oficial.".to_string())?;
    let parsed = reqwest::Url::parse(&release.archive_url).map_err(|_| "URL de download inválida.".to_string())?;
    if parsed.scheme() != "https" || parsed.host_str() != Some("github.com") {
        return Err("O download precisa vir de uma URL HTTPS oficial do GitHub.".into());
    }
    if release.sha256.len() != 64 || !release.sha256.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Hash SHA-256 ausente ou inválido no manifesto.".into());
    }

    let response = reqwest::Client::new().get(parsed).header(reqwest::header::USER_AGENT, "Outbreak-Zones-Launcher")
        .send().await.map_err(|e| format!("Falha no download: {e}"))?
        .error_for_status().map_err(|e| format!("Download recusado: {e}"))?;
    if response.content_length().is_some_and(|size| size > 512 * 1024 * 1024) {
        return Err("O pacote excede o limite de 512 MiB.".into());
    }
    let bytes = response.bytes().await.map_err(|e| format!("Falha ao receber arquivo: {e}"))?;
    if bytes.len() > 512 * 1024 * 1024 {
        return Err("O pacote excede o limite de 512 MiB.".into());
    }

    let actual_hash = format!("{:x}", Sha256::digest(&bytes));
    if !actual_hash.eq_ignore_ascii_case(&release.sha256) {
        return Err("A verificação SHA-256 falhou. O pacote foi rejeitado.".into());
    }

    let root = versions_dir(&app)?;
    let destination = root.join(&version);
    if destination.join("game.html").is_file() {
        return Err("Essa versão já está instalada.".into());
    }
    if destination.exists() { fs::remove_dir_all(&destination).map_err(|e| format!("Não foi possível limpar uma instalação incompleta: {e}"))?; }
    let staging = root.join(format!(".staging-{version}"));
    if staging.exists() { fs::remove_dir_all(&staging).map_err(|e| e.to_string())?; }
    fs::create_dir_all(&staging).map_err(|e| e.to_string())?;

    let extraction = (|| -> Result<(), String> {
        let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|e| format!("Pacote ZIP inválido: {e}"))?;
        let mut expanded_size = 0_u64;
        for index in 0..archive.len() {
            let mut file = archive.by_index(index).map_err(|e| e.to_string())?;
            expanded_size = expanded_size.checked_add(file.size()).ok_or("Tamanho expandido inválido")?;
            if expanded_size > 1024 * 1024 * 1024 {
                return Err("O conteúdo descompactado excede o limite de 1 GiB.".into());
            }
            let Some(relative) = file.enclosed_name().map(Path::to_path_buf) else {
                return Err("O pacote contém um caminho inseguro.".into());
            };
            if relative.components().any(|part| matches!(part, Component::ParentDir | Component::RootDir | Component::Prefix(_))) {
                return Err("O pacote contém um caminho inseguro.".into());
            }
            let output = staging.join(relative);
            if file.is_dir() {
                fs::create_dir_all(&output).map_err(|e| e.to_string())?;
            } else {
                if let Some(parent) = output.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
                let mut target = fs::File::create(output).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut target).map_err(|e| e.to_string())?;
            }
        }
        if !staging.join("game.html").is_file() {
            return Err("Pacote incompleto: game.html não encontrado na raiz.".into());
        }
        let installed = InstalledVersion {
            version: version.clone(),
            installed_at: chrono::Utc::now().to_rfc3339(),
        };
        fs::write(staging.join("version.json"), serde_json::to_vec_pretty(&installed).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        Ok(())
    })();

    if let Err(error) = extraction {
        let _ = fs::remove_dir_all(&staging);
        return Err(error);
    }
    fs::rename(&staging, &destination).map_err(|e| {
        let _ = fs::remove_dir_all(&staging);
        format!("Não foi possível concluir a instalação: {e}")
    })?;
    Ok(InstalledVersion { version, installed_at: chrono::Utc::now().to_rfc3339() })
}

fn serve_version(root: PathBuf, save_path: PathBuf) -> Result<SocketAddr, String> {
    let server = Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
    let address = server.server_addr().to_ip().ok_or("Endereço local inválido")?;
    thread::spawn(move || {
        for mut request in server.incoming_requests() {
            let requested = request.url().split('?').next().unwrap_or("/");
            if requested == "/__save" {
                if request.method() == &Method::Get {
                    let envelope = if save_path.is_file() {
                        fs::read(&save_path).ok()
                            .and_then(|raw| serde_json::from_slice::<SaveEnvelope>(&raw).ok())
                            .filter(|data| data.schema_version == 1)
                            .unwrap_or_default()
                    } else {
                        SaveEnvelope::default()
                    };
                    let body = serde_json::to_string(&envelope).unwrap_or_else(|_| r#"{"schema_version":1,"entries":{}}"#.into());
                    let header = Header::from_bytes("Content-Type", "application/json; charset=utf-8").expect("header válido");
                    let _ = request.respond(Response::from_string(body).with_header(header));
                    continue;
                }
                if request.method() == &Method::Post {
                    let mut body = String::new();
                    let read_result = request.as_reader().take(MAX_SAVE_BYTES + 1).read_to_string(&mut body);
                    if read_result.is_err() || body.len() as u64 > MAX_SAVE_BYTES {
                        let _ = request.respond(Response::from_string("Save payload too large or invalid").with_status_code(413));
                        continue;
                    }
                    let parsed = serde_json::from_str::<SaveEnvelope>(&body);
                    let Ok(envelope) = parsed else {
                        let _ = request.respond(Response::from_string("Invalid save payload").with_status_code(400));
                        continue;
                    };
                    let valid_entries = envelope.schema_version == 1
                        && envelope.entries.len() <= 512
                        && envelope.entries.iter().all(|(key, value)| {
                            key.starts_with("outbreakzones:") && key.len() <= 160 && value.len() <= 256 * 1024
                        });
                    if !valid_entries {
                        let _ = request.respond(Response::from_string("Save payload rejected").with_status_code(400));
                        continue;
                    }
                    let serialized = match serde_json::to_vec(&envelope) {
                        Ok(data) => data,
                        Err(_) => {
                            let _ = request.respond(Response::from_string("Save serialization failed").with_status_code(500));
                            continue;
                        }
                    };
                    let nonce = SystemTime::now().duration_since(UNIX_EPOCH)
                        .map(|duration| duration.as_nanos()).unwrap_or_default();
                    let temporary = save_path.with_file_name(format!("campaign-save-{}-{nonce}.tmp", std::process::id()));
                    let write_result = fs::write(&temporary, serialized)
                        .and_then(|_| fs::rename(&temporary, &save_path));
                    if write_result.is_err() {
                        let _ = fs::remove_file(&temporary);
                        let _ = request.respond(Response::from_string("Save write failed").with_status_code(500));
                    } else {
                        let _ = request.respond(Response::from_string("saved"));
                    }
                    continue;
                }
                let _ = request.respond(Response::from_string("Method not allowed").with_status_code(405));
                continue;
            }
            if request.method() != &Method::Get {
                let _ = request.respond(Response::from_string("Method not allowed").with_status_code(405));
                continue;
            }
            let relative = if requested == "/" { "game.html" } else { requested.trim_start_matches('/') };
            let candidate = root.join(relative);
            let resolved = match candidate.canonicalize() {
                Ok(path) if path.starts_with(&root) && path.is_file() => path,
                _ => {
                    let _ = request.respond(Response::from_string("Not found").with_status_code(404));
                    continue;
                }
            };
            let mut content = Vec::new();
            let result = fs::File::open(&resolved).and_then(|mut file| file.read_to_end(&mut content));
            if result.is_err() {
                let _ = request.respond(Response::from_string("Read error").with_status_code(500));
                continue;
            }
            let mime = mime_guess::from_path(&resolved).first_or_octet_stream().to_string();
            let header = Header::from_bytes("Content-Type", mime).expect("header válido");
            let _ = request.respond(Response::from_data(content).with_header(header));
        }
    });
    Ok(address)
}

#[tauri::command]
fn launch_game(app: tauri::AppHandle, version: String) -> Result<(), String> {
    let root = versions_dir(&app)?.join(&version);
    if !root.join("game.html").is_file() {
        return Err("Instale essa versão antes de iniciar.".into());
    }
    let save_path = data_dir(&app)?.join("campaign-save.json");
    let address = serve_version(root, save_path)?;
    let url = format!("http://{}:{}/game.html", address.ip(), address.port());
    let unique = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
    WebviewWindowBuilder::new(&app, format!("game-{}-{unique}", version.replace('.', "-")), WebviewUrl::External(url.parse().map_err(|e| format!("URL inválida: {e}"))?))
        .title(format!("Outbreak Zones — Jogo v{version}"))
        .inner_size(1440.0, 900.0)
        .min_inner_size(960.0, 640.0)
        .build().map_err(|e| format!("Não foi possível abrir o jogo: {e}"))?;
    Ok(())
}

fn main() {
    let launcher_version = env!("CARGO_PKG_VERSION");
    tauri::Builder::default()
        .setup(move |app| {
            let window = app.get_webview_window("main").expect("janela principal não encontrada");
            window.set_title(&format!("Outbreak Zones | Launcher v{launcher_version}")).expect("não foi possível definir o título");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_manifest,
            list_installed_versions,
            get_preferred_version,
            set_preferred_version,
            download_game_version,
            launch_game
        ])
        .run(tauri::generate_context!())
        .expect("falha ao iniciar Outbreak Zones");
}
