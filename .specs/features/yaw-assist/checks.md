# yaw-assist checks

Profile: standard
Plan: `.specs/features/yaw-assist/plan.md`

13 checks in 2 slices · 1 one-way door · 0 open

## Comandos de prova

- **Unitário:** `npx vitest run <arquivo> -t "<nome>"`.
- **Física real (AD-011):** `npx vitest run tests/physics/<arquivo> -t "<nome>"`, com o harness de `tests/physics/harness.ts`: chão plano, passo 1/60 s, `Car` real com `DEFAULT_CAR`, assentamento de 0.5 s e velocidade inicial por `setForwardKmh`.
- **Integração:** `npx playwright test <arquivo> -g "<nome>"`, chromium headless contra `vite dev`.

"Giro" é |`angvel.y`| do chassi. "Giro em regime" é a média do giro nos passos 120–180 de uma curva com `steer +1` e `throttle` sempre que a velocidade está abaixo da inicial. Aceleração lateral e sideslip seguem as definições do `checks.md` da car-handling.

## Checks

### S1 - O carro aponta rápido e vira mais · 5 files · 40 KB · ~10k

**C1** - A 40 km/h, com `steer +1` a partir do passo 0 (volante com a rampa da car-feel), o primeiro passo com giro ≥ 0.9 × giro em regime é no máximo o passo 15 (0.25 s) (AC 1).
Proof: `npx vitest run tests/physics/agility.test.ts -t "points into the turn within 0.25 s at 40 kmh"`

**C2** - Giro em regime a 60 km/h ≥ 32°/s (0.5585 rad/s) (AC 2).
Proof: `npx vitest run tests/physics/agility.test.ts -t "turns at least 32 degrees per second at 60 kmh"`

**C3** - Giro em regime a 100 km/h ≥ 20°/s (0.3491 rad/s) (AC 3).
Proof: `npx vitest run tests/physics/agility.test.ts -t "turns at least 20 degrees per second at 100 kmh"`

**C4** - A 100 km/h, depois de 180 passos com `steer +1`, `steer` volta a 0 (acelerador mantendo 100 km/h): o giro fica abaixo de 3°/s (0.05236 rad/s) em algum passo dos 48 seguintes (0.8 s) e continua abaixo disso até o passo 60 depois de soltar (AC 4).
Proof: `npx vitest run tests/physics/agility.test.ts -t "stops turning within 0.8 s after release"`

**C5** - Para 60, 90, 120, 150 e 180 km/h, com `steer +1` por 3 s, a aceleração lateral em janela de 0.5 s fica ≤ 1.05 g em todo passo.

Substitui car-feel C8. (AC 5)
Proof: `npx vitest run tests/physics/agility.test.ts -t "lateral grip never exceeds 1.05 g"`

**C6** - A 60 km/h, com `steer +1`, a aceleração lateral em janela de 0.5 s atinge ≥ 0.85 g em algum passo dos primeiros 120.

Substitui car-feel C9. (AC 6)
Proof: `npx vitest run tests/physics/agility.test.ts -t "reaches at least 0.85 g at 60 kmh"`

### S2 - A ajuda é contida · 7 files · 50 KB · ~13k

**C7** - `yawAssistTorque(spec, steerRad, v, yawRate, wheelsInContact, yawInertia)` com uma ficha de teste `gain` 4, `maxNm` 5000, `lateralG` 1.1, `wheelbaseM` 2.6 e `yawInertia` 2000, tolerância 1e-6 (AC 7):

| `steerRad` | `v` (m/s) | `yawRate` | rodas | esperado |
| --- | --- | --- | --- | --- |
| 0.1 | 10 | 0 | 4 | alvo `min(10·tan(0.1)/2.6, 1.1·9.81/10)` = 0.38590; torque `4·2000·0.38590` = 3087.2 |
| 0.3 | 10 | 0 | 4 | alvo limitado a 1.0791; torque `min(8632.8, 5000)` = 5000 |
| −0.3 | 10 | 0 | 4 | −5000 |
| 0 | 20 | 0.2 | 4 | −1600 (freia o giro ao soltar) |
| 0.1 | −5 | 0 | 4 | alvo negativo (ré): `−5·tan(0.1)/2.6` = −0.19295; torque −1543.6 |
| 0.3 | 1.9 | 0 | 4 | 0 (abaixo de 2 m/s) |
| 0.3 | 10 | 0 | 1 | 0 (menos de 2 rodas no chão) |
| 0.3 | 10 | 0 | 2 | ≠ 0 |

Proof: `npx vitest run tests/unit/yawAssist.test.ts -t "yaw assist torque follows the target yaw rate"`

**C8** - O `Car` aplica a ajuda e lê a ficha (door 1):
- `CarSpec` tem `yawAssistGain`, `yawAssistMaxNm` e `yawAssistLateralG`, finitos e > 0 em `DEFAULT_CAR`.
- No harness, a 60 km/h com `steer +1`, o giro em regime com `{ ...DEFAULT_CAR, yawAssistMaxNm: 0 }` é pelo menos 15 % menor que com `DEFAULT_CAR` (a ajuda muda o carro, e o valor vem da ficha).
- `car.yawAssistNm` depois de um passo com `steer +1` a 60 km/h é > 0, e parado é 0.

Proof: `npx vitest run tests/physics/agility.test.ts -t "car applies the yaw assist from its spec"`

