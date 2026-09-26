# Free-roam city verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 5f760df..78c9795 (rodada 4: 25ae5fb..78c9795; rodada 3: ff54e6d..42e60a1)
**Round**: 4 - scoped
**Verifier**: independent sub-agent (author != verifier)

Resumo da rodada 3 (a rodada 4 está logo abaixo): rodada escopada pelo diff do fix (`git diff ff54e6d..42e60a1`: `src/audio/AudioEngine.ts`,
`src/core/Game.ts`, `tests/e2e/audio.spec.ts`, `tests/e2e/hud.spec.ts`, `tests/unit/purity.test.ts`,
`checks.md`) e pelos seis findings residuais do PASS da rodada 2 (rotação do triângulo em C42,
tolerância float32 em C45, tipos de nó da porta 8, `exposeDebug.ts` fora de C39, `event.repeat` do
`InputManager`, valor fixo de marcha em C44). As 46 provas rodaram em `HEAD` 42e60a1 e passaram
(22 vitest + 26 Playwright, dos quais 24 carregam check; cada nome listado individualmente); cada
check tem asserção localizada; 5 dos 6 findings residuais estão fechados (C42, C45, C46, C39, C44)
e o sexto (`event.repeat`) continua como pass-through sem impacto em linha de `Test policy`;
4 mutantes novos injetados nas superfícies que o fix criou ou endureceu, 4 mortos (os 11 das
rodadas 1-2 carregados). Nenhuma linha contradiz o PASS. Observações residuais em `## Findings`.

## Rodada 4 (scoped, verified at 78c9795)

Escopo: commit pós-PASS `78c9795` (`git diff --name-only 25ae5fb..78c9795`: `src/world/CityGenerator.ts`,
`src/world/CityScene.ts`, `tests/unit/cityGenerator.test.ts`, `tests/e2e/visual.spec.ts` (só move o
comentário `// C34`), `free-roam-city/{checks,plan}.md`, `visual-upgrade/checks.md` (texto do Handoff)).
Pedido do usuário: "pode diminuir a quantidade de postes na via" (`LAMP_SPACING` 20 -> 40,
`CityGenerator.ts:14`) e "deixe um pouco menos claras as luzes amarelas das janelas"
(`WINDOW_BRIGHTNESS = 0.7`, `CityScene.ts:22`, multiplicando `warm` no shader em `:379`). Nenhum
verdict não-PASS pendente da rodada 3. Checks re-provados: C20 (texto, prova e teste mudaram) e C22
(fonte `CityScene.ts` tocada). Tudo o mais: carried from 42e60a1 (rodada 3) - ver ressalva R4-2.

- **AC 16 x C20**: `plan.md:108` "postes de luz a cada 40 m ao longo dos dois lados de cada rua" e
  `checks.md:78` "espaçados de 40 m (± 0.01) nos dois lados ... `floor(comprimento / 40)`" concordam;
  nenhuma outra menção a 20 m para postes em `.specs/` nem dependência de contagem de postes em
  `tests/` (`grep -rn "lamp|560|280" tests/` fora de `cityGenerator.test.ts` só acha
  `render.spec.ts:22`, emissive do poste).
- **Provas em 78c9795**: `npx vitest run tests/unit/cityGenerator.test.ts -t "lamp posts every 40 m on
  both sides"` exit 0 - `✓ tests/unit/cityGenerator.test.ts > CityGenerator > lamp posts every 40 m on
  both sides`, `Tests 1 passed | 5 skipped (6)` (o filtro acertou exatamente o teste renomeado);
  `npx playwright test tests/e2e/render.spec.ts` exit 0 - `✓ 2 tests/e2e/render.spec.ts:18:3 › render
  › neon emissive intensity at least 2`, `6 passed (44.4s)`; `npx vitest run` exit 0 -
  `Test Files 15 passed (15)`, `Tests 46 passed (46)`. Playwright subiu o próprio Vite em `:5173`
  (0 listeners antes; o servidor do usuário em `:5174` não foi tocado).
- **C20** (verified at 78c9795): `tests/unit/cityGenerator.test.ts:89` `it('lamp posts every 40 m on
  both sides'`; `:93-94` `expected = 2 * (2 * streetsPerAxis) * Math.floor(streetLength / 40)`,
  `expect(city.lamps.length).toBe(expected)` (280); `:103` `expect(groups.size).toBe(2 * 2 *
  streetsPerAxis)` (28 = 14 ruas x 2 lados, chave = eixo + coordenada lateral); `:106`
  `expect(coords.length, key).toBe(Math.floor(streetLength / 40))` (10 por lado); `:108`
  `expect(coords[i]! - coords[i - 1]!, key).toBeCloseTo(40, 2)` (tolerância 0.005, dentro do ± 0.01
  do check). Fonte: `src/world/CityGenerator.ts:14` `LAMP_SPACING = 40`, `:184` `count =
  Math.floor(length / LAMP_SPACING)`, `:188` `along = -CITY_EXTENT + LAMP_SPACING / 2 + i *
  LAMP_SPACING`, `:189` `for (const s of [-1, 1])`. A asserção mira o valor do check (40, ± 0.01,
  `2 x ruas x floor(L/40)`), escrito literalmente no teste. PASS.
- **C22** (verified at 78c9795): `tests/e2e/render.spec.ts:20` `expect(m.windowEmissiveIntensity)
  .toBeGreaterThanOrEqual(2)`; `:22` `expect(m.lampEmissiveIntensity).toBeGreaterThanOrEqual(2)`;
  `:23-24` `m.signEmissiveIntensities.length` `toBe(4)`, cada `v` `toBeGreaterThanOrEqual(2)`.
  Getters `src/core/Game.ts:517-519` (`facadeMaterials[0].emissiveIntensity`), `:539-544`. Fontes:
  janela `src/world/CityScene.ts:304` `emissiveIntensity: 2.2` (inalterado pelo diff), poste `:109`
  `2.5`, letreiro `:247` `2.6` (base; flicker da visual-upgrade). `WINDOW_BRIGHTNESS` entra só no
  GLSL (`:379`), não na propriedade: C22 continua literalmente verdadeiro. PASS (ver R4-1).
- **Coverage** recalculada para as autoridades tocadas: `lamp groups (28)` e `emissive materials (3)`
  (linhas atualizadas na tabela). **Test policy**: re-julgadas as linhas que classificam
  `CityGenerator.ts` (Decides, not reached) e `CityScene.ts` (Instrumentation) - ambas yes.
- **Faults**: 5 mutantes em `<scratchpad>/verify-c20` (worktree de 78c9795 + junção `node_modules`),
  um por superfície de asserção de C20 (`:94`, `:103`, `:106`, `:108`) e um na superfície janela de
  C22 (fonte tocada pelo diff); 5 mortos. Tabela em `## Faults injected`.

### Rodada 3 (carried from 42e60a1)

Passo 1 (binding sources): o plano não marca nenhuma fonte como binding - nada a comparar.
Passo 5 (walk the flow with the user): usuário indisponível nesta rodada - não executado; nenhum
item deste relatório depende de julgamento humano.

Regra de carry: uma linha é `carried from 181fd5d` só quando nem o arquivo de teste nem o arquivo
fonte que ela cita aparecem em `git diff --name-only ff54e6d..42e60a1`. Arquivos de teste não
tocados pelo fix: `tests/unit/{audioMap,chaseCamera,cityGenerator,drivetrain,exposeDebug,fixedStepper,hudFormat,input,minimap}.test.ts`,
`tests/e2e/{drive,render}.spec.ts`, `tests/e2e/helpers.ts`. Fontes tocadas: só
`src/audio/AudioEngine.ts` (campos + método `graph()`) e `src/core/Game.ts` (getter `audio.graph`
em `:257-259`; toda linha de `Game.ts` citada pela rodada 2 está antes de `:254` e foi relida
inalterada: `:56` timestep, `:75-78` passes, `:82` throw, `:171-176` controlador, `:183-191`,
`:201-204`, `:221-223`, `:237-239`). Checks carregados: C1-C25, C27-C30, C34, C36, C40, C43 (32).
Checks com citação refrescada em 42e60a1: C26, C31, C32, C33, C35, C37, C38, C39, C41, C42, C44,
C45 (texto do check mudou; teste inalterado), C46 (14).

