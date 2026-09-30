# night-city verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 489a5c8..8a7675f
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

All 29 checks are proven at 8a7675f: every named proof ran green, and each check has a located assertion. The feature still fails, for three reasons:
- **A fault survived.** F5 removed the skyline silhouette from the sky dome shader (`src/world/Environment.ts:103`). The unit proofs C16 and C26 and all five sky and low-quality e2e proofs (C14, C15, C17, C18, C27) stayed green. C16 proves only the pure `skylineHeight`. Nothing ties the dome to it, so AC 13 ("desenhar a silhueta ... pela função pura") is not proven where it is drawn.
- **The "Shader" Test policy row is not met.** That row requires a browser pixel probe and a shader-text unit test for each shader, one case per visual behaviour. The sky silhouette, the lamp lens and the neon sign have no pixel probe. Their only unit proof on shader text is C26, and C26 checks only for a clock.
- **Coverage members are unproven.** In "partes do poste", the housing is mapped to C7, but C7 only asserts a bounding box that the post and arm already satisfy. In the swept set "faces do letreiro" (front and back tubes and the dark frame, AC 16), no member has a proof.

## Binding sources

Not run under `standard`: step 1 runs only under `ui`. The plan's `Sources` are user choices and "before" screenshots, and none is a design or contract marked binding.

## Checks

Verified at 8a7675f. The proofs were run by me, in two invocations:
- **(a) Unit.** `npx vitest run tests/unit/lampLight.test.ts tests/unit/roads.test.ts tests/unit/nightCityShaders.test.ts tests/unit/purity.test.ts -t "<11-way alternation of every named unit proof>" --reporter=verbose` exited 0 with "Tests 11 passed | 11 skipped (22)". Each of the 11 names appears individually with `✓`.
- **(b) E2E.** `E2E_PORT=5193 npx playwright test tests/e2e/nightCity.spec.ts tests/e2e/world.spec.ts tests/e2e/visual.spec.ts tests/e2e/render.spec.ts tests/e2e/race.spec.ts -g "<27-way alternation of every named e2e proof>"` exited 0 with "27 passed (11.0m)". Each of the 27 tests is listed with `✓`.

