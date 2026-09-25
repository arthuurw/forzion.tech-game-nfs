# Free-roam city verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 5f760df..c58edf6 (commit raiz incluído: toda a árvore em `HEAD` é o diff da feature)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Resumo: as 40 provas rodam e passam em `HEAD` (22 vitest + 18 Playwright, cada nome listado
individualmente na saída), cada check tem asserção localizada, e os 5 mutantes injetados foram
mortos. O verdict é FAIL porque o recálculo da cobertura a partir do código e do plano encontrou
membros sem prova (caminho de erro do boot em `src/main.ts:34-38`; desenho do minimapa em
`src/hud/Minimap.ts:27-43`) e duas linhas de `Test policy` não atendidas (`src/main.ts` como
entry point com um error path sem prova; `ChaseCamera.ts` e `Minimap.ts` sem prova de consumidor).
Nenhum check falhou; os gaps estão nas enumerações que os checks não cobriram.

Passo 5 (walk the flow with the user): não executado - o usuário não estava disponível nesta
rodada; nenhum item deste relatório depende de julgamento humano.

## Binding sources

O plano não marca nenhuma fonte como binding (`## Sources` lista brainstorm, rapier.rs e
threejs.org como referência, não como decisão). Nada a comparar neste passo.

## Checks

Comandos rodados em `HEAD` (c58edf6), uma invocação por alvo:

- **batch U**: `npx vitest run tests/unit --reporter=verbose -t "<22 nomes em alternação>"` -
  exit 0, `Test Files 10 passed (10)`, `Tests 22 passed (22)`; cada nome abaixo apareceu como
  linha `✓ <arquivo> > <describe> > <nome>`.
- **batch E**: `npx playwright test tests/e2e --reporter=line -g "<18 nomes em alternação>"` -
  exit 0, `18 passed (1.3m)`; cada nome apareceu como linha `[n/18] <arquivo>:<linha>:3 › <describe> › <nome>`.
- Existência: `rg -n "it\('|test\('" tests/unit tests/e2e` localizou os 40 nomes (mais 2 testes
  extra sem check: `A turns left`, `handbrake key reaches the car`). Todos os testes nasceram
  nesta feature (5f760df criou `tests/unit`, c58edf6 criou `tests/e2e`), então nenhuma prova
  resolve para teste pré-existente.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | W por 5 s (simulados) leva a >= 50 km/h | batch E · `[5/18] drive.spec.ts:20:3 › throttle reaches 50 kmh within 5s` | `tests/e2e/drive.spec.ts:21` `expect(await speedKmh(page)).toBeLessThan(1)`; `:23-25` `waitSimUntil(page, 'g.car.speedKmh >= 50', 5)` + `expect(reached).toBe(true)` | PASS |
