# test-hardening verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 12bbc59..796cf57 (fix under re-verification: 9bf34af..796cf57)
**Round**: 4 - scoped
**Verifier**: independent sub-agent (author != verifier)

All 32 checks are proven with located evidence at 796cf57. The round 3 gap is closed. The C3 and C4 proofs now take their lists from the npm scripts through `tests/tooling/npmScript.mjs`. That file reads `package.json` `scripts[name]` (`:7-8`), fails unless the script is `vitest run ...` (`:9-10`), and runs `npx vitest list --json <the script's own args>` (`:12`, `:17`). Round 3's surviving fault R3-F2 (`"test:quick": "vitest run"`) was re-injected and **killed** by both proofs. A `"test"` script that excludes `slow`, the regression AC 4 forbids, was **killed** by `suite-split.mjs`. A fault in `npmScript.mjs` that drops the script's args was **killed** by both proofs. The user explicitly authorised this 4th round after the 3-round bound.

## Binding sources

Carried from 65d1ba3. The fix touched no interface, so step 1 is not re-run.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `.specs/audits/2026-09-29-validation.md` (docs-1..14, tests-1..16, gates-1..4, wgen-8, veh-11) | yes, in round 1 (carried from 65d1ba3). The fix changes only the wording of `checks.md` C3/C4 and three tooling scripts | none | - |
| `AGENTS.md` "Worktrees de agentes" | yes, and followed in this round's scratch worktree | none | - |

## Checks

Verified at 796cf57. I re-ran every proof at HEAD 796cf57:
- (a) One vitest invocation over the 12 proof files, with a 22-way `-t` alternation of every named unit and physics proof. Exit 0, "Tests 22 passed | 9 skipped (31)". Each of the 22 names appears individually with `✓`.
- (b) C2: `npx vitest run tests/unit --reporter=json --outputFile=<scratchpad>/unit-durations.json` exited 0. Then `node tests/tooling/max-duration.mjs <that file> 3000` printed "167 testes, todos ≤ 3000 ms" and exited 0. The machine was idle for this run, which came after the e2e run.
- (c) `npm run test:quick`: exit 0. "Test Files 54 passed (54)", "Tests 212 passed | 1 skipped (213)", 15.7 s.
- (d) `node tests/tooling/list-has.mjs --script test:quick --absent "each opponent finishes every race in time"`: exit 0. It printed "npm run test:quick: 212 testes; ... ausente", and the npm notice shows the command it ran: `vitest list --json --tags-filter=!slow`.
- (e) `node tests/tooling/e2e-reuse.mjs 5197`: exit 0. Output: "without E2E_REUSE: exit 1, recusou a porta: true" and "with E2E_REUSE=1: exit 0, reaproveitou e passou: true".
- (f) C8 smoke timing is carried from 65d1ba3: 18 passed, 252 s. `git diff --stat 65d1ba3..HEAD -- tests/e2e playwright.config.ts` is empty.
- (g) One run: `E2E_PORT=5193 npx playwright test tests/e2e/race.spec.ts tests/e2e/world.spec.ts -g "<7-way alternation>"`. Exit 0, "7 passed (4.3m)", with each test listed with `✓`.
- (h) `npx tsc --noEmit -p . --noUnusedLocals --noUnusedParameters`: exit 0, with no diagnostics.
- (i) `npx playwright test --list`: "Total: 135 tests in 9 files".
- (j) `node tests/tooling/suite-split.mjs`: exit 0, "npm test: 213 · test:quick: 212 · slow: 1". The npm notices show `vitest list --json` (from `"test"`), `vitest list --json --tags-filter=!slow` (from `"test:quick"`) and `vitest list --json --tags-filter=slow`.

