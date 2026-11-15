#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    let launcher_version = env!("CARGO_PKG_VERSION");
    let game_version = env!("OUTBREAK_GAME_VERSION");
    let window_title = format!(
        "Outbreak Zones | Launcher v{launcher_version} | Jogo v{game_version}"
    );

    tauri::Builder::default()
        .setup(move |app| {
            let window = app
                .get_webview_window("main")
                .expect("janela principal não encontrada");
            window
                .set_title(&window_title)
                .expect("não foi possível definir o título com as versões");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("falha ao iniciar Outbreak Zones");
}
