#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Cursor, Read},
    net::SocketAddr,
    path::{Component, Path, PathBuf},
    thread,
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tiny_http::{Header, Response, Server};
use zip::ZipArchive;

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
    if version.is_empty() || version.len() > 32 || !version.chars().all(|c| c.is_ascii_alphanumeric() || ".-_+".contains(c)) {
        return Err("Identificador de versão inválido.".into());
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

    let bytes = reqwest::Client::new().get(parsed).header(reqwest::header::USER_AGENT, "Outbreak-Zones-Launcher")
        .send().await.map_err(|e| format!("Falha no download: {e}"))?
        .error_for_status().map_err(|e| format!("Download recusado: {e}"))?
        .bytes().await.map_err(|e| format!("Falha ao receber arquivo: {e}"))?;

    let actual_hash = format!("{:x}", Sha256::digest(&bytes));
    if !actual_hash.eq_ignore_ascii_case(&release.sha256) {
        return Err("A verificação SHA-256 falhou. O pacote foi rejeitado.".into());
    }

    let root = versions_dir(&app)?;
    let destination = root.join(&version);
    if destination.join("game.html").is_file() {
        return Err("Essa versão já está instalada.".into());
    }
    let staging = root.join(format!(".staging-{version}"));
    if staging.exists() { fs::remove_dir_all(&staging).map_err(|e| e.to_string())?; }
    fs::create_dir_all(&staging).map_err(|e| e.to_string())?;

    let extraction = (|| -> Result<(), String> {
        let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|e| format!("Pacote ZIP inválido: {e}"))?;
        for index in 0..archive.len() {
            let mut file = archive.by_index(index).map_err(|e| e.to_string())?;
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

fn serve_version(root: PathBuf) -> Result<SocketAddr, String> {
    let server = Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
    let address = server.server_addr().to_ip().ok_or("Endereço local inválido")?;
    thread::spawn(move || {
        for request in server.incoming_requests() {
            let requested = request.url().split('?').next().unwrap_or("/");
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
    let address = serve_version(root)?;
    let url = format!("http://{}:{}/game.html", address.ip(), address.port());
    WebviewWindowBuilder::new(&app, format!("game-{}", version.replace('.', "-")), WebviewUrl::External(url.parse().map_err(|e| format!("URL inválida: {e}"))?))
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
