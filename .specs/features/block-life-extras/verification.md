# block-life-extras verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: d0a5dd2..a494662 (`main..block-life-extras`)
**Round**: 2 - scoped (fix a494662 over round 1 at d221220, report 714fdfc)
**Verifier**: independent sub-agent (author != verifier)

Checks: 38/39 proven. C25 is still not proven. The `gone` state and the 10 s respawn are now exercised, and the flee speed is now asserted in m/s. But the claim's "com o carro a mais de 30 m" is never asserted at its value: the proof only checks a car at 10 m (stays gone) and a car at 1e5 m (comes back). Fault F5 (threshold 30 -> 15 m) survived. C27 is fixed (loop gap 1.975 m at HEAD, asserted <= 2). C29 now asserts column direction. 5 faults injected, 4 killed, 1 survived.

Scope of this round (verify.md "Re-verifying after a fix"):
- **Proofs.** Every proof was re-run in full at HEAD a494662.
- **Faults.** The two round-1 survivors (F3, F4) were re-injected. New faults went on the surfaces the fix touched or created: the C25 respawn guard, the C27 corner sampling and the C29 column direction.
- **Citations.** Refreshed for the touched files `tests/unit/extrasMotion.test.ts`, `tests/unit/trainLine.test.ts`, `src/vehicle/Car.ts`, `src/world/interiors/InteriorScene.ts` and `src/world/rail/trainLine.ts`. The other citations are carried from d221220; their files are unchanged, or, for `tests/physics/extras.test.ts`, changed by one line with no line shift.
- **Coverage and Test policy.** Recomputed for the rows the fix touched: cat states, repaint consumers and portal columns.

## Binding sources

Carried from d221220. Profile `standard`: step 1 does not run, and the plan marks no source as binding. The fix did not touch the interface.

## Checks

Proofs run at HEAD a494662.
- **vitest:** one invocation over the 7 files (`carPaint`, `shaderConstants`, `extras`, `extrasMotion`, `trainLine`, `purity`, `physics/extras`) with `--reporter=verbose`. **28 passed**, and each named test is listed individually.
- **Playwright:** one invocation, `E2E_PORT=5193 npx playwright test` over race/extras/render/visual, with a `-g` alternation of the 18 names. **18 passed (6.2 min)**, each listed individually.
- **grep:** proofs C8 and C39 re-run.

