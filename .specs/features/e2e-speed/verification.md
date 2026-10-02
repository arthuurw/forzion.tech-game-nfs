# e2e-speed verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 68d1205..947b9a8
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 2 re-checks everything that was not PASS in round 1. It also covers everything the fix diff
`78387b4..947b9a8` touches: `tests/e2e/helpers.ts` (so every caller of `advanceSim` and
`waitSimUntil`), 8 specs, and the plan/checks time target, which the user raised from 25 to 30 min.
All proofs were rerun at 947b9a8.

C11 now passes: `172 passed (29.3m)`, exit 0, within the 30 min limit by 0.7 min. Both round-1
failures pass. The feature still fails, for four reasons:

- Two faults on the surfaces the fix created survive, so no proof shows the new "step until
  `simTime` reaches the target" loops are needed.
- One frame-dependent proof is still on the fast path. It is `race.spec.ts` "draw calls within
  budget while racing". Measured: 201 draw calls there vs 211 after the frames settle.
- `AGENTS.md` still gives 24.6 min, but the green run at HEAD measured 29.3 min.

## Binding sources

carried from 3d4459d - None. The plan marks no source as binding, and profile `standard` does not
run step 1. The fix does not touch any interface.

## Checks

verified at 947b9a8 (all proofs rerun at HEAD; files touched by the fix have new citations: `harness.spec.ts`, `extras.spec.ts`, `visual.spec.ts`)

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `runSteps(5)` -> 5 x `fixedUpdate(1/60)`, 0 renders; `runSteps(0)` calls neither | `npx vitest run tests/unit/gameLoop.test.ts tests/unit/e2eConfig.test.ts tests/unit/docs.test.ts -t "<4 names>"` exit 0: `✓ GameLoop > runSteps calls fixedUpdate n times without render` | `tests/unit/gameLoop.test.ts:68` `expect(dts).toEqual([1 / 60, 1 / 60, 1 / 60, 1 / 60, 1 / 60])`; `:69` `expect(renders).toBe(0)`; `:71-72` after `runSteps(0)`: `toHaveLength(5)`, `renders` 0 | PASS |
| C2 | throw on the 3rd call: 3 calls, `running` false, `onError` once with the same error, no rethrow | same invocation: `✓ GameLoop > runSteps stops on a throw and reports it once` | `tests/unit/gameLoop.test.ts:91` `expect(() => loop.runSteps(5)).not.toThrow()`; `:92` `expect(calls).toBe(3)`; `:93` `expect(loop.running).toBe(false)`; `:94` `expect(reported).toEqual([boom])` | PASS |
| C3 | `stepSim(s)` for s in {0.5, 1, 1/60} adds `Math.round(s*60)/60` ± 1e-9, read in the same `evaluate` | `E2E_PORT=5183 npx playwright test tests/e2e/harness.spec.ts tests/e2e/visual.spec.ts tests/e2e/audio.spec.ts tests/e2e/race.spec.ts tests/e2e/extras.spec.ts -g "<14 names>"` exit 0, `14 passed (3.8m)`: `✓ 3 harness.spec.ts:16:3 stepSim advances exactly the requested steps` | `tests/e2e/harness.spec.ts:24` `expect(Math.abs(d - Math.round(s * 60) / 60), ...).toBeLessThanOrEqual(1e-9)`, with `d = g.stepSim(s) - before` in one `evaluate` (`:19-23`) | PASS |
| C4 | `KeyW` held + `stepSim(2)` from the stopped spawn -> `speedKmh` > 10 | same: `✓ 5 harness.spec.ts:29:3 stepSim reads held keys` | `tests/e2e/harness.spec.ts:38` `expect(kmh).toBeGreaterThan(10)` | PASS |
| C5 | after `stepSim(2)` + 1 frame, `#speed` = `round(abs(speedKmh))` ± 1 | same: `✓ 6 harness.spec.ts:42:3 next frame shows the last step` | `tests/e2e/harness.spec.ts:57` `expect(Math.abs(label - Math.round(Math.abs(kmh)))).toBeLessThanOrEqual(1)` | PASS |
| C6 | `advanceSim(page, 3)`: simTime +≥ 3, frames +≥ 1 and ≤ 10 | same: `✓ 7 harness.spec.ts:63:3 advanceSim steps fast and waits one frame` | `tests/e2e/harness.spec.ts:68` `expect(b.simTime - a.simTime).toBeGreaterThanOrEqual(3)`; `:69` `>= 1`; `:71` `toBeLessThanOrEqual(10)`. The precision gap is still open (Ranked gaps 5). F1 shows `:68` cannot tell whether the new top-up loop is there | PASS |
| C7 | `advanceSim(page, 1, { realtime: true })`: simTime +≥ 1, frames +≥ 12 | same: `✓ 9 harness.spec.ts:75:3 advanceSim realtime waits on the frame loop` | `tests/e2e/harness.spec.ts:80` `>= 1`; `:81` `expect(b.frames - a.frames).toBeGreaterThanOrEqual(12)` | PASS |
| C8 | `waitSimUntil` returns true with 30 ≤ kmh < 30 + one-step gain + 0.5; `'false'`, 0.5 -> false, simTime +0.5..0.75 | same: `✓ 10 harness.spec.ts:85:3 waitSimUntil stops on the first step that holds` | `tests/e2e/harness.spec.ts:88` `toBe(true)`; `:96` `expect(r.at).toBeGreaterThanOrEqual(30)`; `:97` `toBeLessThan(30 + r.gain + 0.5)`; `:100` `toBe(false)`; `:102` `expect(dt).toBeGreaterThanOrEqual(0.5)` (the fix dropped the `- 1e-9`); `:103` `<= 0.75`. F2 survived: `:102` reads `t0` in an earlier `evaluate`, and the frames in between hide a deadline that is one step short | PASS |
| C9 | the 6 frame-dependent proofs pass, and every sim wait in each body is `realtime`, `waitFrames` or `sampleCountdown` | same invocation: `✓` audio:38, audio:96, race:144, visual:277, visual:295, visual:327 | `tests/e2e/visual.spec.ts:281`, `:301`, `:333` `advanceSim(..., { realtime: true })`; `tests/e2e/audio.spec.ts:41`, `:49`, `:99` realtime; `tests/e2e/race.spec.ts:150` `sampleCountdown(page, 4)`. The fix did not touch these bodies | PASS |
| C10 | `workers` from `E2E_WORKERS`, default 2; `--list` gives the same output with `=1` and without the variable | vitest invocation above: `✓ playwright config > workers come from E2E_WORKERS with default 2` | `tests/unit/e2eConfig.test.ts:28` `expect(await workers(undefined)).toBe(2)`; `:29` `toBe(1)`; `:32` `expect(list(undefined)).toBe(one)`; `playwright.config.ts:11` (the fix did not touch it) | PASS |
| C11 | `npm run test:e2e` on an idle machine: exit 0, 0 failures, every test runs, ≤ 30 min (limit raised from 25 by the user, 503625b) | `E2E_PORT=5184 npm run test:e2e`, run alone: **exit 0**, `172 passed (29.3m)`, wall 1757 s | Playwright totals: 172 passed, 0 failed, 0 flaky; 29.3 min ≤ 30 min (0.7 min margin). Both round-1 failures pass: `extras.spec.ts:172` train and `visual.spec.ts:131` rain (also `✓ 2` and `✓ 11` in the targeted run) | PASS |
| C12 | `npm run test:e2e:smoke` idle: exit 0, 0 failures, ≤ 3 min | `E2E_PORT=5185 npm run test:e2e:smoke`, run alone: exit 0, `22 passed (2.3m)`, wall 140 s | Playwright totals: 22 passed, 0 failed, 2.3 min ≤ 3 min | PASS |
| C13 | `AGENTS.md` names `E2E_WORKERS` and the times measured in C11 and C12 on the two lines | vitest invocation above: `✓ docs > agents gives the e2e times and workers` | `tests/unit/docs.test.ts:84` `toContain('E2E_WORKERS')`; `:85` `toContain('24.6 min')`; `:87` `toContain('2.4 min')`. The proof is green, but it asserts the author's pre-fix number. `AGENTS.md:14` says "24.6 min medidos", and the only green run of C11 at HEAD measured **29.3 min** (round 1 measured 26.1 at 3d4459d). The fix moved about 30 waits to realtime, so the documented time is no longer what C11 measures. `README.md:48` says "~25 min" | FAIL |

