# Arquitetura — Outbreak Zones

## Objetivos

1. Manter a **lógica de simulação** desacoplada da engine de renderização (Phaser).
2. Permitir testes unitários das regras de domínio sem precisar de canvas/DOM.
3. Facilitar futura portabilidade (ex.: versão Linux nativa) e evolução do MVP.

## Camadas

```text
src/
├── main.ts
├── game/                       # Apresentação e integração com Phaser
│   ├── audio/
│   ├── scenes/
│   └── ...                     # UI, input e renderers quando extraídos
├── simulation/                 # Regras de domínio, sem Phaser
│   ├── entities/
│   ├── systems/
│   │   ├── buildings/
│   │   └── navigation/
│   ├── world/
│   └── Simulation.ts
└── shared/                     # Contratos/utilitários realmente compartilhados
```

Os recursos estáticos ficam em `public/`; a organização detalhada está em [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md).

### Regras de dependência

- `simulation/` **não** importa nada de `game/`, do DOM ou de `phaser`.
- `game/` pode importar de `simulation/` e de Phaser; o inverso é proibido.
- `shared/` não depende de `game/` nem de `simulation/`.
- Entidades e sistemas de domínio recebem dependências explicitamente.
- A comunicação principal acontece via estado da simulação (leitura) e comandos/ordens emitidos pelo input (escrita).

## Loop de atualização

1. Phaser chama `update(time, delta)` nas cenas.
2. A cena de missão converte o `delta` (ms) em segundos e chama `simulation.update(dt)`.
3. A simulação usa **fixed timestep com acumulador** (ADR7).
4. Enquanto a simulação estiver **pausada**, a lógica de domínio não avança.
5. A renderização continua mesmo com a simulação pausada.

## Resolução lógica e escala

- Resolução lógica base: **1920 × 1080**.
- Escala: `Phaser.Scale.FIT` + centralização.
- Zoom de câmera independente da escala da tela.

## Decisões de design

| ID | Decisão | Motivo |
|---|---|---|
| ADR1 | Simulação separada da renderização | Testabilidade e portabilidade |
| ADR2 | Tempo real com pausa estratégica | RTS tático clássico |
| ADR3 | Top-down 2D pixel art | Clareza tática e produção viável |
| ADR4 | Três policiais controláveis | Escopo inicial legível |
| ADR5 | Pathfinding e colisões no domínio | Comportamento previsível e testável |
| ADR6 | Vite + TypeScript strict | DX e segurança de tipos |
| ADR7 | Fixed timestep (1/60) com acumulador | Estabilidade em FPS variável |
| ADR8 | Residência como abrigo inacessível (obsoleta) | Substituída pela ADR9 |
| ADR9 | Edifícios e acessos interativos | Interior/exterior e interação |
| ADR10 | Reparos e aprimoramentos | Recuperação e reforço com custos e limites |
| ADR11 | Posturas e ordens táticas | Comandos independentes da cena |

### ADR7 — Fixed timestep com acumulador

**Contexto:** taxas de FPS variam entre máquinas e ao longo do tempo. Um `dt` variável puro pode tornar combate, movimento e ondas inconsistentes.

**Decisão:** a `Simulation` acumula o tempo real e avança em passos fixos de `FIXED_DT = 1/60` s.

- `dt` inválido (`NaN`, `±Infinity`, negativo) é ignorado.
- O tempo real processado por frame é limitado (`MAX_FRAME_DT = 0.25` s).
- O número de passos por frame é limitado (`MAX_STEPS_PER_UPDATE = 12`) para evitar *spiral of death*.
- O residual do acumulador é descartado se o limite de passos for atingido.

**Alternativa considerada:** timestep variável com clamp simples. É mais simples, mas menos previsível para sistemas como combate, movimento e pathfinding.

**Consequências:** comportamento mais estável entre taxas de 30–144 FPS, com pequena complexidade adicional na camada de domínio.

### ADR8 — Residência como abrigo inacessível (obsoleta)

**Status:** decisão substituída pela ADR9; não representa o design atual. Edifícios deixaram de ser zonas universalmente seguras e passaram a ter acessos e estados próprios.

### ADR9 — Edifícios interativos e acessos condicionais

**Contexto:** o tutorial inicial exige resgatar dois civis de uma casa. Casas e outros edifícios não são zonas universalmente seguras nem obstáculos estáticos.

**Decisão:** paredes são obstáculos sólidos; portas, janelas e garagens são componentes independentes com estado próprio. NPCs podem entrar e sair por acessos válidos conforme tipo, estado e regras de interação. Infectados patrulham, perseguem alvos, investigam estímulos e podem atacar edifícios/acessos.

**Estados iniciais:** cada componente recebe estado por sorteio ponderado, com probabilidades configuráveis por cenário e tipo de edifício. O sorteio usa seed persistente por mapa/partida; não é refeito durante a simulação. Isso permite variação entre edifícios e reprodução determinística em testes.

**Consequências:** o pathfinding deve suportar transições interior/exterior e custos/restrições específicos por entidade. O modelo de edifício separa geometria estrutural de portas, janelas e garagens.

### ADR10 — Reparos e aprimoramentos de estruturas

**Contexto:** componentes podem sofrer dano e o jogador precisa ter opções para recuperar ou preparar edifícios.

**Decisão:** portas, janelas, garagens e, se aplicável, partes estruturais podem ser reparadas. Componentes elegíveis também podem receber aprimoramentos por níveis, como reforço, barricada ou fechadura melhorada. Reparos restauram condição/durabilidade; aprimoramentos alteram propriedades de forma persistente durante a missão.

**Regras:** ações exigem recursos/materiais e tempo de execução, têm requisitos e limites por componente e podem ser interrompidas. O custo e o efeito devem ser explícitos na interface. Não permitir reparo ou aprimoramento ilimitado/gratuito.

**Decisões ainda abertas:** inventário e fontes de materiais, custos, duração, unidades habilitadas para construir/reparar, níveis máximos, quais componentes podem ser aprimorados e se infectados podem destruir totalmente um acesso.

### ADR11 — Posturas e ordens táticas básicas

**Contexto:** o jogador precisa controlar o comportamento de cada policial sem acoplar as ordens à cena Phaser.

**Decisão:** `PoliceOfficer` mantém uma postura de combate (`engage` ou `hold_fire`) e expõe uma ordem de manter posição que cancela a rota ativa. `Simulation` fornece comandos por ID de unidade. A cena apenas traduz atalhos de teclado para esses comandos: X mantém posição, H segura fogo e G retorna ao engajamento automático. Uma prioridade manual de alvo pode autorizar disparos mesmo em `hold_fire`.

**Consequências:** as regras permanecem testáveis no domínio; comandos podem ser aplicados a unidades selecionadas em grupo. Os atalhos são provisórios e precisam de validação no navegador.

## Áudio

- `AudioManager` pertence à camada `game/`; a simulação não reproduz áudio.
- A trilha ambiente toca em loop.
- Efeitos escolhem uma das variantes disponíveis.
- Áudio é opcional: falhas de carregamento de áudio não impedem iniciar a missão.
- O estado de mute é controlado pelo sistema de áudio da cena.
