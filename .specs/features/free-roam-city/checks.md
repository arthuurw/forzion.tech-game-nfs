# Free-roam city - checks

Profile: standard
Plan: `.specs/features/free-roam-city/plan.md`

## Intent

40 checks in 4 slices · 9 one-way doors · 0 open

Comandos de prova (repositório novo, definidos por este build):

- unitário: `npx vitest run <arquivo> -t "<nome do teste>"`
- integração: `npx playwright test <arquivo> -g "<nome do teste>"` (chromium headless contra `vite dev`, lendo `window.__game`)

## Checks

### S1 - Dirigir na cidade · 9 files · 42 KB · ~11k

**C1** - Segurar `W` por 5 s a partir do repouso leva a velocidade dianteira a 50 km/h ou mais (AC 1)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "throttle reaches 50 kmh within 5s"`

**C2** - Com velocidade dianteira acima de 1 km/h, `S` produz força de freio positiva nas 4 rodas e força de motor zero (AC 2)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "brake when moving forward"`

**C3** - Segurar `W` por 3 s e depois `S` por 1 s termina com velocidade dianteira menor que a medida ao soltar `W` (AC 2)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "brake reduces speed"`

**C4** - Com velocidade dianteira de 1 km/h ou menos, `S` produz força de motor negativa e a força é cortada quando a ré passa de 30 km/h (AC 3)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "reverse below 1 kmh and capped at 30"`

**C5** - Segurar `S` por 5 s a partir do repouso termina com velocidade dianteira entre -30 km/h e -5 km/h (AC 3)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "reverse drives backward up to 30 kmh"`

**C6** - Ângulo de direção é 0.5 rad a 0 km/h, 0.325 rad a 75 km/h, 0.15 rad a 150 km/h e 0.15 rad a 200 km/h; `A` positivo, `D` negativo (AC 4)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "steering angle decays with speed"`

**C7** - `Space` produz freio máximo só nas rodas traseiras (dianteiras 0) e fator de atrito lateral traseiro 0.4 (AC 5)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "handbrake brakes rear wheels and cuts rear grip to 0.4"`

**C8** - Força de motor é zero quando a velocidade dianteira é 220 km/h ou mais, e positiva a 219 km/h com `W` (AC 6)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "engine force cut at 220 kmh"`

**C9** - Carro teletransportado a 8 m de um prédio, de frente, segurando `W` por 3 s, termina com o centro do chassi fora da AABB do prédio (AC 7)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "building blocks the chassis"`

**C10** - Carro teletransportado a 10 m da borda `+x`, de frente para ela, segurando `W` por 3 s, termina com `|x|` e `|z|` em 202 m ou menos (AC 8)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "invisible wall keeps chassis inside city"`

