# test-hardening verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 12bbc59..cd31003 (fix under re-verification: 65d1ba3..cd31003)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

31 of 32 checks proven with located evidence. All three round 1 gaps are closed: `InputManager` `Space` now has a proof (C32), the AD-018 `world/{...,rail}` half is asserted (C30), and the "no `expect(CONST)`" sub-claim of C21 is asserted. All 3 injected faults were killed. **C4 fails.** The fix rewrote C4 to say "212 testes: 202 − 6 + 16", but the same commit added the C32 test. At HEAD the proof prints `213 testes listados`, and the Verifier's recount gives 202 − 6 + 17 = 213. The check text is contradicted by its own proof's output, and the proof does not assert the number, so it stays green.

## Binding sources

Carried from 65d1ba3. The fix touched no interface, so step 1 is not re-run.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `.specs/audits/2026-09-29-validation.md` (docs-1..14, tests-1..16, gates-1..4, wgen-8, veh-11) | yes, in round 1 (carried from 65d1ba3). The fix changes only tests and `checks.md` wording | none | - |
| `AGENTS.md` "Worktrees de agentes" | yes, and followed in this round's scratch worktree | none | - |

## Checks

Verified at cd31003. All proofs were re-run at HEAD cd31003:
- (a) One vitest invocation covered the 12 proof files with a 22-way `-t` alternation of every named unit and physics proof: exit 0, "22 passed | 9 skipped (31)". Each of the 22 names appears individually as `✓`.
- (b) C2: `npx vitest run tests/unit --reporter=json --outputFile=<scratchpad>/unit-durations.json` (exit 0), then `node tests/tooling/max-duration.mjs <that file> 3000` printed "167 testes, todos ≤ 3000 ms" (exit 0).
- (c) `npm run test:quick`: exit 0, "212 passed | 1 skipped (213)".
- (d) `list-has.mjs --present ...`: exit 0, "213 testes listados; ... presente". The `--tags-filter="!slow" --absent` variant: exit 0, "212 testes listados; ... ausente".
- (e) `node tests/tooling/e2e-reuse.mjs 5197`: exit 0.
- (f) C8 smoke timing is carried from 65d1ba3 (18 passed, 252 s). The fix touched no e2e file or Playwright config.
- (g) One `E2E_PORT=5193 npx playwright test tests/e2e/race.spec.ts tests/e2e/world.spec.ts -g "<7-way alternation>"`: exit 0, "7 passed (4.3m)", each test listed with `✓`.
- (h) `npx tsc --noEmit -p . --noUnusedLocals --noUnusedParameters`: exit 0, no output.
- (i) `npx playwright test --list`: "Total: 135 tests in 9 files".