**C9** - `yawAssist.ts` está na lista de módulos puros, sem `three` nem `@dimforge/rapier3d-compat` (door 1).
Proof: `npx vitest run tests/unit/purity.test.ts -t "pure modules do not import three or rapier"`

**C10** - Continuam verdes, sem mudar asserções, as provas de "não capota" com a ajuda ligada (AC 8): car-handling C2 e C3.
Proof: `npx vitest run tests/physics/stability.test.ts -t "no rollover across the maneuver matrix|all four wheels back on the ground after release"`

**C11** - Continua verde, sem mudar asserções, o sideslip da car-feel C10 (10 casos, ≤ 12°) (AC 9).
Proof: `npx vitest run tests/physics/feel.test.ts -t "understeers without throttle or at speed"`

**C12** - Continuam verdes, sem mudar asserções, o freio de mão e o power slide (AC 10): car-handling C11, C12, C13 e C36.
Proof: `npx vitest run tests/physics/grip.test.ts -t "handbrake kicks the rear out|car recovers after the handbrake is released|steers while braking hard|throttle keeps pushing with the handbrake pulled"`

**C13** - Continuam verdes, sem mudar asserções, motor e freios (AC 11): car-handling C19-C23, a balança da carroceria da car-feel (C1-C4) e as provas do browser que dirigem o carro.
Proof: `npx vitest run tests/physics/powertrain.test.ts -t "zero to 100 kmh between 5.5 and 7.5 s|top speed limited by drag|coasting from 100 to 60 kmh|braking from 100 kmh stops in 34 to 45 m|climbs a 9 percent grade"`
Proof: `npx vitest run tests/physics/feel.test.ts -t "body roll between 3.5 and 6 degrees|body roll swings back after the turn|nose dives 2 to 5 degrees under braking|nose lifts under full throttle"`
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "A turns left|game builds the car from the default spec"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "camera swings left while turning left|camera leans with the body"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| plan ACs (11) | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6 · 7 C7, C8 · 8 C10 · 9 C11 · 10 C12 · 11 C13 | - |
| landing doors (1) | 1 C7, C8, C9 | - |
| yaw assist cases (8) | alvo livre C7 · alvo limitado C7 · lado oposto C7 · soltar C7 · ré C7 · abaixo de 2 m/s C7 · 1 roda C7 · 2 rodas C7 | - |
| spec fields (3) | gain C8 · maxNm C8 · lateralG C8 | - |
| superseded car-feel checks (2) | cf-8 → C5 · cf-9 → C6 | - |
| startup config: car construction (1 assembly) | `src/core/Game.ts` constrói o `Car` com `DEFAULT_CAR` (check 35 da car-handling, na 3ª prova de C13) | - |

Na tabela, `cf-N` é o check N da car-feel.

- **Checks com física real:** C1-C6, C8, C10-C13.
- **Checks cruzando a fronteira do browser:** C13 (provas Playwright).

## Test policy

Mesmas linhas das features anteriores.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence:
- **`src/vehicle/yawAssist.ts`** → decides, reached across a boundary. Própria: C7. Fronteira: C1-C4, C8.
- **`src/vehicle/Car.ts`** → aplica o torque e lê a ficha; fronteira pelo harness: C8.
- **`src/vehicle/carSpec.ts`** → dados, C8.

Cost: 1 prova unitária nova, 7 de física real novas num arquivo novo.

## Swept

- **validation**: C7 (torque limitado a `yawAssistMaxNm`, alvo limitado a `yawAssistLateralG`, zero abaixo de 2 m/s)
- **failure modes**: C7 (sem ajuda com menos de 2 rodas no chão: no ar ou capotando); C10 (continua sem capotar)
- **idempotency**: n/a - função pura sem estado; mesmo argumento, mesmo torque
- **authorization**: n/a - jogo local
- **concurrency**: n/a - um laço de física em passo fixo (AD-006)
- **data lifecycle**: n/a - nada persistido
- **dependency failure**: existing - sem o GLB, o carro placeholder usa a mesma física (check 33 da free-roam-city)
- **state transitions**: C4 (girando → soltar → parado de girar)
- **observability**: C8 - `__game.car.yawAssistNm` e o mesmo campo no `Car`

## Handoff

- **Estimativa por slice:**
  - S1 ≈ 10k: `Car.ts` 16 KB, `carSpec.ts` 5 KB, harness 6 KB, `agility.test.ts` novo ~10 KB, `feel.test.ts` 8 KB.
  - S2 +13k → 23k: `yawAssist.ts` novo ~3 KB, teste ~5 KB, `purity.test` 2 KB, `stability`, `grip`, `powertrain` para rodar (~20 KB lidos em parte), `Game.ts` para o campo DEV (~10 KB em parte), `carSpec.test.ts` 4 KB.
- **Total:** ~23k, abaixo do budget de 150k - one builder. Mecanismo: one builder (sem pergunta, cabe no budget).
- **Números de ajuste:** `yawAssistGain`, `yawAssistMaxNm`, `yawAssistLateralG` e `tireGrip` são do build até C1-C13 passarem. Os limites não mudam. Se um limite novo brigar com um que continua (sideslip ≤ 12° da car-feel, sem capotar, freio de mão > 20°, frenagem 34-45 m), é stop-and-ask.
- **Paralelo:** o build da block-fill roda ao mesmo tempo em outra worktree e mexe em `Game.ts`; este build só acrescenta o campo `yawAssistNm` no handle DEV do carro.
