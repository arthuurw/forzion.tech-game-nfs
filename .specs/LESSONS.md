# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

### L-003 - Declare every tolerance in the check text itself, never only in the test body
- signal: `spec_precision_gap` · recurrence: 3 feature(s) · scope: `checks` · harmful: 0
- features: free-roam-city, play-fixes, e2e-speed
- evidence: verification.md round 1 finding C26 - tests/e2e/hud.spec.ts:17 (tolerancia so no teste) (checks) (+2 more)
- last seen: 2026-10-01T17:13:40Z

### L-012 - A force defined as against the direction of motion owes a case in each direction; a single-direction case cannot tell a sign from a constant.
- signal: `surviving_mutant` · recurrence: 2 feature(s) · scope: `vehicle` · harmful: 0
- features: car-handling, corner-assist
- evidence: round3 F5 drivetrain.ts:181 (vehicle) (+1 more)
- last seen: 2026-09-27T00:44:25Z

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Every catch branch in an entry point owes its own boundary proof asserting the exact user-visible message
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `boot` · harmful: 0
- features: free-roam-city
- evidence: verification.md round 1 gap 1 - src/main.ts:34-38 (catch do boot sem prova) (boot)
- last seen: 2026-09-25T22:27:35Z

### L-002 - Prove a canvas drawing module by reading pixels from the real canvas, not only by testing its math helper
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `hud` · harmful: 0
- features: free-roam-city
- evidence: verification.md round 1 gap 2 - src/hud/Minimap.ts:27-43 (desenho sem prova) (hud)
- last seen: 2026-09-25T22:27:36Z

### L-004 - A Landing door with literal attributes owes a proof that asserts those literals, not only the class name
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `checks` · harmful: 0
- features: free-roam-city
- evidence: verification.md round 1 finding doors - src/core/Game.ts:75-78 (bloom params nunca afirmados) (checks)
- last seen: 2026-09-25T22:27:36Z

### L-005 - Assert the live value of every parameter a per-frame update writes, not only the target field it was computed from
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `audio` · harmful: 0
- features: engine-sound
- evidence: verification.md round 1 - src/audio/AudioEngine.ts:138 engineGain setTargetAtTime removed, C5/C6 green (audio)
- last seen: 2026-09-25T23:43:13Z

### L-006 - Sample both sides of every clamp a mapping claims, including below the minimum input
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `audio` · harmful: 0
- features: engine-sound
- evidence: verification.md round 2 gap 1 - src/audio/audioMap.ts:54 tremoloDepth lower clamp unsampled (audio)
- last seen: 2026-09-25T23:43:13Z

### L-007 - When a check bounds a blend or transition band, assert the neighbour pairs that cross each band edge, not only pairs inside the band.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `world` · harmful: 0
- features: city-terrain
- evidence: round1 F1 carveRoads.ts:62 (world)
- last seen: 2026-09-26T18:38:18Z

### L-008 - When a seeded generator has an OR of conditions, add a synthetic input for each branch; the production seed may never exercise one of them.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `world` · harmful: 0
- features: city-terrain
- evidence: round1 F2 RoadGenerator.ts:185 (world)
- last seen: 2026-09-26T18:38:18Z

### L-009 - A size asserted on the render mesh does not prove the physics collider; read the collider back from Rapier and assert its extents.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `physics` · harmful: 0
- features: city-terrain
- evidence: round2 C27 WorldPhysics.ts:50 (physics)
- last seen: 2026-09-26T18:38:18Z

### L-010 - A behaviour rule added while building that changes what the player can do (not just how) is a user decision; record it in the plan before the code, never only in a comment.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `vehicle` · harmful: 0
- features: car-handling
- evidence: round1 drivetrain.ts:192 (vehicle)
- last seen: 2026-09-26T18:50:06Z

### L-011 - Every branch in a state-machine step function owes an asserted case; enumerate branches from the code's if/else ladder when writing coverage, not from the plan's regimes.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `vehicle` · harmful: 0
- features: car-handling
- evidence: round1 drivetrain.ts:176 (vehicle) (+1 more)
- last seen: 2026-09-26T19:03:24Z

### L-013 - A test proving a value is read from config must use a probe value that differs from the default; equal values cannot tell reading from hardcoding.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `vehicle` · harmful: 0
- features: car-feel
- evidence: round1 F1b harness.test.ts:31 (vehicle)
- last seen: 2026-09-26T21:47:45Z

### L-014 - Assert the rendered object's real transform, not the stored number that feeds it; a DEV getter of the input survives deleting the transform.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `camera` · harmful: 0
- features: car-feel
- evidence: round1 F3 ChaseCamera.ts:92 (camera)
- last seen: 2026-09-26T21:47:45Z

### L-015 - A table case that saturates at an outer clamp cannot prove an inner limit; add a case where the inner limit acts below the clamp.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `vehicle` · harmful: 0
- features: yaw-assist
- evidence: round1 yawAssist.ts:32 (vehicle)
- last seen: 2026-09-26T23:09:45Z

### L-016 - A proof that reads a recorded mirror field does not prove the value applied to the body; assert the physical effect too.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `tests/physics` · harmful: 0
- features: corner-assist
- evidence: corner-assist r2 F9 Car.ts:393 (tests/physics)
- last seen: 2026-09-27T01:07:39Z

### L-017 - A per-step debug field needs an assertion on a zero step right after a non-zero step, or stale values pass.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `tests/physics` · harmful: 0
- features: corner-assist
- evidence: corner-assist r2 F8 Car.ts:381 (tests/physics)
- last seen: 2026-09-27T01:07:39Z

