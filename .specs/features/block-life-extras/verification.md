# block-life-extras verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: d0a5dd2..d221220 (`main..block-life-extras`)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Checks: 37/39 proven. C25 and C27 are not proven: each proof asserts a looser value than its check states, and in C27 the code falls outside the check's value. 7 faults injected, 5 killed, 2 survived (both on C25).

## Binding sources

Profile `standard`: step 1 does not run. The plan marks no source as binding (its `Sources` are the user's words and earlier `.specs` docs), so there is nothing to compare.

## Checks

Proofs run at HEAD d221220. vitest: one invocation over the 7 files, `--reporter=verbose`, **28 passed**, and each named test is listed individually. Playwright: one invocation, `E2E_PORT=5193`, over extras/race/render/visual with a `-g` alternation of the 18 names, **18 passed (6.2 min)**, each listed individually. `grep` proofs are shown inline.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 6 texels: swatch -> paint, gradients scaled by luma, glass/wheel/trim untouched (±1/255) | vitest "recolors the orange swatch and keeps glass wheel and trim" pass | `tests/unit/carPaint.test.ts:30` - `expectClose(recolorTexel(hexToRgb(texel), paint), expected, texel)` over the 6 rows at :23-28 | PASS |
| C2 | GLSL carries swatch/cos(tol)/0.5 from one source, no other dotted literal | vitest "car paint shader reads the shared constants" pass | `tests/unit/shaderConstants.test.ts:93` - `toContain(\`sat >= ${PAINT_MIN_SATURATION}\`)`; `:98` literals ⊂ `CAR_PAINT_GLSL_LITERALS`; `:101` template has no literal | PASS |
| C3 | top-down ortho probe: opp 0 hue within 30° of 210°, opps 0-2 luma >= 0.6 x player, all on screen | playwright "opponent body reads its paint" pass | `tests/e2e/race.spec.ts:380` - `expect(Math.abs(h - 210)).toBeLessThanOrEqual(30)`; `:376` - `toBeGreaterThanOrEqual(0.6 * me.luminance)` | PASS |
| C4 | bodyColor = paint, materialColor = #ffffff; races C21 green | playwright "opponent material is white and body color is the paint" + "opponents wear their own paint" pass | `tests/e2e/race.spec.ts:389-390` - `expect(o.bodyColor).toBe(o.paint.toLowerCase())`, `expect(o.materialColor).toBe('#ffffff')`; `:209` | PASS |
| C5 | placeholder paintMaterial.color = #2f8cff | vitest "placeholder body takes the paint" pass | `tests/physics/extras.test.ts:54` - `expect(car.paintMaterial?.color.getHexString()).toBe('2f8cff')` | PASS |
| C6 | R in countdown -> slot 3 within 0.5 m, < 1 km/h, heading within 5°, time 0 | playwright "reset during countdown returns to the grid slot" pass | `tests/e2e/race.spec.ts:413` - `hypot(p.x - slot.x, ...) <= 0.5`; `:417` - `expect((await race(page)).time).toBe(0)` | PASS |
| C7 | Enter at 100 m ± 0.5: free, same bodies, moved <= 0.5 m | playwright "enter at 100 m from the marker does nothing" pass | `tests/e2e/race.spec.ts:427` - `Math.abs(dists[0]! - 100) <= 0.5`; `:433-436` state `free`, `bodies` equal, `<= 0.5` | PASS |
| C8 | dated note under races C13, C13 text unchanged | `grep -n "block-life-extras C8" .specs/features/races/checks.md` -> line 110 | `.specs/features/races/checks.md:110` - "Nota (2026-09-27, block-life-extras C8): ... freio de mão"; diff on that file is +1 line only | PASS |
| C9 | 60-160 cars, downtown >= 800 m², 5 clearances | vitest "parked cars sit in downtown patios away from everything" pass | `tests/unit/extras.test.ts:68-69` count bounds; `:75-81` lot 2, road w/2+2, site 12, lamp/pool/tree 8 | PASS |
| C10 | rows: pitch 2.8 ± 0.1, along <= 0.1 or >= 6 m apart; no pair < 2.7 | vitest "parked cars form rows with a 2.8 m pitch" pass | `tests/unit/extras.test.ts:100-101` - `Math.abs(lateral - k * 2.8) <= 0.1`, `Math.abs(along) <= 0.1`; `:93` - `>= 2.7` | PASS |
| C11 | paints in 8-color palette, >= 6 used, same seed equal | vitest "parked paints come from the palette and repeat with the seed" pass | `tests/unit/extras.test.ts:110,114,116` - `toContain(car.paint)`, `used.size >= 6`, `again.parking toEqual props.parking` | PASS |
| C12 | +parking.length colliders; halfExtents (0.9,0.6,2.1), y = ground+0.6, heading within 1° | vitest "parked cars get one fixed cuboid each" pass | `tests/physics/extras.test.ts:65` - `colliders.len() diff toBe(props.parking.length)`; `:71-77` | PASS |
| C13 | >= 35 km/h before contact, < 5 km/h within 1 s, never 1.5 m past, parked collider still | vitest "driving into a parked car stops the car" pass | `tests/physics/extras.test.ts:121-122` - `peak >= 35`, `after1s < 5`; `:118` - `along() <= -1.5`; `:124` - moved <= 1e-6 | PASS |
| C14 | browser: one `parked-cars` mesh, count = seed count, colorAt = paint; node placeholder <= 200 verts | playwright "parked cars are one instanced mesh with their paints" + vitest "parked cars fall back to boxes without the glb" pass | `tests/e2e/extras.spec.ts:60` - `e.parking.count toBe(expected)`; `:66` channel diff <= 1; `tests/physics/extras.test.ts:132-134` | PASS |
| C15 | 40-120 vents, facadeDist 3-12, 6/4/12 m clearances, >= 80 % of quota | vitest "steam vents sit on the patio" pass | `tests/unit/extras.test.ts:126` - `vents.length >= 0.8 * Math.min(120, quota)`; `:131-135` | PASS |
| C16 | dy 0->5, size 1->3 monotone, drift <= 1.5, period 4 | vitest "steam rises drifts and grows in a 4 s cycle" pass | `tests/unit/extrasMotion.test.ts:41-46` monotone, drift, period; `:50-51` end values | PASS |
| C17 | STEAM_GLSL from constants; browser `steam` points = 24 x vents, uTime tracks sim | vitest "steam shader reads the shared constants" + playwright "steam is one points cloud driven by the sim clock" pass | `tests/unit/shaderConstants.test.ts:81-82`; `tests/e2e/extras.spec.ts:76` - `points toBe(24 * vents)`; `:83` - `abs(b.u - a.u - (b.t - a.t)) <= 0.05` | PASS |
| C18 | 10 m from vent: over - aside >= 0.01, both on screen | playwright "steam brightens the air above the vent" pass | `tests/e2e/extras.spec.ts:104-105` - `onScreen toBe(true)`, `r.over - r.aside >= 0.01` | PASS |
| C19 | 4 lights, greedy by height with 250 m, y = roof, period 32-48, deterministic | vitest "four searchlights on the tallest towers" pass | `tests/unit/extras.test.ts:150` - `lotIndex toEqual(expected)`; `:154-156`; `:159` | PASS |
| C20 | heading formula at 3 points, tilt 80, length 400 | vitest "searchlight heading turns once per period" pass | `tests/unit/extrasMotion.test.ts:62` - `<= 1e-9`; `:65-66` - `SEARCHLIGHT_TILT toBe(80)`, `SEARCHLIGHT_LENGTH toBe(400)` | PASS |
| C21 | `searchlights` count 4, additive, headings advance 2π·Δt/period | playwright "four additive searchlight cones turn with the sim clock" pass | `tests/e2e/extras.spec.ts:111-113`; `:127` - angle error `<= 0.01` | PASS |
| C22 | best point along a beam: beam - without >= 0.02 for >= 1 beam | playwright "a searchlight beam is brighter than the sky" pass | `tests/e2e/extras.spec.ts:140` - `r.beam - r.without >= 0.02`; `:142` - `seen >= 1` | PASS |
| C23 | cat count = yard hits + outer quota, in zone, yard cats within 8 m of back facade; active <= 200 m, caps 60/30 | vitest "cat spawns in yards and outer zones with a range cap" pass | `tests/unit/extras.test.ts:169` - `cats.length toBe(yardCats + outerCats)`; `:183` - `<= 8`; `:188-189` cap and 200 m | PASS |
| C24 | walk 0.5-0.9 m/s, sit after 6-12 m for 2-5 s with crouch 0.3, stays in zone | vitest "cats walk sit and stay in their zone" pass | `tests/unit/extrasMotion.test.ts:111` speed bounds (throws); `:96-97` sit after 6-12 m; `:105-106` 2-5 s; `:89` crouch; `:121` zone | PASS |
| C25 | flee at 4 m/s (± 0.01), distance grows to >= 12; never < 0.5 m from car; push to 1.5 m or `gone`, back at spawn after 10 s with car > 30 m | vitest "cats flee and are never under the car" pass | `tests/unit/extrasMotion.test.ts:146` - `Math.abs(moved - 4 * DT) <= 0.01` is ±0.01 **m per step** = ±0.6 m/s, not ±0.01 m/s (F3 at 4.5 m/s survived); `:171-177` the `gone` return sits under `if (gone)`, which a scratch probe shows never runs (0 `gone` steps for cats 0, 3 and 7; F4 survived). `:169` (>= 0.5 m) holds | FAIL |
| C26 | `cats` <= 120 verts, cap 60, active >= 1 behind an outer house | playwright "cats are one instanced mesh near the car" pass | `tests/e2e/extras.spec.ts:149-150`; `:167` - `active >= 1` | PASS |
| C27 | closed loop (first-last <= 2 m), length 2300-2500, <= w/2-2 from avenue, 8 ± 0.5 up, turn <= 6°, step <= 2.5 | vitest "the line loops over the four downtown avenues" pass | `tests/unit/trainLine.test.ts:49` - `toBeLessThanOrEqual(2.5)` where the check says **<= 2 m**; measured at HEAD: first-last gap = **2.097 m** (1176 points, length 2356.68). The check's value is not met, and the looser assertion hides it | FAIL |
| C28 | each of 4 avenues removed -> null + one `train line skipped:` warn; full net never warns | vitest "a missing avenue skips the line with a warning" pass | `tests/unit/trainLine.test.ts:77-79` - `toBeNull()`, `toHaveBeenCalledTimes(1)`, prefix; `:84` - `not.toHaveBeenCalled()` | PASS |
| C29 | frames every 24 ± 2 (multiples at skipped crossings), columns at w/2+2.6 ± 0.1, >= 12 m from other roads, y < deck | vitest "portals every 24 m on the sidewalks away from crossings" pass | `tests/unit/trainLine.test.ts:108` gap; `:117` - `abs(off - (w/2 + 2.6)) <= 0.1`; `:121` - `>= 12`; `:124` | PASS |
| C30 | +2 x frames colliders exactly; halfExtents (0.25, h/2, 0.25), translation | vitest "portal columns get one fixed cuboid each" pass | `tests/physics/extras.test.ts:143` - diff `toBe(2 * train.frames.length)`; `:153-158` | PASS |
| C31 | s = (18t - 13k) mod L at 4 points, on line, tangent; browser s[0] advances 18·Δt ± 1 | vitest "train pose follows the line at 18 m per second" + playwright "the train advances 36 m in 2 s" pass | `tests/unit/extrasMotion.test.ts:195` - `<= 1e-6`; `:217` heading `<= π/180`; `tests/e2e/extras.spec.ts:184` - `abs(moved - 18 * (b.t - a.t)) <= 1` | PASS |
| C32 | `train-line` non-instanced, `train` count 3, windowEmissive >= 2 | playwright "the viaduct is one mesh and the wagons one instanced mesh" pass | `tests/e2e/extras.spec.ts:190-194` | PASS |
| C33 | deck underside >= road + 6.5; car >= 55 km/h keeps >= 90 % under a portal | vitest "the deck clears the road by 6.5 m" + "the car passes under a portal without slowing" pass | `tests/unit/trainLine.test.ts:133` - `>= 6.5`; `tests/physics/extras.test.ts:191-192` - `speedBefore >= 55`, `speedAfter >= 0.9 * speedBefore` | PASS |
| C34 | draw calls <= 220 at the 5 places + racing grid | playwright "draw calls at most 220 across the world" + "draw calls within budget while racing" pass | `tests/e2e/render.spec.ts:53` - `expect(calls, name).toBeLessThanOrEqual(220)`; `tests/e2e/race.spec.ts:338` | PASS |
| C35 | mirror skip list has the 6 names | playwright "the street mirror skips every extra" pass | `tests/e2e/extras.spec.ts:200` - `for (const n of [...6]) expect(names, n).toContain(n)` | PASS |
| C36 | ready within 30 s at high | playwright "ready within 30 s at high quality" pass | `tests/e2e/visual.spec.ts:451` - `expect(Date.now() - start).toBeLessThan(30_000)` | PASS |
| C37 | low: cap 30, 12 x vents, train 3, parking = count, lights 4 | playwright "low quality halves cats and steam and keeps the rest" pass | `tests/e2e/extras.spec.ts:212-217` | PASS |
| C38 | purity list locks carPaint and trainLine (+ roadQuery), keeps interior modules | vitest "pure modules do not import three or rapier" pass | `tests/unit/purity.test.ts:57` - `PURE_MODULES.length toBe(36)`; entries at :47-49; `FORBIDDEN.test(source) toBe(false)` per module | PASS |
| C39 | AD-017 with status active | `grep -n "AD-017" .specs/STATE.md` -> line 46 | `.specs/STATE.md:46` - `\| AD-017 \| Linha do trem elevado por regra ... \| active \| 2026-09-27 \|` | PASS |

## Coverage

Each set was recomputed from its authority: the plan's measurements, the Landing, the code and the tests. The author's column was not used.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| palette texels the car uses (6) | plan Problem/Assumptions measurement of `colormap.png` | all 6 as table rows in C1 (`carPaint.test.ts:23-28`) | - |
| repaint consumers (2) | `CAR_PAINT_GLSL` importers: `Car.ts:562`, `InteriorScene.ts:283` | opponent C3, C4 · parked C14 (instance colour, not pixel) | - |
| fallback without glb (2) | `Car` placeholder path, `InteriorScene` `parkedPlaceholder` | C5 · C14 node | - |
| opponents read in pixel (3) | `AI_PAINTS` (`src/race/aiDriver.ts:17`) | loop over 0-2 at `race.spec.ts:374-377`, hue for 0 at :380 | - |
| races proofs owed (3) | races verification notes 2-4 | C6 · C7 · C8 | - |
| new `InteriorProps` fields (4) | Landing door 1 | parking C9-C11 · vents C15 · cats C23 · searchlights C19 | - |
| parking clearances (4) | AC 9 | lot, road, site, lamp/pool/tree at `extras.test.ts:75-81` | - |
| new colliders (3) | `WorldPhysics.ts` loops at :108 and :120 | parked C12 · column C30 · deck/wagons none (exact diff) C30 | - |
| loop avenues (4) | `squareAvenues` over the seed-1337 network (asserted = 4 at `trainLine.test.ts:48`) | C28 loop over all 4 | - |
| cat states (4) | `CatState` in `interiorMotion.ts` (`walk`, `sit`, `flee`, `gone`) | walk C24 · sit C24 · flee C25 · gone - | `gone` (and the 10 s respawn): the proof never reaches it (scratch probe: 0 gone steps across the 3 chased cats; fault F4 survived) |
| meshes skipped by the mirror (6) | AC 35 | all 6 at `extras.spec.ts:200` | - |
| draw-call places (6) | city-terrain C38 (5) + races C34 | render.spec loop :53 · race.spec :338 | - |
| qualities (2) | `quality.level` branches `InteriorScene.ts:223,226` | high C17 (24/vent), C26 (cap 60) · low C37 | - |
| GLSL with JS twin (2) | `CAR_PAINT_GLSL`, `STEAM_GLSL` | C2 · C17 | - |
| new pure modules (3; the checks name 2) | `purity.test.ts` diff adds 3 | carPaint · trainLine · roadQuery (C38) | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decide, reached across a boundary | `carPaint.ts`, `InteriorProps.ts` extras, `trainLine.ts`, `interiorMotion.ts` (cat, train, searchlight, steam) | own layer C1, C2, C9-C11, C15, C16, C19, C20, C23-C25, C27-C29, C31, C33 · boundary C3-C5, C12, C14, C17, C21, C26, C30, C31, C33 | no - the cat decision table has 4 states and the own-layer proof exercises no `gone` case (the "one case per table row" expectation fails for `interiorMotion` cat) |
| Glue (`InteriorScene`, `TrainScene`, `Game` probes) | `InteriorScene.ts`, `TrainScene.ts`, `Game.ts` | none of its own; covered by consumers' Playwright | yes - C14, C17, C18, C21, C22, C26, C31, C32, C35, C37 |
| `WorldPhysics` colliders | `WorldPhysics.ts` | `tests/physics` with real Rapier, each shape read back | yes - C12 (parked, `physics/extras.test.ts:71-77`), C30 (columns, :153-158) |

Swept rows resolving to existing: the Observable "loading e erro" row cites the `src/main.ts` overlay, and it is there (`src/main.ts:11-17`, catch at :36).

## Faults injected

The faults were applied in place with the Edit tool, each reverted by an inverse edit, one at a time (the user's repo rule forbids stash/restore, and worktrees here share `node_modules` by junction). `git status --porcelain` was empty before and after, and the 28 vitest proofs were green again after the reverts. There are 7 faults, over the cap of 5, because the brief asks for one per assertion surface.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 `recolorTexel` drops the luma scale (`k = 1`) | `src/vehicle/carPaint.ts:67` | yes - C1 failed |
| F2 GLSL saturation cut hard-coded `0.45` | `src/vehicle/carPaint.ts:91` | yes - C2 failed |
| F3 cat flee speed 4 -> 4.5 m/s | `src/world/interiors/interiorMotion.ts:523` | no - survived; C25 passes at 4.5 m/s (its tolerance is 0.01 m per step) |
| F4 a `gone` cat never respawns (`goneLeft <= -1e9`) | `src/world/interiors/interiorMotion.ts:574` | no - survived; C25 never reaches `gone` |
| F5 parked collider half-height 0.6 -> 0.7 | `src/world/WorldPhysics.ts:159` | yes - C12 failed |
| F6 portal column offset `FRAME_SIDE` 2.6 -> 3.0 | `src/world/rail/trainLine.ts:41` | yes - C29 failed |
| F7 opponent paint shader not injected (hook on a missing chunk) | `src/vehicle/Car.ts:562` | yes - C3 failed at `race.spec.ts:380` (hue 107° vs <= 30° off 210°) |

## Gate

`npx vitest run` over the 7 feature files: 28 passed, 0 failed. `E2E_PORT=5193 npx playwright test` over the 18 named proofs: 18 passed, 0 failed. `grep` proofs C8 and C39 hit.

## Ranked gaps

1. **C27** - the check says the loop closes with first and last point <= 2 m apart. Measured at HEAD it is 2.097 m, and `tests/unit/trainLine.test.ts:49` asserts `<= 2.5`, which is weaker than the check, so the proof accepts a value the check rejects. Either close the loop within 2 m or renegotiate the value with the user. Loosening the assertion on its own does not fix this.
2. **C25 / cat `gone` state** - the claimed mechanism is "push to 1.5 m, else `gone`, back at spawn after 10 s with the car > 30 m". The `gone` branch and the respawn are unproven: `extrasMotion.test.ts:171` is guarded by `if (gone)`, and none of the 3 chased cats ever goes `gone`. F4 survived. This leaves a Coverage member unproven and the Test policy row unmet.
3. **C25 flee speed** - the check says 4 m/s ± 0.01, but `extrasMotion.test.ts:146` bounds displacement per step by 0.01 m, which is ±0.6 m/s. F3 (4.5 m/s) survived.

## Non-blocking notes

- **Paint colour space (a precision gap in C2/C3).** `CAR_PAINT_GLSL` documents `carPaint` as sRGB (`carPaint.ts:75`), but both feeds are in linear space. The opponent uses `uPaint = new THREE.Color(paint)` (`Car.ts:557`), and three r186 ColorManagement stores that as linear. The parked cars use `vColor` from `setColorAt`, which is also linear. The shader then runs the EOTF on it again, so the rendered paint comes out about `#0743ff` for `#2f8cff`, and yellow `#ffd23f` comes out closer to orange `#ffa40c`. C3's 30° hue window and 0.6× luma floor still pass. The JS twin `recolorTexel` receives sRGB, so the GLSL and JS results differ for the same paint, and no check measures this.
- C29 checks each column's distance (`w/2 + 2.6`) but not its direction `(cos h, −sin h)`. A column rotated along the heading would pass `trainLine.test.ts:117`. The physics proof C33 would likely catch it.
- The doc comment on `Game.probeSearchlight` still says "o primeiro ponto"; the code picks the best point, which matches the renegotiated C22.
- In `physics/extras.test.ts:89` the second condition of the target search ends in `|| true`. It is dead code, and no claim depends on it.
- The AC 28 clause "o resto do mundo SHALL carregar" has no browser proof, and C28 does not claim it. The code guards a `null` line (`Game.ts:170`, `WorldPhysics.ts:120`).
- Step 7 (lessons) was not run: the brief allows committing only this file.