The logs are in the session scratchpad at `verifier-nc/unit-head.log` and `verifier-nc/e2e-head.log`. Every named test exists: the rg and grep hits are the file:line cited below.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | lens 6 m above the base and 1.6 ± 0.05 m closer to the road axis, for every seed-1337 lamp | (a) `lamp head hangs over the road` ✓ | `tests/unit/lampLight.test.ts:45` `Math.abs(h.y - (l.y + 6)) > 1e-9`; `:47` `Math.abs(closer - 1.6) > 0.05`; `:50` `expect(bad).toEqual([])`; `:49` `lamps.length > 100` | PASS |
| C2 | `heading` = atan2 of the segment under the lamp ± 1e-6 | (a) `lamp posts every 40 m on both sides` ✓ | `tests/unit/roads.test.ts:412` `Math.abs(Math.atan2(Math.sin(seg - l.heading), Math.cos(seg - l.heading))) <= 1e-6`; `:414` `expect(onSegment, ...).toBe(true)` | PASS |
| C3 | `lampColor`: 5-row table, LED `#dce6ff` / sodium `#ff9d4a` | (a) `lamp color by district` ✓ | `tests/unit/lampLight.test.ts:56-60` five rows; `:62` `expect(lampColor({ x, z }, { kind }), name).toBe(color)`; `:63-64` literal hexes. F2 killed | PASS |
| C4 | cell under each lens ≥ 0.9 × the color; 0 at ≥ 9 m; never rises going out from a lone lens | (a) `lamp light grid falls off from each head` ✓ | `tests/unit/lampLight.test.ts:74` `c[ch] < 0.9 * v * 255 - 0.5`, then `:77` `expect(dim).toEqual([])`; `:94` `expect(lit).toBe(0)`; `:105` `expect(cur).toBeLessThanOrEqual(prev)`; `:108` `expect(prev).toBe(0)`. F1 killed | PASS |
| C5 | 1536 × 1536 RGBA grid, 2 m cells, cell 0 centred at −1535 | (a) `lamp light grid covers the world` ✓ | `tests/unit/lampLight.test.ts:113` `expect(grid.size).toBe(1536)`; `:114` `cell` 2; `:115` `data.length` 1536·1536·4; `:116` `expect(lampLightCellCenter(0)).toBe(-1535)` | PASS |
| C6 | `?quality=low`: under the lens ≥ 1.3 × the asphalt 20 m ahead (`lumAt`) | (b) `street light pools on the asphalt` ✓ | `tests/e2e/nightCity.spec.ts:15` `open(page, '?quality=low')`; `:42` `expect(under!).toBeGreaterThanOrEqual(1.3 * between!)` | PASS |
| C7 | 1 `InstancedMesh`, `count` = number of lamps, bounding box ≥ 1.6 m wide | (b) `lamp posts are one instanced mesh` ✓ | `tests/e2e/world.spec.ts:217` `expect(l.meshes.length).toBe(1)`; `:218` `instanced` true; `:219` `count` = `l.count`; `:220` `expect(l.meshes[0].width).toBeGreaterThanOrEqual(1.6)` | PASS |
| C8 | per-instance color is `#dce6ff` downtown and `#ff9d4a` on a hill lamp, read in the browser | (b) `lamp colors in the browser` ✓ | `tests/e2e/nightCity.spec.ts:59` `expect(r.downtown).toBe('#dce6ff')`; `:60` `expect(r.hill).toBe('#ff9d4a')`. The probe reads the `aLampColor` instance attribute (`src/core/Game.ts:1186`) | PASS |
| C9 | `mirrorStreak(20)`: h ≥ 3 × w | (b) `reflections are vertical streaks` ✓ | `tests/e2e/nightCity.spec.ts:96` `expect(s.h).toBeGreaterThanOrEqual(3 * s.w)`; `:95` `w > 0` | PASS |
| C10 | `mirrorBlur: false`: h ≤ 1.5 × w | (b) `probe sees a sharp reflection without streaks` ✓ | `tests/e2e/nightCity.spec.ts:105` `expect(s.h).toBeLessThanOrEqual(1.5 * s.w)` | PASS |
| C11 | h/srcH at 60 m > h/srcH at 20 m | (b) `streaks grow with distance` ✓ | `tests/e2e/nightCity.spec.ts:116` `expect(far.h / far.srcH).toBeGreaterThan(near.h / near.srcH)`. F3 killed (received 5, expected > 5) | PASS |
| C12 | no `blendOverlay(`; tint in (0, 1]; Fresnel in [0, 1] and non-increasing; constants interpolated | (a) `mirror never adds light` ✓ | `tests/unit/nightCityShaders.test.ts:30` `expect(frag).not.toContain('blendOverlay(')`; `:32-33` tint `> 0`, `<= 1`; `:35-37` tint, `dist * GROW` and Fresnel text; `:41-42` Fresnel range; `:44` non-increasing. F3 killed | PASS |
| C13 | residuals limits kept (shimmer, sensitivity, 320 × 180 target, gain) | (b) the 4 residuals tests ✓ | `tests/e2e/visual.spec.ts:528` `expect(still).toBe(0)`; `:529` `expect(moving - noMirror).toBeLessThanOrEqual(0.001)`; `:538` `expect(sharp - noMirror).toBeGreaterThanOrEqual(0.003)`; `:550` `toEqual([320, 180])`, texel at `:552-553`; `:564` `expect(blurred).toBeGreaterThanOrEqual(0.6 * sharp)` | PASS |
| C14 | `skyProfile()`: band ≥ 1.5 × top | (b) `horizon glows above the skyline` ✓ | `tests/e2e/nightCity.spec.ts:126` `expect(p.band).toBeGreaterThanOrEqual(1.5 * p.top)` | PASS |
| C15 | fog = dome horizon uniform = `#2a1a3e`; background `#03040c` | (b) `fog takes the horizon color` ✓ | `tests/e2e/nightCity.spec.ts:133` `expect(s.fog).toBe('#2a1a3e')`; `:134` `expect(s.horizon).toBe(s.fog)`, where `horizon` is `uHorizon` (`src/core/Game.ts:1211`); `:135` background `#03040c` | PASS |
| C16 | `skylineHeight`: 3600 samples in [0.02, 0.08], ≥ 60 distinct values, 2π-periodic, deterministic | (a) `skyline is a stepped silhouette` ✓ | `tests/unit/nightCityShaders.test.ts:56-57` range; `:59` `expect(new Set(values).size).toBeGreaterThanOrEqual(60)`; `:61` periodic; `:62` repeat call. Proven as worded, but it does not reach the dome (F5 survived; see Coverage) | PASS |
| C17 | dome at the camera ± 0.001 m; `reflectorSkipped` has `sky` | (b) `sky dome follows the camera outside the mirror` ✓ | `tests/e2e/nightCity.spec.ts:144` `expect(Math.abs(s.position[k] - s.camera[k]), k).toBeLessThanOrEqual(0.001)`; `:146` `expect(skipped).toContain('sky')`. F4 killed (x off by 7.23 m) | PASS |
| C18 | camera 35° up, 1 s of simulation apart: 0 pixels differ | (b) `sky is still` ✓ | `tests/e2e/nightCity.spec.ts:152` first call `toBe(-1)`; `:154` `toBe(0)`. Pose is set at `src/core/Game.ts:776-778` | PASS |
| C19 | tube coverage of each of the 8 glyphs in [0.15, 0.45] | (a) `sign glyphs cover part of the face` ✓ | `tests/unit/nightCityShaders.test.ts:68` `expect(GLYPH_PATTERNS).toBe(8)`; `:73` `toBeGreaterThanOrEqual(0.15)`; `:74` `toBeLessThanOrEqual(0.45)` | PASS |
| C20 | sign box depth 0.12 m; pattern in [0, 7] drawn from the seed with `mulberry32`, same across builds | (b) `signs are framed boxes with a glyph pattern` ✓ | `tests/e2e/nightCity.spec.ts:166` `expect(g.depth).toBeCloseTo(0.12, 6)`; `:168` `expect(sg.pattern).toBe(signPattern(sg.x, sg.z))`; `:169-170` range. "Same across builds" is shown as equality with the pure `signPattern` (`src/world/signGlyphs.ts:56-58`), not by two builds (precision note) | PASS |
| C21 | 4 sign materials, emissive ≥ 2, breathing in [2.0, 3.2] | (b) `neon emissive intensity at least 2` ✓, `neon signs flicker` ✓ | `tests/e2e/render.spec.ts:63` `expect(m.signEmissiveIntensities.length).toBe(4)`; `:64` `toBeGreaterThanOrEqual(2)`; `tests/e2e/visual.spec.ts:139` `a.length` 4; `:141-142` `[2.0, 3.2]` | PASS |
| C22 | `windowTint` 70/20/10 ± 1 %; facade shader uses 0.70/0.90, the same colors and its own hash | (a) `window tints come in three fixed colors` ✓ | `tests/unit/nightCityShaders.test.ts:87-89` `Math.abs(count/10000 - p) <= 0.01`; `:90` the hexes; `:93` `tintHash = windowHash(cellId + 7.7, vSeedF)`; `:94-95` `tintHash < 0.70 ?` and `< 0.90 ?`; `:101` color `vec3` text | PASS |
| C23 | stable-window proof and facade-glint proofs keep today's limits | (b) 5 tests ✓ | `tests/e2e/visual.spec.ts:358` `expect(still).toBe(0)`; `:359` `expect(moving).toBeLessThan(0.01)`; `:481` `<= 0.001`; `:496` `> 0.001`; `:506` `>= 1.2 * off.litMean`; `:581` `<= 0.0007` | PASS |
| C24 | race grid: `render.calls` ≤ 218 | (b) `draw calls within budget while racing` ✓ | `tests/e2e/race.spec.ts:329` `expect(...render.calls).toBeLessThanOrEqual(218)` | PASS |
| C25 | 5 poses: `render.calls` ≤ 220 | (b) `draw calls at most 220 across the world` ✓ | `tests/e2e/render.spec.ts:53` `expect(calls, name).toBeLessThanOrEqual(220)` | PASS |
| C26 | the new shaders do not read a clock; the light map is built once | (a) `nothing new reads the clock` ✓; (b) `lamp light map is built once` ✓ | `tests/unit/nightCityShaders.test.ts:119` `expect(text, name).not.toMatch(/\buTime\b\|uniform\s+float\s+time\b/)`; `:120` no `time` uniform key, over 6 shaders (`:111-117`); `tests/e2e/nightCity.spec.ts:80` same `uuid`; `:81` same `version` | PASS |
| C27 | `?quality=low`: 1 lamp mesh, sky in the scene, `uLampLight` on the ground, 0.12 m signs, no mirror | (b) `low quality keeps the night city` ✓ | `tests/e2e/nightCity.spec.ts:192` `toHaveLength(1)`; `:193` `sky.inScene` true; `:194` every material's `uLampLight` uuid = the texture's; `:195` depth 0.12; `:196` `expect(r.reflector.present).toBe(false)` | PASS |
| C28 | `lampLight.ts` is pure and in the purity list | (a) `pure modules do not import three or rapier` ✓ | `tests/unit/purity.test.ts:52` `'src/world/lampLight.ts'`; `:92` `toBe(41)`; `:96` `expect(FORBIDDEN.test(source), rel).toBe(false)`; `:98` `expect(forbiddenReach(file), rel).toBeNull()` | PASS |
| C29 | 4 ground materials read the same `DataTexture`: 1536², linear, no mipmap | (b) `ground materials share the lamp light map` ✓ | `tests/e2e/nightCity.spec.ts:67-68` 1536; `:69` `linear` true; `:70` `mipmaps` false; `:71` `expect(uuid, name).toBe(l.uuid)`. The probe always returns 4 fixed keys, with `null` when the uniform is missing (`src/core/Game.ts:1228-1233`), so an empty loop cannot pass | PASS |

