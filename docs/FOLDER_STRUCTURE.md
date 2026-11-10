# Estrutura de pastas

A organização separa apresentação, domínio/simulação, mundo, recursos estáticos e documentação. Diretórios são criados conforme há módulos reais para ocupá-los; não manter pastas vazias apenas para antecipar arquitetura.

## Recursos estáticos

```text
public/
├── audio/
│   ├── music/                 # Trilhas e ambientes em loop
│   └── effects/
│       ├── weapons/           # Disparos e efeitos de armas
│       └── infected/          # Vocalizações dos infectados
├── images/                    # Ícones e imagens
├── maps/                      # Mapas exportados do Tiled
└── tiles/                     # Tilesets
```

Áudios usam nomes descritivos, sem timestamps ou nomes temporários; variantes usam sufixos numéricos de dois dígitos.

## Código

```text
src/
├── main.ts
├── game/                      # Integração Phaser e apresentação
│   ├── audio/
│   ├── scenes/
│   ├── config.ts
│   └── ...                    # UI, input e renderers quando extraídos
└── simulation/                # Regras de domínio sem Phaser/DOM
    ├── entities/              # Civilian, Infected, PoliceOfficer
    ├── systems/
    │   ├── buildings/         # Acessos, manutenção e estruturas implantáveis
    │   ├── navigation/        # Pathfinding e navegação reutilizável
    │   ├── CombatSystem
    │   └── WaveSystem
    ├── world/                 # GridMap, WorldConfig, loaders e pontos de entrada
    └── Simulation.ts         # Fachada/orquestrador do domínio
```

## Testes

Os testes unitários ficam junto ao módulo que validam, com o sufixo `.test.ts`:
- entidades em `simulation/entities/`;
- sistemas em `simulation/systems/`, incluindo seus subdomínios;
- componentes de mundo em `simulation/world/`.

Testes de integração da orquestração permanecem junto a `Simulation.ts`. Fixtures compartilhadas só devem ser extraídas quando houver reutilização real.

## Regras de dependência

1. `simulation/` não importa Phaser, DOM, `game/` ou APIs de interface.
2. `game/` pode depender de `simulation/` e Phaser; nunca o inverso.
3. `entities/` não deve depender da cena; sistemas recebem dependências explicitamente.
4. `world/` mantém estruturas espaciais e dados de mapa; regras operacionais reutilizáveis ficam em `systems/`.
5. Cenas orquestram sistemas e renderização; regras de domínio ficam fora delas.
6. Evitar pastas genéricas como `misc`, `helpers` ou `utils` sem responsabilidade definida.

## Convenções

- PascalCase para classes e cenas; camelCase para funções e variáveis.
- Sufixos explícitos: `System`, `Manager`, `Renderer`, `Scene` e `Config`.
- Imports devem apontar para o módulo proprietário; não manter arquivos de reexportação apenas para compatibilidade depois da migração.
- Dados de cenário não devem ser misturados com lógica de simulação.
