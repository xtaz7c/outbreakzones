# Arquitetura — Testgame

## Objetivos

1. Manter a **lógica de simulação** desacoplada da engine de renderização (Phaser).
2. Permitir testes unitários das regras de domínio sem precisar de canvas/DOM.
3. Facilitar futura portabilidade (ex.: versão Linux nativa) e evolução do MVP.

## Camadas

```
src/
├── main.ts                 # Bootstrap do Vite + Phaser.Game
├── game/                   # Camada de apresentação (Phaser)
│   ├── config.ts           # Configuração do Phaser.Game
│   ├── scenes/
│   │   ├── BootScene.ts    # Carregamento de assets + transição
│   │   └── MissionScene.ts # Cena principal da missão
│   └── ...
├── simulation/             # Regras de domínio (sem Phaser)
│   ├── core/               # Tipos, constantes, utilitários
│   ├── entities/           # Policiais, Infectados, etc.
│   ├── systems/            # Movimento, combate, ondas, pathfinding
│   └── world/              # Mapa, colisões e limites do abrigo
└── shared/                 # Tipos e utilitários compartilhados
```

### Regras de dependência

- `simulation/` **não** importa nada de `game/` nem de `phaser`.
- `game/` pode importar de `simulation/` e de Phaser.
- A comunicação principal acontece via:
  - estado da simulação (leitura);
  - comandos/ordens emitidos pelo input (escrita).

## Loop de atualização

1. Phaser chama `update(time, delta)` nas cenas.
2. A cena de missão converte o `delta` (ms) em segundos e chama `simulation.update(dt)`.
3. A simulação usa **fixed timestep com acumulador** (ver ADR7).
4. Enquanto a simulação estiver **pausada**, `update` retorna imediatamente.
5. A renderização sempre ocorre (sprites, HUD, câmera), mesmo com a simulação pausada.

## Resolução lógica e escala

- Resolução lógica base: **1280 × 720** (ajustável).
- Escala: `Phaser.Scale.FIT` + centralização.
- Zoom de câmera independente da escala da tela.

## Decisões de design relevantes (ADR resumidas)

| ID   | Decisão                                      | Motivo                                      |
|------|-----------------------------------------------|---------------------------------------------|
| ADR1 | Simulação separada da renderização            | Testabilidade e portabilidade               |
| ADR2 | Tempo real com pausa estratégica              | Estilo RTS tático clássico                  |
| ADR3 | Top-down 2D pixel art                         | Clareza tática + produção viável para MVP   |
| ADR4 | Três policiais controláveis                   | Escopo fechado e legível                    |
| ADR5 | Pathfinding + colisões no domínio             | Comportamento previsível e testável         |
| ADR6 | Vite + TypeScript strict                      | DX moderna e segurança de tipos             |
| ADR7 | Fixed timestep (1/60) com acumulador          | Estabilidade em FPS variável; ver abaixo    |\n| ADR8 | Residência como abrigo inacessível            | Evita invasão; paredes, portas e janelas são bloqueios sólidos |

### ADR8 — Residência como abrigo inacessível\n\n**Contexto:** a residência não é um objetivo atacável nem uma estrutura que o jogador precise defender.\n\n**Decisão:** o interior da casa fica fora da área navegável da missão. Policiais e infectados usam o mesmo GridMap; paredes, portas e janelas permanecem bloqueios sólidos. Infectados não atacam estruturas nem tentam entrar no abrigo.\n\n**Comportamento dos infectados:** sem policiais detectados, escolhem destinos aleatórios caminháveis e vagam pelo ambiente. Ao detectar um policial ativo, interrompem a ronda e perseguem/atacam. Quando não há mais alvo válido, retomam a ronda aleatória.\n\n**Condição de derrota:** a missão termina em derrota somente quando os três policiais são incapacitados; a residência não possui HP, integridade ou estado de invasão.\n\n### ADR7 — Fixed timestep com acumulador

**Contexto:** taxas de FPS variam entre máquinas e ao longo do tempo. Um `dt` variável puro pode tornar combate, movimento e ondas inconsistentes.

**Decisão:** a `Simulation` acumula o tempo real e avança em passos fixos de `FIXED_DT = 1/60` s.

- `dt` inválido (`NaN`, `±Infinity`, negativo) é ignorado.
- O tempo real processado por frame é limitado (`MAX_FRAME_DT = 0.25` s).
- O número de passos por frame é limitado (`MAX_STEPS_PER_UPDATE = 12`) para evitar spiral of death.
- Residual do acumulador é descartado se o limite de passos for atingido.

**Alternativa considerada:** variável + clamp simples. Mais simples, porém menos previsível para sistemas futuros (combate, pathfinding).

**Consequências:** comportamento de simulação mais estável entre 30–144 FPS; ligeiramente mais código na camada de domínio (aceitável).

## Próximos passos de arquitetura

- Definir interface clara `SimulationState` / `SimulationCommands`.
- Extrair `WaveSystem`, `CombatSystem` e `Pathfinding` como módulos independentes.
- Introduzir testes de integração leves para o fluxo de missão.