Rows marked "carried" keep the round-1 citation, since the cited file did not move. Every proof itself was re-run at a494662.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 6 texels: swatch -> paint, gradients scaled by luma, glass/wheel/trim untouched (±1/255) | vitest "recolors the orange swatch and keeps glass wheel and trim" pass | `tests/unit/carPaint.test.ts:30` - `expectClose(recolorTexel(hexToRgb(texel), paint), expected, texel)` over the 6 rows at :23-28 (carried) | PASS |
| C2 | GLSL carries swatch/cos(tol)/0.5 from one source, no other dotted literal | vitest "car paint shader reads the shared constants" pass | `tests/unit/shaderConstants.test.ts:93` - `toContain(\`sat >= ${PAINT_MIN_SATURATION}\`)`; `:98` literals ⊂ `CAR_PAINT_GLSL_LITERALS`; `:101` (carried; `carPaint.ts` untouched by the fix) | PASS |
| C3 | top-down ortho probe: opp 0 hue within 30° of 210°, opps 0-2 luma >= 0.6 x player, all on screen | playwright "opponent body reads its paint" pass at a494662 (sRGB uniform) | `tests/e2e/race.spec.ts:380` - `expect(Math.abs(h - 210)).toBeLessThanOrEqual(30)`; `:376` - `toBeGreaterThanOrEqual(0.6 * me.luminance)` | PASS |
| C4 | bodyColor = paint, materialColor = #ffffff; races C21 green | playwright "opponent material is white and body color is the paint" + "opponents wear their own paint" pass | `tests/e2e/race.spec.ts:389-390` - `expect(o.bodyColor).toBe(o.paint.toLowerCase())`, `expect(o.materialColor).toBe('#ffffff')`; `:209`. `bodyColor()` is now `rgbToHex([uPaint.x,y,z])` over `hexToRgb(paint)` (`src/vehicle/Car.ts:97`, `:558`), an exact 8-bit round trip | PASS |
| C5 | placeholder paintMaterial.color = #2f8cff | vitest "placeholder body takes the paint" pass | `tests/physics/extras.test.ts:54` - `expect(car.paintMaterial?.color.getHexString()).toBe('2f8cff')` | PASS |
| C6 | R in countdown -> slot 3 within 0.5 m, < 1 km/h, heading within 5°, time 0 | playwright "reset during countdown returns to the grid slot" pass | `tests/e2e/race.spec.ts:413`; `:417` - `expect((await race(page)).time).toBe(0)` (carried) | PASS |
| C7 | Enter at 100 m ± 0.5: free, same bodies, moved <= 0.5 m | playwright "enter at 100 m from the marker does nothing" pass | `tests/e2e/race.spec.ts:427`; `:433-436` (carried) | PASS |
| C8 | dated note under races C13, C13 text unchanged | `grep -n "block-life-extras C8" .specs/features/races/checks.md` -> line 110 | `.specs/features/races/checks.md:110` (carried; file untouched by the fix) | PASS |
| C9 | 60-160 cars, downtown >= 800 m², 5 clearances | vitest "parked cars sit in downtown patios away from everything" pass | `tests/unit/extras.test.ts:68-69`; `:75-81` (carried) | PASS |
| C10 | rows: pitch 2.8 ± 0.1, along <= 0.1 or >= 6 m apart; no pair < 2.7 | vitest "parked cars form rows with a 2.8 m pitch" pass | `tests/unit/extras.test.ts:100-101`; `:93` (carried) | PASS |
| C11 | paints in 8-color palette, >= 6 used, same seed equal | vitest "parked paints come from the palette and repeat with the seed" pass | `tests/unit/extras.test.ts:110,114,116` (carried) | PASS |
| C12 | +parking.length colliders; halfExtents (0.9,0.6,2.1), y = ground+0.6, heading within 1° | vitest "parked cars get one fixed cuboid each" pass | `tests/physics/extras.test.ts:65`; `:71-77` (carried) | PASS |
| C13 | >= 35 km/h before contact, < 5 km/h within 1 s, never 1.5 m past, parked collider still | vitest "driving into a parked car stops the car" pass | `tests/physics/extras.test.ts:121-122`; `:118`; `:124` (carried; `:89` is now `return true;`, no behaviour change) | PASS |
| C14 | browser: `parked-cars`, count = seed count, colorAt = paint; node placeholder <= 200 verts | playwright "parked cars are one instanced mesh with their paints" + vitest "parked cars fall back to boxes without the glb" pass | `tests/e2e/extras.spec.ts:60`; `:66` channel diff <= 1; `tests/physics/extras.test.ts:132-134` (carried). The instance colour is still set with `Color.set(paint)` (`InteriorScene.ts:304`), so `colorAt` still reads the paint | PASS |
| C15 | 40-120 vents, facadeDist 3-12, 6/4/12 m clearances, >= 80 % of quota | vitest "steam vents sit on the patio" pass | `tests/unit/extras.test.ts:126`; `:131-135` (carried) | PASS |
| C16 | dy 0->5, size 1->3 monotone, drift <= 1.5, period 4 | vitest "steam rises drifts and grows in a 4 s cycle" pass | `tests/unit/extrasMotion.test.ts:41-46`, `:50-51` (lines unchanged by the fix) | PASS |
| C17 | STEAM_GLSL from constants; `steam` points = 24 x vents, uTime tracks sim | vitest "steam shader reads the shared constants" + playwright "steam is one points cloud driven by the sim clock" pass | `tests/unit/shaderConstants.test.ts:81-82`; `tests/e2e/extras.spec.ts:76`, `:83` (carried) | PASS |
| C18 | 10 m from vent: over - aside >= 0.01, both on screen | playwright "steam brightens the air above the vent" pass | `tests/e2e/extras.spec.ts:104-105` (carried) | PASS |
| C19 | 4 lights, greedy by height with 250 m, y = roof, period 32-48, deterministic | vitest "four searchlights on the tallest towers" pass | `tests/unit/extras.test.ts:150`; `:154-156`; `:159` (carried) | PASS |
| C20 | heading formula at 3 points, tilt 80, length 400 | vitest "searchlight heading turns once per period" pass | `tests/unit/extrasMotion.test.ts:62` - `<= 1e-9`; `:65-66` | PASS |
| C21 | `searchlights` count 4, additive, headings advance 2π·Δt/period | playwright "four additive searchlight cones turn with the sim clock" pass | `tests/e2e/extras.spec.ts:111-113`; `:127` (carried) | PASS |
| C22 | best point along a beam: beam - without >= 0.02 for >= 1 beam | playwright "a searchlight beam is brighter than the sky" pass | `tests/e2e/extras.spec.ts:140`; `:142` (carried) | PASS |
| C23 | cat count = yard hits + outer quota, in zone, yard <= 8 m of back facade; active <= 200 m, caps 60/30 | vitest "cat spawns in yards and outer zones with a range cap" pass | `tests/unit/extras.test.ts:169`; `:183`; `:188-189` (carried) | PASS |
| C24 | walk 0.5-0.9 m/s, sit after 6-12 m for 2-5 s with crouch 0.3, stays in zone | vitest "cats walk sit and stay in their zone" pass | `tests/unit/extrasMotion.test.ts:96-97`, `:105-106`, `:89`, `:121` (lines unchanged by the fix) | PASS |
| C25 | flee at 4 m/s (± 0.01), distance grows to >= 12; never < 0.5 m; push to 1.5 m or `gone`, back at spawn after 10 s **with car > 30 m** | vitest "cats flee and are never under the car" pass | Proven: `tests/unit/extrasMotion.test.ts:147` - `Math.abs(moved / DT - 4) <= 0.01` (F3 killed); `:149`, `:152-153` grow to 12 then walk; `:166`, `:194` - `>= 0.5`; `:196` - `goneAt > 0`; `:203-204` - `state 'walk'` at spawn (F4 killed); `:212-214` still `gone` after 9 s. **Not proven:** the 30 m value. The only guards are `:200` (car at 10 m -> still `gone`) and `:202-203` (car at 1e5 m -> back), so any threshold in [10, 1e5) passes, and F5 (30 -> 15 m) survived | FAIL |
| C26 | `cats` <= 120 verts, cap 60, active >= 1 behind an outer house | playwright "cats are one instanced mesh near the car" pass | `tests/e2e/extras.spec.ts:149-150`; `:167` (carried) | PASS |
| C27 | closed loop (first-last <= 2 m), length 2300-2500, <= w/2-2 from avenue, 8 ± 0.5 up, turn <= 6°, step <= 2.5 | vitest "the line loops over the four downtown avenues" pass | `tests/unit/trainLine.test.ts:49` - `expect(Math.hypot(p[0].x - p[last].x, p[0].z - p[last].z)).toBeLessThanOrEqual(2)`; `:50-51` length; `:57` step `<= 2.5`; `:60-61`; `:66` turn; `:68` sum ± 1. Measured at HEAD by a scratch probe: gap **1.9749 m**, 1184 points, length 2356.69, max step 2.000. F6 (no per-metre sampling) fails at :49 with 2.097 | PASS |
| C28 | each of 4 avenues removed -> null + one `train line skipped:` warn; full net never warns | vitest "a missing avenue skips the line with a warning" pass | `tests/unit/trainLine.test.ts:77-79`; `:84` | PASS |
| C29 | frames every 24 ± 2, columns at `± (w/2+2.6)·(cos h, −sin h)` ± 0.1, >= 12 m from other roads, y < deck | vitest "portals every 24 m on the sidewalks away from crossings" pass | `tests/unit/trainLine.test.ts:108` gap; `:119` - `Math.abs(along) <= 0.01`; `:120` - `abs(abs(lateral) - (w/2 + 2.6)) <= 0.1`; `:122` columns on opposite sides; `:125` - `>= 12`; `:128` - `f.y < deck.y`. F7 (columns along the heading) killed at :119 | PASS |
| C30 | +2 x frames colliders exactly; halfExtents (0.25, h/2, 0.25), translation | vitest "portal columns get one fixed cuboid each" pass | `tests/physics/extras.test.ts:143`; `:153-158` (carried) | PASS |
| C31 | s = (18t - 13k) mod L at 4 points, on line, tangent; browser s[0] advances 18·Δt ± 1 | vitest "train pose follows the line at 18 m per second" + playwright "the train advances 36 m in 2 s" pass | `tests/unit/extrasMotion.test.ts:231` - `Math.abs(pose.s - s) <= 1e-6`; `:251` on line `<= 0.5`; `:253` heading `<= Math.PI / 180`; `tests/e2e/extras.spec.ts:184` | PASS |
| C32 | `train-line` non-instanced, `train` count 3, windowEmissive >= 2 | playwright "the viaduct is one mesh and the wagons one instanced mesh" pass | `tests/e2e/extras.spec.ts:190-194` (carried) | PASS |
| C33 | deck underside >= road + 6.5; car >= 55 km/h keeps >= 90 % under a portal | vitest "the deck clears the road by 6.5 m" + "the car passes under a portal without slowing" pass | `tests/unit/trainLine.test.ts:137` - `p.y - DECK_THICKNESS / 2 - n.y >= 6.5`; `tests/physics/extras.test.ts:191-192` | PASS |
| C34 | draw calls <= 220 at the 5 places + racing grid | playwright "draw calls at most 220 across the world" + "draw calls within budget while racing" pass | `tests/e2e/render.spec.ts:53`; `tests/e2e/race.spec.ts:338` (carried) | PASS |
| C35 | mirror skip list has the 6 names | playwright "the street mirror skips every extra" pass | `tests/e2e/extras.spec.ts:200` (carried) | PASS |
| C36 | ready within 30 s at high | playwright "ready within 30 s at high quality" pass | `tests/e2e/visual.spec.ts:451` (carried) | PASS |
| C37 | low: cap 30, 12 x vents, train 3, parking = count, lights 4 | playwright "low quality halves cats and steam and keeps the rest" pass | `tests/e2e/extras.spec.ts:212-217` (carried) | PASS |
| C38 | purity list locks carPaint and trainLine (+ roadQuery), keeps interior modules | vitest "pure modules do not import three or rapier" pass | `tests/unit/purity.test.ts:57`; entries :47-49 (carried) | PASS |
| C39 | AD-017 with status active | `grep -n "AD-017" .specs/STATE.md` -> line 46 | `.specs/STATE.md:46` (carried) | PASS |