## Binding sources

O plano não marca nenhuma fonte como binding (`## Sources` lista brainstorm, rapier.rs e
threejs.org como referência, não como decisão). Nada a comparar neste passo (verified at 42e60a1:
o fix não tocou `plan.md`).

## Checks

Comandos rodados em `HEAD` (42e60a1), uma invocação por alvo, sem filtro de nome (suíte inteira):

- **batch U**: `npx vitest run tests/unit --reporter=verbose` - exit 0, `Test Files 10 passed (10)`,
  `Tests 22 passed (22)`; cada nome abaixo apareceu como linha `✓ <arquivo> > <describe> > <nome>`.
- **batch E**: `npx playwright test tests/e2e --reporter=line` - exit 0, `26 passed (1.9m)`; cada
  nome apareceu como linha `[n/26] <arquivo>:<linha>:3 › <describe> › <nome>`. Os 2 testes extra
  sem check continuam (`A turns left`, `handbrake key reaches the car`).
- Existência: `grep -n "" tests/e2e/hud.spec.ts tests/e2e/audio.spec.ts tests/unit/purity.test.ts`
  (arquivos tocados, lidos inteiros com número de linha) localizou os 14 nomes refrescados; o novo
  `synthesized audio graph` está em `audio.spec.ts:30` e nasceu em 42e60a1. Os 32 carregados foram
  localizados nas rodadas 1-2 em arquivos que o fix não tocou. Nenhuma prova resolve para teste
  pré-existente à feature.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | W por 5 s (simulados) leva a >= 50 km/h | batch E · `[6/26] drive.spec.ts:20:3 › throttle reaches 50 kmh within 5s` | carried from 181fd5d · `tests/e2e/drive.spec.ts:21` `expect(await speedKmh(page)).toBeLessThan(1)`; `:23-25` `waitSimUntil(page, 'g.car.speedKmh >= 50', 5)` + `expect(reached).toBe(true)` | PASS |