Citations: the fix touched only `checks.md`, `tests/tooling/list-has.mjs`, `tests/tooling/suite-split.mjs` and the new `tests/tooling/npmScript.mjs`. Those are cited fresh below. Every other citation is carried from cd31003, and its file is untouched in 9bf34af..796cf57.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `task.timeout` = 30000 in unit and physics | (a) both `... run with a 30 s timeout` ✓ | `tests/unit/testConfig.test.ts:6` and `tests/physics/testConfig.test.ts:6` - `expect(task.timeout).toBe(30_000)` | PASS |
| C2 | no unit test > 3000 ms (idle) | (b) exit 0 and exit 0 | `tests/tooling/max-duration.mjs:17` - `if ((t.duration ?? 0) > limit) slow.push(...)`. The slowest test this round was `routes are continuous and on the asphalt` at 2532 ms (16 % headroom) | PASS |
| C3 | `npm run test:quick` exits 0, **and the list of tests it runs** does not contain the slow test | (c) exit 0; (d) exit 0, "npm run test:quick: 212 testes; ... ausente" | `tests/tooling/list-has.mjs:15` - `const list = scriptList(script)`; `:16` `list.some((t) => t.endsWith(name))`; `:18` `process.exit((mode === '--present') === found ? 0 : 1)`. The list comes from the script: `tests/tooling/npmScript.mjs:7-8` reads `package.json` `scripts[name]`; `:9` throws unless the script matches `/^vitest run/` followed by whitespace or end of string; `:12` `vitestList(script.replace(/^vitest run/, '').trim())`. Faults R4-F1 (= R3-F2) and R4-F3 killed (list-has exit 1, "213 testes; ... presente") | PASS |
| C4 | the `npm test` list = the `test:quick` list + the `slow` list, with no extra, missing or duplicate test, and the slow test is among the `slow` | (j) exit 0, "npm test: 213 · test:quick: 212 · slow: 1" | `tests/tooling/suite-split.mjs:7` `const full = scriptList('test')`; `:8` `const quick = scriptList('test:quick')`; `:9` `vitestList('--tags-filter=slow')`. Duplicates at `:11`; missing at `:13` (`!union.has(t)`); extra at `:14` (`!full.includes(t)`); in both lists at `:15`; the marathon test is in `slow` at `:16`; exit 1 at `:20`. Faults R4-F1, R4-F2 and R4-F3 were all killed | PASS |
| C5 | busy port without `E2E_REUSE` -> exit ≠ 0, `is already used`, no test runs | (e) "without E2E_REUSE: exit 1, recusou a porta: true" | `tests/tooling/e2e-reuse.mjs:40` - `without.code !== 0 && without.out.includes('is already used') && !/\d+ passed/.test(without.out)` | PASS |
| C6 | `E2E_REUSE=1` -> reuse, exit 0 | (e) "with E2E_REUSE=1: exit 0, reaproveitou e passou: true" | `tests/tooling/e2e-reuse.mjs:48` - `withReuse.code === 0 && /1 passed/.test(withReuse.out)` | PASS |
| C7 | 9 specs each have ≥1 `@smoke`; script is `playwright test --grep @smoke` | (a) `every e2e spec file has a smoke test` ✓ | `tests/unit/testHygiene.test.ts:21` `expect(e2eSpecs.sort()).toEqual([...9])`; `:26` `expect(smoke.length, f).toBeGreaterThanOrEqual(1)`; `:29` `expect(pkg.scripts['test:e2e:smoke']).toBe('playwright test --grep @smoke')` | PASS |
| C8 | `test:e2e:smoke` exits 0 in ≤ 10 min | (f) carried from 65d1ba3: 18 passed (4.2m), wall clock 252 s | round 1 smoke log, for example `tests\e2e\world.spec.ts:214:3 ... @smoke`. No e2e file or Playwright config changed in 65d1ba3..796cf57 | PASS |
| C9 | `playwright test --list` ≥ 132 | (i) "Total: 135 tests in 9 files" | 135 ≥ 132; the new tests are at `tests/e2e/race.spec.ts:436,454,464` | PASS |
| C10 | driving from 15 m sets `lastGate` 0 in ≤ 5 s without `crossNextGate` | (g) `player crosses a gate by driving` ✓ (40.6s) | `tests/e2e/race.spec.ts:446` `expect(...player.lastGate).toBe(-1)`; `:448` `waitSimUntil(page, 'g.race.player.lastGate === 0', 5)`; `:450` `expect(crossed).toBe(true)` | PASS |
| C11 | on the grid 1.5 s after GO: position 4, `POS 4/4` | (g) `hud shows time lap and position` ✓ | `tests/e2e/race.spec.ts:170` `expect(s.pos).toBe(4)`; `:171` `expect(s.posText).toBe('POS 4/4')` | PASS |
| C12 | sprint result: row 1 `VOCÊ`, rows 2-4 `--:--.--` | (g) `finishing a sprint shows the results` ✓ | `tests/e2e/race.spec.ts:189` `expect(rows[0]![1]).toBe('VOCÊ')`; `:191` `for (const r of rows.slice(1)) expect(r[2]).toBe('--:--.--')` | PASS |
| C13 | repeat keydown changes nothing | (a) ✓ | `tests/unit/inputManager.test.ts:23` `expect(input.state.throttle).toBe(false)`; `:24` `expect(presses).toBe(0)` | PASS |
| C14 | `onFirstKey` runs once over 3 keydowns | (a) ✓ | `tests/unit/inputManager.test.ts:35` `expect(first).toBe(1)` | PASS |
| C15 | keyup W -> throttle false; press handler 1 then 2 | (a) ✓ | `tests/unit/inputManager.test.ts:55` `expect(input.state.throttle).toBe(false)`; `:61` `expect(presses).toBe(1)`; `:64` `expect(presses).toBe(2)` | PASS |
| C32 | `Space` keydown -> `defaultPrevented` true; `KeyW` -> false | (a) `space keydown prevents the default action and other keys do not` ✓ | `tests/unit/inputManager.test.ts:45` `expect(space.defaultPrevented).toBe(true)`; `:46` `expect(w.defaultPrevented).toBe(false)`. Branch under test: `src/core/InputManager.ts:34`. Round 2 fault F1 killed (carried from cd31003) | PASS |
| C16 | 4.9 m of progress: false at 3.99 s, true at 4.0 s | (a) ✓ | `tests/unit/aiDriver.test.ts:65` `expect(at(3.99)).toBe(false)`; `:66` `expect(at(4.0)).toBe(true)` | PASS |
| C17 | physics reset between 3.9 s and 4.1 s | (a) `stuck opponent is reset to its last gate` ✓ | `tests/physics/raceAi.test.ts:139` `toBeGreaterThanOrEqual(3.9)`; `:140` `toBeLessThanOrEqual(4.1)` | PASS |
| C18 | `yawAssistTorque(SPEC, 0.3, 10, 0, 2, INERTIA)` = 5000 ± 1e-6 as a table row | (a) ✓ | `tests/unit/yawAssist.test.ts:38` row `[..., 0.3, 10, 0, 2, 5000]`; `:46` `expect(Math.abs(t - expected), ...).toBeLessThanOrEqual(TOL)`, `TOL = 1e-6` at `:14` | PASS |
| C19 | 2 updates per frame -> 2; 1 per frame -> 1 | (a) ✓; (g) `chunks stream around the car` ✓ | `tests/unit/chunkManager.test.ts:23` `expect(twice.maxBuildsInOneFrame).toBe(2)`; `:32` `expect(once.maxBuildsInOneFrame).toBe(1)`; `tests/e2e/world.spec.ts:361` `expect(r.chunks.maxBuildsInOneFrame).toBe(1)` | PASS |
| C20 | an indirect three import is flagged; `import type` is not | (a) both ✓ | `tests/unit/purity.test.ts:106` `expect(forbiddenReach(join(dir, 'indirect.ts'))).toBe(join(dir, 'heavy.ts'))`; `:107` `...'typeOnly.ts'))).toBeNull()`; `:92` over the modules | PASS |
| C21 | behaviour (4 smoke, 0.79/0.81 s, 3001/2999 sparks) and no `expect(CONST).toBe(literal)` left | (a) `effect constants` ✓, `no literal-only assertions left` ✓ | `tests/unit/effectsMath.test.ts:71` `expect(fx.smoke.alive).toBe(4)`; `:81` `toBe(1)` at 0.79 s; `:83` `toBe(0)` at 0.81 s; `:97` `expect(hit(2999)).toBe(0)`; `:99` `expect(hit(3001)).toBe(40)`; `tests/unit/testHygiene.test.ts:44` `expect(read('tests/unit/effectsMath.test.ts')).not.toMatch(...)` with a regex for `expect(UPPER_CASE_CONST)` followed by `.toBe(`, `.toBeCloseTo(` or `.toEqual(`. Round 2 fault F3 killed (carried from cd31003) | PASS |
| C22 | cornerAssist literal arithmetic and drivetrain `t` gone | (a) `no literal-only assertions left` ✓ | `tests/unit/testHygiene.test.ts:42` `expect(hits).toEqual([])` with `LITERAL_ONLY` at `:16`; `:46` `expect(read('tests/unit/drivetrain.test.ts')).not.toContain('const t = (back.state.rpm - spec.idleRpm)')` | PASS |
| C23 | e2e has 0 `waitForTimeout` and 0 fixed screenshot paths | (a) ✓ | `tests/unit/testHygiene.test.ts:60` `expect(hits).toEqual([])` | PASS |
| C24 | held countdown fails with `countdown não terminou em 4 s`; unheld passes | (g) `countdown holds every car` ✓, `countdown deadline message` ✓ | `tests/e2e/race.spec.ts:459` `await expect(sampleCountdown(page, 4)).rejects.toThrow('countdown não terminou em 4 s')`; the unheld case is at `:136-138` | PASS |
| C25 | `placeOpponent`: `prev` = placed ±0.01 m, `lastGate` unchanged after 0.2 s | (g) ✓ | `tests/e2e/race.spec.ts:475-476` `expect(Math.abs(r.prev.x - r.x)).toBeLessThanOrEqual(0.01)` (and z); `:478` `...lastGate).toBe(r.lastGate)` | PASS |
| C26 | dead symbols gone; 4 exports kept; header clean | (a) `old city generator is gone` ✓, `mulberry32 is deterministic` ✓ | `tests/unit/testHygiene.test.ts:77` per-name `toEqual([])`; `:81` `expect(gen, name).toMatch(...)` for `export const <name>` or `export function <name>`; `:83` `expect(gen).not.toMatch(...)` for `8×8` or `202`; `tests/unit/cityGenerator.test.ts:12-13` | PASS |
| C27 | strict `tsc` exits 0 | (h) exit 0 | `src/hud/Minimap.ts:12` plain parameter `canvas: HTMLCanvasElement` | PASS |
| C28 | `ci.yml` push and pull_request, ubuntu-latest, Node 24, `npm ci` -> build -> test | (a) ✓ | `tests/unit/testHygiene.test.ts:66` `toMatch(/^on:\s*\[push, pull_request\]\s*$/m)`; `:67` ubuntu-latest; `:68` `node-version:\s*24\b`; `:70` `expect(runs).toEqual(['npm ci', 'npm run build', 'npm test'])`. The go-live `gh run list` proof waits on the push (open question 1) | PASS |
| C29 | README text, roadmap, Enter/Esc/R rows | (a) ✓ | `tests/unit/docs.test.ts:30` `not.toContain('as corridas ainda não existem')`; `:34` item 2; `:36-37` Corridas and trem; `:39-40` Enter and Esc; `:41` `R` `toMatch(/último portão/)` | PASS |
| C30 | AGENTS, README tree and AD-018 name `race` and `world/rail`; AD-004 superseded; AD-018 active after AD-017 | (a) `layout is the same in agents readme and state` ✓ | `tests/unit/docs.test.ts:46-47` AGENTS both halves; `:49-50` README tree; `:53` `superseded by AD-018`; `:56` order; `:57` `active`; `:58` AD-018 `src/{...,race}/`; `:59` AD-018 `toContain('`world/{terrain,roads,lots,interiors,rail}/`')`. Round 2 fault F2 killed (carried from cd31003) | PASS |
| C31 | STATE residuals, AD order, residue block, `teleport` doc, README `## Intent` | (a) `state and docs are current` ✓ | `tests/unit/docs.test.ts:65` `toContain('(concluída, verificada rodada 1)')`; `:67` numeric order; `:69` `not.toContain('races: pintura dos oponentes sai escura')`; `:72-74` grid, AD-015 and água; `:76` `## Intent` | PASS |

