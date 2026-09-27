# block-life-extras verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: d0a5dd2..207d827 (`main..block-life-extras`)
**Round**: 3 - scoped (fix 207d827 over round 2 at a494662, report 8c02e73)
**Verifier**: independent sub-agent (author != verifier)

Checks: 39/39 proven. Round 2's only gap, C25's 30 m respawn threshold, is now asserted at its value. After the 10 s, a car 29 m from the spawn keeps the cat `gone` (`tests/unit/extrasMotion.test.ts:200`), and a car at 31 m brings it back (`:202`). Round 2's survivor F5 (30 -> 15 m) was re-injected and is killed at `:200`. The opposite fault (30 -> 32 m) is killed at `:202`. C27 was measured again at HEAD: the loop now closes at 1.866 m, a 13 cm margin under the 2 m bound. 4 faults injected, 4 killed.

Scope of this round (verify.md "Re-verifying after a fix"). The fix's diff `a494662..207d827` touches three files: `src/world/rail/trainLine.ts:50` (`CORNER_STEP` 1.9 -> 1.8), `tests/unit/extrasMotion.test.ts:197-204` (the C25 respawn bracket) and the `## Handoff` of `checks.md`.
- **Proofs.** Every proof was re-run in full at HEAD 207d827.
- **Faults.** Re-injected on the surfaces the fix touched or created: the C25 respawn threshold, on both sides of its value, plus the respawn position that the rewritten block asserts, and the C27 corner sampling.
- **Citations.** Refreshed for `tests/unit/extrasMotion.test.ts` and `src/world/rail/trainLine.ts`. The other citations are carried from a494662, since their files are unchanged since then.
- **Coverage and Test policy.** Recomputed for the rows the fix touched: cat states, the transitions out of `gone`, the loop avenues and the portal columns. The "Decide" row was re-judged.

## Binding sources

Carried from d221220. Profile `standard`: step 1 does not run, and the plan marks no source as binding. The fix did not touch the interface.

## Checks

Proofs run at HEAD 207d827.
- **vitest:** one invocation over the 7 files (`carPaint`, `shaderConstants`, `extras`, `extrasMotion`, `trainLine`, `purity`, `physics/extras`) with `--reporter=verbose`. **28 passed**, and each named test is listed individually.
- **Playwright:** one invocation, `E2E_PORT=5193 npx playwright test` over race/extras/render/visual, with a `-g` alternation of the 18 names. **18 passed (6.1 min)**, each listed individually.
- **grep:** proof C8 hits `.specs/features/races/checks.md:110`, and proof C39 hits `.specs/STATE.md:46`.

