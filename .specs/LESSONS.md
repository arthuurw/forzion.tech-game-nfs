# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

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

### L-003 - Declare every tolerance in the check text itself, never only in the test body
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `checks` · harmful: 0
- features: free-roam-city
- evidence: verification.md round 1 finding C26 - tests/e2e/hud.spec.ts:17 (tolerancia so no teste) (checks)
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
- evidence: round1 drivetrain.ts:176 (vehicle)
- last seen: 2026-09-26T18:50:06Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
