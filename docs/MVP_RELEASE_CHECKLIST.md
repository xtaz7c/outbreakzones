# Checklist de preparação e publicação do MVP web

Issue de referência: [#37 — Prepare and publish the playable web MVP](https://github.com/xtaz7c/outbreakzones/issues/37).

Este documento é o roteiro de validação da primeira publicação pública. Marque cada item somente após executar e registrar o resultado. A publicação não deve ser anunciada enquanto houver bloqueadores.

## 1. Decisões de lançamento

- [x] Provedor escolhido: Netlify. A configuração versionada fica em `netlify.toml`.
- [ ] Conectar o repositório `xtaz7c/outbreakzones` ao Netlify e confirmar acesso administrativo.
- [ ] Definir/confirmar o domínio ou subdomínio público.
- [ ] Definir a matriz mínima de navegadores e sistemas operacionais desktop suportados.
- [ ] Confirmar a licença do projeto e as licenças/atribuições dos assets antes da distribuição pública.
- [ ] Confirmar a versão semântica da release e criar a tag Git correspondente após aprovar o escopo. Não incrementar a versão por commit ou PR.

## 2. Build e integridade do artefato

A configuração do Netlify executa `npm run build` e publica `dist`. O Netlify instala dependências usando o lockfile versionado; validar o fluxo em um deploy de preview antes de promover a produção.

Para validação local a partir de um clone limpo:

```bash
npm ci
npm test
npm run lint
npm run build
npm run preview
```

- [ ] Todos os comandos terminam com código de saída zero.
- [ ] A prévia de produção abre a tela inicial sem erros no console.
- [ ] O bundle carrega mapa, tiles, sprites e áudio a partir dos caminhos publicados.
- [ ] Nenhum recurso essencial depende de caminhos absolutos incompatíveis com o destino de hospedagem.
- [ ] Não há erros 404, exceções não tratadas ou avisos críticos no console.

## 3. Smoke test funcional

- [ ] Tela inicial carrega e os botões de iniciar operação e controles funcionam.
- [ ] A missão inicia sem tela em branco ou erro de carregamento.
- [ ] Seleção individual por clique e teclas 1, 2 e 3 funciona.
- [ ] Seleção múltipla por arrasto e com Shift funciona.
- [ ] Ordens de movimento, câmera WASD/setas e zoom pelo scroll funcionam.
- [ ] Pausa e retomada pelo Espaço e pelo HUD funcionam; a simulação realmente congela durante a pausa.
- [ ] Interações com acessos e resgate de civis funcionam.
- [ ] HUD, minimapa e enquadramento da câmera permanecem legíveis em zoom mínimo, padrão e máximo.
- [ ] Áudio inicia após interação permitida pelo navegador, pode ser silenciado e não bloqueia o jogo se falhar.
- [ ] Vitória, derrota, reinício e retorno à tela inicial funcionam.
- [ ] Desbloqueio da campanha e persistência local comportam-se corretamente após recarregar a página.
- [ ] Tela cheia entra e sai corretamente.

## 4. Compatibilidade e resolução

Executar o smoke test em cada combinação aprovada na matriz de suporte:

- [ ] Chromium (versão estável atual).
- [ ] Firefox (versão estável atual).
- [ ] Resolução 1280×720.
- [ ] Resolução 1366×768.
- [ ] Resolução 1920×1080.
- [ ] Janela redimensionada e tela cheia.
- [ ] Escala do HUD nos limites mínimo e máximo.

Registrar navegador, versão, sistema operacional, resolução, resultado e evidências para cada execução. Não declarar suporte a navegadores que não tenham sido testados.

## 5. Publicação e verificação pós-deploy

- [x] Configuração versionada do Netlify: Node.js 20, comando `npm run build`, diretório `dist`.
- [ ] Conectar o GitHub ao Netlify com `main` como production branch e deploy previews para Pull Requests.
- [ ] Confirmar que o preview de uma PR é publicado antes do merge e que apenas `main` atualiza a produção.
- [ ] URL pública abre em sessão anônima/limpa e em outro dispositivo.
- [ ] Fluxo completo da missão é repetido na URL pública, não apenas em localhost.
- [ ] Recursos estáticos, áudio e persistência local funcionam no domínio final.
- [ ] Registrar URL, commit, versão, data do deploy e resultado do smoke test.
- [ ] Documentar procedimento de rollback: promover deploy anterior no Netlify e corrigir pela branch/PR.

## 6. Bloqueadores conhecidos

- A conexão do repositório ao Netlify e a confirmação do domínio público dependem de acesso ao painel Netlify.
- A matriz de navegadores desktop ainda não foi executada.
- O README ainda precisa de revisão final para separar controles de jogador dos atalhos provisórios/de desenvolvimento.
- A licença do projeto está indicada como pendente no README; esclarecer licença do código e licenças/atribuições dos assets.
- A PR #41 (versionamento e identificação de build, issue #40) permanece em draft. Antes da release, revisar sua base/alterações, integrar e validar a identificação de versão e SHA no build Netlify.