Citations were refreshed for the 4 test files the fix touched (`inputManager.test.ts`, `testHygiene.test.ts`, `docs.test.ts`, `effectsMath.test.ts`). The other test files are unchanged since 5d56a82, so their line numbers still hold.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `task.timeout` = 30000 in unit and physics | (a) both `... run with a 30 s timeout` ✓ | `tests/unit/testConfig.test.ts:6` and `tests/physics/testConfig.test.ts:6` - `expect(task.timeout).toBe(30_000)` | PASS |
| C2 | no unit test > 3000 ms (idle) | (b) exit 0 and exit 0 | `tests/tooling/max-duration.mjs:17` - `if ((t.duration ?? 0) > limit) slow.push(...)`. Slowest measured this round: `races of seed 1337 routes are continuous and on the asphalt` at 2635 ms (12 % headroom) | PASS |
| C3 | `test:quick` exits 0 and does not list the slow test | (c) exit 0; (d) `--absent` exit 0 | `tests/tooling/list-has.mjs:19` - `process.exit((mode === '--present') === found ? 0 : 1)`; tag at `tests/physics/raceAi.test.ts:92` `{ tags: ['slow'], timeout: 900_000 }` | PASS |
| C4 | `npm test` lists the slow test, **with 212 tests: 202 − 6 (C26) + 16** | (d) `--present` exit 0, but output "**213** testes listados" | `tests/tooling/list-has.mjs:19` asserts presence only; no proof asserts the count. Verifier recount with `vitest list --json` at 12bbc59 and at cd31003: base 202, HEAD 213, removed 6 (the `cityGenerator.test.ts` `generateCity` cases), added **17** (the 16 from round 1 plus `inputManager.test.ts:39` `space keydown prevents the default action and other keys do not`). The check text and its proof note "(a saída dá o total listado, 212)" are both contradicted by the proof's own output | FAIL - claimed count 212/16 is 213/17 at HEAD |
| C5 | busy port without `E2E_REUSE` -> exit ≠ 0, `is already used`, no test runs | (e) "without E2E_REUSE: exit 1, recusou a porta: true" | `tests/tooling/e2e-reuse.mjs:40` - `without.code !== 0 && without.out.includes('is already used') && !/\d+ passed/.test(without.out)` | PASS |
| C6 | `E2E_REUSE=1` -> reuse, exit 0 | (e) "with E2E_REUSE=1: exit 0, reaproveitou e passou: true" | `tests/tooling/e2e-reuse.mjs:48` - `withReuse.code === 0 && /1 passed/.test(withReuse.out)` | PASS |
| C7 | 9 specs each have ≥1 `@smoke`; script is `playwright test --grep @smoke` | (a) `every e2e spec file has a smoke test` ✓ | `tests/unit/testHygiene.test.ts:21` `expect(e2eSpecs.sort()).toEqual([...9])`; `:26` `expect(smoke.length, f).toBeGreaterThanOrEqual(1)`; `:29` `expect(pkg.scripts['test:e2e:smoke']).toBe('playwright test --grep @smoke')` | PASS |
| C8 | `test:e2e:smoke` exits 0 in ≤ 10 min | (f) carried from 65d1ba3: 18 passed (4.2m), wall clock 252 s | smoke log in round 1, for example `tests\e2e\world.spec.ts:214:3 ... @smoke`. No e2e file changed in 65d1ba3..cd31003 | PASS |
| C9 | `playwright test --list` ≥ 132 | (i) "Total: 135 tests in 9 files" | 135 ≥ 132; new tests at `tests/e2e/race.spec.ts:436,454,464` | PASS |
| C10 | driving from 15 m sets `lastGate` 0 in ≤ 5 s without `crossNextGate` | (g) `player crosses a gate by driving` ✓ (42.2s) | `tests/e2e/race.spec.ts:446` `expect(...player.lastGate).toBe(-1)`; `:448` `waitSimUntil(page, 'g.race.player.lastGate === 0', 5)`; `:450` `expect(crossed).toBe(true)` | PASS |
| C11 | on the grid 1.5 s after GO: position 4, `POS 4/4` | (g) `hud shows time lap and position` ✓ | `tests/e2e/race.spec.ts:170` `expect(s.pos).toBe(4)`; `:171` `expect(s.posText).toBe('POS 4/4')` | PASS |
| C12 | sprint result: row 1 `VOCÊ`, rows 2-4 `--:--.--` | (g) `finishing a sprint shows the results` ✓ | `tests/e2e/race.spec.ts:189` `expect(rows[0]![1]).toBe('VOCÊ')`; `:191` `for (const r of rows.slice(1)) expect(r[2]).toBe('--:--.--')` | PASS |
| C13 | repeat keydown changes nothing | (a) ✓ | `tests/unit/inputManager.test.ts:23` `expect(input.state.throttle).toBe(false)`; `:24` `expect(presses).toBe(0)` | PASS |
| C14 | `onFirstKey` runs once over 3 keydowns | (a) ✓ | `tests/unit/inputManager.test.ts:35` `expect(first).toBe(1)` | PASS |
| C15 | keyup W -> throttle false; press handler 1 then 2 | (a) ✓ | `tests/unit/inputManager.test.ts:55` `expect(input.state.throttle).toBe(false)`; `:61` `expect(presses).toBe(1)`; `:64` `expect(presses).toBe(2)` | PASS |
| C32 | `Space` keydown -> `defaultPrevented` true; `KeyW` -> false | (a) `space keydown prevents the default action and other keys do not` ✓ | `tests/unit/inputManager.test.ts:45` `expect(space.defaultPrevented).toBe(true)`; `:46` `expect(w.defaultPrevented).toBe(false)`. Branch under test: `src/core/InputManager.ts:34`. Fault F1 killed | PASS |
| C16 | 4.9 m of progress: false at 3.99 s, true at 4.0 s | (a) ✓ | `tests/unit/aiDriver.test.ts:65` `expect(at(3.99)).toBe(false)`; `:66` `expect(at(4.0)).toBe(true)` | PASS |
| C17 | physics reset between 3.9 s and 4.1 s | (a) `stuck opponent is reset to its last gate` ✓ | `tests/physics/raceAi.test.ts:139` `toBeGreaterThanOrEqual(3.9)`; `:140` `toBeLessThanOrEqual(4.1)` | PASS |
| C18 | `yawAssistTorque(SPEC, 0.3, 10, 0, 2, INERTIA)` = 5000 ± 1e-6 as a table row | (a) ✓ | `tests/unit/yawAssist.test.ts:38` row `[..., 0.3, 10, 0, 2, 5000]`; `:46` `expect(Math.abs(t - expected), ...).toBeLessThanOrEqual(TOL)`, `TOL = 1e-6` at `:14` | PASS |
| C19 | 2 updates per frame -> 2; 1 per frame -> 1 | (a) ✓; (g) `chunks stream around the car` ✓ | `tests/unit/chunkManager.test.ts:23` `expect(twice.maxBuildsInOneFrame).toBe(2)`; `:32` `expect(once.maxBuildsInOneFrame).toBe(1)`; `tests/e2e/world.spec.ts:361` `expect(r.chunks.maxBuildsInOneFrame).toBe(1)` | PASS |
| C20 | an indirect three import is flagged; `import type` is not | (a) both ✓ | `tests/unit/purity.test.ts:106` `expect(forbiddenReach(join(dir, 'indirect.ts'))).toBe(join(dir, 'heavy.ts'))`; `:107` `...'typeOnly.ts'))).toBeNull()`; `:92` over the modules | PASS |
| C21 | behaviour (4 smoke, 0.79/0.81 s, 3001/2999 sparks) and no `expect(CONST).toBe(literal)` left | (a) `effect constants` ✓, `no literal-only assertions left` ✓ | `tests/unit/effectsMath.test.ts:71` `expect(fx.smoke.alive).toBe(4)`; `:81` `toBe(1)` at 0.79 s; `:83` `toBe(0)` at 0.81 s; `:97` `expect(hit(2999)).toBe(0)`; `:99` `expect(hit(3001)).toBe(40)`. Sub-claim now asserted at `tests/unit/testHygiene.test.ts:44` `expect(read('tests/unit/effectsMath.test.ts')).not.toMatch(/expect\(\s*[A-Z][A-Z0-9_]+\s*\)\.(toBe\|toBeCloseTo\|toEqual)\(/)`. Fault F3 killed | PASS |
| C22 | cornerAssist literal arithmetic and drivetrain `t` gone | (a) `no literal-only assertions left` ✓ | `tests/unit/testHygiene.test.ts:42` `expect(hits).toEqual([])` with `LITERAL_ONLY` at `:16`; `:46` `expect(read('tests/unit/drivetrain.test.ts')).not.toContain('const t = (back.state.rpm - spec.idleRpm)')` | PASS |
| C23 | e2e has 0 `waitForTimeout` and 0 fixed screenshot paths | (a) ✓ | `tests/unit/testHygiene.test.ts:60` `expect(hits).toEqual([])` | PASS |
| C24 | held countdown fails with `countdown não terminou em 4 s`; unheld passes | (g) `countdown holds every car` ✓, `countdown deadline message` ✓ | `tests/e2e/race.spec.ts:459` `await expect(sampleCountdown(page, 4)).rejects.toThrow('countdown não terminou em 4 s')`; unheld case at `:136-138` | PASS |
| C25 | `placeOpponent`: `prev` = placed ±0.01 m, `lastGate` unchanged after 0.2 s | (g) ✓ | `tests/e2e/race.spec.ts:475-476` `expect(Math.abs(r.prev.x - r.x)).toBeLessThanOrEqual(0.01)` (and z); `:478` `...lastGate).toBe(r.lastGate)` | PASS |
| C26 | dead symbols gone; 4 exports kept; header clean | (a) `old city generator is gone` ✓, `mulberry32 is deterministic` ✓ | `tests/unit/testHygiene.test.ts:77` per-name `toEqual([])`; `:81` `expect(gen, name).toMatch(... export (const\|function) <name>)`; `:83` `expect(gen).not.toMatch(/8×8\|202/)`; `tests/unit/cityGenerator.test.ts:12-13` | PASS |
| C27 | strict `tsc` exits 0 | (h) exit 0 | `src/hud/Minimap.ts:12` plain parameter `canvas: HTMLCanvasElement` | PASS |
| C28 | `ci.yml` push and pull_request, ubuntu-latest, Node 24, `npm ci` -> build -> test | (a) ✓ | `tests/unit/testHygiene.test.ts:66` `toMatch(/^on:\s*\[push, pull_request\]\s*$/m)`; `:67` ubuntu-latest; `:68` `node-version:\s*24\b`; `:70` `expect(runs).toEqual(['npm ci', 'npm run build', 'npm test'])`. The go-live `gh run list` proof waits on the push (open question 1) | PASS |
| C29 | README text, roadmap, Enter/Esc/R rows | (a) ✓ | `tests/unit/docs.test.ts:30` `not.toContain('as corridas ainda não existem')`; `:34` item 2; `:36-37` Corridas and trem; `:39-40` Enter and Esc; `:41` `R` `toMatch(/último portão/)` | PASS |
| C30 | AGENTS, README tree and AD-018 name `race` and `world/rail`; AD-004 superseded; AD-018 active after AD-017 | (a) `layout is the same in agents readme and state` ✓ | `tests/unit/docs.test.ts:46-47` AGENTS both halves; `:49-50` README tree; `:53` `superseded by AD-018`; `:56` order; `:57` `active`; `:58` AD-018 `src/{...,race}/`; `:59` AD-018 `toContain('`world/{terrain,roads,lots,interiors,rail}/`')`, fact at `.specs/STATE.md:49`. Fault F2 killed | PASS |
| C31 | STATE residuals, AD order, residue block, `teleport` doc, README `## Intent` | (a) `state and docs are current` ✓ | `tests/unit/docs.test.ts:65` `toContain('(concluída, verificada rodada 1)')`; `:67` numeric order; `:69` `not.toContain('races: pintura dos oponentes sai escura')`; `:72-74` grid, AD-015 and água; `:76` `## Intent` | PASS |

