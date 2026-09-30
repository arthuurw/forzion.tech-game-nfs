# night-city verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 489a5c8..796abac
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Every one of the 33 checks is proven at 796abac. All named proofs ran green at HEAD: 15 unit and 30 e2e. Each check has a located assertion.

The round-1 gaps are closed:
- **F5 is now killed.** It removes the skyline silhouette line from the dome shader. The new C30 unit proof fails on the shader text. The C30 pixel probe also fails, at `degrau 0`, with 0.1177 against a limit of ≤ 0.0512.
- **The "Shader" Test policy row is met.** The sky, the lamp lens and the sign each have a shader-text unit proof and a browser pixel probe.
- **The lamp housing and the three sign-face members are proven.** C31 covers the housing, and C32 covers the front tubes, back tubes and dark frame.
- **The squared falloff is pinned by C33.** F9 drops the square: C33 fails on it, while C4 stays green, as round 1 predicted.

I injected five faults on the new surfaces. All five were killed, and the three pixel probes were each made to fail once.

Scope of this round:
- **Fix diff.** `8a7675f..796abac`, made of aa72f4e (the round-1 report) and 796abac (the fix). The fix touches `src/core/Game.ts`, with a new DEV probe `render.isolatedLum` and more fields in the `world.signs` probe. It also touches `tests/e2e/nightCity.spec.ts`, `tests/unit/nightCityShaders.test.ts`, `tests/unit/lampLight.test.ts` and `checks.md`.
- **Unchanged since 8a7675f.** No file under `src/world/`, and none of `world.spec.ts`, `visual.spec.ts`, `render.spec.ts`, `race.spec.ts`, `purity.test.ts` or `roads.test.ts`: `git diff 8a7675f..796abac --stat` over those paths is empty.
- **Citation refresh.** Citations into the touched files are refreshed. Citations into the untouched files are carried from 8a7675f, and the HEAD run log shows each of those tests at its original line.

## Binding sources

Carried from 8a7675f. Step 1 does not run under `standard` (it runs only under `ui`). The fix did not touch the interface, and the plan marks no design or contract as binding.

## Checks

Verified at 796abac. I ran the proofs myself at HEAD, in two invocations:

- **(a) Unit.** `npx vitest run tests/unit/lampLight.test.ts tests/unit/roads.test.ts tests/unit/nightCityShaders.test.ts tests/unit/purity.test.ts -t "<15-way alternation of every named unit proof>" --reporter=verbose` exited 0 with "Tests 15 passed | 11 skipped (26)". Each of the 15 names appears individually with `✓`, including the 4 new ones:
  - `dome shader draws the skyline table`
  - `lamp geometry has a housing and only the lens glows`
  - `sign shader lights tubes only on the front and back faces`
  - `lamp falloff is squared`
- **(b) E2E.** `E2E_PORT=5193 npx playwright test tests/e2e/nightCity.spec.ts tests/e2e/world.spec.ts tests/e2e/visual.spec.ts tests/e2e/render.spec.ts tests/e2e/race.spec.ts --reporter=list -g "<30-way alternation of every named e2e proof>"` exited 0 with "30 passed (14.0m)". Each of the 30 tests is listed with `✓`, including the 3 new ones:
  - `nightCity.spec.ts:55` `only the lamp lens glows`
  - `:191` `dome draws the skyline silhouette`
  - `:225` `sign tubes glow on both faces and the frame stays dark`

The logs are in the session scratchpad, under `verifier-nc2/`: `unit-head.log` and `e2e-head.log`. Every named test exists: the grep hits and the listed lines are the file:line values cited below.

