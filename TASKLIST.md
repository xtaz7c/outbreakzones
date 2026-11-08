# Testgame — Tasklist do MVP

> Backlog oficial de implementação. Atualize as caixas somente após validar o comportamento no jogo e, quando aplicável, executar os testes.
>
> **Status atual:** T001–T016 foram integradas à `main`. O `package-lock.json` foi regenerado e contém as dependências resolvidas; instalações limpas devem usar `npm ci`. O usuário informou que `npm run build` passou localmente; ainda falta registrar evidência de `npm ci`, `npm test` e `npm run lint` para encerrar a validação da Fase 1. A Fase 2 está em implementação na branch `feat/map-world-t017-t026`; não marcar tarefas como concluídas até executar testes e revisar o mapa no navegador.

## 1. Visão e escopo

Criar um jogo independente de estratégia tática e sobrevivência, inspirado em jogos de navegador da época do Flash (especialmente *Class 3 Outbreak*), sem copiar código, arte, mapas, interface, personagens ou outros elementos protegidos.

**MVP:** uma missão de defesa de uma pequena residência, jogável no navegador, na qual o jogador comanda três policiais contra ondas de infectados.

### Direção de design confirmada

- Gênero: RTS tático de sobrevivência.
- Perspectiva: top-down 2D.
- Arte: pixel art original.
- Simulação: tempo real com pausa estratégica.
- Câmera: deslocamento pelo mapa e zoom.
- Equipe: três policiais, selecionáveis individualmente e em grupo.
- Comandos: movimentação e prioridade de alvo.
- Combate: disparos automáticos quando houver alvo válido.
- Inimigos: infectados chegando em ondas.
- Objetivo: proteger uma pequena residência.
- Plataforma inicial: navegador.
- Plataforma futura: Linux.

### Tecnologias propostas

- TypeScript
- Phaser 3
- Vite
- Tiled (ou formato equivalente para mapas)
- Vitest

A lógica de simulação (regras, combate, IA, ondas e estados) deve ficar desacoplada da renderização e das APIs específicas do Phaser sempre que isso for razoável.

## 2. Critérios de aceitação do MVP

O MVP só será considerado funcional quando for possível:

1. Abrir o jogo no navegador e iniciar uma missão.
2. Visualizar o mapa da residência e seus arredores.
3. Selecionar cada policial individualmente e selecionar múltiplos policiais por arrasto.
4. Emitir ordens de movimento com clique direito.
5. Fazer as unidades navegarem sem atravessar paredes ou obstáculos bloqueantes.
6. Ver infectados surgirem em pontos definidos e avançarem em direção à residência.
7. Fazer os policiais detectarem e atacarem automaticamente inimigos válidos.
8. Definir prioridade de alvo manualmente.
9. Pausar a simulação, emitir ordens e retomá-la sem inconsistências.
10. Ver portas/janelas sofrerem dano e permitirem invasão quando sua integridade acabar.
11. Completar todas as ondas e alcançar a vitória, ou perder por uma condição de derrota definida.
12. Reiniciar a missão sem recarregar a página.
13. Executar testes, lint e build com sucesso.

## 3. Backlog de implementação

Legenda sugerida: **P0** = bloqueia a fundação/MVP; **P1** = necessário para o ciclo principal; **P2** = acabamento e entrega.

### Fase 0 — Planejamento e repositório

- [x] **T001 — P0** Confirmar o escopo fechado do MVP e seus critérios de aceitação.
- [x] **T002 — P0** Criar README com visão do projeto, requisitos e instruções de execução.
- [x] **T003 — P1** Documentar fluxo de branches, commits e pull requests.
- [x] **T004 — P0** Criar a estrutura inicial de diretórios.
- [x] **T005 — P1** Definir convenções de código, nomes e configuração TypeScript.
- [x] **T006 — P1** Documentar decisões de arquitetura e decisões de design relevantes.

**Saída da fase:** repositório documentado e pronto para receber a aplicação. ✅

### Fase 1 — Fundação técnica

- [ ] **T007 — P0** Configurar Vite e TypeScript.
- [ ] **T008 — P0** Instalar e configurar Phaser 3.
- [ ] **T009 — P0** Instalar e configurar Vitest.
- [ ] **T010 — P1** Configurar lint e formatação.
- [ ] **T011 — P0** Criar cena de inicialização e cena principal da missão.
- [ ] **T012 — P0** Criar fluxo de carregamento de assets e tratamento de falhas.
- [ ] **T013 — P1** Configurar resolução lógica, escala e redimensionamento responsivo.
- [ ] **T014 — P0** Definir atualização da simulação com delta time e comportamento estável diante de variações de FPS.
- [ ] **T015 — P0** Separar regras/simulação da camada de renderização Phaser.
- [ ] **T016 — P0** Configurar scripts de desenvolvimento, teste, lint e build.