| C2 | S acima de 1 km/h: freio > 0 nas 4 rodas, motor 0 | batch U · `✓ drivetrain > brake when moving forward` | carried from 181fd5d · `tests/unit/drivetrain.test.ts:16-19` `expect(cmd.engineForce).toBe(0)`, `expect(cmd.brakeFront).toBeGreaterThan(0)`, `expect(cmd.brakeRear).toBeGreaterThan(0)`, `expect(cmd.brakeFront).toBe(cmd.brakeRear)` | PASS |
| C3 | W 3 s depois S 1 s termina mais lento | batch E · `[7/26] drive.spec.ts:29:3 › brake reduces speed` | carried from 181fd5d · `tests/e2e/drive.spec.ts:34-35` `expect(before).toBeGreaterThan(20)`, `expect(after).toBeLessThan(before)` | PASS |
| C4 | S a <= 1 km/h: motor negativo; corte a partir de -29.5 (amostras -29 neg, -30 zero, -31 zero) | batch U · `✓ drivetrain > reverse below 1 kmh and capped at 30` | carried from 181fd5d · `tests/unit/drivetrain.test.ts:24-26` `computeDrive({brake}, 1).engineForce`, idem em `0` e `-29`, `toBeLessThan(0)`; `:27` `computeDrive({brake}, -30).engineForce` `toBe(0)`; `:28` `-31` → `toBe(0)`; código `src/vehicle/drivetrain.ts:32` `REVERSE_CUTOFF_KMH = MAX_REVERSE_KMH - 0.5`, `:96` `speedKmh > -REVERSE_CUTOFF_KMH` | PASS |
| C5 | S por 5 s termina entre -30 e -5 km/h | batch E · `[8/26] drive.spec.ts:39:3 › reverse drives backward up to 30 kmh` | carried from 181fd5d · `tests/e2e/drive.spec.ts:44-45` `expect(speed).toBeLessThanOrEqual(-5)`, `expect(speed).toBeGreaterThanOrEqual(-30)` | PASS |
| C6 | Direção 0.5/0.325/0.15/0.15 rad a 0/75/150/200; A +, D - | batch U · `✓ drivetrain > steering angle decays with speed` | carried from 181fd5d · `tests/unit/drivetrain.test.ts:33-36` `steeringAngleFor(0)` `toBeCloseTo(0.5, 5)`, `(75)` → `0.325`, `(150)` → `0.15`, `(200)` → `0.15`; `:37-38` `computeDrive({steer: 1}, 0).steer` `toBeCloseTo(0.5, 5)`, `steer: -1` → `-0.5` | PASS |
| C7 | Space: freio só traseiro, atrito traseiro 0.4 | batch U · `✓ drivetrain > handbrake brakes rear wheels and cuts rear grip to 0.4` | carried from 181fd5d · `tests/unit/drivetrain.test.ts:44-47` `expect(cmd.brakeFront).toBe(0)`, `expect(cmd.brakeRear).toBeGreaterThan(0)`, `expect(cmd.rearFrictionFactor).toBeCloseTo(0.4, 5)`, `computeDrive(idle, 60).rearFrictionFactor` `toBe(1)` | PASS |
| C8 | Motor 0 a >= 220 km/h, positivo a 219 | batch U · `✓ drivetrain > engine force cut at 220 kmh` | carried from 181fd5d · `tests/unit/drivetrain.test.ts:52-54` `computeDrive({throttle}, 219).engineForce` `toBeGreaterThan(0)`; `220` e `230` → `toBe(0)` | PASS |
| C9 | Contra prédio, centro do chassi fora da AABB | batch E · `[10/26] drive.spec.ts:62:3 › building blocks the chassis` | carried from 181fd5d · `tests/e2e/drive.spec.ts:77` `expect(insideX && insideZ).toBe(false)`; `:79` `expect(target.zMin - p.z).toBeLessThan(6)` | PASS |
| C10 | Parede invisível: abs(x), abs(z) <= 202 | batch E · `[11/26] drive.spec.ts:83:3 › invisible wall keeps chassis inside city` | carried from 181fd5d · `tests/e2e/drive.spec.ts:87-89` `expect(Math.abs(p.x)).toBeLessThanOrEqual(202)`, `expect(Math.abs(p.z)).toBeLessThanOrEqual(202)`, `expect(p.x).toBeGreaterThan(195)` | PASS |
| C11 | R: rotação identidade, +1 m em y (± 0.05), velocidades < 0.01 | batch E · `[12/26] drive.spec.ts:93:3 › reset puts car upright` | carried from 181fd5d · `tests/e2e/drive.spec.ts:100-106` `Math.abs(snap.rotation.x)`, `.y`, `.z` `toBeLessThan(0.01)`, `snap.rotation.w` `toBeGreaterThan(0.99)`, `snap.position.y` `toBeCloseTo(before.y + 1, 1)`, `Math.hypot(linvel)` e `Math.hypot(angvel)` `toBeLessThan(0.01)` | PASS |
| C12 | Acumulador: 0.05→3 passos resto 0; 0.2→5 resto 0; 0.01→0 resto 0.01 | batch U · `✓ FixedStepper > steps at 1/60 with a cap of 5` | carried from 181fd5d · `tests/unit/fixedStepper.test.ts:8-17` `a.advance(0.05)` `toBe(3)` + `a.accumulator` `toBeCloseTo(0)`; `b.advance(0.2)` `toBe(5)` + `toBeCloseTo(0)`; `c.advance(0.01)` `toBe(0)` + `toBeCloseTo(0.01)`; `:19` `a.step` `toBeCloseTo(1/60, 9)` | PASS |
| C13 | Alvo (0,2.5,-6) olhando (0,1,0) em heading 0; (-6,2.5,0) em π/2 | batch U · `✓ chase camera math > target is 6 m behind and 2.5 m above along heading` | carried from 181fd5d · `tests/unit/chaseCamera.test.ts:8-11` `t0.position.x`, `.y`, `.z` `toBeCloseTo(0)`, `(2.5)`, `(-6)`, `t0.lookAt` `toEqual({x:0,y:1,z:0})`; `:14-16` `t1.position.x`, `.y`, `.z` `toBeCloseTo(-6)`, `(2.5)`, `(0)` | PASS |
| C14 | Suavização `1 - exp(-5·dt)`: 0.393 em dt 0.1 | batch U · `✓ chase camera math > smoothing follows 1 - exp(-5 dt)` | carried from 181fd5d · `tests/unit/chaseCamera.test.ts:21` `smoothingFactor(0.1)` `toBeCloseTo(1 - Math.exp(-0.5), 6)`; `:22-23` `smoothingFactor(0)` `toBe(0)`, `smoothingFactor(10)` `toBeCloseTo(1)` | PASS |
| C15 | 7 teclas → 7 campos; tecla desconhecida não altera | batch U · `✓ input keymap > keymap table` | carried from 181fd5d · `tests/unit/input.test.ts:8-14` tabela `KeyW→throttle … KeyM→mute`; `:16` `expect(table.length).toBe(7)`; `:20` `expect(read(down)).toBe(expected)`; `:22` `expect(up).toEqual(createInputState())`; `:25-26` `applyKey(…, 'KeyQ', true)` `toEqual(createInputState())` | PASS |
| C16 | `generateCity(1337)` idêntico duas vezes; 1 ≠ 2 | batch U · `✓ CityGenerator > deterministic by seed` | carried from 181fd5d · `tests/unit/cityGenerator.test.ts:7` `JSON.stringify(generateCity(1337))` `toBe(JSON.stringify(generateCity(1337)))`; `:8` `generateCity(1)` `.not.toBe(generateCity(2))` | PASS |
| C17 | 64 quarteirões 40 m, ruas 12 m, bounds ±202 | batch U · `✓ CityGenerator > 8x8 grid of 40 m blocks with 12 m streets` | carried from 181fd5d · `tests/unit/cityGenerator.test.ts:14-17` `city.blocks.length` `toBe(64)`, `blockSize` `toBe(40)`, `streetWidth` `toBe(12)`, `bounds` `toBe(202)`; `:20-29` 8 xs/zs, passo `toBeCloseTo(52)`, extremos `±182` | PASS |
| C18 | 1-4 prédios por quarteirão, altura [10,60], base dentro | batch U · `✓ CityGenerator > buildings per block within bounds` | carried from 181fd5d · `tests/unit/cityGenerator.test.ts:36-37` `block.buildings.length` `>= 1`, `<= 4`; `:40-41` `b.height` `>= 10`, `<= 60`; `:42-45` `b.x ± b.width/2` e `b.z ± b.depth/2` dentro de `block ± half` | PASS |
| C19 | >= 1 letreiro por quarteirão; cores na paleta de 4 | batch U · `✓ CityGenerator > neon signs use the 4-color palette` | carried from 181fd5d · `tests/unit/cityGenerator.test.ts:52` `[...NEON_PALETTE]` `toEqual(['#ff2d95','#00e5ff','#b026ff','#ffd400'])`; `:57` `block.signs.length` `>= 1`; `:59` `palette.has(s.color)` `toBe(true)`; `:63` `used.size` `toBe(4)` | PASS |
| C20 | Postes a cada 40 m (± 0.01) nos dois lados; total = 2 × ruas × floor(L/40) | `npx vitest run tests/unit/cityGenerator.test.ts -t "lamp posts every 40 m on both sides"` exit 0 · `✓ CityGenerator > lamp posts every 40 m on both sides` (+ `npx vitest run` 46/46) | verified at 78c9795 · `tests/unit/cityGenerator.test.ts:93-94` `expected = 2 * (2 * streetsPerAxis) * Math.floor(streetLength / 40)`, `city.lamps.length` `toBe(expected)`; `:103` `groups.size` `toBe(2 * 2 * streetsPerAxis)`; `:106` `coords.length` `toBe(Math.floor(streetLength / 40))`; `:108` `coords[i] - coords[i - 1]` `toBeCloseTo(40, 2)`; fonte `src/world/CityGenerator.ts:14` `LAMP_SPACING = 40` | PASS |
| C21 | `renderer.info.render.calls` <= 60 | batch E · `[21/26] render.spec.ts:11:3 › draw calls at most 60` | carried from 181fd5d (valor 60 desatualizado desde 503b714, ver R4-2) · `tests/e2e/render.spec.ts:13-14` `expect(calls).toBeGreaterThan(0)`, `expect(calls).toBeLessThanOrEqual(60)` | PASS em 42e60a1; superseded por visual-upgrade C8 (≤ 120, `render.spec.ts:11:3` verde em 78c9795) |
| C22 | Letreiro, janela e cabeça de poste com emissiveIntensity >= 2 | `npx playwright test tests/e2e/render.spec.ts` exit 0 · `✓ 2 render.spec.ts:18:3 › render › neon emissive intensity at least 2` | verified at 78c9795 · `tests/e2e/render.spec.ts:20` `m.windowEmissiveIntensity` `toBeGreaterThanOrEqual(2)`; `:22` `m.lampEmissiveIntensity` `toBeGreaterThanOrEqual(2)`; `:23-24` `m.signEmissiveIntensities.length` `toBe(4)`, cada `v` `toBeGreaterThanOrEqual(2)`; getters `src/core/Game.ts:517-519,539-544`; fonte `src/world/CityScene.ts:304` janela `2.2` (o `WINDOW_BRIGHTNESS` 0.7 de `:22` só entra no GLSL `:379`, ver R4-1) | PASS |
| C23 | Rua roughness <= 0.25; `scene.environment` não nulo | batch E · `[23/26] render.spec.ts:27:3 › wet road material and environment map` | carried from 181fd5d · `tests/e2e/render.spec.ts:30-31` `expect(roughness).toBeLessThanOrEqual(0.25)`, `expect(hasEnv).toBe(true)` | PASS |
| C24 | Composer com UnrealBloomPass habilitado; toneMapping ACES | batch E · `[24/26] render.spec.ts:35:3 › bloom pass and ACES tone mapping` | carried from 181fd5d · `tests/e2e/render.spec.ts:40-42` `expect(info.passes).toContain('UnrealBloomPass')`, `expect(info.bloomEnabled).toBe(true)`, `expect(info.aces).toBe(true)` | PASS |
| C25 | `formatSpeed` 13.9→"50", -2.0→"7", 0.27→"1" | batch U · `✓ hud format > speed in kmh as integer` | carried from 181fd5d · `tests/unit/hudFormat.test.ts:7-9` `formatSpeed(13.9)` `toBe('50')`, `formatSpeed(-2.0)` `toBe('7')`, `formatSpeed(0.27)` `toBe('1')` | PASS |
| C26 | HUD mostra `speedKmh` arredondado, tolerância 3 km/h (declarada no check) | batch E · `[13/26] hud.spec.ts:6:3 › speed label matches car state` | verified at 42e60a1 · `tests/e2e/hud.spec.ts:15` `expect(Number(label)).toBeGreaterThan(10)`; `:17` `expect(Math.abs(Number(label) - Math.round(Math.abs(kmh as number)))).toBeLessThanOrEqual(3)`; escrita em `src/hud/Hud.ts:21` `this.speedEl.textContent = speed` | PASS |
| C27 | 7 faixas de marcha, 9 amostras | batch U · `✓ drivetrain > gear bands` | carried from 181fd5d · `tests/unit/drivetrain.test.ts:59-69` tabela `[-5,-1],[0,1],[29.9,1],[30,2],[60,3],[95,4],[130,5],[170,6],[200,6]`; `:71` `expect(gearFor(kmh)).toBe(gear)`; `:73` `new Set(...).size` `toBe(7)` | PASS |
| C28 | RPM 1000/4000/6980/1000 a 0/15/29.9/30; sempre em [1000,7000] | batch U · `✓ drivetrain > rpm within gear band` | carried from 181fd5d · `tests/unit/drivetrain.test.ts:78-81` `rpmFor(0)` `toBeCloseTo(1000, 3)`, `rpmFor(15)` → `4000`, `rpmFor(29.9)` → `6980`, `rpmFor(30)` → `1000`; `:84-85` varredura -50..250 `rpm >= 1000` e `<= 7000` | PASS |
| C29 | -1 → "R"; barra = (rpm-1000)/6000 × 100 % | batch U · `✓ hud format > gear label and rpm bar width` | carried from 181fd5d · `tests/unit/hudFormat.test.ts:15-17` `gearLabel(-1)` `toBe('R')`, `gearLabel(1)` `toBe('1')`, `gearLabel(6)` `toBe('6')`; `:18-20` `rpmBarWidth(1000)` `toBeCloseTo(0)`, `(4000)` → `50`, `(7000)` → `100` | PASS |
| C30 | Carro → (80,80); +160 m x → x=160; -160 m z → y=0; canvas 160 px | batch U · `✓ minimap math > 320 m window into 160 px` | carried from 181fd5d · `tests/unit/minimap.test.ts:7-8` `MINIMAP_SIZE_PX` `toBe(160)`, `MINIMAP_WINDOW_M` `toBe(320)`; `:10-12` `worldToMinimap(10,-40,car)` `toEqual({x:80,y:80})`, `(170,-40)` → `{x:160,y:80}`, `(10,-200)` → `{x:80,y:0}` | PASS |
| C31 | Overlay `Carregando...` visível antes de ready, `display: none` depois | batch E · `[14/26] hud.spec.ts:21:3 › loading overlay shows then hides` | verified at 42e60a1 · `tests/e2e/hud.spec.ts:24-25` `expect(loading).toBeVisible()`, `toContainText('Carregando...')`; `:27-28` `expect(loading).toBeHidden()`, `toHaveCSS('display', 'none')`; `:29` `#hud` `toBeVisible()` | PASS |
| C32 | Sem WebGL2: overlay `Seu navegador não suporta WebGL2`, `__game` indefinido | batch E · `[15/26] hud.spec.ts:33:3 › webgl2 missing shows error overlay` | verified at 42e60a1 · `tests/e2e/hud.spec.ts:43-44` `expect(error).toBeVisible()`, `toHaveText('Seu navegador não suporta WebGL2')`; `:47` `expect(hasGame).toBe(false)`; `:48` `#loading` `toBeHidden()` | PASS |
| C33 | GLB abortado: `console.warn` com `/models/car.glb`, `placeholder` true, >= 50 km/h em 5 s | batch E · `[16/26] hud.spec.ts:52:3 › missing glb falls back to box chassis` | verified at 42e60a1 · `tests/e2e/hud.spec.ts:60` `expect(warnings.some((w) => w.includes('/models/car.glb'))).toBe(true)`; `:62` `expect(placeholder).toBe(true)`; `:67` `expect(reached).toBe(true)` (warn observado no log do batch E: `Falha ao carregar /models/car.glb; usando chassi placeholder`) | PASS |
| C34 | `exposeDebug` só define `__game` com `DEV: true` | batch U · `✓ exposeDebug > debug handle only in DEV` | carried from 181fd5d · `tests/unit/exposeDebug.test.ts:11` `expect(prod.__game).toBeUndefined()`; `:15` `expect(dev.__game).toBe(game)`; montagem `src/main.ts:40` `exposeDebug(import.meta.env, game.debugHandle(), window …)` (`main.ts` e `exposeDebug.ts` não tocados pelo fix; `exposeDebug.ts:11-12` `if (!env.DEV) return; target.__game = game` relido em 42e60a1) | PASS |
| C35 | `audio.state` idle → running na 1ª tecla; nós existem | batch E · `[1/26] audio.spec.ts:10:3 › first keypress starts audio` | verified at 42e60a1 · `tests/e2e/audio.spec.ts:11` `expect(await page.evaluate(() => __game.audio.state)).toBe('idle')`; `:12-13` `press('KeyW')` + `waitForFunction(() => __game.audio.state === 'running')`; `:15-16` `expect(gains.engine).toBeGreaterThan(0)`, `expect(gains.ambient).toBeGreaterThan(0)`; fonte `src/audio/AudioEngine.ts:23-62` `start()` cria os nós e `:61` `this.state = 'running'` | PASS |
| C36 | `engineFrequency` 1000→60, 4000→130, 7000→200 | batch U · `✓ audio map > rpm maps linearly to 60..200 Hz` | carried from 181fd5d · `tests/unit/audioMap.test.ts:7-9` `engineFrequency(1000)` `toBeCloseTo(60, 6)`, `(4000)` → `130`, `(7000)` → `200` | PASS |
| C37 | Ganhos ambient 0.3, engine 0.5, master 1 | batch E · `[2/26] audio.spec.ts:20:3 › gains are 0.3 ambient 0.5 engine` | verified at 42e60a1 · `tests/e2e/audio.spec.ts:24-26` `expect(gains.ambient).toBeCloseTo(0.3, 6)`, `expect(gains.engine).toBeCloseTo(0.5, 6)`, `expect(gains.master).toBeCloseTo(1, 6)`; fonte `src/audio/AudioEngine.ts:29` master `this.muted ? 0 : 1`, `:42` `ENGINE_GAIN`, `:56` `AMBIENT_GAIN`; getter `Game.ts:254-256` | PASS |
| C38 | M: master 1→0, depois 0→1 | batch E · `[4/26] audio.spec.ts:41:3 › M toggles master gain` | verified at 42e60a1 · `tests/e2e/audio.spec.ts:44-45` `press('KeyM')` + `.master` `toBeCloseTo(0, 6)`; `:46-47` `press('KeyM')` + `.master` `toBeCloseTo(1, 6)`; fonte `src/audio/AudioEngine.ts:69-72` `toggleMute()` `this.master.gain.value = this.muted ? 0 : 1` | PASS |
| C39 | 9 módulos puros (incl. `exposeDebug.ts`) não importam three/rapier por `from`, `import '…'`, `import()` ou `require()` | batch U · `✓ pure modules > pure modules do not import three or rapier` | verified at 42e60a1 · `tests/unit/purity.test.ts:6-16` `PURE_MODULES` = os 9 caminhos do check, `:11` `'src/core/exposeDebug.ts'`; `:19` `FORBIDDEN` = regex com alternação de 4 prefixos (`from\s+`, `import\s+`, `import\s*\(`, `require\s*\(`) seguidos de `'three'` ou `'@dimforge/rapier3d-compat'` com subpath opcional; `:23` `expect(PURE_MODULES.length).toBe(9)`; `:26` `expect(FORBIDDEN.test(source), rel).toBe(false)`; `:27` `expect(source.length, rel).toBeGreaterThan(0)` | PASS |
| C40 | 4 rodas; controlador `DynamicRayCastVehicleController` | batch E · `[5/26] drive.spec.ts:10:3 › rapier vehicle controller with 4 wheels` | carried from 181fd5d · `tests/e2e/drive.spec.ts:15-16` `expect(info.wheelCount).toBe(4)`, `expect(info.controllerKind).toBe('DynamicRayCastVehicleController')`; `instanceof` em `src/core/Game.ts:171-176` relido em 42e60a1, inalterado | PASS |
| C41 | Montagem lança → overlay começa com `Falha ao iniciar o jogo:`, `__game` indefinido | batch E · `[18/26] hud.spec.ts:83:3 › hud - rodada 2 › boot failure shows error overlay` | verified at 42e60a1 · `tests/e2e/hud.spec.ts:91-92` `expect(error).toBeVisible()`, `expect(error).toContainText(/^Falha ao iniciar o jogo:/)`; `:94` `expect(await page.evaluate(() => window.__game !== undefined)).toBe(false)`; `:95` `#loading` `toBeHidden()`; gatilho `:84-88` remove `#minimap` em `DOMContentLoaded`; lança em `src/core/Game.ts:82` `throw new Error('HUD: #minimap não encontrado')` (relido, inalterado); texto em `src/main.ts:36` (não tocado) | PASS |
| C42 | Canvas real 160×160; >= 10 px `#ff7a1a` em ±10 px do centro; >= 100 px `#2b2d3d`; em heading π/2 a ponta fica à direita: laranja com x >= 84 e nenhum com x < 74 | batch E · `[19/26] hud.spec.ts:99:3 › hud - rodada 2 › minimap draws blocks and car` | verified at 42e60a1 · `tests/e2e/hud.spec.ts:119-120` `expect(result.width).toBe(160)`, `expect(result.height).toBe(160)`; `:121` `expect(result.car).toBeGreaterThanOrEqual(10)`; `:122` `expect(result.blocks).toBeGreaterThanOrEqual(100)`; `:125` `teleport(page, 0, 1.2, 0, Math.PI / 2)`; `:133-138` varredura y 70..90, x 60..100 por RGB exato (255,122,26) guardando `minX`/`maxX`; `:144` `expect(tip.maxX).toBeGreaterThanOrEqual(84)`; `:145` `expect(tip.minX).toBeGreaterThanOrEqual(74)`; fonte `src/hud/Minimap.ts:35-36` `translate(80,80)` + `ctx.rotate(-state.heading)`, `:39-41` triângulo (0,7),(-5,-5),(5,-5): com heading π/2 a ponta cai em x = 87 e a base em x = 75 (frente = +x do mundo, consistente com C13 e com `worldToMinimap` de C30, +x → direita) | PASS |
| C43 | Carro parado 2 s: câmera a < 0.1 m de `(x - 6 sin h, y + 2.5, z - 6 cos h)` | batch E · `[25/26] render.spec.ts:46:3 › camera sits 6 m behind and 2.5 m above` | carried from 181fd5d · `tests/e2e/render.spec.ts:47` `advanceSim(page, 2)`; `:52-56` `expected = { x: car.x - 6 * Math.sin(car.heading), y: car.y + 2.5, z: car.z - 6 * Math.cos(car.heading) }`; `:58` `expect(dist).toBeLessThan(0.1)`; getter `src/core/Game.ts:201-204` relido em 42e60a1, inalterado | PASS |
| C44 | Após 1.5 s de W: `#gear` = `gearLabel(car.gear)` lido no mesmo evaluate, gear >= 2; `#rpm-fill` em [0,100] e a < 15 pontos de `rpmBarWidth(car.rpm)` | batch E · `[20/26] hud.spec.ts:149:3 › hud - rodada 2 › gear and rpm bar match car state` | verified at 42e60a1 · `tests/e2e/hud.spec.ts:152` `advanceSim(page, 1.5)`; `:153-161` um único `page.evaluate` lê `#gear`, `#rpm-fill`, `g.car.gear`, `g.car.rpm`; `:163` `expect(sample.gear).toBeGreaterThanOrEqual(2)`; `:164` `expect(sample.gearLabel).toBe(String(sample.gear))` (igual a `gearLabel(gear)` no domínio afirmado gear >= 2, ver C29 `gearLabel(1)` → `'1'`); `:165` `expectedWidth = ((sample.rpm - 1000) / 6000) * 100`; `:166-168` `rpmWidth` `toBeGreaterThanOrEqual(0)`, `toBeLessThanOrEqual(100)`, `Math.abs(sample.rpmWidth - expectedWidth)` `toBeLessThan(15)`; fonte `src/hud/Hud.ts:24-26` `gearLabel(state.gear)` → `#gear`, `:29` `rpmBarWidth(state.rpm).toFixed(1)%`; getters `Game.ts:186-191` | PASS |
| C45 | Bloom (0.8, 0.4, 0.7) na ordem RenderPass→Bloom→OutputPass; timestep 1/60 com tolerância 1e-6 (float32); seed 1337; força só nas rodas 2 e 3 com W | batch E · `[26/26] render.spec.ts:62:3 › landing door literals` | verified at 42e60a1 (texto do check; `render.spec.ts` não tocado, citações de 181fd5d) · `tests/e2e/render.spec.ts:72` `expect(info.passes).toEqual(['RenderPass', 'UnrealBloomPass', 'OutputPass'])`; `:73-75` `info.bloom.strength` `toBeCloseTo(0.8, 6)`, `.radius` → `0.4`, `.threshold` → `0.7`; `:77` `info.timestep` `toBeCloseTo(1 / 60, 6)` (tolerância efetiva 5e-7, dentro do 1e-6 agora declarado; float32(1/60) difere de 1/60 por ~9e-10); `:78` `expect(info.seed).toBe(1337)`; `:84-87` `forces[0]` `toBe(0)`, `forces[1]` `toBe(0)`, `forces[2]` `toBeGreaterThan(0)`, `forces[3]` `toBeGreaterThan(0)`; fontes `src/core/Game.ts:75-78` (passes), `:56` `this.world.timestep = 1 / 60` (relidas, inalteradas), `src/world/CityGenerator.ts:15,185`, `src/vehicle/Car.ts:39-40,115-124` | PASS |
| C46 | Grafo do motor Osc(sawtooth)→Biquad(lowpass)→Gain; ambiente BufferSource(loop)→Biquad(lowpass)→Gain; ambos no master; sem `<audio>` nem arquivos de som | batch E · `[3/26] audio.spec.ts:30:3 › audio › synthesized audio graph` | verified at 42e60a1 · `tests/e2e/audio.spec.ts:33` `graph = await page.evaluate(() => __game.audio.graph)`; `:34` `expect(graph.engine).toEqual(['OscillatorNode(sawtooth)', 'BiquadFilterNode(lowpass)', 'GainNode'])`; `:35` `expect(graph.ambient).toEqual(['AudioBufferSourceNode(loop)', 'BiquadFilterNode(lowpass)', 'GainNode'])`; `:36` `expect(graph.masterConnected).toBe(true)`; `:37` `expect(await page.locator('audio').count()).toBe(0)`; fonte `src/audio/AudioEngine.ts:34` `type = 'sawtooth'`, `:37` `'lowpass'`, `:49` `loop = true`, `:52` `'lowpass'`, `:43` e `:57` cadeias `.connect(...).connect(this.master)`, `:30` master → `ctx.destination`; `graph()` `:87-103` lê `constructor.name`, `type` e `loop` reais dos nós; getter `Game.ts:257-259`. Cláusula "nem arquivos de som" provada por varredura, não pela prova: `find public src -iname "*.mp3" -o ... "*.ogg"` vazio; `grep decodeAudioData, new Audio(, <audio` em `src/` e `index.html` sem ocorrência; ruído gerado em `:106-112` `makeNoiseBuffer` (finding 1) | PASS |

