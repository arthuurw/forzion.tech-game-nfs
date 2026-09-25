# Free-roam city - checks

Profile: standard
Plan: `.specs/features/free-roam-city/plan.md`

## Intent

46 checks in 4 slices · 9 one-way doors · 0 open (C41-C45 adicionados na rodada 2 de verificação, C46 e endurecimentos de C39/C42/C44/C45 na rodada 3: lacunas de prova, nenhum check anterior enfraquecido)

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

**C4** - Com velocidade dianteira de 1 km/h ou menos, `S` produz força de motor negativa; a força é cortada a partir de -29.5 km/h (amostras: -29 negativa, -30 zero, -31 zero), garantindo que a ré nunca passe de 30 km/h mesmo com o overshoot de um passo (AC 3)
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

**C14** - Suavização com fator 5/s: com `dt` 0.1 a câmera percorre `1 - e^{-0.5}` ≈ 0.393 da distância até o alvo; fórmula fixada `lerp(current, target, 1 - exp(-5·dt))` (AC 11)
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

**C22** - Os materiais de letreiro, de janela e de cabeça de poste têm `emissiveIntensity` de 2.0 ou mais (AC 17)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "neon emissive intensity at least 2"`

**C23** - O material da rua tem `roughness` de 0.25 ou menos e `scene.environment` não é nulo (AC 18)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "wet road material and environment map"`

**C24** - O `EffectComposer` contém um `UnrealBloomPass` habilitado e `renderer.toneMapping` é `ACESFilmicToneMapping` (AC 19)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "bloom pass and ACES tone mapping"`

### S3 - HUD · 6 files · 22 KB · ~6k

**C25** - `formatSpeed(13.9)` retorna `"50"`, `formatSpeed(-2.0)` retorna `"7"` (módulo), `formatSpeed(0.27)` retorna `"1"` (m/s × 3.6 arredondado) (AC 20)
Proof: `npx vitest run tests/unit/hudFormat.test.ts -t "speed in kmh as integer"`

**C26** - O HUD no DOM mostra o valor de `__game.car.speedKmh` arredondado após 2 s segurando `W`, com tolerância de 3 km/h porque o DOM é escrito no frame anterior à leitura e a física pode ter avançado até 5 passos (AC 20)
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

**C39** - Nenhum arquivo em `src/world/CityGenerator.ts`, `src/vehicle/drivetrain.ts`, `src/core/FixedStepper.ts`, `src/core/input.ts`, `src/core/exposeDebug.ts`, `src/camera/chaseMath.ts`, `src/hud/format.ts`, `src/hud/minimapMath.ts`, `src/audio/audioMap.ts` importa `three` ou `@dimforge/rapier3d-compat` por `import ... from`, `import '...'`, `import(...)` ou `require(...)` (door 1)
Proof: `npx vitest run tests/unit/purity.test.ts -t "pure modules do not import three or rapier"`

**C40** - `__game.car.wheelCount` é 4 e `__game.car.controllerKind` é `"DynamicRayCastVehicleController"` (door 2)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "rapier vehicle controller with 4 wheels"`

### Rodada 2 - lacunas de prova apontadas pelo Verifier

**C41** - IF a montagem do jogo lança (ex.: `#minimap` ausente no DOM) THEN o overlay de erro mostra texto começando com `Falha ao iniciar o jogo:` e `__game` fica indefinido (AC 25 estendido; Swept dependency failure)
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "boot failure shows error overlay"`

**C42** - Após o primeiro frame, o `<canvas id="minimap">` real tem 160 × 160 px e contém pelo menos 10 pixels na cor do carro `#ff7a1a` numa janela de 20 px ao redor do centro e pelo menos 100 pixels na cor de quarteirão `#2b2d3d`; com o carro teleportado para heading π/2 (frente = +x do mundo), a ponta do triângulo fica à direita do centro (há pixels laranja com `x ≥ 84` e nenhum com `x < 74`; o vértice em 87 é antialiased) (AC 23)
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "minimap draws blocks and car"`

**C43** - Com o carro parado por 2 s de simulação, a posição da câmera está a menos de 0.1 m de `(x - 6·sin h, y + 2.5, z - 6·cos h)` calculado a partir de `__game.car` (AC 11; consumidor de `ChaseCamera`)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "camera sits 6 m behind and 2.5 m above"`

