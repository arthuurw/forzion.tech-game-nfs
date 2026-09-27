# residuals verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: main (08a97f0)..residuals (6f6379d)
**Round**: 1 - full, verified at 6f6379d
**Verifier**: independent sub-agent (author != verifier). Fresh sub-agent; author is the main session (Claude, author)

Escopo: os 11 checks de `checks.md`, todos. O `.specs/features/races/plan.md` que entrou em 1211710 é de outra feature (não construída) e ficou fora. C1, C2, C5 e o local das constantes da C8 foram renegociados com o usuário no build (`checks.md` `## Handoff`, `plan.md` AC 1 e AC 4); foram julgados pelo texto aprovado atual.

## Binding sources

Profile `standard`: o passo 1 não roda. O plano não marca nenhuma fonte como binding (`## Sources` lista só `.specs/STATE.md` e `visual-upgrade/verification.md:25` como origem dos números).

## Checks

Provas rodadas por mim em 6f6379d. Playwright numa invocação só (`E2E_PORT=5193 npx playwright test tests/e2e/visual.spec.ts tests/e2e/drive.spec.ts tests/e2e/interiors.spec.ts -g "<11 nomes>"`), exit 0, `11 passed (7.8m)`, cada nome listado com ✓. Vitest numa invocação (`npx vitest run tests/unit/shaderConstants.test.ts -t "<3 nomes>"`), `3 passed (3)`, cada nome com ✓.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | espelho com blur, câmera andando: `shimmer(mirror) − shimmer(sem espelho)` ≤ 0.001; parada = 0 | ✓ `visual.spec.ts:524` street reflection stays stable while the camera moves (41.4s) | `tests/e2e/visual.spec.ts:531` - `expect(moving - noMirror).toBeLessThanOrEqual(0.001)`; `tests/e2e/visual.spec.ts:530` - `expect(still).toBe(0)` | PASS |
| C2 | sonda sensível: sem blur, diferença ≥ 0.003 | ✓ `visual.spec.ts:535` probe detects reflection shimmer without blur (35.5s) | `tests/e2e/visual.spec.ts:540` - `expect(sharp - noMirror).toBeGreaterThanOrEqual(0.003)` | PASS |
| C3 | alvo do espelho `floor(w·0.5) × floor(h·0.5)` = 320×180 | ✓ `visual.spec.ts:58` reflector present only in high quality (21.7s); ✓ `visual.spec.ts:544` reflection blur keeps the half-resolution target (4.8s) | `tests/e2e/visual.spec.ts:66` - `expect(high.r.size).toEqual([Math.floor(high.w * 0.5), Math.floor(high.h * 0.5)])`; `tests/e2e/visual.spec.ts:552-553` - `expect(size).toEqual([320, 180])`, `expect(s.r.size).toEqual(size)` | PASS |
| C4 | ganho de brilho com blur ≥ 0.6 × ganho sem blur | ✓ `visual.spec.ts:560` blurred reflection keeps most of its brightness (29.6s) | `tests/e2e/visual.spec.ts:566` - `expect(blurred).toBeGreaterThanOrEqual(0.6 * sharp)`; `:565` - `expect(sharp).toBeGreaterThan(0)` | PASS |
| C5 | tijolo (tipo 2): `flicker(spec) − flicker(flat)` ≤ 0.0007 | ✓ `visual.spec.ts:570` brick facade glint has margin (35.0s) | `tests/e2e/visual.spec.ts:583` - `expect(spec.flicker - flat.flicker).toBeLessThanOrEqual(0.0007)` (probe com tipo `2`, `headlight: true, specularAA: true`, `:576`) | PASS |
| C6 | tipos 0-3: C1 ≤ 0.0010 e C3 `litMean` ≥ 1.2× | ✓ `visual.spec.ts:477` headlight adds no facade glint (1.2m); ✓ `visual.spec.ts:502` headlight still lights the facade (1.2m) | `tests/e2e/visual.spec.ts:483` - `expect(spec.flicker - flat.flicker, ...).toBeLessThanOrEqual(0.001)`; `tests/e2e/visual.spec.ts:508` - `expect(on.litMean, ...).toBeGreaterThanOrEqual(1.2 * off.litMean)`; laço sobre `FACADE_TYPES = [0, 1, 2, 3]` (`:467`) | PASS |
| C7 | segurando S 5 s: `#gear` = `R` e `car.gear` = -1, já de ré ≤ -5 km/h | ✓ `drive.spec.ts:39` reverse drives backward up to 30 kmh (44.3s) | `tests/e2e/drive.spec.ts:51` - `expect(gear).toEqual({ label: 'R', value: -1 })`; `:49` - `expect(speed).toBeLessThanOrEqual(-5)` | PASS |
| C8 | 6 constantes do vagalume em `interiorMotion.ts` (`FIREFLY_DRIFT`); shader tem exatamente elas + 2π; nenhum outro literal | ✓ `shaderConstants.test.ts` firefly shader reads the shared constants | `tests/unit/shaderConstants.test.ts:29` - `expect(FIREFLY_DRIFT).toEqual({ x: { amp: 1.0, freq: 0.05 }, y: { amp: 0.4, freq: 0.06 }, z: { amp: 1.0, freq: 0.045 } })`; `:46` - `expect(found).toEqual(expected)` (6 constantes + 3×2π); `:48` - `expect(templateSourceLiterals('FIREFLY_DRIFT_GLSL')).toEqual([TWO_PI, TWO_PI, TWO_PI])` | PASS |
| C9 | sonda usa as constantes; trocar uma muda a posição da função pura pelo valor esperado | ✓ `shaderConstants.test.ts` firefly probe follows the shared constants | `tests/unit/shaderConstants.test.ts:64` - `expect(changed.dx).toBeCloseTo(2 * base.dx, 12)`; `:65` - `expect(changed.dy).toBeCloseTo(0.4 * Math.sin(2 * Math.PI * 0.12 * t + py), 12)`; ligação da sonda em `src/world/interiors/InteriorScene.ts:525` (`fireflyDrift(t, prm.getX(k), prm.getZ(k), prm.getY(k))`) - ver achado 2 | PASS |
| C10 | balanço de árvore e lâmpada sem literal além de 2π; C22 e C25 da block-fill verdes | ✓ `shaderConstants.test.ts` sway shaders carry no numeric literal besides two pi; ✓ `interiors.spec.ts:276` tree crowns sway and trunks stay (18.7s); ✓ `interiors.spec.ts:368` fireflies within budget (1.4m) | `tests/unit/shaderConstants.test.ts:71` - `expect(numericLiterals(CROWN_SWAY_GLSL)).toEqual([TWO_PI])`; `:73-75` - `expect(numericLiterals(BULB_SWAY_GLSL)).toEqual([0.12, TWO_PI])`, `templateSourceLiterals(...)` = `[TWO_PI]`; `tests/e2e/interiors.spec.ts:311` - `expect(moved, ...).toBeGreaterThan(0)`; `tests/e2e/interiors.spec.ts:386` - `expect(r.bad, ...).toBe(0)` | PASS |
| C11 | `Cost:` da block-fill e o STATE citam as mesmas 3 contagens recontadas | recontagem própria: `grep -o` das linhas `Proof:` de `.specs/features/block-fill/checks.md`, depois `sort -u` = 51 distintos; 27 `tests/unit` (interiorMotion 14, interiorProps 6, interiors 6, purity 1 = 4 arquivos), 2 `tests/physics` (1 arquivo), 22 `tests/e2e` (interiors 18, visual 2, render 1, world 1 = 4 arquivos) | `.specs/features/block-fill/checks.md:239` - "27 provas unitárias em 4 arquivos, 2 de física real em 1 arquivo e 22 Playwright em 4 arquivos"; `.specs/STATE.md:57` - "o \"Cost\" da block-fill, agora 27/2/22" | PASS |

