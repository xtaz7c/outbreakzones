# Art Direction — Outbreak Zones

## Objetivo

Estabelecer uma linguagem visual original para um RTS tático de sobrevivência top-down. A prioridade é legibilidade durante decisões rápidas: terreno, unidades, ameaças, acessos e estados devem ser reconhecidos sem depender de texto.

## Base técnica

- Projeção: top-down 2D, sem perspectiva isométrica.
- Resolução lógica: 1920 × 1080.
- Unidade de mundo: tile de 32 × 32 px.
- Pixel art: formas alinhadas à grade, bordas duras e sem antialiasing nos tiles.
- Escala: nearest-neighbor para pixel art; evitar suavização ao ampliar.
- Composição: massas de cor simples, detalhes de 1–3 px e contraste local moderado.
- Profundidade: terreno no plano base; estruturas e vegetação acima do chão; unidades e efeitos em camadas superiores.

## Paleta funcional

| Uso | Cor | Hex |
|---|---|---|
| Fundo e sombra profunda | Carvão | #111415 |
| Painéis | Grafite | #1b2021 |
| Texto primário | Papel envelhecido | #e8e3d8 |
| Metal e concreto claro | Cinza mineral | #b9b9b0 |
| Vegetação principal | Verde oliva | #46583a |
| Vegetação iluminada | Verde seco | #82905b |
| Asfalto | Ardósia | #414749 |
| Terra | Ocre escuro | #796346 |
| Alerta / perigo | Vermelho sinalizador | #c33a36 |
| Unidade policial | Azul operacional | #3f83d5 |
| Civil | Amarelo de identificação | #e7c66a |
| Infectado | Vermelho infectado | #b83b3b |

## Regras de leitura

1. Identidade por silhueta primeiro. Policiais, civis e infectados não podem depender apenas da cor para serem distinguidos.
2. Cor semântica consistente. Azul identifica policiais; amarelo identifica civis; vermelho identifica infectados/ameaças; verde identifica áreas seguras ou extração.
3. Estados não devem apagar a identidade. Ferido, incapacitado, em pânico, selecionado ou extraído usam overlays, contorno, postura ou opacidade; a forma-base continua reconhecível.
4. HUD separado do mundo. Painéis e textos usam carvão/papel/metal; indicadores de estado usam as cores semânticas.
5. Efeitos curtos e localizados. Disparos, impactos e dano comunicam direção e resultado sem cobrir unidades ou terreno.
6. Terreno com baixo contraste. Texturas de chão devem ser discretas para que unidades e acessos sejam o foco.
7. Sem detalhes subpixel. Padrões devem continuar nítidos no zoom mínimo e não criar cintilação excessiva.

## Tileset

O atlas em public/tiles/mission-tiles.svg usa células de 32 × 32 px. Os IDs existentes (1–8) mantêm significado e posição para preservar mapas existentes. Os IDs 9–16 acrescentam variações compatíveis para grama, asfalto e entulho. O mapa inicial usa essas variações em posições determinísticas para reduzir repetição sem alterar colisões, geometria ou navegação.

## Diretrizes para próximos assets

- Criar sprites em atlas com células e pivôs documentados; evitar desenhar unidades com muitas primitivas na cena.
- Manter proporções, contorno e direção de luz consistentes entre facções.
- Preferir animações curtas e legíveis (idle, walk, attack, hit, down/death), com timing estável e sem interpolação borrada.
- Efeitos visuais devem responder a eventos existentes na apresentação; não introduzir regras de gameplay no renderer.
- Assets devem ser originais ou licenciados para uso no projeto, com fonte/licença registrada quando externos.


## Sprites de personagens

- Atlas em `public/sprites/characters.svg`, com células de 32 × 32 px e nearest-neighbor.
- Linhas reservadas por facção: policial, civil e infectado; seis poses por personagem: idle, dois passos de caminhada, ataque, impacto e incapacitado/morto.
- A cena apenas seleciona quadros/animações a partir do estado já existente na simulação. O atlas e o renderer não alteram movimento, dano, seleção ou navegação.
- Silhuetas e equipamentos distinguem as facções mesmo em escala reduzida; cores semânticas reforçam a leitura, sem serem o único identificador.
