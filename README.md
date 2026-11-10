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

## Áudio

O projeto inclui 12 arquivos WAV em `public/audio/`: quatro variações de disparo, quatro faixas de suspense e quatro vocalizações de infectados. `BootScene` carrega as quatro variações de efeitos sonoros e seleciona apenas uma faixa ambiente aleatória por missão, evitando transferir as outras três faixas completas sem uso. `AudioManager` reproduz a faixa selecionada em loop e escolhe variantes aleatórias para os efeitos. O áudio é opcional: falhas de carregamento não bloqueiam a missão. Pressione **M** durante a missão para silenciar ou reativar o áudio.

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
| Silenciar / reativar áudio | M |
| Manter posição das unidades selecionadas | X |
| Segurar fogo das unidades selecionadas | H |
| Retomar engajamento automático | G |
| Interagir com acesso próximo | E (provisório) |
| Danificar acesso próximo | B (debug) |
| Gerar infectado | I (debug) |
| Atrair infectados para a entrada frontal | N (debug) |

X, H e G são comandos táticos básicos em validação. E, B, I e N são atalhos provisórios de desenvolvimento; N emite um estímulo temporário de ruído no acesso frontal (raio de 1000 px, duração de 10 s); a IA geral de percepção e ronda ainda está em desenvolvimento.

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


## Campanha (em desenvolvimento)

A Missão 0 — **O Resgate** funciona como tutorial e exige extrair os dois civis e eliminar todas as ondas. Ao vencer, o jogador pode voltar à tela inicial ou iniciar a Missão 1 — **Refúgio**, uma missão de campanha com quatro ondas e objetivo de defender o setor. O desbloqueio da campanha é salvo localmente. A Missão 1 ainda reutiliza o mapa atual; cenário próprio, persistência completa e conteúdo de campanha seguem em desenvolvimento.


## Configurações de interface

A escala do HUD é independente do zoom da câmera e pode ser ajustada no menu de pausa entre 80% e 120%. A preferência fica salva localmente no navegador.


## Estruturas implantáveis

A barra inferior permite posicionar quatro estruturas: abrigo (capacidade para duas pessoas), tenda de recursos (gera sucata), posto sniper (atira automaticamente em infectados visíveis) e barricada (bloqueia infectados até ser destruída). Cada estrutura tem custo em sucata/peças e vida própria. Clique em uma estrutura para selecioná-la e pressione `Delete` para desmontar e recuperar metade dos materiais. O estado das estruturas e recursos fica salvo localmente por missão.