Todos os nomes existem no diff: os 5 testes de `visual.spec.ts:518-585`, o bloco de `drive.spec.ts:43-51` e `tests/unit/shaderConstants.test.ts` (arquivo novo) entraram em `main..residuals`. C6 e o teste da C3 em `:58` e as provas C22/C25 da C10 são testes anteriores; valem aqui como guarda de regressão pedida pelo check (não provam comportamento novo, e o check não diz que provam).

## Coverage

Recalculado a partir do código e das fontes, não lido da tabela do `checks.md`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| tipos de fachada na C1 da facade-glint (4) | `FACADE_TYPES = [0, 1, 2, 3]` em `tests/e2e/visual.spec.ts:467`, laço em `:481-484` | 0 C6 · 1 C6 · 2 C5 (`:583`), C6 · 3 C6 | - |
| tipos de fachada na C3 da facade-glint (4) | mesmo laço, `:506-509` | 0 · 1 · 2 · 3 C6 (`:508`) | - |
| modos do shader do espelho (2) | `uBlur` em `src/world/CityScene.ts:64` (`MIRROR_BLUR_TEXELS`) e `uBlur = 0` via `setMirrorBlur` em `src/core/Game.ts:1027` | blur C1 (`:531`), C4 (`:566`) · uma amostra C2 (`:540`), C4 (`sharp`, `:565`) | - |
| constantes do vagalume (6) | `FIREFLY_DRIFT` em `src/world/interiors/interiorMotion.ts:191-194`; interpolação em `src/world/interiors/InteriorScene.ts:663-666` | amp x/y/z e freq x/y/z: todas em `shaderConstants.test.ts:29` (valor) e `:46` (presença no GLSL montado) | - |
| balanços com sonda em JS (3) | `BULB_SWAY_GLSL`, `CROWN_SWAY_GLSL`, `FIREFLY_DRIFT_GLSL` em `InteriorScene.ts:656-666` | vagalume C8 (`:46`), C9 (`:64-66`) · árvore C10 (`:71`, `:75`) · lâmpada C10 (`:73-74`) | - |
| contagens do custo da block-fill (3) | recontagem própria dos `Proof:` distintos (linha C11) | unitárias 27 · física 2 · Playwright 22, todas batendo com `block-fill/checks.md:239` e `STATE.md:57` | - |
| checks existentes que o plano diz continuarem valendo (`plan.md` Impact) | `plan.md:32`: visual-upgrade C4, C41; facade-glint C1-C3; block-fill C22, C25 | vu C4 → `visual.spec.ts:66` (via C3) · vu C41 → rodei `lit windows stay stable while the camera moves` (`visual.spec.ts:355`, ✓ 34.3s; `:361` `expect(moving).toBeLessThan(0.01)`) · fg C1 → C6 · fg C2 → rodei `probe detects glint without specular antialiasing` (`visual.spec.ts:488`, ✓ 1.1m; `:498`) · fg C3 → C6 · bf C22, C25 → C10 | - |

