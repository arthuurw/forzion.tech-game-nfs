# e2e-speed verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 68d1205..3d4459d
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Everything below was verified at 3d4459d. C11 fails: the full suite at HEAD ends with exit 1, 2
failed and 170 passed, in 26.1 min. Both failures come from this feature's move to the fast
helpers. One reproduces every time and the other is flaky. The other 12 checks are proven, and all
5 injected faults were killed.

## Binding sources

None. The plan marks no source as binding, and profile `standard` does not run step 1.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `runSteps(5)` -> 5 x `fixedUpdate(1/60)`, 0 renders; `runSteps(0)` calls neither | `npx vitest run tests/unit/gameLoop.test.ts tests/unit/e2eConfig.test.ts tests/unit/docs.test.ts -t "<4 names>"` exit 0, `✓ runSteps calls fixedUpdate n times without render` | `tests/unit/gameLoop.test.ts:68` - `expect(dts).toEqual([1 / 60, 1 / 60, 1 / 60, 1 / 60, 1 / 60])`; `:69` `expect(renders).toBe(0)`; `:71-72` after `runSteps(0)`: `toHaveLength(5)`, `renders` 0 | PASS |
| C2 | throw on the 3rd call: 3 calls, `running` false, `onError` once with the same error, no rethrow | same invocation, `✓ runSteps stops on a throw and reports it once` | `tests/unit/gameLoop.test.ts:91` `expect(() => loop.runSteps(5)).not.toThrow()`; `:92` `expect(calls).toBe(3)`; `:93` `expect(loop.running).toBe(false)`; `:94` `expect(reported).toEqual([boom])` | PASS |
| C3 | `stepSim(s)` for s in {0.5, 1, 1/60} adds `Math.round(s*60)/60` ± 1e-9, read in the same `evaluate` | `E2E_PORT=5182 npx playwright test tests/e2e/harness.spec.ts tests/e2e/visual.spec.ts tests/e2e/audio.spec.ts tests/e2e/race.spec.ts tests/e2e/extras.spec.ts -g "<14 names>"`: `✓ 3 ... stepSim advances exactly the requested steps` (also `✓ 27` in C11) | `tests/e2e/harness.spec.ts:24` - `expect(Math.abs(d - Math.round(s * 60) / 60)).toBeLessThanOrEqual(1e-9)` over `[0.5, 1, 1 / 60]` (`:18`), with `d` from `g.stepSim(s) - before` in one `evaluate` (`:19-23`) | PASS |
| C4 | `KeyW` held + `stepSim(2)` from the stopped spawn -> `speedKmh` > 10 | same: `✓ 5 ... stepSim reads held keys` | `tests/e2e/harness.spec.ts:38` - `expect(kmh).toBeGreaterThan(10)` (`kmh` read in the `evaluate` that ran `stepSim(2)`, `:32-36`) | PASS |
| C5 | after `stepSim(2)` + 1 frame, `#speed` = `round(abs(speedKmh))` ± 1 | same: `✓ 6 ... next frame shows the last step` | `tests/e2e/harness.spec.ts:50` waits for `frames >= f + 1`; `:57` - `expect(Math.abs(label - Math.round(Math.abs(kmh)))).toBeLessThanOrEqual(1)` | PASS |
| C6 | `advanceSim(page, 3)`: simTime +≥ 3, frames +≥ 1 and ≤ 10 | same: `✓ 7 ... advanceSim steps fast and waits one frame` | `tests/e2e/harness.spec.ts:68` `expect(b.simTime - a.simTime).toBeGreaterThanOrEqual(3)`; `:69` `>= 1`; `:71` `toBeLessThanOrEqual(10)`. Precision gap: see Ranked gaps 3 | PASS |
| C7 | `advanceSim(page, 1, { realtime: true })`: simTime +≥ 1, frames +≥ 12 | same: `✓ 9 ... advanceSim realtime waits on the frame loop` | `tests/e2e/harness.spec.ts:80` `>= 1`; `:81` `expect(b.frames - a.frames).toBeGreaterThanOrEqual(12)` | PASS |
| C8 | `waitSimUntil` true with 30 ≤ kmh < 30 + one-step gain + 0.5; `'false'`, 0.5 -> false, simTime +0.5..0.75 | same: `✓ 10 ... waitSimUntil stops on the first step that holds` | `tests/e2e/harness.spec.ts:88` `toBe(true)`; `:96` `expect(r.at).toBeGreaterThanOrEqual(30)`; `:97` `expect(r.at).toBeLessThan(30 + r.gain + 0.5)`; `:100` `toBe(false)`; `:102` `>= 0.5 - 1e-9`; `:103` `<= 0.75` | PASS |
| C9 | the 6 frame-dependent proofs pass and every sim wait in each body is `realtime`, `waitFrames` or `sampleCountdown` | same invocation: `✓` audio:38, audio:96, race:144, visual:277, visual:295, visual:327 | bodies read: `tests/e2e/visual.spec.ts:281` `advanceSim(page, 3, { realtime: true })`, `:301` and `:333` realtime; `tests/e2e/audio.spec.ts:41`, `:49`, `:99` realtime; `tests/e2e/race.spec.ts:150` `sampleCountdown(page, 4)`; there is no other sim wait in these bodies | PASS |
| C10 | `workers` from `E2E_WORKERS`, default 2; `--list` gives the same output with `=1` and without the variable | vitest invocation above: `✓ workers come from E2E_WORKERS with default 2` | `tests/unit/e2eConfig.test.ts:28` `expect(await workers(undefined)).toBe(2)`; `:29` `toBe(1)`; `:32` `expect(list(undefined)).toBe(one)`; config line `playwright.config.ts:11` `workers: Number(process.env.E2E_WORKERS ?? 2)` | PASS |
| C11 | `npm run test:e2e` on an idle machine: exit 0, 0 failures, every test runs, ≤ 25 min | `E2E_PORT=5182 npm run test:e2e`, run alone on an idle machine: **exit 1**, `2 failed`, `170 passed (26.1m)`, wall 1567 s | failures: `tests/e2e/extras.spec.ts:182` `expect(b.t - a.t).toBeGreaterThanOrEqual(2)`, Received `1.9999999999999956`; `tests/e2e/visual.spec.ts:153` `expect(high).toBeGreaterThan(0)`, Received `0` | FAIL |
| C12 | `npm run test:e2e:smoke` idle: exit 0, 0 failures, ≤ 3 min | `E2E_PORT=5182 npm run test:e2e:smoke` run alone: exit 0, `22 passed (2.5m)`, wall 152 s | Playwright totals: 22 passed, 0 failed, 2.5 min ≤ 3 min | PASS |
| C13 | `AGENTS.md` names `E2E_WORKERS` and the measured C11/C12 times on the two lines | vitest invocation above: `✓ agents gives the e2e times and workers` | `tests/unit/docs.test.ts:84` `expect(full).toContain('E2E_WORKERS')`; `:85` `toContain('24.6 min')`; `:87` `expect(smoke).toContain('2.4 min')`. Note: these are the author's times; the Verifier's run took 26.1 min and failed, and smoke took 2.5 min | PASS |

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| door 1: fast-forward (3 parts) | `src/core/GameLoop.ts` `runSteps`, `src/core/Game.ts` `stepSim`, `tests/e2e/helpers.ts` | `runSteps` C1, C2 · `stepSim` C3, C4, C5 · `advanceSim`/`holdKeySim`/`waitSimUntil` C6, C7, C8 | - |
| door 2: parallelism (2 values) | `playwright.config.ts:11` | unset -> 2 C10 (`e2eConfig.test.ts:28`) · `1` -> 1 C10 (`:29`) | - |
| `runSteps` exits (3) | `GameLoop.ts` `runSteps`: loop, `n = 0`, catch | n steps C1 · n = 0 C1 · throw C2 | - |
| helper modes (2) | `helpers.ts` `if (!opts.realtime)` in `advanceSim` and `waitSimUntil` | fast C6, C8 · realtime C7, C9. The `waitSimUntil` realtime branch has no direct proof, and no test in the suite calls it with `realtime` (`rg "realtime: true"` finds only `advanceSim` calls) | - |
| `waitSimUntil` exits (2) | `helpers.ts` loop: predicate holds / step count runs out | holds C8 (`harness.spec.ts:88`) · runs out C8 (`:100`) | - |
| frame-dependent proofs (AD-019 / AC 9 rule: reads something the render updates over time) | the AC 9 rule applied to the specs, not the author's list of 6: every test that reads camera, render or audio state after a sim wait (scan of `tests/e2e/*.spec.ts`) | the 6 named -> C9 · and moved to realtime in this diff, proven by C11 passing them: `extras.spec.ts:103` steam (camera catches up), `nightCity.spec.ts:44` `lumAt`, `visual.spec.ts:267` shake decay, `:549`/`:560` reflection shimmer, `world.spec.ts:353` chunks | `visual.spec.ts:131` "rain falls on the hill roads": teleports with no camera snap and has the comment "a câmera de perseguição volta para trás do carro" (`:141`); the chase camera only updates in `render` (`src/core/Game.ts:372`), yet the test stays on the fast `advanceSim(page, 1.5)` (`:142`) and failed in C11 (`high` = 0) |
| timed suites (2) | `package.json` `test:e2e`, `test:e2e:smoke` | smoke C12 | full suite C11: exit 1, 2 failed, 26.1 min > 25 min |
| tests moved to the fast path that assert an exact sim duration | `rg "toBeGreaterThanOrEqual\((2|3|60)\)"` next to a fast `advanceSim` | `harness.spec.ts:68` (C6, passes this run) · `interiors.spec.ts` "ground light changes over time" `>= 60` (passes) | `extras.spec.ts:182` "the train advances 36 m in 2 s": 120 steps of 1/60 add up to `1.9999999999999956` < 2. It failed in C11 and again in an isolated rerun with the same value, so it is not a timing flake |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, not reached across a boundary (`runSteps`, 3 exits) | `src/core/GameLoop.ts` | vitest at its own layer: C1, C2 | yes - n steps, n = 0 and throw each asserted; F1 and F2 killed |
| Decides, reached across a boundary (2 helper modes, 2 `waitSimUntil` exits, `stepSim`) | `tests/e2e/helpers.ts`, `src/core/Game.ts` `stepSim` | browser: C3-C8 | yes - each mode and each exit asserted with the check's value; F4 and F5 killed |
| Instrumentation (`playwright.config.ts` reads the variable) | `playwright.config.ts` | a proof that imports the config: C10 | yes - both door-2 values asserted on the imported config; F3 killed |