Level and sampling are carried from 65d1ba3; the fix added only unit-level proofs for unit-level claims. C32 proves a pure decision at its own layer, as the Test policy row asks. C4 is the only claim with a number that no proof reads, and that number is wrong at HEAD.

Swept rows are carried from 65d1ba3. Every row cites a check or says `n/a`, and none cites an existing constraint.

## Coverage

Verified at cd31003 for the rows the fix touched: the `InputManager` row, the documents row, the new AD-018 halves row and the constant-only row. The other rows are carried from 65d1ba3.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| vitest dirs with a timeout (2) | carried from 65d1ba3 | C1 both dirs | - |
| new and changed npm scripts (3) | carried from 65d1ba3 | `test:quick` C3, `test:e2e:smoke` C7/C8, `test` C4 (presence proven; C4's count claim fails, see Checks) | - |
| e2e server modes (2) | carried from 65d1ba3 | C5, C6 | - |
| spec files with `@smoke` (9) | carried from 65d1ba3 | C7 table-driven | - |
| exit codes of new commands (2) | carried from 65d1ba3 | 0: C3, C6, C8; ≠ 0: C5 | - |
| `InputManager` branches (5) | `src/core/InputManager.ts:34-46`: `Space` (:34), first key (:35-38), `repeat` (:39), handler per code (:41), `keyup` (:44-46) | `Space` C32 (`inputManager.test.ts:45-46`), first key C14 (`:35`), repeat C13 (`:23-24`), handler per code C15 (`:61,64`), keyup C15 (`:55`). Fault F1 killed | - |
| sides of the stuck threshold (2) | carried from 65d1ba3 | C16, C17 | - |
| constant-only assertions to replace (3 files) | audit tests-6 | effectsMath C21 (behaviour at `effectsMath.test.ts:71-99`, and the ban at `testHygiene.test.ts:44`), cornerAssist and drivetrain C22 (`testHygiene.test.ts:42,46`). Fault F3 killed | - |
| fixed waits to replace (6) | carried from 65d1ba3 | C23 | - |
| purity import kinds (3) | carried from 65d1ba3 | C20 | - |
| dead symbols (5) | carried from 65d1ba3 | C26 | - |
| `tsc` leftovers (2) | carried from 65d1ba3 | C27 | - |
| door 1 events and steps (5) | carried from 65d1ba3 | C28 | - |
| documents (3) | plan AC 25-30 | README C29/C30/C31, AGENTS.md C30 (`docs.test.ts:46-47`), STATE.md C30/C31 | - |
| AD-018 layout halves (2) | `.specs/STATE.md:49` | `src/{...,race}/` C30 (`docs.test.ts:58`), `world/{...,rail}/` C30 (`docs.test.ts:59`). Fault F2 killed | - |

## Test policy rows

Verified at cd31003 for the two rows that were unmet in round 1. The other three rows are carried from 65d1ba3.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Test configuration | `vite.config.ts`, `playwright.config.ts`, `package.json` | real tool, read the effect | yes - carried from 65d1ba3; C1, C3, C5, C6 and C8 re-ran green (C8 carried) |
| Decides, pure | `checkStuck`, `yawAssistTorque`, `InputManager` | own layer, vitest, one case per decision-table row | yes - all 5 `InputManager` branches now have a case (C13, C14, C15 ×2, C32); `checkStuck` C16; `yawAssistTorque` C18 |
| `ChunkManager` counter | `src/world/ChunkManager.ts` | unit plus e2e, 1 and 2 updates per frame | yes - carried from 65d1ba3, re-ran green |
| Race wiring (`RaceController` -> HUD) | `RaceController.ts`, `Game.ts` hooks | e2e, one case per asserted value | yes - carried from 65d1ba3, re-ran green |
| Document text and hygiene rules | README, AGENTS.md, STATE.md, `Car.ts` doc, test sources | unit test reading the file, one assertion per affirmed phrase | yes - AD-018 `world/rail` phrase at `docs.test.ts:59`; C21 ban at `testHygiene.test.ts:44` |

## Faults injected

Verified at cd31003, on the new assertion surfaces only. Scratch: `git worktree add C:\Users\arthu\AppData\Local\Temp\th-r2-fault HEAD`, with a `node_modules` junction created with PowerShell `New-Item -ItemType Junction`. Each fault was reverted with `git checkout -- <file>` in the scratch. The real tree's `git status --porcelain` was empty at baseline and after each fault. The junction was deleted with `(Get-Item ...).Delete()` before `git worktree remove`, and the shared `node_modules` was confirmed intact afterwards. The round 1 faults F1-F5 (65d1ba3) were on surfaces the fix did not touch and are carried.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1: deleted `if (event.code === 'Space') event.preventDefault();`. `space keydown prevents the default action and other keys do not` failed at `inputManager.test.ts:45:36` (expected false to be true) | `src/core/InputManager.ts:34` | yes |
| F2: AD-018 row `interiors,rail}` -> `interiors,rails}`. `layout is the same in agents readme and state` failed at `docs.test.ts:59:27` (expected AD-018 row to contain `` `world/{terrain,roads,lots,interiors,`` ...) | `.specs/STATE.md:49` | yes |
| F3: re-added the `SMOKE_PER_STEP` import and `expect(SMOKE_PER_STEP).toBe(4);` in `effect constants`. `no literal-only assertions left` failed at `testHygiene.test.ts:44:56` (not to match `/expect\(\s*[A-Z][A-Z0-9_]+.../`) | `tests/unit/effectsMath.test.ts:71` | yes |

## Gate

- One vitest invocation over the 22 named unit and physics proofs: 22 passed, 0 failed (9 unnamed tests skipped by the filter)
- `npm run test:quick`: 212 passed, 1 skipped, 0 failed (54 files)
- `npx vitest run tests/unit --reporter=json` plus `max-duration.mjs 3000`: 167 passed, 0 failed, max 2635 ms
- One `npx playwright test` over the 7 named e2e proofs (E2E_PORT=5193): 7 passed, 0 failed (4.3m)
- `npm run test:e2e:smoke`: carried from 65d1ba3, 18 passed, 0 failed, 252 s
- `node tests/tooling/e2e-reuse.mjs 5197`: exit 0. `list-has.mjs` both modes: exit 0 (213 present, 212 with `!slow` absent). Strict `tsc`: exit 0. `playwright test --list`: 135 tests

## Ranked gaps

1. C4: the check claims "212 testes: os 202 de antes, menos os 6 ..., mais os 16". At HEAD the proof prints 213, because the fix commit added the C32 test and rewrote C4 in the same commit without recounting. The proof (`tests/tooling/list-has.mjs:19`) asserts only presence, so a stale number can never turn it red. Fix: change the text to 213/17, or better, make the proof assert the count (for example a `--count 213` option) so that the number cannot go stale silently - `.specs/features/test-hardening/checks.md:23-24`.
2. Note only: C2 passes with 12 % headroom. The slowest unit test, `races of seed 1337 routes are continuous and on the asphalt`, measured 2635 ms against the 3000 ms cap. Round 1's slowest test was a different one at 2717 ms.
