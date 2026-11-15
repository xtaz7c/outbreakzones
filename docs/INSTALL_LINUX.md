# Outbreak Zones para Linux

Outbreak Zones pode ser executado como aplicativo desktop usando Tauri 2 e o WebKitGTK do sistema. A simulação continua em TypeScript/Phaser; o launcher fornece uma janela nativa, inicialização pelo menu de aplicativos e pacotes Linux.

## Distribuições suportadas

- Linux x86_64 com WebKitGTK 4.1.
- Pacote Debian/Ubuntu: `.deb`.
- AppImage: arquivo portátil para distribuições compatíveis.

A primeira entrega automatizada tem como alvo x86_64. Builds ARM64 e pacotes específicos de outras distribuições ainda não fazem parte desta etapa.

## Instalação

Baixe o pacote `.deb` ou `.AppImage` na seção **Artifacts** da execução Linux Desktop no GitHub Actions.

### Debian / Ubuntu

```bash
sudo apt install ./outbreak-zones_*.deb
```

Se necessário, instale a dependência do WebKitGTK:

```bash
sudo apt install libwebkit2gtk-4.1-0
```

### AppImage

```bash
chmod +x Outbreak-Zones_*.AppImage
./Outbreak-Zones_*.AppImage
```

Em algumas distribuições, o AppImage pode exigir FUSE 2.

## Desenvolvimento e build local

Requisitos: Node.js 20+, npm, Rust stable, Cargo, GTK 3, WebKitGTK 4.1, librsvg e dependências de compilação do Tauri.

```bash
npm ci
npm test
npm run lint
npm run build
bash scripts/generate-linux-icon.sh
cargo install tauri-cli --locked
cargo tauri dev
```

Para gerar os pacotes:

```bash
cargo tauri build --bundles deb,appimage
```

Os arquivos são gerados em `src-tauri/target/release/bundle/`.

## Dados locais

O jogo mantém o desbloqueio da campanha e preferências no armazenamento local do WebView. Eles ficam associados ao perfil local do aplicativo e não são sincronizados automaticamente com o navegador.

## Escopo desta porta

Esta integração empacota o jogo web existente em uma aplicação desktop Linux. Não reescreve a engine Phaser nem altera as regras da simulação. O jogo permanece single-player e executa localmente, sem exigir conexão com o servidor do site após a instalação.
