# corner-assist checks

Profile: standard
Plan: `.specs/features/corner-assist/plan.md`

14 checks in 2 slices · 1 one-way door · 0 open

## Comandos de prova

- **Unitário:** `npx vitest run <arquivo> -t "<nome>"`.
- **Física real (AD-011):** `npx vitest run tests/physics/<arquivo> -t "<nome>"`, com o harness de `tests/physics/harness.ts`: chão plano, passo 1/60 s, `Car` real com `DEFAULT_CAR`, assentamento de 0.5 s e velocidade inicial por `setForwardKmh`.
- **Integração:** `npx playwright test <arquivo> -g "<nome>"`, chromium headless contra `vite dev`.

"Giro em regime" é a média de |`angvel.y`| nos passos 120–180 de uma curva com `steer +1` e `throttle` sempre que a velocidade está abaixo da inicial. Aceleração lateral, sideslip e rolagem seguem as definições do `checks.md` da car-handling (janela de 30 passos).

## Checks

### S1 - Curvas fechadas em velocidade · 5 files · 45 KB · ~11k

**C1** - ✅ Giro em regime a 100 km/h ≥ 31.8°/s (0.5550 rad/s) (AC 1).
Proof: `npx vitest run tests/physics/cornering.test.ts -t "radius at most 50 m at 100 kmh"`

**C2** - ✅ Giro em regime a 140 km/h ≥ 22.3°/s (0.3892 rad/s) (AC 2).
Proof: `npx vitest run tests/physics/cornering.test.ts -t "radius at most 100 m at 140 kmh"`

**C3** - ✅ Giro em regime a 60 km/h ≥ 35°/s (0.6109 rad/s) (AC 3).
Proof: `npx vitest run tests/physics/cornering.test.ts -t "still turns at least 35 degrees per second at 60 kmh"`

**C4** - ✅ Para 60, 90, 120, 150 e 180 km/h, com `steer +1` por 3 s, a aceleração lateral em janela de 0.5 s fica ≤ 1.7 g em todo passo.

Substitui yaw-assist C5. (AC 4)
Proof: `npx vitest run tests/physics/cornering.test.ts -t "lateral acceleration never exceeds 1.7 g"`

**C5** - ✅ A 100 km/h, depois de 180 passos com `steer +1`, `steer` volta a 0 (acelerador mantendo 100 km/h): a aceleração lateral em janela de 0.5 s fica abaixo de 0.15 g em algum passo dos 60 seguintes (1.0 s) (AC 5).
Proof: `npx vitest run tests/physics/cornering.test.ts -t "path straightens within 1 s after release"`

### S2 - A força não estraga o resto · 9 files · 60 KB · ~15k

**C6** - ✅ `cornerAssistForce(spec, steerRad, v, wheelsInContact, handbrake)` com ficha de teste `massKg` 1000, `wheelbaseM` 2.6, `cornerAssistStartG` 0.9, `cornerAssistMaxG` 1.7, tolerância 1e-3 (AC 6):

| `steerRad` | `v` (m/s) | rodas | freio de mão | esperado (N) |
| --- | --- | --- | --- | --- |
| 0.05 | 10 | 4 | não | 0 (pede 1.9247 m/s², abaixo de 0.9 g) |
| 0.1 | 20 | 4 | não | `1000 · (400 · tan(0.1) / 2.6 − 8.829)` = 6607.103 |
| 0.2 | 20 | 4 | não | 7848 (limitado a `(1.7 − 0.9) · 9.81 · 1000`) |
| −0.2 | 20 | 4 | não | −7848 |
| 0.2 | −20 | 4 | não | 7848 (de ré, o centro da curva continua à esquerda) |
| 0.2 | 4.9 | 4 | não | 0 (abaixo de 5 m/s) |
| 0.2 | 20 | 1 | não | 0 (menos de 2 rodas no chão) |
| 0.2 | 20 | 2 | não | 7848 |
| 0.2 | 20 | 4 | sim | 0 (freio de mão) |