Rows marked "carried" keep the round-1 or round-2 citation, because the cited file did not change in `a494662..207d827`. Every proof itself was re-run at 207d827.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 6 texels: swatch -> paint, gradients scaled by luma, glass/wheel/trim untouched (±1/255) | vitest "recolors the orange swatch and keeps glass wheel and trim" pass | `tests/unit/carPaint.test.ts:30` - `expectClose(recolorTexel(hexToRgb(texel), paint), expected, texel)` over the 6 rows at :23-28 (carried) | PASS |
| C2 | GLSL carries swatch/cos(tol)/0.5 from one source, no other dotted literal | vitest "car paint shader reads the shared constants" pass | `tests/unit/shaderConstants.test.ts:93` - `toContain(\`sat >= ${PAINT_MIN_SATURATION}\`)`; `:98` literals ⊂ `CAR_PAINT_GLSL_LITERALS`; `:101` (carried) | PASS |
| C3 | top-down ortho probe: opp 0 hue within 30° of 210°, opps 0-2 luma >= 0.6 x player, all on screen | playwright "opponent body reads its paint" pass | `tests/e2e/race.spec.ts:380` - `expect(Math.abs(h - 210)).toBeLessThanOrEqual(30)`; `:376` - `toBeGreaterThanOrEqual(0.6 * me.luminance)` (carried) | PASS |
| C4 | bodyColor = paint, materialColor = #ffffff; races C21 green | playwright "opponent material is white and body color is the paint" + "opponents wear their own paint" pass | `tests/e2e/race.spec.ts:389-390` - `expect(o.bodyColor).toBe(o.paint.toLowerCase())`, `expect(o.materialColor).toBe('#ffffff')`; `:209` (carried) | PASS |
| C5 | placeholder paintMaterial.color = #2f8cff | vitest "placeholder body takes the paint" pass | `tests/physics/extras.test.ts:54` - `expect(car.paintMaterial?.color.getHexString()).toBe('2f8cff')` (carried) | PASS |
| C6 | R in countdown -> slot 3 within 0.5 m, < 1 km/h, heading within 5°, time 0 | playwright "reset during countdown returns to the grid slot" pass | `tests/e2e/race.spec.ts:413`; `:417` - `expect((await race(page)).time).toBe(0)` (carried) | PASS |
| C7 | Enter at 100 m ± 0.5: free, same bodies, moved <= 0.5 m | playwright "enter at 100 m from the marker does nothing" pass | `tests/e2e/race.spec.ts:427`; `:433-436` (carried) | PASS |
| C8 | dated note under races C13, C13 text unchanged | `grep -n "block-life-extras C8" .specs/features/races/checks.md` -> line 110 | `.specs/features/races/checks.md:110` (carried) | PASS |
| C9 | 60-160 cars, downtown >= 800 m², 5 clearances | vitest "parked cars sit in downtown patios away from everything" pass | `tests/unit/extras.test.ts:68-69`; `:75-81` (carried) | PASS |
| C10 | rows: pitch 2.8 ± 0.1, along <= 0.1 or >= 6 m apart; no pair < 2.7 | vitest "parked cars form rows with a 2.8 m pitch" pass | `tests/unit/extras.test.ts:100-101`; `:93` (carried) | PASS |
| C11 | paints in 8-color palette, >= 6 used, same seed equal | vitest "parked paints come from the palette and repeat with the seed" pass | `tests/unit/extras.test.ts:110,114,116` (carried) | PASS |
| C12 | +parking.length colliders; halfExtents (0.9,0.6,2.1), y = ground+0.6, heading within 1° | vitest "parked cars get one fixed cuboid each" pass | `tests/physics/extras.test.ts:65`; `:71-77` (carried) | PASS |
| C13 | >= 35 km/h before contact, < 5 km/h within 1 s, never 1.5 m past, parked collider still | vitest "driving into a parked car stops the car" pass | `tests/physics/extras.test.ts:121-122`; `:118`; `:124` (carried) | PASS |
| C14 | browser: `parked-cars`, count = seed count, colorAt = paint; node placeholder <= 200 verts | playwright "parked cars are one instanced mesh with their paints" + vitest "parked cars fall back to boxes without the glb" pass | `tests/e2e/extras.spec.ts:60`; `:66` channel diff <= 1; `tests/physics/extras.test.ts:132-134` (carried) | PASS |
| C15 | 40-120 vents, facadeDist 3-12, 6/4/12 m clearances, >= 80 % of quota | vitest "steam vents sit on the patio" pass | `tests/unit/extras.test.ts:126`; `:131-135` (carried) | PASS |
| C16 | dy 0->5, size 1->3 monotone, drift <= 1.5, period 4 | vitest "steam rises drifts and grows in a 4 s cycle" pass | `tests/unit/extrasMotion.test.ts:41-46`, `:50-51` (refreshed at 207d827: the fix changed only lines 197-204, so these lines did not move) | PASS |
| C17 | STEAM_GLSL from constants; `steam` points = 24 x vents, uTime tracks sim | vitest "steam shader reads the shared constants" + playwright "steam is one points cloud driven by the sim clock" pass | `tests/unit/shaderConstants.test.ts:81-82`; `tests/e2e/extras.spec.ts:76`, `:83` (carried) | PASS |
| C18 | 10 m from vent: over - aside >= 0.01, both on screen | playwright "steam brightens the air above the vent" pass | `tests/e2e/extras.spec.ts:104-105` (carried) | PASS |
| C19 | 4 lights, greedy by height with 250 m, y = roof, period 32-48, deterministic | vitest "four searchlights on the tallest towers" pass | `tests/unit/extras.test.ts:150`; `:154-156`; `:159` (carried) | PASS |
| C20 | heading formula at 3 points, tilt 80, length 400 | vitest "searchlight heading turns once per period" pass | `tests/unit/extrasMotion.test.ts:62` - `<= 1e-9`; `:65-66` (refreshed at 207d827, lines unmoved) | PASS |
| C21 | `searchlights` count 4, additive, headings advance 2π·Δt/period | playwright "four additive searchlight cones turn with the sim clock" pass | `tests/e2e/extras.spec.ts:111-113`; `:127` (carried) | PASS |
| C22 | best point along a beam: beam - without >= 0.02 for >= 1 beam | playwright "a searchlight beam is brighter than the sky" pass | `tests/e2e/extras.spec.ts:140`; `:142` (carried) | PASS |
| C23 | cat count = yard hits + outer quota, in zone, yard <= 8 m of back facade; active <= 200 m, caps 60/30 | vitest "cat spawns in yards and outer zones with a range cap" pass | `tests/unit/extras.test.ts:169`; `:183`; `:188-189` (carried) | PASS |
| C24 | walk 0.5-0.9 m/s, sit after 6-12 m for 2-5 s with crouch 0.3, stays in zone | vitest "cats walk sit and stay in their zone" pass | `tests/unit/extrasMotion.test.ts:96-97`, `:105-106`, `:89`, `:121` (refreshed at 207d827, lines unmoved) | PASS |
| C25 | flee at 4 m/s (± 0.01), distance grows to >= 12; never < 0.5 m; push to 1.5 m or `gone`, back at spawn after 10 s **with car > 30 m** | vitest "cats flee and are never under the car" pass | Refreshed at 207d827. `tests/unit/extrasMotion.test.ts:147` - `Math.abs(moved / DT - 4) <= 0.01`; `:149`, `:152-153` grow to 12, then walk; `:166`, `:194` - `>= 0.5`; `:196` - `goneAt > 0`. **30 m threshold:** `:199-200` - 11 s with the car at `{ x: 29, z: 0 }`, 29 m from the spawn (0, 0) -> `expect(cornered.state).toBe('gone')`; `:201-202` - one step with the car at 31 m -> `toBe('walk')`; `:203` - `Math.hypot(cornered.x, cornered.z) <= 1e-9`, back at the spawn. **10 s guard:** `:213-214` - 9 s with the car at 1e5 m -> still `gone`. F1 (15 m), F2 (32 m) and F3 (respawn in place) killed | PASS |
| C26 | `cats` <= 120 verts, cap 60, active >= 1 behind an outer house | playwright "cats are one instanced mesh near the car" pass | `tests/e2e/extras.spec.ts:149-150`; `:167` (carried) | PASS |
| C27 | closed loop (first-last <= 2 m), length 2300-2500, <= w/2-2 from avenue, 8 ± 0.5 up, turn <= 6°, step <= 2.5 | vitest "the line loops over the four downtown avenues" pass | `tests/unit/trainLine.test.ts:49` - `expect(Math.hypot(p[0]!.x - p[p.length - 1]!.x, p[0]!.z - p[p.length - 1]!.z)).toBeLessThanOrEqual(2)`; `:50-51` length; `:57` step `<= 2.5`; `:59-61`; `:66` turn; `:68` sum ± 1 (test file untouched by the fix). Measured at 207d827 with a scratch probe outside the repo: gap **1.8662 m**, 1188 points, length 2356.69, max step 2.000, 94 frames. `CORNER_STEP` = 1.8 at `src/world/rail/trainLine.ts:50`, used at `:115`. F4 (fixed 16 segments) fails at `:49` with 2.097 | PASS |
| C28 | each of 4 avenues removed -> null + one `train line skipped:` warn; full net never warns | vitest "a missing avenue skips the line with a warning" pass | `tests/unit/trainLine.test.ts:77-79`; `:84` (carried; re-run green over the new line) | PASS |
| C29 | frames every 24 ± 2, columns at `± (w/2+2.6)·(cos h, −sin h)` ± 0.1, >= 12 m from other roads, y < deck | vitest "portals every 24 m on the sidewalks away from crossings" pass | `tests/unit/trainLine.test.ts:108` gap; `:119` - `Math.abs(along) <= 0.01`; `:120` - `abs(abs(lateral) - (w/2 + 2.6)) <= 0.1`; `:122`; `:125` - `>= 12`; `:128` - `f.y < deck.y` (carried; re-run green over the resampled corners) | PASS |
| C30 | +2 x frames colliders exactly; halfExtents (0.25, h/2, 0.25), translation | vitest "portal columns get one fixed cuboid each" pass | `tests/physics/extras.test.ts:143`; `:153-158` (carried; re-run green) | PASS |
| C31 | s = (18t - 13k) mod L at 4 points, on line, tangent; browser s[0] advances 18·Δt ± 1 | vitest "train pose follows the line at 18 m per second" + playwright "the train advances 36 m in 2 s" pass | `tests/unit/extrasMotion.test.ts:231` - `Math.abs(pose.s - s) <= 1e-6`; `:251` on line `<= 0.5`; `:253` heading `<= Math.PI / 180` (refreshed at 207d827, lines unmoved); `tests/e2e/extras.spec.ts:184` (carried) | PASS |
| C32 | `train-line` non-instanced, `train` count 3, windowEmissive >= 2 | playwright "the viaduct is one mesh and the wagons one instanced mesh" pass | `tests/e2e/extras.spec.ts:190-194` (carried) | PASS |
| C33 | deck underside >= road + 6.5; car >= 55 km/h keeps >= 90 % under a portal | vitest "the deck clears the road by 6.5 m" + "the car passes under a portal without slowing" pass | `tests/unit/trainLine.test.ts:137` - `p.y - DECK_THICKNESS / 2 - n.y >= 6.5`; `tests/physics/extras.test.ts:191-192` (carried; re-run green over the new line) | PASS |
| C34 | draw calls <= 220 at the 5 places + racing grid | playwright "draw calls at most 220 across the world" + "draw calls within budget while racing" pass | `tests/e2e/render.spec.ts:53`; `tests/e2e/race.spec.ts:338` (carried) | PASS |
| C35 | mirror skip list has the 6 names | playwright "the street mirror skips every extra" pass | `tests/e2e/extras.spec.ts:200` (carried) | PASS |
| C36 | ready within 30 s at high | playwright "ready within 30 s at high quality" pass | `tests/e2e/visual.spec.ts:451` (carried) | PASS |
| C37 | low: cap 30, 12 x vents, train 3, parking = count, lights 4 | playwright "low quality halves cats and steam and keeps the rest" pass | `tests/e2e/extras.spec.ts:212-217` (carried) | PASS |
| C38 | purity list locks carPaint and trainLine (+ roadQuery), keeps interior modules | vitest "pure modules do not import three or rapier" pass | `tests/unit/purity.test.ts:57`; entries :47-49 (carried) | PASS |
| C39 | AD-017 with status active | `grep -n "AD-017" .specs/STATE.md` -> line 46 | `.specs/STATE.md:46` (carried) | PASS |

