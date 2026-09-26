# Visual upgrade verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 1832b5d..503b714 (merged as a7614e9)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Provas rodadas em `a7614e9` (HEAD de `main`): `npx vitest run tests/unit --reporter=verbose` saiu com 0 (15 arquivos, 41 testes passaram) e `npx playwright test tests/e2e/visual.spec.ts tests/e2e/render.spec.ts tests/e2e/drive.spec.ts --reporter=line` saiu com 0 (35 passaram em 4.9m). Cada teste citado abaixo aparece no output individualmente. Os 32 checks têm `file:line` localizado. O FAIL vem de um mutante sobrevivente, de C4 (a asserção codifica outra fórmula, e o código diverge do literal da door 3), de membros de cobertura sem prova e de linhas de `Test policy` não atendidas.

## Binding sources

Nenhuma fonte está marcada como binding em `plan.md` (profile `standard`, sem design). A etapa 1 não se aplica.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 18 arquivos respondem HTTP 200; `textures.loaded` lista os 6 sets | playwright batch exit 0, "texture sets are served and loaded" | `tests/e2e/visual.spec.ts:20` - `expect(res.status(), ...).toBe(200)` dentro do laço 6 sets x 3 kinds; `:25` - `expect([...loaded].sort()).toEqual([...SETS].sort())` | PASS |
| C2 | Concrete034 abortado: `console.warn` com o nome, `failed` contém o set, `ready` true | playwright batch exit 0, "missing texture set falls back to flat color" | `tests/e2e/visual.spec.ts:36` - `warnings.some((w) => w.includes('Concrete034'))` toBe true; `:38` - `expect(t.failed).toContain('Concrete034')`; `:39` - ready toBe(true) | PASS |
| C3 | road: 3 mapas, roughness no máximo 0.25, transparent, opacity 0.65, repeat 111 | playwright batch exit 0, "wet pbr road material" | `tests/e2e/visual.spec.ts:46-48` - hasMap/hasNormalMap/hasRoughnessMap toBe(true); `:49` - `toBeLessThanOrEqual(0.25)`; `:51` - `expect(road.opacity).toBeCloseTo(0.65, 6)`; `:52` - `expect(road.repeat).toBeCloseTo(111, 6)` (só `repeat.x`, exposto em `src/core/Game.ts:452`) | PASS |
| C4 | reflector presente em high com `size` = floor(innerWidth x 0.5), floor(innerHeight x 0.5); ausente em low | playwright batch exit 0, "reflector present only in high quality" | `tests/e2e/visual.spec.ts:65` - `expect(high.r.size).toEqual([Math.floor(high.w * high.pr * 0.5), Math.floor(high.h * high.pr * 0.5)])`, com `pr = min(devicePixelRatio, 2)`: a asserção codifica innerWidth x DPR x 0.5, não o valor do check; `src/world/CityScene.ts:47-51` usa o mesmo fator DPR, divergindo do literal da door 3 (`innerWidth/innerHeight x 0.5`) sempre que DPR for diferente de 1. O verde vem só de o Chromium headless rodar com DPR 1. Nenhuma nota no Handoff registra a mudança. `:68` - `expect(low.present).toBe(false)` está correto | FAIL |
| C5 | facadeType inteiro 0..3 com os 4 valores; 67 laneMarks espaçados de 6 m | vitest batch exit 0, "facade types and lane marks" | `tests/unit/cityGenerator.test.ts:72-74` - isInteger e faixa 0..3; `:78` - `expect([...types].sort()).toEqual([0, 1, 2, 3])`; `:81` - `laneMarks.length` toBe(67); `:83` - diferença `toBeCloseTo(6, 2)` | PASS |
| C6 | 4 malhas de fachada com aRepeat (itemSize 2) e aSeed (itemSize 1); instância 0 da malha 0 com aRepeat = largura/4, altura/4 | playwright batch exit 0, "four facade meshes with per-instance repeat" | `tests/e2e/visual.spec.ts:75` - `meshes.length` toBe(4); `:77-78` - itemSize 2 e 1; `:81` - `firstRepeat[0]).toBeCloseTo(first.firstBuilding.width / 4, 3)`; `:82` - altura / 4 | PASS |
| C7 | sidewalk com map e normalMap; laneMarkCount 938 | playwright batch exit 0, "sidewalk pbr and lane marks" | `tests/e2e/visual.spec.ts:92-93` - hasMap/hasNormalMap toBe(true); `:94` - `expect(info.lanes).toBe(938)` | PASS |
| C8 | draw calls no máximo 120 em high | playwright batch exit 0, "draw calls at most 120" | `tests/e2e/render.spec.ts:14` - `expect(calls).toBeLessThanOrEqual(120)` (contagem de todos os passes por causa de `autoReset = false`, `src/core/Game.ts:77`, `:241-243`) | PASS |
| C9 | rainCount 4000 em high, 1000 em low; rainObject `Points` | playwright batch exit 0, "rain point count by quality" | `tests/e2e/visual.spec.ts:103` - toBe(4000); `:104` - `rainObject` toBe('Points'); `:106` - toBe(1000) | PASS |
| C10 | rainY nos 4 pontos; no browser uTime cresce e o centro fica a menos de 1 m do carro | vitest batch exit 0, "rain drop wraps inside the box"; playwright batch exit 0, "rain box follows the car" | `tests/unit/rainMath.test.ts:9-12` - rainY(30,0)=30, (30,1)=18, (5,1)=33, (5,10)=5 com `toBeCloseTo(.., 6)`; `:8` - RAIN_SPEED_MS toBe(12); `tests/e2e/visual.spec.ts:118` - `expect(s.t).toBeGreaterThan(t0)`; `:119` - distância `toBeLessThan(1)`. Lacuna de nível: a queda na GPU (`src/world/Rain.ts:48`, `mod(position.y - uSpeed * uTime, uBox.y)`) só é provada pelo espelho em JS | PASS |
| C11 | flicker em 2.0 a 3.2 para 4 grupos x 200 amostras e move mais de 0.05 em 0.5 s; o mesmo no browser | vitest batch exit 0, "neon flicker stays in range and moves"; playwright batch exit 0, "neon signs flicker" | `tests/unit/flicker.test.ts:15-16` - `toBeGreaterThanOrEqual(2.0)` / `toBeLessThanOrEqual(3.2)`; `:19` - `expect(moved, ...).toBe(true)` para toda amostra; `tests/e2e/visual.spec.ts:128` - 4 valores; `:130-131` - faixa; `:133` - `a.some((v, i) => Math.abs(v - b[i]!) > 0.05)` toBe(true) | PASS |
| C12 | 2 cones com transparent, opacity 0.12, AdditiveBlending | playwright batch exit 0, "headlight cones" | `tests/e2e/visual.spec.ts:140` - length toBe(2); `:142` - transparent; `:143` - `toBeCloseTo(0.12, 6)`; `:144` - `c.additive` toBe(true) (`blending === THREE.AdditiveBlending`, `src/core/Game.ts:319`). A direção +Z local do AC 12 não é afirmada | PASS |
| C13 | SkidBuffer(400): 450 push dão count 400 e head 50; no browser skidCount maior que 0 e no máximo 400 | vitest batch exit 0, "skid ring buffer overwrites oldest"; playwright batch exit 0, "handbrake leaves skid marks" | `tests/unit/effectsMath.test.ts:9` - count toBe(400); `:10` - head toBe(50); `:12` - slot 0 sobrescrito; `tests/e2e/visual.spec.ts:159-160` - skidCount maior que 0 e no máximo 400. O limiar de 20 km/h (`src/vehicle/Car.ts:123`) e o "um quad por roda traseira por passo" não têm prova | PASS |
| C14 | ParticlePool(256, 0.8): spawn(4) estabiliza em 184..192, spawn(8) satura em 256, expira em 49 passos; no browser smokeAlive maior que 0 e no máximo 256 | vitest batch exit 0, "smoke pool caps at 256 and expires after 0.8 s"; playwright batch exit 0, "tire smoke while skidding" | `tests/unit/effectsMath.test.ts:32-33` - alive entre 184 e 192; `:42` - `expect(peak).toBe(256)`; `:45` - alive toBe(0) após 49 passos; `tests/e2e/visual.spec.ts:172-173` - maior que 0 e no máximo 256. O teste unitário constrói `new ParticlePool(256, 0.8)` com literais e nunca lê `SMOKE_CAP`/`SMOKE_LIFETIME_S`/`SMOKE_PER_STEP`; o mutante de vida sobreviveu (ver Faults) | PASS |
| C15 | sparkBurstFor 40 para 3000 e 50000, 0 para 2999 e 0; no browser lastCollision null antes, impulso de pelo menos 3000 e sparksSpawned 40 | vitest batch exit 0, "spark burst threshold at 3000"; playwright batch exit 0, "collision throws sparks" | `tests/unit/effectsMath.test.ts:50-53` - 0, 0, 40, 40; `tests/e2e/visual.spec.ts:187` - lastCollision `toBeNull()`; `:205` - `expect(hit.c.impulse).toBeGreaterThanOrEqual(3000)`; `:206` - `expect(hit.n).toBe(40)` | PASS |
| C16 | collider do chassi com CONTACT_FORCE_EVENTS e threshold 2000 | playwright batch exit 0, "chassis emits contact force events" | `tests/e2e/visual.spec.ts:180` - `expect(ev.activeEvents).toBe(ev.contactForceEvents)`; `:181` - `expect(ev.threshold).toBe(2000)` | PASS |
| C17 | fovFor 0/110/220/300 dá 62/70/78/78; no browser 62 parado e fovFor(kmh) mais ou menos 0.5 após 3 s de W | vitest batch exit 0, "fov opens with speed"; playwright batch exit 0, "camera fov follows speed" | `tests/unit/chaseCamera.test.ts:36-39` - `toBeCloseTo(62/70/78/78, 6)`; `tests/e2e/visual.spec.ts:220` - `toBeCloseTo(62, 2)`; `:229` - `Math.abs(s.fov - expected)` toBeLessThan(0.5); `:230` - fov maior que 62.5 | PASS |
| C18 | blurFor 50/120/170/220/300 dá 0/0/0.3/0.6/0.6; no browser uBlur 0 parado | vitest batch exit 0, "radial blur above 120 kmh"; playwright batch exit 0, "grade uniforms and blur at rest" | `tests/unit/chaseCamera.test.ts:44-48` - os 5 valores `toBeCloseTo(.., 6)`; `tests/e2e/visual.spec.ts:289` - `expect(post.blur).toBe(0)`. A parte browser não distingue a ligação `src/core/Game.ts:236` do default 0 de `src/post/GradeShader.ts:12` | PASS |
| C19 | shakeAmplitude e shakeAt nos pontos dados; no browser shake maior que 0 logo após a colisão e menor que 0.01 após 1 s | vitest batch exit 0, "collision shake amplitude and decay"; playwright batch exit 0, "collision throws sparks" | `tests/unit/chaseCamera.test.ts:53-55` - 0.2, 0.4, 0.4; `:56-57` - shakeAt 0.4 e `0.4 / Math.E`; `tests/e2e/visual.spec.ts:207` - `expect(hit.shake).toBeGreaterThan(0)`; `:209` - `toBeLessThan(0.01)` após `advanceSim(page, 1)` | PASS |
| C20 | lateralOffset 0/1/2/-3 dá 0/0.8/1.2/-1.2 | vitest batch exit 0, "lateral offset by yaw rate" | `tests/unit/chaseCamera.test.ts:62-65` - os 4 valores `toBeCloseTo(.., 6)`. Só na própria camada: o sinal "positivo = esquerda do carro" e a suavização (`src/camera/ChaseCamera.ts:47-52`) não têm prova | PASS |
| C21 | passes exatos em high e em low | playwright batch exit 0, "pass order by quality" | `tests/e2e/visual.spec.ts:238-245` - `toEqual(['RenderPass','GTAOPass','UnrealBloomPass','ShaderPass','SMAAPass','OutputPass'])`; `:247-253` - `toEqual([...])` sem GTAOPass com `?quality=low` | PASS |
| C22 | gtao width floor(innerWidth/2), height floor(innerHeight/2), blendIntensity 0.7, output 0 | playwright batch exit 0, "gtao at half resolution" | `tests/e2e/visual.spec.ts:265` - `expect(s.gtao.width).toBe(Math.floor(s.w / 2))`; `:266` - height; `:267` - `toBeCloseTo(0.7, 6)`; `:268` - `expect(s.gtao.output).toBe(0)` | PASS |
| C23 | uAberration 0.0015, uVignette 0.35, uLift, uGain, ACES | playwright batch exit 0, "grade uniforms and blur at rest" | `tests/e2e/visual.spec.ts:284` - `toBeCloseTo(0.0015, 6)`; `:285` - `toBeCloseTo(0.35, 6)`; `:286` - uLift contra [0, 0.01, 0.03]; `:287` - uGain contra [1.05, 1, 0.95]; `:288` - `expect(post.aces).toBe(true)` | PASS |
| C24 | parseQuality nas 5 entradas; no browser low dá `low` e ultra dá `high` | vitest batch exit 0, "quality parsing with default high"; playwright batch exit 0, "quality level from url" | `tests/unit/quality.test.ts:7-11` - low, high, high, high, low; `tests/e2e/visual.spec.ts:295` - toBe('low'); `:297` - toBe('high') | PASS |
| C25 | ready em até 30 s de relógio em high | playwright batch exit 0, "ready within 30 s at high quality" | `tests/e2e/visual.spec.ts:304` - `expect(Date.now() - start).toBeLessThan(30_000)` (e `:9` waitForFunction ready com timeout 30_000) | PASS |
| C26 | 13 módulos puros, incluindo os 4 novos, sem import de three/rapier | vitest batch exit 0, "pure modules do not import three or rapier" | `tests/unit/purity.test.ts:27` - `PURE_MODULES.length` toBe(13); `:30` - `expect(FORBIDDEN.test(source), rel).toBe(false)`; lista `:16-19` contém rainMath, flicker, effectsMath, quality | PASS |
| C27 | fetch-textures.mjs existe, script `fetch:textures`, licença com CC0 | vitest batch exit 0, "texture pipeline files present" | `tests/unit/assets.test.ts:12` - existsSync toBe(true); `:14` - `toContain('scripts/fetch-textures.mjs')`; `:16` - `expect(license).toContain('CC0')` | PASS |
| C28 | 6 diretórios com exatamente os 3 arquivos, soma de no máximo 15 MB | vitest batch exit 0, "texture sets complete and under 15 MB" | `tests/unit/assets.test.ts:25` - `expect(files, set).toEqual(KINDS.map(...).sort())`; `:28` - `toBeLessThanOrEqual(15 * 1024 * 1024)` | PASS |
| C29 | 4 letreiros com intensidade de pelo menos 2.0 no primeiro frame | playwright batch exit 0, "neon emissive intensity at least 2" | `tests/e2e/render.spec.ts:23` - length toBe(4); `:24` - `for (const v of m.signEmissiveIntensities) expect(v).toBeGreaterThanOrEqual(2)` | PASS |
| C30 | drive C1 (50 km/h em 5 s) e C9 (prédio bloqueia) seguem verdes | playwright batch exit 0, "throttle reaches 50 kmh within 5s" e "building blocks the chassis" | `tests/e2e/drive.spec.ts:24` - `expect(reached).toBe(true)` para `g.car.speedKmh >= 50` em 5 s; `:77` - `expect(insideX && insideZ).toBe(false)`; `:79` - `toBeLessThan(6)` | PASS |
| C31 | low: ready, rain 1000 e reflector ausente num só carregamento | playwright batch exit 0, "low quality profile end to end" | `tests/e2e/visual.spec.ts:315` - `expect(s).toEqual({ ready: true, rain: 1000, refl: false })` | PASS |
| C32 | gtaoClipBox contém a cidade (min até -202 em x/z, max a partir de 202, max.y a partir de 60) | playwright batch exit 0, "gtao at half resolution" | `tests/e2e/visual.spec.ts:269-272` - min[0], min[2] no máximo -202 e max[0], max[2] no mínimo 202; `:273` - `max[1]` toBeGreaterThanOrEqual(60) | PASS |

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| texture sets (6) | `public/textures/` (6 dirs) e `src/core/Loader.ts:14-21` `TEXTURE_SETS` | Asphalt012, PavingStones070, Concrete034, MetalPlates006, Bricks059, PaintedPlaster017: C1 (HTTP 200 e loaded), C28 (arquivos); Concrete034 também C2 | - |
| texture map kinds (3) | `src/core/Loader.ts:55-58` `loadSet` | Color, NormalGL, Roughness: C1, C28; road C3 | - |
| facade type -> set (4) | `src/core/Loader.ts:25` `FACADE_SETS` e door 1 (Concrete034, MetalPlates006, Bricks059, PaintedPlaster017 para 0..3) | tipos 0..3 existem: C5, C6 | a ordem do mapeamento tipo -> set (`Loader.ts:25`, usada em `CityScene.ts:93`) não é afirmada por nenhuma prova |
| facade types (4) | `src/world/CityGenerator.ts:16` `FACADE_TYPES`, `:212-215` | 0, 1, 2, 3: C5 (table-driven); malhas C6 | - |
| quality inputs (3) | `src/core/quality.ts:17-20` | low, high, inválido: C24 (unit e browser) | - |
| low-quality effects (3) | `src/core/quality.ts:22-25` | sem GTAO C21; sem reflector C4, C31; rain 1000 C9, C31 | - |
| passes high (6) / low (5) | `src/core/Game.ts:148-174` | as 11 posições: C21 com `toEqual` exato | - |
| grade uniforms (5) | `src/post/GradeShader.ts:19-26` | uAberration, uVignette, uLift, uGain: C23; uBlur: C18 (fórmula na unidade, default 0 no browser) | - |
| gtao config (5) | `src/core/Game.ts:151-163` | width, height, blendIntensity, output: C22; clip box: C32 | - |
| camera formulas wired at the boundary (4) | `src/camera/ChaseCamera.ts:40-68` e `src/core/Game.ts:236` | fov C17; shake C19 | blur acima de 120 km/h: a ligação em `Game.ts:236` só é vista no default 0; lateral: nenhuma prova de browser para `ChaseCamera.ts:47-52` (sinal esquerda e suavização) |
| effects config constants (9) | `src/vehicle/effectsMath.ts:80-88`, consumidas em `src/vehicle/Effects.ts:31-33`, `:96` e `src/vehicle/Car.ts:123` | SPARK_IMPULSE_THRESHOLD, SPARK_BURST: C15 (unit e browser) | SMOKE_PER_STEP 4, SMOKE_LIFETIME_S 0.8, SMOKE_CAP 256 como ligado, SKID_CAP 400 como ligado, SPARK_CAP 128, SPARK_LIFETIME_S 0.4, SKID_MIN_KMH 20: nenhum teste lê essas constantes (rg em `tests/` não acha nenhuma); os unitários usam literais e as asserções de browser (maior que 0 e no máximo o teto) passam com qualquer valor plausível. Mutante de vida sobreviveu |
| skid condition branches (2) | `src/vehicle/Car.ts:123` `handbrake && kmh > SKID_MIN_KMH` | freio de mão acima de 20 km/h: C13 browser | freio de mão a 20 km/h ou menos, sem marca: sem prova |
| collide outcomes (2) | `src/vehicle/Effects.ts:114-123` | impulso de pelo menos 3000 grava lastCollision e 40 faíscas: C15 | impulso abaixo de 3000 não atualiza lastCollision (AC 16, `Effects.ts:116`): só `sparkBurstFor` é provado, o early return não |
| particle systems (3) | `src/world/Rain.ts`, `src/vehicle/Effects.ts` | rain C9, C10; smoke C14; sparks C15 | - |
| sign materials / flicker groups (4) | `src/world/CityScene.ts:239-247`, `src/core/Game.ts:233-235` | 4 materiais: C11 (unit e browser), C29 | - |
| landing doors (7) | `plan.md` Landing | 1 C1, C27, C28; 2 C6; 3 C4; 4 C9, C13, C14; 5 C24, C31; 6 C15, C16; 7 C21, C22, C23 | door 3: o tamanho literal `innerWidth x 0.5` diverge em DPR diferente de 1 (C4 FAIL); door 4: tetos e vidas ligados (256, 128, 400, 0.8, 0.4) sem prova, ver effects config |
| plan ACs (25) | `plan.md` Criteria S2-S5 | todo AC tem ao menos um check (1 C1; 2 C2; 3 C3; 4 C4; 5 C5; 6 C6; 7 C5, C7; 8 C8; 9 C9; 10 C10; 11 C11, C29; 12 C12; 13 C13; 14 C14; 15 C15; 16 C15; 17 C17; 18 C18; 19 C19; 20 C20; 21 C21; 22 C22, C32; 23 C23; 24 C24; 25 C25) | cláusulas sem prova: AC 12 "along local +Z"; AC 13 limiar de 20 km/h e um quad por roda por passo; AC 14 "4 por passo, 0.8 s" como ligado; AC 16 "SHALL not update lastCollision"; AC 20 sinal e suavização no browser |
| pure modules (13) | varredura de `src/**/*.ts` sem import de three/rapier: 19 arquivos, dos quais 6 são DOM/estado (AudioEngine, GameLoop, InputManager, Hud, Minimap, main) | os 13 de lógica pura, incluindo os 4 novos: C26 | - |
| superseded free-roam-city (1) | `tests/e2e/render.spec.ts:11-15` | ex-21 -> C8 (120) | - |
| startup config: quality (1 assembly) | `src/main.ts:31` `qualityPreset(parseQuality(window.location.search))` | C24 browser (low e ultra) | - |