### L-018 - Every qualitative word in a claim (from the seed, 8 m scale, near the trees) needs its own measured bound and proof, or the verifier finds it unproven.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `checks` · harmful: 0
- features: block-fill
- evidence: block-fill r1 C8/C25 (checks)
- last seen: 2026-09-27T01:23:21Z

### L-019 - Re-measure a baseline at HEAD before writing a threshold on it; a value copied from an older verification report can already be stale.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `checks` · harmful: 0
- features: residuals
- evidence: checks.md Handoff - C1/C2/C5 renegotiated (checks)
- last seen: 2026-09-27T15:25:24Z

### L-020 - A threshold claim needs a case just below and just above the number; two far-apart cases pass any value between them.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: block-life-extras
- evidence: verification.md round 2 F5 (tests)
- last seen: 2026-09-27T21:49:54Z

### L-021 - A GLSL/JS twin contract must name the colour space of every input; a shader fed linear colour while the twin assumes sRGB passes loose pixel checks.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `render` · harmful: 0
- features: block-life-extras
- evidence: verification.md round 1 paint colour space (render)
- last seen: 2026-09-27T21:49:54Z

### L-022 - Before writing a pixel probe with the game camera, project the target and check it lands in the frame and is not occluded; a probe point behind a roof reads 0.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `tests/e2e` · harmful: 0
- features: block-life-extras
- evidence: checks.md C22 renegotiation (tests/e2e)
- last seen: 2026-09-27T21:49:54Z

### L-023 - Playwright reads happen in real time while the sim keeps stepping; compare deltas against the sim clock read in the same evaluate, never against a fixed advance.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `tests/e2e` · harmful: 0
- features: block-life-extras
- evidence: checks.md C17 C21 C31 (tests/e2e)
- last seen: 2026-09-27T21:49:54Z

### L-024 - Size a decision's coverage row from the branches in the code, and reconcile it with any branch list the checks' own evidence names; a shorter row hides a branch.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: test-hardening
- evidence: test-hardening r1 gap 1 - src/core/InputManager.ts:34 (Space branch unproven) (tests)
- last seen: 2026-09-29T20:35:41Z

### L-025 - A claim naming several literals owes one assertion per literal; asserting one half of a compound phrase leaves the other half free to drift.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `docs` · harmful: 0
- features: test-hardening
- evidence: test-hardening r1 gap 2 - tests/unit/docs.test.ts:58 (AD-018 world/rail half unasserted) (docs)
- last seen: 2026-09-29T20:35:41Z

### L-026 - A negative sub-claim (nothing of kind X remains) owes its own scan assertion; a hand check at verify time proves only that one commit.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: test-hardening
- evidence: test-hardening r1 gap 3 - tests/unit/testHygiene.test.ts:16 (C21 no-expect(CONST) sub-claim unasserted) (tests)
- last seen: 2026-09-29T20:35:41Z

### L-027 - A check that states a total count owes a proof that asserts that number; a count kept only in the check text goes stale at the next added test.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `checks` · harmful: 0
- features: test-hardening
- evidence: test-hardening r1 gap 4 and r2 C4 - .specs/features/test-hardening/checks.md:23 (count 212 stale, 213 at HEAD) (checks)
- last seen: 2026-09-29T20:35:41Z

### L-028 - A claim about what an npm script runs owes a proof that runs or reads that script; a proof that retypes the script's flags survives any edit to the script.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `test-tooling` · harmful: 0
- features: test-hardening
- evidence: test-hardening r3 R3-F2 - package.json:15 test:quick -> vitest run survived tests/tooling/suite-split.mjs:14-16 and list-has.mjs:14 (C3, C4) (test-tooling)
- last seen: 2026-09-29T20:45:22Z

### L-029 - Prove a mode decision through the component that selects it, not only by calling the selected mode directly on the callee.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `race` · harmful: 0
- features: play-fixes
- evidence: verification.md round 1 F1 - src/race/RaceController.ts:159 (finished opponent stop mode dropped, C14/C16 green) (race)
- last seen: 2026-09-30T00:59:44Z

### L-030 - A threshold rule owes one synthetic case just inside and one just outside the limit, not only a sweep or a seeded invariant.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `world` · harmful: 0
- features: play-fixes
- evidence: verification.md round 1 Test policy row Regra pura - interiorMotion.ts insideCarBox, trainLine.ts COLUMN_ROAD_GAP (world)
- last seen: 2026-09-30T00:59:44Z

### L-031 - When a plan renegotiates another feature's check, list every proof of that check (unit and browser) in Impact and rerun them all, not only the one that was edited.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `race` · harmful: 0
- features: play-fixes
- evidence: tests/e2e/race.spec.ts:304,333 (races C29, C30) (race)
- last seen: 2026-09-30T17:25:57Z

### L-032 - A sim clock advanced by summed fixed steps lands a few ulps short; assert sim durations with a tolerance or as a step count, never an exact >= on the seconds.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `tests/e2e` · harmful: 0
- features: e2e-speed
- evidence: C11 - tests/e2e/extras.spec.ts:182 (tests/e2e)
- last seen: 2026-10-01T17:13:40Z

### L-033 - When sim waits move off the frame loop, sweep every test that reads render-smoothed state after a teleport or input, not only a hand-picked list; each such wait needs real frames.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `tests/e2e` · harmful: 0
- features: e2e-speed
- evidence: C9 set - tests/e2e/visual.spec.ts:142 (tests/e2e)
- last seen: 2026-10-01T17:13:40Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
