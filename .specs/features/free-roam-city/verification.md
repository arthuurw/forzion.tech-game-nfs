# Free-roam city verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 5f760df..181fd5d (fix: c58edf6..181fd5d)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Resumo: rodada escopada pelo diff do fix (`git diff c58edf6..181fd5d`: `src/core/Game.ts`,
`src/vehicle/drivetrain.ts`, `tests/e2e/{drive,hud,render}.spec.ts`,
`tests/unit/{drivetrain,purity}.test.ts`, `checks.md`, `plan.md`) e pelos três gaps ranqueados da
rodada 1 (catch do boot sem prova; minimapa sem prova; `ChaseCamera`/`Minimap`/`Hud` sem prova de
consumidor). As 45 provas rodaram em `HEAD` 181fd5d e passaram (22 vitest + 25 Playwright, cada
nome listado individualmente); cada check tem asserção localizada; os 3 gaps da rodada 1 têm agora
prova Playwright (C41, C42, C43, C44) e literal das portas (C45); as 2 linhas de `Test policy`
não atendidas na rodada 1 estão atendidas; 6 mutantes novos injetados nas superfícies criadas
pelo fix, 6 mortos (os 5 da rodada 1 carregados). Nenhuma linha contradiz o PASS. Os precision
gaps residuais estão em `## Findings`.

Passo 1 (binding sources): o plano não marca nenhuma fonte como binding - nada a comparar.
Passo 5 (walk the flow with the user): usuário indisponível nesta rodada - não executado; nenhum
item deste relatório depende de julgamento humano.

Regra de carry: uma linha é `carried from c58edf6` só quando nem o arquivo de teste nem o arquivo
fonte que ela cita aparecem em `git diff --name-only c58edf6..181fd5d`. Arquivos de teste não
tocados: `tests/unit/{audioMap,chaseCamera,cityGenerator,exposeDebug,fixedStepper,hudFormat,input,minimap}.test.ts`,
`tests/e2e/audio.spec.ts`, `tests/e2e/helpers.ts`. Fontes tocadas: só `src/core/Game.ts` e
`src/vehicle/drivetrain.ts`. Checks carregados: C12, C13, C14, C15, C16-C20, C25, C29, C30, C34,
C35-C38 (18). Checks com citação refrescada em 181fd5d: os outros 27 (C1-C11, C21-C24, C26-C28,
C31-C33, C39-C45).

## Binding sources

O plano não marca nenhuma fonte como binding (`## Sources` lista brainstorm, rapier.rs e
threejs.org como referência, não como decisão). Nada a comparar neste passo (verified at 181fd5d:
o fix não tocou `## Sources`).

## Checks

Comandos rodados em `HEAD` (181fd5d), uma invocação por alvo, sem filtro de nome (suíte inteira):

- **batch U**: `npx vitest run tests/unit --reporter=verbose` - exit 0, `Test Files 10 passed (10)`,
  `Tests 22 passed (22)`; cada nome abaixo apareceu como linha `✓ <arquivo> > <describe> > <nome>`.
- **batch E**: `npx playwright test tests/e2e --reporter=line` - exit 0, `25 passed (1.9m)`; cada
  nome apareceu como linha `[n/25] <arquivo>:<linha>:3 › <describe> › <nome>`.
- Existência: `rg -n "test\(|expect\(" tests/e2e/{hud,render,drive}.spec.ts` e
  `rg -n "it\(|expect\(" tests/unit/{drivetrain,purity}.test.ts` localizaram os 27 nomes refrescados
  (5 novos: `boot failure shows error overlay` hud.spec.ts:83, `minimap draws blocks and car` :99,
  `gear and rpm bar match car state` :126, `camera sits 6 m behind and 2.5 m above` render.spec.ts:46,
  `landing door literals` :62). Os 18 carregados foram localizados na rodada 1 em arquivos que o
  fix não tocou. 2 testes extra sem check continuam (`A turns left`, `handbrake key reaches the car`).
  Todos os testes nasceram nesta feature (5f760df/c58edf6/181fd5d); nenhuma prova resolve para
  teste pré-existente.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | W por 5 s (simulados) leva a >= 50 km/h | batch E · `[5/25] drive.spec.ts:20:3 › throttle reaches 50 kmh within 5s` | verified at 181fd5d · `tests/e2e/drive.spec.ts:21` `expect(await speedKmh(page)).toBeLessThan(1)`; `:23-25` `waitSimUntil(page, 'g.car.speedKmh >= 50', 5)` + `expect(reached).toBe(true)` | PASS |