| C2 | S acima de 1 km/h: freio > 0 nas 4 rodas, motor 0 | batch U · `✓ drivetrain > brake when moving forward` | `tests/unit/drivetrain.test.ts:16-19` `expect(cmd.engineForce).toBe(0)`, `expect(cmd.brakeFront).toBeGreaterThan(0)`, `expect(cmd.brakeRear).toBeGreaterThan(0)`, `expect(cmd.brakeFront).toBe(cmd.brakeRear)` (amostra a 40 km/h) | PASS |
| C3 | W 3 s depois S 1 s termina mais lento | batch E · `[6/18] drive.spec.ts:29:3 › brake reduces speed` | `tests/e2e/drive.spec.ts:34-35` `expect(before).toBeGreaterThan(20)`, `expect(after).toBeLessThan(before)` | PASS |
| C4 | S a <= 1 km/h: motor negativo; cortado além de 30 km/h de ré | batch U · `✓ drivetrain > reverse below 1 kmh and capped at 30` | `tests/unit/drivetrain.test.ts:24-27` `computeDrive({brake}, 1).engineForce` `toBeLessThan(0)`, idem em 0 e -29; `computeDrive({brake}, -31).engineForce` `toBe(0)` (aresta exata -30 não amostrada; código corta em `speedKmh > -30`, `src/vehicle/drivetrain.ts:94`) | PASS |
| C5 | S por 5 s termina entre -30 e -5 km/h | batch E · `[7/18] drive.spec.ts:39:3 › reverse drives backward up to 30 kmh` | `tests/e2e/drive.spec.ts:44-45` `expect(speed).toBeLessThanOrEqual(-5)`, `expect(speed).toBeGreaterThanOrEqual(-30.5)` - tolerância de 0.5 km/h além do valor do check, não registrada no Handoff (precision gap) | PASS |
| C6 | Direção 0.5/0.325/0.15/0.15 rad a 0/75/150/200; A +, D - | batch U · `✓ drivetrain > steering angle decays with speed` | `tests/unit/drivetrain.test.ts:32-35` `steeringAngleFor(0|75|150|200)` `toBeCloseTo(0.5|0.325|0.15|0.15, 5)`; `:36-37` `computeDrive({steer: 1}, 0).steer` `toBeCloseTo(0.5)`, `steer: -1` → `-0.5` | PASS |
| C7 | Space: freio só traseiro, atrito traseiro 0.4 | batch U · `✓ drivetrain > handbrake brakes rear wheels and cuts rear grip to 0.4` | `tests/unit/drivetrain.test.ts:43-46` `expect(cmd.brakeFront).toBe(0)`, `expect(cmd.brakeRear).toBeGreaterThan(0)`, `expect(cmd.rearFrictionFactor).toBeCloseTo(0.4, 5)`, `computeDrive(idle, 60).rearFrictionFactor` `toBe(1)` | PASS |
| C8 | Motor 0 a >= 220 km/h, positivo a 219 | batch U · `✓ drivetrain > engine force cut at 220 kmh` | `tests/unit/drivetrain.test.ts:51-53` `computeDrive({throttle}, 219).engineForce` `toBeGreaterThan(0)`; `220` e `230` → `toBe(0)` | PASS |
| C9 | Contra prédio, centro do chassi fora da AABB | batch E · `[8/18] drive.spec.ts:62:3 › building blocks the chassis` | `tests/e2e/drive.spec.ts:75-77` `insideX = p.x > target.xMin && p.x < target.xMax` … `expect(insideX && insideZ).toBe(false)`; `:79` `expect(target.zMin - p.z).toBeLessThan(6)` (chegou perto) | PASS |
| C10 | Parede invisível: \|x\|,\|z\| <= 202 | batch E · `[9/18] drive.spec.ts:83:3 › invisible wall keeps chassis inside city` | `tests/e2e/drive.spec.ts:87-89` `expect(Math.abs(p.x)).toBeLessThanOrEqual(202)`, `expect(Math.abs(p.z)).toBeLessThanOrEqual(202)`, `expect(p.x).toBeGreaterThan(195)` | PASS |
| C11 | R: rotação identidade, +1 m em y (± 0.05), velocidades < 0.01 | batch E · `[10/18] drive.spec.ts:93:3 › reset puts car upright` | `tests/e2e/drive.spec.ts:100-106` `Math.abs(snap.rotation.x|y|z)` `toBeLessThan(0.01)`, `snap.rotation.w` `toBeGreaterThan(0.99)`, `snap.position.y` `toBeCloseTo(before.y + 1, 1)`, `Math.hypot(linvel)`/`Math.hypot(angvel)` `toBeLessThan(0.01)` | PASS |
| C12 | Acumulador: 0.05→3 passos resto 0; 0.2→5 resto 0; 0.01→0 resto 0.01 | batch U · `✓ FixedStepper > steps at 1/60 with a cap of 5` | `tests/unit/fixedStepper.test.ts:8-17` `a.advance(0.05)` `toBe(3)` + `a.accumulator` `toBeCloseTo(0)`; `b.advance(0.2)` `toBe(5)` + `toBeCloseTo(0)`; `c.advance(0.01)` `toBe(0)` + `toBeCloseTo(0.01)`; `:19` `a.step` `toBeCloseTo(1/60, 9)` | PASS |
| C13 | Alvo (0,2.5,-6) olhando (0,1,0) em heading 0; (-6,2.5,0) em π/2 | batch U · `✓ chase camera math > target is 6 m behind and 2.5 m above along heading` | `tests/unit/chaseCamera.test.ts:8-11` `t0.position.x|y|z` `toBeCloseTo(0|2.5|-6)`, `t0.lookAt` `toEqual({x:0,y:1,z:0})`; `:14-16` `t1.position.x|y|z` `toBeCloseTo(-6|2.5|0)` | PASS |
| C14 | Suavização `1 - exp(-5·dt)` | batch U · `✓ chase camera math > smoothing follows 1 - exp(-5 dt)` | `tests/unit/chaseCamera.test.ts:21` `smoothingFactor(0.1)` `toBeCloseTo(1 - Math.exp(-0.5), 6)`; `:22-23` `smoothingFactor(0)` `toBe(0)`, `smoothingFactor(10)` `toBeCloseTo(1)` (o texto do check diz "50 %" e depois fixa 0.393; o teste afirma a fórmula fixada) | PASS |
| C15 | 7 teclas → 7 campos; tecla desconhecida não altera | batch U · `✓ input keymap > keymap table` | `tests/unit/input.test.ts:8-14` tabela `KeyW→throttle … KeyM→mute`; `:16` `expect(table.length).toBe(7)`; `:20` `expect(read(down)).toBe(expected)`; `:22` `expect(up).toEqual(createInputState())`; `:25-26` `applyKey(…, 'KeyQ', true)` `toEqual(createInputState())` | PASS |
| C16 | `generateCity(1337)` idêntico duas vezes; 1 ≠ 2 | batch U · `✓ CityGenerator > deterministic by seed` | `tests/unit/cityGenerator.test.ts:7` `JSON.stringify(generateCity(1337))` `toBe(JSON.stringify(generateCity(1337)))`; `:8` `generateCity(1)` `.not.toBe(generateCity(2))` | PASS |
| C17 | 64 quarteirões 40 m, ruas 12 m, bounds ±202 | batch U · `✓ CityGenerator > 8x8 grid of 40 m blocks with 12 m streets` | `tests/unit/cityGenerator.test.ts:14-17` `city.blocks.length` `toBe(64)`, `blockSize` `toBe(40)`, `streetWidth` `toBe(12)`, `bounds` `toBe(202)`; `:20-29` 8 xs/zs, passo `toBeCloseTo(52)`, extremos `±182` | PASS |
| C18 | 1-4 prédios por quarteirão, altura [10,60], base dentro | batch U · `✓ CityGenerator > buildings per block within bounds` | `tests/unit/cityGenerator.test.ts:36-37` `block.buildings.length` `>= 1`, `<= 4`; `:40-41` `b.height` `>= 10`, `<= 60`; `:42-45` `b.x ± b.width/2` e `b.z ± b.depth/2` dentro de `block ± half` | PASS |
| C19 | >= 1 letreiro por quarteirão; cores na paleta de 4 | batch U · `✓ CityGenerator > neon signs use the 4-color palette` | `tests/unit/cityGenerator.test.ts:52` `[...NEON_PALETTE]` `toEqual(['#ff2d95','#00e5ff','#b026ff','#ffd400'])`; `:57` `block.signs.length` `>= 1`; `:59` `palette.has(s.color)` `toBe(true)`; `:63` `used.size` `toBe(4)` | PASS |
| C20 | Postes a cada 20 m nos dois lados; total = 2 × ruas × floor(L/20) | batch U · `✓ CityGenerator > lamp posts every 20 m on both sides` | `tests/unit/cityGenerator.test.ts:71-72` `expected = 2 * (2 * 7) * Math.floor(404 / 20)`, `city.lamps.length` `toBe(expected)`; `:81` `groups.size` `toBe(28)`; `:84` `coords.length` `toBe(20)`; `:86` `coords[i] - coords[i-1]` `toBeCloseTo(20, 2)` | PASS |
| C21 | `renderer.info.render.calls` <= 60 | batch E · `[15/18] render.spec.ts:11:3 › draw calls at most 60` | `tests/e2e/render.spec.ts:13-14` `expect(calls).toBeGreaterThan(0)`, `expect(calls).toBeLessThanOrEqual(60)` | PASS |
| C22 | Letreiro e janela com emissiveIntensity >= 2 | batch E · `[16/18] render.spec.ts:18:3 › neon emissive intensity at least 2` | `tests/e2e/render.spec.ts:20-22` `m.windowEmissiveIntensity` `toBeGreaterThanOrEqual(2)`, `m.signEmissiveIntensities.length` `toBe(4)`, cada `v` `toBeGreaterThanOrEqual(2)` | PASS |
| C23 | Rua roughness <= 0.25; `scene.environment` não nulo | batch E · `[17/18] render.spec.ts:26:3 › wet road material and environment map` | `tests/e2e/render.spec.ts:29-30` `expect(roughness).toBeLessThanOrEqual(0.25)`, `expect(hasEnv).toBe(true)` | PASS |
| C24 | Composer com UnrealBloomPass habilitado; toneMapping ACES | batch E · `[18/18] render.spec.ts:34:3 › bloom pass and ACES tone mapping` | `tests/e2e/render.spec.ts:39-41` `expect(info.passes).toContain('UnrealBloomPass')`, `expect(info.bloomEnabled).toBe(true)`, `expect(info.aces).toBe(true)` | PASS |
| C25 | `formatSpeed` 13.9→"50", -2.0→"7", 0.27→"1" | batch U · `✓ hud format > speed in kmh as integer` | `tests/unit/hudFormat.test.ts:7-9` `formatSpeed(13.9)` `toBe('50')`, `formatSpeed(-2.0)` `toBe('7')`, `formatSpeed(0.27)` `toBe('1')` | PASS |
| C26 | HUD mostra o mesmo valor que `speedKmh` arredondado | batch E · `[11/18] hud.spec.ts:6:3 › speed label matches car state` | `tests/e2e/hud.spec.ts:15` `Number(label)` `toBeGreaterThan(10)`; `:17` `Math.abs(Number(label) - Math.round(Math.abs(kmh)))` `toBeLessThanOrEqual(3)` - o check diz "mesmo valor", o teste tolera 3 km/h (precision gap: o check não fixa em que frame a amostra é lida) | PASS |
| C27 | 7 faixas de marcha, 9 amostras | batch U · `✓ drivetrain > gear bands` | `tests/unit/drivetrain.test.ts:58-68` tabela `[-5,-1],[0,1],[29.9,1],[30,2],[60,3],[95,4],[130,5],[170,6],[200,6]`; `:70` `expect(gearFor(kmh)).toBe(gear)`; `:72` `new Set(...).size` `toBe(7)` | PASS |
| C28 | RPM 1000/4000/6980/1000 a 0/15/29.9/30; sempre em [1000,7000] | batch U · `✓ drivetrain > rpm within gear band` | `tests/unit/drivetrain.test.ts:77-80` `rpmFor(0|15|29.9|30)` `toBeCloseTo(1000|4000|6980|1000, 3)`; `:81-85` varredura -50..250 `rpm >= 1000` e `<= 7000` | PASS |
| C29 | -1 → "R"; barra = (rpm-1000)/6000 × 100 % | batch U · `✓ hud format > gear label and rpm bar width` | `tests/unit/hudFormat.test.ts:15-17` `gearLabel(-1)` `toBe('R')`, `gearLabel(1)` `toBe('1')`, `gearLabel(6)` `toBe('6')`; `:18-20` `rpmBarWidth(1000|4000|7000)` `toBeCloseTo(0|50|100)` | PASS |
| C30 | Carro → (80,80); +160 m x → x=160; -160 m z → y=0; canvas 160 px | batch U · `✓ minimap math > 320 m window into 160 px` | `tests/unit/minimap.test.ts:7-8` `MINIMAP_SIZE_PX` `toBe(160)`, `MINIMAP_WINDOW_M` `toBe(320)`; `:10-12` `worldToMinimap(10,-40,car)` `toEqual({x:80,y:80})`, `(170,-40)` → `{x:160,y:80}`, `(10,-200)` → `{x:80,y:0}` - "o canvas tem 160 × 160 px" é afirmado sobre a constante, não sobre o `<canvas>` (level gap; ver Coverage) | PASS |
| C31 | Overlay `Carregando...` visível antes de ready, `display: none` depois | batch E · `[12/18] hud.spec.ts:21:3 › loading overlay shows then hides` | `tests/e2e/hud.spec.ts:24-25` `expect(loading).toBeVisible()`, `toContainText('Carregando...')`; `:27-28` `expect(loading).toBeHidden()`, `toHaveCSS('display', 'none')`; `:29` `#hud` `toBeVisible()` | PASS |
| C32 | Sem WebGL2: overlay `Seu navegador não suporta WebGL2`, `__game` indefinido | batch E · `[13/18] hud.spec.ts:33:3 › webgl2 missing shows error overlay` | `tests/e2e/hud.spec.ts:43-44` `expect(error).toBeVisible()`, `toHaveText('Seu navegador não suporta WebGL2')`; `:46-47` `hasGame = __game !== undefined` → `expect(hasGame).toBe(false)`; `:48` `#loading` `toBeHidden()` | PASS |
| C33 | GLB abortado: `console.warn` com `/models/car.glb`, `placeholder` true, >= 50 km/h em 5 s | batch E · `[14/18] hud.spec.ts:52:3 › missing glb falls back to box chassis` | `tests/e2e/hud.spec.ts:60` `warnings.some((w) => w.includes('/models/car.glb'))` `toBe(true)`; `:62` `expect(placeholder).toBe(true)`; `:65-67` `waitSimUntil(page, 'g.car.speedKmh >= 50', 5)` → `expect(reached).toBe(true)` | PASS |
| C34 | `exposeDebug` só define `__game` com `DEV: true` | batch U · `✓ exposeDebug > debug handle only in DEV` | `tests/unit/exposeDebug.test.ts:11` `expect(prod.__game).toBeUndefined()`; `:15` `expect(dev.__game).toBe(game)`; montagem real lida em `src/main.ts:40` `exposeDebug(import.meta.env, game.debugHandle(), window …)` | PASS |
| C35 | `audio.state` idle → running na 1ª tecla; nós existem | batch E · `[1/18] audio.spec.ts:10:3 › first keypress starts audio` | `tests/e2e/audio.spec.ts:11` `expect(… audio.state).toBe('idle')`; `:13` `waitForFunction(… audio.state === 'running')`; `:15-16` `gains.engine` `toBeGreaterThan(0)`, `gains.ambient` `toBeGreaterThan(0)` (existência dos nós provada indiretamente: `gains()` devolve 0 quando o nó é nulo, `src/audio/AudioEngine.ts:71-72`) | PASS |
| C36 | `engineFrequency` 1000→60, 4000→130, 7000→200 | batch U · `✓ audio map > rpm maps linearly to 60..200 Hz` | `tests/unit/audioMap.test.ts:7-9` `engineFrequency(1000|4000|7000)` `toBeCloseTo(60|130|200, 6)` | PASS |
| C37 | Ganhos ambient 0.3, engine 0.5, master 1 | batch E · `[2/18] audio.spec.ts:20:3 › gains are 0.3 ambient 0.5 engine` | `tests/e2e/audio.spec.ts:24-26` `gains.ambient` `toBeCloseTo(0.3, 6)`, `gains.engine` `toBeCloseTo(0.5, 6)`, `gains.master` `toBeCloseTo(1, 6)` | PASS |
| C38 | M: master 1→0, depois 0→1 | batch E · `[3/18] audio.spec.ts:30:3 › M toggles master gain` | `tests/e2e/audio.spec.ts:34` após 1º M `.master` `toBeCloseTo(0, 6)`; `:36` após 2º M `.master` `toBeCloseTo(1, 6)` | PASS |
| C39 | 8 módulos puros não importam three/rapier | batch U · `✓ pure modules > pure modules do not import three or rapier` | `tests/unit/purity.test.ts:21` `PURE_MODULES.length` `toBe(8)`; `:24` `FORBIDDEN.test(source)` `toBe(false)` com `FORBIDDEN = /from\s+['"](three|@dimforge\/rapier3d-compat)(\/[^'"]*)?['"]/` (`:17`) - não pega `import 'three'` sem `from` nem `import()` dinâmico (assertion fraca, ver findings) | PASS |
| C40 | 4 rodas; controlador `DynamicRayCastVehicleController` | batch E · `[4/18] drive.spec.ts:10:3 › rapier vehicle controller with 4 wheels` | `tests/e2e/drive.spec.ts:15-16` `expect(info.wheelCount).toBe(4)`, `expect(info.controllerKind).toBe('DynamicRayCastVehicleController')` (nome vem de `instanceof` em `src/core/Game.ts:174-176`, como o Handoff declara) | PASS |

