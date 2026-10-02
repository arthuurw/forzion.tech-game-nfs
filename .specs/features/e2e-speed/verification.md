# e2e-speed verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 68d1205..58a26be
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 3 re-checks everything that was not PASS in round 2: C13, ranked gaps 1-5, the unproven
coverage members (`helpers.ts:54` top-up, the `waitSimUntil` deadline lower bound,
`race.spec.ts:380`) and faults F1 and F2. It also covers everything the fix diff `947b9a8..58a26be`
touches (fix commits 835b2fe and 58a26be; 97aac4d is the round-2 report). That diff touches
`tests/e2e/harness.spec.ts` (the new `spySteps` helper, C6 and C8), `tests/e2e/race.spec.ts` (draw
calls), `tests/unit/docs.test.ts`, `AGENTS.md`, `README.md`, `.specs/STATE.md` and the C6/C8 claim
text in `checks.md`. All proofs were rerun at 58a26be.

All five round-2 gaps are closed:

- F1 and F2 are killed again.
- The new spy's upper bounds are killed by F3 and F5.
- The draw-call proof now reads the settled frame: 211 calls after `realtime` 1.5 s, the same as
  after 40 more frames. The old fast path read 201/198.
- The documented 28.9 min is within run-to-run variance of the 29.6 min measured here.
- The check text now declares the tolerance and the step count.

**Renegotiated check text (C6, C8).** Judged against the current text, the new text is not weaker
than the old in anything AC 6 or AC 8 states.

- **C6.** The old claim was "`simTime` grows ≥ 3 during the call", read across `evaluate`s. The new
  text requires the helper's own steps to reach ≥ t0 + s. `simTime` only increases, and frames only
  add steps, so the new claim implies the old one. It also adds an upper bound of s + 1/60 and the
  s = 0.02 case. The frame bounds (≥ 1, ≤ 10) are unchanged.
- **C8, lower bound.** The new text is stricter: it counts the helper's own steps only.
- **C8, upper bound.** It tightens from 0.75 to 0.5 + 1/60, but now covers only the helper's steps,
  not frames that pass around the call. This is the one property the old text constrained and the
  new one does not. The old bound never isolated it: the frames between `evaluate`s drift the
  reading, which is why F2 survived in round 2. A single frame (≤ 5 steps = 0.083 s) also fits
  inside the old 0.25 s slack. AC 8 does not require the fast path to skip frames. It is recorded
  here and not counted as a weakening.

## Binding sources

carried from 3d4459d - None. The plan marks no source as binding, and profile `standard` does not
run step 1. The fix does not touch any interface.

## Checks

