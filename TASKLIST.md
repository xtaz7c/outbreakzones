# Outbreak Zones — Tasklist do MVP

> Backlog oficial de implementação. Atualize as caixas somente após validar o comportamento no jogo e, quando aplicável, executar os testes.
>
**Status atual:** `main` já contém as fundações das Fases 2–7, inclusive mapa Tiled, câmera/controles RTS, policiais, IA de infectados, combate e acessos dinâmicos. A Fase 7 ainda precisa fechar travessia completa para civis e persistência/validação integrada. Esta branch adiciona replanejamento de rotas após mudanças de acesso e o ciclo de ondas/vitória/derrota da Fase 8. A validação de navegador continua obrigatória antes de marcar o DoD.

## 1. Visão e escopo

Criar **Outbreak Zones**, um jogo independente de estratégia tática e sobrevivência, inspirado em jogos de navegador da época do Flash (especialmente *Class 3 Outbreak*), sem copiar código, arte, mapas, interface, personagens ou outros elementos protegidos.

**MVP:** uma página inicial e um tutorial jogável no navegador. O jogador comanda três policiais para resgatar dois civis dentro de uma casa. Portas e janelas possuem estados próprios; a passagem depende do acesso e do tipo de NPC. Infectados vagam, perseguem alvos e podem atacar a casa quando atraídos por estímulos.

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
- Abrigo: a residência é uma zona segura, não um objetivo atacável. Policiais e infectados não entram nela.
- Comportamento dos infectados: vagam aleatoriamente pelo ambiente; ao detectar policiais, perseguem e atacam. Se perderem o alvo, retomam a ronda.
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
6. Ver infectados surgirem fora do abrigo e vagarem pelo ambiente sem um destino obrigatório.
7. Fazer os policiais detectarem e atacarem automaticamente inimigos válidos.
8. Definir prioridade de alvo manualmente.
9. Pausar a simulação, emitir ordens e retomá-la sem inconsistências.
10. Ver paredes bloquearem a navegação e portas/janelas permitirem passagem conforme seu estado e as regras de cada NPC.
11. Completar todas as ondas e alcançar a vitória, ou perder quando os três policiais forem incapacitados.
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

- [x] **T007 — P0** Configurar Vite e TypeScript.
- [x] **T008 — P0** Instalar e configurar Phaser 3.
- [x] **T009 — P0** Instalar e configurar Vitest.
- [x] **T010 — P1** Configurar lint e formatação.
- [x] **T011 — P0** Criar cena de inicialização e cena principal da missão.
- [x] **T012 — P0** Criar fluxo de carregamento de assets e tratamento de falhas.
- [x] **T013 — P1** Configurar resolução lógica, escala e redimensionamento responsivo.
- [x] **T014 — P0** Definir atualização da simulação com delta time e comportamento estável diante de variações de FPS.
- [x] **T015 — P0** Separar regras/simulação da camada de renderização Phaser.
- [x] **T016 — P0** Configurar scripts de desenvolvimento, teste, lint e build.

**Saída da fase:** concluída. Vite, TypeScript, Phaser, Vitest, lint, cenas, carregamento de assets com tratamento de falhas, escala responsiva e simulação desacoplada estão integrados. A CI da PR #17 executou `npm ci`, `npm test`, `npm run lint` e `npm run build` com sucesso.

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

**Progresso:** mapa Tiled, terreno, residência, acessos, obstáculos, carregamento de camadas, grade navegável e A* já estão integrados em `main`. A revisão visual final no navegador ainda precisa ser registrada; os itens permanecem desmarcados conforme o DoD.

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

**Progresso:** câmera, zoom, limites, WASD/setas, fullscreen, seleção individual/múltipla, atalhos 1–3, seleção aditiva, ordens de movimento e formação estão integrados em `main`. A validação manual final no navegador ainda precisa ser registrada.

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

**Progresso de implementação (branch `feat/police-officers-t037-t045`):** criado o modelo independente `PoliceOfficer` com atributos individuais, estados, orientação, pathfinding, deslocamento, dano e incapacitação. A `Simulation` instancia três policiais e atualiza seus movimentos no fixed timestep; `MissionScene` renderiza os modelos e encaminha ordens de movimento, preservando formação. Testes unitários do modelo foram adicionados. A cena agora também apresenta uma animação procedural básica de marcha (alternância das pernas) e orientação pelo ângulo de movimento. Não há spritesheet nem animações de ataque dedicadas. T037–T045 permanecem desmarcadas até validação visual no navegador.

