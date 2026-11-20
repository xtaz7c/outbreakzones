# Ciclo dia/noite

## Comportamento atual

- O relógio inicia às **08:00**, preservando o horário já usado pela campanha.
- Um segundo real avança um minuto de jogo; um dia completo dura 24 minutos reais.
- O relógio pausa junto com a missão e para ao concluir ou perder a operação.
- O ciclo visual funciona no Tutorial e na Campanha. O relógio continua visível apenas na Campanha.

## Fases

| Horário | Fase |
|---|---|
| 00:00–04:59 | Noite |
| 05:00–06:59 | Amanhecer |
| 07:00–17:59 | Dia |
| 18:00–19:59 | Entardecer |
| 20:00–23:59 | Noite |

As cores do cenário e o overlay ambiente são interpolados continuamente durante amanhecer e entardecer. As camadas do mapa usam o pipeline Light2D do Phaser; o overlay também usa esse pipeline para permitir que as luzes locais iluminem a área ao redor.

## Luzes locais nos mapas

A cena reconhece uma object layer Tiled chamada `Lights`. Cada objeto nessa camada cria uma luz local; as coordenadas do objeto são usadas como centro (incluindo metade de largura/altura, quando houver). Os mapas `mission-01.tmj` e `sector-04.tmj` já incluem marcadores iniciais de postes. Novos pontos podem ser adicionados diretamente no Tiled.

## Escopo de gameplay

Os multiplicadores por fase estão definidos como dados de domínio, mas ainda não alteram velocidade dos infectados, alcance de visão ou spawn. Nesta entrega, o ciclo afeta o relógio, a tonalidade do cenário e a iluminação local; o balanceamento de gameplay permanece inalterado.
