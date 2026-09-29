# test-hardening verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 12bbc59..b04cacb (fix under re-verification: 96f57ca..b04cacb)
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

30 of 32 checks proven with located evidence. The round 2 gap is closed in its own terms: C4 no longer carries a hand-written total, and `tests/tooling/suite-split.mjs` checks a partition that cannot go stale. The script prints `npm test: 213 · test:quick: 212 · slow: 1`. Fault R3-F1 (drop the `slow` tag) was killed. **Fault R3-F2 survived.** Changing `package.json` `"test:quick"` to plain `vitest run` left every C3 and C4 proof green. `suite-split.mjs` exited 0 with the same `213 · 212 · 1`. `list-has.mjs --tags-filter="!slow" --absent` exited 0. `npm run test:quick` exited 0 after running 213 tests, the slow one included. The cause is that no proof reads the npm scripts. `suite-split.mjs:14-16` and `list-has.mjs:14` each rebuild the flags that the scripts happen to use today, so the claims about "the `npm test` list" and "the `test:quick` list" are proven about `vitest list` and not about the scripts. The same hole leaves AC 4 open: a `"test"` script that excluded `slow` would also pass `suite-split.mjs`, because line 14 never runs `npm test`. C3 and C4 fail.

## Binding sources

Carried from 65d1ba3. The fix touched no interface, so step 1 is not re-run.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `.specs/audits/2026-09-29-validation.md` (docs-1..14, tests-1..16, gates-1..4, wgen-8, veh-11) | yes, in round 1 (carried from 65d1ba3). The fix changes only `checks.md` wording and adds one tooling script | none | - |
| `AGENTS.md` "Worktrees de agentes" | yes, and followed in this round's scratch worktree | none | - |

## Checks

Verified at b04cacb. All proofs were re-run at HEAD b04cacb:
- (a) One vitest invocation covered the 12 proof files with a 22-way `-t` alternation of every named unit and physics proof: exit 0, "22 passed | 9 skipped (31)". Each of the 22 names appears individually as `✓`.
- (b) C2: `npx vitest run tests/unit --reporter=json --outputFile=<scratchpad>/unit-durations.json` (exit 0), then `node tests/tooling/max-duration.mjs <that file> 3000` printed "167 testes, todos ≤ 3000 ms" (exit 0). This ran with the machine idle, after the e2e run.
- (c) `npm run test:quick`: exit 0, "54 passed" files, "212 passed | 1 skipped (213)", 14.3 s.
- (d) `node tests/tooling/list-has.mjs --tags-filter="!slow" --absent "each opponent finishes every race in time"`: exit 0, "212 testes listados; ... ausente".
- (e) `node tests/tooling/e2e-reuse.mjs 5197`: exit 0, with both cases true.
- (f) C8 smoke timing is carried from 65d1ba3 (18 passed, 252 s). No e2e file or Playwright config changed in 65d1ba3..b04cacb.
- (g) One `E2E_PORT=5193 npx playwright test tests/e2e/race.spec.ts tests/e2e/world.spec.ts -g "<7-way alternation>"`: exit 0, "7 passed (4.3m)", each test listed with `✓`.
- (h) `npx tsc --noEmit -p . --noUnusedLocals --noUnusedParameters`: exit 0, no output.
- (i) `npx playwright test --list`: "Total: 135 tests in 9 files".
- (j) `node tests/tooling/suite-split.mjs`: exit 0, "npm test: 213 · test:quick: 212 · slow: 1".

