# Arquitetura — Outbreak Zones

## Objetivos

1. Manter a lógica de simulação desacoplada da engine de renderização (Phaser).
2. Permitir testes unitários das regras de domínio sem canvas/DOM.
3. Facilitar evolução do MVP e futura portabilidade.

## Camadas

- simulation/: domínio, entidades, sistemas e mundo; não importa Phaser nem APIs de interface.
- game/: apresentação Phaser, cenas, input, renderers, HUD e áudio.
- shared/: contratos e utilitários sem dependências das camadas.
- public/: recursos estáticos servidos diretamente pelo Vite.
- docs/: arquitetura, decisões e guias de contribuição.

A árvore detalhada, convenções e regras de organização estão em [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md).

## Regras de dependência

- simulation/ não importa nada de game/ nem de phaser.
- game/ pode importar de simulation/ e de Phaser.
- shared/ não depende de game/ nem de simulation/.
- A comunicação principal acontece via estado da simulação (leitura) e comandos/ordens emitidos pelo input (escrita).

## Loop de atualização

1. Phaser chama update(time, delta) nas cenas.
2. A cena de missão converte delta (ms) em segundos e chama simulation.update(dt).
3. A simulação usa fixed timestep com acumulador (ADR7).
4. Enquanto pausada, a simulação não avança.
5. A renderização continua mesmo com a simulação pausada.

## Resolução lógica e escala

- Resolução lógica base: 1920 × 1080.
- Escala: Phaser.Scale.FIT + centralização.
- Zoom da câmera independente da escala da tela.

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
| ADR10 | Reparos e aprimoramentos | Recuperação e reforço com custos |
| ADR11 | Posturas e ordens táticas | Comandos independentes da cena |

## Áudio

- AudioManager pertence à camada game; a simulação não reproduz áudio.
- A trilha ambiente toca em loop.
- Efeitos escolhem uma das variantes disponíveis.
- Áudio é opcional: falhas de carregamento não impedem iniciar a missão.
- O estado de mute é controlado pelo sistema de áudio da cena.