The fix edited `nightCityShaders.test.ts`, `lampLight.test.ts` and `nightCity.spec.ts`, so their line numbers are refreshed.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | lens 6 m above the base and 1.6 ± 0.05 m closer to the road axis, for every seed-1337 lamp | (a) `lamp head hangs over the road` ✓ | `tests/unit/lampLight.test.ts:50` `expect(lamps.length).toBeGreaterThan(100)`; `:51` `expect(bad).toEqual([])` over the 6 m and 1.6 ± 0.05 m conditions (`:46-48`) | PASS |
| C2 | `heading` = atan2 of the segment ± 1e-6 | (a) `lamp posts every 40 m on both sides` ✓ | `tests/unit/roads.test.ts:412` angle difference `<= 1e-6`; `:414` `expect(onSegment, ...).toBe(true)` (file untouched, carried from 8a7675f) | PASS |
| C3 | `lampColor` 5-row table, LED `#dce6ff` / sodium `#ff9d4a` | (a) `lamp color by district` ✓ | `tests/unit/lampLight.test.ts:63` `expect(lampColor({ x, z }, { kind }), name).toBe(color)` over 5 rows; `:64` `toBe('#dce6ff')`; `:65` `toBe('#ff9d4a')` | PASS |
| C4 | ≥ 0.9 × color under each lens; 0 at ≥ 9 m; never rises going out | (a) `lamp light grid falls off from each head` ✓ | `tests/unit/lampLight.test.ts:78` `expect(dim).toEqual([])`; `:95` `expect(lit).toBe(0)`; `:106` `expect(cur, ...).toBeLessThanOrEqual(prev)`; `:109` `expect(prev).toBe(0)` | PASS |
| C5 | 1536² RGBA grid, 2 m cells, cell 0 at −1535 | (a) `lamp light grid covers the world` ✓ | `tests/unit/lampLight.test.ts:114` `grid.size` 1536; `:115` `cell` 2; `:116` `data.length` 1536·1536·4; `:117` `expect(lampLightCellCenter(0)).toBe(-1535)` | PASS |
| C6 | `?quality=low`: under the lens ≥ 1.3 × the asphalt 20 m ahead | (b) `street light pools on the asphalt` ✓ | `tests/e2e/nightCity.spec.ts:24` `open(page, '?quality=low')`; `:51` `expect(under!).toBeGreaterThanOrEqual(1.3 * between!)` | PASS |
| C7 | 1 `InstancedMesh`, `count` = lamps, box ≥ 1.6 m wide | (b) `lamp posts are one instanced mesh` ✓ | `tests/e2e/world.spec.ts:217` `meshes.length` 1; `:218` instanced; `:219` `count`; `:220` `width >= 1.6` (carried from 8a7675f; the housing is now proven by C31) | PASS |
| C8 | instance color `#dce6ff` downtown, `#ff9d4a` hill, read in the browser | (b) `lamp colors in the browser` ✓ | `tests/e2e/nightCity.spec.ts:100` `expect(r.downtown).toBe('#dce6ff')`; `:101` `expect(r.hill).toBe('#ff9d4a')`; the probe reads `aLampColor` at `src/core/Game.ts:1248` | PASS |
| C9 | `mirrorStreak(20)`: h ≥ 3 × w | (b) `reflections are vertical streaks` ✓ | `tests/e2e/nightCity.spec.ts:136` `w > 0`; `:137` `expect(s.h).toBeGreaterThanOrEqual(3 * s.w)` | PASS |
| C10 | `mirrorBlur: false`: h ≤ 1.5 × w | (b) `probe sees a sharp reflection without streaks` ✓ | `tests/e2e/nightCity.spec.ts:146` `expect(s.h).toBeLessThanOrEqual(1.5 * s.w)` | PASS |
| C11 | h/srcH at 60 m > h/srcH at 20 m | (b) `streaks grow with distance` ✓ | `tests/e2e/nightCity.spec.ts:157` `expect(far.h / far.srcH).toBeGreaterThan(near.h / near.srcH)` | PASS |
| C12 | no `blendOverlay(`; tint in (0, 1]; Fresnel in [0, 1], non-increasing; constants interpolated | (a) `mirror never adds light` ✓ | `tests/unit/nightCityShaders.test.ts:31` `not.toContain('blendOverlay(')`; `:33-34` tint range; `:36-38` interpolated tint, `dist * GROW` and Fresnel text; `:42-43` Fresnel range; `:45` non-increasing | PASS |
| C13 | residuals limits kept | (b) 4 residuals tests ✓ (`visual.spec.ts:522`, `:533`, `:542`, `:558`) | `tests/e2e/visual.spec.ts:528` `expect(still).toBe(0)`; `:529` `<= 0.001`; `:538` `>= 0.003`; `:550` `toEqual([320, 180])`; `:564` `>= 0.6 * sharp` (carried from 8a7675f) | PASS |
| C14 | `skyProfile()` band ≥ 1.5 × top | (b) `horizon glows above the skyline` ✓ | `tests/e2e/nightCity.spec.ts:167` `expect(p.band).toBeGreaterThanOrEqual(1.5 * p.top)` | PASS |
| C15 | fog = dome `uHorizon` = `#2a1a3e`; background `#03040c` | (b) `fog takes the horizon color` ✓ | `tests/e2e/nightCity.spec.ts:174` `expect(s.fog).toBe('#2a1a3e')`; `:175` `expect(s.horizon).toBe(s.fog)` (`uHorizon` read at `src/core/Game.ts:1273`); `:176` `toBe('#03040c')` | PASS |
| C16 | `skylineHeight`: 3600 samples in [0.02, 0.08], ≥ 60 distinct, periodic, deterministic | (a) `skyline is a stepped silhouette` ✓ | `tests/unit/nightCityShaders.test.ts:57-58` range; `:60` `expect(new Set(values).size).toBeGreaterThanOrEqual(60)`; `:62` periodic; `:63` repeat call | PASS |
| C17 | dome at the camera ± 0.001 m; `reflectorSkipped` has `sky` | (b) `sky dome follows the camera outside the mirror` ✓ | `tests/e2e/nightCity.spec.ts:185` `expect(Math.abs(s.position[k] - s.camera[k]), k).toBeLessThanOrEqual(0.001)`; `:187` `expect(skipped).toContain('sky')` | PASS |
| C18 | camera 35° up, 1 s apart: 0 pixels differ | (b) `sky is still` ✓ | `tests/e2e/nightCity.spec.ts:217` first call `toBe(-1)`; `:219` `toBe(0)` | PASS |
| C19 | tube coverage of each of the 8 glyphs in [0.15, 0.45] | (a) `sign glyphs cover part of the face` ✓ | `tests/unit/nightCityShaders.test.ts:69` `GLYPH_PATTERNS` 8; `:74` `>= 0.15`; `:75` `<= 0.45` | PASS |
| C20 | sign box depth 0.12 m; pattern in [0, 7] from the seed, same across builds | (b) `signs are framed boxes with a glyph pattern` ✓ | `tests/e2e/nightCity.spec.ts:269` `expect(g.depth).toBeCloseTo(0.12, 6)`; `:271` `expect(sg.pattern).toBe(signPattern(sg.x, sg.z))`; `:272-273` range | PASS |
| C21 | 4 sign materials, emissive ≥ 2, breathing in [2.0, 3.2] | (b) `neon emissive intensity at least 2` ✓ (`render.spec.ts:58`), `neon signs flicker` ✓ (`visual.spec.ts:134`) | `tests/e2e/render.spec.ts:63` length 4; `:64` `toBeGreaterThanOrEqual(2)`; `tests/e2e/visual.spec.ts:141-142` `[2.0, 3.2]` (carried from 8a7675f) | PASS |
| C22 | `windowTint` 70/20/10 ± 1 %; facade shader uses 0.70/0.90, the same colors, its own hash | (a) `window tints come in three fixed colors` ✓ | `tests/unit/nightCityShaders.test.ts:88-90` `Math.abs(count/10_000 - p) <= 0.01`; `:91` hexes; `:94` `tintHash = windowHash(cellId + 7.7, vSeedF)`; `:95-96` `< 0.70 ?`, `< 0.90 ?`; `:102` color text | PASS |
| C23 | stable-window and facade-glint limits kept | (b) 5 tests ✓ (`visual.spec.ts:353`, `:475`, `:486`, `:500`, `:568`) | `tests/e2e/visual.spec.ts:358` `toBe(0)`; `:359` `< 0.01`; `:481` `<= 0.001`; `:496` `> 0.001`; `:506` `>= 1.2 * off.litMean`; `:581` `<= 0.0007` (carried from 8a7675f) | PASS |
| C24 | race grid `render.calls` ≤ 218 | (b) `draw calls within budget while racing` ✓ (`race.spec.ts:324`) | `tests/e2e/race.spec.ts:329` `toBeLessThanOrEqual(218)` (carried from 8a7675f) | PASS |
| C25 | 5 poses `render.calls` ≤ 220 | (b) `draw calls at most 220 across the world` ✓ (`render.spec.ts:12`) | `tests/e2e/render.spec.ts:53` `expect(calls, name).toBeLessThanOrEqual(220)` (carried from 8a7675f) | PASS |
| C26 | the new shaders read no clock; the light map is built once | (a) `nothing new reads the clock` ✓; (b) `lamp light map is built once` ✓ | `tests/unit/nightCityShaders.test.ts:120` `expect(text, name).not.toMatch(...)`, a regex over `uTime` or a `uniform float time` declaration; `:121` no `time` uniform key; `tests/e2e/nightCity.spec.ts:121` same `uuid`; `:122` same `version` | PASS |
| C27 | `?quality=low`: 1 lamp mesh, sky in scene, `uLampLight`, 0.12 m signs, no mirror | (b) `low quality keeps the night city` ✓ | `tests/e2e/nightCity.spec.ts:284` `?quality=low`; `:295` `toHaveLength(1)`; `:296` `sky.inScene` true; `:297` uuid match; `:298` `toBeCloseTo(0.12, 6)`; `:299` `expect(r.reflector.present).toBe(false)` | PASS |
| C28 | `lampLight.ts` is pure and in the purity list | (a) `pure modules do not import three or rapier` ✓ | `tests/unit/purity.test.ts:52` `'src/world/lampLight.ts'`; `:96` `expect(FORBIDDEN.test(source), rel).toBe(false)`; `:98` `expect(forbiddenReach(file), rel).toBeNull()` (carried from 8a7675f) | PASS |
| C29 | 4 ground materials share one `DataTexture`, 1536², linear, no mipmap | (b) `ground materials share the lamp light map` ✓ | `tests/e2e/nightCity.spec.ts:108-109` 1536; `:110` `linear` true; `:111` `mipmaps` false; `:112` `expect(uuid, name).toBe(l.uuid)`. The 4 fixed keys are at `src/core/Game.ts:1290-1295` | PASS |
| C30 | dome draws `skylineHeight`: `uSkyline` = `SKYLINE_TABLE`, `fract((atan(d.x, d.z) + PI) / (2π))` index, `SKY_SILHOUETTE` below; pixel: at 12 azimuths, 0.006 below ≤ 0.5 × 0.01 above | (a) `dome shader draws the skyline table` ✓; (b) `dome draws the skyline silhouette` ✓ | `tests/unit/nightCityShaders.test.ts:128` `expect(sky.uniforms.uSkyline!.value).toEqual([...SKYLINE_TABLE])`; `:130` `toContain('float turn = fract((atan(d.x, d.z) + PI) / (2.0 * PI));')`; `:133` `toContain('if (e < uSkyline[idx]) sky = mix(vec3( <SKY_SILHOUETTE> ), uHorizon')`; `:135` table = `skylineHeight` per step. `tests/e2e/nightCity.spec.ts:208` `expect(below!, ...).toBeLessThanOrEqual(0.5 * above!)`; `:211` `expect(dark).toBe(12)`. F5 killed on both | PASS |
| C31 | post (6-sided cylinder) + 3 boxes; exactly 24 `aLens` = 1 vertices at the arm tip, 5.82 ± 0.01 m; housing (0.6 m) between 5.83 and 5.97 m; fragment emits only `vLens · vLampColor`; pixel: lens ≥ 0.5, post and arm ≤ 0.05 | (a) `lamp geometry has a housing and only the lens glows` ✓; (b) `only the lamp lens glows` ✓ | `tests/unit/nightCityShaders.test.ts:147` `expect(pos.count).toBe(cylinder + 3 * 24)`; `:156-157` lens x and y bounds; `:161-162` housing y in [5.83, 5.97]; `:165` `expect(lensVerts).toBe(24)`; `:166` `housingVerts > 0`; `:168` `toContain('totalEmissiveRadiance *= vLens * vLampColor;')`. `tests/e2e/nightCity.spec.ts:81` `expect(lens!).toBeGreaterThanOrEqual(0.5)`; `:82` `expect(post!).toBeLessThanOrEqual(0.05)`; `:83` `expect(arm!).toBeLessThanOrEqual(0.05)`. F6 and F8 killed | PASS |
| C32 | sign color `#101014`, `vSignFace = step(0.5, abs(normal.z))`, emits only `tube · vSignFace`; pixel on a ≥ 2 × 1 m sign: front and back max ≥ 0.5 over 9 × 5 points, side ≤ 0.05 at 15 points | (a) `sign shader lights tubes only on the front and back faces` ✓; (b) `sign tubes glow on both faces and the frame stays dark` ✓ | `tests/unit/nightCityShaders.test.ts:174` `toBe('#101014')`; `:176` `toContain('vSignFace = step(0.5, abs(normal.z));')`; `:177` glyph `texture2D` lookup by `vPattern`; `:178` `toContain('totalEmissiveRadiance *= tube * vSignFace;')`. `tests/e2e/nightCity.spec.ts:251` `expect(await face(1)).toBeGreaterThanOrEqual(0.5)`; `:252` `face(-1)` same; `:258` all 15 side points on screen; `:259` `expect(Math.max(...side...)).toBeLessThanOrEqual(0.05)`. F7 killed on both | PASS |
| C33 | `lampFalloff(d)` = `(1 − (d/9)²)²` ± 1e-12 at 7 distances; 0.5625 at 4.5; 0 at 9 and 12 | (a) `lamp falloff is squared` ✓ | `tests/unit/lampLight.test.ts:124` radius 9; `:125` `expect(lampFalloff(d), ...).toBeCloseTo((1 - (d / 9) ** 2) ** 2, 12)` over `{0, 1, 2.25, 4.5, 6, 8, 8.99}`; `:126` `toBeCloseTo(0.5625, 12)`; `:127-128` `toBe(0)`. F9 killed | PASS |