### Fase 5 — Infectados e IA

- [ ] **T046 — P0** Criar entidade/modelo Infected.
- [ ] **T047 — P0** Definir vida, velocidade e dano do infectado básico.
- [ ] **T048 — P0** Implementar estados idle, moving, attacking e dead.
- [ ] **T049 — P0** Implementar detecção e escolha de alvos.
- [ ] **T050 — P0** Implementar movimentação autônoma por destinos aleatórios caminháveis.
- [ ] **T051 — P0** Implementar seleção e atualização periódica de destinos de ronda.
- [ ] **T052 — P0** Implementar detecção, perseguição e ataque contra policiais ativos.
- [ ] **T053 — P0** Garantir que paredes bloqueiem a navegação e que infectados possam atacar acessos/estruturas quando atraídos por estímulos.
- [ ] **T054 — P0** Implementar morte e remoção segura das entidades.

**Progresso de implementação (branch `feat/infected-ai-t046-t054`):** o modelo independente `Infected` implementa atributos, estados, navegação A*, detecção e ataque a policiais ativos, dano/vida e morte. A implementação inicial direcionava infectados para a residência e previa ataques às entradas; esses comportamentos foram revistos na Fase 7. A nova regra é vagar aleatoriamente por células caminháveis e perseguir policiais detectados, sem atacar estruturas nem entrar no abrigo. T046–T054 permanecem desmarcadas até validação integrada.

**Incremento atual (branch `feat/infected-patrol-perception`):** a IA deixa de caminhar para um ponto de entrada fixo e passa a escolher destinos aleatórios dentro de um raio de patrulha, limitados a células caminháveis. Policiais só são detectados quando estão dentro do alcance e há linha de visão desobstruída. Estímulos possuem posição, raio, intensidade e duração; infectados priorizam o estímulo audível mais relevante, investigam uma posição caminhável próxima e mantêm memória temporária. Disparos dos policiais também emitem estímulos de ruído, além do evento de ruído de teste já existente. A patrulha usa PRNG com seed da missão para reprodução determinística. A implementação e os testes foram adicionados, mas ainda aguardam execução local de testes, lint, build e validação visual; portanto T046–T054 continuam desmarcadas.

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

**Progresso de implementação (branch `feat/combat-system-t055-t065`):** criado `CombatSystem` desacoplado do Phaser. Inclui alcance de arma, linha de visão por grade (células bloqueadas interrompem o disparo), aquisição automática do infectado visível mais próximo, prioridade manual por policial, cadência, precisão probabilística com fonte aleatória injetável, resolução direta de acerto/dano, munição limitada (12 por carregador) e recarga temporizada (2,5 s). A simulação integra o combate no fixed timestep e expõe eventos de disparo e munição. Na cena, clique direito sobre um infectado define prioridade para as unidades selecionadas; clique direito no chão emite movimento e limpa a prioridade. Traçadores provisórios e informações de HP/munição foram adicionados ao Dev Hub. Testes unitários e de integração cobrem linha de visão, seleção de alvos, prioridade, alcance, precisão, cadência, munição/recarga e pausa. A cena agora apresenta clarão de boca do cano, traçador e faísca de impacto como feedback procedural. Não há spritesheet/animação dedicada de recuo. T055–T065 permanecem desmarcadas até validação visual no navegador.

**Saída da fase:** policiais combatem automaticamente e o jogador consegue influenciar a escolha de alvos.

### Fase 7 — Edifícios, acessos e comportamento de infectados

- [ ] **T066 — P0** Modelar edifícios como estruturas compostas por paredes e componentes de acesso independentes.
- [ ] **T067 — P0** Gerar estado inicial probabilístico e independente para cada porta: aberta, fechada ou trancada.
- [ ] **T068 — P0** Gerar estado inicial probabilístico para janelas: aberta, fechada ou bloqueada/quebrada, conforme o cenário.
- [ ] **T069 — P0** Modelar garagens como acessos próprios, com estados e regras de passagem específicos.
- [ ] **T070 — P0** Permitir entrada e saída de policiais, civis e infectados por rotas válidas, considerando tipo de NPC, estado do acesso e pathfinding interior/exterior.
- [ ] **T071 — P0** Implementar ronda aleatória, percepção por visão/ruído e perseguição; infectados podem investigar estímulos e atacar edifícios/acessos quando atraídos.
- [ ] **T124 — P1** Persistir estados dos componentes durante a missão; não sortear novamente a cada atualização, troca de cena ou recarga da visualização.