| C2 | S acima de 1 km/h: freio > 0 nas 4 rodas, motor 0 | batch U · `✓ drivetrain > brake when moving forward` | verified at 181fd5d · `tests/unit/drivetrain.test.ts:16-19` `expect(cmd.engineForce).toBe(0)`, `expect(cmd.brakeFront).toBeGreaterThan(0)`, `expect(cmd.brakeRear).toBeGreaterThan(0)`, `expect(cmd.brakeFront).toBe(cmd.brakeRear)` | PASS |
| C3 | W 3 s depois S 1 s termina mais lento | batch E · `[6/25] drive.spec.ts:29:3 › brake reduces speed` | verified at 181fd5d · `tests/e2e/drive.spec.ts:34-35` `expect(before).toBeGreaterThan(20)`, `expect(after).toBeLessThan(before)` | PASS |
| C4 | S a <= 1 km/h: motor negativo; corte a partir de -29.5 (amostras -29 neg, -30 zero, -31 zero) | batch U · `✓ drivetrain > reverse below 1 kmh and capped at 30` | verified at 181fd5d · `tests/unit/drivetrain.test.ts:24-26` `computeDrive({brake}, 1).engineForce`, idem em `0` e `-29`, `toBeLessThan(0)`; `:27` `computeDrive({brake}, -30).engineForce` `toBe(0)`; `:28` `-31` → `toBe(0)`; código `src/vehicle/drivetrain.ts:32` `REVERSE_CUTOFF_KMH = MAX_REVERSE_KMH - 0.5`, `:96` `speedKmh > -REVERSE_CUTOFF_KMH` | PASS |
| C5 | S por 5 s termina entre -30 e -5 km/h | batch E · `[7/25] drive.spec.ts:39:3 › reverse drives backward up to 30 kmh` | verified at 181fd5d · `tests/e2e/drive.spec.ts:44-45` `expect(speed).toBeLessThanOrEqual(-5)`, `expect(speed).toBeGreaterThanOrEqual(-30)` (tolerância -30.5 da rodada 1 removida; limite agora igual ao check) | PASS |
| C6 | Direção 0.5/0.325/0.15/0.15 rad a 0/75/150/200; A +, D - | batch U · `✓ drivetrain > steering angle decays with speed` | verified at 181fd5d · `tests/unit/drivetrain.test.ts:33-36` `steeringAngleFor(0)` `toBeCloseTo(0.5, 5)`, `(75)` → `0.325`, `(150)` → `0.15`, `(200)` → `0.15`; `:37-38` `computeDrive({steer: 1}, 0).steer` `toBeCloseTo(0.5, 5)`, `steer: -1` → `-0.5` | PASS |
| C7 | Space: freio só traseiro, atrito traseiro 0.4 | batch U · `✓ drivetrain > handbrake brakes rear wheels and cuts rear grip to 0.4` | verified at 181fd5d · `tests/unit/drivetrain.test.ts:44-47` `expect(cmd.brakeFront).toBe(0)`, `expect(cmd.brakeRear).toBeGreaterThan(0)`, `expect(cmd.rearFrictionFactor).toBeCloseTo(0.4, 5)`, `computeDrive(idle, 60).rearFrictionFactor` `toBe(1)` | PASS |
| C8 | Motor 0 a >= 220 km/h, positivo a 219 | batch U · `✓ drivetrain > engine force cut at 220 kmh` | verified at 181fd5d · `tests/unit/drivetrain.test.ts:52-54` `computeDrive({throttle}, 219).engineForce` `toBeGreaterThan(0)`; `220` e `230` → `toBe(0)` | PASS |
| C9 | Contra prédio, centro do chassi fora da AABB | batch E · `[9/25] drive.spec.ts:62:3 › building blocks the chassis` | verified at 181fd5d · `tests/e2e/drive.spec.ts:77` `expect(insideX && insideZ).toBe(false)`; `:79` `expect(target.zMin - p.z).toBeLessThan(6)` | PASS |
| C10 | Parede invisível: abs(x), abs(z) <= 202 | batch E · `[10/25] drive.spec.ts:83:3 › invisible wall keeps chassis inside city` | verified at 181fd5d · `tests/e2e/drive.spec.ts:87-89` `expect(Math.abs(p.x)).toBeLessThanOrEqual(202)`, `expect(Math.abs(p.z)).toBeLessThanOrEqual(202)`, `expect(p.x).toBeGreaterThan(195)` | PASS |
| C11 | R: rotação identidade, +1 m em y (± 0.05), velocidades < 0.01 | batch E · `[11/25] drive.spec.ts:93:3 › reset puts car upright` | verified at 181fd5d · `tests/e2e/drive.spec.ts:100-106` `Math.abs(snap.rotation.x)`, `.y`, `.z` `toBeLessThan(0.01)`, `snap.rotation.w` `toBeGreaterThan(0.99)`, `snap.position.y` `toBeCloseTo(before.y + 1, 1)`, `Math.hypot(linvel)`/`Math.hypot(angvel)` `toBeLessThan(0.01)` | PASS |
| C12 | Acumulador: 0.05→3 passos resto 0; 0.2→5 resto 0; 0.01→0 resto 0.01 | batch U · `✓ FixedStepper > steps at 1/60 with a cap of 5` | carried from c58edf6 · `tests/unit/fixedStepper.test.ts:8-17` `a.advance(0.05)` `toBe(3)` + `a.accumulator` `toBeCloseTo(0)`; `b.advance(0.2)` `toBe(5)` + `toBeCloseTo(0)`; `c.advance(0.01)` `toBe(0)` + `toBeCloseTo(0.01)`; `:19` `a.step` `toBeCloseTo(1/60, 9)` | PASS |
| C13 | Alvo (0,2.5,-6) olhando (0,1,0) em heading 0; (-6,2.5,0) em π/2 | batch U · `✓ chase camera math > target is 6 m behind and 2.5 m above along heading` | carried from c58edf6 · `tests/unit/chaseCamera.test.ts:8-11` `t0.position.x`, `.y`, `.z` `toBeCloseTo(0)`, `(2.5)`, `(-6)`, `t0.lookAt` `toEqual({x:0,y:1,z:0})`; `:14-16` `t1.position.x`, `.y`, `.z` `toBeCloseTo(-6)`, `(2.5)`, `(0)` | PASS |
| C14 | Suavização `1 - exp(-5·dt)`: 0.393 em dt 0.1 | batch U · `✓ chase camera math > smoothing follows 1 - exp(-5 dt)` | carried from c58edf6 · `tests/unit/chaseCamera.test.ts:21` `smoothingFactor(0.1)` `toBeCloseTo(1 - Math.exp(-0.5), 6)`; `:22-23` `smoothingFactor(0)` `toBe(0)`, `smoothingFactor(10)` `toBeCloseTo(1)` (texto do check corrigido no fix: "50 %" removido; o teste afirma a fórmula fixada) | PASS |
| C15 | 7 teclas → 7 campos; tecla desconhecida não altera | batch U · `✓ input keymap > keymap table` | carried from c58edf6 · `tests/unit/input.test.ts:8-14` tabela `KeyW→throttle … KeyM→mute`; `:16` `expect(table.length).toBe(7)`; `:20` `expect(read(down)).toBe(expected)`; `:22` `expect(up).toEqual(createInputState())`; `:25-26` `applyKey(…, 'KeyQ', true)` `toEqual(createInputState())` | PASS |
| C16 | `generateCity(1337)` idêntico duas vezes; 1 ≠ 2 | batch U · `✓ CityGenerator > deterministic by seed` | carried from c58edf6 · `tests/unit/cityGenerator.test.ts:7` `JSON.stringify(generateCity(1337))` `toBe(JSON.stringify(generateCity(1337)))`; `:8` `generateCity(1)` `.not.toBe(generateCity(2))` | PASS |
| C17 | 64 quarteirões 40 m, ruas 12 m, bounds ±202 | batch U · `✓ CityGenerator > 8x8 grid of 40 m blocks with 12 m streets` | carried from c58edf6 · `tests/unit/cityGenerator.test.ts:14-17` `city.blocks.length` `toBe(64)`, `blockSize` `toBe(40)`, `streetWidth` `toBe(12)`, `bounds` `toBe(202)`; `:20-29` 8 xs/zs, passo `toBeCloseTo(52)`, extremos `±182` | PASS |
| C18 | 1-4 prédios por quarteirão, altura [10,60], base dentro | batch U · `✓ CityGenerator > buildings per block within bounds` | carried from c58edf6 · `tests/unit/cityGenerator.test.ts:36-37` `block.buildings.length` `>= 1`, `<= 4`; `:40-41` `b.height` `>= 10`, `<= 60`; `:42-45` `b.x ± b.width/2` e `b.z ± b.depth/2` dentro de `block ± half` | PASS |
| C19 | >= 1 letreiro por quarteirão; cores na paleta de 4 | batch U · `✓ CityGenerator > neon signs use the 4-color palette` | carried from c58edf6 · `tests/unit/cityGenerator.test.ts:52` `[...NEON_PALETTE]` `toEqual(['#ff2d95','#00e5ff','#b026ff','#ffd400'])`; `:57` `block.signs.length` `>= 1`; `:59` `palette.has(s.color)` `toBe(true)`; `:63` `used.size` `toBe(4)` | PASS |
| C20 | Postes a cada 20 m nos dois lados; total = 2 × ruas × floor(L/20) | batch U · `✓ CityGenerator > lamp posts every 20 m on both sides` | carried from c58edf6 · `tests/unit/cityGenerator.test.ts:71-72` `expected = 2 * (2 * 7) * Math.floor(404 / 20)`, `city.lamps.length` `toBe(expected)`; `:81` `groups.size` `toBe(28)`; `:84` `coords.length` `toBe(20)`; `:86` `coords[i] - coords[i-1]` `toBeCloseTo(20, 2)` | PASS |
| C21 | `renderer.info.render.calls` <= 60 | batch E · `[20/25] render.spec.ts:11:3 › draw calls at most 60` | verified at 181fd5d · `tests/e2e/render.spec.ts:13-14` `expect(calls).toBeGreaterThan(0)`, `expect(calls).toBeLessThanOrEqual(60)` | PASS |
| C22 | Letreiro, janela e cabeça de poste com emissiveIntensity >= 2 | batch E · `[21/25] render.spec.ts:18:3 › neon emissive intensity at least 2` | verified at 181fd5d · `tests/e2e/render.spec.ts:20` `m.windowEmissiveIntensity` `toBeGreaterThanOrEqual(2)`; `:21` `m.lampEmissiveIntensity` `toBeGreaterThanOrEqual(2)` (novo no fix; getter `src/core/Game.ts:221-223` lê `game.city.lampMaterial.emissiveIntensity`, valor 2.5 em `src/world/CityScene.ts:40`); `:22-23` `m.signEmissiveIntensities.length` `toBe(4)`, cada `v` `toBeGreaterThanOrEqual(2)` | PASS |
| C23 | Rua roughness <= 0.25; `scene.environment` não nulo | batch E · `[22/25] render.spec.ts:27:3 › wet road material and environment map` | verified at 181fd5d · `tests/e2e/render.spec.ts:30-31` `expect(roughness).toBeLessThanOrEqual(0.25)`, `expect(hasEnv).toBe(true)` | PASS |
| C24 | Composer com UnrealBloomPass habilitado; toneMapping ACES | batch E · `[23/25] render.spec.ts:35:3 › bloom pass and ACES tone mapping` | verified at 181fd5d · `tests/e2e/render.spec.ts:40-42` `expect(info.passes).toContain('UnrealBloomPass')`, `expect(info.bloomEnabled).toBe(true)`, `expect(info.aces).toBe(true)` | PASS |
| C25 | `formatSpeed` 13.9→"50", -2.0→"7", 0.27→"1" | batch U · `✓ hud format > speed in kmh as integer` | carried from c58edf6 · `tests/unit/hudFormat.test.ts:7-9` `formatSpeed(13.9)` `toBe('50')`, `formatSpeed(-2.0)` `toBe('7')`, `formatSpeed(0.27)` `toBe('1')` | PASS |
| C26 | HUD mostra `speedKmh` arredondado, tolerância 3 km/h (declarada no check) | batch E · `[12/25] hud.spec.ts:6:3 › speed label matches car state` | verified at 181fd5d · `tests/e2e/hud.spec.ts:15` `Number(label)` `toBeGreaterThan(10)`; `:17` `Math.abs(Number(label) - Math.round(Math.abs(kmh)))` `toBeLessThanOrEqual(3)` (tolerância agora declarada em C26; precision gap da rodada 1 fechado) | PASS |
| C27 | 7 faixas de marcha, 9 amostras | batch U · `✓ drivetrain > gear bands` | verified at 181fd5d · `tests/unit/drivetrain.test.ts:59-69` tabela `[-5,-1],[0,1],[29.9,1],[30,2],[60,3],[95,4],[130,5],[170,6],[200,6]`; `:71` `expect(gearFor(kmh)).toBe(gear)`; `:73` `new Set(...).size` `toBe(7)` | PASS |
| C28 | RPM 1000/4000/6980/1000 a 0/15/29.9/30; sempre em [1000,7000] | batch U · `✓ drivetrain > rpm within gear band` | verified at 181fd5d · `tests/unit/drivetrain.test.ts:78-81` `rpmFor(0)` `toBeCloseTo(1000, 3)`, `rpmFor(15)` → `4000`, `rpmFor(29.9)` → `6980`, `rpmFor(30)` → `1000`; `:84-85` varredura -50..250 `rpm >= 1000` e `<= 7000` | PASS |
| C29 | -1 → "R"; barra = (rpm-1000)/6000 × 100 % | batch U · `✓ hud format > gear label and rpm bar width` | carried from c58edf6 · `tests/unit/hudFormat.test.ts:15-17` `gearLabel(-1)` `toBe('R')`, `gearLabel(1)` `toBe('1')`, `gearLabel(6)` `toBe('6')`; `:18-20` `rpmBarWidth(1000)` `toBeCloseTo(0)`, `(4000)` → `50`, `(7000)` → `100` | PASS |
| C30 | Carro → (80,80); +160 m x → x=160; -160 m z → y=0; canvas 160 px | batch U · `✓ minimap math > 320 m window into 160 px` | carried from c58edf6 · `tests/unit/minimap.test.ts:7-8` `MINIMAP_SIZE_PX` `toBe(160)`, `MINIMAP_WINDOW_M` `toBe(320)`; `:10-12` `worldToMinimap(10,-40,car)` `toEqual({x:80,y:80})`, `(170,-40)` → `{x:160,y:80}`, `(10,-200)` → `{x:80,y:0}` (o level gap do `<canvas>` real apontado na rodada 1 é fechado por C42) | PASS |
| C31 | Overlay `Carregando...` visível antes de ready, `display: none` depois | batch E · `[13/25] hud.spec.ts:21:3 › loading overlay shows then hides` | verified at 181fd5d · `tests/e2e/hud.spec.ts:24-25` `expect(loading).toBeVisible()`, `toContainText('Carregando...')`; `:27-28` `expect(loading).toBeHidden()`, `toHaveCSS('display', 'none')`; `:29` `#hud` `toBeVisible()` | PASS |
| C32 | Sem WebGL2: overlay `Seu navegador não suporta WebGL2`, `__game` indefinido | batch E · `[14/25] hud.spec.ts:33:3 › webgl2 missing shows error overlay` | verified at 181fd5d · `tests/e2e/hud.spec.ts:43-44` `expect(error).toBeVisible()`, `toHaveText('Seu navegador não suporta WebGL2')`; `:47` `expect(hasGame).toBe(false)`; `:48` `#loading` `toBeHidden()` | PASS |
| C33 | GLB abortado: `console.warn` com `/models/car.glb`, `placeholder` true, >= 50 km/h em 5 s | batch E · `[15/25] hud.spec.ts:52:3 › missing glb falls back to box chassis` | verified at 181fd5d · `tests/e2e/hud.spec.ts:60` `warnings.some((w) => w.includes('/models/car.glb'))` `toBe(true)`; `:62` `expect(placeholder).toBe(true)`; `:67` `expect(reached).toBe(true)` | PASS |
| C34 | `exposeDebug` só define `__game` com `DEV: true` | batch U · `✓ exposeDebug > debug handle only in DEV` | carried from c58edf6 · `tests/unit/exposeDebug.test.ts:11` `expect(prod.__game).toBeUndefined()`; `:15` `expect(dev.__game).toBe(game)`; montagem real relida em 181fd5d: `src/main.ts:40` `exposeDebug(import.meta.env, game.debugHandle(), window …)` (inalterada) | PASS |
| C35 | `audio.state` idle → running na 1ª tecla; nós existem | batch E · `[1/25] audio.spec.ts:10:3 › first keypress starts audio` | carried from c58edf6 · `tests/e2e/audio.spec.ts:11` `expect(… audio.state).toBe('idle')`; `:13` `waitForFunction(… audio.state === 'running')`; `:15-16` `gains.engine` `toBeGreaterThan(0)`, `gains.ambient` `toBeGreaterThan(0)` | PASS |
| C36 | `engineFrequency` 1000→60, 4000→130, 7000→200 | batch U · `✓ audio map > rpm maps linearly to 60..200 Hz` | carried from c58edf6 · `tests/unit/audioMap.test.ts:7-9` `engineFrequency(1000)` `toBeCloseTo(60, 6)`, `(4000)` → `130`, `(7000)` → `200` | PASS |
| C37 | Ganhos ambient 0.3, engine 0.5, master 1 | batch E · `[2/25] audio.spec.ts:20:3 › gains are 0.3 ambient 0.5 engine` | carried from c58edf6 · `tests/e2e/audio.spec.ts:24-26` `gains.ambient` `toBeCloseTo(0.3, 6)`, `gains.engine` `toBeCloseTo(0.5, 6)`, `gains.master` `toBeCloseTo(1, 6)` | PASS |
| C38 | M: master 1→0, depois 0→1 | batch E · `[3/25] audio.spec.ts:30:3 › M toggles master gain` | carried from c58edf6 · `tests/e2e/audio.spec.ts:34` após 1º M `.master` `toBeCloseTo(0, 6)`; `:36` após 2º M `.master` `toBeCloseTo(1, 6)` | PASS |
| C39 | 8 módulos puros não importam three/rapier por `from`, `import '…'`, `import()` ou `require()` | batch U · `✓ pure modules > pure modules do not import three or rapier` | verified at 181fd5d · `tests/unit/purity.test.ts:18` `FORBIDDEN` = regex com alternação de 4 prefixos (`from\s+`, `import\s+`, `import\s*\(`, `require\s*\(`) seguidos de `'three'` ou `'@dimforge/rapier3d-compat'` (com subpath opcional); `:22` `PURE_MODULES.length` `toBe(8)`; `:25` `FORBIDDEN.test(source)` `toBe(false)` (as 4 formas do check estão na alternação) | PASS |
| C40 | 4 rodas; controlador `DynamicRayCastVehicleController` | batch E · `[4/25] drive.spec.ts:10:3 › rapier vehicle controller with 4 wheels` | verified at 181fd5d · `tests/e2e/drive.spec.ts:15-16` `expect(info.wheelCount).toBe(4)`, `expect(info.controllerKind).toBe('DynamicRayCastVehicleController')` (`instanceof` em `src/core/Game.ts:173-176`) | PASS |
| C41 | Montagem lança → overlay começa com `Falha ao iniciar o jogo:`, `__game` indefinido | batch E · `[17/25] hud.spec.ts:83:3 › hud - rodada 2 › boot failure shows error overlay` | verified at 181fd5d · `tests/e2e/hud.spec.ts:91-92` `expect(error).toBeVisible()`, `expect(error).toContainText(/^Falha ao iniciar o jogo:/)`; `:94` `expect(await page.evaluate(() => window.__game !== undefined)).toBe(false)`; `:95` `#loading` `toBeHidden()`; gatilho `:84-88` remove `#minimap` em `DOMContentLoaded`, lança em `src/core/Game.ts:82`; texto em `src/main.ts:36` | PASS |
| C42 | `<canvas id="minimap">` real 160×160; >= 10 px `#ff7a1a` em ±10 px do centro; >= 100 px `#2b2d3d` | batch E · `[18/25] hud.spec.ts:99:3 › hud - rodada 2 › minimap draws blocks and car` | verified at 181fd5d · `tests/e2e/hud.spec.ts:119-120` `expect(result.width).toBe(160)`, `expect(result.height).toBe(160)`; `:121` `expect(result.car).toBeGreaterThanOrEqual(10)`; `:122` `expect(result.blocks).toBeGreaterThanOrEqual(100)`; contagem por `getImageData` `:104-115` com `nearCenter = Math.abs(x - 80) <= 10 && Math.abs(y - 80) <= 10` e RGB exatos (255,122,26)/(43,45,61) = `src/hud/Minimap.ts:37` `#ff7a1a`, `:26` `#2b2d3d` | PASS |
| C43 | Carro parado 2 s: câmera a < 0.1 m de `(x - 6 sin h, y + 2.5, z - 6 cos h)` | batch E · `[24/25] render.spec.ts:46:3 › camera sits 6 m behind and 2.5 m above` | verified at 181fd5d · `tests/e2e/render.spec.ts:47` `advanceSim(page, 2)`; `:52-56` `expected = { x: car.x - 6 * Math.sin(car.heading), y: car.y + 2.5, z: car.z - 6 * Math.cos(car.heading) }`; `:58` `expect(dist).toBeLessThan(0.1)`; getter `src/core/Game.ts:201-204` lê `game.chase.camera.position` | PASS |
| C44 | Após 1.5 s de W: `#gear` = `2` = `car.gear`; `#rpm-fill` em [0,100] e a < 15 pontos de `rpmBarWidth(car.rpm)` | batch E · `[19/25] hud.spec.ts:126:3 › hud - rodada 2 › gear and rpm bar match car state` | verified at 181fd5d · `tests/e2e/hud.spec.ts:140-141` `expect(sample.gear).toBe(2)`, `expect(sample.gearLabel).toBe('2')`; `:142` `expectedWidth = ((sample.rpm - 1000) / 6000) * 100`; `:143-145` `rpmWidth` `toBeGreaterThanOrEqual(0)`, `toBeLessThanOrEqual(100)`, `Math.abs(sample.rpmWidth - expectedWidth)` `toBeLessThan(15)`; getters `src/core/Game.ts:186-191` | PASS |
| C45 | Bloom (0.8, 0.4, 0.7) na ordem RenderPass→Bloom→OutputPass; timestep 1/60; seed 1337; força só nas rodas 2 e 3 com W | batch E · `[25/25] render.spec.ts:62:3 › landing door literals` | verified at 181fd5d · `tests/e2e/render.spec.ts:72` `expect(info.passes).toEqual(['RenderPass', 'UnrealBloomPass', 'OutputPass'])`; `:73-75` `info.bloom.strength` `toBeCloseTo(0.8, 6)`, `.radius` → `0.4`, `.threshold` → `0.7`; `:77` `info.timestep` `toBeCloseTo(1 / 60, 6)`; `:78` `expect(info.seed).toBe(1337)`; `:84-87` `forces[0]` `toBe(0)`, `forces[1]` `toBe(0)`, `forces[2]` `toBeGreaterThan(0)`, `forces[3]` `toBeGreaterThan(0)`; fontes `src/core/Game.ts:75-78` (passes), `:56` (timestep), `src/world/CityGenerator.ts:15,185` (`DEFAULT_SEED = 1337`), `src/vehicle/Car.ts:39-40,115-124` (`REAR = [2, 3]`) | PASS |