Plano: `Relations` e `Surface` = None, `Landing` sem porta. Nenhum outro conjunto nomeado sem linha. As duas provas extras (vu C41 e fg C2) não estão em nenhum check da residuals, mas o `Impact` do plano as nomeia; rodei e passaram, então nada fica sem prova.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Shader do espelho (GLSL) | `src/world/CityScene.ts` (+ sondas DEV em `src/core/Game.ts`) | Playwright com a sonda de pixels, um caso por modo. Visto: blur (C1, C4) e uma amostra (C2, C4), todos em Playwright | yes |
| Constantes de shader compartilhadas | `src/world/interiors/InteriorScene.ts`, `src/world/interiors/interiorMotion.ts` | unitária sobre o texto do shader e sobre a função da sonda, uma asserção por constante. Visto: `shaderConstants.test.ts:29` (6 valores), `:46` (6 dentro do GLSL montado), `:56-58` e `:64-66` (função da sonda, 3 eixos) | yes |
| Testes e documento | `tests/e2e/*.spec.ts`, `tests/unit/shaderConstants.test.ts`, `.specs/**` | nenhuma própria; cobertos pela execução acima e pela recontagem da C11 | yes |

## Swept

Linhas que resolvem para existing: `state transitions` (C2, C4) - `setMirrorBlur` devolve o restaurador e ele é chamado nas duas sondas (`src/core/Game.ts:651` no `shimmer`, `:701` no `mirrorGain`); `observability` (C1, C4) - `render.shimmer` e `render.mirrorGain` existem em `Game.ts:615` e `:670`, só no objeto DEV. As linhas `n/a` são política aprovada.