**Level and sampling** (verified at 796abac). The new checks sit at both layers the Shader row requires:
- **Text layer.** The shader text is asserted in vitest: the silhouette in C30, the lens gate in C31 and the face gate in C32. `lampFalloff` is a pure rule, tested at its own layer in C33.
- **Browser layer.** Each shader behaviour is also measured in the browser by `render.isolatedLum`: silhouette dark (C30), lens lit and body dark (C31), faces lit and side dark (C32). The probe renders one frame of only the named objects, with no post-processing and no lights, over black (`src/core/Game.ts:877-931`).

The probe's max-in-window readout makes the "≤ 0.05" assertions strict: a single glowing pixel near a sampled point fails them. F6 and F7 confirm this (0.952 and 0.655 received).

**Precision notes.**
1. Round-1 note 1 (C4 did not pin the squared falloff) is resolved by C33.
2. Round-1 note 2 is carried: C20's "the same across two builds" is shown through the determinism of the pure `signPattern`, not by two builds. That is a note on wording and does not fail the feature.
3. New, also not failing: C32 proves the dark frame on the box's side faces (`:259`) and through the `#101014` base color (`:174`). The dark area between the tubes on the front face is proven only by the `tube * vSignFace` text (`:178`), not by a pixel probe. C32's own wording limits the pixel claim to the side, so this is consistent with the check.