**Saída da fase:** implementação integrada; validação final pendente de `npm ci`, `npm test` e `npm run lint`. O usuário confirmou que `npm run build` passou localmente.

### Fase 2 — Mapa e mundo

- [ ] **T017 — P0** Definir dimensões do mapa, escala das células e limites do mundo.
- [ ] **T018 — P0** Criar o mapa inicial em Tiled ou formato equivalente.
- [ ] **T019 — P0** Criar terreno, rua/acesso, quintal e vegetação.
- [ ] **T020 — P0** Construir a residência com cômodos e paredes.
- [ ] **T021 — P0** Adicionar portas e janelas como elementos identificáveis pelo jogo.
- [ ] **T022 — P0** Adicionar obstáculos e geometria de colisão.
- [ ] **T023 — P0** Implementar carregamento das camadas e propriedades do mapa.
- [ ] **T024 — P0** Implementar colisões entre unidades e cenário.
- [ ] **T025 — P0** Definir células/áreas navegáveis e bloqueadas.
- [ ] **T026 — P0** Implementar pathfinding e desvio de obstáculos.

**Saída da fase:** mapa renderizado e validado visualmente pelo usuário; `npm test` passou com 32 testes, `npm run lint` passou e `npm run build` passou. T017–T026 ainda aguardam revisão final e integração por PR. A validação visual revelou a necessidade de controles de câmera, que estão sendo implementados na Fase 3.

### Fase 3 — Câmera e controles RTS

- [ ] **T027 — P0** Implementar câmera que se desloca pelo mapa.
- [ ] **T028 — P0** Implementar zoom com limites mínimo e máximo.
- [ ] **T029 — P1** Implementar deslocamento de câmera por WASD e/ou setas.
- [ ] **T030 — P0** Restringir câmera aos limites do mundo.
- [ ] **T031 — P0** Implementar seleção individual por clique esquerdo.
- [ ] **T032 — P0** Implementar seleção múltipla por caixa de seleção.
- [ ] **T033 — P1** Implementar atalhos de seleção 1, 2 e 3.
- [ ] **T034 — P0** Exibir indicador visual das unidades selecionadas.
- [ ] **T035 — P0** Implementar ordem de movimentação com clique direito.
- [ ] **T036 — P1** Implementar destino/posicionamento em formação para ordens em grupo, evitando sobreposição de unidades.

**Saída da fase:** câmera, zoom, limites do mundo, deslocamento WASD/setas e tela cheia implementados na branch `feat/camera-controls-t027-t030`. Na branch `feat/rts-selection-orders-t031-t036` foram adicionados marcadores provisórios dos três policiais, seleção individual, seleção por arrasto, atalhos 1–3, seleção aditiva com Shift, ordens de movimento pelo botão direito, pathfinding A* e destinos em linha para grupos. T027–T036 aguardam execução de testes/lint/build e validação manual no navegador. Os marcadores e o movimento são provisórios e serão substituídos/integrados ao modelo PoliceOfficer na Fase 4.

### Fase 4 — Policiais

- [ ] **T037 — P0** Criar entidade/modelo PoliceOfficer.
- [ ] **T038 — P0** Definir atributos: vida, velocidade, alcance, precisão e cadência.
- [ ] **T039 — P0** Implementar estados idle, moving, attacking e incapacitated.
- [ ] **T040 — P0** Implementar movimentação até o destino.
- [ ] **T041 — P0** Integrar pathfinding à movimentação.
- [ ] **T042 — P1** Implementar animações de movimento e orientação.
- [ ] **T043 — P0** Implementar vida individual e recebimento de dano.
- [ ] **T044 — P0** Implementar incapacitação e cancelamento de ordens incompatíveis.
- [ ] **T045 — P0** Instanciar os três policiais no cenário.

**Saída da fase:** três policiais controláveis, com estados e atributos individuais.

### Fase 5 — Infectados e IA

- [ ] **T046 — P0** Criar entidade/modelo Infected.
- [ ] **T047 — P0** Definir vida, velocidade e dano do infectado básico.
- [ ] **T048 — P0** Implementar estados idle, moving, attacking e dead.
- [ ] **T049 — P0** Implementar detecção e escolha de alvos.
- [ ] **T050 — P0** Implementar navegação em direção à residência.
- [ ] **T051 — P0** Implementar escolha de ponto de entrada válido.
- [ ] **T052 — P0** Implementar ataque contra policiais próximos.
- [ ] **T053 — P0** Implementar ataque contra portas e janelas.
- [ ] **T054 — P0** Implementar morte e remoção segura das entidades.

**Saída da fase:** infectados conseguem navegar, atacar e ser derrotados sem quebrar a simulação.