## Faults injected

Injetados no próprio working tree, um de cada vez, por substituição exata de string (script Python que exige 1 ocorrência) e desfeitos pela substituição inversa. Depois de cada um, `md5sum -c` dos 4 arquivos contra o baseline de HEAD: todos OK. Cap de 5.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1: `MIRROR_BLUR_TEXELS = 2.5` -> `0` (sem blur) | `src/world/CityScene.ts:42` | yes - C1 falhou (`0.00390 > 0.001`) e C3 falhou (`blur` 0, `visual.spec.ts:556`) |
| F2: `base *= 1.0 / ( 1.0 + uBlur );` no fim do blur (escurece só o caminho com blur) | `src/world/CityScene.ts:82` | yes - C4 falhou (`0.00096 < 0.00866`) |
| F3: `setMirrorBlur` não zera o blur (`u.value = 0` -> `u.value = was`) | `src/core/Game.ts:1027` | yes - C2 falhou (`0.00012 < 0.003`) |
| F4: `gearLabel(-1)` `'R'` -> `'Rev'` | `src/hud/format.ts:9` | yes - C7 falhou (`toEqual` deep equality) |
| F5: literal `0.060` escrito à mão no lugar de `${FIREFLY_DRIFT.y.freq.toFixed(3)}` | `src/world/interiors/InteriorScene.ts:665` | yes - C8 falhou (`templateSourceLiterals` com 4 literais contra 3); C9 e C10 passaram, como esperado |

Provas que nenhuma mutação fez falhar, por causa do cap de 5: C5, C6, C9, C10 (unit e e2e). C5 e C6 guardam material que a feature não mudou (o tijolo ficou sem mudança por decisão do usuário), e as provas de C6/C10-e2e são anteriores à feature e já foram mutadas nas verificações da facade-glint e da block-fill.

## Gate

- `npx vitest run tests/unit/shaderConstants.test.ts -t "<3 nomes>"` - 3 passed, 0 failed
- `E2E_PORT=5193 npx playwright test tests/e2e/visual.spec.ts tests/e2e/drive.spec.ts tests/e2e/interiors.spec.ts -g "<11 nomes>"` - 11 passed, 0 failed (7.8m)
- `E2E_PORT=5193 npx playwright test tests/e2e/visual.spec.ts -g "lit windows stay stable while the camera moves|probe detects glint without specular antialiasing"` - 2 passed, 0 failed
- `npm test` - 38 arquivos, 151 passed, 0 failed
- `npx tsc --noEmit` - exit 0
- Working tree ao fim: `git status --short` vazio fora deste arquivo; `git diff --stat` vazio

## Findings (não bloqueiam)

1. **Doc comment deslocado** - `src/core/Game.ts:1020`: o JSDoc "Luminância média do quarto central..." de `centralLuminance` ficou acima de `setMirrorBlur` (inserido entre o comentário e o método). Cosmético.
2. **Precisão da C9** - a prova exercita a função pura `fireflyDrift`, não a sonda `fireflyPositions`. Que a sonda chama `fireflyDrift` com as constantes padrão está só no código (`InteriorScene.ts:525`); se a sonda voltasse a ter `Math.sin` com literais, a C9 continuaria verde. O texto do check aceita a função pura como prova, então é PASS, mas a primeira frase da C9 ("a sonda usa as mesmas constantes") não tem asserção.
3. **Proof da C11** - a linha `Proof:` cita `grep -c "^\s*\(it\|test\)("` sobre os arquivos, que conta todos os testes dos arquivos (não os citados). O método real (Proof: distintos por pasta) está no `## Handoff` e é o que reproduzi; as contagens batem.
4. **Ganho absoluto pequeno na C4** - o ganho de luminância do espelho sem blur é ~0.0144 (limite 0.00866 = 0.6×), ou seja, o reflexo soma ~1.4 % de luminância média à metade de baixo. A razão é robusta (F2 foi morto com folga), mas uma regressão que apague o espelho nos dois modos juntos só é pega pelo `sharp > 0` (`visual.spec.ts:565`).