verified at 58a26be. All proofs were rerun at HEAD. `harness.spec.ts`, `race.spec.ts` and
`docs.test.ts` have new citations. The others are unchanged files whose line numbers were
re-confirmed.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `runSteps(5)` -> 5 x `fixedUpdate(1/60)`, 0 renders; `runSteps(0)` calls neither | `npx vitest run tests/unit/gameLoop.test.ts tests/unit/e2eConfig.test.ts tests/unit/docs.test.ts -t "<4 names>" --reporter=verbose`: exit 0, 4 passed, 5 skipped. Output line: `✓ tests/unit/gameLoop.test.ts > GameLoop > runSteps calls fixedUpdate n times without render` | `tests/unit/gameLoop.test.ts:68` `expect(dts).toEqual([1 / 60, 1 / 60, 1 / 60, 1 / 60, 1 / 60])`; `:69` `expect(renders).toBe(0)`; `:71-72` after `runSteps(0)`: `toHaveLength(5)`, `renders` 0 | PASS |
| C2 | throw on the 3rd call: 3 calls, `running` false, `onError` once with the same error, no rethrow | same invocation: `✓ ... GameLoop > runSteps stops on a throw and reports it once` | `tests/unit/gameLoop.test.ts:91` `expect(() => loop.runSteps(5)).not.toThrow()`; `:92` `expect(calls).toBe(3)`; `:93` `expect(loop.running).toBe(false)`; `:94` `expect(reported).toEqual([boom])` | PASS |
| C3 | `stepSim(s)` for s in {0.5, 1, 1/60} adds `Math.round(s*60)/60` ± 1e-9, read in the same `evaluate` | `E2E_PORT=5183 npx playwright test tests/e2e/harness.spec.ts tests/e2e/visual.spec.ts tests/e2e/audio.spec.ts tests/e2e/race.spec.ts -g "<13 names>"`: exit 0, `13 passed (3.0m)`. Output line: `✓ 1 harness.spec.ts:45:3 stepSim advances exactly the requested steps` | `tests/e2e/harness.spec.ts:53` `expect(Math.abs(d - Math.round(s * 60) / 60), ...).toBeLessThanOrEqual(1e-9)`, with `d = g.stepSim(s) - before` in one `evaluate` (`:48-52`) | PASS |
| C4 | `KeyW` held + `stepSim(2)` from the stopped spawn -> `speedKmh` > 10 | same: `✓ 3 harness.spec.ts:58:3 stepSim reads held keys` | `tests/e2e/harness.spec.ts:67` `expect(kmh).toBeGreaterThan(10)` | PASS |
| C5 | after `stepSim(2)` + 1 frame, `#speed` = `round(abs(speedKmh))` ± 1 | same: `✓ 4 harness.spec.ts:71:3 next frame shows the last step` | `tests/e2e/harness.spec.ts:86` `expect(Math.abs(label - Math.round(Math.abs(kmh)))).toBeLessThanOrEqual(1)` | PASS |
| C6 | `advanceSim(page, s)` for s in {3, 0.02}: the helper's own steps (spy, same `evaluate`) take `simTime` from t0 to ≥ t0 + s and ≤ t0 + s + 1/60 (± 1e-9); for s = 3, frames +≥ 1 and ≤ 10 | same: `✓ 6 harness.spec.ts:92:3 advanceSim steps fast and waits one frame` | `tests/e2e/harness.spec.ts:97` `expect(r.reached).toBe(true)`, where `reached` is `end >= t0 + s` computed in the page with `t0 = log[0][0]`, the `simTime` before the helper's first `stepSim` (`:37-39`), so the same double as the helper's `target`; `:98` `expect(r.span).toBeLessThanOrEqual(3 + 1 / 60 + 1e-9)`; `:99` frames `>= 1`; `:101` frames `<= 10`; `:104` `expect(small.reached).toBe(true)`; `:105` `expect(small.span).toBeLessThanOrEqual(0.02 + 1 / 60 + 1e-9)`. F1 killed at `:97`, F3 killed at `:98` | PASS |
| C7 | `advanceSim(page, 1, { realtime: true })`: simTime +≥ 1, frames +≥ 12 | same: `✓ 7 harness.spec.ts:109:3 advanceSim realtime waits on the frame loop` | `tests/e2e/harness.spec.ts:114` `expect(b.simTime - a.simTime).toBeGreaterThanOrEqual(1)`; `:115` `expect(b.frames - a.frames).toBeGreaterThanOrEqual(12)` | PASS |
| C8 | `waitSimUntil` returns true with 30 ≤ kmh < 30 + one-step gain + 0.5; `'false'`, 0.5 -> false, and the helper's own steps take `simTime` from t0 to ≥ t0 + 0.5 and ≤ t0 + 0.5 + 1/60 (± 1e-9) | same: `✓ 9 harness.spec.ts:119:3 waitSimUntil stops on the first step that holds` | `tests/e2e/harness.spec.ts:122` `toBe(true)`; `:130` `expect(r.at).toBeGreaterThanOrEqual(30)`; `:131` `expect(r.at).toBeLessThan(30 + r.gain + 0.5)`; `:137` `expect(held).toBe(false)`; `:138` `expect(d.reached).toBe(true)`; `:139` `expect(d.span).toBeLessThanOrEqual(0.5 + 1 / 60 + 1e-9)`. F2 killed at `:138`, F5 killed at `:139` | PASS |
| C9 | the 6 frame-dependent proofs pass, and every sim wait in each body is `realtime`, `waitFrames` or `sampleCountdown` | same invocation: `✓` audio:38, audio:96, race:144, visual:277, visual:295, visual:327 | `tests/e2e/visual.spec.ts:281`, `:301`, `:333` `advanceSim(..., { realtime: true })`; `tests/e2e/audio.spec.ts:41`, `:49`, `:99` realtime; `tests/e2e/race.spec.ts:150` `sampleCountdown(page, 4)`. The fix did not touch these bodies (its only `race.spec.ts` hunk is at `:382`) | PASS |
| C10 | `workers` from `E2E_WORKERS`, default 2; `--list` gives the same output with `=1` and without the variable | vitest invocation above: `✓ tests/unit/e2eConfig.test.ts > playwright config > workers come from E2E_WORKERS with default 2` | `tests/unit/e2eConfig.test.ts:28` `expect(await workers(undefined)).toBe(2)`; `:29` `expect(await workers('1')).toBe(1)`; `:32` `expect(list(undefined)).toBe(one)`; `playwright.config.ts:11` `workers: Number(process.env.E2E_WORKERS ?? 2)` | PASS |
| C11 | `npm run test:e2e` on an idle machine: exit 0, 0 failures, every test runs, ≤ 30 min | `E2E_PORT=5184 npm run test:e2e`, run alone: **exit 0**, `172 passed (29.6m)`, wall 1776 s | Playwright totals: 172 passed, 0 failed, 0 flaky, 0 skipped. 172 is the same count as round 2. 29.6 min ≤ 30 min (0.4 min margin) | PASS |
| C12 | `npm run test:e2e:smoke` idle: exit 0, 0 failures, ≤ 3 min | `E2E_PORT=5185 npm run test:e2e:smoke`, run alone: exit 0, `22 passed (2.3m)`, wall 139 s | Playwright totals: 22 passed, 0 failed, 2.3 min ≤ 3 min | PASS |
| C13 | `AGENTS.md` names `E2E_WORKERS` and the times measured in C11 and C12 on the two lines | vitest invocation above: `✓ tests/unit/docs.test.ts > docs > agents gives the e2e times and workers` | `tests/unit/docs.test.ts:84` `expect(full).toContain('E2E_WORKERS')`; `:85` `expect(full).toContain('28.9 min')`; `:87` `expect(smoke).toContain('2.4 min')`. `AGENTS.md:14` says "28.9 min medidos com 2 workers; E2E_WORKERS". The documented times match the measurements within run-to-run variance. Green full runs at the post-fix code: 29.3 min (round 2, 947b9a8), 28.9 min (author, 58a26be), 29.6 min (this round). The spread is 0.7 min, and the round-2 gap was 4.7 min. Smoke: 2.4 min documented, 2.3 min measured. `README.md:48` now says "~30 min" | PASS |