## Faults injected

Scratch worktree `.claude/worktrees/verify-e2e-speed` at 3d4459d, with `node_modules` through a
junction. The real tree's `git status --porcelain` was empty before and after. The junction was
deleted before `git worktree remove`, and `node_modules` is intact.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1: loop bound `i < n` -> `i <= n` | `src/core/GameLoop.ts` `runSteps` | yes - C1 `toEqual` got 6 dts |
| F2: drop `this.stop()` from the catch | `src/core/GameLoop.ts` `runSteps` | yes - C2 `expected true to be false` (`running`) |
| F3: default `?? 2` -> `?? 1` | `playwright.config.ts:11` | yes - C10 `expected 1 to be 2` |
| F4: `if (!opts.realtime)` -> `if (true)` (sed hit both helpers' mode switches) | `tests/e2e/helpers.ts` `advanceSim` / `waitSimUntil` | yes - C7 frames `Expected: >= 12, Received: 4` |
| F5: `waitSimUntil` step budget `Math.round(seconds * 60)` -> `* 2` | `tests/e2e/helpers.ts` `waitSimUntil` | yes - C8 `Expected: <= 0.75, Received: 1.0166666666666635` |

No fault was aimed at C4, C5 or C6 (the cap is five). F1 also breaks the arithmetic C3 asserts,
but F1 was only run against C1.

## Ranked gaps

1. Full suite red and over the limit - C11 - exit 1, `2 failed`, `170 passed (26.1m)` (limit 25 min).
2. Exact sim-duration assertion broken by the fast path - C11 - `tests/e2e/extras.spec.ts:182`
   `expect(b.t - a.t).toBeGreaterThanOrEqual(2)` gets `1.9999999999999956` every run. f28d253 moved
   this call to `advanceSim` (fast) without a float tolerance or a step-count check.
3. A frame-dependent proof left on the fast path - AC 9 / C9 set - `tests/e2e/visual.spec.ts:142`
   (rain on the hill roads). The test needs the chase camera to catch up after a teleport, the
   camera is smoothed in `render` (`src/core/Game.ts:372`), and the test waits only one frame. It
   failed in C11 and passed in an isolated rerun, so it is flaky. The author's list of 6 did not
   include it.
4. Precision gap - C6 - the check says "simTime cresce ≥ 3" with no tolerance, while C3 states
   ± 1e-9. `tests/e2e/harness.spec.ts:68` has the same float-sum form that fails in gap 2, so it
   can fail depending on the starting `simTime`. C8 only has its `0.5 - 1e-9` tolerance in the test
   body (`:102`), not in the check text.
5. Note - C13 - `AGENTS.md` gives the author's 24.6 min. This run measured 26.1 min with failures.
   After the fix, the time needs re-measuring on a green run.

## Gate

- `npx vitest run tests/unit/gameLoop.test.ts tests/unit/e2eConfig.test.ts tests/unit/docs.test.ts -t "<C1|C2|C10|C13>"`: 4 passed, 0 failed.
- `npx playwright test <5 files> -g "<C3-C9 names + 2 C11 failures>"`: 13 passed, 1 failed (the train test, rerun to check whether it reproduces).
- `npm run test:e2e:smoke`: 22 passed, 0 failed (2.5 min).
- `npm run test:e2e`: 170 passed, 2 failed (26.1 min).