## Coverage

The rows whose authority the fix touched are recomputed and marked "verified at a494662". The other rows are carried from d221220, where their authority is unchanged.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| palette texels the car uses (6) | plan measurement of `colormap.png` (carried from d221220) | all 6 in C1 | - |
| repaint consumers (2) | `CAR_PAINT_GLSL` injection sites `Car.ts:563`, `InteriorScene.ts:284` (verified at a494662) | opponent C3, C4 · parked C14 (instance colour, not pixel) | - |
| fallback without glb (2) | carried from d221220 | C5 · C14 node | - |
| opponents read in pixel (3) | `AI_PAINTS` (carried) | `race.spec.ts:374-377`, hue for 0 at :380 | - |
| races proofs owed (3) | carried | C6 · C7 · C8 | - |
| new `InteriorProps` fields (4) | carried | C9-C11 · C15 · C23 · C19 | - |
| parking clearances (4) | carried | `extras.test.ts:75-81` | - |
| new colliders (3) | carried (`WorldPhysics.ts` untouched by the fix) | C12 · C30 · deck/wagons none C30 | - |
| loop avenues (4) | `squareAvenues`, asserted = 4 at `trainLine.test.ts:48` (verified at a494662) | C28 loop over all 4 | - |
| cat states (4) | `CatState` in `interiorMotion.ts:529` (verified at a494662) | walk C24 · sit C24 · flee C25 `:147` · gone C25 `:196`, respawn `:203-204` (the respawn's 30 m condition is the C25 FAIL) | - |
| cat state transitions out of `gone` (2 guards) | `interiorMotion.ts:574` (`goneLeft <= 0`, spawn-to-car `> CAT_GONE_CAR` = 30) (verified at a494662) | 10 s guard: `:212-214` (9 s -> gone) and `:203` (11 s -> walk) · 30 m guard: only at 10 m and 1e5 m | 30 m guard: value not asserted (F5 survived) |
| portal columns per frame (2) | `frameColumns` `trainLine.ts:215-222` (verified at a494662) | both sides, direction and distance at `trainLine.test.ts:119-122` | - |
| meshes skipped by the mirror (6) | carried | `extras.spec.ts:200` | - |
| draw-call places (6) | carried | render.spec :53 · race.spec :338 | - |
| qualities (2) | carried | high C17, C26 · low C37 | - |
| GLSL with JS twin (2) | `CAR_PAINT_GLSL`, `STEAM_GLSL` (carried) | C2 · C17 (constants only; see the precision gap below) | - |
| new pure modules (3) | carried | carPaint · trainLine · roadQuery (C38) | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decide, reached across a boundary | `carPaint.ts`, `InteriorProps.ts` extras, `trainLine.ts`, `interiorMotion.ts` | own layer C1, C2, C9-C11, C15, C16, C19, C20, C23-C25, C27-C29, C31, C33 · boundary C3-C5, C12, C14, C17, C21, C26, C30, C31, C33 | no - the cat table now has a case per state (gone reached at `extrasMotion.test.ts:196`, round 1's miss is closed), but the `gone -> walk` row's car-distance condition (30 m) has no case at its value (F5 survived) (verified at a494662) |
| Glue (`InteriorScene`, `TrainScene`, `Game` probes) | `InteriorScene.ts`, `TrainScene.ts`, `Game.ts` | none of its own; covered by consumers' Playwright | yes - the fix's glue changes (`InteriorScene.ts:284` OETF, `Game.ts` comment) keep C14 and C22 green at a494662 |
| `WorldPhysics` colliders | `WorldPhysics.ts` | `tests/physics` with real Rapier, each shape read back | yes - carried from d221220 (file untouched) |

The swept row resolving to existing (`src/main.ts` overlay) is carried from d221220; that file is untouched.

## Faults injected

The faults were applied in place with the Edit tool, one at a time, and each was reverted by an inverse edit. The repo rule forbids stash/restore, and worktrees share `node_modules` by junction. Nothing was injected while Playwright's dev server was running. `git status --porcelain` was empty before and after, and `extrasMotion` + `trainLine` were green again after the reverts (9 passed). F3 and F4 re-inject the round-1 survivors. F5-F7 sit on surfaces the fix created or touched. That makes 5, the cap.

| Mutation | Location | Killed |
| --- | --- | --- |
| F3 cat flee speed 4 -> 4.5 m/s (round-1 survivor) | `src/world/interiors/interiorMotion.ts:523` | yes - C25 failed at `extrasMotion.test.ts:147` ("expected 0.5 to be <= 0.01") |
| F4 a `gone` cat never respawns (`goneLeft <= -1e9`) (round-1 survivor) | `src/world/interiors/interiorMotion.ts:574` | yes - C25 failed at `extrasMotion.test.ts:203` ("expected 'gone' to be 'walk'") |
| F5 respawn needs the car only 15 m away instead of 30 (`CAT_GONE_CAR` 30 -> 15) | `src/world/interiors/interiorMotion.ts:527` | no - survived; C25 passes (its "near" car is at 10 m, its "far" car at 1e5 m) |
| F6 corner arcs back to 16 fixed segments (`CORNER_STEP` 1.9 -> 1e9) | `src/world/rail/trainLine.ts:50` | yes - C27 failed at `trainLine.test.ts:49` ("expected 2.0970513561188198 to be <= 2") |
| F7 portal columns along the heading (`(sin h, cos h)` instead of `(cos h, −sin h)`) | `src/world/rail/trainLine.ts:217-218` | yes - C29 failed at `trainLine.test.ts:119` ("frame 0 column along: expected 10.6 to be <= 0.01") |

## Gate

- **vitest:** `npx vitest run` over the 7 feature files, 28 passed, 0 failed.
- **Playwright:** `E2E_PORT=5193 npx playwright test` over the 18 named proofs, 18 passed, 0 failed (6.2 min).
- **grep:** proofs C8 and C39 hit.
- **Completion gate:** `validate_verification.py block-life-extras` exits 1, as it should for a FAIL verdict.

## Ranked gaps

1. **C25, respawn distance (30 m).** The check says the `gone` cat comes back at its spawn "depois de 10 s com o carro a mais de 30 m". The proof keeps the car at 10 m from the spawn for the "stays gone" case (`tests/unit/extrasMotion.test.ts:198-200`) and at 1e5 m for the "comes back" case (`:201-204`). The 30 m value is therefore never asserted, and F5 (threshold 15 m) survived. A bracket around the value would kill it: car at about 29 m from the spawn after 10 s -> still `gone`; car at about 31 m -> `walk`. This leaves the Test policy row "Decide" unmet for the `gone -> walk` row.

## Non-blocking notes

- **Paint colour space, fixed by reading, still a precision gap.** At a494662 the opponent's `uPaint` is `Vector3(hexToRgb(paint))`, which is sRGB (`src/vehicle/Car.ts:558`). The parked cars feed `sRGBTransferOETF(vColor)` (`src/world/interiors/InteriorScene.ts:284`), with `vColor` the linear instance colour from `Color.set(paint)` (`:304`), so it is sRGB too. `CAR_PAINT_GLSL` converts the texel to sRGB (`carPaint.ts:80`), recolours with the same luma ratio as `recolorTexel` (`:92` vs `:67-68`), and converts back (`:93`). So the GLSL and the JS twin now agree. `bodyColor()` round-trips the hex exactly, and C4 is green. No proof, however, can tell sRGB from linear here: round 1's HEAD d221220 fed linear paint, and C3 (30° hue window, 0.6× luma floor) passed there. No check states a rendered-colour tolerance, so this is a precision gap in C2/C3, not a failed check.
- **C27 margin.** The loop closes at 1.975 m against 2 m, a 2.5 cm margin. A change to the network or to the corner radius could tip it over. The proof would catch that (F6).
- Carried from round 1: the AC 28 clause "o resto do mundo SHALL carregar" has no browser proof, and C28 does not claim it.
- Round 1's other notes are closed. The `probeSearchlight` doc comment now describes the best-point search (`src/core/Game.ts:1090-1093`), and the `|| true` in `tests/physics/extras.test.ts:89` is gone.
- Step 7 (lessons) was not run: the brief allows committing only this file. The candidate lesson: when a claim names a threshold as a condition ("com o carro a mais de 30 m"), the proof brackets it on both sides of the value, not at far-off points.

## Round 1 history (d221220, report at 714fdfc)

Round 1 (full) returned FAIL: 37/39 checks proven, 7 faults injected, 5 killed, 2 survived. Gaps:
- C27: the loop closed at 2.097 m while the test allowed 2.5 m.
- C25: the `gone` state was never reached, and F4 (never respawns) survived.
- C25: the flee speed was bounded at ±0.01 m per step (±0.6 m/s), and F3 (4.5 m/s) survived.

Its non-blocking notes:
- paint fed in linear to an sRGB snippet;
- C29 column direction unchecked;
- a stale `probeSearchlight` comment;
- a dead `|| true`;
- AC 28's "rest of the world loads" unproven.

Round 1's killed faults were F1 (luma scale, C1), F2 (hard-coded 0.45, C2), F5 (collider half-height, C12), F6 (`FRAME_SIDE`, C29) and F7 (shader not injected, C3). They sit on surfaces the fix did not touch and are carried. The full round-1 report is `git show 714fdfc:.specs/features/block-life-extras/verification.md`.