Swept rows relidas contra o código em 181fd5d (as demais carregadas de c58edf6):

- failure modes (C32, C33, C41): `src/main.ts:20-23` (WebGL2), `src/core/Loader.ts:31-37` (GLB),
  `src/main.ts:34-38` (`catch` do boot) - presentes.
- dependency failure: a linha agora diz que qualquer falha antes do primeiro frame cai no `catch`
  do boot com `Falha ao iniciar o jogo: <erro>`, provado por C41. Confere com `src/main.ts:36`
  (a contradição da rodada 1 - "mesma mensagem" de C32 - foi corrigida no texto).
- validation (C6, C8, C17, C18), concurrency (C12), state transitions, observability: carried from
  c58edf6 (fontes não tocadas, exceto `drivetrain.ts:86` `speedKmh < MAX_SPEED_KMH` relida: presente).

## Coverage

Linhas cujas autoridades o fix tocou foram recalculadas a partir do código em 181fd5d
(`verified at 181fd5d`); as demais são `carried from c58edf6` (fonte e teste não tocados). Varredura
por conjuntos sem linha: nenhum novo além dos já listados; `engine force per wheel (4)`,
`pass order (3)` e `reverse cutoff edges (3)` foram acrescentados porque C4/C45 os enumeram e a
tabela do autor só os cita dentro de outras linhas.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| keymap (7) | carried from c58edf6 · `src/core/input.ts:19-27` `KEYMAP` | C15, tabela `tests/unit/input.test.ts:8-14` + `table.length` `toBe(7)` | - |
| gear bands (7) | verified at 181fd5d · `src/vehicle/drivetrain.ts:44-51` (6 faixas) + `:58` (`-1`) | C27, 9 amostras cobrindo os 7 valores + `Set.size` `toBe(7)` (`tests/unit/drivetrain.test.ts:59-73`) | - |
| steering samples (4) | verified at 181fd5d · claim C6 (0, 75, 150, 200 km/h) | C6 `tests/unit/drivetrain.test.ts:33-36` | - |
| throttle/brake regimes (4) | verified at 181fd5d · `src/vehicle/drivetrain.ts:86` throttle · `:91` freio · `:96` ré · `:103` freio de mão | throttle C8 + C1 · freio C2 + C3 · ré C4 (agora com -29, -30, -31) + C5 · freio de mão C7 | - |
| speed cap edges (2) | verified at 181fd5d · `src/vehicle/drivetrain.ts:86` `speedKmh < 220` | 219 C8 · 220 C8 (+230) | - |
| reverse cutoff edges (3) | verified at 181fd5d · `src/vehicle/drivetrain.ts:32,96` `> -29.5` | -29 C4 · -30 C4 · -31 C4 (`tests/unit/drivetrain.test.ts:26-28`) + fronteira C5 `>= -30` | - |
| stepper cases (3) | carried from c58edf6 · `src/core/FixedStepper.ts:23-30` | 0.05 C12 · 0.2 C12 · 0.01 C12 | - |
| neon palette (4) | carried from c58edf6 · `src/world/CityGenerator.ts:17` | C19 `toEqual([4 cores])` + `used.size` `toBe(4)` | - |
| boot/loader outcomes (4) | verified at 181fd5d · `src/main.ts:20-23` sem WebGL2 · `:27-33` ok · `src/core/Loader.ts:34-36` GLB falha · `src/main.ts:34-38` `catch` do boot | sem WebGL2 C32 · ok C31/C1 · GLB falha C33 · catch do boot C41 (`hud.spec.ts:92` regex `^Falha ao iniciar o jogo:`, `:94` `__game` indefinido) | - |
| overlays (2) | verified at 181fd5d · `index.html:11` `#loading` · `:16` `#error` | loading C31 · error C32 (WebGL2) e C41 (boot) | - |
| minimap elements (4) | verified at 181fd5d · `src/hud/Minimap.ts:13-14` canvas 160 · `src/hud/minimapMath.ts:7` janela 320 m · `Minimap.ts:26-31` quarteirões · `:34-43` triângulo do carro | canvas real C42 (`hud.spec.ts:119-120`) + constante C30 · janela C30 · quarteirões C42 (`:122` >= 100 px `#2b2d3d`) · triângulo C42 (`:121` >= 10 px `#ff7a1a` no centro); a rotação por heading (`Minimap.ts:36`) não é afirmada por nenhuma prova - precision gap sobre C42 (finding 1), não membro separado | - |
| hud elements (3) | verified at 181fd5d · `src/hud/Hud.ts:21` `#speed` · `:26` `#gear` · `:29` `#rpm-fill` | speed C26 · gear C44 (`hud.spec.ts:141`) · rpm bar C44 (`:143-145`) | - |
| bloom literals (3) | verified at 181fd5d · `src/core/Game.ts:76` `new UnrealBloomPass(…, 0.8, 0.4, 0.7)` | strength C45 (`render.spec.ts:73`) · radius C45 (`:74`) · threshold C45 (`:75`) | - |
| pass order (3) | verified at 181fd5d · `src/core/Game.ts:75-78` `addPass` ×3 | C45 `render.spec.ts:72` `toEqual([RenderPass, UnrealBloomPass, OutputPass])` | - |
| engine force per wheel (4) | verified at 181fd5d · `src/vehicle/Car.ts:39-40` `FRONT = [0, 1]`, `REAR = [2, 3]`; `:115-124` | roda 0 C45 (`render.spec.ts:84` `toBe(0)`) · roda 1 C45 (`:85`) · roda 2 C45 (`:86` `> 0`) · roda 3 C45 (`:87`) | - |
| emissive materials (3) | verified at 181fd5d · `src/world/CityScene.ts:34` janela 2.0 · `:40` poste 2.5 · `:128` letreiro 3.0 | janela C22 (`render.spec.ts:20`) · poste C22 (`:21`) · letreiro C22 (`:22-23`) | - |
| audio gains (3) | carried from c58edf6 · `src/audio/AudioEngine.ts:25-26, 37-38, 49-50` | C37 (3 asserções) | - |
| mute transitions (2) | carried from c58edf6 · `src/audio/AudioEngine.ts:63-66` | 1→0 C38 · 0→1 C38 | - |
| rpm samples (4) | verified at 181fd5d · claim C28 | 0 · 15 · 29.9 · 30 C28 (`tests/unit/drivetrain.test.ts:78-81`) + varredura | - |
| landing doors (9) | verified at 181fd5d · plano `## Landing` linhas 1-9 | 1 C39 · 2 C40 + C45 (tração traseira) · 3 C24 + C45 (bloom literais, ordem) · 4 C34 · 5 C12 + C45 (timestep) · 6 C16 + C45 (seed 1337) · 7 C33 · 8 C35 (tipos de nó ainda sem asserção - finding 3) · 9 C25 | - |
| startup config: debug handle (1 assembly) | verified at 181fd5d · `src/main.ts:40` `exposeDebug(import.meta.env, game.debugHandle(), window …)` (linha inalterada) | C34 (função) + montagem confirmada por leitura | - |
| pure modules (8) | verified at 181fd5d · `tests/unit/purity.test.ts:6-15` = os 8 arquivos de C39 | C39, tabela sobre os 8, 4 formas de import | - |