Proof: `npx vitest run tests/unit/cornerAssist.test.ts -t "corner assist force fills lateral acceleration above the start"`

**C7** - ✅ O `Car` aplica a força e lê a ficha (door 1):
- `CarSpec` tem `cornerAssistStartG` e `cornerAssistMaxG`, finitos, com `cornerAssistMaxG` > `cornerAssistStartG` > 0 em `DEFAULT_CAR`.
- No harness, 180 passos com `steer +1` a 100 km/h: com `{ ...DEFAULT_CAR, cornerAssistMaxG: DEFAULT_CAR.cornerAssistStartG }`, `car.cornerAssistN` é 0 em todo passo; com `DEFAULT_CAR`, é > 0 em pelo menos 60 passos. A força vem da ficha.

(Prova trocada com o usuário em 2026-09-26: a versão aprovada comparava o giro com e sem a força, mas sem a força a ajuda de giro faz o carro rodar e girar mais, o que não diz nada sobre ler a ficha.)
- A força é aplicada no centro de massa: com a força ligada, a rolagem média dos passos 90–180 a 100 km/h difere em no máximo 1.0° da rolagem com a força desligada.
- `car.cornerAssistN` é > 0 depois de 60 passos com `steer +1` a 100 km/h, e 0 parado. No browser, `__game.car.cornerAssistN` é 0 parado no spawn e > 0 depois de `W` por 2 s e `W` + `A` por 0.5 s.