**C44** - Após 1.5 s segurando `W`, `#gear` mostra exatamente `gearLabel(__game.car.gear)` lido no mesmo `evaluate`, com `gear ≥ 2` (o carro já trocou de marcha), e a largura de `#rpm-fill` em % está entre 0 e 100 e a menos de 15 pontos de `rpmBarWidth(__game.car.rpm)` (tolerância porque o DOM é escrito no frame anterior) (AC 21, AC 22; consumidor de `Hud`)
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "gear and rpm bar match car state"`

**C45** - Portas com atributos literais: `UnrealBloomPass` com `strength 0.8, radius 0.4, threshold 0.7` na ordem `RenderPass, UnrealBloomPass, OutputPass`; `world.timestep` igual a 1/60 com tolerância 1e-6 (o Rapier guarda float32); `city.seed` igual a 1337; força de motor aplicada só nas rodas 2 e 3 (traseiras) enquanto `W` está pressionado (doors 2, 3, 5, 6)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "landing door literals"`

**C46** - Com o áudio ativo, o grafo do motor é `OscillatorNode(sawtooth) → BiquadFilterNode(lowpass) → GainNode` e o do ambiente é `AudioBufferSourceNode(loop) → BiquadFilterNode(lowpass) → GainNode`, ambos ligados ao `GainNode` master; sem elementos `<audio>` nem arquivos de som (door 8)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "synthesized audio graph"`

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
| boot/loader outcomes (4) | glb ok C1 · glb fails C33 · webgl2 missing C32 · game construction throws C41 | - |
| overlays (2) | loading C31 · error C32, C41 | - |
| minimap elements (4) | canvas 160 px C42 · window 320 m C30 · blocks drawn C42 · car triangle rotated by heading C42 (heading π/2) | - |
| audio graph nodes (6) | engine osc C46 · engine filter C46 · engine gain C46 · ambient source C46 · ambient filter C46 · ambient gain C46 | - |
| hud elements (3) | speed C26 · gear C44 · rpm bar C44 | - |
| bloom literals (3) | strength C45 · radius C45 · threshold C45 | - |
| audio gains (3) | ambient C37 · engine C37 · master C37 | - |
| mute transitions (2) | 1→0 C38 · 0→1 C38 | - |
| rpm samples (4) | 0 C28 · 15 C28 · 29.9 C28 · 30 C28 | - |
| landing doors (9) | 1 C39 · 2 C40, C45 · 3 C24, C45 · 4 C34 · 5 C12, C45 · 6 C16, C45 · 7 C33 · 8 C35, C46 · 9 C25 | - |
| startup config: debug handle (1 assembly) | `src/main.ts` C34 | - |
| pure modules (9 files) | C39, table-driven over all 9 | - |

- Claims cruzando a fronteira browser (Playwright): C1, C3, C5, C9, C10, C11, C21-C24, C26, C31-C33, C35, C37, C38, C40-C46
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
- `src/core/Loader.ts` + `src/main.ts`: 4 desfechos (ok, glb falha, sem WebGL2, montagem lança) → decides, reached across a boundary; fronteira C31-C33, C41; sem camada própria porque cada desfecho só é observável no browser
- `src/hud/format.ts`, `src/hud/minimapMath.ts`, `src/audio/audioMap.ts`: mapeamentos com 1-2 ramos → decides; C25, C29, C30, C36
- `src/vehicle/Car.ts`, `src/world/CityScene.ts`, `src/camera/ChaseCamera.ts`, `src/hud/Hud.ts`, `src/hud/Minimap.ts`, `src/audio/AudioEngine.ts`, `src/core/GameLoop.ts`: encaminham para three/Rapier/DOM sem decidir → instrumentation; cobertos pelas provas Playwright dos consumidores (Car: C1-C11, C40, C45; CityScene: C21-C23; ChaseCamera: C43; Hud: C26, C44; Minimap: C42; AudioEngine: C35, C37, C38; GameLoop: C1 via `simTime`)

Cost: 22 provas unitárias em 10 arquivos de teste e 24 provas Playwright em 4 arquivos. Sem
estas linhas, a tabela de marchas e o mapa de teclas seriam provados só pelo caminho que o
Playwright atravessa.

## Swept

- validation: C6, C8, C17, C18 - limites de direção, cap de velocidade, faixas do gerador
- failure modes: C32, C33, C41 - sem WebGL2, GLB ausente, montagem do jogo lança
- idempotency: n/a - nenhuma operação é repetível com efeito; reset (`R`) é idempotente por construção e coberto por C11
- authorization: n/a - jogo local, sem usuários nem rotas
- concurrency: C12 - o acumulador é o único ponto onde ordem importa (física vs render); sem workers, sem rede
- data lifecycle: n/a - nada é persistido neste sub-projeto (plan `## Relations`)
- dependency failure: C33 - GLB; qualquer outra falha antes do primeiro frame (WASM do Rapier, montagem da cena) cai no `catch` do boot com a mensagem `Falha ao iniciar o jogo: <erro>`, provado por C41
- state transitions: C11, C27, C35, C38 - reset, marchas, idle→running do áudio, mute
- observability: C33 - `console.warn` no fallback; `__game` (C34) é a superfície de observação em DEV; sem métricas em produção por decisão do plano