Swept rows que resolvem para constraint existente, relidas contra o código:

- validation (C6, C8, C17, C18): presentes em `src/vehicle/drivetrain.ts:75-76` (decaimento), `:84` (`speedKmh < MAX_SPEED_KMH`), `src/world/CityGenerator.ts:9-13` (grid/extent), `:117` (`10 + rng() * 50`).
- failure modes (C32, C33): `src/main.ts:20-23`, `src/core/Loader.ts:31-37`.
- concurrency (C12): `src/core/FixedStepper.ts:23-30`.
- dependency failure: a linha diz que o WASM do Rapier falhando "cai no mesmo overlay de C32 (mesma mensagem genérica de erro)". Mesmo overlay sim (`#error` via `showError`, `src/main.ts:12-17`); mesma mensagem não: `src/main.ts:36` mostra `Falha ao iniciar o jogo: <erro>`, enquanto C32 mostra `Seu navegador não suporta WebGL2` (`:21`). A constraint citada está parcialmente errada - finding, tratado em Coverage.
- state transitions (C11, C27, C35, C38) e observability (C33 `console.warn` em `src/core/Loader.ts:35`): presentes.

## Coverage

Cada conjunto foi recontado a partir da autoridade indicada (código ou linhas do plano), não da
tabela do autor. Conjuntos 16-17 não tinham linha na tabela de `checks.md`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| keymap (7) | `src/core/input.ts:19-27` `KEYMAP` (KeyW, KeyS, KeyA, KeyD, Space, KeyR, KeyM) | C15, tabela `tests/unit/input.test.ts:8-14` sobre as 7 + `table.length` `toBe(7)` | - |
| gear bands (7) | `src/vehicle/drivetrain.ts:42-49` (6 faixas) + `:56` (`-1`) | C27, tabela com 9 amostras cobrindo os 7 valores + `Set.size` `toBe(7)` | - |
| steering samples (4) | claim C6 (0, 75, 150, 200 km/h) | C6 `tests/unit/drivetrain.test.ts:32-35` | - |
| throttle/brake regimes (4) | `src/vehicle/drivetrain.ts:84` throttle · `:89` freio · `:94` ré · `:101` freio de mão | throttle C8 (camada) + C1 (fronteira) · freio C2 + C3 · ré C4 + C5 · freio de mão C7 | - |
| speed cap edges (2) | `src/vehicle/drivetrain.ts:84` `speedKmh < 220` | 219 C8 · 220 C8 (+230) | - |
| stepper cases (3) | `src/core/FixedStepper.ts:23` (loop) · `:27-30` (cap descarta) | 0.05 C12 · 0.2 C12 · 0.01 C12 (o clamp `:31` `accumulator < 0` é guarda sem caso próprio) | - |
| neon palette (4) | `src/world/CityGenerator.ts:17` `NEON_PALETTE` | C19 `toEqual([4 cores])` + `used.size` `toBe(4)` | - |
| boot/loader outcomes (4) | `src/main.ts:20-23` sem WebGL2 · `src/main.ts:27-33` ok · `src/core/Loader.ts:34-36` GLB falha · `src/main.ts:34-38` `catch` do boot (`Falha ao iniciar o jogo: …`) | sem WebGL2 C32 · ok C31/C1 · GLB falha C33 · catch do boot: nenhuma | `src/main.ts:34-38` catch do boot - a tabela do autor conta 3 desfechos; o Swept o descreve como "mesma mensagem" de C32, o que o código contradiz (`:36` vs `:21`); reproduzível em Playwright (ex.: `new Game` lançando por `#minimap` ausente, `src/core/Game.ts:82`) |
| overlays (2) | `index.html:11` `#loading` · `:16` `#error` | loading C31 · error C32 | - |
| audio gains (3) | `src/audio/AudioEngine.ts:25-26` master · `:37-38` engine · `:49-50` ambient | C37 (3 asserções) | - |
| mute transitions (2) | `src/audio/AudioEngine.ts:63-66` `toggleMute` | 1→0 C38 · 0→1 C38 | - |
| rpm samples (4) | claim C28 | 0 · 15 · 29.9 · 30 C28 + varredura | - |
| landing doors (9) | plano `## Landing` linhas 1-9 | 1 C39 · 2 C40 · 3 C24 · 4 C34 · 5 C12 · 6 C16 · 7 C33 · 8 C35 · 9 C25 (cada porta tem prova do seu núcleo; atributos finos sem asserção listados em findings) | - |
| startup config: debug handle (1 assembly) | `src/main.ts:40` `exposeDebug(import.meta.env, game.debugHandle(), window …)` lido diretamente | C34 (função) + montagem confirmada por leitura | - |
| pure modules (8) | `tests/unit/purity.test.ts:6-15` = os 8 arquivos nomeados em C39 (`src/core/exposeDebug.ts` também é puro mas não está na lista do check) | C39, tabela sobre os 8 | - |
| minimap elements (AC 23, 4) - sem linha na tabela do autor | `src/hud/Minimap.ts:13-14` canvas 160 · `src/hud/minimapMath.ts:7` janela 320 m · `src/hud/Minimap.ts:25-31` quarteirões desenhados · `:33-43` triângulo rotacionado por `-state.heading` | canvas: C30 só na constante `MINIMAP_SIZE_PX` (level gap: o `<canvas>` real não é lido) · janela C30 · quarteirões: nenhuma · triângulo/heading: nenhuma | `src/hud/Minimap.ts:27-31` desenho dos quarteirões e `:33-43` triângulo pelo heading - um `update()` vazio passa todos os checks |
| emissive materials (AC 17, 3) - sem linha na tabela do autor | `src/world/CityScene.ts:34` janela 2.0 · `:128` letreiro 3.0 · `:40` cabeça de poste 2.5 | janela C22 · letreiro C22 · poste: nenhuma (AC 17 nomeia "postes" mas limita ">= 2.0" a "elementos neon e janelas"; C22 não o inclui - precision gap, não membro sem prova) | - |