**Swept** (carried from 8a7675f). Every row cites a check or says `n/a`, and none cites an existing constraint. The fix added no swept row.

## Coverage

Rows the fix touched are verified at 796abac; the rest are carried from 8a7675f. The source files behind every carried row are unchanged since 8a7675f.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| lamp parts (4) - verified at 796abac | `src/world/StreetLamps.ts:20-24`: cylinder post (6 sides), arm box, housing box 0.6 × 0.14 × 0.3 at 5.9 m, lens box 0.5 × 0.02 × 0.22 at 5.82 m with `aLens` = 1; emission gated at `:67` | post: C1, C7, C31 (vertex count `:147`, pixel ≤ 0.05 `:82`). arm: C1, C7, C31 (count, pixel ≤ 0.05 `:83`). housing: C31 (`:161-162`, `:166`; F8 killed, count 88 vs 112). lens: C1, C8, C31 (24 verts `:165`, pixel ≥ 0.5 `:81`; F6 killed) | - |
| `lampColor` cases (5) - carried from 8a7675f | `src/world/roads/roadMesh.ts:116-118` | downtown, avenue outside, highway outside, hill outside, street outside: C3 (hill also C8) | - |
| light-grid properties (5) - verified at 796abac | `src/world/lampLight.ts:28-64` | under the lens C4. zero at ≥ 9 m: C4, C33 (`:127-128`). non-increasing C4. squared falloff C33 (F9 killed, while C4 stayed green). size and origin C5 | - |
| ground materials reading the light (4) - carried from 8a7675f | `src/world/CityScene.ts:245-248` | road-downtown, road-outer, sidewalk, terrain: C29, C27 (probe keys at `src/core/Game.ts:1290-1295`) | - |
| mirror modes (2) - carried from 8a7675f | `uBlur` > 0 / = 0 | streak C9, C11, C13. single sample C10, C13 | - |
| streak distances (2) - carried from 8a7675f | C11 | 20 m C9, C11. 60 m C11 | - |
| reflection guarantees (3) - carried from 8a7675f | AC 9 | no overlay, tint ≤ 1, Fresnel in [0, 1]: C12 | - |
| residuals proofs kept (4) - carried from 8a7675f | residuals C1-C4 | all C13 | - |
| sky parts (4) - verified at 796abac | door 3 and `src/world/Environment.ts:74-113` | gradient and glow C14. same-color fog C15. follows the camera C17. silhouette as drawn: C30 (`uSkyline` at `:82`, index at `:99-100`, paint at `:103`), plus C16 for the pure function. F5 killed by both C30 proofs | - |
| sign faces (3) - verified at 796abac | `src/world/CityScene.ts:611` color `#101014`, `:627` `vSignFace`, `:636-637` `tube * vSignFace` | front tubes C32 (`:251`). back tubes C32 (`:252`). dark frame C32 (`:174`, side `:259`). F7 killed (side read 0.655) | - |
| window colors (3) - carried from 8a7675f | `src/world/windowTint.ts:6-8` | warm, cool, TV: C22 | - |
| glyph patterns (8) - carried from 8a7675f | `src/world/signGlyphs.ts:11` | C19, table-driven over all 8 | - |
| budget (2 places) - carried from 8a7675f | C24/C25 | race grid C24; 5 poses C25 | - |
| qualities (2) - carried from 8a7675f | `?quality` | high C7-C25, C30-C32; low C6, C27 | - |
| plan doors (3) - verified at 796abac | `plan.md` Landing | door 1 C3. door 2 C4, C5, C28, C29, C33. door 3 C15, C17, C30 (silhouette in the dome) | - |