**Geração probabilística:** cada edifício recebe um perfil de condição. O estado de cada porta, janela e garagem é sorteado de forma independente usando pesos configuráveis por cenário/tipo de edifício. Exemplo: uma casa pode ter porta trancada, janela aberta e garagem fechada; a casa vizinha pode ter porta aberta e garagem trancada. Usar seed por mapa/partida para permitir reprodução de bugs e testes determinísticos. Probabilidades devem ser dados de configuração, não condicionais espalhados pelo código.

**Base técnica anterior:** a branch `feat/shelter-roaming-t066-t071` usa colisões estáticas e a regra antiga de casa inacessível. Essa lógica deve ser substituída por edifícios com interior e acessos dinâmicos.

**Progresso integrado em `main`:** `BuildingSystem` oferece acessos independentes, probabilidades reproduzíveis por seed, integridade, interação/dano e grades por tipo de ator. A IA possui patrulha, percepção visual de policiais, investigação de ruídos e ataque a acessos atraentes. A PR #18 acrescenta replanejamento de rotas policiais após mudanças de acesso.

**Incremento em `feat/phase-7-civilian-navigation-persistence`:** civis agora podem ser resgatados com E quando um policial selecionado está próximo, escoltam o policial usando A* sobre a grade específica de civis e são extraídos ao alcançar a zona marcada fora da casa. A grade civil bloqueia janelas mesmo quando abertas; portas e garagem só permitem travessia quando passáveis. Rotas de escolta são recalculadas quando um acesso muda. O `BuildingSystem` exporta/restaura estado e integridade dos acessos; a cena persiste seed e estado em `localStorage`, recuperando-os após reload. Reiniciar a missão com R limpa o estado salvo para iniciar uma nova tentativa. Testes de navegação, resgate, extração e persistência foram adicionados. T070/T124 permanecem desmarcadas até CI e validação manual integrada.

### Fase 8 — Ondas e fluxo da missão

**Implementação nesta branch:** adicionado `WaveSystem` independente da renderização, com preparação, surgimento escalonado em pontos externos, progressão de quantidade/intervalo/dificuldade e conclusão somente após eliminar todos os infectados. A `Simulation` passa a expor estados de missão (`playing`, `victory`, `defeat`), interromper a simulação no resultado e detectar vitória após a última onda ou derrota quando todos os policiais forem incapacitados. A cena exibe onda/estado, mostra o resultado e permite reiniciar com R. Testes unitários cobrem temporização, sequência determinística, pausa, vitória e derrota. A validação automatizada da branch e a revisão manual no navegador ainda são necessárias antes de marcar T072–T083.

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
- [ ] **T082 — P0** Implementar derrota quando os três policiais forem incapacitados.
- [ ] **T083 — P0** Implementar tela de resultado e reinício limpo da missão.

**Saída da fase:** ciclo completo de missão, do início ao resultado, com pausa funcional.

### Fase 9 — Interface e experiência

- [ ] **T084 — P0** Criar página inicial de Outbreak Zones, exibida antes de carregar/iniciar a missão.
- [ ] **T085 — P0** Criar HUD tático integrado ao mundo, acompanhando scroll da câmera e mantendo menus modais fixos à viewport.
- [ ] **T095 — P1** Permitir ajustar e persistir a escala do HUD nas configurações do jogo.
- [ ] **T086 — P0** Exibir vida e munição de cada policial.
- [ ] **T087 — P0** Exibir informações da unidade selecionada.
- [ ] **T088 — P0** Exibir o estado dos dois civis e o progresso do resgate.
- [ ] **T089 — P1** Exibir onda atual, estado da onda e inimigos restantes.
- [ ] **T090 — P0** Implementar controle de pausa/retomada na interface.
- [ ] **T091 — P1** Exibir feedback para ordens, destinos, seleção e alvos prioritários.
- [ ] **T092 — P0** Exibir resultado de vitória ou derrota.
- [ ] **T093 — P0** Permitir reiniciar a missão.
- [ ] **T094 — P1** Garantir legibilidade e usabilidade em diferentes resoluções desktop.

**Saída da fase:** jogador entende o estado da missão e consegue executar todas as ações necessárias pela interface.

### Fase 10 — Arte, áudio e acabamento

