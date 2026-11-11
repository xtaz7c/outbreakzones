# Checklist de preparação e publicação do MVP web

Issue de referência: [#37 — Prepare and publish the playable web MVP](https://github.com/xtaz7c/outbreakzones/issues/37).

Este documento é o roteiro de validação da primeira publicação pública. Marque cada item somente após executar e registrar o resultado. A publicação não deve ser anunciada enquanto houver bloqueadores.

## 1. Decisões de lançamento

- [x] Provedor escolhido: Netlify. A configuração versionada fica em netlify.toml.
- [x] URL pública definida e confirmada pelo mantenedor: https://outbreakzones.netlify.app/.
- [x] O deploy preview da PR #44 foi reportado como aprovado pelo status do Netlify no GitHub.
- [ ] Registrar a matriz mínima de navegadores e sistemas operacionais desktop suportados.
- [x] Licença MIT adicionada para o código-fonte em LICENSE.
- [ ] Confirmar procedência, licença e atribuição de todos os assets incluídos na distribuição; ver docs/ASSET_LICENSES.md.
- [ ] Aprovar formalmente a versão da release e criar a tag Git correspondente. A versão atual permanece 0.1.0; a PR #44 não gerou bump.

## 2. Build e integridade do artefato

A configuração do Netlify executa npm run build e publica dist, usando Node.js 20. A CI da PR #44 executou npm ci, testes (148 aprovados), lint e build com sucesso. A verificação automatizada da PR não substitui o smoke test em cada navegador suportado.

Para validação local a partir de um clone limpo:

```bash
npm ci
npm test
npm run lint
npm run build
npm run preview
```

- [x] npm ci, npm test, npm run lint e npm run build passam na CI da PR #44.
- [ ] Executar os comandos acima em clone limpo e registrar a versão de Node/npm.
- [ ] Verificar a prévia de produção local e o console do navegador.
- [ ] Confirmar carregamento de mapa, tiles, sprites e áudio no artefato publicado, sem 404 ou exceções.
- [ ] Confirmar que nenhum recurso essencial depende de caminhos absolutos incompatíveis com hospedagem.

## 3. Smoke test funcional

O mantenedor confirmou que a URL pública está funcionando normalmente. Os testes detalhados abaixo ainda precisam de registro individual para formar uma evidência reproduzível.

- [x] URL pública abre e foi testada pelo mantenedor: https://outbreakzones.netlify.app/.
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

Executar o smoke test em cada combinação aprovada na matriz de suporte. Até que a matriz seja definida e executada, não declarar suporte formal a navegadores/resoluções.

- [ ] Chromium (versão estável atual).
- [ ] Firefox (versão estável atual).
- [ ] Resolução 1280×720.
- [ ] Resolução 1366×768.
- [ ] Resolução 1920×1080.
- [ ] Janela redimensionada e tela cheia.
- [ ] Escala do HUD nos limites mínimo e máximo.

Registrar navegador, versão, sistema operacional, resolução, resultado e evidências para cada execução.

## 5. Publicação e verificação pós-deploy

- [x] Configuração versionada do Netlify: Node.js 20, comando npm run build, diretório dist.
- [x] URL pública informada e testada pelo mantenedor: https://outbreakzones.netlify.app/.
- [ ] Confirmar no painel Netlify que main é a production branch e que deploy previews estão habilitados para Pull Requests.
- [ ] Repetir o fluxo completo da missão na URL pública e registrar o resultado detalhado.
- [ ] Confirmar recursos estáticos, áudio e persistência local no domínio final.
- [ ] Registrar URL, commit, versão, data do deploy e resultado do smoke test detalhado.
- [ ] Documentar procedimento de rollback: promover deploy anterior no Netlify e corrigir pela branch/PR.

## 6. Versionamento e identidade de build

- [x] Política de versionamento documentada em docs/CONTRIBUTING.md.
- [x] Versão centralizada em package.json; a versão atual continua 0.1.0.
- [x] PR #44 integrada à main (merge commit 65ce6d9e021c6ceb32c17dd06b525a92cae0ac8a), substituindo a antiga PR #41.
- [x] Tela inicial e loader recebem versão e identificador curto de build pelo mecanismo integrado na PR #44.
- [ ] Conferir visualmente na URL pública se a versão e o SHA curto aparecem corretamente na tela inicial e no loader.
- [ ] Aprovar versão/tag da release somente depois de fechar os critérios de distribuição.

## 7. Pendências / bloqueadores

- Matriz de navegadores e resoluções desktop ainda não foi executada nem formalizada.
- A licença MIT foi definida para o código-fonte. Isso não cobre automaticamente sprites, tiles ou áudio.
- A procedência e a permissão de redistribuição dos assets listados em docs/ASSET_LICENSES.md ainda precisam ser confirmadas. Esta é uma condição bloqueadora para uma release pública.
- É necessário registrar o smoke test detalhado, mesmo com a confirmação geral de funcionamento dada pelo mantenedor.
- A conferência visual de versão + SHA da PR #44 na tela inicial e no loader continua pendente.
- A conexão/configuração do Netlify e o domínio público já foram confirmados funcionalmente pela publicação; os detalhes de production branch/deploy previews ainda devem ser conferidos no painel.