The fix added only DEV probe code: `render.isolatedLum`, and the `world.signs` fields `y`, `width`, `height` and `rotationY`. It added no game branch, so no set gains a member. I swept `checks.md` and `plan.md` again for sets the fix touches, and none lacks a row.

## Test policy rows

The Shader row is re-judged at 796abac. The pure-rule row is re-judged because the fix added a case (C33) for `lampLight.ts`. The scene-wiring row is carried from 8a7675f.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Pure world rule | `roadMesh.ts`, `lampLight.ts`, `skyMath.ts`, `windowTint.ts`, `signGlyphs.ts` | vitest at its own layer, one case per table row or property | yes. C1, C3, C4, C5, C16, C19, C22, plus C33 for the falloff formula; F1, F2 (round 1) and F9 killed |
| Shader (mirror, sky, lens, ground, facade, sign) | `CityScene.ts`, `Environment.ts`, `StreetLamps.ts` | unit test on the shader text plus a browser pixel probe, one case per visual behaviour | yes. Mirror: C12 + C9-C11, C13. Facade: C22 + C23. Ground: C26 + C6. Sky: C30 text + C30 pixel, C26 + C14, C18 (F5 killed on both layers). Lens: C31 text + C31 pixel (F6 killed on both). Sign: C32 text + C32 pixel, C26 (F7 killed on both) |
| Scene wiring (`CityScene`, `Environment`, `Game`) | `CityScene.ts`, `Environment.ts`, `Game.ts` | e2e reading `__game`, one case per object or uniform | yes. C7, C8, C15, C17, C20, C27, C29 (carried from 8a7675f). The fix changed only DEV probes in `Game.ts` |