Claims cruzando a fronteira do browser (lista do autor: C1, C3, C5, C9-C11, C21-C24, C26,
C31-C33, C35, C37, C38, C40): confirmado, cada um tem prova Playwright acima. Nenhum check nomeia
status, rota ou shape de resposta que só tenha prova abaixo da fronteira, exceto a cláusula do
canvas em C30 (registrada acima).

## Test policy rows

Arquivos reclassificados sobre o diff; o autor não classificou `src/main.ts`,
`src/core/InputManager.ts`, `src/core/Game.ts`, `src/world/Environment.ts`, `src/hud/Minimap.ts`
nem `src/core/exposeDebug.ts`.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/vehicle/drivetrain.ts` · `src/core/Loader.ts` | drivetrain: fronteira C1, C3, C5 · camada própria C2, C4, C6-C8, C27, C28 (uma asserção por linha da tabela de decisão: 7 marchas, 4 regimes, 2 arestas, 4 amostras de direção). Loader: fronteira C31-C33; camada própria inexistente porque o módulo é só `RAPIER.init` + `GLTFLoader` (`src/core/Loader.ts:28,32`) | yes |
| Decides, not reached across a boundary | `src/core/input.ts` · `src/core/FixedStepper.ts` · `src/camera/chaseMath.ts` · `src/world/CityGenerator.ts` · `src/hud/format.ts` · `src/hud/minimapMath.ts` · `src/audio/audioMap.ts` · `src/core/exposeDebug.ts` | C15 (7 teclas + desconhecida) · C12 (acumular, cap) · C13, C14 · C16-C20 · C25, C29 · C30 · C36 · C34 (DEV true/false) | yes |
| Entry point that decides nothing | `src/main.ts` · `src/core/InputManager.ts` | main.ts na fronteira: entrada aceita C31; error paths: sem WebGL2 C32 (`src/main.ts:20-23`), `catch` do boot (`src/main.ts:34-38`) sem prova. InputManager: primeira tecla C35, teclas seguradas C1-C11, `event.repeat` ignorado (`src/core/InputManager.ts:39`) sem prova própria (pass-through) | no - `src/main.ts:34-38` é um error path do entry point sem prova na fronteira |
| Instrumentation, pass-throughs | `src/vehicle/Car.ts` · `src/world/CityScene.ts` · `src/world/Environment.ts` · `src/core/Game.ts` · `src/core/GameLoop.ts` · `src/hud/Hud.ts` · `src/audio/AudioEngine.ts` · `src/camera/ChaseCamera.ts` · `src/hud/Minimap.ts` | prova do consumidor: Car C1-C11, C40 · CityScene C21-C23 · Environment C23 · Game C21-C24 · GameLoop C1 (`simTime` avança) · Hud C26 (só `#speed`; `#gear` e `#rpm-fill` no DOM sem prova de fronteira) · AudioEngine C35, C37, C38 · ChaseCamera: nenhuma prova lê posição da câmera · Minimap: nenhuma prova lê o canvas | no - `src/camera/ChaseCamera.ts:21-27` e `src/hud/Minimap.ts:18-44` não são cobertos por prova de consumidor; um `update()` que não faça nada passa todas as 40 provas (constatado por inspeção; o cap de 5 mutantes já estava esgotado) |

