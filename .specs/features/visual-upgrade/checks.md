# Visual upgrade - checks

Profile: standard
Plan: `.specs/features/visual-upgrade/plan.md`

## Intent

32 checks in 4 slices · 7 one-way doors · 0 open

Comandos de prova: unitário `npx vitest run <arquivo> -t "<nome>"`; integração
`npx playwright test <arquivo> -g "<nome>"` (chromium headless contra `vite dev`, lendo
`window.__game`; "N s" é tempo simulado via `__game.simTime`, como na free-roam-city).

Nomes de arquivo das texturas seguem o zip do ambientCG: `<Set>_1K-JPG_Color.jpg`,
`<Set>_1K-JPG_NormalGL.jpg`, `<Set>_1K-JPG_Roughness.jpg` em `public/textures/<Set>/`.

## Checks

### S2 - Materiais PBR · 7 files · 40 KB · ~10k

**C1** - Os 18 arquivos de textura (6 sets × Color, NormalGL, Roughness) respondem HTTP 200 no dev server e `__game.textures.loaded` lista os 6 sets (AC 1, door 1)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "texture sets are served and loaded"`

**C2** - Com as requisições de `/textures/Concrete034/**` abortadas, a página emite `console.warn` contendo `Concrete034`, `__game.textures.failed` contém `Concrete034`, e `__game.ready` fica `true` (AC 2)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "missing texture set falls back to flat color"`

**C3** - `__game.materials.road` reporta `hasMap`, `hasNormalMap`, `hasRoughnessMap` verdadeiros, `roughness` ≤ 0.25, `transparent` true, `opacity` 0.65 e `repeat` = 111 (plano de 444 m / 4 m por tile) (AC 3)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "wet pbr road material"`

**C4** - Sem parâmetro, `__game.scene.reflector` reporta `present` true e `size` = `[floor(innerWidth × 0.5), floor(innerHeight × 0.5)]`; com `?quality=low`, `present` false (AC 4, door 3)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "reflector present only in high quality"`

**C5** - `generateCity(1337)`: todo `Building` tem `facadeType` inteiro em 0..3 e os 4 valores aparecem; toda `Street` tem `laneMarks` com `floor(404 / 6)` = 67 posições espaçadas de 6 m (± 0.01) (AC 5, AC 7)
Proof: `npx vitest run tests/unit/cityGenerator.test.ts -t "facade types and lane marks"`

**C6** - `__game.city.facadeMeshes` tem exatamente 4 entradas, cada uma com atributos instanciados `aRepeat` (itemSize 2) e `aSeed` (itemSize 1), e para a instância 0 da malha 0 `aRepeat` = `[width / 4, height / 4]` do prédio correspondente (± 1e-3) (AC 6, door 2)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "four facade meshes with per-instance repeat"`

**C7** - `__game.materials.sidewalk` reporta `hasMap` e `hasNormalMap` verdadeiros, e `__game.city.laneMarkCount` = 14 × 67 = 938 (AC 7)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "sidewalk pbr and lane marks"`

**C8** - Após o primeiro frame com qualidade `high`, `renderer.info.render.calls` ≤ 120 (AC 8; supersede free-roam-city ex-21, cujo teste passa a afirmar 120)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "draw calls at most 120"`

### S3 - Movimento na cena · 6 files · 38 KB · ~10k

**C9** - `__game.weather.rainCount` é 4000 sem parâmetro e 1000 com `?quality=low`; `rainObject` é `Points` (AC 9, door 4)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "rain point count by quality"`

**C10** - `rainY(seedY, t)` = `((seedY − 12·t) mod 40 + 40) mod 40` (queda a 12 m/s numa caixa de 40 m de altura): `rainY(30, 0)` = 30, `rainY(30, 1)` = 18, `rainY(5, 1)` = 33, `rainY(5, 10)` = 5; e no browser `__game.weather.uTime` cresce entre dois frames e `__game.weather.center` está a menos de 1 m da posição do carro (AC 10)
Proof: `npx vitest run tests/unit/rainMath.test.ts -t "rain drop wraps inside the box"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "rain box follows the car"`

**C11** - `flickerIntensity(t, group)` fica em `[2.0, 3.2]` para 4 grupos × 200 amostras de `t` em `[0, 20]` s e varia mais de 0.05 em pelo menos um grupo entre `t` e `t + 0.5`; no browser as 4 `signEmissiveIntensities` estão em `[2.0, 3.2]` e ao menos uma difere em > 0.05 entre duas amostras 0.5 s (sim) apart (AC 11)
Proof: `npx vitest run tests/unit/flicker.test.ts -t "neon flicker stays in range and moves"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "neon signs flicker"`

**C12** - `__game.effects.headlightCones` = 2, cada um com `transparent` true, `opacity` 0.12 e `blending` = `AdditiveBlending` (AC 12)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "headlight cones"`

**C13** - `SkidBuffer(400)`: após 450 `push`, `count` = 400 e `head` = 50 (o mais antigo foi sobrescrito); no browser, após `W` por 2.5 s e `Space` segurado por 1 s (sim), `__game.effects.skidCount` > 0 e ≤ 400 (AC 13, door 4)
Proof: `npx vitest run tests/unit/effectsMath.test.ts -t "skid ring buffer overwrites oldest"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "handbrake leaves skid marks"`

**C14** - `ParticlePool(256, 0.8)`: `spawn(4)` por passo de 1/60 s durante 6 s estabiliza `alive` entre 184 e 192 (4 × 48 passos de vida) e nunca passa de 256; `spawn(8)` por passo satura em exatamente 256 (o teto limita); com `spawn` parado, `alive` chega a 0 em 49 passos (0.8 s mais um passo de arredondamento); no browser, durante a derrapagem de C13 `__game.effects.smokeAlive` > 0 e ≤ 256 (AC 14, door 4)
Proof: `npx vitest run tests/unit/effectsMath.test.ts -t "smoke pool caps at 256 and expires after 0.8 s"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "tire smoke while skidding"`

**C15** - `sparkBurstFor(impulse)` = 40 para 3000 e 50000, 0 para 2999 e 0; no browser, antes de bater `__game.effects.lastCollision` é `null`, e após dirigir contra um prédio (mesmo cenário de free-roam-city C9) `lastCollision.impulse` ≥ 3000 e `__game.effects.sparksSpawned` = 40 (AC 15, AC 16, door 6)
Proof: `npx vitest run tests/unit/effectsMath.test.ts -t "spark burst threshold at 3000"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "collision throws sparks"`

**C16** - O collider do chassi tem `activeEvents` = `CONTACT_FORCE_EVENTS` e `contactForceEventThreshold` = 2000 (`__game.car.collisionEvents`) (door 6)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "chassis emits contact force events"`

### S4 - Câmera e velocidade · 3 files · 8 KB · ~2k

**C17** - `fovFor(kmh)`: 0→62, 110→70, 220→78, 300→78; no browser `__game.camera.fov` = 62 (± 0.01) parado e, após `W` por 3 s, = `fovFor(__game.car.speedKmh)` ± 0.5 lido no mesmo `evaluate` (AC 17)
Proof: `npx vitest run tests/unit/chaseCamera.test.ts -t "fov opens with speed"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "camera fov follows speed"`

**C18** - `blurFor(kmh)`: 50→0, 120→0, 170→0.3, 220→0.6, 300→0.6; no browser `__game.post.uBlur` = 0 parado (AC 18)
Proof: `npx vitest run tests/unit/chaseCamera.test.ts -t "radial blur above 120 kmh"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "grade uniforms and blur at rest"`

**C19** - `shakeAmplitude(I)` = `min(0.4, I / 20000)`: 4000→0.2, 20000→0.4, 100000→0.4; `shakeAt(t, amp)` = `amp · e^(−t / 0.15)`: `shakeAt(0, 0.4)` = 0.4, `shakeAt(0.15, 0.4)` = 0.4/e; no browser, logo após a colisão de C15 `__game.camera.shake` > 0 e após 1 s (sim) < 0.01 (AC 19)
Proof: `npx vitest run tests/unit/chaseCamera.test.ts -t "collision shake amplitude and decay"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "collision throws sparks"`

**C20** - `lateralOffset(angVelY)` = `clamp(angVelY × 0.8, −1.2, 1.2)`: 0→0, 1→0.8, 2→1.2, −3→−1.2 (AC 20)
Proof: `npx vitest run tests/unit/chaseCamera.test.ts -t "lateral offset by yaw rate"`

### S5 - Pós-processamento moderno · 4 files · 16 KB · ~4k

**C21** - `__game.composer.passes` é exatamente `['RenderPass', 'GTAOPass', 'UnrealBloomPass', 'ShaderPass', 'SMAAPass', 'OutputPass']` sem parâmetro e `['RenderPass', 'UnrealBloomPass', 'ShaderPass', 'SMAAPass', 'OutputPass']` com `?quality=low` (AC 21, door 7)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "pass order by quality"`

**C22** - `__game.post.gtao` reporta `width` = `floor(innerWidth / 2)`, `height` = `floor(innerHeight / 2)`, `blendIntensity` 0.7 e `output` 0 (`GTAOPass.OUTPUT.Default`) (AC 22)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "gtao at half resolution"`

**C23** - `__game.post.uniforms` reporta `uAberration` 0.0015, `uVignette` 0.35, `uLift` `[0, 0.01, 0.03]`, `uGain` `[1.05, 1, 0.95]` (± 1e-6) e `__game.toneMappingIsACES` true (AC 23, door 7)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "grade uniforms and blur at rest"`

**C24** - `parseQuality(search)`: `'?quality=low'`→`low`, `'?quality=high'`→`high`, `''`→`high`, `'?quality=ultra'`→`high`, `'?foo=1&quality=low'`→`low`; no browser `?quality=low` → `__game.quality.level` `low`, `?quality=ultra` → `high` (AC 24, door 5)
Proof: `npx vitest run tests/unit/quality.test.ts -t "quality parsing with default high"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "quality level from url"`

**C25** - Sem parâmetro (`high`), `__game.ready` fica `true` em até 30 s de relógio (AC 25)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "ready within 30 s at high quality"`

### Transversais

**C26** - Os módulos puros novos `src/world/rainMath.ts`, `src/world/flicker.ts`, `src/vehicle/effectsMath.ts`, `src/core/quality.ts` entram na lista de C39 da free-roam-city (13 módulos) e nenhum importa `three` ou `rapier` (door 1 da free-roam-city)
Proof: `npx vitest run tests/unit/purity.test.ts -t "pure modules do not import three or rapier"`

**C27** - `scripts/fetch-textures.mjs` existe, é referenciado em `package.json` como `fetch:textures`, e `public/textures/LICENSE-ambientcg.txt` contém `CC0` (door 1)
Proof: `npx vitest run tests/unit/assets.test.ts -t "texture pipeline files present"`

**C28** - Os 6 diretórios `public/textures/<Set>/` contêm exatamente os 3 arquivos `Color`, `NormalGL`, `Roughness` cada, e a soma dos 18 arquivos é ≤ 15 MB (assunção do plano)
Proof: `npx vitest run tests/unit/assets.test.ts -t "texture sets complete and under 15 MB"`

**C29** - Sem parâmetro, `__game.materials.signEmissiveIntensities` tem 4 valores ≥ 2.0 no primeiro frame (regressão de free-roam-city C22 com o flicker ativo) (AC 11)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "neon emissive intensity at least 2"`

**C30** - Os checks de direção da free-roam-city seguem verdes com a física de eventos ligada: C1 (50 km/h em 5 s) e C9 (prédio bloqueia) (door 6 não altera a dinâmica)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "throttle reaches 50 kmh within 5s|building blocks the chassis"`

**C31** - Com `?quality=low`, `__game.ready` fica `true`, `__game.weather.rainCount` = 1000 e `__game.scene.reflector.present` = false num único carregamento (door 5, todos os efeitos de `low` juntos)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "low quality profile end to end"`

**C32** - `__game.post.gtaoClipBox` reporta um `Box3` que contém a cidade inteira (`min` ≤ −202 em x/z e `max` ≥ 202, `max.y` ≥ 60) — `setSceneClipBox` configurado (AC 22)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "gtao at half resolution"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| texture sets (6) | Asphalt012 C1, C28 · PavingStones070 C1, C28 · Concrete034 C1, C2, C28 · MetalPlates006 C1, C28 · Bricks059 C1, C28 · PaintedPlaster017 C1, C28 | - |
| texture map kinds (3) | Color C1, C3 · NormalGL C1, C3 · Roughness C1, C3 | - |
| facade types (4) | C5, table-driven over all 4 · meshes C6 | - |
| quality levels (3 inputs) | low C24 · high C24 · invalid C24 | - |
| low-quality effects (3) | no GTAO C21 · no reflector C4, C31 · rain 1000 C9, C31 | - |
| passes high (6) | RenderPass C21 · GTAOPass C21 · UnrealBloomPass C21 · ShaderPass C21 · SMAAPass C21 · OutputPass C21 | - |
| passes low (5) | RenderPass C21 · UnrealBloomPass C21 · ShaderPass C21 · SMAAPass C21 · OutputPass C21 | - |
| grade uniforms (5) | uAberration C23 · uVignette C23 · uLift C23 · uGain C23 · uBlur C18 | - |
| gtao params (4) | width C22 · height C22 · blendIntensity C22 · output C22 | - |
| fov samples (4) | 0 C17 · 110 C17 · 220 C17 · 300 C17 | - |
| blur samples (5) | 50 C18 · 120 C18 · 170 C18 · 220 C18 · 300 C18 | - |
| shake samples (3) | 4000 C19 · 20000 C19 · 100000 C19 | - |
| lateral samples (4) | 0 C20 · 1 C20 · 2 C20 · -3 C20 | - |
| rain samples (4) | (30,0) C10 · (30,1) C10 · (5,1) C10 · (5,10) C10 | - |
| particle systems (3) | rain C9, C10 · smoke C14 · sparks C15 | - |
| skid buffer edges (2) | below cap C13 · overflow C13 | - |
| collision threshold (4) | 0 C15 · 2999 C15 · 3000 C15 · 50000 C15 | - |
| flicker groups (4) | C11, table-driven over all 4 | - |
| landing doors (7) | 1 C1, C27, C28 · 2 C6 · 3 C4 · 4 C9, C13, C14 · 5 C24, C31 · 6 C15, C16 · 7 C21, C23 | - |
| superseded free-roam-city checks (1) | ex-21 → C8 | - |
| pure modules (13 files) | C26, table-driven over all 13 | - |
| startup config: quality (1 assembly) | `src/main.ts` C24 | - |

- Claims cruzando a fronteira browser (Playwright): C1-C4, C6-C9, C10-C19 (parte browser), C21-C25, C29-C32
- Nenhum outro check afirma mais do que o caso único que sua prova exercita

## Test policy

Mesmas linhas das features anteriores (o repositório ainda não as tem em diretrizes).

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence (forma prevista; recontada pelo Verifier sobre o diff):

- `src/camera/chaseMath.ts`: 4 fórmulas com clamp (fov, blur, shake, lateral) → decides; C17-C20 na própria camada, C17-C19 na fronteira
- `src/world/CityGenerator.ts`: atribuição de `facadeType` (4 valores) e `laneMarks` → decides; C5
- `src/world/rainMath.ts`, `src/world/flicker.ts`: mapeamentos com módulo/clamp → decides; C10, C11
- `src/vehicle/effectsMath.ts`: ring buffer (2 ramos), pool (cap + expiração), limiar de faíscas → decides; C13-C15
- `src/core/quality.ts`: parse com default (3 entradas) → decides, reached across a boundary (URL); C24 nas duas camadas
- `src/core/Loader.ts`: 2 desfechos por set (ok, falha) → decides, reached across a boundary; C1, C2
- `src/world/CityScene.ts`, `src/world/Rain.ts`, `src/vehicle/Effects.ts`, `src/post/GradeShader.ts`, `src/core/Game.ts`, `src/camera/ChaseCamera.ts`: montam objetos three/Rapier e encaminham valores → instrumentation; cobertos pelas provas Playwright dos consumidores (C3, C4, C6-C9, C12-C16, C21-C23, C29-C32)

Cost: 11 provas unitárias em 7 arquivos e 23 provas Playwright em 3 arquivos.

## Swept

- validation: C10, C11, C17-C20, C24 - clamps das fórmulas, faixa do flicker, parse do parâmetro
- failure modes: C2 - textura ausente cai em cor chapada com aviso; C25 - `high` ainda carrega no orçamento
- idempotency: C13 - o ring buffer sobrescreve o mais antigo; repetir derrapagens nunca passa de 400
- authorization: n/a - jogo local
- concurrency: n/a - eventos de contato são drenados no mesmo passo fixo que os gera (`world.step(eventQueue)` seguido de `drain`), sem workers
- data lifecycle: C13, C14 - marcas e partículas têm vida finita (ring buffer, 0.8 s); nada persistido
- dependency failure: C2 - servidor de texturas; ambientCG só é usado em `scripts/fetch-textures.mjs`, fora do runtime
- state transitions: C9/C21/C31 - `high`↔`low` decidido no boot; C19 - shake ativo→decaído
- observability: C1, C2 - `__game.textures.{loaded,failed}` + `console.warn`; `__game.post`, `effects`, `weather`, `quality` expostos em DEV

## Handoff

- **Settled mid-build:** (autor, antes do código de C14) C14 dizia que `spawn(4)` levava o pool a 256; 4 × 48 passos de vida = 192, o teto nunca é atingido a essa taxa. O AC 14 (no máximo 256) continua certo; o check passou a provar o regime (184-192) e o teto com `spawn(8)`.
- S2 = 10k (Loader, CityGenerator, CityScene, Environment, script, assets); S3 = +10k (Rain, Effects, Car, Game) → 20k; S4 = +2k (chaseMath, ChaseCamera) → 22k; S5 = +4k (GradeShader, Game, quality) → 26k; testes ≈ +8k → 34k total, abaixo do budget de 150k - one builder
