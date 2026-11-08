# Testgame

Jogo independente de estratégia tática e sobrevivência, inspirado em jogos de navegador da época do Flash (especialmente *Class 3 Outbreak*), feito com **TypeScript + Phaser 3**.

> **MVP:** uma missão de defesa de uma pequena residência, jogável no navegador, na qual o jogador comanda três policiais contra ondas de infectados.

## Status

Em desenvolvimento ativo. O backlog oficial está em [`TASKLIST.md`](./TASKLIST.md).

## Stack

| Camada              | Tecnologia          |
|---------------------|---------------------|
| Linguagem           | TypeScript          |
| Engine              | Phaser 3            |
| Build               | Vite                |
| Testes              | Vitest              |
| Lint / Formatação   | ESLint + Prettier   |
| Mapas (futuro)      | Tiled               |

## Requisitos

- Node.js 20+ (recomendado)
- npm 10+

## Como rodar

```bash
# Instalar dependências (use npm ci em CI / ambiente limpo)
npm install

# Servidor de desenvolvimento (hot reload)
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview

# Testes
npm test

# Lint
npm run lint

# Formatar
npm run format
```

Abra o endereço mostrado no terminal (geralmente `http://localhost:5173`).

## Controles (MVP)

| Ação                        | Controle                          |
|-----------------------------|-----------------------------------|
| Selecionar unidade          | Clique esquerdo                   |
| Seleção múltipla            | Arrastar caixa de seleção         |
| Mover unidades              | Clique direito                    |
| Pausar / Retomar            | Espaço                            |
| Câmera                      | WASD / setas + scroll (zoom)      |

## Arquitetura (resumo)

- **Simulação** (`src/simulation/`): regras de domínio puras (unidades, combate, ondas, pathfinding). Sem dependência de Phaser.
- **Render / Input** (`src/game/`): cenas Phaser, sprites, câmera, input e HUD.
- A simulação avança com **fixed timestep** (1/60 s) e pode ser pausada independentemente da renderização.

Documentação mais detalhada:

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md)
- [TASKLIST.md](./TASKLIST.md)

## Licença

A definir.
