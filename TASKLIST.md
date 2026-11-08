# Testgame — Tasklist do MVP

> Backlog oficial de implementação. Atualize as caixas somente após validar o comportamento no jogo e, quando aplicável, executar os testes.
>
> **Status atual:** Fundação (T001–T016) implementada e revisada na branch `feat/foundation-t001-t016`. Validado: npm test (10/10), npm run lint, tsc --noEmit. Build Vite OOM no ambiente de CI local (limitação de memória); validar `npm run build` em máquina local.

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

**Saída da fase:** uma cena Phaser executando no navegador e pipeline local de validação funcionando. ✅ (build de produção: validar localmente — OOM no sandbox)

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

**Saída da fase:** mapa carregado, com colisões e navegação verificáveis.

### Fase 3 em diante

(inalterado — ver histórico do arquivo para o restante do backlog)