**Level and sampling.** The pure rules (C1-C5, C12, C16, C19, C22) are tested at their own layer. The screen behaviours (C6, C9-C11, C14, C18) use pixel probes in the browser. The wiring (C7, C8, C15, C17, C27, C29) is read from `__game`.

C13, C21, C23 and C25 resolve to tests the feature did not edit: `git diff 489a5c8..HEAD -- tests/e2e/visual.spec.ts tests/e2e/render.spec.ts` is empty. That is correct for them, because their claims are "keep the limits". Those tests now exercise the new mirror shader and the new sign material.

**Precision notes.** These do not fail the feature on their own:
1. C4 pins AC 3's three properties but not door 2's literal falloff `max(0, 1 − (d/9)²)²`. A falloff of `1 − (d/9)²` (no square) would still pass C4.
2. C20 proves "the same across two builds" through determinism of the pure `signPattern`, not two builds.

**Swept.** Every row cites a check or says `n/a`. None cites an existing constraint, so no swept row has a code constraint to re-read.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| lamp parts (4) | `src/world/StreetLamps.ts:21-24`: post, arm, housing, lens (`aLens` = 1 only on the lens) | post: C1 (pure `y + 6`), C7. arm: C1 (pure 1.6 m), C7 width. lens: C1 (pure position), C8 (lens color attribute). housing: none | housing: C7 asserts only bbox width ≥ 1.6, which the post (radius 0.1, `:21`) and arm (0..1.6, `:22`) already give (1.7 m). Lens emits alone (`aLens`, `:24`, `:67`): no proof |
| `lampColor` cases (5) | `src/world/roads/roadMesh.ts:116-118` | downtown C3; avenue outside C3; highway outside C3 (F2 killed); hill outside C3, C8; street outside C3 | - |
| light-grid properties (4) | `src/world/lampLight.ts:28-64` | under the lens C4; zero at ≥ 9 m C4 (F1 killed); non-increasing C4; size and origin C5 | - |
| ground materials reading the light (4) | `src/world/CityScene.ts:245-248` `addLampLight` × 4 (road-downtown, road-outer, sidewalk, terrain) | all 4: C29, C27 (probe keys at `src/core/Game.ts:1228-1233`) | - |
| mirror modes (2) | `uBlur` > 0 / = 0 in `streakReflectorShader` | streak: C9, C11, C13. single sample: C10, C13 | - |
| streak distances (2) | C11 claim | 20 m: C9, C11. 60 m: C11 (F3 killed) | - |
| reflection guarantees (3) | AC 9 | no overlay, tint ≤ 1, Fresnel in [0, 1]: all C12 | - |
| residuals proofs kept (4) | residuals C1-C4 | all C13 | - |
| sky parts (4) | door 3 and `src/world/Environment.ts:74-113` | gradient and glow: C14. same-color fog: C15. follows the camera outside the mirror: C17 (F4 killed). silhouette: C16 (pure function only) | silhouette as drawn by the dome (`Environment.ts:103`): F5 removed it and every proof stayed green |
| window colors (3) | `src/world/windowTint.ts:6-8` | warm, cool, TV: C22 | - |
| glyph patterns (8) | `src/world/signGlyphs.ts:11` | C19, table-driven over all 8 | - |
| sign faces with tubes (2), plus the dark frame (swept; AC 16 names them and the artifact gave them no row) | `src/world/CityScene.ts:627` `vSignFace = step(0.5, abs(normal.z))`, `totalEmissiveRadiance *= tube * vSignFace`, frame `color '#101014'` (`:611`) | front: none. back: none. frame: none. C20 asserts only depth and pattern, C21 only `emissiveIntensity` | front face, back face, dark frame |
| budget (2 places) | C24/C25 claims | race grid C24; 5 world poses C25 | - |
| qualities (2) | `?quality` | high: C7-C25. low: C6, C27 | - |
| plan doors (3) | `plan.md` Landing | door 1: C3 (F2 killed). door 2: C4, C5, C28, C29. door 3: C15, C17, but the silhouette part is covered only by C16 | door 3 silhouette in the dome (same member as the sky row) |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Pure world rule | `roadMesh.ts` (`lampColor`, `lampHeadPosition`), `lampLight.ts`, `skyMath.ts`, `windowTint.ts`, `signGlyphs.ts` | vitest at its own layer, one case per table row or property | yes. C1, C3, C4, C5, C16, C19 and C22 give a case per row or property; F1 and F2 were killed |
| Shader (mirror, sky, lens, ground, facade, sign) | `CityScene.ts` (mirror, facade, sign), `Environment.ts` (sky), `StreetLamps.ts` (lens, ground) | unit test on the shader text plus a browser pixel probe, one case per visual behaviour | no - gap. Mirror (C12 + C9-C11, C13), facade (C22 + C23) and ground (C26 + C6) are met. Sky: the silhouette has neither a text proof nor a pixel proof, and F5 survived. Lens: C26 checks only for a clock and has no pixel probe; C8 reads the attribute, not pixels, and "only the lens glows" is unproven. Sign: C26 checks only for a clock and has no pixel probe; tubes on the front and back faces and the glyph lookup are unasserted |
| Scene wiring (`CityScene`, `Environment`, `Game`) | `CityScene.ts`, `Environment.ts`, `Game.ts` | e2e reading `__game`, one case per object or uniform | yes. C7, C8, C15, C17, C20, C27 and C29, with F4 killed |

