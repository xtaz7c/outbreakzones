# Ciclo dia / noite

## Objetivo

Dar ritmo tático às missões: o relógio avança, a fase do dia muda, e isso afeta **leitura visual das texturas** e, no futuro, modificadores de gameplay.

A UI de referência já mostra `DIA 1 · 14:30` — este módulo torna esse relógio autoritativo.

## Como afeta texturas

**Não** geramos atlases separados por horário. A arte (SVG/PNG) permanece única.

| Fase | Efeito nas texturas | Luzes locais (postes) |
|------|---------------------|------------------------|
| **day** | sem tint | apagadas |
| **dawn** | leve warm (R↑ B↓) + overlay suave | fracas |
| **dusk** | warm forte (laranja/vermelho) | médias |
| **night** | cool dark (B↑, RGB↓) + overlay azul-noite | fortes (lamp glow) |

Implementação em `src/game/lighting/DayNightVisuals.ts`:

1. `setTint` nas **tile layers** e sprites de mundo (não no HUD)
2. Overlay semitransparente acima do mapa
3. Multiplicador `localLightMul` para sprites de poste/lâmpada do atlas de ambiente

### Pipeline com o pacote de texturas

```
SVG fonte (mission-tiles, environment-props, characters)
        │
        ▼
  runtime PNG opcional (rasterize)
        │
        ▼
  Phaser load → tilemap / sprites
        │
        ▼
  DayNightVisuals.apply(phase)  ← tint + overlay + lights
```

Quando `feat/textures-64x64` entrar, o mesmo tint aplica em 64×64 sem mudança de API.

## Relógio

- `DayNightSystem` em `src/simulation/systems/DayNightSystem.ts`
- Default: começa **14:30 do dia 1** (como o mock da UI)
- `minutesPerRealSecond: 1` → 1 minuto de jogo por segundo real (ajustável por missão)

## Gameplay (hooks)

`gameplayModifiersFor(phase)` expõe multiplicadores:

- `infectedSpeedMul`
- `officerVisionMul` (fog / visão — futuro)
- `ambientThreatMul`

Ainda **não** estão ligados ao `WaveSystem` / combate nesta PR — só a base e o visual.

## Mapas novos

| Arquivo | Tema |
|---------|------|
| `public/maps/mission-02.tmj` | Subúrbio residencial |
| `public/maps/mission-03.tmj` | Zona industrial |
| `public/maps/mission-04.tmj` | Parque ribeirinho |

Mesmo tileset `mission-tiles`, grade 80×45, layers Ground / Terrain / Structures + Collision / Entrances / Obstacles.

## Integração pendente em MissionScene

1. Instanciar `DayNightSystem` no `create`
2. `update` → `dayNight.update(dt)` e refrescar label HUD
3. Em mudança de fase → `applyWorldTint(phase, [layers..., unit sprites])`
4. Postes do atlas `environment-props` com alpha/glow ∝ `localLightMul`

## Testes

Ver `DayNightSystem.test.ts` (fase, wrap de dia, label HUD).
