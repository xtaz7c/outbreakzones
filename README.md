# Outbreak Zones

**Outbreak Zones** é um jogo independente de estratégia tática e sobrevivência, inspirado em jogos de navegador da época do Flash (especialmente *Class 3 Outbreak*), feito com **TypeScript + Phaser 3**.

> **MVP:** uma página inicial e um tutorial jogável no navegador. O jogador comanda três policiais para resgatar dois civis dentro de uma casa. Portas, janelas e garagens têm estados próprios, gerados probabilisticamente por edifício; a passagem depende do acesso e do tipo de NPC. Componentes também podem ser reparados e aprimorados. Infectados vagam, perseguem alvos e podem atacar a casa quando atraídos por estímulos.

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

## Controles atuais e comandos provisórios

| Ação | Controle |
|---|---|
| Selecionar unidade | Clique esquerdo |
| Seleção múltipla | Arrastar caixa de seleção |
| Mover unidades | Clique direito |
| Pausar / Retomar | Espaço |
| Câmera | WASD / setas + scroll (zoom) |
| Manter posição das unidades selecionadas | X |
| Segurar fogo das unidades selecionadas | H |
| Retomar engajamento automático | G |
| Interagir com acesso próximo | E (provisório) |
| Danificar acesso próximo | B (debug) |
| Gerar infectado | I (debug) |
| Atrair infectados para a entrada frontal | N (debug) |

X, H e G são comandos táticos básicos em validação. E, B, I e N são atalhos provisórios de desenvolvimento; N direciona infectados ao acesso frontal e ainda não representa um sistema geral de ruído.

## Arquitetura (resumo)

- **Simulação** (`src/simulation/`): regras de domínio puras, sem dependência de Phaser.
- **Renderização e input** (`src/game/`): cenas Phaser, sprites, câmera, input e HUD.
- A simulação usa fixed timestep (1/60 s) com acumulador, conforme ADR7 em [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).\n- O HUD fica fixo à viewport; a câmera movimenta apenas o mundo do jogo.\n- A casa é navegável por acessos interativos; consulte ADR9.

Documentação:

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md)
- [TASKLIST.md](./TASKLIST.md)

## Licença

A definir.