- [ ] **T096 — P1** Definir direção de arte, paleta, resolução-base e escala de pixel art.
- [ ] **T097 — P1** Melhorar texturas/tiles do cenário (terreno, vegetação, ruas, paredes, pisos, telhado e objetos).
- [ ] **T098 — P1** Melhorar sprites/texturas de policiais, infectados e civis, com silhuetas distintas.
- [ ] **T099 — P1** Criar variações visuais e animações dos NPCs.
- [ ] **T100 — P1** Criar animações de movimento, ataque, interação com acessos, resgate e morte.
- [ ] **T101 — P1** Criar efeitos visuais de disparo, dano, impacto na casa e interação com acessos.
- [ ] **T102 — P2** Adicionar efeitos sonoros básicos.
- [ ] **T103 — P2** Adicionar áudio ambiente ou música, se contribuir para a experiência.
- [ ] **T104 — P1** Validar consistência de escala, contraste e legibilidade das texturas.

**Saída da fase:** identidade visual coerente e feedback suficiente para interpretar as ações.

### Fase 11 — Testes, estabilidade e entrega web

- [ ] **T115 — P0** Testar seleção individual e múltipla.
- [ ] **T105 — P0** Testar pathfinding, colisões e bloqueios.
- [ ] **T106 — P0** Testar linha de visão, aquisição de alvo e combate.
- [ ] **T107 — P0** Testar pausa em todos os sistemas de simulação.
- [ ] **T108 — P0** Testar progressão, intervalos e término das ondas.
- [ ] **T109 — P0** Testar vitória, derrota e reinício.
- [ ] **T110 — P1** Testar navegadores desktop e diferentes resoluções.
- [ ] **T111 — P0** Corrigir bugs críticos e bloqueadores.
- [x] **T112 — P0** Executar testes automatizados, lint e build em ambiente limpo.
- [ ] **T113 — P1** Documentar instalação, execução, controles e como jogar.
- [ ] **T114 — P0** Publicar uma versão web jogável.

**Saída da fase:** MVP acessível no navegador, reproduzível a partir das instruções e sem bugs bloqueadores conhecidos.

### Fase 12 — Civis e tutorial de resgate

