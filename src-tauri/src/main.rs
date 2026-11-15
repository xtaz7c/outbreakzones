#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    io::{Cursor, Read},
    net::SocketAddr,
    path::{Component, PathBuf},
    process::Command,
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tiny_http::{Header, Method, Response, Server};
use zip::ZipArchive;

const MAX_SAVE_BYTES: u64 = 1024 * 1024;
const MANIFEST_URL: &str = "https://raw.githubusercontent.com/xtaz7c/outbreakzones/main/releases/manifest.json";
const LAUNCHER_RELEASES_URL: &str = "https://api.github.com/repos/xtaz7c/outbreakzones/releases?per_page=100";
const MAX_LAUNCHER_PACKAGE_BYTES: usize = 512 * 1024 * 1024;

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

fn validate_version(version: &str) -> Result<(), String> {
    if version.len() > 32 || semver::Version::parse(version).is_err() {
        return Err("Versão inválida.".into());
    }
    Ok(())
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

fn launcher_package_kind() -> Result<&'static str, String> {
    if std::env::var_os("APPIMAGE").is_some() {
        Ok("AppImage")
    } else {
        Ok("deb")
    }
}

async fn latest_launcher_update() -> Result<Option<LauncherUpdate>, String> {
    let current = semver::Version::parse(env!("CARGO_PKG_VERSION"))
        .map_err(|e| format!("Versão atual do launcher inválida: {e}"))?;
    let response = reqwest::Client::new()
        .get(LAUNCHER_RELEASES_URL)
        .header(reqwest::header::USER_AGENT, "Outbreak-Zones-Launcher")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send().await.map_err(|e| format!("Falha ao consultar releases do launcher: {e}"))?
        .error_for_status().map_err(|e| format!("GitHub recusou a consulta: {e}"))?;
    let releases = response.json::<Vec<LauncherRelease>>().await
        .map_err(|e| format!("Resposta de releases inválida: {e}"))?;

    let kind = launcher_package_kind()?;
    let mut candidates: Vec<(semver::Version, LauncherUpdate)> = Vec::new();
    for release in releases.into_iter().filter(|item| !item.draft && !item.prerelease) {
        let Some(version_text) = release.tag_name.strip_prefix("launcher-v") else { continue };
        let Ok(version) = semver::Version::parse(version_text) else { continue };
        if version <= current { continue; }
        let extension = if kind == "AppImage" { ".AppImage" } else { ".deb" };
        let Some(package) = release.assets.iter().find(|asset| asset.name.ends_with(extension)) else { continue };
        let checksum_name = format!("{}.sha256", package.name);
        let Some(checksum) = release.assets.iter().find(|asset| asset.name == checksum_name) else { continue };
        let valid_url = |raw: &str| reqwest::Url::parse(raw)
            .map(|url| url.scheme() == "https" && url.host_str() == Some("github.com"))
            .unwrap_or(false);
        if !valid_url(&package.browser_download_url) || !valid_url(&checksum.browser_download_url) {
            continue;
        }
        candidates.push((version.clone(), LauncherUpdate {
            version: version.to_string(),
            package_kind: kind.to_string(),
            download_url: package.browser_download_url.clone(),
            checksum_url: checksum.browser_download_url.clone(),
            release_url: format!("https://github.com/xtaz7c/outbreakzones/releases/tag/launcher-v{version}"),
            notes: release.body.unwrap_or_default(),
        }));
    }
    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(candidates.into_iter().next().map(|(_, update)| update))
}

#[tauri::command]
fn get_launcher_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
async fn check_launcher_update() -> Result<Option<LauncherUpdate>, String> {
    latest_launcher_update().await
}

