# Yaw assist verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: bcd092c..6abbfdc (rodada 1 em 8fce50a; correção 8b47ec4, merge 4f9089d, lição 6abbfdc)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Resumo: a rodada 1 (em 8fce50a) deu FAIL por duas lacunas de prova. A correção `8b47ec4` só mexe em testes e
specs: nenhum arquivo de `src/` mudou desde 8fce50a. As duas lacunas fecharam:
1. **Teto de `yawAssistLateralG` na própria camada.** A linha nova da C7 (`tests/unit/yawAssist.test.ts:36`)
   fica abaixo do clamp e mata a falta "sem teto" na própria C7. Na rodada 1, essa falta só morria na fronteira.
2. **`__game.car.yawAssistNm`.** A prova Playwright nova (`tests/e2e/drive.spec.ts:64-74`) lê o campo e mata
   as duas faltas no getter DEV.

Também fecharam a borda de 2 m/s (`yawAssist.test.ts:38`) e o texto da AD-013 (`.specs/STATE.md:41`). As 25 provas
vitest e as 5 Playwright passaram em 6abbfdc. As 5 faltas novas morreram, e nenhuma asserção ficou mais fraca.

Escopo desta rodada: a correção tocou `tests/unit/yawAssist.test.ts`, `tests/e2e/drive.spec.ts`,
`.specs/features/yaw-assist/checks.md` (C7, C8 e Coverage) e `.specs/STATE.md` (AD-013). Rejulguei C7, C8, a linha
`Test policy` de `yawAssist.ts` e a do getter DEV, o `Swept` de observability e as linhas de Coverage tocadas. O
resto vem `carried from 8fce50a` e diz isso na própria seção.

## Binding sources

Carried from 8fce50a. A correção não tocou a interface, e o plano não marca nenhuma fonte como binding.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| nenhuma fonte binding | n/a | - | - |

## Checks

Verified at 6abbfdc. As provas rodaram de novo, todas, no worktree do Verifier. Antes de rodar, criei a junction
de `node_modules`, que o git ignora. O `git status --porcelain` estava vazio.
- `npx vitest run --reporter=verbose`: 31 arquivos, **114 passaram**, 0 falharam, exit 0 (14.5 s). Não houve
  timeout.
  - Cada nome das provas vitest de C1-C13 aparece com ✓: os 7 de `agility.test.ts`, `yaw assist torque follows
    the target yaw rate`, `pure modules do not import three or rapier`, os 2 de `stability`, os 4 de `grip`, os 5
    de `powertrain` e os 5 de `feel` citados. São 25 no total.
- `E2E_PORT=5200 npx playwright test tests/e2e/drive.spec.ts tests/e2e/visual.spec.ts -g "car debug exposes the
  yaw assist torque|A turns left|game builds the car from the default spec|camera swings left while turning
  left|camera leans with the body"`: **5 passaram** (2.0 min, exit 0). O log mostra `[WebServer] vite --port 5200
  --strictPort` do próprio run. Não houve timeout de boot.
  - `drive.spec.ts:49` "A turns left".
  - `drive.spec.ts:64` "car debug exposes the yaw assist torque" (novo).
  - `drive.spec.ts:151` "game builds the car from the default spec" (era `:138`).
  - `visual.spec.ts:272` "camera swings left while turning left" e `:304` "camera leans with the body".