### Fase 6 — Combate

- [ ] **T055 — P0** Implementar alcance das armas.
- [ ] **T056 — P0** Implementar linha de visão, bloqueada por paredes e obstáculos sólidos.
- [ ] **T057 — P0** Implementar aquisição automática de alvos válidos.
- [ ] **T058 — P1** Definir critérios previsíveis de prioridade automática (por exemplo, distância e ameaça).
- [ ] **T059 — P1** Permitir ao jogador ordenar prioridade de alvo.
- [ ] **T060 — P0** Implementar disparo automático respeitando estado, alcance e linha de visão.
- [ ] **T061 — P0** Implementar cadência e precisão.
- [ ] **T062 — P0** Implementar resolução de acerto (projétil ou cálculo validado de impacto).
- [ ] **T063 — P0** Implementar dano e feedback de impacto.
- [ ] **T064 — P1** Implementar munição limitada e recarga.
- [ ] **T065 — P1** Implementar feedback visual e animações de disparo.

**Saída da fase:** policiais combatem automaticamente e o jogador consegue influenciar a escolha de alvos.

### Fase 7 — Residência e defesa

- [ ] **T066 — P0** Definir portas e janelas como pontos de entrada vulneráveis.
- [ ] **T067 — P0** Implementar integridade individual de portas e janelas.
- [ ] **T068 — P0** Permitir que infectados danifiquem entradas.
- [ ] **T069 — P0** Permitir entrada de infectados quando uma abertura for rompida.
- [ ] **T070 — P0** Definir e implementar a condição de invasão/derrota da residência.
- [ ] **T071 — P1** Exibir integridade e estado de defesa da casa.

**Saída da fase:** a residência é um objetivo funcional, não apenas um elemento visual.

### Fase 8 — Ondas e fluxo da missão

- [ ] **T072 — P0** Criar WaveSystem independente da cena/renderização.
- [ ] **T073 — P0** Definir pontos de surgimento fora da área protegida e fora da visão imediata do jogador, quando aplicável.
- [ ] **T074 — P0** Configurar quantidade de infectados e intervalo entre ondas.
- [ ] **T075 — P1** Implementar progressão de dificuldade entre ondas.
- [ ] **T076 — P0** Implementar intervalo de preparação entre ondas.
- [ ] **T077 — P1** Exibir número e estado da onda atual.
- [ ] **T078 — P0** Implementar início e estado da missão.
- [ ] **T079 — P0** Implementar pausa e retomada.
- [ ] **T080 — P0** Garantir que movimento, IA, combate, dano, temporizadores e ondas parem durante a pausa; a interface e emissão de ordens permanecem utilizáveis.
- [ ] **T081 — P0** Implementar condição de vitória após sobreviver a todas as ondas.
- [ ] **T082 — P0** Implementar condições de derrota (equipe incapacitada ou residência invadida, conforme regra definida).
- [ ] **T083 — P0** Implementar tela de resultado e reinício limpo da missão.

**Saída da fase:** ciclo completo de missão, do início ao resultado, com pausa funcional.

### Fase 9 — Interface e experiência

- [ ] **T084 — P1** Criar menu inicial e entrada para iniciar a missão.
- [ ] **T085 — P0** Criar HUD da missão.
- [ ] **T086 — P0** Exibir vida e munição de cada policial.
- [ ] **T087 — P0** Exibir informações da unidade selecionada.
- [ ] **T088 — P1** Exibir estado da residência.
- [ ] **T089 — P1** Exibir onda atual, estado da onda e inimigos restantes.
- [ ] **T090 — P0** Implementar controle de pausa/retomada na interface.
- [ ] **T091 — P1** Exibir feedback para ordens, destinos, seleção e alvos prioritários.
- [ ] **T092 — P0** Exibir resultado de vitória ou derrota.
- [ ] **T093 — P0** Permitir reiniciar a missão.
- [ ] **T094 — P1** Garantir legibilidade e usabilidade em diferentes resoluções desktop.

**Saída da fase:** jogador entende o estado da missão e consegue executar todas as ações necessárias pela interface.

### Fase 10 — Arte, áudio e acabamento

- [ ] **T095 — P1** Definir paleta, resolução-base e escala de pixel art.
- [ ] **T096 — P1** Criar sprites originais provisórios dos policiais.
- [ ] **T097 — P1** Criar sprites originais dos infectados.
- [ ] **T098 — P1** Criar tileset e objetos originais da residência.
- [ ] **T099 — P1** Criar animações essenciais (parado, movimento, ataque e morte).
- [ ] **T100 — P1** Criar efeitos visuais de disparo, dano e morte.
- [ ] **T101 — P2** Adicionar efeitos sonoros básicos.
- [ ] **T102 — P2** Adicionar áudio ambiente ou música, se contribuir para a experiência.
- [ ] **T103 — P1** Validar consistência de escala, contraste e legibilidade dos sprites.