Level and sampling are carried from cd31003 for every check except C3 and C4. For those two, the level is still the real vitest CLI. The object is now the npm script itself: `npmScript.mjs` reads the script literal and gives its arguments to `vitest list`, so a change to either script changes what the proof lists. Those arguments are the same filter semantics `vitest run` applies, so no second copy of the flags lives in the proof. The guard at `npmScript.mjs:9` fails closed on any script that is not `vitest run ...`, so a script that changes shape cannot slip through as an empty list.

Swept rows are carried from 65d1ba3. Every row cites a check or says `n/a`, and none cites an existing constraint.

## Coverage

Verified at 796cf57 for the two rows whose authority the fix touched: npm scripts, and the sets in C4's claim. The other rows are carried from cd31003, and the fix touched none of their sources.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| vitest dirs with a timeout (2) | carried from cd31003 | C1 both dirs | - |
| npm scripts the checks name (3) | `package.json:14` `"test": "vitest run"`, `:15` `"test:quick": "vitest run --tags-filter=!slow"`, `:20` `"test:e2e:smoke"` | `test:quick`: C3 runs it for the exit code in (c) and lists what it runs in (d) via `npmScript.mjs:7-12`. C4 lists it at `suite-split.mjs:8`. R4-F1 killed. `test`: C4 lists what it runs at `suite-split.mjs:7`. R4-F2 killed. `test:e2e:smoke`: C7 reads the literal (`testHygiene.test.ts:29`) and C8 runs the script | - |
| sets in C4's claim: full, quick, slow (3) | the `slow` tag in the vitest config at `vite.config.ts:11`; its only use at `tests/physics/raceAi.test.ts:92`; full and quick from the two scripts above | disjointness at `suite-split.mjs:15`; cover at `:13`; no extra at `:14`; no duplicates at `:11`; marathon in `slow` at `:16`. R3-F1 killed (carried from 9bf34af); R4-F1, R4-F2 and R4-F3 killed | - |
| e2e server modes (2) | carried from cd31003 | C5, C6 | - |
| spec files with `@smoke` (9) | carried from cd31003 | C7 table-driven | - |
| exit codes of new commands (2) | carried from cd31003 | 0: C3, C6, C8; ≠ 0: C5 | - |
| `InputManager` branches (5) | carried from cd31003 | C32, C14, C13, C15 ×2 | - |
| sides of the stuck threshold (2) | carried from cd31003 | C16, C17 | - |
| constant-only assertions to replace (3 files) | carried from cd31003 | C21, C22 | - |
| fixed waits to replace (6) | carried from cd31003 | C23 | - |
| purity import kinds (3) | carried from cd31003 | C20 | - |
| dead symbols (5) | carried from cd31003 | C26 | - |
| `tsc` leftovers (2) | carried from cd31003 | C27 | - |
| door 1 events and steps (5) | carried from cd31003 | C28 | - |
| documents (3) | carried from cd31003 | C29, C30, C31 | - |
| AD-018 layout halves (2) | carried from cd31003 | C30 | - |