Swept rows relidas contra o código em 42e60a1 (as demais carregadas de 181fd5d):

- state transitions (C35, C38): `src/audio/AudioEngine.ts:24,61` (`idle` → `running`, idempotente
  por `if (this.state === 'running') return`), `:69-72` (mute) - presentes.
- failure modes (C41): `src/core/Game.ts:82` (lança) e `src/main.ts:34-38` (`catch`) - presentes;
  `main.ts` não tocado.
- validation, concurrency, dependency failure, observability: carried from 181fd5d (fontes não
  tocadas pelo fix).

## Coverage

Linhas cujas autoridades o fix tocou (`AudioEngine.ts`, `Game.ts`, `hud.spec.ts`, `audio.spec.ts`,
`purity.test.ts`, lista de C39, texto de C42/C44) foram recalculadas a partir do código em 42e60a1
(`verified at 42e60a1`); as demais são `carried from 181fd5d`. Varredura por conjuntos sem linha:
`minimap heading samples (2)` acrescentado porque C42 agora enumera dois headings; `audio graph
nodes (6)` recontado do código. Nenhum outro conjunto novo (o fix não adicionou ramo).

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| keymap (7) | carried from 181fd5d · `src/core/input.ts:19-27` `KEYMAP` | C15, tabela `tests/unit/input.test.ts:8-14` + `table.length` `toBe(7)` | - |
| gear bands (7) | carried from 181fd5d · `src/vehicle/drivetrain.ts:44-51` (6 faixas) + `:58` (`-1`) | C27, 9 amostras cobrindo os 7 valores + `Set.size` `toBe(7)` (`tests/unit/drivetrain.test.ts:59-73`) | - |
| steering samples (4) | carried from 181fd5d · claim C6 (0, 75, 150, 200 km/h) | C6 `tests/unit/drivetrain.test.ts:33-36` | - |
| throttle/brake regimes (4) | carried from 181fd5d · `src/vehicle/drivetrain.ts:86` throttle · `:91` freio · `:96` ré · `:103` freio de mão | throttle C8 + C1 · freio C2 + C3 · ré C4 + C5 · freio de mão C7 | - |
| speed cap edges (2) | carried from 181fd5d · `src/vehicle/drivetrain.ts:86` `speedKmh < 220` | 219 C8 · 220 C8 (+230) | - |
| reverse cutoff edges (3) | carried from 181fd5d · `src/vehicle/drivetrain.ts:32,96` `> -29.5` | -29 C4 · -30 C4 · -31 C4 (`tests/unit/drivetrain.test.ts:26-28`) + fronteira C5 `>= -30` | - |
| stepper cases (3) | carried from 181fd5d · `src/core/FixedStepper.ts:23-30` | 0.05 C12 · 0.2 C12 · 0.01 C12 | - |
| neon palette (4) | carried from 181fd5d · `src/world/CityGenerator.ts:17` | C19 `toEqual([4 cores])` + `used.size` `toBe(4)` | - |
| boot/loader outcomes (4) | verified at 42e60a1 · `src/main.ts:20-23` sem WebGL2 · `:27-33` ok · `src/core/Loader.ts:34-36` GLB falha · `src/main.ts:34-38` `catch` do boot (fontes não tocadas; provas em `hud.spec.ts` relidas) | sem WebGL2 C32 (`hud.spec.ts:43-47`) · ok C31 (`:24-29`) / C1 · GLB falha C33 (`:60-67`) · catch do boot C41 (`:92,94`) | - |
| overlays (2) | verified at 42e60a1 · `index.html:11` `#loading` · `:16` `#error` | loading C31 (`hud.spec.ts:24-28`) · error C32 (`:43-44`) e C41 (`:91-92`) | - |
| minimap elements (4) | verified at 42e60a1 · `src/hud/Minimap.ts:13-14` canvas 160 · `src/hud/minimapMath.ts:7` janela 320 m · `Minimap.ts:26-31` quarteirões · `:34-44` triângulo com `:36` `ctx.rotate(-state.heading)` | canvas real C42 (`hud.spec.ts:119-120`) + constante C30 · janela C30 · quarteirões C42 (`:122`) · triângulo rotacionado por heading C42 (`:121` centro em heading 0; `:144-145` ponta à direita em heading π/2) - o precision gap da rodada 2 está fechado | - |
| minimap heading samples (2) | verified at 42e60a1 · claim C42 (heading 0 após `gotoGame`; heading π/2 via `teleport`) | 0 C42 (`hud.spec.ts:121`) · π/2 C42 (`:125,144-145`) | - |
| hud elements (3) | verified at 42e60a1 · `src/hud/Hud.ts:21` `#speed` · `:26` `#gear` · `:29` `#rpm-fill` | speed C26 (`hud.spec.ts:17`) · gear C44 (`:164`, comparado ao `car.gear` do mesmo evaluate) · rpm bar C44 (`:166-168`) | - |
| bloom literals (3) | carried from 181fd5d · `src/core/Game.ts:76` `new UnrealBloomPass(…, 0.8, 0.4, 0.7)` (linha relida, inalterada) | strength C45 (`render.spec.ts:73`) · radius C45 (`:74`) · threshold C45 (`:75`) | - |
| pass order (3) | carried from 181fd5d · `src/core/Game.ts:75-78` `addPass` ×3 (relidas, inalteradas) | C45 `render.spec.ts:72` `toEqual([RenderPass, UnrealBloomPass, OutputPass])` | - |
| engine force per wheel (4) | carried from 181fd5d · `src/vehicle/Car.ts:39-40` `FRONT = [0, 1]`, `REAR = [2, 3]`; `:115-124` | roda 0 C45 (`render.spec.ts:84`) · roda 1 C45 (`:85`) · roda 2 C45 (`:86`) · roda 3 C45 (`:87`) | - |
| emissive materials (3) | verified at 78c9795 · `src/world/CityScene.ts:304` janela 2.2 (fachada, 4 tipos) · `:109` poste 2.5 · `:247` letreiro 2.6 (4 cores) | janela C22 (`render.spec.ts:20`) · poste C22 (`:22`) · letreiro C22 (`:23-24`) | - |
| lamp groups (28) | verified at 78c9795 · `src/world/CityGenerator.ts` `streetsFor()` 7 ruas em x + 7 em z · `:189` lados `[-1, 1]` · `:184` 10 postes por lado (`floor(404/40)`) | 28 grupos C20 (`cityGenerator.test.ts:103`) · 10 por grupo C20 (`:106`) · espaçamento 40 C20 (`:108`) · total 280 C20 (`:94`) | - |
| audio graph nodes (6) | verified at 42e60a1 · `src/audio/AudioEngine.ts:33-34` osc sawtooth · `:36-37` filtro lowpass 900 Hz · `:41-42` gain motor · `:47-49` buffer source loop · `:51-52` filtro lowpass 420 Hz · `:55-56` gain ambiente | engine osc C46 (`audio.spec.ts:34` posição 0) · engine filter C46 (`:34` posição 1) · engine gain C46 (`:34` posição 2) · ambient source C46 (`:35` posição 0) · ambient filter C46 (`:35` posição 1) · ambient gain C46 (`:35` posição 2) | - |
| audio gains (3) | verified at 42e60a1 · `src/audio/AudioEngine.ts:29` master · `:42` engine `ENGINE_GAIN` · `:56` ambient `AMBIENT_GAIN` | master C37 (`audio.spec.ts:26`) · engine C37 (`:25`) · ambient C37 (`:24`) | - |
| mute transitions (2) | verified at 42e60a1 · `src/audio/AudioEngine.ts:69-72` `toggleMute()` | 1→0 C38 (`audio.spec.ts:45`) · 0→1 C38 (`:47`) | - |
| rpm samples (4) | carried from 181fd5d · claim C28 | 0 · 15 · 29.9 · 30 C28 (`tests/unit/drivetrain.test.ts:78-81`) + varredura | - |
| landing doors (9) | verified at 42e60a1 · plano `## Landing` linhas 1-9 (não tocado) | 1 C39 (9 módulos) · 2 C40 + C45 (tração traseira) · 3 C24 + C45 (bloom literais, ordem) · 4 C34 · 5 C12 + C45 (timestep, tolerância declarada) · 6 C16 + C45 (seed 1337) · 7 C33 · 8 C35 + C46 (tipos de nó, sawtooth, lowpass, ruído em loop, sem `<audio>`) · 9 C25 | - |
| startup config: debug handle (1 assembly) | carried from 181fd5d · `src/main.ts:40` `exposeDebug(import.meta.env, game.debugHandle(), window …)` (`main.ts` não tocado) | C34 (função) + montagem confirmada por leitura | - |
| pure modules (9) | verified at 42e60a1 · `tests/unit/purity.test.ts:6-16` = os 9 arquivos de C39; varredura de `src/**/*.ts` (21 arquivos) por import de `three`/`@dimforge`: os 9 listados não importam; os outros 6 sem import (`AudioEngine.ts`, `GameLoop.ts`, `InputManager.ts`, `Hud.ts`, `Minimap.ts`, `main.ts`) tocam DOM, Web Audio ou `requestAnimationFrame` e não são "lógica pura" pela porta 1; nenhum módulo puro fora da lista | C39, tabela sobre os 9, 4 formas de import + `length` `toBe(9)` | - |