Claims cruzando a fronteira do browser (lista do autor: C1, C3, C5, C9-C11, C21-C24, C26,
C31-C33, C35, C37, C38, C40-C45): confirmado, cada um tem prova Playwright acima. Nenhum check
nomeia estado, rota ou shape que só tenha prova abaixo da fronteira (a cláusula do canvas de C30
tem agora C42 na fronteira).

## Test policy rows

Re-julgadas: as duas linhas não atendidas na rodada 1 e as linhas que classificam arquivos tocados
(`src/core/Game.ts`, `src/vehicle/drivetrain.ts`). A classificação da rodada 1 é mantida (o
autor moveu `src/main.ts` para "Decides, reached across a boundary"; sob qualquer das duas linhas
a exigência é a mesma: cada error path com prova na fronteira).

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/vehicle/drivetrain.ts` · `src/core/Loader.ts` (+ `src/main.ts` na tabela do autor) | verified at 181fd5d · drivetrain: fronteira C1, C3, C5 · camada própria C2, C4 (3 arestas de ré), C6-C8, C27, C28 (7 marchas, 4 regimes, 2 arestas de cap, 4 amostras de direção). Loader/main: fronteira C31 (ok), C32 (WebGL2), C33 (GLB), C41 (catch) | yes |
| Decides, not reached across a boundary | `src/core/input.ts` · `src/core/FixedStepper.ts` · `src/camera/chaseMath.ts` · `src/world/CityGenerator.ts` · `src/hud/format.ts` · `src/hud/minimapMath.ts` · `src/audio/audioMap.ts` · `src/core/exposeDebug.ts` | carried from c58edf6 · C15 · C12 · C13, C14 · C16-C20 · C25, C29 · C30 · C36 · C34 | yes |
| Entry point that decides nothing | `src/main.ts` · `src/core/InputManager.ts` | verified at 181fd5d · main.ts: entrada aceita C31; error paths: sem WebGL2 C32 (`src/main.ts:20-23`), `catch` do boot C41 (`src/main.ts:34-38`, `hud.spec.ts:92,94`). InputManager: primeira tecla C35, teclas seguradas C1-C11 (`event.repeat` ignorado continua sem prova própria - pass-through, finding 5) | yes |
| Instrumentation, pass-throughs | `src/vehicle/Car.ts` · `src/world/CityScene.ts` · `src/world/Environment.ts` · `src/core/Game.ts` · `src/core/GameLoop.ts` · `src/hud/Hud.ts` · `src/audio/AudioEngine.ts` · `src/camera/ChaseCamera.ts` · `src/hud/Minimap.ts` | verified at 181fd5d · Car C1-C11, C40, C45 (`render.spec.ts:84-87` força por roda) · CityScene C21-C23 · Environment C23 · Game C21-C24, C41 (`Game.ts:82` lança), C43-C45 (getters `Game.ts:183-191, 201-209, 221-223, 237-239`) · GameLoop C1 · Hud C26 (`#speed`) + C44 (`#gear`, `#rpm-fill`) · AudioEngine C35, C37, C38 · ChaseCamera C43 (`render.spec.ts:58`, posição real da câmera) · Minimap C42 (`hud.spec.ts:119-122`, pixels do canvas real) | yes |

