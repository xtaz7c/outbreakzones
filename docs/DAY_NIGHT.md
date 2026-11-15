# Ciclo dia / noite

## Objetivo

Dar ritmo tático às missões: o relógio avança, a fase do dia muda, e isso afeta **leitura visual das texturas**, **luzes locais** e, no futuro, modificadores de gameplay.

A UI de referência já mostra `DIA 1 · 14:30` — este módulo torna esse relógio autoritativo.

## Como afeta texturas

**Não** geramos atlases separados por horário. A arte (SVG/PNG) permanece única.

| Fase | Tint / overlay | PointLights (postes) | PostFX ambient |
|------|----------------|----------------------|----------------|
| **day** | neutro | off | strength 0 |
| **dawn** | warm leve | ~35% | ~0.2 |
| **dusk** | warm forte | ~55% | ~0.35 |
| **night** | cool dark | 100% | ~0.7 |

### Pipeline

```
SVG fonte (mission-tiles, environment-props, characters)
        │
        ▼
  Phaser load → tilemap / sprites
        │
        ├─► applyWorldTint(phase)          // setTint nas layers de mundo
        ├─► NightLights.syncPhase(phase)   // PointLight intensity
        └─► NightAmbientPipeline (opc.)    // multiply fullscreen
```

HUD **nunca** entra em tint, PointLight nem PostFX de mundo.

## Shaders / iluminação (Phaser 3.87)

### PointLight — `NightLights.ts` (Fase A, default)

- Shader built-in, **sem** normal map
- Brilho additivo (não escurece o chão sozinho)
- Ideal para postes da referência UI
- `syncPhase(phase)` usa `PHASE_TINTS[phase].localLightMul`

```ts
const nightLights = new NightLights(this);
nightLights.addLamp({ x: 640, y: 360 });
nightLights.syncPhase(dayNight.getState().phase);
```

### PostFX ambient — `NightAmbientPipeline.ts` (Fase B, opcional)

- Fragment multiplica a cena por `uAmbient` com `uStrength`
- Complementa PointLights (chão mais escuro entre postes)
- Registrar uma vez no renderer WebGL; aplicar só na **câmera de mundo**

```ts
game.renderer.pipelines.addPostPipeline('NightAmbient', NightAmbientPipeline);
camera.setPostPipeline(NightAmbientPipeline);
```

### O que evitar no MVP

- `Light2D` sem normal maps (custo alto, resultado pobre)
- Packs externos de lighting só para este ciclo

## Relógio

- `DayNightSystem` — default **14:30 do dia 1**
- `minutesPerRealSecond: 1` (ajustável por missão)

## Gameplay (hooks)

`gameplayModifiersFor(phase)`:

- `infectedSpeedMul`
- `officerVisionMul`
- `ambientThreatMul`

Ainda não ligados ao `WaveSystem`.

## Mapas novos

| Arquivo | Tema |
|---------|------|
| mission-02 | Subúrbio |
| mission-03 | Industrial |
| mission-04 | Parque ribeirinho |

```bash
python3 scripts/generate-mission-maps.py
```

## Integração MissionScene (checklist)

1. `DayNightSystem` no `create` + label HUD `state.hudLabel`
2. `update` → `dayNight.update(dt)`; se `phase` mudou → `applyPhaseVisuals`
3. `NightLights` com postes do mapa (ou `gridLampPositions` temporário)
4. Opcional: registrar `NightAmbientPipeline` na câmera de mundo
5. HUD / minimap fora de pipelines de luz

## Testes

`DayNightSystem.test.ts` e `NightLights.test.ts`.