Citations: the fix touched no test file, only `checks.md` and the new `tests/tooling/suite-split.mjs`, which is cited fresh below. The line numbers from round 2 (cd31003) still hold for every other file.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `task.timeout` = 30000 in unit and physics | (a) both `... run with a 30 s timeout` ✓ | `tests/unit/testConfig.test.ts:6` and `tests/physics/testConfig.test.ts:6` - `expect(task.timeout).toBe(30_000)` | PASS |
| C2 | no unit test > 3000 ms (idle) | (b) exit 0 and exit 0 | `tests/tooling/max-duration.mjs:17` - `if ((t.duration ?? 0) > limit) slow.push(...)`. Slowest this round: `routes are continuous and on the asphalt` at 2266 ms (24 % headroom) | PASS |
| C3 | `npm run test:quick` exits 0, **and the list of tests it runs** does not contain the slow test | (c) exit 0; (d) exit 0 | `tests/tooling/list-has.mjs:14` - ``const cmd = `npx vitest list --json${filter ? ` "${filter}"` : ''}` `` and `:19` exit on presence. The proof lists `vitest` with a filter the caller passes by hand and never reads `package.json` `"test:quick"`. Fault R3-F2 (`"test:quick": "vitest run"`) **survived**: (d) exit 0, "212 ... ausente", and `npm run test:quick` exit 0 with "213 passed (213)", the slow test included. No test asserts the script: `rg "scripts\[" tests` hits only `fetch:textures` (`assets.test.ts:15`) and `test:e2e:smoke` (`testHygiene.test.ts:29`) | FAIL - the list half is proven for `vitest list --tags-filter=!slow`, not for the script. R3-F2 survived |
| C4 | the `npm test` list = the `test:quick` list + the `slow` list, with no extra, missing or duplicate test, and the slow test is among the `slow` | (j) exit 0, "npm test: 213 · test:quick: 212 · slow: 1" | `tests/tooling/suite-split.mjs:18` duplicates; `:20` missing (`!union.has(t)`); `:21` extra (`!full.includes(t)`); `:22` in both lists; `:23` `slow.some((t) => t.endsWith('each opponent finishes every race in time'))`; `:25-27` exit 1. R3-F1 killed. But the three lists come from `:14` `list(null)`, `:15` `list('!slow')` and `:16` `list('slow')`, and `:7` builds each as `npx vitest list --json ...`. Neither `npm test` nor `test:quick` is run or read. R3-F2 survived with the same output, exit 0. By the same reading, a `"test"` script that excluded `slow` (the regression AC 4 exists to forbid) would leave `:14` unchanged | FAIL - the partition is asserted over `vitest list` flags, not over the npm scripts it names. R3-F2 survived, so AC 4 is not settled |
| C5 | busy port without `E2E_REUSE` -> exit ≠ 0, `is already used`, no test runs | (e) "without E2E_REUSE: exit 1, recusou a porta: true" | `tests/tooling/e2e-reuse.mjs:40` - `without.code !== 0 && without.out.includes('is already used') && !/\d+ passed/.test(without.out)` | PASS |
| C6 | `E2E_REUSE=1` -> reuse, exit 0 | (e) "with E2E_REUSE=1: exit 0, reaproveitou e passou: true" | `tests/tooling/e2e-reuse.mjs:48` - `withReuse.code === 0 && /1 passed/.test(withReuse.out)` | PASS |
| C7 | 9 specs each have ≥1 `@smoke`; script is `playwright test --grep @smoke` | (a) `every e2e spec file has a smoke test` ✓ | `tests/unit/testHygiene.test.ts:21` `expect(e2eSpecs.sort()).toEqual([...9])`; `:26` `expect(smoke.length, f).toBeGreaterThanOrEqual(1)`; `:29` `expect(pkg.scripts['test:e2e:smoke']).toBe('playwright test --grep @smoke')` | PASS |
| C8 | `test:e2e:smoke` exits 0 in ≤ 10 min | (f) carried from 65d1ba3: 18 passed (4.2m), wall clock 252 s | smoke log in round 1, for example `tests\e2e\world.spec.ts:214:3 ... @smoke`. No e2e file or Playwright config changed in 65d1ba3..b04cacb | PASS |
| C9 | `playwright test --list` ≥ 132 | (i) "Total: 135 tests in 9 files" | 135 ≥ 132; new tests at `tests/e2e/race.spec.ts:436,454,464` | PASS |
| C10 | driving from 15 m sets `lastGate` 0 in ≤ 5 s without `crossNextGate` | (g) `player crosses a gate by driving` ✓ (42.2s) | `tests/e2e/race.spec.ts:446` `expect(...player.lastGate).toBe(-1)`; `:448` `waitSimUntil(page, 'g.race.player.lastGate === 0', 5)`; `:450` `expect(crossed).toBe(true)` | PASS |
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
| C21 | behaviour (4 smoke, 0.79/0.81 s, 3001/2999 sparks) and no `expect(CONST).toBe(literal)` left | (a) `effect constants` ✓, `no literal-only assertions left` ✓ | `tests/unit/effectsMath.test.ts:71` `expect(fx.smoke.alive).toBe(4)`; `:81` `toBe(1)` at 0.79 s; `:83` `toBe(0)` at 0.81 s; `:97` `expect(hit(2999)).toBe(0)`; `:99` `expect(hit(3001)).toBe(40)`. Sub-claim now asserted at `tests/unit/testHygiene.test.ts:44` `expect(read('tests/unit/effectsMath.test.ts')).not.toMatch(/expect\(\s*[A-Z][A-Z0-9_]+\s*\)\.(toBe\|toBeCloseTo\|toEqual)\(/)`. Round 2 fault F3 killed (carried from cd31003) | PASS |
| C22 | cornerAssist literal arithmetic and drivetrain `t` gone | (a) `no literal-only assertions left` ✓ | `tests/unit/testHygiene.test.ts:42` `expect(hits).toEqual([])` with `LITERAL_ONLY` at `:16`; `:46` `expect(read('tests/unit/drivetrain.test.ts')).not.toContain('const t = (back.state.rpm - spec.idleRpm)')` | PASS |
| C23 | e2e has 0 `waitForTimeout` and 0 fixed screenshot paths | (a) ✓ | `tests/unit/testHygiene.test.ts:60` `expect(hits).toEqual([])` | PASS |
| C24 | held countdown fails with `countdown não terminou em 4 s`; unheld passes | (g) `countdown holds every car` ✓, `countdown deadline message` ✓ | `tests/e2e/race.spec.ts:459` `await expect(sampleCountdown(page, 4)).rejects.toThrow('countdown não terminou em 4 s')`; unheld case at `:136-138` | PASS |
| C25 | `placeOpponent`: `prev` = placed ±0.01 m, `lastGate` unchanged after 0.2 s | (g) ✓ | `tests/e2e/race.spec.ts:475-476` `expect(Math.abs(r.prev.x - r.x)).toBeLessThanOrEqual(0.01)` (and z); `:478` `...lastGate).toBe(r.lastGate)` | PASS |
| C26 | dead symbols gone; 4 exports kept; header clean | (a) `old city generator is gone` ✓, `mulberry32 is deterministic` ✓ | `tests/unit/testHygiene.test.ts:77` per-name `toEqual([])`; `:81` `expect(gen, name).toMatch(... export (const\|function) <name>)`; `:83` `expect(gen).not.toMatch(/8×8\|202/)`; `tests/unit/cityGenerator.test.ts:12-13` | PASS |
| C27 | strict `tsc` exits 0 | (h) exit 0 | `src/hud/Minimap.ts:12` plain parameter `canvas: HTMLCanvasElement` | PASS |
| C28 | `ci.yml` push and pull_request, ubuntu-latest, Node 24, `npm ci` -> build -> test | (a) ✓ | `tests/unit/testHygiene.test.ts:66` `toMatch(/^on:\s*\[push, pull_request\]\s*$/m)`; `:67` ubuntu-latest; `:68` `node-version:\s*24\b`; `:70` `expect(runs).toEqual(['npm ci', 'npm run build', 'npm test'])`. The go-live `gh run list` proof waits on the push (open question 1) | PASS |
| C29 | README text, roadmap, Enter/Esc/R rows | (a) ✓ | `tests/unit/docs.test.ts:30` `not.toContain('as corridas ainda não existem')`; `:34` item 2; `:36-37` Corridas and trem; `:39-40` Enter and Esc; `:41` `R` `toMatch(/último portão/)` | PASS |
| C30 | AGENTS, README tree and AD-018 name `race` and `world/rail`; AD-004 superseded; AD-018 active after AD-017 | (a) `layout is the same in agents readme and state` ✓ | `tests/unit/docs.test.ts:46-47` AGENTS both halves; `:49-50` README tree; `:53` `superseded by AD-018`; `:56` order; `:57` `active`; `:58` AD-018 `src/{...,race}/`; `:59` AD-018 `toContain('`world/{terrain,roads,lots,interiors,rail}/`')`, fact at `.specs/STATE.md:49`. Round 2 fault F2 killed (carried from cd31003) | PASS |
| C31 | STATE residuals, AD order, residue block, `teleport` doc, README `## Intent` | (a) `state and docs are current` ✓ | `tests/unit/docs.test.ts:65` `toContain('(concluída, verificada rodada 1)')`; `:67` numeric order; `:69` `not.toContain('races: pintura dos oponentes sai escura')`; `:72-74` grid, AD-015 and água; `:76` `## Intent` | PASS |