**C11** - Com o chassi rotacionado 180° em `Z`, pressionar `R` deixa a rotação com `|x|,|y|,|z| < 0.01` e `w > 0.99`, `y` da posição 1 m acima da anterior (± 0.05), e velocidade linear e angular com módulo abaixo de 0.01 (AC 9)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "reset puts car upright"`

**C12** - Acumulador com `dt` de 0.05 s executa 3 passos e guarda 0.0 s de resto; com `dt` de 0.2 s executa 5 passos e descarta o excedente (resto 0.0 s); com `dt` de 0.01 s executa 0 passos e guarda 0.01 s (AC 10)
Proof: `npx vitest run tests/unit/fixedStepper.test.ts -t "steps at 1/60 with a cap of 5"`

**C13** - Para heading 0 e chassi em `(0,0,0)` o alvo da câmera é `(0, 2.5, -6)` olhando para `(0,1,0)`; para heading π/2 é `(-6, 2.5, 0)` (AC 11)
Proof: `npx vitest run tests/unit/chaseCamera.test.ts -t "target is 6 m behind and 2.5 m above along heading"`

**C14** - Suavização com fator 5/s e `dt` 0.1 move a câmera 50 % da distância até o alvo (`1 - e^{-0.5}` ≈ 0.393 se exponencial; este check fixa a fórmula `lerp(current, target, 1 - exp(-5·dt))`) (AC 11)
Proof: `npx vitest run tests/unit/chaseCamera.test.ts -t "smoothing follows 1 - exp(-5 dt)"`

**C15** - Cada tecla mapeia para exatamente um campo de `InputState`: `W`→`throttle`, `S`→`brake`, `A`→`steer +1`, `D`→`steer -1`, `Space`→`handbrake`, `R`→`reset`, `M`→`mute`; tecla desconhecida não altera nada (AC 1-5, 9, 30)
Proof: `npx vitest run tests/unit/input.test.ts -t "keymap table"`

### S2 - Cidade noturna procedural · 5 files · 30 KB · ~8k

**C16** - `generateCity(1337)` chamado duas vezes retorna objetos com `JSON.stringify` idêntico, e `generateCity(1)` difere de `generateCity(2)` (AC 12)
Proof: `npx vitest run tests/unit/cityGenerator.test.ts -t "deterministic by seed"`

**C17** - O layout tem 64 quarteirões, cada um 40 m × 40 m, espaçados por 12 m, com `bounds` de `±202` em `x` e `z` (AC 13)
Proof: `npx vitest run tests/unit/cityGenerator.test.ts -t "8x8 grid of 40 m blocks with 12 m streets"`

**C18** - Cada um dos 64 quarteirões tem entre 1 e 4 prédios, cada um com altura em `[10, 60]` e base contida no retângulo do quarteirão (AC 14)
Proof: `npx vitest run tests/unit/cityGenerator.test.ts -t "buildings per block within bounds"`

**C19** - Cada quarteirão tem pelo menos 1 letreiro e toda cor de letreiro pertence à paleta `#ff2d95 #00e5ff #b026ff #ffd400`; a paleta exportada tem exatamente 4 entradas (AC 15)
Proof: `npx vitest run tests/unit/cityGenerator.test.ts -t "neon signs use the 4-color palette"`

**C20** - Ao longo de cada rua os postes estão espaçados de 20 m (± 0.01) nos dois lados, e a contagem total bate com `2 lados × ruas × floor(comprimento / 20)` (AC 16)
Proof: `npx vitest run tests/unit/cityGenerator.test.ts -t "lamp posts every 20 m on both sides"`

**C21** - Após o primeiro frame, `renderer.info.render.calls` é 60 ou menos com a cidade e o carro na cena (AC 17)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "draw calls at most 60"`

**C22** - Os materiais de letreiro e de janela têm `emissiveIntensity` de 2.0 ou mais (AC 17)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "neon emissive intensity at least 2"`

**C23** - O material da rua tem `roughness` de 0.25 ou menos e `scene.environment` não é nulo (AC 18)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "wet road material and environment map"`

**C24** - O `EffectComposer` contém um `UnrealBloomPass` habilitado e `renderer.toneMapping` é `ACESFilmicToneMapping` (AC 19)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "bloom pass and ACES tone mapping"`

### S3 - HUD · 6 files · 22 KB · ~6k

**C25** - `formatSpeed(13.9)` retorna `"50"`, `formatSpeed(-2.0)` retorna `"7"` (módulo), `formatSpeed(0.27)` retorna `"1"` (m/s × 3.6 arredondado) (AC 20)
Proof: `npx vitest run tests/unit/hudFormat.test.ts -t "speed in kmh as integer"`

**C26** - O HUD no DOM mostra o mesmo valor que `__game.car.speedKmh` arredondado após 2 s segurando `W` (AC 20)
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "speed label matches car state"`

**C27** - `gearFor(kmh)` cobre as 7 faixas: -5→-1, 0→1, 29.9→1, 30→2, 60→3, 95→4, 130→5, 170→6, 200→6 (AC 21)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "gear bands"`