Proof: `npx vitest run tests/physics/cornering.test.ts -t "car applies the corner assist from its spec at the center of mass"`
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "car debug exposes the corner assist force"`

**C8** - ✅ `cornerAssist.ts` está na lista de módulos puros, sem `three` nem `@dimforge/rapier3d-compat` (door 1).
Proof: `npx vitest run tests/unit/purity.test.ts -t "pure modules do not import three or rapier"`

**C9** - ✅ Continuam verdes, sem mudar asserções, as provas de "não capota" (AC 7): car-handling C2 e C3.
Proof: `npx vitest run tests/physics/stability.test.ts -t "no rollover across the maneuver matrix|all four wheels back on the ground after release"`

**C10** - ✅ Continuam verdes, sem mudar asserções, rolagem e arfagem da car-feel (AC 8): C1-C4.
Proof: `npx vitest run tests/physics/feel.test.ts -t "body roll between 3.5 and 6 degrees|body roll swings back after the turn|nose dives 2 to 5 degrees under braking|nose lifts under full throttle"`

**C11** - ✅ Continua verde, sem mudar asserções, o sideslip da car-feel C10 (10 casos, ≤ 12°) (AC 9).
Proof: `npx vitest run tests/physics/feel.test.ts -t "understeers without throttle or at speed"`

**C12** - ✅ Continuam verdes, sem mudar asserções, freio de mão, power slide e frenagem com direção (AC 10): car-handling C11, C12, C13 e C36.
Proof: `npx vitest run tests/physics/grip.test.ts -t "handbrake kicks the rear out|car recovers after the handbrake is released|steers while braking hard|throttle keeps pushing with the handbrake pulled"`

**C13** - ✅ Continuam verdes, sem mudar asserções, as metas da yaw-assist que continuam valendo (AC 11): C1, C4 e C6.
Proof: `npx vitest run tests/physics/agility.test.ts -t "points into the turn within 0.25 s at 40 kmh|stops turning within 0.8 s after release|reaches at least 0.85 g at 60 kmh"`

**C14** - ✅ Continuam verdes, sem mudar asserções, motor e freios (AC 12): car-handling C19-C23, e as provas do browser que dirigem o carro.
Proof: `npx vitest run tests/physics/powertrain.test.ts -t "zero to 100 kmh between 5.5 and 7.5 s|top speed limited by drag|coasting from 100 to 60 kmh|braking from 100 kmh stops in 34 to 45 m|climbs a 9 percent grade"`
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "A turns left|game builds the car from the default spec|car debug exposes the yaw assist torque"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "camera swings left while turning left|camera leans with the body"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| plan ACs (12) | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6, C7 · 7 C9 · 8 C10 · 9 C11 · 10 C12 · 11 C13 · 12 C14 | - |
| landing doors (1) | 1 C6, C7, C8 | - |
| corner assist cases (9) | abaixo do início C6 · livre C6 · limitado C6 · lado oposto C6 · ré C6 · abaixo de 5 m/s C6 · 1 roda C6 · 2 rodas C6 · freio de mão C6 | - |
| spec fields (2) | startG C7 · maxG C7 | - |
| superseded yaw-assist checks (1) | ya-5 → C4 | - |
| startup config: car construction (1 assembly) | `src/core/Game.ts` constrói o `Car` com `DEFAULT_CAR` (check 35 da car-handling, 2ª prova de C14) | - |

Na tabela, `ya-N` é o check N da yaw-assist.

- **Checks com física real:** C1-C5, C7, C9-C14.
- **Checks cruzando a fronteira do browser:** C7 (2ª prova), C14 (provas Playwright).

## Test policy

Mesmas linhas das features anteriores.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence:
- **`src/vehicle/cornerAssist.ts`** → decides, reached across a boundary. Própria: C6. Fronteira: C1-C5, C7.
- **`src/vehicle/Car.ts`** → aplica a força no centro de massa e lê a ficha; fronteira pelo harness: C7.
- **`src/vehicle/carSpec.ts`** → dados, C7.
- **`src/core/Game.ts`** → campo DEV, instrumentation; C7 (2ª prova).

Cost: 1 prova unitária nova, 6 de física real novas num arquivo novo, 1 Playwright nova.

## Swept

- **validation**: C6 (força limitada a `cornerAssistMaxG`, zero abaixo do início, abaixo de 5 m/s, com menos de 2 rodas ou freio de mão)
- **failure modes**: C6 (sem força no ar ou capotando); C9 (continua sem capotar)
- **idempotency**: n/a - função pura sem estado
- **authorization**: n/a - jogo local
- **concurrency**: n/a - um laço de física em passo fixo (AD-006)
- **data lifecycle**: n/a - nada persistido
- **dependency failure**: existing - sem o GLB o carro placeholder usa a mesma física (check 33 da free-roam-city)
- **state transitions**: C5 (curvando → soltar → reta); C12 (freio de mão desliga a força e a derrapagem continua)
- **observability**: C7 - `car.cornerAssistN` e `__game.car.cornerAssistN` em DEV

## Handoff

- **Estimativa por slice:**
  - S1 ≈ 11k: `Car.ts` 17 KB, `carSpec.ts` 6 KB, harness 6 KB, `cornering.test.ts` novo ~10 KB, `agility.test.ts` 6 KB lido.
  - S2 +15k → 26k: `cornerAssist.ts` novo ~2 KB, teste ~5 KB, `purity.test` 2 KB, `stability`/`grip`/`feel`/`powertrain` para rodar (~25 KB em parte), `Game.ts` para o campo DEV (~10 KB em parte), `drive.spec.ts` 8 KB, `carSpec.test.ts` 4 KB.
- **Total:** ~26k, abaixo do budget de 150k - one builder. Mecanismo: one builder (sem pergunta, cabe no budget).
- **Números de ajuste:** `cornerAssistStartG` (~0.9), `cornerAssistMaxG` (~1.6–1.7), `yawAssistLateralG` e o resto da ficha são do build até C1-C14 passarem. Os limites não mudam. Se um limite novo brigar com um que continua (sideslip ≤ 12°, rolagem 3.5–6°, sem capotar, freio de mão > 20°), é stop-and-ask.
- **Paralelo:** o build da block-fill roda em outra worktree e mexe em `Game.ts`; este build só acrescenta o campo `cornerAssistN` no handle DEV do carro.