## Coverage

The rows whose authority the fix touched are recomputed and marked "verified at 207d827". The other rows are carried from a494662 or d221220, where their authority is unchanged.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| palette texels the car uses (6) | plan measurement of `colormap.png` (carried from d221220) | all 6 in C1 | - |
| repaint consumers (2) | `CAR_PAINT_GLSL` injection sites `Car.ts:563`, `InteriorScene.ts:284` (carried from a494662) | opponent C3, C4 · parked C14 (instance colour, not pixel) | - |
| fallback without glb (2) | carried from d221220 | C5 · C14 node | - |
| opponents read in pixel (3) | `AI_PAINTS` (carried) | `race.spec.ts:374-377`, hue for 0 at :380 | - |
| races proofs owed (3) | carried | C6 · C7 · C8 | - |
| new `InteriorProps` fields (4) | carried | C9-C11 · C15 · C23 · C19 | - |
| parking clearances (4) | carried | `extras.test.ts:75-81` | - |
| new colliders (3) | carried (`WorldPhysics.ts` untouched since d221220) | C12 · C30 · deck/wagons none C30 | - |
| loop avenues (4) | `squareAvenues`, asserted = 4 at `trainLine.test.ts:48`; the loop built from them resampled by `CORNER_STEP` (verified at 207d827) | C28 over all 4 · C27 closure over the new corners | - |
| cat states (4) | `CatState` in `interiorMotion.ts:529` (verified at 207d827) | walk C24 · sit C24 · flee C25 `:147` · gone C25 `:196`, stays gone at 29 m `:200`, respawn at 31 m `:202-203` | - |
| cat state transitions out of `gone` (2 guards) | `interiorMotion.ts:574` (`goneLeft <= 0`, spawn-to-car `> CAT_GONE_CAR` = 30 at `:527`) (verified at 207d827) | 10 s guard: `:213-214` (9 s, car far -> gone) and `:199-202` (11 s -> the distance decides) · 30 m guard: `:200` (29 m -> gone) and `:202` (31 m -> walk); F1 and F2 killed | - |
| portal columns per frame (2) | `frameColumns` `trainLine.ts:215-222` (verified at 207d827; the frames sit on the resampled line) | both sides, direction and distance at `trainLine.test.ts:119-122` | - |
| meshes skipped by the mirror (6) | carried | `extras.spec.ts:200` | - |
| draw-call places (6) | carried | render.spec :53 · race.spec :338 | - |
| qualities (2) | carried | high C17, C26 · low C37 | - |
| GLSL with JS twin (2) | `CAR_PAINT_GLSL`, `STEAM_GLSL` (carried) | C2 · C17 (constants only; see the precision note below) | - |
| new pure modules (3) | carried | carPaint · trainLine · roadQuery (C38) | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decide, reached across a boundary | `carPaint.ts`, `InteriorProps.ts` extras, `trainLine.ts`, `interiorMotion.ts` | own layer C1, C2, C9-C11, C15, C16, C19, C20, C23-C25, C27-C29, C31, C33 · boundary C3-C5, C12, C14, C17, C21, C26, C30, C31, C33 | yes - the cat table has a case per state, and the `gone -> walk` row is bracketed at 29 m and 31 m around its 30 m value (F1 and F2 killed). `trainLine.ts`'s new `CORNER_STEP` keeps C27-C29, C31 and C33 green (verified at 207d827) |
| Glue (`InteriorScene`, `TrainScene`, `Game` probes) | `InteriorScene.ts`, `TrainScene.ts`, `Game.ts` | none of its own; covered by consumers' Playwright | yes - carried from a494662 (files untouched by the fix); the consumer proofs are green again at 207d827 |
| `WorldPhysics` colliders | `WorldPhysics.ts` | `tests/physics` with real Rapier, each shape read back | yes - carried from d221220 (file untouched); C12 and C30 re-run green |

