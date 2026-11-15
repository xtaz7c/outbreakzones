# Gerenciador de versões do Outbreak Zones

O launcher Linux mantém o aplicativo desktop separado das versões do jogo.

## Comportamento

- Consulta `releases/manifest.json` no branch `main` ao abrir ou quando solicitado.
- Só baixa uma versão após confirmação explícita.
- Verifica SHA-256 antes de extrair qualquer arquivo.
- Instala cada versão em seu próprio diretório de dados do usuário.
- Mantém as versões anteriores e permite definir uma versão padrão.
- Abre o jogo em uma janela webview separada, servida por HTTP apenas em `127.0.0.1`.
- Atualizações do launcher (pacote .deb/AppImage) são independentes das atualizações do jogo.

## Manifesto de versões

O arquivo `releases/manifest.json` tem o formato:

```json
{
  "schema": 1,
  "latest_version": "0.2.0",
  "versions": [
    {
      "version": "0.2.0",
      "archive_url": "https://github.com/xtaz7c/outbreakzones/releases/download/v0.2.0/outbreak-zones-game-0.2.0.zip",
      "sha256": "<64 caracteres hexadecimais>",
      "notes": "Resumo das mudanças",
      "released_at": "2026-11-15T00:00:00Z"
    }
  ]
}
```

O ZIP deve conter `game.html` na raiz e todos os arquivos gerados pelo build Vite (incluindo `assets/`). Não publique uma entrada no manifesto antes de anexar o ZIP à release e calcular seu SHA-256.

## Publicação de uma versão

1. Atualize `package.json` e crie uma tag de release correspondente.
2. O workflow Linux deve gerar o pacote web ZIP e anexá-lo à GitHub Release.
3. Calcule SHA-256 do ZIP publicado.
4. Atualize `releases/manifest.json` em `main` com a URL e o hash reais.
5. Não altere nem remova entradas antigas: elas permitem reinstalar versões anteriores.

## Limitações atuais

O manifesto começa vazio porque ainda não existe pacote de jogo publicado como asset de release. Até a primeira release com ZIP e hash, o launcher não exibirá versões para instalar. O launcher Tauri também continua sendo atualizado separadamente pelos pacotes desktop.