## Coverage

Rows whose authority the fix touched are verified at 58a26be. The other rows are carried from
947b9a8 or 3d4459d.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| door 1: fast-forward (3 parts) - carried from 3d4459d | `src/core/GameLoop.ts` `runSteps`, `src/core/Game.ts:528` `stepSim` (both untouched since 3d4459d), `tests/e2e/helpers.ts` | `runSteps` C1, C2 · `stepSim` C3, C4, C5 · helpers C6, C7, C8 (helpers are recomputed below) | - |
| door 2: parallelism (2 values) - carried from 3d4459d | `playwright.config.ts:11` (untouched) | unset -> 2 C10 (`e2eConfig.test.ts:28`) · `1` -> 1 C10 (`:29`) | - |
| `runSteps` exits (3) - carried from 3d4459d | `GameLoop.ts:38-48` (untouched) | n steps C1 · n = 0 C1 · throw C2 | - |
| helper modes (2 modes + the top-up branch) - verified at 58a26be | `helpers.ts:48-65`. Fast mode: `stepSim(s)`, then the top-up `while (g.simTime < target && g.running) g.stepSim(1 / 60)` at `:54`. Realtime mode: `:60-65` | fast `stepSim(s)` C6 (`harness.spec.ts:97-98`, s = 3) · top-up `:54` C6 (`:104`, s = 0.02, where `Math.round` gives 1 step and only the top-up reaches the target; F1 killed at `:97`, F3 killed at `:98`) · realtime C7 (`:114-115`), C9 | - |
| `waitSimUntil` exits (2 exits, with bounds) - verified at 58a26be | `helpers.ts:86-92`: `deadline = g.simTime + seconds`; `while (!ok && g.simTime < deadline && g.running)` | predicate holds C8 (`harness.spec.ts:122`, `:130-131`) · deadline reached, lower bound C8 (`:138`; F2 killed) · deadline reached, upper bound C8 (`:139`; F5 killed) | - |
| spy helper `spySteps` (fix-created surface) - verified at 58a26be | `harness.spec.ts:19-41` | It wraps `__game.stepSim`, keeps the return value (`:29`) and logs before/after `simTime` per call (`:28`). It restores the original in the closing `evaluate` (`:36`), before anything is returned. No leak across tests: Playwright's `page` fixture is per test, and there is no shared page or context. A grep of `tests/e2e/*.ts` for `test.extend`, `beforeAll`, `storageState` and `reuse` finds nothing, and `playwright.config.ts` has none. Within C6, the second `spySteps` (`:103`) captures `g.stepSim` after `:36` restored it, so it wraps the original and not a spy. If `run()` throws, the spy stays installed, but only on that failing test's page, which is then discarded. An empty log (a helper that never calls `stepSim`) throws at `:37` and fails the test, so it cannot pass vacuously | - |
| frame-dependent proofs (AC 9 rule re-applied to every spec) - verified at 58a26be | Fresh scan of the 103 fast-path wait lines in 11 `tests/e2e/*.spec.ts` files (an `rg` for calls to `advanceSim`, `holdKeySim` and `waitSimUntil`, minus the lines with `realtime: true`), looking for reads of state that only `render` updates over time: chase-camera smoothing (`ChaseCamera.ts:62-71`, per-frame `dt`), chunk streaming, audio ramps, screen and pixel probes after a teleport | the 6 named -> C9 · `race.spec.ts:380` draw calls is now `advanceSim(page, 1.5, { realtime: true })` (`:382`), asserted at `:386` `<= 218`. Verifier experiment in the scratch worktree, 2 runs each: 211 calls after realtime 1.5 s and **211** after 40 more frames, so the reading has settled; the old fast `advanceSim(0.2)` read 201 and 198. The round-2 realtime set still passes in C11. Checked this round and fine on the fast path: `audio.spec.ts:123` (idle tremolo starts at its target, `AudioEngine.ts:121`) · `nightCity.spec.ts:215` sky still (the sky shader has no time, `Environment.ts:72`) · `visual.spec.ts:391` blur (`uBlur` is set straight from speed each frame, `Game.ts:384`) · `race.spec.ts:417` body probe (renders with its own orthographic camera, `Game.ts:1790-1793`, not the chase camera) · `hud.spec.ts:189` HUD DOM after the frame `advanceSim` waits · every `waitSimUntil` that a DOM or render read follows has an `advanceSim` in between (`race.spec.ts:214-216`, `:305-306`, `:372-373`). Carried from 947b9a8: `render.spec.ts:89`, `audio.spec.ts:32`, `race.spec.ts:161` | - |
| timed suites (2) - verified at 58a26be | `package.json` `test:e2e`, `test:e2e:smoke` | full C11: 172 passed, 29.6 min · smoke C12: 22 passed, 2.3 min | - |
| exact sim-duration assertions on the fast path - verified at 58a26be | an `rg` for `toBeGreaterThanOrEqual` with 0.5, 1, 2 or 3 next to a fast `advanceSim`/`waitSimUntil` | `extras.spec.ts:182` train, `:124` searchlights, `:82` all pass in C11 · `harness.spec.ts:97`/`:138` now assert reaching the target in the same `evaluate` as the helper (they replace the round-2 `:68`/`:102`) | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary (`runSteps`, 3 exits) - carried from 3d4459d | `src/core/GameLoop.ts` | vitest at its own layer: C1, C2 | yes - n steps, n = 0 and throw are each asserted; round-1 F1 and F2 were killed; the file is untouched |
| Decides, reached across a boundary (2 helper modes, 2 `waitSimUntil` exits, `stepSim`) - verified at 58a26be | `tests/e2e/helpers.ts`, `src/core/Game.ts` `stepSim` | browser: C3-C8 | yes - each mode and each exit is asserted with the check's value. The fast mode with top-up has `:97-98`/`:104-105`, realtime has `:114-115`, the predicate exit has `:130-131` and the deadline exit has `:138-139`. F1, F2, F3 and F5 were all killed |
| Instrumentation (`playwright.config.ts` reads the variable) - carried from 3d4459d | `playwright.config.ts` | a proof that imports the config: C10 | yes - both door-2 values are asserted; round-1 F3 was killed; the file is untouched |