The swept row resolving to existing (`src/main.ts` overlay) is carried from d221220; that file is untouched.

## Faults injected

The faults were applied in place with the Edit tool, one at a time, and each was reverted by an inverse edit. The repo rule forbids stash/restore, and worktrees share `node_modules` by junction. Nothing was injected while Playwright's dev server was running. `git status --porcelain` was empty before the first fault and after the last revert, and `extrasMotion` + `trainLine` were green again after the reverts (9 passed). F1 re-injects round 2's surviving mutant. F2 and F3 sit on the respawn block the fix rewrote. F4 sits on the corner sampling the fix changed.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 respawn needs the car only 15 m away (`CAT_GONE_CAR` 30 -> 15), round 2's F5 | `src/world/interiors/interiorMotion.ts:527` | yes - C25 failed at `extrasMotion.test.ts:200` ("expected 'walk' to be 'gone'") |
| F2 respawn needs the car 32 m away (`CAT_GONE_CAR` 30 -> 32) | `src/world/interiors/interiorMotion.ts:527` | yes - C25 failed at `extrasMotion.test.ts:202` ("expected 'gone' to be 'walk'") |
| F3 respawn leaves the cat where it vanished (the two `= c.spawnX` / `= c.spawnZ` lines removed) | `src/world/interiors/interiorMotion.ts:575-576` | yes - C25 failed at `extrasMotion.test.ts:203` ("expected 24.00035556089754 to be less than or equal to 1e-9") |
| F4 corner arcs back to 16 fixed segments (`CORNER_STEP` 1.8 -> 1e9) | `src/world/rail/trainLine.ts:50` | yes - C27 failed at `trainLine.test.ts:49` ("expected 2.0970513561188198 to be less than or equal to 2") |