**C28** - `rpmFor(kmh)` retorna 1000 a 0 km/h, 4000 a 15 km/h (meio da 1ª), 6980 a 29.9 km/h, 1000 a 30 km/h (início da 2ª), e nunca sai de `[1000, 7000]` para -50..250 km/h (AC 22)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "rpm within gear band"`

**C29** - A marcha `-1` é exibida como `R` e as demais como seu número; a barra de RPM tem largura `(rpm - 1000) / 6000 × 100 %` (AC 21, AC 22)
Proof: `npx vitest run tests/unit/hudFormat.test.ts -t "gear label and rpm bar width"`

**C30** - `worldToMinimap` mapeia o carro para o centro `(80, 80)`, um ponto 160 m a `+x` do carro para `x = 160` (borda), e 160 m a `-z` para `y = 0`; o canvas tem 160 × 160 px (AC 23)
Proof: `npx vitest run tests/unit/minimap.test.ts -t "320 m window into 160 px"`

**C31** - O overlay de loading com texto `Carregando...` está visível antes de `__game.ready` e oculto (`display: none`) depois (AC 24)
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "loading overlay shows then hides"`

**C32** - Com `getContext("webgl2")` retornando `null`, a página mostra o overlay com `Seu navegador não suporta WebGL2` e `__game` fica indefinido (loop não inicia) (AC 25)
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "webgl2 missing shows error overlay"`

**C33** - Com a requisição de `car.glb` abortada, a página emite `console.warn` contendo `/models/car.glb`, `__game.car.placeholder` é `true` e C1 ainda vale (velocidade ≥ 50 km/h após 5 s de `W`) (AC 26)
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "missing glb falls back to box chassis"`

**C34** - `exposeDebug({ DEV: false }, game)` não define `window.__game`; `exposeDebug({ DEV: true }, game)` define (door 4)
Proof: `npx vitest run tests/unit/exposeDebug.test.ts -t "debug handle only in DEV"`

### S4 - Som · 3 files · 10 KB · ~3k

**C35** - Antes de qualquer tecla `__game.audio.state` é `"idle"`; após pressionar `W` é `"running"` e os nós de motor e ambiente existem (AC 27)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "first keypress starts audio"`

**C36** - `engineFrequency(1000)` é 60, `engineFrequency(4000)` é 130, `engineFrequency(7000)` é 200 (AC 28)
Proof: `npx vitest run tests/unit/audioMap.test.ts -t "rpm maps linearly to 60..200 Hz"`

**C37** - Com áudio ativo, `__game.audio.gains` reporta `ambient` 0.3, `engine` 0.5 e `master` 1 (AC 29)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "gains are 0.3 ambient 0.5 engine"`