Nas linhas C1-C6 e C9-C12, o arquivo de teste não mudou desde 8fce50a. A citação é a da rodada 1, e a prova rodou
de novo, verde, em 6abbfdc.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 40 km/h, primeiro passo com giro ≥ 0.9 × regime ≤ 15 | vitest `points into the turn within 0.25 s at 40 kmh` ✓ (6abbfdc) | `tests/physics/agility.test.ts:43` `findIndex(r => r >= 0.9 * steady) + 1`; `:45` `toBeLessThanOrEqual(15)` (citação carried from 8fce50a, arquivo sem mudança) | PASS |
| C2 | regime a 60 km/h ≥ 32°/s | vitest `turns at least 32 degrees per second at 60 kmh` ✓ (6abbfdc) | `tests/physics/agility.test.ts:50` `toBeGreaterThanOrEqual(32 * DEG)` | PASS |
| C3 | regime a 100 km/h ≥ 20°/s | vitest `turns at least 20 degrees per second at 100 kmh` ✓ (6abbfdc) | `tests/physics/agility.test.ts:55` `toBeGreaterThanOrEqual(20 * DEG)` | PASS |
| C4 | depois de soltar, < 3°/s em ≤ 48 passos e fica abaixo até o passo 60 | vitest `stops turning within 0.8 s after release` ✓ (6abbfdc) | `tests/physics/agility.test.ts:69` `first <= 48`; `:71` `after[i] < limit` | PASS |
| C5 | 60/90/120/150/180 km/h, janela ≤ 1.05 g em todo passo | vitest `lateral grip never exceeds 1.05 g` ✓ (6abbfdc) | `tests/physics/agility.test.ts:81` `toBeLessThanOrEqual(1.05)` por passo | PASS |
| C6 | 60 km/h, ≥ 0.85 g nos primeiros 120 | vitest `reaches at least 0.85 g at 60 kmh` ✓ (6abbfdc) | `tests/physics/agility.test.ts:89` `Math.max(...g) >= 0.85` | PASS |
| C7 | fórmula da door 1, tabela de 10 linhas, tol 1e-6 | vitest `yaw assist torque follows the target yaw rate` ✓ (6abbfdc) | `tests/unit/yawAssist.test.ts:6-13` ficha 4/5000/1.1/2.6, inércia 2000. Linhas `:28-38`. `:46` `Math.abs(t - expected) <= TOL`. `:36` "lateral g cap below max torque" (0.3, 10, 0.5, 4) com `:42` `toBeCloseTo(4632.8, 1)`. `:38` "exactly 2 m/s" (0.3, 2, 0, 4) com `:43` `toBeCloseTo(1903.6, 1)`. `:49-50` 2 rodas `not.toBe(0)`. Conferi à mão: sem o teto, a linha `:36` daria `8000 · (1.18976 − 0.5)` = 5518, que o clamp leva a 5000 ≠ 4632.8. Com `<=`, a linha `:38` daria 0 ≠ 1903.6. As 10 linhas da tabela de `checks.md:48-57` batem com `:28-38` e `:49` | PASS |
| C8 | 3 campos finitos > 0; sem ajuda o regime a 60 km/h é ≥ 15 % menor; `car.yawAssistNm` > 0 andando e 0 parado; no browser `__game.car.yawAssistNm` é 0 no spawn e > 0 com W 1 s + W+A 0.3 s | vitest `car applies the yaw assist from its spec` ✓ (6abbfdc); pw `car debug exposes the yaw assist torque` ✓ (6abbfdc, porta 5200) | `tests/physics/agility.test.ts:96-98`, `:103` `without <= 0.85 * withAssist`, `:109` `toBeGreaterThan(0)`, `:114` `toBe(0)` (arquivo sem mudança desde 8fce50a). Browser: `tests/e2e/drive.spec.ts:65` `expect(await page.evaluate(() => __game.car.yawAssistNm)).toBe(0)` no spawn; `:66-69` `KeyW` 1 s e depois `KeyA` 0.3 s de simulação; `:70` lê o campo segurando as teclas; `:73` `expect(nm).toBeGreaterThan(0)`. Bate com `checks.md:65` | PASS |
| C9 | `yawAssist.ts` na lista de módulos puros | vitest `pure modules do not import three or rapier` ✓ (6abbfdc) | `tests/unit/purity.test.ts:34`, `:42` `toBe(25)`, `:45` `FORBIDDEN.test(source)` é `false` | PASS |
| C10 | car-handling C2 e C3 verdes, sem mudança | vitest `no rollover across the maneuver matrix` ✓, `all four wheels back on the ground after release` ✓ (6abbfdc) | `tests/physics/stability.test.ts:74` `maxTilt <= 15`; `:83-84` volta em 1..60 passos | PASS |
| C11 | car-feel C10, 10 casos, sideslip ≤ 12° | vitest `understeers without throttle or at speed` ✓ (6abbfdc) | `tests/physics/feel.test.ts:117` `slip <= 12`; `:122` `run` = 10 | PASS |
| C12 | freio de mão e power slide sem mudança (ch C11, C12, C13, C36) | vitest os 4 nomes ✓ (6abbfdc) | `tests/physics/grip.test.ts:25` `max > 20`; `:50`, `:59`; `:91` `turned >= 0.2`; `:37` `run(true) > run(false) + 2` | PASS |
| C13 | motor, freios, balanço da carroceria e browser sem mudança | vitest 5 de `powertrain` ✓, 4 de `feel` ✓; pw 4 ✓ (6abbfdc) | `tests/physics/powertrain.test.ts:20-21`, `:38-40`, `:53-54`, `:71-72`, `:84`; `tests/physics/feel.test.ts:36-40`, `:53-57`, `:71-72`, `:84-85`. Citações atualizadas em `drive.spec.ts`, cujas linhas andaram: `:60` `d > 0.15`, `:156` `toBe(32)`, `:157` `live toEqual expected`. `tests/e2e/visual.spec.ts:291-293`, `:299-300`, `:349`, `:351` | PASS |