Level and sampling: carried from cd31003 for every check except C3 and C4. For those two, the level is right: the proofs run the real vitest CLI, which is the right level for a test-configuration claim. The object is wrong: the claims name the npm scripts, and the proofs rebuild the scripts' flags instead of running the scripts or reading them. The new C4 claim is precise, with no numbers to go stale, so the round 2 precision gap is closed.

Swept rows are carried from 65d1ba3. Every row cites a check or says `n/a`, and none cites an existing constraint.

## Coverage

Verified at b04cacb for the one row the fix's authority touched: npm scripts. The other rows are carried from cd31003, and the fix touched none of their sources.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| vitest dirs with a timeout (2) | carried from cd31003 | C1 both dirs | - |
| npm scripts the checks name (3) | `package.json:14` `"test": "vitest run"`, `:15` `"test:quick": "vitest run --tags-filter=!slow"`, `:20` `"test:e2e:smoke"` | `test:e2e:smoke`: C7 reads the literal (`testHygiene.test.ts:29`) and C8 runs the script. `test:quick`: C3 runs it for its exit code only. Its list is taken from `vitest list --tags-filter=!slow` (`list-has.mjs:14`, `suite-split.mjs:15`), and R3-F2 survived. `test`: nothing runs or reads it. C4 takes `vitest list` (`suite-split.mjs:14`) | `test:quick` (what it runs), `test` (what it runs) |
| sets in C4's claim: full, quick, slow (3) | `vitest.config` tag `slow` at `vite.config.ts:11`; tag use at `tests/physics/raceAi.test.ts:92` (the only one, per `rg "tags: \['slow'\]" tests`) | disjointness `suite-split.mjs:22`; cover `:20`; no extra `:21`; no duplicates `:18`; marathon in `slow` `:23`. R3-F1 killed | - (as `vitest list` sets; the script identity is in the row above) |
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