## Faults injected

Baseline `git status --porcelain` da árvore real: vazio. Worktree de rascunho em
`<scratchpad>/verify-wt` (HEAD c58edf6) com junção para `node_modules`; cada mutação revertida
com `git checkout -- <arquivo>` antes da seguinte; worktree e junção removidos ao final;
porcelain final da árvore real: vazio (igual ao baseline). Provas rodadas de dentro do worktree,
uma invocação Playwright por vez.

| Mutation | Location | Killed |
| --- | --- | --- |
| `GEAR_BANDS` `[30, 60]` → `[31, 60]` (2ª marcha começa em 31 km/h) | `src/vehicle/drivetrain.ts:44` | yes - `npx vitest run tests/unit/drivetrain.test.ts -t "gear bands"` exit 1: `AssertionError: gear at 30 km/h: expected 1 to be 2` (C27) |
| `LAMP_SPACING` `20` → `21` | `src/world/CityGenerator.ts:14` | yes - `npx vitest run tests/unit/cityGenerator.test.ts -t "lamp posts every 20 m on both sides"` exit 1: `expected 532 to be 560` (C20) |
| `maxSteps` `5` → `6` | `src/core/FixedStepper.ts:16` | yes - `npx vitest run tests/unit/fixedStepper.test.ts -t "steps at 1/60 with a cap of 5"` exit 1: `expected 6 to be 5` (C12) |
| ramo de falha do GLB devolve `placeholder: false` em vez de `true` | `src/core/Loader.ts:36` | yes - `npx playwright test tests/e2e/hud.spec.ts -g "missing glb falls back to box chassis"` exit 1: `hud.spec.ts:62` `expect(placeholder).toBe(true)` Received: false (C33) |
| `reset()` levanta `t.y + 3` em vez de `t.y + 1` | `src/vehicle/Car.ts:176` | yes - `npx playwright test tests/e2e/drive.spec.ts -g "reset puts car upright"` exit 1: `drive.spec.ts:104` `toBeCloseTo(before.y + 1, 1)` Expected 1.5975 Received 3.5975 (C11) |

