# Arquitetura — Outbreak Zones

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
| ADR7 | Fixed timestep (1/60) com acumulador          | Estabilidade em FPS variável; ver abaixo    |

### ADR7 — Fixed timestep com acumulador

**Contexto:** taxas de FPS variam entre máquinas e ao longo do tempo. Um `dt` variável puro pode tornar combate, movimento e ondas inconsistentes.

**Decisão:** a `Simulation` acumula o tempo real e avança em passos fixos de `FIXED_DT = 1/60` s.

- `dt` inválido (`NaN`, `±Infinity`, negativo) é ignorado.
- O tempo real processado por frame é limitado (`MAX_FRAME_DT = 0.25` s).
- O número de passos por frame é limitado (`MAX_STEPS_PER_UPDATE = 12`) para evitar spiral of death.
- Residual do acumulador é descartado se o limite de passos for atingido.

**Alternativa considerada:** variável + clamp simples. Mais simples, porém menos previsível para sistemas futuros (combate, pathfinding).

**Consequências:** comportamento de simulação mais estável entre 30–144 FPS; ligeiramente mais código na camada de domínio (aceitável).


### ADR8 — Edifícios compostos por acessos independentes

**Contexto:** uma residência não pode ser tratada como um bloco inviolável. Policiais, civis e infectados precisam usar acessos válidos, enquanto paredes e obstáculos permanecem sólidos.

**Decisão:** paredes/obstáculos pertencem à grade estática; portas, janelas e garagens são componentes independentes controlados por `BuildingSystem`. Cada acesso possui estado e integridade próprios. A navegação gera uma grade específica por tipo de unidade: civis não atravessam janelas; policiais e infectados podem atravessar janelas abertas ou destruídas.

**Consequências:** abrir, fechar ou destruir um acesso altera as rotas possíveis sem reconstruir o mapa. O sistema de simulação continua independente do Phaser.

### ADR9 — Geração determinística dos acessos

**Contexto:** estados iniciais aleatórios não podem mudar entre testes ou recargas da mesma missão.

**Decisão:** cada missão fornece uma seed inteira ao `BuildingSystem`. Um gerador pseudoaleatório determinístico escolhe independentemente o estado de cada acesso a partir de pesos configuráveis por tipo de acesso. A seed e a ordem das definições reproduzem a mesma configuração inicial.

**Consequências:** cenários podem ajustar as probabilidades sem alterar regras de navegação; testes podem reproduzir casos específicos.

## Próximos passos de arquitetura

- Definir interface clara `SimulationState` / `SimulationCommands`.
- Extrair `WaveSystem`, `CombatSystem` e `Pathfinding` como módulos independentes.
- Introduzir testes de integração leves para o fluxo de missão.