Claims cruzando a fronteira do browser (lista do autor: C1, C3, C5, C9-C11, C21-C24, C26,
C31-C33, C35, C37, C38, C40-C46): confirmado, cada um tem prova Playwright acima (C46 novo em
`audio.spec.ts:30`). Nenhum check nomeia estado, rota ou shape que só tenha prova abaixo da
fronteira.

## Test policy rows

Re-julgadas: as linhas que classificam arquivos tocados (`src/audio/AudioEngine.ts`,
`src/core/Game.ts` - ambos em "Instrumentation, pass-throughs") e a linha de `InputManager`
(finding residual 5 da rodada 2). As demais carregadas de 181fd5d.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/vehicle/drivetrain.ts` · `src/core/Loader.ts` (+ `src/main.ts` na tabela do autor) | carried from 181fd5d · drivetrain: fronteira C1, C3, C5 · camada própria C2, C4 (3 arestas de ré), C6-C8, C27, C28 (7 marchas, 4 regimes, 2 arestas de cap, 4 amostras de direção). Loader/main: fronteira C31 (ok), C32 (WebGL2), C33 (GLB), C41 (catch) | yes |
| Decides, not reached across a boundary | `src/core/input.ts` · `src/core/FixedStepper.ts` · `src/camera/chaseMath.ts` · `src/world/CityGenerator.ts` · `src/hud/format.ts` · `src/hud/minimapMath.ts` · `src/audio/audioMap.ts` · `src/core/exposeDebug.ts` | carried from 181fd5d; `CityGenerator.ts` re-julgado em 78c9795 (C20 a 40 m, 4 superfícies mortas) · C15 · C12 · C13, C14 · C16-C20 · C25, C29 · C30 · C36 · C34 (e agora também C39 varre `exposeDebug.ts`) | yes |
| Entry point that decides nothing | `src/main.ts` · `src/core/InputManager.ts` | verified at 42e60a1 · main.ts: entrada aceita C31; error paths: sem WebGL2 C32, `catch` do boot C41 (`hud.spec.ts:92,94`). InputManager: primeira tecla C35 (`audio.spec.ts:11-13`) e C46; teclas seguradas C1-C11; `src/core/InputManager.ts:39` `if (event.repeat) return` continua sem prova própria - pass-through coberto pelas provas que seguram teclas (finding 4), sem exigência desta linha | yes |
| Instrumentation, pass-throughs | `src/vehicle/Car.ts` · `src/world/CityScene.ts` · `src/world/Environment.ts` · `src/core/Game.ts` · `src/core/GameLoop.ts` · `src/hud/Hud.ts` · `src/audio/AudioEngine.ts` · `src/camera/ChaseCamera.ts` · `src/hud/Minimap.ts` | verified at 42e60a1 · AudioEngine C35 (`start()` `:23-62`), C37 (ganhos `:29,42,56`), C38 (`toggleMute` `:69-72`), C46 (`graph()` `:87-103` lê `type`/`loop`/`constructor.name` reais dos nós; instrumentação nova coberta pelo consumidor `audio.spec.ts:34-37`) · Game C21-C24, C41 (`:82`), C43-C45 (getters inalterados), C46 (getter `:257-259`) · Hud C26 (`#speed`) + C44 (`#gear`, `#rpm-fill`, `Hud.ts:24-29`) · Minimap C42 (`hud.spec.ts:119-122,144-145`, incluindo `Minimap.ts:36` `rotate`) · Car C1-C11, C40, C45 · CityScene C21-C23 (re-julgado em 78c9795: `WINDOW_BRIGHTNESS` é pass-through de shader; C22 cobre a propriedade, R4-1) · Environment C23 · GameLoop C1 · ChaseCamera C43 (carried) | yes |