## Coverage

Rows whose authority the fix touched are verified at 947b9a8. The other rows are carried from 3d4459d.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| door 1: fast-forward (3 parts) - carried from 3d4459d | `src/core/GameLoop.ts` `runSteps`, `src/core/Game.ts:528` `stepSim`, `tests/e2e/helpers.ts` | `runSteps` C1, C2 · `stepSim` C3, C4, C5 · helpers C6, C7, C8 (helpers are recomputed below) | - |
| door 2: parallelism (2 values) - carried from 3d4459d | `playwright.config.ts:11` (the fix did not touch it) | unset -> 2 C10 (`e2eConfig.test.ts:28`) · `1` -> 1 C10 (`:29`) | - |
| `runSteps` exits (3) - carried from 3d4459d | `GameLoop.ts:38-48` (the fix did not touch it) | n steps C1 · n = 0 C1 · throw C2 | - |
| helper modes (2 modes + 1 branch the fix created) - verified at 947b9a8 | `helpers.ts:48-65`: fast (`stepSim(s)`, then the new top-up `while (g.simTime < target && g.running) g.stepSim(1 / 60)` at `:54`), realtime (`:60-65`) | fast C6 (`harness.spec.ts:68`), C8 · realtime C7 (`:81`), C9 | fast-mode top-up at `helpers.ts:54`: removing it (F1) leaves every proof green. C6 `harness.spec.ts:68` passed 4/4 and the train proof `extras.spec.ts:182` passed 4/4 (`--repeat-each=4`), because `a` is read in an earlier `evaluate` and the frame after `stepSim` adds steps. The branch the fix exists for has no proof |
| `waitSimUntil` exits (2) - verified at 947b9a8 | `helpers.ts:86-91`, now `while (!ok && g.simTime < deadline && g.running)` with `deadline = g.simTime + seconds` | predicate holds C8 (`harness.spec.ts:88`, `:96-97`) · deadline reached, upper bound C8 (`:103`) | deadline reached, lower bound (stops at ≥ s): stopping one step short (F2, `deadline - 1 / 60`) passes C8 3/3. `:102` measures from a `t0` read before frames add steps |
| frame-dependent proofs (AC 9 rule applied to every spec, not the author's list) - verified at 947b9a8 | scan of all 103 fast-path waits in `tests/e2e/*.spec.ts` for reads of state that only `render` updates over time: chase camera smoothing (`ChaseCamera.ts:71`), chunk streaming of 1 per frame (`chunks.ts:40`), audio ramps, screen and pixel probes | the 6 named -> C9 · moved to realtime and passing in C11: rain `visual.spec.ts:142`, ground light `interiors.spec.ts:190`, floodlight `:437`, world draw calls `render.spec.ts:51`, searchlight `extras.spec.ts:134`, nightCity streaks/sky `:131/:140/:149/:162/:179`, shimmer/glint/mirror `visual.spec.ts:380/:502/:513/:527/:636/:646`, plus round-1's steam, shake, chunks. Checked and fine on the fast path: `render.spec.ts:89` camera offset (its `beforeEach` runs `waitFrames(page, 30)` at `:7`, so the camera has settled before the wait), `audio.spec.ts:32` (the gain starts at its target, `AudioEngine.ts:108`), `race.spec.ts:161` (asserts `engineTarget`, which one frame sets) | `race.spec.ts:380` "draw calls within budget while racing": teleports to the circuito-centro grid 281 m from spawn and reads `render.calls` after a fast `advanceSim(page, 0.2)` (`:382`). Verifier experiment, 3 runs, same values each time: 201 calls on the fast path vs 211 after 40 more frames, with 9 chunks either way, so the camera had not settled after the teleport. The budget is ≤ 218, so the proof measures 10 calls below what the player sees. This is the same reason 7335c45 and 947b9a8 gave for moving `render.spec.ts:51` and the screen probes to realtime |
| timed suites (2) - verified at 947b9a8 | `package.json` `test:e2e`, `test:e2e:smoke` | full C11: 172 passed, 29.3 min · smoke C12: 22 passed, 2.3 min | - |
| exact sim-duration assertions on the fast path - verified at 947b9a8 | `rg "toBeGreaterThanOrEqual\((0.5|1|2|3)\)"` next to a fast `advanceSim`/`waitSimUntil` | `extras.spec.ts:182` train (passes; F5 killed it) · `extras.spec.ts:124` searchlights (passes) · `harness.spec.ts:68` C6 · `harness.spec.ts:102` C8 · `extras.spec.ts:82` (passes) | - (each passes at HEAD. That none of them depends on the new loops is the F1/F2 finding above) |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary (`runSteps`, 3 exits) - carried from 3d4459d | `src/core/GameLoop.ts` | vitest at its own layer: C1, C2 | yes - n steps, n = 0 and throw are each asserted; round-1 F1 and F2 were killed; the fix did not touch the file |
| Decides, reached across a boundary (2 helper modes, 2 `waitSimUntil` exits, `stepSim`) - verified at 947b9a8 | `tests/e2e/helpers.ts`, `src/core/Game.ts` `stepSim` | browser: C3-C8 | no - the fix changed both helper decisions. "Each mode and each exit with the check's value" no longer holds: the fast mode reaching ≥ s (F1) and the deadline exit reaching ≥ s (F2) both survive their covering proofs |
| Instrumentation (`playwright.config.ts` reads the variable) - carried from 3d4459d | `playwright.config.ts` | a proof that imports the config: C10 | yes - both door-2 values asserted; round-1 F3 killed; the fix did not touch the file |

## Faults injected

verified at 947b9a8. Scratch worktree `.claude/worktrees/verify-e2e-speed-r2` at 947b9a8, with
`node_modules` through a junction and `E2E_PORT=5186`. The real tree's `git status --porcelain` was
empty before and after. The junction was deleted before `git worktree remove`, and
`node_modules/three` is still present. Each fault was reverted with `git checkout --` before the next
one, and the worktree was clean after each.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1: remove the top-up loop the fix added (`while (g.simTime < target && g.running) g.stepSim(1 / 60)`) | `tests/e2e/helpers.ts:54` `advanceSim` | no - `extras.spec.ts` "the train advances 36 m in 2 s" and `harness.spec.ts` "advanceSim steps fast and waits one frame" passed 8/8 (`--repeat-each=4`) |
| F2: `waitSimUntil` deadline one step short (`g.simTime < deadline` -> `g.simTime < deadline - 1 / 60`) | `tests/e2e/helpers.ts:88` | no - `harness.spec.ts` "waitSimUntil stops on the first step that holds" passed 3/3 |
| F3: terrain heightfield collider 2 m lower (`.setTranslation(0, -2, 0)`), aimed at the terrain-rest proof that the fix rewrote to sample every step in the browser | `src/world/WorldPhysics.ts:52` | yes - `world.spec.ts:35` `peak dipped below the terrain`, Expected `>= 91.06`, Received `90.74` |
| F4: rain center stops following the car's height (`Math.min(center.y, 10)`), aimed at the rain proof the fix moved to realtime | `src/world/Rain.ts:81` | yes - `visual.spec.ts:131` `expect(high).toBeGreaterThan(0)`, Received `0` |
| F5: `TRAIN_SPEED` 18 -> 18.6, aimed at the train proof that now relies on the fast helper | `src/world/interiors/interiorMotion.ts:715` | yes - `extras.spec.ts:185` Expected `<= 1`, Received `1.2500000000000853` |

## Ranked gaps

1. Surviving mutant - C6/C8, `helpers.ts:54` - the fix's top-up loop in `advanceSim` can be deleted
   and every proof stays green (F1, 8/8 passes). Round 1's train failure needed suite load to show
   up. No proof asserts, in the same `evaluate` as the call, that the fast path reaches
   `start + s`.
2. Surviving mutant - C8, `helpers.ts:88` - a `waitSimUntil` deadline one step short passes C8
   (F2, 3/3). `harness.spec.ts:102` measures from `t0` read in an earlier `evaluate`, and the frames
   in between add steps.
3. Frame-dependent proof left on the fast path (AC 9) - unproven coverage member -
   `tests/e2e/race.spec.ts:380-385` "draw calls within budget while racing". It reads 201 draw calls
   after the teleport vs 211 once frames settle the camera (budget 218), so it under-measures what
   the player sees.
4. C13 - `AGENTS.md:14` gives 24.6 min, and `tests/unit/docs.test.ts:85` pins that literal. The
   green C11 run at HEAD measured 29.3 min. `README.md:48` says "~25 min".
5. Precision gap (open since round 1) - C6/C8 - the check text gives "≥ 3" and "entre 0.5 e 0.75"
   with no tolerance and no step count (L-003, L-032). The fix removed the test's own `- 1e-9` at
   `harness.spec.ts:102`.

Note: C11 passes with 0.7 min to spare (29.3 of 30 min), so any load on the machine puts it over.

## Gate

- `npx vitest run tests/unit/gameLoop.test.ts tests/unit/e2eConfig.test.ts tests/unit/docs.test.ts -t "<C1|C2|C10|C13 names>"`: 4 passed, 0 failed.
- `E2E_PORT=5183 npx playwright test <5 files> -g "<C3-C9 names + rain + train>"`: 14 passed, 0 failed (3.8 min).
- `E2E_PORT=5184 npm run test:e2e`: 172 passed, 0 failed (29.3 min, wall 1757 s, exit 0).
- `E2E_PORT=5185 npm run test:e2e:smoke`: 22 passed, 0 failed (2.3 min, wall 140 s, exit 0).