**C38** - Pressionar `M` uma vez leva `master` a 0, duas vezes a 1 (AC 30)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "M toggles master gain"`

### Portas transversais

**C39** - Nenhum arquivo em `src/world/CityGenerator.ts`, `src/vehicle/drivetrain.ts`, `src/core/FixedStepper.ts`, `src/core/input.ts`, `src/camera/chaseMath.ts`, `src/hud/format.ts`, `src/hud/minimapMath.ts`, `src/audio/audioMap.ts` importa `three` ou `@dimforge/rapier3d-compat` (door 1)
Proof: `npx vitest run tests/unit/purity.test.ts -t "pure modules do not import three or rapier"`

**C40** - `__game.car.wheelCount` é 4 e `__game.car.controllerKind` é `"DynamicRayCastVehicleController"` (door 2)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "rapier vehicle controller with 4 wheels"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| keymap (7 keys) | C15, table-driven over all 7 | - |
| gear bands (7 gears) | C27, table-driven over all 7 | - |
| steering samples (4 speeds) | 0 C6 · 75 C6 · 150 C6 · 200 C6 | - |
| throttle/brake regimes (4) | forward throttle C1 · forward brake C2 · reverse C4 · handbrake C7 | - |
| speed cap edges (2) | 219 C8 · 220 C8 | - |
| stepper cases (3) | 0.05 C12 · 0.2 C12 · 0.01 C12 | - |
| neon palette (4 colors) | C19, table-driven over all 4 | - |
| loader outcomes (3) | glb ok C1 · glb fails C33 · webgl2 missing C32 | - |
| overlays (2) | loading C31 · error C32 | - |
| audio gains (3) | ambient C37 · engine C37 · master C37 | - |
| mute transitions (2) | 1→0 C38 · 0→1 C38 | - |
| rpm samples (4) | 0 C28 · 15 C28 · 29.9 C28 · 30 C28 | - |
| landing doors (9) | 1 C39 · 2 C40 · 3 C24 · 4 C34 · 5 C12 · 6 C16 · 7 C33 · 8 C35 · 9 C25 | - |
| startup config: debug handle (1 assembly) | `src/main.ts` C34 | - |
| pure modules (8 files) | C39, table-driven over all 8 | - |

- Claims cruzando a fronteira browser (Playwright): C1, C3, C5, C9, C10, C11, C21-C24, C26, C31-C33, C35, C37, C38, C40
- Nenhum outro check afirma mais do que o caso único que sua prova exercita

## Test policy

Repositório novo: nenhuma diretriz existe. Estas linhas são a barra deste build. Não existe
análogo no repositório para citar como precedente.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence (forma prevista do código; recontada pelo Verifier sobre o diff):

- `src/vehicle/drivetrain.ts`: tabela de 7 marchas, 4 regimes de força, 2 arestas de cap, decaimento de direção → decides, reached across a boundary (teclas → Rapier); provas próprias C2, C4, C6-C8, C27, C28; fronteira C1, C3, C5
- `src/core/input.ts`: tabela de 7 teclas → decides; prova própria C15
- `src/core/FixedStepper.ts`: 2 pontos de decisão (acumular, cap de 5) → decides; C12
- `src/camera/chaseMath.ts`: 0 ramos, 2 fórmulas → decides (valores); C13, C14
- `src/world/CityGenerator.ts`: contagens e limites por quarteirão, paleta, espaçamento → decides; C16-C20
- `src/core/Loader.ts`: 3 desfechos (ok, glb falha, sem WebGL2) → decides, reached across a boundary; fronteira C31-C33; sem camada própria porque cada desfecho só é observável no browser
- `src/hud/format.ts`, `src/hud/minimapMath.ts`, `src/audio/audioMap.ts`: mapeamentos com 1-2 ramos → decides; C25, C29, C30, C36
- `src/vehicle/Car.ts`, `src/world/CityScene.ts`, `src/camera/ChaseCamera.ts`, `src/hud/Hud.ts`, `src/audio/Engine.ts`, `src/core/GameLoop.ts`: encaminham para three/Rapier/DOM sem decidir → instrumentation; cobertos pelas provas Playwright dos consumidores

Cost: 22 provas unitárias em 9 arquivos de teste e 18 provas Playwright em 4 arquivos. Sem
estas linhas, a tabela de marchas e o mapa de teclas seriam provados só pelo caminho que o
Playwright atravessa.

## Swept

- validation: C6, C8, C17, C18 - limites de direção, cap de velocidade, faixas do gerador
- failure modes: C32, C33 - sem WebGL2 e GLB ausente
- idempotency: n/a - nenhuma operação é repetível com efeito; reset (`R`) é idempotente por construção e coberto por C11
- authorization: n/a - jogo local, sem usuários nem rotas
- concurrency: C12 - o acumulador é o único ponto onde ordem importa (física vs render); sem workers, sem rede
- data lifecycle: n/a - nada é persistido neste sub-projeto (plan `## Relations`)
- dependency failure: C33 - GLB; o WASM do Rapier falhando cai no mesmo overlay de C32 (mesma mensagem genérica de erro), sem check próprio por não ser reproduzível sem alterar o bundle
- state transitions: C11, C27, C35, C38 - reset, marchas, idle→running do áudio, mute
- observability: C33 - `console.warn` no fallback; `__game` (C34) é a superfície de observação em DEV; sem métricas em produção por decisão do plano

## Handoff

- S1 = 11k (core, vehicle, camera); S2 = +8k (world) → 19k; S3 = +6k (hud) → 25k; S4 = +3k (audio) → 28k; config e testes ≈ +8k → 36k total, abaixo do budget de 150k - one builder
