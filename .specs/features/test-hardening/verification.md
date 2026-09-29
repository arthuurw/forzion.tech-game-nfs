# test-hardening verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 12bbc59..5d56a82
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

29 of 31 checks proven with located evidence. C21 and C30 are partial: each has one sub-claim that no proof asserts. One coverage member has no proof: the `Space` branch of `InputManager`, which the checks' own Test policy evidence names. All 5 injected faults were killed.

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `.specs/audits/2026-09-29-validation.md` (docs-1..14, tests-1..16, gates-1..4, wgen-8, veh-11) | yes - read gates-1..4, veh-11, wgen-8, tests-1..16, docs-5..7 in full | none. Every FIX the plan adopts matches its check (tests-1 -> C10, tests-3 -> C11/C12, tests-9 -> C19, tests-12 -> C16/C17, tests-13 -> C18, veh-11 -> C25, docs-7 -> C31). tests-4, docs-13 and the GameLoop part of tests-8 are out of scope in plan.md | - |
| `AGENTS.md` "Worktrees de agentes" | yes | none | - |

## Checks

All proofs ran at HEAD 5d56a82. Invocations:
- (a) `npm test -- --reporter=verbose`: exit 0, 54 files, 212 passed. Each named vitest test below appears in that log as `✓`.
- (b) `npx vitest run tests/unit --reporter=json --outputFile=<tmp>` followed by `max-duration.mjs`.
- (c) `npm run test:quick`: exit 0, 211 passed, 1 skipped.
- (d) `node tests/tooling/list-has.mjs`, run with both modes.
- (e) `node tests/tooling/e2e-reuse.mjs 5197`.
- (f) `E2E_PORT=5193 npm run test:e2e:smoke`, timed.
- (g) one `E2E_PORT=5193 npx playwright test tests/e2e/race.spec.ts tests/e2e/world.spec.ts -g "<7-way alternation>"`: exit 0, 7 passed (4.4m), each test listed individually.
- (h) `npx tsc --noEmit -p . --noUnusedLocals --noUnusedParameters`.
- (i) `npx playwright test --list`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `task.timeout` = 30000 in unit and physics | (a) `unit tests run with a 30 s timeout` ✓, `physics tests run with a 30 s timeout` ✓ | `tests/unit/testConfig.test.ts:6` and `tests/physics/testConfig.test.ts:6` - `expect(task.timeout).toBe(30_000)`; config `vite.config.ts:9` `testTimeout: 30_000` | PASS |
| C2 | no unit test > 3000 ms (idle) | (b) vitest exit 0; `max-duration.mjs ... 3000` exit 0: "166 testes, todos ≤ 3000 ms" | `tests/tooling/max-duration.mjs:17` - `if ((t.duration ?? 0) > limit) slow.push(...)` then exit 1. Slowest measured: `extras motion cats walk sit and stay in their zone` at 2717 ms (9 % headroom) | PASS |
| C3 | `test:quick` exits 0 and does not list the slow test | (c) exit 0, "211 passed \| 1 skipped (212)"; (d) `--tags-filter="!slow" --absent`: exit 0, "211 testes listados; ... ausente" | `tests/tooling/list-has.mjs:19` - `process.exit((mode === '--present') === found ? 0 : 1)`; `package.json` `"test:quick": "vitest run --tags-filter=!slow"`; tag at `tests/physics/raceAi.test.ts:92` `{ tags: ['slow'], timeout: 900_000 }` | PASS |
| C4 | `npm test` still lists the slow test, total = before − removed + created | (d) `--present`: exit 0, "212 testes listados; ... presente"; (a) shows `each opponent finishes every race in time 51989ms` ✓ | `tests/tooling/list-has.mjs:19`. Count recomputed by the Verifier with `vitest list --json` in a worktree at 12bbc59: 202 before, 212 after. Removed: 6, all `cityGenerator.test.ts` `generateCity` cases (C26's set). Added: 16 new tests. 202 − 6 + 16 = 212. **Precision gap:** the check says "os que a C25 remove" when the removals are C26's, gives no number, and no proof asserts the count | PASS |
| C5 | busy port and no `E2E_REUSE` -> exit ≠ 0, `is already used`, no test runs | (e) "without E2E_REUSE: exit 1, recusou a porta: true" | `tests/tooling/e2e-reuse.mjs:40` - `without.code !== 0 && without.out.includes('is already used') && !/\d+ passed/.test(without.out)`; config `playwright.config.ts:22` `reuseExistingServer: !!process.env.E2E_REUSE` | PASS |
| C6 | `E2E_REUSE=1` -> reuses the server, exit 0 | (e) "with E2E_REUSE=1: exit 0, reaproveitou e passou: true"; script exit 0 | `tests/tooling/e2e-reuse.mjs:48` - `withReuse.code === 0 && /1 passed/.test(withReuse.out)` | PASS |
| C7 | 9 specs each have ≥1 `@smoke`; script is `playwright test --grep @smoke` | (a) `every e2e spec file has a smoke test` ✓ | `tests/unit/testHygiene.test.ts:21` - `expect(e2eSpecs.sort()).toEqual([...9 names])`; `:26` `expect(smoke.length, f).toBeGreaterThanOrEqual(1)`; `:29` `expect(pkg.scripts['test:e2e:smoke']).toBe('playwright test --grep @smoke')` | PASS |
| C8 | `test:e2e:smoke` exits 0 in ≤ 10 min, idle | (f) run alone: "18 passed (4.2m)", exit 0, wall clock 252 s | smoke log: 2 `@smoke` tests from each of the 9 spec files ran (for example `tests\e2e\world.spec.ts:214:3 ... @smoke (15.8s)`). 252 s ≤ 600 s | PASS |
| C9 | `playwright test --list` ≥ 132 | (i) "Total: 135 tests in 9 files" | 135 ≥ 132. The Handoff recorded 132 before the 3 new tests in `race.spec.ts:436,454,464` | PASS |
| C10 | driving W from 15 m before `gates[0]` sets `lastGate` 0 in ≤ 5 s, without `crossNextGate` | (g) `player crosses a gate by driving` ✓ | `tests/e2e/race.spec.ts:446` `expect((await race(page)).player.lastGate).toBe(-1)`; `:448` `waitSimUntil(page, 'g.race.player.lastGate === 0', 5)`; `:450` `expect(crossed).toBe(true)`. No `crossNextGate` call in the test body (`:436-452`) | PASS |
| C11 | still on the grid 1.5 s after GO: position 4, `POS 4/4` | (g) `hud shows time lap and position` ✓ | `tests/e2e/race.spec.ts:170` `expect(s.pos).toBe(4)`; `:171` `expect(s.posText).toBe('POS 4/4')` | PASS |
| C12 | sprint finished by `crossNextGate`: row 1 `VOCÊ`, rows 2-4 `--:--.--` | (g) `finishing a sprint shows the results` ✓ | `tests/e2e/race.spec.ts:189` `expect(rows[0]![1]).toBe('VOCÊ')`; `:191` `for (const r of rows.slice(1)) expect(r[2]).toBe('--:--.--')` | PASS |
| C13 | repeat keydown changes no state and calls no handler | (a) `repeat keydown changes nothing` ✓ | `tests/unit/inputManager.test.ts:23` `expect(input.state.throttle).toBe(false)`; `:24` `expect(presses).toBe(0)` | PASS |
| C14 | `onFirstKey` runs once over 3 distinct keydowns | (a) `first key handler runs once` ✓ | `tests/unit/inputManager.test.ts:35` `expect(first).toBe(1)` | PASS |
| C15 | keyup W -> throttle false; press handler 1 per press, 2 for 2 presses | (a) `keyup clears and press handler runs per press` ✓ | `tests/unit/inputManager.test.ts:44` `expect(input.state.throttle).toBe(false)`; `:50` `expect(presses).toBe(1)`; `:53` `expect(presses).toBe(2)` | PASS |
| C16 | 4.9 m of progress: false at 3.99 s, true at 4.0 s | (a) `stuck detector thresholds and target` ✓ | `tests/unit/aiDriver.test.ts:65` `expect(at(3.99)).toBe(false)`; `:66` `expect(at(4.0)).toBe(true)`. The setup at `:60-62` sets progress 100 -> 104.9 | PASS |
| C17 | physics stuck reset between 3.9 s and 4.1 s after stopping | (a) `stuck opponent is reset to its last gate` ✓ | `tests/physics/raceAi.test.ts:139` `expect(k * DT - stoppedAt).toBeGreaterThanOrEqual(3.9)`; `:140` `...toBeLessThanOrEqual(4.1)` | PASS |
| C18 | `yawAssistTorque(SPEC, 0.3, 10, 0, 2, INERTIA)` = 5000 ± 1e-6 as a table row | (a) `yaw assist torque follows the target yaw rate` ✓ | `tests/unit/yawAssist.test.ts:38` row `['two wheels on the ground', 0.3, 10, 0, 2, 5000]`; `:46` `expect(Math.abs(t - expected), ...).toBeLessThanOrEqual(TOL)` with `TOL = 1e-6` (`:14`) | PASS |
| C19 | 2 updates per frame -> max 2; 1 per frame -> 1 | (a) `max builds counts builds between frames` ✓; (g) `chunks stream around the car` ✓ | `tests/unit/chunkManager.test.ts:23` `expect(twice.maxBuildsInOneFrame).toBe(2)`; `:32` `expect(once.maxBuildsInOneFrame).toBe(1)`; `tests/e2e/world.spec.ts:361` `expect(r.chunks.maxBuildsInOneFrame).toBe(1)`. `endFrame` is called per render at `src/core/Game.ts:354` and after the boot build at `:180` | PASS |
| C20 | an indirect three import is flagged; an `import type` path is not | (a) `transitive imports are followed` ✓, `pure modules do not import three or rapier` ✓ | `tests/unit/purity.test.ts:106` `expect(forbiddenReach(join(dir, 'indirect.ts'))).toBe(join(dir, 'heavy.ts'))`; `:107` `expect(forbiddenReach(join(dir, 'typeOnly.ts'))).toBeNull()`; `:92` `expect(forbiddenReach(file), rel).toBeNull()` over the 36 modules | PASS |
| C21 | behaviour: 4 smoke per step, alive at 0.79 s and dead at 0.81 s, 3001 -> 40 sparks and 2999 -> 0; no `expect(CONST).toBe(literal)` left | (a) `effect constants` ✓ | `tests/unit/effectsMath.test.ts:71` `expect(fx.smoke.alive).toBe(4)`; `:81` `expect(life.smoke.alive).toBe(1)` after 0.79 s; `:83` `...toBe(0)` after 0.81 s; `:97` `expect(hit(2999)).toBe(0)`; `:99` `expect(hit(3001)).toBe(40)`. **Gap:** nothing asserts the sub-claim "no `expect(CONST).toBe(literal)`". It holds at HEAD: `rg "expect\([A-Z_]+\)" tests/unit/effectsMath.test.ts` matches only the comment at `:57`. But the hygiene rule `LITERAL_ONLY` (`tests/unit/testHygiene.test.ts:16`) matches only numeric literals, so re-adding `expect(SMOKE_PER_STEP).toBe(4)` would stay green | FAIL - partial |
| C22 | cornerAssist:19-20 literal arithmetic gone; drivetrain `t` gone | (a) `no literal-only assertions left` ✓ | `tests/unit/testHygiene.test.ts:42` `expect(hits).toEqual([])` over `tests/unit` and `tests/physics`, with `LITERAL_ONLY` at `:16`, which matches both removed forms `expect((100 * Math.tan(0.05)) / 2.6).` and `expect(0.9 * 9.81).`; `:44` `expect(read('tests/unit/drivetrain.test.ts')).not.toContain('const t = (back.state.rpm - spec.idleRpm)')` | PASS |
| C23 | e2e has 0 `waitForTimeout` and 0 fixed `test-results/` screenshot paths | (a) `e2e has no fixed clock waits nor fixed screenshot paths` ✓ | `tests/unit/testHygiene.test.ts:58` `expect(hits).toEqual([])`, fed by the regexes at `:54-55`. `git grep` at 12bbc59 finds the 6 waits and 1 screenshot; at HEAD it finds only `race.spec.ts:327` `test.info().attach(...)` | PASS |
| C24 | held countdown fails with `countdown não terminou em 4 s`; without the hook it passes | (g) `countdown holds every car` ✓, `countdown deadline message` ✓ | `tests/e2e/race.spec.ts:459` `await expect(sampleCountdown(page, 4)).rejects.toThrow('countdown não terminou em 4 s')`; `:460` state is still `countdown`; the unheld case at `:136-138` passes with `maxKmh < 1` and state `racing`. Message source: `tests/e2e/helpers.ts:160` | PASS |
| C25 | `placeOpponent` 2 m past an uncrossed gate: `prev` = placed ±0.01 m, `lastGate` unchanged after 0.2 s | (g) `placing an opponent does not cross gates` ✓ | `tests/e2e/race.spec.ts:475-476` `expect(Math.abs(r.prev.x - r.x)).toBeLessThanOrEqual(0.01)` (same for z); `:478` `expect((await race(page)).opponents[0].progress.lastGate).toBe(r.lastGate)`. The hook now calls `Opponent.placeAt` (`src/core/Game.ts:467`) | PASS |
| C26 | dead symbols gone from `src/`; 4 exports kept; header has no 8×8 / 202 | (a) `old city generator is gone` ✓, `mulberry32 is deterministic` ✓ | `tests/unit/testHygiene.test.ts:75` `expect(src.filter(...)).toEqual([])` per name (list at `:74`); `:79` `expect(gen, name).toMatch(/export (const\|function) <name>\b/)`; `:81` `expect(gen).not.toMatch(/8×8\|202/)`; `tests/unit/cityGenerator.test.ts:12-13` for determinism | PASS |
| C27 | strict `tsc` exits 0 with 0 errors | (h) exit 0, no output | `src/hud/Minimap.ts:12` is now the plain parameter `canvas: HTMLCanvasElement`; the `g` helper is gone from `tests/e2e/visual.spec.ts` (diff) | PASS |
| C28 | `ci.yml`: push and pull_request, ubuntu-latest, Node 24, `npm ci` -> `npm run build` -> `npm test` in order | (a) `ci workflow runs build and unit tests` ✓ | `tests/unit/testHygiene.test.ts:64` `toMatch(/^on:\s*\[push, pull_request\]\s*$/m)`; `:65` ubuntu-latest; `:66` `node-version:\s*24\b`; `:68` `expect(runs).toEqual(['npm ci', 'npm run build', 'npm test'])`. The go-live proof (`gh run list`) waits on open question 1 (push), as the plan says | PASS |
| C29 | README: no "as corridas ainda não existem"; roadmap item 2 done; races and train listed; `Enter`, `Esc` and `R` rows | (a) `readme describes what exists` ✓ | `tests/unit/docs.test.ts:30` `not.toContain('as corridas ainda não existem')`; `:34` item 2 `toMatch(/~~Corridas~~\|\(concluído\)/)`; `:36-37` Corridas and trem; `:39-40` `Enter` and `Esc` rows; `:41` `R` row `toMatch(/último portão/)` | PASS |
| C30 | AGENTS.md, the README tree and the new AD all name `race` and `world/rail`; AD-004 superseded by AD-018; AD-018 active and after AD-017 | (a) `layout is the same in agents readme and state` ✓ | `tests/unit/docs.test.ts:46-47` AGENTS has both; `:49-50` README tree has `├── race/` and `rail/`; `:53` `superseded by AD-018`; `:56` order; `:57` `active`; `:58` AD-018 `toContain('`src/{core,world,vehicle,camera,hud,audio,post,race}/`')`. **Gap:** no assertion covers the AD-018 half `world/{...,rail}/`. It is present at `.specs/STATE.md:49`, but dropping `rail` from AD-018 would leave the proof green | FAIL - partial |
| C31 | STATE: residuals line done, ADs in order, races block gone; `teleport` doc cites grid, AD-015 and water; README `## Intent` path | (a) `state and docs are current` ✓ | `tests/unit/docs.test.ts:64` `toContain('(concluída, verificada rodada 1)')`; `:66` `expect(numbers).toEqual([...numbers].sort(...))`; `:68` `not.toContain('races: pintura dos oponentes sai escura')`; `:71-73` grid, AD-015 and água in the `teleport` doc; `:75` `section(readme, 'Como é feito')` contains `## Intent` | PASS |

Level and sampling: every claim about an exit code (C3, C5, C6, C8, C27) was run with the real command. Claims about DOM and race wiring (C10-C12, C24, C25) are proven in the browser e2e, as the Test policy asks. Claims about a pure decision are proven by unit tests. No level gaps.

Swept rows: each cites a check or says `n/a`. None cites an existing constraint, so there is nothing to re-read.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| vitest dirs with a timeout (2) | `vite.config.ts:6` include globs | tests/unit C1 (`testConfig.test.ts:6`), tests/physics C1 (`physics/testConfig.test.ts:6`) | - |
| new and changed npm scripts (3) | `package.json` scripts vs 12bbc59 | `test:quick` C3 (run), `test:e2e:smoke` C7 and C8 (run), `test` C4 (run and list) | - |
| e2e server modes (2) | `playwright.config.ts:22` | without `E2E_REUSE` C5, with `E2E_REUSE=1` C6. Fault F5 killed | - |
| spec files with `@smoke` (9) | `ls tests/e2e/*.spec.ts` = 9 | table-driven C7 (`testHygiene.test.ts:21,26`); the smoke run executed 2 per file | - |
| exit codes of new commands (2) | Observable table in the plan | 0: C3, C6, C8; ≠ 0: C5 | - |
| `InputManager` branches (5 in code; the checks' row lists 4) | `src/core/InputManager.ts:33-46`; checks.md Test policy evidence names "`Space`, primeira tecla, `repeat`, handler por código, mais o `keyup`" | repeat C13, first key C14, keyup C15, press per code C15. `Space` -> `event.preventDefault()` (`InputManager.ts:34`): no proof. `rg "defaultPrevented\|preventDefault" tests` finds nothing | `Space` preventDefault branch (InputManager.ts:34) |
| sides of the stuck threshold (2) | `src/race/aiDriver.ts:219` | 3.99 s C16 (`:65`), 4.0 s C16 (`:66`) and C17 (`raceAi.test.ts:139-140`). Fault F3 killed | - |
| constant-only assertions to replace (3 files) | audit tests-6, plan AC 17 | effectsMath C21 (behaviour now proven, but see the C21 gap); cornerAssist and drivetrain C22 | - |
| fixed waits to replace (6) | `git grep waitForTimeout 12bbc59 -- tests/e2e` = 6 hits (hud :45 :93 :101 :128, extras :36, render :7) | C23 table-free scan (`testHygiene.test.ts:58`); 0 hits at HEAD | - |
| purity import kinds (3) | `purity.test.ts` RELATIVE and FORBIDDEN regexes | direct (`:92` plus FORBIDDEN), relative -> three (`:106`), `import type` ignored (`:107`) | - |
| dead symbols (5) | audit wgen-8 | all 5 by name at `testHygiene.test.ts:74-75` | - |
| `tsc` leftovers (2) | audit gates-3, gates-4 | `Minimap.canvas` and `visual.spec.ts` `g`: C27, strict tsc exit 0 | - |
| door 1 events and steps (5) | plan Landing door 1 | `testHygiene.test.ts:64,68` | - |
| documents and their affirmed phrases (3 docs) | plan AC 25-30 | README C29/C30/C31, AGENTS.md C30, STATE.md C30/C31. AD-018 `world/rail` (`STATE.md:49`) has no assertion (see C30) | AD-018 `world/{...,rail}` phrase (STATE.md:49) |

Sets not given a row in checks.md: the `holdCountdown` DEV hook (`RaceController.ts:164`) and `Opponent.placeAt` are covered by C24 and C25. The `endFrame` call sites (boot at `Game.ts:180`, render at `Game.ts:354`) are covered by C19 e2e. Neither needs a row of its own.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Test configuration | `vite.config.ts`, `playwright.config.ts`, `package.json` | real tool, read the effect: C1 (task.timeout, 2 dirs), C5/C6 (exit codes, 2 modes), C3/C4 (list), C8 (run) | yes |
| Decides, pure | `checkStuck`, `yawAssistTorque`, `InputManager` | own layer, vitest, one case per row of the decision table | no - `InputManager` has 5 branches and the checks' own evidence names `Space` as one of them. `Space` -> `preventDefault` (`InputManager.ts:34`) has no case. `checkStuck` (C16) and `yawAssistTorque` (C18) are met |
| `ChunkManager` counter | `src/world/ChunkManager.ts` | real unit test plus the existing e2e, rhythms of 1 and 2 updates per frame | yes - `chunkManager.test.ts:23,32` and `world.spec.ts:361` |
| Race wiring (`RaceController` -> HUD) | `RaceController.ts`, `Game.ts` hooks | e2e, one case per asserted value | yes - POS `race.spec.ts:170-171`, row 1 `:189`, rows 2-4 `:191`, gate `:450`, placement `:475-478` |
| Document text and hygiene rules | README, AGENTS.md, STATE.md, `Car.ts` doc, test sources | unit test reading the file, one assertion per affirmed phrase or file | no - the AD-018 `world/rail` phrase (C30) and the "no `expect(CONST)`" hygiene rule (C21) have no assertion |

## Faults injected

Scratch: `git worktree add C:\Users\arthu\AppData\Local\Temp\th-fault HEAD`, with a `node_modules` junction. Each fault was reverted with `git checkout -- <file>` inside the scratch. The real tree's `git status --porcelain` was empty before and after all faults, matching the baseline. The junctions were deleted before `git worktree remove`.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1: player `stepProgress(...)` line deleted from `afterStep`; E2E_PORT=5195, `player crosses a gate by driving` failed at `race.spec.ts:450` (Expected true, Received false) | `src/race/RaceController.ts:175` | yes |
| F2: `if (event.repeat) return;` removed; `repeat keydown changes nothing` failed (expected true to be false) | `src/core/InputManager.ts:39` | yes |
| F3: `STUCK_WINDOW_S` 4 -> 3.9; `stuck detector thresholds and target` failed at `aiDriver.test.ts:65` | `src/race/aiDriver.ts:35` | yes |
| F4: `endFrame` records `Math.min(1, builds delta)`, a per-frame cap like the old plan size; `max builds counts builds between frames` failed at `chunkManager.test.ts:23` (expected 1 to be 2) | `src/world/ChunkManager.ts:91` | yes |
| F5: `reuseExistingServer` set back to `true`; `node tests/tooling/e2e-reuse.mjs 5195` exited 1 ("without E2E_REUSE: exit 0, recusou a porta: false") | `playwright.config.ts:22` | yes |

## Gate

- `npm test -- --reporter=verbose`: 212 passed, 0 failed (54 files)
- `npm run test:quick`: 211 passed, 1 skipped, 0 failed
- `npx vitest run tests/unit --reporter=json` plus `max-duration.mjs 3000`: 166 passed, max 2717 ms
- `npm run test:e2e:smoke` (E2E_PORT=5193): 18 passed, 0 failed, 252 s
- `npx playwright test` on the 7 named e2e proofs (E2E_PORT=5193): 7 passed, 0 failed
- `node tests/tooling/e2e-reuse.mjs 5197`: exit 0; `list-has.mjs` in both modes: exit 0; strict `tsc`: exit 0; `playwright test --list`: 135 tests

## Ranked gaps

1. The `Space` -> `preventDefault` branch of `InputManager` has no proof, although the checks' Test policy evidence names it as a decision branch. This leaves the "Decides, pure" row unmet (Coverage, Test policy) - `src/core/InputManager.ts:34`.
2. C30: the AD-018 assertion checks only `src/{...,race}/`. The `world/{terrain,roads,lots,interiors,rail}/` half that the check names is unasserted - `tests/unit/docs.test.ts:58` (fact at `.specs/STATE.md:49`).
3. C21: the sub-claim "no `expect(CONST).toBe(literal)` left" has no assertion. `LITERAL_ONLY` matches only numeric literals - `tests/unit/testHygiene.test.ts:16`.
4. Precision gap (does not fail the feature on its own): C4 attributes the removed tests to "C25" when they are C26's, gives no number, and no proof asserts the count. The Verifier recomputed it: 202 − 6 + 16 = 212, which holds.
5. Note only: C2 passes with 9 % headroom. The slowest unit test, `extras motion cats walk sit and stay in their zone`, measured 2717 ms against the 3000 ms cap.
