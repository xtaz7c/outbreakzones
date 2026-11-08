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
│   └── world/              # Mapa, colisões, portas/janelas
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
3. Enquanto a simulação estiver **pausada**, o `dt` efetivo é `0` (ou a chamada é ignorada).
4. A renderização sempre ocorre (sprites, HUD, câmera), mesmo com a simulação pausada.

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

## Próximos passos de arquitetura

- Definir interface clara `SimulationState` / `SimulationCommands`.
- Extrair `WaveSystem`, `CombatSystem` e `Pathfinding` como módulos independentes.
- Introduzir testes de integração leves para o fluxo de missão.