## Gate

`cd "C:/Users/arthu/.claude/skills/tlc-spec-lean/scripts" && python validate_verification.py free-roam-city --root "C:/Users/arthu/source/repos/Jogo"` - exit 1, 1 error(s), 0 warning(s). O único erro é o próprio verdict (substância, não formato):

```
  ERROR free-roam-city: verdict is FAIL - route the ranked gaps back as fixes, then re-verify

validate_verification: 1 error(s), 0 warning(s) across [free-roam-city]
```

Provas em `HEAD`: 22 unit passed, 0 failed · 18 e2e passed, 0 failed.

## Findings

Ranqueados; 1-3 sustentam o FAIL, os demais são precision gaps e asserções fracas que não
derrubam nenhum check mas merecem atenção do autor.

1. **Error path do boot sem prova** - `src/main.ts:34-38` mostra `Falha ao iniciar o jogo: …` no
   overlay `#error` quando `loadAssets`/`new Game` lançam. A tabela de cobertura do autor conta 3
   desfechos de loader; o código tem 4. O Swept o descreve como "mesma mensagem genérica de erro"
   de C32, o que o código contradiz. Pela própria linha de Test policy "Entry point that decides
   nothing → each error path", falta uma prova Playwright (o caminho é reproduzível fazendo
   `new Game` lançar, ex.: removendo `#minimap` antes do boot, `src/core/Game.ts:82`). Alternativa:
   corrigir o Swept e registrar explicitamente o desfecho como sem check, com o texto certo.