Lacunas de nível (GPU), registradas como achado e deixadas para o passo com o usuário, não como membros acima: a queda da chuva no vertex shader (`src/world/Rain.ts:48`) só é provada pelo espelho `rainY`; a grade de janela de 4 m, o hash aceso/apagado e o antialias por `fwidth` (`src/world/CityScene.ts:353-364`) não têm prova além dos valores de `aRepeat`; o efeito visual de aberração, vinheta e blur (`src/post/GradeShader.ts:43-67`) só tem os valores dos uniforms provados.

Swept rows `existing`: C13 (sobrescreve o mais antigo) está em `src/vehicle/effectsMath.ts:27-28`; concurrency (drain no mesmo passo) está em `src/core/Game.ts:202-209`; observability (`textures.loaded/failed`, `console.warn`) está em `src/core/Loader.ts:84` e `src/core/Game.ts:294-297`. Todas as restrições citadas existem. Decisões do STATE: AD-003 (ACES e composer) em `Game.ts:75`; AD-006 (passo fixo) preservado; AD-008: `Math.random` aparece só em jitter visual (`src/camera/ChaseCamera.ts:58-60`, `src/vehicle/Effects.ts:43`), não em lógica de mundo, e fachadas e chuva usam mulberry32 (`CityGenerator.ts:213`, `Rain.ts:19`); AD-009: texturas CC0 com fallback de cor chapada (C2).

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/camera/chaseMath.ts` (4 fórmulas consumidas por ChaseCamera e Game) | fronteira e própria camada | no - própria camada C17-C20 ok; na fronteira C17 e C19 ok, C18 só no default 0, e lateral (C20) sem prova de fronteira |
| Decides, reached across a boundary | `src/core/quality.ts`, `src/main.ts` | fronteira C24 e própria camada C24 | yes |
| Decides, reached across a boundary | `src/core/Loader.ts` (ok ou falha por set) | fronteira C1, C2 | yes |
| Decides, reached across a boundary | `src/vehicle/Car.ts` (`skidding` = freio de mão e mais de 20 km/h, eventos de contato) | fronteira e própria camada | no - só o ramo acima de 20 km/h tem prova (C13); o limiar não tem caso nem teste de unidade; eventos C16 ok |
| Decides, reached across a boundary | `src/vehicle/Effects.ts` (`collide` decide gravar lastCollision; cadência de smoke e skid) | fronteira e própria camada | no - o early return abaixo de 3000 (AC 16) e a cadência de 4 por passo e 0.8 s não têm prova; o autor classificou o arquivo como instrumentação, mas ele contém um ramo |
| Decides, not reached across a boundary | `src/world/CityGenerator.ts`, `src/world/flicker.ts`, `src/vehicle/effectsMath.ts` | própria camada, um caso por linha | no - CityGenerator C5 e flicker C11 ok; as funções e classes de effectsMath ok (C13-C15), mas as constantes de configuração que o arquivo exporta (`:82-88`) não são afirmadas por nenhum teste |
| Decides, not reached across a boundary | `src/world/rainMath.ts` | própria camada C10 | yes - atende a letra; a decisão real está duplicada em GLSL (`Rain.ts:48`), lacuna de nível registrada |
| Instrumentation, pass-throughs | `src/world/CityScene.ts`, `src/world/Rain.ts`, `src/post/GradeShader.ts`, `src/core/Game.ts`, `src/camera/ChaseCamera.ts` | coberto pela prova do consumidor | no - CityScene (C3, C6, C7, C4), Rain (C9, C10), GradeShader (C23) e Game (C8, C21, C22, C32) cobertos; ChaseCamera: lateral não coberto; Game: ligação de uBlur não observável no default |
| Instrumentation, pass-throughs | `scripts/fetch-textures.mjs`, `package.json`, `playwright.config.ts`, 18 JPG e licença | nenhuma própria (script de dev, Observable n/a) | yes - existência e referência C27; assets C28 |

## Faults injected

Worktree em `scratchpad/verify-vis` a partir de `a7614e9`, `node_modules` por junction. Cada fault revertido com `git checkout -- <file>` antes do seguinte. Playwright rodou sozinho na porta 5173 (verificado livre antes). Depois disso: junction removida, worktree removido, e o porcelain da árvore real ficou igual ao baseline (vazio), antes de escrever este arquivo.

| Mutation | Location | Killed |
| --- | --- | --- |
| GTAOPass adicionado depois do UnrealBloomPass (ordem trocada) | `src/core/Game.ts:164` | yes - "pass order by quality" falhou (`toEqual` recebeu GTAOPass na posição errada) |
| `SPARK_IMPULSE_THRESHOLD` 3000 -> 3500 | `src/vehicle/effectsMath.ts:80` | yes - "spark burst threshold at 3000": expected +0 to be 40 |
| `FOV_MAX` 78 -> 80 | `src/camera/chaseMath.ts:19` | yes - "fov opens with speed": expected 71 to be close to 70 |
| opacity da rua 0.65 -> 0.8 | `src/world/CityScene.ts:71` | yes - "wet pbr road material": Expected 0.65, Received 0.8 |
| `SMOKE_LIFETIME_S` 0.8 -> 2.0 (fumaça vive 2.5x mais) | `src/vehicle/effectsMath.ts:84` | no - survived: "smoke pool caps at 256 and expires after 0.8 s" passou (usa `new ParticlePool(256, 0.8)` literal) e "tire smoke while skidding" passou (1 passed, 17.8s; só afirma maior que 0 e no máximo 256) |

## Gate

`cd C:/Users/arthu/.claude/skills/tlc-spec-lean/scripts && python validate_verification.py visual-upgrade --root C:/Users/arthu/source/repos/Jogo` - exit 1:

    ERROR visual-upgrade: verdict is FAIL - route the ranked gaps back as fixes, then re-verify
    validate_verification: 1 error(s), 0 warning(s) across [visual-upgrade]

O único erro é o próprio veredito FAIL: nenhum problema de formato, e o perfil bate com `checks.md`. Suítes: vitest 41 passed, 0 failed; Playwright 35 passed, 0 failed.

Passo 5 (walk com o usuário): o usuário vai testar o visual no browser depois deste relatório; as lacunas de GPU acima (janelas de 4 m, queda da chuva, aberração/vinheta/blur) só se resolvem por esse olhar.
