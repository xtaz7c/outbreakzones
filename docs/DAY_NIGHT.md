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

As cores do cenário, o overlay ambiente e a intensidade das luzes são interpolados continuamente durante amanhecer e entardecer. O overlay é um objeto de mundo abaixo do HUD e não depende de PostFX/WebGL.

## Luzes locais nos mapas

A cena reconhece uma object layer Tiled chamada `Lights`. Cada objeto nessa camada cria uma luz local; as coordenadas do objeto são usadas como centro (incluindo metade de largura/altura, quando houver).

**Limitação do mapa atual:** `mission-01.tmj` ainda não possui a camada `Lights`. Portanto, o ciclo visual e o relógio funcionam, mas nenhum PointLight de poste é instanciado até que o mapa forneça esses marcadores.

## Escopo de gameplay

Os multiplicadores por fase estão definidos como dados de domínio, mas ainda não alteram velocidade dos infectados, alcance de visão ou spawn. Essa integração fica separada da primeira entrega visual para evitar mudanças não validadas no balanceamento.