**Progresso integrado em `main` (PR #17):** criada a entidade `Civilian`, independente do Phaser, com estados `sheltered`, `following` e `extracted`; dois civis começam dentro da casa e são renderizados na cena. A PR #17 foi integrada.

**Implementação em `feat/phase-7-civilian-navigation-persistence` (PR #19):** E resgata um civil próximo do policial selecionado; civis seguem o policial por A* na grade de navegação civil, não atravessam janelas e aguardam/recalculam rota quando portas ou garagem estão bloqueadas; ao alcançar a zona verde de extração são extraídos. A vitória do tutorial exige os dois civis extraídos e todas as ondas eliminadas. O Dev Hub apresenta instruções contextuais para seleção, resgate, abertura de acessos, escolta e conclusão. T118–T120 estão implementadas nesta branch; T116–T120 permanecem desmarcadas até validação visual/manual no navegador.

- [ ] **T116 — P0** Criar entidades civis com estados de aguardando, seguindo e resgatado.
- [ ] **T117 — P0** Posicionar dois civis no interior da casa no início do tutorial.
- [ ] **T118 — P0** Implementar interação de resgate e conclusão quando os dois civis alcançarem a zona de extração.
- [ ] **T119 — P0** Implementar acompanhamento dos civis resgatados usando acessos válidos.
- [ ] **T120 — P1** Apresentar instruções contextuais para controles, acessos e resgate.
- [ ] **T121 — P1** Implementar reparo de portas, janelas, garagem e demais componentes danificados.
- [ ] **T122 — P1** Implementar aprimoramentos de componentes/edifícios (ex.: reforço, barricada ou melhoria de fechadura), com efeitos claros e limites por nível.
- [ ] **T123 — P1** Definir custos, materiais, tempo de execução e requisitos de reparo/aprimoramento; impedir melhorias gratuitas ou ilimitadas.

### Sistema Tático Básico (incremento transversal)

- [ ] **T125 — P1** Implementar ordem de manter posição, cancelando a rota ativa da unidade selecionada.
- [ ] **T126 — P1** Implementar postura de segurar fogo, suspendendo disparos automáticos sem apagar prioridades manuais.
- [ ] **T127 — P1** Permitir retornar à postura de engajamento automático por comando para unidades selecionadas.

**Progresso parcial (branch `feat/phase-7-tactical-system`):** os três comandos foram adicionados à API da simulação e a atalhos provisórios na cena: X (manter posição), H (segurar fogo) e G (engajar automaticamente). A prioridade manual de alvo continua podendo autorizar disparos durante `hold_fire`. Testes unitários e de integração foram adicionados, mas ainda não executados neste ambiente; tarefas permanecem desmarcadas até validação.

## 4. Fora do escopo atual

Não implementar antes da validação das etapas de sobrevivência e campanha, salvo decisão explícita:

- Multiplayer ou cooperação online.
- Salvamento/carregamento de campanha entre sessões.
- Árvore de habilidades e progressão persistente.
- Classes e especializações policiais.
- Vários tipos de infectados e chefes.
- Veículos dirigíveis.
- Construção livre de bases com grade modular completa.
- Economia macro ou gerenciamento complexo de recursos.
- Geração procedural de mapas.
- Versão mobile.
- Empacotamento/distribuição Linux.

A versão Linux será uma etapa posterior à validação da versão web.

## 4A. Fase 13 — IA de sobreviventes e progressão de missões

- [ ] **T128 — P0** Generalizar alvos dos infectados para qualquer NPC humano vivo, preservando alcance de detecção e linha de visão.
- [ ] **T129 — P0** Implementar estados comportamentais calmo/pânico para civis e NPCs humanos.
- [ ] **T130 — P0** Fazer NPCs fugirem de infectados percebidos sem atravessar obstáculos.
- [ ] **T131 — P0** Fazer NPCs seguirem policiais automaticamente e permitir perda/reconquista de escolta.
- [ ] **T132 — P1** Padronizar silhueta humana dos NPCs com paletas por função/estado.
- [ ] **T133 — P0** Fazer reforços infectados surgirem fora dos limites e percorrerem uma rota de entrada antes de patrulhar/perseguir.
- [ ] **T134 — P0** Separar Missão 0 — O Resgate (tutorial) da Missão 1 — Refúgio (campanha).
- [ ] **T135 — P0** Ao concluir o tutorial, oferecer retorno à página inicial ou início da campanha.

**Progresso em PR #27:** infectados já usam alvos humanos genéricos e podem atacar policiais e civis; civis possuem vida, comportamento calmo/pânico, fuga por pathfinding, seguimento automático e perda de escolta por separação; reforços começam fora do mapa e caminham até a célula de entrada; constantes de mundo foram sincronizadas com 80×45; Missão 0 e Missão 1 foram separadas no fluxo inicial e o tutorial oferece retorno à Home ou início da campanha. Testes, lint e build passaram na última execução CI. QA visual/manual permanece pendente, então as tarefas seguem desmarcadas.

## 4B. Fase 14 — Construções táticas e configuração do HUD

- [ ] **T136 — P0** Criar barra inferior com quatro ações: abrigo improvisado, armazém improvisado, posto de atirador e barricada.
- [ ] **T137 — P0** Definir custos, capacidade, regras de posicionamento e persistência para barraca de moradia e barraca de recursos.
- [ ] **T138 — P0** Implementar posto de atirador fixo, com aquisição de alvos, alcance, cadência e dano.
- [ ] **T139 — P0** Implementar barricadas/muros que bloqueiam infectados, recebem dano e podem ser destruídos.
- [ ] **T140 — P1** Adicionar configuração persistente para aumentar/diminuir a escala do HUD, independente do zoom da câmera.
- [ ] **T141 — P1** Validar layout dos quatro ícones e escala do HUD em resoluções desktop diferentes.

**Definição pendente de balanceamento:** custos iniciais, capacidade das tendas e dano/alcance do atirador serão valores configuráveis, não constantes espalhadas pela cena. O posto de atirador não pode receber ordens de movimento; barricadas precisam atualizar navegação quando construídas/destruídas.

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
- Parâmetros de ronda aleatória (raio, intervalo e distribuição dos destinos).
- Estímulos que atraem infectados para a casa (ruído de tiros, portas, janelas, civis ou eventos).
- Probabilidades/ponderações iniciais por tipo de edifício, região e cenário, inclusive estados de garagem.
- Como infectados atacam a casa, quais componentes podem danificar e se conseguem arrombar acessos.
- Quem pode reparar/aprimorar componentes, com quais recursos, ferramentas, custos, tempos e limites.
- Como cada NPC interage com portas trancadas, janelas fechadas e garagens.
- Zona de extração para concluir o resgate dos civis.
- Alcance de detecção e regras para perder/retomar perseguição.
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