## Faults injected

Baseline `git status --porcelain` da árvore real: vazio. Worktree de rascunho em
`<scratchpad>/verify-wt2` (HEAD 181fd5d, `git worktree add`) com junção para `node_modules`; cada
mutação revertida com `git checkout -- <arquivo>` antes da seguinte (porcelain do worktree vazio
após cada revert); junção (`rmdir`) e worktree (`git worktree remove --force`) removidos ao final;
porcelain final da árvore real: vazio (igual ao baseline; `verification.md` foi reescrito depois).
Provas Playwright rodadas de dentro do worktree, uma invocação por vez. Uma falha por superfície
de asserção nova; cada uma derruba uma prova diferente.

| Mutation | Location | Killed |
| --- | --- | --- |
| carried from c58edf6 · `GEAR_BANDS` `[30, 60]` → `[31, 60]` | `src/vehicle/drivetrain.ts:46` (era :44) | yes - `vitest … -t "gear bands"` exit 1: `gear at 30 km/h: expected 1 to be 2` (C27) |
| carried from c58edf6 · `LAMP_SPACING` `20` → `21` | `src/world/CityGenerator.ts:14` | yes - `vitest … -t "lamp posts every 20 m on both sides"` exit 1: `expected 532 to be 560` (C20) |
| carried from c58edf6 · `maxSteps` `5` → `6` | `src/core/FixedStepper.ts:16` | yes - `vitest … -t "steps at 1/60 with a cap of 5"` exit 1: `expected 6 to be 5` (C12) |
| carried from c58edf6 · ramo de falha do GLB devolve `placeholder: false` | `src/core/Loader.ts:36` | yes - `playwright … -g "missing glb falls back to box chassis"` exit 1: `hud.spec.ts:62` Received: false (C33) |
| carried from c58edf6 · `reset()` levanta `t.y + 3` em vez de `t.y + 1` | `src/vehicle/Car.ts:176` | yes - `playwright … -g "reset puts car upright"` exit 1: `drive.spec.ts:104` Expected 1.5975 Received 3.5975 (C11) |
| verified at 181fd5d · `REVERSE_CUTOFF_KMH = MAX_REVERSE_KMH - 0.5` → `+ 0.5` (corte em -30.5; -30 ainda tem força) | `src/vehicle/drivetrain.ts:32` | yes - `npx vitest run tests/unit/drivetrain.test.ts -t "reverse below 1 kmh and capped at 30"` exit 1: `AssertionError: expected -2500 to be +0` (C4, `drivetrain.test.ts:27`) |
| verified at 181fd5d · texto do catch `Falha ao iniciar o jogo: ` → `Erro: ` | `src/main.ts:36` | yes - `npx playwright test tests/e2e/hud.spec.ts -g "boot failure shows error overlay"` exit 1: `hud.spec.ts:92` `toContainText(/^Falha ao iniciar o jogo:/)` Received `"Erro: HUD: #minimap não encontrado"` (C41) |
| verified at 181fd5d · culling de quarteirões sempre verdadeiro (`continue` incondicional; nenhum quarteirão desenhado) | `src/hud/Minimap.ts:29` | yes - `npx playwright test tests/e2e/hud.spec.ts -g "minimap draws blocks and car"` exit 1: `hud.spec.ts:122` Expected >= 100 Received 0 (C42) |
| verified at 181fd5d · alvo da câmera `t.position.y` → `t.position.y + 1` (câmera 1 m alta demais) | `src/camera/ChaseCamera.ts:23` | yes - `npx playwright test tests/e2e/render.spec.ts -g "camera sits 6 m behind and 2.5 m above"` exit 1: `render.spec.ts:58` Expected < 0.1 Received 0.99999999 (C43) |
| verified at 181fd5d · HUD escreve `gearLabel(state.gear + 1)` | `src/hud/Hud.ts:24` | yes - `npx playwright test tests/e2e/hud.spec.ts -g "gear and rpm bar match car state"` exit 1: `hud.spec.ts:141` Expected "2" Received "3" (C44) |
| verified at 181fd5d · `UnrealBloomPass(…, 0.8, 0.4, 0.7)` → `0.9, 0.4, 0.7` | `src/core/Game.ts:76` | yes - `npx playwright test tests/e2e/render.spec.ts -g "landing door literals"` exit 1: `render.spec.ts:73` Expected 0.8 Received 0.9 (C45) |

