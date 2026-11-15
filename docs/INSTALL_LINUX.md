# Outbreak Zones para Linux

Outbreak Zones pode ser executado como aplicativo desktop usando Tauri 2 e o WebKitGTK do sistema. A simulação continua em TypeScript/Phaser; o launcher fornece uma janela nativa, gerenciamento de versões do jogo, inicialização pelo menu de aplicativos e pacotes Linux.

## Distribuições suportadas

- Linux x86_64 com WebKitGTK 4.1.
- Pacote Debian/Ubuntu: `.deb`.
- AppImage: arquivo portátil para distribuições compatíveis.

A primeira entrega automatizada tem como alvo x86_64. Builds ARM64 e pacotes específicos de outras distribuições ainda não fazem parte desta etapa.

## Instalação

Para instalar uma versão publicada, baixe o `.deb` ou `.AppImage` nos assets de uma release `launcher-vX.Y.Z` em [GitHub Releases](https://github.com/xtaz7c/outbreakzones/releases). Os **Artifacts** do GitHub Actions são destinados a builds de validação e expiram após 30 dias.

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

## Gerenciamento de versões

Ao abrir, o launcher consulta o manifesto oficial de versões. A instalação de uma atualização exige confirmação e o pacote é validado por SHA-256 antes de ser extraído. Cada versão fica em um diretório separado; versões antigas não são substituídas nem removidas automaticamente. Selecione a versão desejada e use **Iniciar jogo**. A primeira instalação/atualização exige conexão com a internet; depois de baixada, a versão instalada roda localmente.

A versão do launcher e a versão do jogo são independentes. Atualizações do jogo são distribuídas pelo manifesto e pelos ZIPs das GitHub Releases. O launcher verifica releases com a tag `launcher-vX.Y.Z`, baixa o pacote correspondente ao formato instalado e valida o SHA-256 antes de instalar. O AppImage é substituído pelo próprio aplicativo; o pacote `.deb` é instalado por `pkexec dpkg -i`, solicitando autorização do sistema. O launcher é reiniciado após a atualização.

### Publicação de versões

Os canais de release são separados:

- **Jogo:** publique a tag `vX.Y.Z`, com `package.json` na mesma versão. O workflow publica o ZIP do jogo e atualiza `releases/manifest.json`.
- **Launcher:** atualize a versão em `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json` (mantenha as duas iguais), depois publique a tag `launcher-vX.Y.Z`. O workflow publica os pacotes Linux e seus arquivos SHA-256.

Uma release do jogo não atualiza o launcher. Uma release `launcher-vX.Y.Z` não altera a versão do jogo. Como o launcher atual está na versão `0.1.0`, a primeira atualização automática deverá ser publicada como `launcher-v0.1.1` ou superior. Para atualizar um AppImage, o arquivo precisa estar em uma pasta com permissão de escrita para o usuário.

## Dados locais

O launcher lista as versões publicadas no manifesto, permite instalar qualquer versão disponível (inclusive versões antigas), manter várias instalações lado a lado e escolher qual será iniciada. O launcher armazena versões instaladas e a versão padrão no diretório de dados do aplicativo. O jogo mantém o desbloqueio da campanha e preferências no armazenamento local do WebView; esses dados não são sincronizados automaticamente com o navegador.

## Escopo desta porta

Esta integração empacota o jogo web existente em uma aplicação desktop Linux. Não reescreve a engine Phaser nem altera as regras da simulação. O jogo permanece single-player e executa localmente, sem exigir conexão com o servidor do site após a instalação.


## Salvamento de campanha

O launcher mantém o salvamento em seu diretório de dados, separado das versões instaladas. O progresso da campanha é restaurado antes de abrir o menu de operações e sincronizado automaticamente. Atualizações do launcher e do jogo não devem apagar o arquivo de salvamento. Se uma versão antiga encontrar um capítulo mais novo que ainda não possui, ela solicita atualização em vez de reiniciar a campanha.