Verified at b04cacb for the row that classifies `package.json`, the file C3 and C4 make claims about. The other four rows are carried from cd31003.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Test configuration | `vite.config.ts`, `playwright.config.ts`, `package.json` | real tool, read the effect | no - for the `package.json` scripts `test:quick` and `test`, the list proofs run the real tool with flags typed into the proof (`list-has.mjs:14`, `suite-split.mjs:14-16`), not the script's effect. R3-F2 survived. `vite.config.ts` (C1 re-ran green), `playwright.config.ts` (C5/C6 re-ran green) and `test:e2e:smoke` (C7/C8) are met |
| Decides, pure | `checkStuck`, `yawAssistTorque`, `InputManager` | own layer, vitest, one case per decision-table row | yes - carried from cd31003, re-ran green |
| `ChunkManager` counter | `src/world/ChunkManager.ts` | unit plus e2e, 1 and 2 updates per frame | yes - carried from cd31003, re-ran green |
| Race wiring (`RaceController` -> HUD) | `RaceController.ts`, `Game.ts` hooks | e2e, one case per asserted value | yes - carried from cd31003, re-ran green |
| Document text and hygiene rules | README, AGENTS.md, STATE.md, `Car.ts` doc, test sources | unit test reading the file, one assertion per affirmed phrase | yes - carried from cd31003, re-ran green |

