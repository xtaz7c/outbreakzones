# Estrutura de pastas

Este documento define a organização atual dos recursos e a direção de crescimento do projeto. A regra central é separar domínio/simulação, apresentação, recursos estáticos e documentação.

## Recursos estáticos

```text
public/
├── audio/
│   ├── music/                 # Trilhas e ambientes em loop
│   └── effects/
│       ├── weapons/           # Disparos, recarga e armas
│       └── infected/          # Vocalizações e sons dos infectados
├── images/                    # Ícones e imagens de interface
├── maps/                      # Mapas exportados do Tiled
└── tiles/                     # Tilesets
```

Os arquivos de áudio usam nomes sem timestamps, espaços ou nomes temporários de exportação. As variantes são numeradas com dois dígitos.

## Organização do código (estrutura-alvo)

```text
src/
├── main.ts
├── game/                      # Integração Phaser e apresentação
│   ├── audio/                 # AudioManager e adaptadores
│   ├── scenes/                # BootScene, MissionScene e futuras cenas
│   ├── ui/                    # HUD, minimapa, menus e componentes
│   ├── input/                 # Teclado, mouse e comandos
│   ├── renderers/             # Renderização de entidades e mundo
│   └── config.ts
├── simulation/                # Regras do jogo sem Phaser/DOM
│   ├── entities/              # Civis, infectados, policiais
│   ├── systems/               # Combate, ondas, navegação, resgate
│   ├── world/                 # Grid, edifícios e estruturas
│   ├── missions/              # Objetivos e progressão
│   └── contracts/             # Interfaces e tipos de domínio
├── shared/                    # Tipos/utilitários realmente compartilhados
└── test/                      # Fixtures e helpers de teste compartilhados
```

Essa árvore de código é uma direção de refatoração, não uma afirmação de que todos esses diretórios já existem. Mover módulos em massa exige atualizar imports e rodar a suíte completa; fazer isso em etapas pequenas.

## Regras de dependência

1. simulation não importa Phaser, DOM, game ou APIs de interface.
2. game pode depender de simulation e Phaser; nunca o inverso.
3. shared não depende de game nem de simulation.
4. Sistemas reutilizáveis têm responsabilidade única e testes próximos ao módulo.
5. Cenas orquestram sistemas e renderização; regras de domínio ficam fora delas.
6. Evitar pastas genéricas como misc, helpers ou utils sem responsabilidade definida.

## Convenções

- PascalCase para classes e cenas; camelCase para funções e variáveis.
- Sufixos explícitos: System, Manager, Renderer, Scene e Config.
- Testes unitários ficam junto ao módulo como *.test.ts.
- Fixtures comuns ficam em src/test/.
- Dados de cenário não devem ser misturados com lógica de simulação.