## Faults injected

Verified at 796abac. This round re-injects F5 and faults each surface the fix created. Round-1 faults F1-F4 were killed at 8a7675f. They are carried, because the fix did not touch their source.

Scratch setup and cleanup:
- **Real tree before.** `git status --porcelain` was empty, saved as `verifier-nc2/porcelain-before.txt`.
- **Scratch.** I created it with `git worktree add .claude/worktrees/nc-verify2 HEAD`, plus a `node_modules` junction made with PowerShell `New-Item -ItemType Junction`.
- **Unit faults.** I applied each fault with `sed`, ran the 7 relevant unit proofs in one vitest call, and reverted with `git checkout -- <file>`.
- **Pixel faults.** I applied F5, F6 and F7 together for a single playwright run of the 3 pixel probes (`E2E_PORT=5193`, log `verifier-nc2/e2e-F5F6F7.log`). This is valid because `isolatedLum` renders only the named object (`sky`, `street-lamps`, `neon-signs`), so each probe sees only its own fault.
- **Cleanup.** The scratch porcelain was empty after the reverts. I deleted the junction with `(Get-Item ...).Delete()` before `git worktree remove`. `node_modules/three` and `node_modules/vitest` are still present in the real tree, and `git worktree list` no longer shows `nc-verify2`.
- **Real tree after.** The porcelain was empty, identical to the baseline, and HEAD was still 796abac. None of my commands wrote to the real tree except this report.