## Test policy rows

Verified at 796cf57 for "Test configuration", the row that round 3 left unmet and that classifies `package.json`. The other four rows are carried from cd31003, and all their proofs re-ran green in (a) and (g).

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Test configuration | `vite.config.ts`, `playwright.config.ts`, `package.json` | real tool, read the effect | yes. `package.json` `test` and `test:quick`: the real `vitest list` runs with the script's own arguments, read from `package.json` (`npmScript.mjs:7-12`, `:17`), and R4-F1 and R4-F2 were killed. `test:quick` also runs for its exit code (c). `test:e2e:smoke` is covered by C7 and C8. `vite.config.ts` is covered by C1 (re-ran green) and `playwright.config.ts` by C5/C6 (re-ran green) |
| Decides, pure | `checkStuck`, `yawAssistTorque`, `InputManager` | own layer, vitest, one case per decision-table row | yes - carried from cd31003, re-ran green |
| `ChunkManager` counter | `src/world/ChunkManager.ts` | unit plus e2e, 1 and 2 updates per frame | yes - carried from cd31003, re-ran green |
| Race wiring (`RaceController` -> HUD) | `RaceController.ts`, `Game.ts` hooks | e2e, one case per asserted value | yes - carried from cd31003, re-ran green |
| Document text and hygiene rules | README, AGENTS.md, STATE.md, `Car.ts` doc, test sources | unit test reading the file, one assertion per affirmed phrase | yes - carried from cd31003, re-ran green |