## Faults injected

Scratch setup and cleanup:
- **Scratch.** I created it with `git worktree add .claude/worktrees/nc-verify HEAD` and gave it a `node_modules` junction made with PowerShell `New-Item -ItemType Junction`. Each fault was applied with `sed` and reverted with `git checkout -- <file>`. The scratch porcelain was empty at the end.
- **Cleanup.** Before `git worktree remove`, I deleted the junction with `(Get-Item ...).Delete()`. Afterwards `node_modules/vitest/package.json` and `node_modules/three/package.json` were still present in the real tree, and `git worktree list` no longer showed `nc-verify`.
- **Real tree.** At dispatch its porcelain was `?? .specs/features/play-fixes/checks.md`. At 20:46:44, before my worktree existed, another agent committed that file on branch `play-fixes` (3accd6a, in `.claude/worktrees/play-fixes`), and it left the main tree. From then on the real tree's porcelain was empty, and it was still empty after cleanup. None of my commands touched the real tree.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1: falloff loses its clamp, `return t > 0 ? t * t : 0;` -> `return t * t;` (light beyond 9 m). C4 failed: "expected 50623 to be +0" | `src/world/lampLight.ts:30` | yes |
| F2: door 1 drops the ring, `\|\| road.kind === 'highway'` removed. C3 failed: "highway (ring) outside downtown: expected '#ff9d4a' to be '#dce6ff'" | `src/world/roads/roadMesh.ts:118` | yes |
| F3: no streak growth, `MIRROR_STREAK_GROW = 0.06` -> `0`. C12 failed ("expected 6 to be greater than 6"). C11 failed in the browser: "Expected: > 5, Received: 5". C9 stayed green, as expected | `src/world/mirrorMath.ts:13` | yes |
| F4: dome no longer follows the camera, the `this.sky.position.copy(this.chase.camera.position)` line removed. C17 failed: x "Expected: <= 0.001, Received: 7.2269" | `src/core/Game.ts:372` | yes |
| F5: silhouette not drawn, the `if (e < uSkyline[idx]) sky = mix(...)` line removed from the dome shader. C16 and C26 unit passed (2/2). E2E C14, C15, C17, C18 and C27 passed (5/5) | `src/world/Environment.ts:103` | no |