**Saída da fase:** identidade visual coerente e feedback suficiente para interpretar as ações.

### Fase 11 — Testes, estabilidade e entrega web

- [ ] **T104 — P0** Testar seleção individual e múltipla.
- [ ] **T105 — P0** Testar pathfinding, colisões e bloqueios.
- [ ] **T106 — P0** Testar linha de visão, aquisição de alvo e combate.
- [ ] **T107 — P0** Testar pausa em todos os sistemas de simulação.
- [ ] **T108 — P0** Testar progressão, intervalos e término das ondas.
- [ ] **T109 — P0** Testar vitória, derrota e reinício.
- [ ] **T110 — P1** Testar navegadores desktop e diferentes resoluções.
- [ ] **T111 — P0** Corrigir bugs críticos e bloqueadores.
- [ ] **T112 — P0** Executar testes automatizados, lint e build em ambiente limpo.
- [ ] **T113 — P1** Documentar instalação, execução, controles e como jogar.
- [ ] **T114 — P0** Publicar uma versão web jogável.

**Saída da fase:** MVP acessível no navegador, reproduzível a partir das instruções e sem bugs bloqueadores conhecidos.

## 4. Fora do escopo do MVP

Não implementar antes da validação do MVP, salvo decisão explícita:

- Multiplayer ou cooperação online.
- Campanha com múltiplas missões.
- Salvamento/carregamento de campanha.
- Árvore de habilidades e progressão persistente.
- Classes e especializações policiais.
- Vários tipos de infectados e chefes.
- Veículos dirigíveis.
- Construção livre de bases.
- Economia ou gerenciamento complexo de recursos.
- Geração procedural de mapas.
- Versão mobile.
- Empacotamento/distribuição Linux.

A versão Linux será uma etapa posterior à validação da versão web.

## 5. Regras de engenharia e colaboração

1. Inspecionar o repositório e o estado atual antes de modificar arquivos.
2. Não sobrescrever trabalho existente sem revisar o diff.
3. Trabalhar em branches de funcionalidade; não desenvolver diretamente em `main`.
4. Manter commits pequenos e com mensagens descritivas.
5. Relacionar commits e pull requests aos IDs das tarefas (ex.: `T007`).
6. Não marcar tarefa como concluída apenas porque o arquivo foi criado: validar o comportamento e os critérios.
7. Criar testes unitários para regras de simulação e testes de integração para fluxos críticos.
8. Evitar dependência direta do Phaser em regras de domínio.
9. Não adicionar dependências sem justificar sua necessidade.
10. Não incluir assets de terceiros sem verificar licença e atribuição.
11. Não fazer merge, publicar releases ou alterar configurações sensíveis sem autorização.
12. Ao concluir uma tarefa, registrar: resumo, arquivos alterados, testes executados, resultado e pendências.

## 6. Definições que podem ser ajustadas durante o protótipo

As decisões abaixo ainda precisam de balanceamento ou detalhamento. Não devem bloquear a fundação técnica:

- Dimensões exatas do mapa e tamanho da grade.
- Quantidade de ondas, inimigos por onda e duração dos intervalos.
- Valores de vida, dano, velocidade, alcance, precisão e cadência.
- Capacidade de munição e duração da recarga.
- Quantidade de dano necessária para romper portas/janelas.
- Regra exata de derrota por invasão.
- Resolução-base e tamanho dos sprites.

Registrar alterações no GDD/README antes de implementar mudanças que afetem o escopo.

## 7. Primeiro marco recomendado

Concluir as Fases 0 e 1: repositório documentado, projeto Vite + TypeScript + Phaser executando no navegador, Vitest configurado e build/lint funcionando.

Depois disso, avançar para mapa, câmera e movimentação. Não começar sistemas de combate ou ondas antes de haver unidades navegáveis no cenário.

## 8. Definition of Done (DoD)

Uma tarefa só pode ser marcada como concluída quando:

- [ ] O comportamento descrito está implementado.
- [ ] O código segue a arquitetura e os padrões do projeto.
- [ ] Os casos relevantes possuem testes ou validação manual documentada.
- [ ] Não há regressões conhecidas nos fluxos já implementados.
- [ ] Lint e build passam.
- [ ] Documentação foi atualizada quando necessário.
- [ ] O resultado foi revisado no navegador, quando envolve gameplay ou interface.


**Ajuste adicional de interface:** o painel Dev Hub foi convertido para coordenadas do mundo (sem `setScrollFactor(0)`), acompanhando o deslocamento e o zoom da câmera. Os controles de tela cheia e a caixa de seleção continuam fixos à viewport por serem elementos de interface.