## Faults injected

Verified at 796cf57, on the new surface only: the two npm script literals the proofs now read, and `tests/tooling/npmScript.mjs`. Scratch setup:
- I created the scratch with `git worktree add C:\Users\arthu\AppData\Local\Temp\th-r4-fault HEAD` and gave it a `node_modules` junction made with PowerShell `New-Item -ItemType Junction`.
- Each fault was applied with `sed` in the scratch and reverted with `git checkout -- <file>`. The scratch `git status --porcelain` was empty at the end.
- The real tree's `git status --porcelain` was empty at baseline, after each fault and after cleanup.
- Before `git worktree remove`, I deleted the junction with `(Get-Item ...).Delete()`. Afterwards `node_modules\vitest\package.json` was still present in the real tree, and `git worktree list` showed only the main checkout.

Faults from rounds 1-3 (65d1ba3, cd31003, 9bf34af) were on surfaces the fix did not touch. They are carried.

| Mutation | Location | Killed |
| --- | --- | --- |
| R4-F1 (= R3-F2): `"test:quick": "vitest run --tags-filter=!slow"` -> `"test:quick": "vitest run"`. `list-has.mjs --script test:quick --absent ...` printed "213 testes; ... presente" and exited 1. `suite-split.mjs` printed "213 · 213 · 1" and "no test:quick e marcado slow: ...raceAi.test.ts :: ... each opponent finishes every race in time" and exited 1 | `package.json:15` | yes |
| R4-F2: `"test": "vitest run"` -> `"test": "vitest run --tags-filter=!slow"` (the AC 4 regression). `suite-split.mjs` printed "212 · 212 · 1" and "fora do npm test: ...each opponent finishes every race in time" and exited 1. As expected, `list-has.mjs --script test:quick` exited 0: C3 makes no claim about `test` | `package.json:14` | yes |
| R4-F3: `return vitestList(script.replace(/^vitest run/, '').trim());` -> `return vitestList('');` (the helper ignores the script's arguments). `list-has.mjs` printed "213 testes; ... presente" and exited 1. `suite-split.mjs` printed "213 · 213 · 1" and "no test:quick e marcado slow" and exited 1 | `tests/tooling/npmScript.mjs:12` | yes |

## Gate

- One vitest invocation over the 22 named unit and physics proofs: 22 passed, 0 failed (the filter skipped 9 unnamed tests)
- `npm run test:quick`: 212 passed, 1 skipped, 0 failed (54 files)
- `npx vitest run tests/unit --reporter=json` plus `max-duration.mjs 3000`: 167 passed, 0 failed, max 2532 ms
- One `npx playwright test` run over the 7 named e2e proofs (E2E_PORT=5193): 7 passed, 0 failed (4.3m)
- `npm run test:e2e:smoke`: carried from 65d1ba3, 18 passed, 0 failed, 252 s
- `node tests/tooling/suite-split.mjs`: exit 0 (213 = 212 + 1)
- `list-has.mjs --script test:quick --absent`: exit 0
- `e2e-reuse.mjs 5197`: exit 0
- Strict `tsc`: exit 0
- `playwright test --list`: 135 tests

## Ranked gaps

None. Notes only:
1. The round 3 gaps on C3 and C4 are closed. `checks.md:21` and `:24` now name proofs that read `package.json`, and all three faults on that surface were killed.
2. C8 timing is still carried from 65d1ba3. That is valid because no e2e file or Playwright config changed after it, but a later change to either needs a fresh timed smoke run.
