use std::{env, fs, path::Path};

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR não definido");
    let package_json = Path::new(&manifest_dir).join("../package.json");
    println!("cargo:rerun-if-changed={}", package_json.display());

    let package = fs::read_to_string(&package_json).expect("não foi possível ler package.json");
    let game_version = package
        .lines()
        .find(|line| line.trim_start().starts_with("\"version\""))
        .and_then(|line| line.split('"').nth(3))
        .filter(|version| !version.is_empty())
        .expect("versão do jogo não encontrada em package.json");

    println!("cargo:rustc-env=OUTBREAK_GAME_VERSION={game_version}");
    tauri_build::build()
}