## Faults injected

verified at 58a26be.

- **Setup.** Scratch worktree `.claude/worktrees/verify-e2e-speed-r3` at 58a26be, with
  `node_modules` through a junction and `E2E_PORT=5186`.
- **Real tree.** `git status --porcelain` was empty before and after.
- **Between faults.** Each fault was reverted with `git checkout --` before the next one, and the
  worktree was clean each time.
- **Experiment file.** The draw-call experiment spec `tests/e2e/zzverify.spec.ts` existed only in
  the scratch worktree and was deleted before removal.
- **Cleanup.** The junction was deleted first with `(Get-Item ...).Delete()`, then
  `git worktree remove` ran. `node_modules/three/package.json` is still present in the main
  checkout.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 (round-2 F1 re-injected): delete the top-up loop `while (g.simTime < target && g.running) g.stepSim(1 / 60)` | `tests/e2e/helpers.ts:54` `advanceSim` | yes - `harness.spec.ts:97` `expect(r.reached).toBe(true)`, Received `false` (with s = 3, 180 summed steps land a few ulps short) |
| F2 (round-2 F2 re-injected): `waitSimUntil` deadline one step short (`g.simTime < deadline` -> `g.simTime < deadline - 1 / 60`) | `tests/e2e/helpers.ts:88` | yes - `harness.spec.ts:138` `expect(d.reached).toBe(true)`, Received `false` |
| F3 (new spy surface, `advanceSim` upper bound): the top-up overshoots by stepping twice per iteration (`{ g.stepSim(1 / 60); g.stepSim(1 / 60); }`) | `tests/e2e/helpers.ts:54` | yes - `harness.spec.ts:98` Expected `<= 3.0166666676666667`, Received `3.0333333333333266` |
| F4 (fix-touched draw-call proof): 8 extra boxes added under the player car mesh after `chase.snapTo` | `src/core/Game.ts:250` | yes - `race.spec.ts:386` Expected `<= 218`, Received `227` |
| F5 (new spy surface, `waitSimUntil` upper bound): deadline two steps long (`g.simTime < deadline + 2 / 60`) | `tests/e2e/helpers.ts:88` | yes - `harness.spec.ts:139` Expected `<= 0.5166666676666667`, Received `0.5499999999999983` |

F4 does not tell the fast path from the realtime one: under the fault the old fast path read 233.
The draw-call experiment settles that question (realtime 211 = settled 211; the fast path read 201
and 198). The C13 literal (`docs.test.ts:85` `toContain('28.9 min')`) was not mutated. Its
assertion reads the value directly, and the cap went to the surfaces above.

## Gate

- `npx vitest run tests/unit/gameLoop.test.ts tests/unit/e2eConfig.test.ts tests/unit/docs.test.ts -t "<C1|C2|C10|C13 names>"`: 4 passed, 0 failed.
- `E2E_PORT=5183 npx playwright test <4 files> -g "<C3-C9 names + draw calls within budget while racing>"`: 13 passed, 0 failed (3.0 min).
- `E2E_PORT=5184 npm run test:e2e`: 172 passed, 0 failed (29.6 min, wall 1776 s, exit 0).
- `E2E_PORT=5185 npm run test:e2e:smoke`: 22 passed, 0 failed (2.3 min, wall 139 s, exit 0).

Note: C11 passes with 0.4 min to spare (29.6 of 30 min). The three green post-fix runs span
28.9-29.6 min, so load on the machine during a run can push it over the limit.