### Nenhuma asserção enfraquecida

O `git diff 8fce50a 6abbfdc -- tests` só traz linhas novas, fora uma troca de comentário (`8 rows` → `10 rows`,
`yawAssist.test.ts:17`):
- em `yawAssist.test.ts`, 2 linhas de tabela e 2 `toBeCloseTo`;
- em `drive.spec.ts`, 1 teste novo.

Nenhum matcher ou tolerância mudou, e nenhuma linha antiga da tabela da C7 foi alterada. `src/` não tem diff
entre 8fce50a e 6abbfdc, então o julgamento da implementação da rodada 1 (fórmula literal, inércia real, ordem e
`dt`) vale como `carried from 8fce50a`.

## Coverage

Verified at 6abbfdc nas linhas que a correção tocou (yaw assist cases, ramos da fórmula, campo DEV). As outras são
carried from 8fce50a, e a autoridade delas (`plan.md`, `src/`) não mudou.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (11) - carried from 8fce50a | `plan.md` Criteria, AC 1-11 | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6 · 7 C7 `yawAssist.test.ts:46`, C8 `agility.test.ts:109`, `:114` · 8 C10 · 9 C11 · 10 C12 · 11 C13 | - |
| landing doors (1) - carried from 8fce50a | `plan.md` Landing | assinatura e fórmula C7; `CarSpec` com 3 campos C8; pureza C9; aplicação pelo `Car` C8 `:103` | - |
| yaw assist cases (10) - verified at 6abbfdc | a door 1 (alvo, teto, clamp, sinal, zeros) e `checks.md:48-57` | alvo livre `yawAssist.test.ts:28` · alvo limitado / clamp `:29` · lado oposto `:30` · soltar `:31` · ré `:32` · abaixo de 2 m/s `:33` · 1 roda `:34` · 2 rodas `:49-50` · teto de lateralG `:36`, `:42` · exatamente 2 m/s `:38`, `:43` | - |
| ramos da fórmula (5) - verified at 6abbfdc | `src/vehicle/yawAssist.ts:29-34` | guarda de velocidade `:33` (1.9 → 0) e `:38` (2 → 1903.6), então as duas bordas de `:29` estão cobertas · guarda de rodas `:34` e `:49-50` · sinal pelo `v` `:32` · teto lateralG `:36` na própria camada (F1 e F4 morrem na C7) · clamp `:29-30` (sem o clamp daria 8632.8) | - |
| spec fields (3) - carried from 8fce50a | `plan.md` Landing, `src/vehicle/carSpec.ts:54-58` | gain, maxNm, lateralG: `agility.test.ts:96-98`, `carSpec.test.ts:75-76`; `maxNm` lido pelo `Car` em `agility.test.ts:103` | - |
| DEV fields do plano, Surface (1) - verified at 6abbfdc | `plan.md` Surface; `src/core/Game.ts:566-567` | `Car.yawAssistNm` `agility.test.ts:109`, `:114` · `__game.car.yawAssistNm` `drive.spec.ts:65` (0 no spawn) e `:73` (> 0 virando à esquerda). O `rg "yawAssistNm" tests/` agora acha `drive.spec.ts:63`, `:65`, `:70` | - |
| superseded car-feel checks (2) - carried from 8fce50a | diff de `tests/` e `car-feel/checks.md:75` | cf-8 → C5 `agility.test.ts:81` · cf-9 → C6 `:89` | - |
| startup config: car construction (1 assembly) - verified at 6abbfdc | `src/core/Game.ts:159` `new Car(..., DEFAULT_CAR)` | ch C35 `tests/e2e/drive.spec.ts:156-157`, rodado ✓ | - |