2. **Minimapa desenhado sem prova (AC 23)** - `src/hud/Minimap.ts:27-31` (quarteirões) e
   `:33-43` (triângulo rotacionado por `-state.heading`) não têm nenhuma asserção; C30 prova só
   a matemática e afirma "canvas 160 × 160 px" sobre a constante `MINIMAP_SIZE_PX`, não sobre o
   `<canvas>` (`index.html:30`, `src/hud/Minimap.ts:13-14`). Um `update()` vazio passa todos os
   checks. Falta pelo menos uma prova Playwright lendo o canvas (tamanho + pixels não-fundo no
   centro) ou expondo via `__game` a lista de retângulos/heading desenhados no último frame.
3. **`ChaseCamera.ts` sem prova de consumidor** - `src/camera/ChaseCamera.ts:21-27`; nenhuma prova
   lê posição da câmera (`__game` não a expõe). Uma câmera que não segue o carro passa as 40
   provas. A linha de Test policy "Instrumentation → covered by its consumer's proof" não é
   atendida. Mesmo padrão em `src/hud/Hud.ts:24-29`: `#gear` e `#rpm-fill` no DOM não são lidos
   por nenhuma prova (C29 prova só `format.ts`).
4. **C5 tolerância não declarada** - `tests/e2e/drive.spec.ts:45` aceita `-30.5` onde o check diz
   `-30`. Fisicamente um passo de 1/60 s a 2 × 2500 N / 1200 kg ultrapassa o corte em até ~0.25
   km/h, então o check deveria fixar a tolerância (como C11 e C20 fazem) em vez de o teste
   inventá-la.