## Faults injected

Baseline `git status --porcelain` da árvore real: vazio. Worktree de rascunho em
`<scratchpad>/verify-wt3` (HEAD 42e60a1, `git worktree add`) com junção `mklink /J` para
`node_modules`; cada mutação revertida com `git checkout -- <arquivo>` antes da seguinte
(porcelain do worktree vazio após cada revert); junção (`rmdir`) e worktree
(`git worktree remove --force`) removidos ao final; `git worktree list` só com a árvore real;
porcelain final da árvore real: vazio (igual ao baseline; `verification.md` foi reescrito depois).
Provas Playwright rodadas de dentro do worktree, uma invocação por vez; como
`playwright.config.ts` tem `reuseExistingServer: true`, antes de cada uma confirmei 0 listeners
em `:5173` (`netstat -ano`), garantindo que o Vite servido era o do worktree mutado. Uma falha
por superfície de asserção nova ou endurecida pelo fix; cada uma derruba uma prova diferente.

Rodada 4: baseline porcelain da árvore real vazio; worktree `<scratchpad>/verify-c20` em 78c9795 com junção `mklink /J` para `node_modules`; `git checkout -- <arquivo>` entre mutantes (porcelain do worktree vazio após cada um); vitest dentro do worktree; Playwright com `E2E_PORT=5179` (0 listeners antes). Junção removida com `cmd //c rmdir`, worktree com `git worktree remove --force`; `git worktree list` = árvore real + `Jogo-terrain` (intocado); porcelain final da árvore real vazio antes de reescrever este relatório.