Nota (não reprova): o `checks.md:102` ainda diz "Checks cruzando a fronteira do browser: C13". Agora a C8 também
tem prova Playwright. É só uma lista de resumo desatualizada, e o check e a prova estão certos.

## Test policy rows

Verified at 6abbfdc para as linhas que não passaram na rodada 1 e para as que classificam arquivos tocados. As
outras são carried from 8fce50a.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/vehicle/yawAssist.ts` | própria C7 · fronteira C1-C4, C8 | yes (verified at 6abbfdc). Na própria camada, cada ramo da tabela de decisão tem caso que o distingue: o teto de lateralG em `yawAssist.test.ts:36`, as duas bordas de 2 m/s em `:33` e `:38`, as duas bordas das rodas em `:34` e `:49-50`, o clamp em `:29`, o sinal em `:32` e o soltar em `:31`. Na fronteira está coberto por C1-C5 e C8 |
| Car aplica o torque e lê a ficha ("fronteira pelo harness") | `src/vehicle/Car.ts` | C8 | yes (carried from 8fce50a; `Car.ts` sem diff) |
| Dados | `src/vehicle/carSpec.ts` | C8 | yes (carried from 8fce50a; `carSpec.ts` sem diff) |
| Instrumentation, pass-throughs | `src/core/Game.ts` (getter DEV `:566-567`) | coberto pela prova do consumidor | yes (verified at 6abbfdc). O consumidor é `drive.spec.ts:64-74`, e F3 e F5 morrem lá |

## Faults injected

Verified at 6abbfdc. Rodei tudo num worktree de rascunho separado (`git worktree add --detach
<scratchpad>/fault-wt HEAD`), nunca com `git stash`.
- O rascunho usou uma junction de `node_modules`. Uma falta por vez, e cada uma foi desfeita com `git checkout --
  <arquivo>` antes da seguinte. O `git status --porcelain` do rascunho ficou vazio depois de cada uma.
- As faltas de browser rodaram em `E2E_PORT=5200` só depois do run principal acabar. Conferi com `netstat` que não
  havia nada em LISTEN na 5200, porque com `reuseExistingServer: true` um servidor da árvore real seria reusado.
- No fim apaguei a junction com `(Get-Item ...\node_modules).Delete()` antes de `git worktree remove`. O
  `node_modules` compartilhado continua lá (`vitest` presente), e o `git worktree list` não mostra mais o rascunho.
- O `git status --porcelain` do worktree do Verifier estava vazio antes e depois (os dois arquivos de linha de
  base têm 0 bytes).

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 sem o teto de lateralG: `target = Math.sign(kinematic) * Math.abs(kinematic)` | `src/vehicle/yawAssist.ts:32` | yes. C7 `tests/unit/yawAssist.test.ts:46` "lateral g cap below max torque: got 5000, expected 4632.8". Agora morre na própria camada. Na rodada 1, a C7 passava com essa falta |
| F2 `<=` na guarda de 2 m/s: `if (speed <= MIN_SPEED_MS \|\| ...)` | `src/vehicle/yawAssist.ts:29` | yes. C7 `tests/unit/yawAssist.test.ts:46` "exactly 2 m/s: got 0, expected 1903.6" |
| F3 getter DEV devolve 0: `get yawAssistNm() { return 0; }` | `src/core/Game.ts:567` | yes. C8 pw `tests/e2e/drive.spec.ts:73` "Expected: > 0, Received: 0" |
| F4 teto aplicado ao erro e não ao alvo: `err = kinematic − yawRate; target = sign(err) · min(\|err\|, limit) + yawRate` | `src/vehicle/yawAssist.ts:32` | yes. C7 `tests/unit/yawAssist.test.ts:46` "lateral g cap below max torque: got 5000, expected 4632.8". Só a linha nova distingue essa falta: nas outras linhas `yawRate` é 0 ou o alvo é 0 |
| F5 getter DEV devolve o teto da ficha: `return game.car.spec.yawAssistMaxNm` | `src/core/Game.ts:567` | yes. C8 pw `tests/e2e/drive.spec.ts:65` "Expected: 0, Received: 12000" no spawn |

As faltas da rodada 1 (guarda de rodas, sinal no chassi, sem `dt`, `Car` ignorando a ficha) são carried from
8fce50a. `src/vehicle/Car.ts` e o harness não mudaram, e as provas que as mataram (C7 `:46`, C8 `:103`, C5 `:81`)
rodaram de novo, verdes, em 6abbfdc.

## Swept existing

- **observability** (C8), verified at 6abbfdc: cita `__game.car.yawAssistNm` e o campo no `Car`.
  - O campo no `Car` está provado em `agility.test.ts:109` e `:114`.
  - O getter DEV (`Game.ts:566-567`) agora é lido por `drive.spec.ts:65` e `:70`, e as asserções estão em `:65`
    (`toBe(0)`) e `:73` (`> 0`). F3 e F5 morrem ali. Confere.
- **dependency failure** (existing), carried from 8fce50a: "sem o GLB, o carro placeholder usa a mesma física
  (check 33 da free-roam-city)". Confere em `free-roam-city/checks.md:119`. `Car.ts` não mudou.
- Os outros `Swept` são `n/a` ou apontam para checks já julgados acima. Os `n/a` são idempotência, autorização,
  concorrência e ciclo de vida; validation e failure modes vão para C7 e C10, e state transitions para C4.
  Carried from 8fce50a, e C7 foi rejulgada acima.

## Deviations judged

Carried from 8fce50a, sem mudança: `tireGrip` 0.86 → 0.97 e os valores da ficha (`gain` 10, `maxNm` 12000,
`lateralG` 1.25) são números de ajuste que o Handoff autoriza. As margens estreitas (C3 20.53°/s, C5 1.032 g,
C8 0.829) continuam anotadas.

Texto da AD-013, verified at 6abbfdc: `.specs/STATE.md:41` agora diz "Nenhuma outra ajuda arcade". Isso não
contradiz mais `restoreRollMoment` nem `applyResistance`, que são física própria, mas não ajuda arcade. Fechado.

## Gate

`npx vitest run` - 114 passed, 0 failed · `E2E_PORT=5200 npx playwright test tests/e2e/drive.spec.ts tests/e2e/visual.spec.ts -g "car debug exposes the yaw assist torque|A turns left|game builds the car from the default spec|camera swings left while turning left|camera leans with the body"` - 5 passed, 0 failed

## Ranked gaps

Nenhum gap que reprove. Status dos gaps da rodada 1:
1. Teto de lateralG sem caso na própria camada (C7): **fechado** em `tests/unit/yawAssist.test.ts:36` e `:42`.
   F1 e F4 morrem na C7.
2. `__game.car.yawAssistNm` sem prova (C8 / Swept observability): **fechado** em `tests/e2e/drive.spec.ts:64-74`.
   F3 e F5 morrem ali.
3. Borda de 2 m/s (C7): **fechado** em `tests/unit/yawAssist.test.ts:38` e `:43`. F2 morre.
4. Texto da AD-013: **fechado** em `.specs/STATE.md:41`.

Nota que não reprova: `checks.md:102` lista só a C13 como check que cruza o browser. Agora a C8 também cruza.
