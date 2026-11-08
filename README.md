# Outbreak Zones

Jogo independente de estratégia tática e sobrevivência, inspirado em jogos de navegador da época do Flash (especialmente *Class 3 Outbreak*), feito com **TypeScript + Phaser 3**.

> **MVP:** uma missão tática nos arredores de uma pequena residência que funciona como abrigo seguro e inacessível, jogável no navegador, na qual o jogador comanda três policiais contra ondas de infectados que vagam pelo ambiente e perseguem a equipe quando a detectam.

## Status

Em desenvolvimento ativo. O backlog oficial está em [`TASKLIST.md`](./TASKLIST.md).

## Stack

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript |
| Engine | Phaser 3 |
| Build | Vite |
| Testes | Vitest |
| Lint / Formatação | ESLint + Prettier |
| Mapas (futuro) | Tiled |

## Requisitos

- Node.js 20+ (recomendado)
- npm 10+

## Como instalar e executar

Clone o repositório, entre na pasta do projeto e instale as dependências a partir do lockfile versionado:

```bash
npm ci
npm run dev
```

Abra o endereço mostrado no terminal (geralmente `http://localhost:5173`). Sempre versione `package.json` e `package-lock.json` juntos; não edite manualmente as entradas de dependências do lockfile.

## Validação

Execute antes de abrir um Pull Request:

```bash
npm test
npm run lint
npm run build
```

## Controles planejados para o MVP

| Ação | Controle |
|---|---|
| Selecionar unidade | Clique esquerdo |
| Seleção múltipla | Arrastar caixa de seleção |
| Mover unidades | Clique direito |
| Pausar / Retomar | Espaço |
| Câmera | WASD / setas + scroll (zoom) |

Os controles acima descrevem o objetivo do MVP; consulte a tasklist para acompanhar o que já está implementado.

## Arquitetura (resumo)

- **Simulação** (`src/simulation/`): regras de domínio puras, sem dependência de Phaser.
- **Renderização e input** (`src/game/`): cenas Phaser, sprites, câmera, input e HUD.
- A simulação usa fixed timestep (1/60 s) com acumulador, conforme ADR7 em [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

Documentação:

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md)
- [TASKLIST.md](./TASKLIST.md)

## Licença

A definir.