5. **C26 tolerância não declarada** - `tests/e2e/hud.spec.ts:17` aceita diferença de até 3 km/h
   onde o check diz "mesmo valor"; o check não fixa em que frame a amostra do DOM e a do estado
   são lidas. Fixar a tolerância ou ler ambos dentro de um único `evaluate` após um frame.
6. **Portas do plano com atributos sem asserção** - porta 3: `UnrealBloomPass(0.8, 0.4, 0.7)` e
   ordem `RenderPass → Bloom → OutputPass` (`src/core/Game.ts:75-78`) só têm presença provada por
   C24; porta 6: seed padrão `1337` (`src/world/CityGenerator.ts:15`, usada em `src/core/Game.ts:61`
   `generateCity()`) nunca é afirmada - C16 chama `generateCity(1337)` explicitamente; porta 2:
   tração traseira (`src/vehicle/Car.ts:115-124` força só em `REAR`) sem asserção em nenhuma
   camada; porta 5: `world.timestep = 1/60` (`src/core/Game.ts:56`) sem asserção (C12 prova só o
   stepper); porta 8: tipos de nó (sawtooth → lowpass → gain, `src/audio/AudioEngine.ts:30-39`)
   sem asserção, C35 prova só `state` e ganhos > 0.
7. **C39 regex estreita** - `tests/unit/purity.test.ts:17` só detecta `from '...'`; `import 'three'`
   (efeito colateral) e `import('three')` dinâmico passariam. Cobrir `import\s+['"]` e `import\(`.
8. **C4 aresta exata** - `tests/unit/drivetrain.test.ts:24-27` amostra -29 e -31; o corte em
   `src/vehicle/drivetrain.ts:94` é `> -30` (inclusivo em -30) e o check diz "passa de 30" sem
   dizer se 30 exato ainda tem força. Fixar e amostrar -30.
9. **C14 texto do check** - o check diz "move a câmera 50 % da distância" e em seguida fixa a
   fórmula `1 - exp(-5·dt)` (≈ 0.393 em 0.1 s); o teste afirma a fórmula. Remover o "50 %" do
   check para não ler como dois valores.
10. **Domínio vs código** - o plano (`## Impact`) e C15 falam num campo `steer` em `InputState`;
    o código tem `steerLeft`/`steerRight` + `steerAxis()` (`src/core/input.ts:11-12, 49-51`). O
    teste afirma via `steerAxis`, semanticamente equivalente; alinhar o plano.
11. **AC 17 "postes"** - `src/world/CityScene.ts:40` cabeça de poste com emissive 2.5 sem prova;
    C22 cobre só janela e letreiro. Decidir se "elementos neon" inclui postes e, se sim, expor
    `lampEmissiveIntensity` em `__game.materials` e afirmar em C22.