## Gate

- One vitest invocation over the 11 named unit proofs: 11 passed, 0 failed (11 unnamed tests were skipped by the filter)
- One `npx playwright test` run over the 27 named e2e proofs (`E2E_PORT=5193`): 27 passed, 0 failed (11.0m)
- `python C:/Users/arthu/.claude/skills/tlc-spec-lean/scripts/validate_verification.py night-city`: exit 1, "verdict is FAIL - route the ranked gaps back as fixes, then re-verify". That is the expected exit for a FAIL report; no row contradicts the verdict

## Ranked gaps

1. **Surviving mutant F5 (sky silhouette), AC 13 and door 3.** C16 proves only `skylineHeight`, at `tests/unit/nightCityShaders.test.ts:53-63`. No proof reads `uSkyline` or the dome shader text, and no pixel probe sees the silhouette (`src/world/Environment.ts:103`).
2. **Shader Test policy row unmet for the lamp lens and the neon sign.** No pixel probe exists for either, and C26 (`tests/unit/nightCityShaders.test.ts:119-120`) checks only for a clock. The sign's front and back tubes and dark frame (AC 16) are an unproven set: C20 and C21 assert only depth, pattern and `emissiveIntensity`. The lens-only emission (`src/world/StreetLamps.ts:24`, `:67`) is unproven.
3. **Lamp housing unproven, C7.** `tests/e2e/world.spec.ts:220` `width >= 1.6` passes on post plus arm alone (1.7 m), so the housing and lens could be missing.
4. **Precision (not failing).** Door 2's squared falloff is not pinned by C4 (`tests/unit/lampLight.test.ts:68-109`).