## Handoff

- S1 = 11k (core, vehicle, camera); S2 = +8k (world) → 19k; S3 = +6k (hud) → 25k; S4 = +3k (audio) → 28k; config e testes ≈ +8k → 36k total, abaixo do budget de 150k - one builder

- **Boundary:** C1-C40 fechados (commits `5f760df` + o commit da integração)
- **Settled mid-build:** (autor, antes de qualquer código) C28 corrigido de 7000 para 6980 RPM a 29.9 km/h - erro de aritmética do próprio check. "Segurar por N s" em C1, C3, C5, C9, C10 e C33 é lido como N segundos de **simulação** (`__game.simTime`), porque em headless o acumulador limita 5 passos por frame e 1 s de relógio vale menos de 1 s de física; o check é sobre a dinâmica do carro, não sobre a GPU. O nome da classe do controlador (C40) é verificado por `instanceof`, porque o bundle compat do Rapier é minificado. Nenhum check foi enfraquecido.
- **Rodada 2 (após FAIL do Verifier):** C41-C45 adicionados como provas novas; C4 endurecido (corte da ré em -29.5 km/h para nunca passar de 30); C14 e C26 tiveram o texto tornado preciso (tolerâncias declaradas); C22 passou a cobrir a cabeça do poste; C39 passou a cobrir `import '...'`, `import()` e `require()`. Plano `## Impact` corrigido: `InputState` guarda `steerLeft`/`steerRight`, e `steerAxis()` deriva -1/0/+1.
- **Rodada 3 (pendências residuais do PASS):** C42 afirma a rotação do triângulo (heading π/2); C44 compara `#gear` com `gearLabel(gear)` lido junto, sem valor fixo; C45 declara a tolerância float32 do timestep; C39 inclui `exposeDebug.ts` (9 módulos puros); C46 novo prova o grafo de áudio da porta 8.
- **Superseded (2026-09-25, feature `engine-sound`):** C37 (ganhos 0.3/0.5) → `engine-sound` C5 (0.12 ambiente, 0.06 marcha lenta / 0.15 acelerando); C46 (grafo com um oscilador) → `engine-sound` C4 (três osciladores + tremolo + compressor, arestas registradas). C36 e C38 continuam válidos e são reutilizados lá.
- **Abandoned:** `frictionSlip` 2.5 e força de motor 9000 N/roda - o carro empinava (rodas dianteiras sem contato) e não virava; ficou 10 (padrão do Rapier) e 4000 N com lastro baixo no chassi.
