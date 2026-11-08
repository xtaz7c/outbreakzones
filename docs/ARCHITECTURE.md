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
│   ├── entities/           # Policiais, Infectados, Civis, etc.
│   ├── systems/            # Movimento, combate, ondas, resgate, pathfinding
│   └── world/              # Mapa, colisões, edifícios e acessos
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
| ADR8 | Residência como abrigo inacessível (obsoleta) | Substituída pela ADR9 |\n| ADR9 | Casa interativa e acessos condicionais       | Tutorial de resgate; passagem depende do estado do acesso e do tipo de NPC |

### ADR7 — Fixed timestep com acumulador

**Contexto:** taxas de FPS variam entre máquinas e ao longo do tempo. Um `dt` variável puro pode tornar combate, movimento e ondas inconsistentes.

**Decisão:** a `Simulation` acumula o tempo real e avança em passos fixos de `FIXED_DT = 1/60` s.

- `dt` inválido (`NaN`, `±Infinity`, negativo) é ignorado.
- O tempo real processado por frame é limitado (`MAX_FRAME_DT = 0.25` s).
- O número de passos por frame é limitado (`MAX_STEPS_PER_UPDATE = 12`) para evitar spiral of death.
- Residual do acumulador é descartado se o limite de passos for atingido.

**Alternativa considerada:** variável + clamp simples. Mais simples, porém menos previsível para sistemas futuros (combate, pathfinding).

**Consequências:** comportamento de simulação mais estável entre 30–144 FPS; ligeiramente mais código na camada de domínio (aceitável).

### ADR8 — Residência como abrigo inacessível (obsoleta)

**Status:** decisão substituída pela ADR9; não representa mais o design atual.

### ADR9 — Edifícios interativos e acessos condicionais

**Contexto:** o tutorial inicial exige resgatar dois civis de uma casa. Casas e outros edifícios não são zonas universalmente seguras nem obstáculos estáticos.

**Decisão:** paredes são obstáculos sólidos; portas, janelas e garagens são componentes independentes com estado próprio. NPCs podem entrar/sair por acessos válidos conforme tipo, estado e regras de interação. Infectados vagam, perseguem alvos e podem investigar estímulos e atacar edifícios/acessos.

**Estados iniciais:** cada componente recebe estado por sorteio ponderado, com probabilidades configuráveis por cenário e tipo de edifício. O sorteio usa seed persistente por mapa/partida; não é refeito durante a simulação. Isso permite variação entre edifícios e reprodução determinística em testes.

**Consequências:** o pathfinding deve suportar transições interior/exterior e custos/restrições específicos por entidade. O modelo de edifício precisa separar geometria estrutural de portas, janelas e garagens.

### ADR10 — Reparos e aprimoramentos de estruturas

**Contexto:** componentes podem sofrer dano e o jogador precisa ter opções para recuperar ou preparar edifícios.

**Decisão:** portas, janelas, garagens e, se aplicável, partes estruturais podem ser reparadas. Componentes elegíveis também podem receber aprimoramentos por níveis, como reforço, barricada ou fechadura melhorada. Reparos restauram condição/durabilidade; aprimoramentos alteram propriedades de forma persistente durante a missão.

**Regras:** ações exigem recursos/materiais e tempo de execução, têm requisitos e limites por componente e podem ser interrompidas. O custo e o efeito devem ser explícitos na interface. Não permitir reparo ou aprimoramento ilimitado/gratuito.

**Decisões ainda abertas:** inventário e fontes de materiais, custos, duração, unidades habilitadas para construir/reparar, níveis máximos, quais componentes podem ser aprimorados e se infectados podem destruir totalmente um acesso.

## Próximos passos de arquitetura

- Definir interface clara `SimulationState` / `SimulationCommands`.
- Extrair `WaveSystem`, `CombatSystem` e `Pathfinding` como módulos independentes.
- Introduzir testes de integração leves para o fluxo de missão.