## Gate

`cd "C:/Users/arthu/.claude/skills/tlc-spec-lean/scripts" && python validate_verification.py free-roam-city --root "C:/Users/arthu/source/repos/Jogo"` - exit 0:

```
validate_verification: 0 error(s), 0 warning(s) across [free-roam-city]
```

(Primeira execução: exit 1 com 11 erros de FORMATO - caracteres `|` dentro de crases nas células de evidência de C4, C6, C10, C11, C13, C28, C29, C36, C39, C42 e C45 deslocavam a coluna Result; corrigida só a notação, sem mudança de substância, e re-executado.)

Provas em `HEAD` 181fd5d: 22 unit passed, 0 failed · 25 e2e passed, 0 failed.

## Findings

Nenhum sustenta um FAIL; são precision gaps e asserções que o autor pode endurecer numa rodada
futura. Os findings 1-3 da rodada 1 (gaps ranqueados) estão fechados por C41-C45; os findings 4,
5, 7, 8, 9, 10 e 11 da rodada 1 (C5 -30.5, C26 tolerância, C39 regex, C4 aresta -30, C14 texto,
plano `steer`, poste em C22) estão fechados pelo fix.

1. **C42 não afirma a rotação por heading** - `src/hud/Minimap.ts:36` `ctx.rotate(-state.heading)`
   não é afirmado: o carro é lido em heading ≈ 0 e o teste conta pixels do triângulo numa janela
   simétrica de ±10 px. Um mutante que remova o `rotate` sobrevive a C42. AC 23 diz "triângulo
   rotacionado pelo heading". Endurecer: teleportar com heading π/2 e afirmar que a ponta do
   triângulo (pixel `#ff7a1a` mais distante do centro) está à esquerda (x < 80) e não abaixo.