| Mutation | Location | Killed |
| --- | --- | --- |
| F5 (re-injected): silhouette line removed from the dome shader. C30 unit failed ("expected ... to contain 'if (e < uSkyline[idx]) sky = mix(vec3…'"). C30 e2e failed at `degrau 0`, "Expected: <= 0.0512, Received: 0.1177" (`nightCity.spec.ts:208`). C16 and C26 stayed green | `src/world/Environment.ts:103` | yes |
| F6: lens emission ungated, `totalEmissiveRadiance *= vLens * vLampColor;` -> `*= vLampColor;` (the whole lamp glows). C31 unit failed on the text (`:168`). C31 e2e failed: post "Expected: <= 0.05, Received: 0.9524" (`nightCity.spec.ts:82`) | `src/world/StreetLamps.ts:67` | yes |
| F7: sign emission ungated by face, `*= tube * vSignFace;` -> `*= tube;` (the sides glow). C32 unit failed on the text (`:178`). C32 e2e failed: side "Expected: <= 0.05, Received: 0.6546" (`nightCity.spec.ts:259`) | `src/world/CityScene.ts:637` | yes |
| F8: housing removed from the lamp geometry (the `BoxGeometry(0.6, 0.14, 0.3)` part deleted). C31 unit failed: "expected 88 to be 112" (`nightCityShaders.test.ts:147`) | `src/world/StreetLamps.ts:23` | yes |
| F9: falloff not squared, `return t > 0 ? t * t : 0;` -> `return t > 0 ? t : 0;`. C33 failed: "1 m: expected 0.98765 to be close to 0.97546" (`lampLight.test.ts:125`). C4 stayed green, confirming the round-1 precision note that C33 now closes | `src/world/lampLight.ts:30` | yes |

## Gate

- One vitest invocation over the 15 named unit proofs: 15 passed, 0 failed (11 unnamed tests skipped by the filter)
- One `npx playwright test` run over the 30 named e2e proofs (`E2E_PORT=5193`): 30 passed, 0 failed (14.0m)
- `python C:/Users/arthu/.claude/skills/tlc-spec-lean/scripts/validate_verification.py night-city`: exit 0 on this report. The first run exited 1 on a report-format problem, not a finding: the C26 evidence quoted a regex with an escaped `|`, which the gate's table parser split into a false Result cell. I reworded that cell without the pipe
