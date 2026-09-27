# races verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: fbe1a7b..8d8a6e3 (`main..races`)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

36/36 checks proven with located evidence (checks.md carries C1-C36; the handoff in `STATE.md` says "34 checks", which is stale: C35 and C36 exist, were run and are counted here). 5 faults injected, 5 killed. Tree restored to HEAD after each fault by inverse edit (`git status --porcelain` empty before the report was written).

## Binding sources

Step 1 is `ui`-only; profile is `standard`. The plan marks no source as binding (`Sources`: `STATE.md` roadmap item 2 and the user's choices of 2026-09-27). Nothing to compare.

## Proof runs (at HEAD 8d8a6e3)

- vitest, unit, one invocation: `npx vitest run tests/unit/raceRoutes.test.ts tests/unit/raceProgress.test.ts tests/unit/raceSession.test.ts tests/unit/aiDriver.test.ts tests/unit/minimap.test.ts tests/unit/purity.test.ts --reporter=verbose` - 6 files, 26 passed, 0 failed. Every named unit proof appears individually as passed.
- vitest, physics: `npx vitest run tests/physics/raceAi.test.ts --reporter=verbose` - 4 passed, 0 failed (`ai is driven only through DriveInput` 1.5 s, `each opponent finishes every race in time` 34.7 s, `stuck opponent is reset to its last gate` 0.4 s, `car dispose removes body collider controller and mesh` 0.05 s).
- Playwright, one invocation: `E2E_PORT=5193 npx playwright test tests/e2e/race.spec.ts tests/e2e/drive.spec.ts tests/e2e/world.spec.ts -g "races|reset puts car upright|falling in the water respawns on the nearest road"` - 19 passed, 0 failed (17 in `race.spec.ts`, plus `drive.spec.ts:180` and `world.spec.ts:126`), 8.4 min.

Every named test exists in the tree (hits shown in the Evidence column) and was reported individually. All proof files except `drive.spec.ts`/`world.spec.ts` are new or changed in `main..races`; C33 is deliberately a regression proof on existing tests.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 4 races of seed 1337, order, kind, laps, fields | vitest `generates the four races of seed 1337` passed | `tests/unit/raceRoutes.test.ts:70` - `expect(races.map((r) => [r.id, r.kind, r.laps])).toEqual([['circuito-centro','circuit',2],['circuito-anel','circuit',1],['sprint-cruzada','sprint',1],['sprint-morro','sprint',1]])`; `:78` `points.length % 3` toBe 0; `:80` `grid.length` toBe 4; `:81` `marker.radius` toBe(10) | PASS |
| C2 | each route follows its geometric rule | vitest `each route follows its rule` passed | `tests/unit/raceRoutes.test.ts:90` toLine ≤ 40, `:91-92` abs(x), abs(z) ≤ 340, `:95` corner ≤ 40; `:100` anel ≤ 1 m of `highway`; `:111` / `:113` cruzada ends ≤ 20 m, `:114` passes ≤ 30 m of (0,0); `:120` / `:122` morro ends ≤ 2 m. Avenue/hill lookups recomputed in the test (`avenue()` at `:50`), not taken from source | PASS |
| C3 | same seed, same races | vitest `same seed same races` passed | `tests/unit/raceRoutes.test.ts:128` - `expect(again).toEqual(races)` (whole `RaceDef`, Float32Array element-wise) | PASS |
| C4 | continuous, on asphalt, circuit closes | vitest `routes are continuous and on the asphalt` passed | `tests/unit/raceRoutes.test.ts:136` step ≤ 4; `:140` `n.d` ≤ `n.width / 2`; `:143` circuit first-last ≤ 4 | PASS |
| C5 | length bands ±0.01 m, sum check ≤ 1 m | vitest `route lengths within bands` passed | `tests/unit/raceRoutes.test.ts:159-160` - `toBeGreaterThanOrEqual(lo - 0.01)` / `toBeLessThanOrEqual(hi + 0.01)` with bands at `:151-154` matching checks.md; `:165` abs(length - sum) ≤ 1 | PASS |
| C6 | gates ≤ 250 m apart, halfWidth = w/2+4, last gate placement | vitest `gates spaced and sized` passed | `tests/unit/raceRoutes.test.ts:174-175` `g.s` increasing, `g.s - prev` ≤ 250 (prev starts at 0); `:178` abs(halfWidth - (w/2 + 4)) ≤ 0.01; `:183` last gate ≤ 4 m of end (sprint) / first point (circuit) | PASS |
| C7 | grid: 4 slots on asphalt, 6-24 m behind line, ≥ 5 m apart, heading ≤ 5° | vitest `grid slots on the asphalt behind the start line` passed | `tests/unit/raceRoutes.test.ts:196` ≤ `n.width / 2 - 1`; `:200-201` 6 ≤ before ≤ 24; `:206` heading ≤ 5°; `:211` pairs ≥ 5 | PASS |
| C8 | missing hill road skips only `sprint-morro` with one warn | vitest `missing road skips only that race` passed | `tests/unit/raceRoutes.test.ts:222` ids toEqual the other 3; `:223` `toHaveBeenCalledTimes(1)`; `:224` startsWith `race sprint-morro skipped:` | PASS |
| C9 | 4 visible markers r=10 at `marker`; minimap icons in window only; icon pixel colour at 50 m | vitest `race marker icons inside the window only` + Playwright `markers visible in free roam and on the minimap` passed | `tests/unit/minimap.test.ts:58` - `expect(marks).toEqual([...])` (2 of 4, the 161 m and 500 m ones dropped); `tests/e2e/race.spec.ts:72` length 4, `:74` visible, `:75` radius 10, `:76` centre equals race marker, `:87` pixel close to `#35e0ff` (= `MINIMAP_MARKER_COLOR`) | PASS |
| C10 | prompt ≤ 10.0 m and < 30 km/h, nearest wins; DOM text/visibility | vitest `prompt only within 10 m below 30 kmh` + Playwright `prompt appears at the marker` passed | `tests/unit/raceSession.test.ts:35` (10 m, 29.9) toBe 0; `:36` 10.01 m toBeNull; `:37` 30.0 km/h toBeNull; `:42-43` nearest of two; `tests/e2e/race.spec.ts:93-94` shown and text `ENTER · Circuito Centro`; `:96` hidden at 15 m | PASS |
| C11 | Enter: countdown, player on slot 3 still, opponents on 0-2, +3 bodies | Playwright `enter at the marker starts the countdown on the grid` passed | `tests/e2e/race.spec.ts:41` state `countdown`; `:107` ≤ 0.5 m of `grid[3]`; `:108` speed < 1; `:109` 3 opponents; `:111` each ≤ 0.5 m of `grid[o.index]`; `:113` `bodies` toBe `before.bodies + 3` | PASS |
| C12 | Enter away from markers: free, bodies unchanged, car still | Playwright `enter away from markers does nothing` passed | `tests/e2e/race.spec.ts:122` state `free`; `:123` bodies unchanged; `:125` moved ≤ 0.5 m | PASS |
| C13 | countdown 3/2/1/GO table, held input, cars < 1 km/h with W held | vitest `countdown 3 2 1 GO then racing` + Playwright `countdown holds every car` passed | `tests/unit/raceSession.test.ts:57-63` texts at steps 0/59→`3`, 60/119→`2`, 120/179→`1`, 3.0 s→`GO`; `:64` `racing`; `:65` clock 0; `:68` held input `{throttle:false, steer:0, handbrake:true}`; `tests/e2e/race.spec.ts:132` `#race-countdown` `3`; `:147` maxKmh < 1 over all 4 cars | PASS |
| C14 | exactly 1 gate mesh, ≤ 0.5 m of next gate, height 4; minimap shows only it | Playwright `only the next gate is shown` + vitest `next gate on the minimap` passed | `tests/e2e/race.spec.ts:156` `visibleGates` toBe 1; `:158` ≤ 0.5; `:159` height toBe 4; `tests/unit/minimap.test.ts:67-69` gate mark in window, none outside, none for null | PASS |
| C15 | 5 gate-crossing cases | vitest `gate crossing rules` passed | `tests/unit/raceProgress.test.ts:40-41` inside (11.9 m) advances; `:45-46` 12.1 m (0.1 outside) does not; `:49-50` gate after next does not; `:53-54` reverse does not; `:57-58` stops 0.1 m short does not | PASS |
| C16 | clock N/60 ≤ 1e-9; `formatRaceTime` values; DOM equals format of `race.time` | vitest `clock sums fixed steps and formats m:ss.cc` + Playwright `hud shows time lap and position` passed | `tests/unit/raceProgress.test.ts:63` abs(clockAfter(n) - n/60) ≤ 1e-9; `:64-66` `0:00.00`, `1:01.23`, `9:59.99`; `tests/e2e/race.spec.ts:177` `timeText` toBe `formatRaceTime(s.time)` (same evaluate) | PASS |
| C17 | lap only after every gate; `VOLTA 1/2`, `VOLTA 2/2`; DOM `VOLTA 1/2` | vitest `lap counts only after every gate` + Playwright `hud shows time lap and position` passed | `tests/unit/raceProgress.test.ts:74-75` early finish line no lap; `:79` still 1; `:81` lap 2; `:76` / `:83` labels; `tests/e2e/race.spec.ts:178` `VOLTA 1/2` | PASS |
| C18 | finish freezes time (+60 steps), session `finished`; browser shows results | vitest `player finish freezes time and finishes the session` + Playwright `finishing a sprint shows the results` passed | `tests/unit/raceSession.test.ts:80-81` finished, time 10; `:83` `finished`; `:88` time still 10 after 60 steps; `tests/e2e/race.spec.ts:192` state `finished`; `:194` `#race-results` shown | PASS |
| C19 | `#race-pos` = `POS p/4`, p from standings order | Playwright `hud shows time lap and position` passed | `tests/e2e/race.spec.ts:179` - `expect(s.posText).toBe(\`POS ${s.pos}/4\`)`; `:180-181` 1 ≤ p ≤ 4; `p` is `RaceController.position()` = `standings(...)` index (`src/race/RaceController.ts:231`) | PASS |
| C20 | AI only via `DriveInput`: replay equal ≤ 1e-4 m and quaternion | physics `ai is driven only through DriveInput` passed | `tests/physics/raceAi.test.ts:85` position diff ≤ 1e-4 each step; `:86` max quaternion component diff ≤ 1e-4; `:73` `resets` toBe 0 (no teleport during the recorded run) | PASS |
| C21 | skills, offsets, 3 distinct paints ≠ `#ff4d1a`, body colour in browser, target speed ordered | vitest `skills offsets and paints` + Playwright `opponents wear their own paint` passed | `tests/unit/aiDriver.test.ts:32` `[0.8, 0.88, 0.95]`; `:33` `[-3, 0, 3]`; `:35-36` 3 distinct, not `#ff4d1a`; `:40-41` targetSpeed on r=50 m ordered; `tests/e2e/race.spec.ts:209` `bodyColor` toBe paint; `:210-211` distinct, not player's | PASS |
| C22 | 12 solo runs finish < 420 s, ≤ 1 reset, t(0.95) < t(0.88) < t(0.80) | physics `each opponent finishes every race in time` passed (34.7 s) | `tests/physics/raceAi.test.ts:97` finished; `:98` time < 420; `:99` resets ≤ 1; `:103-104` ordered times; loops `races` (4) × `AI_SKILLS` (3) at `:93-95` | PASS |
| C23 | stuck thresholds 4.9/5.1 m, -1.51/-1.49; target; physics reset ≤ 4.1 s, ≤ 0.5 m, still, ≤ 5° | vitest `stuck detector thresholds and target` + physics `stuck opponent is reset to its last gate` passed | `tests/unit/aiDriver.test.ts:55-56` 4.9 fires, 5.1 does not; `:59` / `:61` -1.51 fires, -1.49 does not; `:73-74` target grid slot / last gate; `tests/physics/raceAi.test.ts:136` 1 reset; `:137` ≤ 4.1 s after stopping; `:140` ≤ 0.5 m; `:141` < 1 km/h; `:143` heading ≤ 5° | PASS |
| C24 | opponent dots in paint inside window; browser pixel per opponent | vitest `opponent dots in their paint` + Playwright `opponents on the minimap` passed | `tests/unit/minimap.test.ts:82` - marks toEqual the 2 in-window dots with their colours (the 200 m one dropped); `tests/e2e/race.spec.ts:234` pixel close to `hex(m.paint)` for each opponent | PASS |
| C25 | dispose restores bodies/colliders/controllers, `mesh.parent` null; browser counts restored after results and abort | physics `car dispose removes body collider controller and mesh` + Playwright `abort with escape returns to free roam` + `enter on the results returns to free roam` passed | `tests/physics/raceAi.test.ts:155` `{bodies, colliders, vehicles}` toEqual before; `:156` `mesh.parent` toBeNull; `tests/e2e/race.spec.ts:247` and `:270` `{bodies, cars}` toEqual before (`cars` = scene children named `car`, as renegotiated) | PASS |
| C26 | standings, one case per key | vitest `standings order by finish lap gate distance` passed | `tests/unit/raceProgress.test.ts:92` finish time; `:94` finished beats higher lap; `:96` lap; `:98` gate 7 over 5 (distance set against it: 100 vs 1); `:100` 12 m over 30 m | PASS |
| C27 | result rows in order with `VOCÊ` and dashes; browser 4 rows | vitest `result rows with times and dashes` + Playwright `finishing a sprint shows the results` passed | `tests/unit/raceProgress.test.ts:116` rows toEqual `[{1,'VOCÊ','2:01.34'},{2,'Caio','2:05.50'},{3,'Duda','--:--.--'},{4,'Bia','--:--.--'}]`; `tests/e2e/race.spec.ts:196` 4 rows; `:197` positions 1-4; `:199` a `VOCÊ` row | PASS |
| C28 | Enter on results: free, car ≤ 0.5 m, panel/results hidden, C25 | Playwright `enter on the results returns to free roam` passed | `tests/e2e/race.spec.ts:265` `free`; `:267` ≤ 0.5 m; `:268-269` hidden; `:270` counts restored | PASS |
| C29 | R: grid slot 3 (still) with no gate, gate k (≤ 5°) after crossing, clock not rewound | vitest `reset target is last gate or grid slot` + Playwright `r returns to the last gate during a race` passed | `tests/unit/raceSession.test.ts:94` `resetTarget(race,-1)` = grid[3]; `:96` `resetTarget(race,1)` = gate 1; `tests/e2e/race.spec.ts:281` ≤ 0.5 m of `grid[3]`; `:282` < 1 km/h; `:296` ≤ 0.5 m of gate 0; `:298` heading ≤ 5°; `:299` time ≥ t0 | PASS |
| C30 | water in race returns to gate 1 (the first crossed), `waterResets` unchanged | Playwright `water during a race returns to the last gate` passed | `tests/e2e/race.spec.ts:315` ≤ 0.5 m of `gates[0]`; `:316` `waterResets` toBe before | PASS |
| C31 | Escape in countdown and racing: free, panel hidden, no results, C25 | Playwright `abort with escape returns to free roam` passed | `tests/e2e/race.spec.ts:240` loops `racing` in `[false, true]`; `:244` `free`; `:245` panel hidden; `:246` results hidden; `:247` counts restored | PASS |
| C32 | Enter/Escape table; markers and prompt hidden in countdown and racing | vitest `session transitions on enter and escape` + Playwright `markers hidden during a race` passed | `tests/unit/raceSession.test.ts:106-110` Enter row per state; `:112-115` Escape row per state; `tests/e2e/race.spec.ts:324-325` countdown hidden; `:329-330` racing hidden | PASS |
| C33 | free roam R upright in place; free roam water to nearest road | Playwright `reset puts car upright` + `falling in the water respawns on the nearest road` passed | `tests/e2e/drive.spec.ts:187-190` rotation identity; `:191` y = before + 1 (in place); `tests/e2e/world.spec.ts:146` `waterResets` toBe before + 1; `:156` target ≤ 15 m of nearest road | PASS |
| C34 | draw calls ≤ 220 racing on the grid with 3 opponents | Playwright `draw calls within budget while racing` passed | `tests/e2e/race.spec.ts:338` - `expect(__game.render.calls).toBeLessThanOrEqual(220)` | PASS |
| C35 | 4 race modules in the pure list, no `three`/rapier import | vitest `pure modules do not import three or rapier` passed | `tests/unit/purity.test.ts:53` length toBe 33 (4 added at `:42-45`); `:56` `FORBIDDEN.test(source)` toBe false | PASS |
| C36 | player > 20 km/h after 2 s of W post-GO | Playwright `player drives after go` passed | `tests/e2e/race.spec.ts:345` - `expect(await speedKmh(page)).toBeGreaterThan(20)` | PASS |

## Coverage

Recomputed from the plan's ACs (the authority for what the feature owes) and, where the set is discovered in code, from the code line that defines it.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| races (4) | plan AC 1; `RULE_IDS` `src/race/raceRoutes.ts:329` | `circuito-centro` C1 C2 C5 · `circuito-anel` C1 C2 C5 · `sprint-cruzada` C1 C2 C5 · `sprint-morro` C1 C2 C5 C8 (all loop `races` in C4 C6 C7) | - |
| race kinds (2) | `RaceKind` `src/race/raceRoutes.ts:16` | `circuit` C4 (`:143`) C6 (`:182`) C17 · `sprint` C6 C18 (unit and e2e on `sprint-cruzada`) | - |
| session states (4) | `SessionState` `src/race/raceSession.ts:10` | `free` C12 C32 · `countdown` C11 C13 · `racing` C13 C19 · `finished` C18 C28 | - |
| transitions (6) | plan AC 9, 11, 16, 26, 29 | free→countdown C11 C32 · countdown→racing C13 · racing→finished C18 · finished→free C28 C32 · countdown→free C31 C32 · racing→free C31 C32 | - |
| Enter/Escape cells (10) | C32 table (5 rows × 2 keys) | all 10 at `tests/unit/raceSession.test.ts:106-115` (free-with-prompt Escape and free-without-prompt Escape are one call: `onEscape` takes no prompt) | - |
| R by state (3) | plan AC 27, AC 31; `RaceController.resetPlayer` `active` guard `src/race/RaceController.ts:140`, fallback `src/core/Game.ts` KeyR handler | free C33 (`drive.spec.ts:191`) · racing C29 e2e · countdown C29 unit (`resetTarget(race,-1)` = slot 3, state-agnostic) + C11/C13 (car is held ≤ 0.5 m of slot 3 at < 1 km/h through countdown, so the outcome C29 claims holds; see notes) | - |
| water reset by state (2 claimed) | plan AC 28, AC 31 | free C33 (`world.spec.ts:146`) · racing C30 | - |
| gate-crossing cases (5) | plan AC 13 | forward inside · 0.1 m outside · wrong gate · reverse · short: all C15 (`raceProgress.test.ts:40-58`) | - |
| order keys (4 + finished-first) | plan AC 24 | finish time · finished-before-unfinished · lap · gate · distance: C26 `:92-100`, each case built so only its key decides | - |
| opponents (3) | `AI_SKILLS` / `AI_OFFSETS` / `AI_PAINTS` `src/race/aiDriver.ts:15-17` | 0.80 · 0.88 · 0.95: C21 (values) and C22 (each × 4 races) | - |
| stuck triggers (2) | plan AC 21; `checkStuck` `src/race/aiDriver.ts:210` | no progress C23 unit + physics wall · water C23 unit (-1.51/-1.49) | - |
| reset targets (2) | `resetTarget` `src/race/raceSession.ts:93` | last gate C23 C29 · grid slot C23 C29 | - |
| parts removed by `dispose` (4) | plan AC 23; `Car.dispose` `src/vehicle/Car.ts:492-498` | body · collider · vehicle controller · mesh: C25 physics `:155-156` | - |
| race exits that remove opponents (2) | plan AC 23 | results closed C25 C28 (`race.spec.ts:270`) · abort C25 C31 (`:247`, both countdown and racing) | - |
| race HUD elements (7) | `index.html` diff: `#race-prompt`, `#race-countdown`, `#race-panel`, `#race-pos`, `#race-lap`, `#race-time`, `#race-results` | prompt C10 · countdown C13 · panel C28 C31 · pos C19 · lap C17 · time C16 · results C18 C27 | - |
| minimap drawings (3) | `MinimapMark.kind` `src/hud/minimapMath.ts:58` | marker C9 · gate C14 · opponent C24 (unit and canvas pixel for marker and opponent) | - |
| countdown texts (4) | plan AC 11 | `3` `2` `1` `GO`: C13 `raceSession.test.ts:57-63` | - |
| prompt edges (4) | plan AC 8 | 10.0 m · 10.01 m · 29.9 km/h · 30.0 km/h: C10 `:35-37` | - |
| result time formats (2) | plan AC 25 | `m:ss.cc` · `--:--.--`: C27 `:116` | - |
| one-way doors (3) | plan `Landing` | `RaceDef` C1-C8 · AI only by `DriveInput` C20 (+ fault F3/F4 surfaces) · fixed-step clock C16 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/race/raceRoutes.ts` | own layer C1-C8 (vitest) · boundary: e2e reads the generated races through `__game.race` (C9 `:76`, C11 `:107`, C14 `:158`) | yes |
| Decides, reached across a boundary | `src/race/raceProgress.ts` | own layer C15-C17 C26 C27 · boundary: e2e C16-C19 C27 (through `RaceController.afterStep`/`crossNextGate` into `stepProgress`) and physics C22 (real crossings finish every race) | yes |
| Decides, reached across a boundary | `src/race/raceSession.ts` | own layer C10 C13 C18 C29 C32 (one case per table row: C13 4 rows, C32 10 cells, C10 4 edges) · boundary e2e C10-C13 C29-C32 | yes |
| Decides, reached across a boundary | `src/race/aiDriver.ts` | own layer C21 C23 · boundary physics C20 C22 C23 with the real Rapier world | yes |
| Glue in `Game`, `Hud`, `Minimap` | `src/core/Game.ts`, `src/race/RaceController.ts`, `src/race/Opponent.ts`, `src/hud/RaceHud.ts`, `src/hud/Minimap.ts`, `index.html`, `src/style.css` | none of its own; covered by the Playwright consumers (17 tests in `race.spec.ts`) | yes |
| `Car.dispose` and the constructor colour | `src/vehicle/Car.ts` | tests/physics with real Rapier, each removed part read back: C25 `raceAi.test.ts:155-156` (bodies, colliders, `vehicleControllers.size`, `mesh.parent`) | yes |

## Faults injected

One per assertion surface, capped at five: route generation, session rules, AI driver, physics boundary (`Car`), browser boundary (`RaceController`). Each was applied in the real tree, run with the narrowest covering proof, then undone by an inverse edit; `git status --porcelain` was empty after each.

| Mutation | Location | Proof run | Killed |
| --- | --- | --- | --- |
| gate margin `GATE_MARGIN = 4` -> `5` | `src/race/raceRoutes.ts:54` | vitest `gates spaced and sized` - failed: `circuito-centro gate at 198.89: expected 1 to be less than or equal to 0.01` | yes |
| prompt speed bound `>= PROMPT_MAX_KMH` -> `>` | `src/race/raceSession.ts:36` | vitest `prompt only within 10 m below 30 kmh` - failed: `expected +0 to be null` (30.0 km/h case) | yes |
| stuck progress bound `>= STUCK_MIN_M` -> `>= STUCK_MIN_M - 0.5` | `src/race/aiDriver.ts:215` | vitest `stuck detector thresholds and target` - failed: `expected false to be true` (4.9 m case) | yes |
| removed `world.removeVehicleController(this.controller)` from `dispose` | `src/vehicle/Car.ts:493` | physics `car dispose removes body collider controller and mesh` - failed: `vehicles` 1, expected 0 | yes |
| removed `op.dispose()` from `RaceController.end` | `src/race/RaceController.ts:277` | Playwright `abort with escape returns to free roam` (E2E_PORT=5193) - failed: `bodies` 5 / `cars` 4, expected 2 / 1 | yes |

Surfaces not faulted (cap reached): `raceProgress` standings/crossing, `minimapRaceMarks`, purity list. Their proofs are table-driven with literal expected values at the assertion (`raceProgress.test.ts:92-100`, `minimap.test.ts:58/67/82`, `purity.test.ts:53`).

## Swept rows re-read

Every `Swept` row cites checks, except two `n/a` rows (authorization, dependency failure). The dependency-failure row states that opponents reuse the placeholder path when `car.glb` is absent: confirmed in `src/vehicle/Car.ts` `buildVisual` (`assets.carModel` null falls through to `buildPlaceholder`, which paints `this.paint ?? PLAYER_PAINT`).

## Notes (non-blocking)

1. **Precision gap, C13 wording.** The check says the held input during countdown is "freio" (brake). The code holds `handbrake: true, brake: false` (`src/race/raceSession.ts:24`, with a comment that the service brake at standstill engages reverse), and the unit test asserts exactly that (`raceSession.test.ts:68`). The AC 11 outcome (every car < 1 km/h with W held) is proven at the browser. The wording should say "freio de mão".
2. **C29 in `countdown` is not driven at the boundary.** The e2e presses R only in `racing`. In `countdown` the code path is the same (`RaceController.resetPlayer` guards on `active` = countdown or racing, `RaceController.ts:113/140`) and the claimed outcome (≤ 0.5 m of slot 3, < 1 km/h) is already held by C11/C13. A mutant restricting the reset to `racing` would therefore be observationally equivalent at the grid. Recorded, not a gap.
3. **C12** relies on the spawn point being far from every marker. The test does not assert the "100 m" precondition, but a spawn inside 10 m of a marker would make the test fail, not pass.
4. **Test policy row 3.** The constructor colour has no assertion in `tests/physics` (C20/C25 construct painted cars there but do not read the colour back). The colour is asserted at the browser (C21 `race.spec.ts:209`, the only path that loads the glb and runs `buildOpponentModel`). The row's coverage expectation names only the removed parts, which are met.
5. **Stale comment.** `src/race/aiDriver.ts:8` still documents the corner speed as `sqrt(habilidade · A_LAT · raio)`. The code (`:96`) uses `skill² · sqrt(A_LAT · r)`, as settled mid-build.
6. **Stale count.** The `STATE.md` handoff says "34 checks". checks.md has 36 (C35 purity, C36 player drives after GO), and all 36 are proven here.

## Gate

- `npx vitest run` (6 race-related unit files): 26 passed, 0 failed
- `npx vitest run tests/physics/raceAi.test.ts`: 4 passed, 0 failed
- `E2E_PORT=5193 npx playwright test tests/e2e/race.spec.ts tests/e2e/drive.spec.ts tests/e2e/world.spec.ts -g "..."`: 19 passed, 0 failed