2. **C45 timestep em float32** - o check diz `world.timestep` "igual a 1/60"; o Rapier guarda
   float32 (0.01666667), e `render.spec.ts:77` usa `toBeCloseTo(1 / 60, 6)`. Tolerância justificada
   em comentário no teste (`:76`), não no check. Declarar no check, como C26 e C44 fazem.
3. **Porta 8 sem asserção de tipos de nó** (carried from c58edf6, finding 6 parcial) - sawtooth →
   lowpass → gain (`src/audio/AudioEngine.ts:30-39`) continua provado só por `state` e ganhos > 0
   (C35, C37). C45 cobriu as portas 2, 3, 5 e 6; a 8 ficou de fora.
4. **`src/core/exposeDebug.ts` fora da lista de C39** (carried from c58edf6) - é módulo puro mas não
   está entre os 8 arquivos varridos por `purity.test.ts`; a lista do check é a autoridade, então
   não é membro sem prova, mas a porta 1 o cobriria de graça.
5. **`InputManager` `event.repeat`** (carried from c58edf6) - `src/core/InputManager.ts:39` ignora
   auto-repeat sem prova própria; pass-through coberto por C1-C11 segurando teclas. Sem impacto na
   linha de Test policy.
6. **C44 amostra dependente de dinâmica** - `#gear` = `2` após 1.5 s de W depende da aceleração
   real (4000 N, ~30-60 km/h na faixa); o teste passa hoje com margem, mas uma mudança de massa ou
   força (tuning, sub-projeto 4) o quebrará por motivo alheio ao HUD. Alternativa: afirmar
   `gearLabel === String(g.car.gear)` sem fixar `2`.