#[tauri::command]
async fn install_launcher_update(app: tauri::AppHandle) -> Result<(), String> {
    let update = latest_launcher_update().await?
        .ok_or_else(|| "O launcher já está atualizado.".to_string())?;
    let package_url = reqwest::Url::parse(&update.download_url)
        .map_err(|_| "URL do pacote inválida.".to_string())?;
    let checksum_url = reqwest::Url::parse(&update.checksum_url)
        .map_err(|_| "URL do checksum inválida.".to_string())?;
    for url in [&package_url, &checksum_url] {
        if url.scheme() != "https" || url.host_str() != Some("github.com") {
            return Err("A atualização precisa vir de uma URL HTTPS oficial do GitHub.".into());
        }
    }

    let client = reqwest::Client::new();
    let checksum_response = client.get(checksum_url)
        .header(reqwest::header::USER_AGENT, "Outbreak-Zones-Launcher")
        .send().await.map_err(|e| format!("Falha ao baixar SHA-256: {e}"))?
        .error_for_status().map_err(|e| format!("Checksum indisponível: {e}"))?;
    let checksum_text = checksum_response.text().await
        .map_err(|e| format!("Checksum inválido: {e}"))?;
    let expected_hash = checksum_text.split_whitespace().next()
        .filter(|hash| hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()))
        .ok_or_else(|| "O arquivo SHA-256 está ausente ou inválido.".to_string())?;

    let package_response = client.get(package_url)
        .header(reqwest::header::USER_AGENT, "Outbreak-Zones-Launcher")
        .send().await.map_err(|e| format!("Falha ao baixar atualização: {e}"))?
        .error_for_status().map_err(|e| format!("Pacote indisponível: {e}"))?;
    if package_response.content_length().is_some_and(|size| size > MAX_LAUNCHER_PACKAGE_BYTES as u64) {
        return Err("O pacote do launcher excede 512 MiB.".into());
    }
    let bytes = package_response.bytes().await
        .map_err(|e| format!("Falha ao receber atualização: {e}"))?;
    if bytes.len() > MAX_LAUNCHER_PACKAGE_BYTES {
        return Err("O pacote do launcher excede 512 MiB.".into());
    }
    let actual_hash = format!("{:x}", Sha256::digest(&bytes));
    if !actual_hash.eq_ignore_ascii_case(expected_hash) {
        return Err("A verificação SHA-256 falhou. A atualização foi rejeitada.".into());
    }

    if update.package_kind == "AppImage" {
        let appimage = std::env::var_os("APPIMAGE")
            .map(PathBuf::from).ok_or_else(|| "Não foi possível localizar o AppImage em execução.".to_string())?;
        let current = appimage.canonicalize()
            .map_err(|e| format!("Não foi possível localizar o arquivo AppImage: {e}"))?;
        let parent = current.parent().ok_or("Diretório do AppImage inválido")?;
        let file_name = current.file_name().ok_or("Nome do AppImage inválido")?.to_string_lossy();
        let temporary = parent.join(format!(".{file_name}.{}.update", std::process::id()));
        let backup = parent.join(format!(".{file_name}.backup"));
        fs::write(&temporary, &bytes).map_err(|e| format!("Não foi possível gravar a atualização ao lado do AppImage: {e}"))?;
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temporary, fs::Permissions::from_mode(0o755))
            .map_err(|e| { let _ = fs::remove_file(&temporary); format!("Não foi possível preparar o AppImage: {e}") })?;
        if backup.exists() {
            fs::remove_file(&backup).map_err(|e| { let _ = fs::remove_file(&temporary); format!("Não foi possível remover backup anterior: {e}") })?;
        }
        fs::rename(&current, &backup)
            .map_err(|e| { let _ = fs::remove_file(&temporary); format!("Não foi possível substituir o AppImage. Verifique as permissões da pasta: {e}") })?;
        if let Err(error) = fs::rename(&temporary, &current) {
            let _ = fs::rename(&backup, &current);
            let _ = fs::remove_file(&temporary);
            return Err(format!("Falha ao instalar AppImage; a versão anterior foi restaurada: {error}"));
        }
    } else {
        let temporary = std::env::temp_dir().join(format!("outbreak-zones-launcher-{}-{}.deb", update.version, std::process::id()));
        fs::write(&temporary, &bytes).map_err(|e| format!("Não foi possível salvar o pacote .deb: {e}"))?;
        let status = Command::new("pkexec")
            .arg("dpkg").arg("-i").arg(&temporary)
            .status()
            .map_err(|e| { let _ = fs::remove_file(&temporary); format!("Não foi possível iniciar a instalação autorizada (pkexec): {e}") })?;
        let _ = fs::remove_file(&temporary);
        if !status.success() {
            return Err("A instalação do .deb foi cancelada ou falhou. O launcher atual foi mantido.".into());
        }
    }

    app.restart();
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
    validate_version(&version)?;
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
    validate_version(&version).map_err(|_| "Versão inválida. Use o formato semântico, por exemplo 0.2.0.".to_string())?;
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
            let Some(relative) = file.enclosed_name() else {
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
            if requested == "/__loading" {
                let page = r#"<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Carregando Outbreak Zones</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111;color:#f2f0e9;font:16px system-ui,sans-serif}.loading{text-align:center}.spinner{width:38px;height:38px;margin:0 auto 22px;border:3px solid #454545;border-top-color:#c83b32;border-radius:50%;animation:spin .8s linear infinite}.label{letter-spacing:.16em;font-size:12px;font-weight:700}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><main class="loading"><div class="spinner" aria-hidden="true"></div><div class="label">CARREGANDO OPERAÇÃO</div></main><script>window.setTimeout(()=>window.location.replace('/game.html'),250)</script></body></html>"#;
                let header = Header::from_bytes("Content-Type", "text/html; charset=utf-8").expect("header válido");
                let _ = request.respond(Response::from_string(page).with_header(header));
                continue;
            }
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
    validate_version(&version)?;
    let root = versions_dir(&app)?.join(&version);
    if !root.join("game.html").is_file() {
        return Err("Instale essa versão antes de iniciar.".into());
    }
    let save_path = data_dir(&app)?.join("campaign-save.json");
    let address = serve_version(root, save_path)?;
    let url = format!("http://{}:{}/__loading", address.ip(), address.port());
    let unique = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
    let game_window = WebviewWindowBuilder::new(&app, format!("game-{}-{unique}", version.replace('.', "-")), WebviewUrl::External(url.parse().map_err(|e| format!("URL inválida: {e}"))?))
        .title(format!("Outbreak Zones — Jogo v{version}"))
        .inner_size(1440.0, 900.0)
        .min_inner_size(960.0, 640.0)
        .build().map_err(|e| format!("Não foi possível abrir o jogo: {e}"))?;

    if let Some(launcher) = app.get_webview_window("main") {
        if let Err(error) = launcher.close() {
            let _ = game_window.close();
            return Err(format!("O jogo abriu, mas não foi possível fechar o launcher: {error}"));
        }
    }
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