## Gate

- **vitest:** `npx vitest run` over the 7 feature files, 28 passed, 0 failed.
- **Playwright:** `E2E_PORT=5193 npx playwright test` over the 18 named proofs, 18 passed, 0 failed (6.1 min).
- **grep:** proofs C8 and C39 hit.
- **Completion gate:** `python validate_verification.py block-life-extras` exits 0.

## Non-blocking notes

- **C25 bracket width.** The proof brackets the threshold at 29 m and 31 m. Any threshold in [29, 31) passes, and `>` against `>=` at exactly 30 m is not distinguished. The check states "a mais de 30 m" with no tolerance, so a ±1 m bracket is a reasonable reading. This is a precision note, not a gap.
- **C27 margin.** The loop closes at 1.866 m against the 2 m bound, a 13 cm margin (round 2 had 2.5 cm). A change to the network or to the corner radius could still tip it over, and the proof would catch that (F4).
- **Paint colour space, carried from round 2 as a precision gap in C2/C3.** The GLSL and its JS twin agree at HEAD. No check states a rendered-colour tolerance, however, that could tell sRGB paint from linear paint.
- Carried from round 1: the AC 28 clause "o resto do mundo SHALL carregar" has no browser proof, and C28 does not claim it.
- Step 7 (lessons) was not run: the brief allows committing only this file. The candidate lesson, grounded in round 2's surviving mutant, still stands: when a claim names a threshold as a condition, the proof brackets it on both sides of the value, not at far-off points.