| Mutation | Location | Killed |
| --- | --- | --- |
| carried from c58edf6 · `GEAR_BANDS` `[30, 60]` → `[31, 60]` | `src/vehicle/drivetrain.ts:46` | yes - `vitest … -t "gear bands"` exit 1: `gear at 30 km/h: expected 1 to be 2` (C27) |
| carried from c58edf6 (teste renomeado em 78c9795; superfície re-injetada abaixo) · `LAMP_SPACING` `20` → `21` | `src/world/CityGenerator.ts:14` | yes - `vitest … -t "lamp posts every 20 m on both sides"` exit 1: `expected 532 to be 560` (C20) |
| carried from c58edf6 · `maxSteps` `5` → `6` | `src/core/FixedStepper.ts:16` | yes - `vitest … -t "steps at 1/60 with a cap of 5"` exit 1: `expected 6 to be 5` (C12) |
| carried from c58edf6 · ramo de falha do GLB devolve `placeholder: false` | `src/core/Loader.ts:36` | yes - `playwright … -g "missing glb falls back to box chassis"` exit 1: `hud.spec.ts:62` Received: false (C33) |
| carried from c58edf6 · `reset()` levanta `t.y + 3` em vez de `t.y + 1` | `src/vehicle/Car.ts:176` | yes - `playwright … -g "reset puts car upright"` exit 1: `drive.spec.ts:104` Expected 1.5975 Received 3.5975 (C11) |
| carried from 181fd5d · `REVERSE_CUTOFF_KMH = MAX_REVERSE_KMH - 0.5` → `+ 0.5` | `src/vehicle/drivetrain.ts:32` | yes - `vitest … -t "reverse below 1 kmh and capped at 30"` exit 1: `expected -2500 to be +0` (C4, `drivetrain.test.ts:27`) |
| carried from 181fd5d · texto do catch `Falha ao iniciar o jogo: ` → `Erro: ` | `src/main.ts:36` | yes - `playwright … -g "boot failure shows error overlay"` exit 1: `hud.spec.ts:92` Received `"Erro: HUD: #minimap não encontrado"` (C41) |
| carried from 181fd5d · culling de quarteirões sempre verdadeiro (nenhum quarteirão desenhado) | `src/hud/Minimap.ts:29` | yes - `playwright … -g "minimap draws blocks and car"` exit 1: `hud.spec.ts:122` Expected >= 100 Received 0 (C42) |
| carried from 181fd5d · alvo da câmera `t.position.y` → `t.position.y + 1` | `src/camera/ChaseCamera.ts:23` | yes - `playwright … -g "camera sits 6 m behind and 2.5 m above"` exit 1: `render.spec.ts:58` Expected < 0.1 Received 0.99999999 (C43) |
| carried from 181fd5d · HUD escreve `gearLabel(state.gear + 1)` (contra a asserção antiga `toBe('2')`) | `src/hud/Hud.ts:24` | yes - `playwright … -g "gear and rpm bar match car state"` exit 1: `hud.spec.ts:141` Expected "2" Received "3" (C44, versão da rodada 2) |
| carried from 181fd5d · `UnrealBloomPass(…, 0.8, 0.4, 0.7)` → `0.9, 0.4, 0.7` | `src/core/Game.ts:76` | yes - `playwright … -g "landing door literals"` exit 1: `render.spec.ts:73` Expected 0.8 Received 0.9 (C45) |
| verified at 42e60a1 · `import 'three';` inserido na linha 1 de `exposeDebug.ts` (9º módulo puro) | `src/core/exposeDebug.ts:1` | yes - `npx vitest run tests/unit/purity.test.ts -t "pure modules do not import three or rapier"` exit 1: `AssertionError: src/core/exposeDebug.ts: expected true to be false` (C39, `purity.test.ts:26`) |
| verified at 42e60a1 · linha `ctx.rotate(-state.heading);` removida (triângulo nunca gira) | `src/hud/Minimap.ts:36` | yes - `npx playwright test tests/e2e/hud.spec.ts -g "minimap draws blocks and car"` exit 1: `hud.spec.ts:144` `expect(tip.maxX).toBeGreaterThanOrEqual(84)` Expected >= 84 Received 83 (C42; margem de 1 px, finding 2) |
| verified at 42e60a1 · oscilador do motor `'sawtooth'` → `'square'` | `src/audio/AudioEngine.ts:34` | yes - `npx playwright test tests/e2e/audio.spec.ts -g "synthesized audio graph"` exit 1: `audio.spec.ts:34` `expect(graph.engine).toEqual([...])` deep equality, 1 elemento diferente (C46) |
| verified at 42e60a1 · HUD escreve `gearLabel(state.gear + 1)` (contra a asserção nova `toBe(String(sample.gear))`) | `src/hud/Hud.ts:24` | yes - `npx playwright test tests/e2e/hud.spec.ts -g "gear and rpm bar match car state"` exit 1: `hud.spec.ts:164` Expected "2" Received "3" (C44, versão sem valor fixo) |
| verified at 78c9795 · `LAMP_SPACING` `40` → `20` | `src/world/CityGenerator.ts:14` | yes - `npx vitest run tests/unit/cityGenerator.test.ts -t "lamp posts every 40 m on both sides"` exit 1: `expected 560 to be 280` em `cityGenerator.test.ts:94` (C20 total) |
| verified at 78c9795 · os dois postes no mesmo lado (`s * side` → `Math.abs(s) * side`) | `src/world/CityGenerator.ts:191,193` | yes - mesma prova exit 1: `expected 14 to be 28` em `:103` (C20 "dois lados") |
| verified at 78c9795 · contagem por eixo desbalanceada (`i < count + (axis === "x" ? 1 : -1)`; total segue 280) | `src/world/CityGenerator.ts:187` | yes - mesma prova exit 1: `x:-161.400: expected 11 to be 10` em `:106` (C20 por rua) |
| verified at 78c9795 · primeiro poste deslocado 5 m (`+ (i === 0 ? 5 : 0)`) | `src/world/CityGenerator.ts:188` | yes - mesma prova exit 1: `x:-161.400: expected 35 to be close to 40, received difference is 5` em `:108` (C20 espaçamento) |
| verified at 78c9795 · janela `emissiveIntensity` `2.2` → `1.9` | `src/world/CityScene.ts:304` | yes - `E2E_PORT=5179 npx playwright test tests/e2e/render.spec.ts -g "neon emissive intensity at least 2"` exit 1: `render.spec.ts:20:39` Expected >= 2 Received 1.9 (C22) |