## Faults injected

Verified at b04cacb, on the new surface only (the C4 claim and `tests/tooling/suite-split.mjs`). Scratch: `git worktree add C:\Users\arthu\AppData\Local\Temp\th-r3-fault HEAD`, with a `node_modules` junction created with PowerShell `New-Item -ItemType Junction`. Each fault was reverted with `git checkout -- <file>` in the scratch. The real tree's `git status --porcelain` was empty at baseline, after each fault, and after cleanup. The junction was deleted with `(Get-Item ...).Delete()` before `git worktree remove`. `node_modules\vitest\package.json` was confirmed present afterwards. Faults from rounds 1 and 2 (65d1ba3, cd31003) were on surfaces the fix did not touch and are carried.

| Mutation | Location | Killed |
| --- | --- | --- |
| R3-F1: `{ tags: ['slow'], timeout: 900_000 }` -> `{ timeout: 900_000 }`. `suite-split.mjs` printed "npm test: 213 · test:quick: 213 · slow: 0" and "o teste lento da IA não está marcado slow", exit 1 | `tests/physics/raceAi.test.ts:92` | yes |
| R3-F2: `"test:quick": "vitest run --tags-filter=!slow"` -> `"test:quick": "vitest run"`. `suite-split.mjs` exit 0 ("213 · 212 · 1", unchanged). `list-has.mjs --tags-filter="!slow" --absent ...` exit 0 ("212 ... ausente"). `npm run test:quick` exit 0, "213 passed (213)", with the slow test running inside the quick suite. Every C3 and C4 proof stayed green | `package.json:15` | no |

## Gate

- One vitest invocation over the 22 named unit and physics proofs: 22 passed, 0 failed (9 unnamed tests skipped by the filter)
- `npm run test:quick`: 212 passed, 1 skipped, 0 failed (54 files)
- `npx vitest run tests/unit --reporter=json` plus `max-duration.mjs 3000`: 167 passed, 0 failed, max 2266 ms
- One `npx playwright test` over the 7 named e2e proofs (E2E_PORT=5193): 7 passed, 0 failed (4.3m)
- `npm run test:e2e:smoke`: carried from 65d1ba3, 18 passed, 0 failed, 252 s
- `node tests/tooling/suite-split.mjs`: exit 0 (213 = 212 + 1). `list-has.mjs --absent`: exit 0. `e2e-reuse.mjs 5197`: exit 0. Strict `tsc`: exit 0. `playwright test --list`: 135 tests

## Ranked gaps

1. C4: the partition claim names "the `npm test` list" and "the `test:quick` list", but `tests/tooling/suite-split.mjs:14-16` builds its three lists from `npx vitest list` with flags typed into the script (`:7`), never from `package.json`. R3-F2 (`test:quick` -> `vitest run`) survived with identical output, and a `"test"` script that dropped `slow` (the exact regression AC 4 forbids) would pass too. Fix: have the proof read `pkg.scripts.test` and `pkg.scripts['test:quick']`, derive the `vitest list` arguments from them (replace `run` with `list --json`), and fail if either script is not a `vitest run` command. Or assert the two script literals in `testHygiene.test.ts`, as `:29` already does for `test:e2e:smoke` - `.specs/features/test-hardening/checks.md:23-24`, `tests/tooling/suite-split.mjs:14-16`.
2. C3: same root cause. The "list it runs" half is proven for `vitest list --tags-filter=!slow`, not for `npm run test:quick`. Under R3-F2 the quick suite ran the slow test, and both C3 proofs stayed green. The same fix closes it - `.specs/features/test-hardening/checks.md:19-21`, `tests/tooling/list-has.mjs:14`.
3. Note only: the round 2 gap (a stale hand-written total) is closed. C4 no longer holds a number, and R3-F1 shows the partition logic itself fails when the tag is removed.