## Round 2 history (a494662, report at 8c02e73)

Round 2 (scoped) returned FAIL: 38/39 checks proven, 5 faults injected, 4 killed, 1 left alive.

Its one gap was C25. The respawn's 30 m condition was only exercised with the car at 10 m (stays gone) and at 1e5 m (comes back). A fault moving the threshold from 30 to 15 m (`CAT_GONE_CAR`) was therefore not detected. That left the Test policy "Decide" row unmet for the `gone -> walk` transition.

Its killed faults:
- flee speed 4 -> 4.5 m/s, C25 `:147`;
- a `gone` cat never respawns, C25 `:203`;
- 16 fixed corner segments, C27 `:49`;
- columns along the heading, C29 `:119`.

Its non-blocking notes: the paint colour-space precision gap, a 2.5 cm C27 margin, and the AC 28 note. Round 3 closes the gap and re-runs every proof. The full report is `git show 8c02e73:.specs/features/block-life-extras/verification.md`.

## Round 1 history (d221220, report at 714fdfc)

Round 1 (full) returned FAIL: 37/39 checks proven, 7 faults injected, 5 killed, 2 left alive. Gaps:
- C27: the loop closed at 2.097 m while the test allowed 2.5 m.
- C25: the `gone` state was never reached, and a "never respawns" fault went undetected.
- C25: the flee speed was bounded at ±0.01 m per step (±0.6 m/s), and a 4.5 m/s fault went undetected.

Its non-blocking notes:
- paint fed in linear to an sRGB snippet;
- C29 column direction unchecked;
- a stale `probeSearchlight` comment;
- a dead `|| true`;
- AC 28's "rest of the world loads" unproven.

Round 1's killed faults were F1 (luma scale, C1), F2 (hard-coded 0.45, C2), F5 (collider half-height, C12), F6 (`FRAME_SIDE`, C29) and F7 (shader not injected, C3). They sit on surfaces neither fix touched and are carried. The full round-1 report is `git show 714fdfc:.specs/features/block-life-extras/verification.md`.