## Gate

`cd "C:/Users/arthu/.claude/skills/tlc-spec-lean/scripts" && python validate_verification.py free-roam-city --root "C:/Users/arthu/source/repos/Jogo"` - exit 0:

```
validate_verification: 0 error(s), 0 warning(s) across [free-roam-city]
```

Rodada 4, provas em `HEAD` 78c9795: `npx vitest run` 46 passed, 0 failed (15 arquivos) · `npx playwright test tests/e2e/render.spec.ts` 6 passed, 0 failed.

Rodada 3 (carried): provas em `HEAD` 42e60a1: 22 unit passed, 0 failed · 26 e2e passed, 0 failed.

## Findings

Rodada 4 (verified at 78c9795) - nenhum sustenta FAIL desta rodada:

- **R4-1. C22 afirma a propriedade, não o brilho renderizado das janelas.** `emissiveIntensity`
  segue 2.2 (`CityScene.ts:304`), mas o shader multiplica a radiância por `warm = 0.70 * mix(0.8,
  0.5..1.0, detail)` (`:379`), então a intensidade efetiva de janela fica em ~0.77-1.54 (antes do
  diff: ~1.1-2.2). Nenhum pixel de janela atinge mais 2.0 efetivo; o AC 17 ("emissive de intensidade
  2.0 ou mais nos elementos neon e janelas") só se mantém na leitura literal da propriedade, que é o
  que C22 diz. Um mutante `WINDOW_BRIGHTNESS` 0.7 -> 0.05 (janelas quase apagadas) passaria C22 - fora
  do claim, por isso não entrou na tabela de faults. Mudança pedida pelo usuário e registrada no
  Handoff; se o AC 17 deve valer para o brilho percebido, é o texto do AC que precisa mudar.
- **R4-2. Deriva fora deste range: provas de free-roam em `render.spec.ts` reescritas pela
  visual-upgrade (503b714).** C21 (`checks.md:81-82`, "60 ou menos", proof `-g "draw calls at most
  60"`) não tem mais teste com esse nome; `render.spec.ts:11` é `draw calls at most 120` (visual-upgrade
  C8, superseding registrado em `visual-upgrade/plan.md:46` e `visual-upgrade/checks.md:42`). C45
  agora afirma a pilha de 6 passes (`render.spec.ts:74`); a ordem relativa Render -> Bloom -> Output e
  os literais seguem cobertos. As linhas C21/C45 da tabela `## Checks` citam o estado de 42e60a1.
  Recomendado: anotar C21 como superseded em `free-roam-city/checks.md` (fora do mandato deste
  Verifier) ou rodar uma verificação completa de free-roam em HEAD.
- **R4-3. C20 não prende posição.** O teste não afirma onde começa a fila (comentário "começando 20 m
  depois da borda", `CityGenerator.ts:180`, sem prova) nem a distância lateral ao meio-fio (`side`,
  `:185`); `along = -CITY_EXTENT + i * LAMP_SPACING` (sem o meio passo) ou uma fila inteira deslocada
  passariam. Não é claim de C20 (precision gap, não mutante sobrevivente).

Rodada 3 (carried from 42e60a1):

Nenhum sustenta um FAIL; são observações de precisão para uma rodada futura. Dos 6 findings
residuais da rodada 2, os de número 1 (rotação em C42), 2 (tolerância float32 em C45), 3 (tipos
de nó da porta 8, C46), 4 (`exposeDebug.ts` em C39) e 6 (valor fixo em C44) estão fechados pelo
fix; o 5 (`event.repeat`) continua como pass-through (item 4 abaixo).

1. **C46: conexões do grafo auto-descritas, `masterConnected` tautológico** - `graph()`
   (`src/audio/AudioEngine.ts:87-103`) lê `type`, `loop` e `constructor.name` reais de cada nó,
   mas a ordem `osc → filtro → gain` é a ordem dos campos no array, não a topologia observada
   (a Web Audio API não expõe conexões); e `masterConnected` usa `master.numberOfOutputs > 0`,
   que é sempre 1 para um `GainNode` mesmo sem `connect`. Um mutante que remova
   `this.master.connect(ctx.destination)` (`:30`) ou ligue `engineGain` direto em `destination`
   sobreviveria a C46. A cláusula "nem arquivos de som" foi confirmada por varredura do repositório
   (nenhum `.mp3/.wav/.ogg`, nenhum `decodeAudioData`/`new Audio(`), não pela prova. Endurecer:
   registrar as chamadas `connect` numa lista de arestas dentro de `start()` e afirmá-la.
2. **C42: margem de 1 px contra o mutante "sem rotate"** - sem `ctx.rotate`, a base do triângulo
   (x de 75 a 85, antialiased) produz `maxX = 83` contra o limiar 84: morto, mas por 1 px; um
   mutante que negue o ângulo (`rotate(+heading)`) é morto pelo `minX >= 74` (ponta em 73) com a
   mesma margem. Endurecer: afirmar `maxX - minX >= 10` e `maxX >= 86`, ou amostrar a cor no pixel
   (86, 80) diretamente.
3. **C44: teste usa `String(sample.gear)` em vez de `gearLabel(gear)`** - equivalente no domínio
   afirmado (`gear >= 2`, onde `gearLabel` devolve o número) e não é contradição; importar
   `gearLabel` de `src/hud/format.ts` deixaria a asserção literal ao check.
4. **`InputManager` `event.repeat`** (carried from 181fd5d) - `src/core/InputManager.ts:39` ignora
   auto-repeat sem prova própria; pass-through coberto por C1-C11 segurando teclas. Sem impacto na
   linha de Test policy.
