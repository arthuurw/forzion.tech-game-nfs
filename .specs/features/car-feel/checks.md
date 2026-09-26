# car-feel checks

Profile: standard
Plan: `.specs/features/car-feel/plan.md`

17 checks in 3 slices · 1 one-way door · 0 open

## Comandos de prova

- **Unitário:** `npx vitest run <arquivo> -t "<nome>"`.
- **Física real (AD-011):** `npx vitest run tests/physics/<arquivo> -t "<nome>"`. Usa o harness de `tests/physics/harness.ts` da car-handling: chão plano, passo 1/60 s, `Car` real com a ficha passada, assentamento de 0.5 s e "velocidade inicial V" por `setForwardKmh`.
- **Integração:** `npx playwright test <arquivo> -g "<nome>"`. Chromium headless contra `vite dev`, lendo `window.__game`.

As grandezas (inclinação, rolagem, arfagem, sideslip, aceleração lateral em janela de 30 passos) têm as mesmas definições da seção "Grandezas medidas a cada passo" do `checks.md` da car-handling. Rolagem positiva = lado esquerdo para cima; arfagem negativa = frente para baixo; `steer +1` = esquerda.

## Checks

### S1 - A carroceria balança · 4 files · 40 KB · ~10k

**C1** - ✅ Curva à esquerda (`steer +1`) a partir de 80 km/h, com `throttle` ligado sempre que a velocidade está abaixo de 80 km/h, por 3 s:
- A rolagem média dos passos 90–180 está entre +3.5° e +6.0° (o carro inclina para fora).
- Com `steer −1`, a média está entre −6.0° e −3.5°.

Substitui car-handling C4. (AC 1)
Proof: `npx vitest run tests/physics/feel.test.ts -t "body roll between 3.5 and 6 degrees"`

**C2** - ✅ Na continuação do caso `steer +1` de C1, no passo 180 a direção e o acelerador são soltos:
- Nos 60 passos seguintes (1.0 s), a menor rolagem está entre −1.5° e −0.3° (passa para o outro lado).
- Do passo 150 ao 240 depois de soltar (2.5 s a 4.0 s), |rolagem| < 0.5° em todo passo.

(AC 2)
Proof: `npx vitest run tests/physics/feel.test.ts -t "body roll swings back after the turn"`

**C3** - ✅ Com `brake` a partir de 100 km/h, a menor arfagem nos primeiros 30 passos (0.5 s) está entre −5.0° e −2.0°.

Substitui car-handling C5. (AC 3)
Proof: `npx vitest run tests/physics/feel.test.ts -t "nose dives 2 to 5 degrees under braking"`

**C4** - ✅ Parado e assentado, com `throttle`, a maior arfagem nos primeiros 60 passos (1.0 s) está entre +1.0° e +4.0° (frente sobe, traseira agacha). (AC 4)
Proof: `npx vitest run tests/physics/feel.test.ts -t "nose lifts under full throttle"`

**C5** - ✅ Continuam verdes, sem mudança nas asserções, as provas da car-handling de "não capota" com a ficha nova (AC 5):
- car-handling C2, matriz de 54 casos com inclinação ≤ 15°.
- car-handling C3, as 4 rodas no chão em até 60 passos depois de soltar.

Proof: `npx vitest run tests/physics/stability.test.ts -t "no rollover across the maneuver matrix"`
Proof: `npx vitest run tests/physics/stability.test.ts -t "all four wheels back on the ground after release"`

### S2 - Volante e aderência · 6 files · 50 KB · ~13k

**C6** - ✅ Rampa do volante em `stepDrivetrain`, a 0 km/h, `dt` = 1/60, partindo de `steer` 0:
- Com input +1, `steer` cresce exatamente 4.0/60 rad por passo e chega a 0.55 no passo 9, sem passar de 0.55.
- Soltando (input 0), cai exatamente 5.0/60 por passo até 0, sem passar para o outro lado.
- De +0.55 com input −1, cada passo muda no máximo 5.0/60 até −0.55.
- Input −1 é o espelho exato de +1.

Substitui car-handling C6. (AC 6)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "steering ramps at 4 and 5 rad per second"`

**C7** - ✅ Ângulo alvo `min(0.55, atan(1.7 × 9.81 × 2.6 / v²))`, tolerância 1e-6:

| `v` (m/s) | alvo esperado |
| --- | --- |
| 0 | 0.55 |
| 0.9 | 0.55 (guarda de `v` < 1) |
| 5 | 0.55 (a fórmula dá 1.048, e o `min` corta) |
| 10 | `atan(43.3602 / 100)` |
| 27.78 | `atan(43.3602 / 771.7284)` |
| 55.56 | `atan(43.3602 / 3086.9136)` |
| −10 (ré) | igual ao caso de 10 |

Substitui car-handling C7. (AC 7)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "steering target with 1.7 g"`

**C8** - ✅ Para 60, 90, 120, 150 e 180 km/h: `steer +1` por 3 s, com `throttle` sempre que a velocidade está abaixo da inicial. A aceleração lateral em janela de 0.5 s fica ≤ 0.95 g em todo passo.

Substitui car-handling C8. (AC 8)
Proof: `npx vitest run tests/physics/feel.test.ts -t "lateral grip never exceeds 0.95 g"`

**C9** - ✅ A 60 km/h, com `steer +1` e o controle de `throttle` de C8, a aceleração lateral em janela de 0.5 s atinge ≥ 0.75 g em algum passo dos primeiros 120.

Substitui car-handling C9. (AC 9)
Proof: `npx vitest run tests/physics/feel.test.ts -t "reaches at least 0.75 g at 60 kmh"`

**C10** - ✅ 8 casos, `steer +1` por 3 s, sem `handbrake`, sideslip ≤ 12° em todo passo:
- sem `throttle`: 60, 90, 120, 150 e 180 km/h;
- com `throttle`: 120, 150 e 180 km/h.

Substitui car-handling C10. (AC 10)
Proof: `npx vitest run tests/physics/feel.test.ts -t "understeers without throttle or at speed"`

**C11** - A partir de 50 km/h, com `steer +1` e `throttle`:
- `car.gear` é 2 em algum passo dos primeiros 30 (o câmbio sai da 1ª).
- O sideslip passa de 10° em algum passo dos primeiros 120 (2.0 s).

(AC 11)
Proof: `npx vitest run tests/physics/feel.test.ts -t "power oversteer in second gear"`

**C12** - Na continuação de C11, no primeiro passo com sideslip > 10°, `throttle` e `steer` são soltos:
- O sideslip fica abaixo de 8° em algum passo dos 120 seguintes (2.0 s).
- A velocidade dianteira fica > 0 em todos esses passos.

(AC 12)
Proof: `npx vitest run tests/physics/feel.test.ts -t "recovers from power oversteer"`

**C13** - ✅ Ficha e leitura da suspensão (door 1):
- `CarSpec` tem `suspensionStiffness`, `suspensionCompression` e `suspensionRelaxation`, e em `DEFAULT_CAR` os três são finitos e > 0.
- `DEFAULT_CAR` tem `steerRateRadS` 4.0, `steerReturnRadS` 5.0 e `steerLateralG` 1.7; `steerMaxRad` continua 0.55.
- No harness, um `Car` com `{ ...DEFAULT_CAR, suspensionStiffness: 17, suspensionCompression: 1.7, suspensionRelaxation: 2.1 }` tem, nas 4 rodas, `wheelSuspensionStiffness` 17, `wheelSuspensionCompression` 1.7 e `wheelSuspensionRelaxation` 2.1 no controlador do Rapier (lidos de volta, ± 1e-6): a suspensão vem da ficha.

Os valores de direção substituem os de car-handling C28; o resto de C28 continua valendo. (AC 6, AC 7, door 1)
Proof: `npx vitest run tests/unit/carSpec.test.ts -t "default car spec values"`
Proof: `npx vitest run tests/physics/harness.test.ts -t "car reads suspension from its spec"`

### S3 - A câmera acompanha · 5 files · 60 KB · ~15k

**C14** - `cameraRoll(bodyRoll)` em `src/camera/chaseMath.ts` (rad), tolerância 1e-9:

| `bodyRoll` | resultado |
| --- | --- |
| 0 | 0 |
| 0.05 | 0.03 |
| −0.05 | −0.03 |
| 0.1 | 0.06 |
| 0.2 | 4° em rad (0.0698…, o limite) |
| −0.2 | −4° em rad |

(AC 13)
Proof: `npx vitest run tests/unit/chaseMath.test.ts -t "camera roll follows body roll"`

**C15** - `stepRoll(current, target, dt)` em `chaseMath.ts` = `current + (target − current) × smoothingFactor(dt)`:
- `stepRoll(0, 0.06, 1/60)` = `0.06 × (1 − e^(−5/60))` (± 1e-12).
- 60 chamadas de `stepRoll` com `dt` = 1/60 e alvo 0.06, a partir de 0, dão `0.06 × (1 − e^(−5))` (± 1e-9).
- `stepRoll(x, x, dt)` = x.

(AC 14)
Proof: `npx vitest run tests/unit/chaseMath.test.ts -t "camera roll smoothing"`

**C16** - No browser, com o carro parado e `__game.camera.roll` ≈ 0 (|roll| < 0.001 rad), `setForwardSpeed(60 / 3.6)` e `W` + `A` por 2 s:
- `__game.camera.roll` tem o mesmo sinal de `__game.car.bodyRoll` e |roll| ≥ 1° (0.01745 rad).
- A direção de visão da câmera (`camera.getWorldDirection`) fica a menos de 0.5° da direção da posição da câmera até o ponto de `lookAt` (1 m acima do carro): inclinar não muda para onde a câmera olha.

(AC 14, AC 15)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "camera leans with the body"`

**C17** - Continuam verdes, sem mudança nas asserções, as provas que leem direção, aderência e câmera com a ficha nova:
- car-handling C11, C12 e C13 (freio de mão e frenagem com direção)
- car-handling C19 a C23 (0–100, velocidade máxima, rolagem livre, frenagem de 34 a 45 m, rampa de 9 %)
- car-handling C36 (power slide com freio de mão)
- visual-upgrade "camera swings left while turning left"
- free-roam-city "A turns left"

Proof: `npx vitest run tests/physics/grip.test.ts -t "handbrake kicks the rear out|car recovers after the handbrake is released|steers while braking hard|throttle keeps pushing with the handbrake pulled"`
Proof: `npx vitest run tests/physics/powertrain.test.ts -t "zero to 100 kmh between 5.5 and 7.5 s|top speed limited by drag|coasting from 100 to 60 kmh|braking from 100 kmh stops in 34 to 45 m|climbs a 9 percent grade"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "camera swings left while turning left"`
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "A turns left"`

Na tabela de Coverage, `ch-N` é o check N da car-handling.

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| plan ACs (15) | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6, C13 · 7 C7, C13 · 8 C8 · 9 C9 · 10 C10 · 11 C11 · 12 C12 · 13 C14 · 14 C15, C16 · 15 C16 | - |
| landing doors (1) | 1 C13 | - |
| roll directions (2) | esquerda C1, C2 · direita C1 | - |
| understeer cases, 5 sem acelerador + 3 com (8) | C10, table-driven over all 8 | - |
| steering target cases (7) | v=0 C7 · v<1 C7 · min cut C7 · 10 C7 · 27.78 C7 · 55.56 C7 · ré C7 | - |
| suspension fields (3) | stiffness C13 · compression C13 · relaxation C13 | - |
| camera roll cases (6) | 0 C14 · +0.05 C14 · −0.05 C14 · 0.1 C14 · +limite C14 · −limite C14 | - |
| superseded car-handling checks (8) | ch-4 → C1 · ch-5 → C3 · ch-6 → C6 · ch-7 → C7 · ch-8 → C8 · ch-9 → C9 · ch-10 → C10 · ch-28, só direção → C13 | - |
| startup config: car and camera (2 assemblies) | `src/core/Game.ts` constrói `Car` com `DEFAULT_CAR` (check 35 da car-handling, continua) e passa `bodyRoll` à câmera C16 · harness C13 | - |

- **Checks cruzando a fronteira do browser:** C16, C17 (parte Playwright).
- **Checks com física real:** C1-C5, C8-C13 (segunda prova), C17 (parte vitest).

## Test policy

Mesmas linhas das features anteriores.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence:
- **`src/camera/chaseMath.ts` `cameraRoll`, `stepRoll`** → decides, reached across a boundary. Própria: C14, C15. Fronteira: C16.
- **`src/vehicle/drivetrain.ts`** → contrato igual; só os números da ficha mudam. Própria: C6, C7. Fronteira: C8-C12.
- **`src/vehicle/Car.ts`** → lê a suspensão da ficha. Fronteira pelo harness: C13 e C1-C4.
- **`src/vehicle/carSpec.ts`** → dados, C13.
- **`src/camera/ChaseCamera.ts`, `src/core/Game.ts`** → instrumentation, cobertos por C16.

Cost: 4 provas unitárias em 3 arquivos, 10 de física real em 2 arquivos e 1 Playwright nova.

## Swept

- **validation**: C14 (inclinação da câmera limitada a ±4°); C7 (guarda de `v` < 1 e ré)
- **failure modes**: C5 (continua sem capotar com a suspensão mais mole); C12 (a traseira que escapa volta)
- **idempotency**: existing - `stepDrivetrain` puro (check 26 da car-handling); `cameraRoll` e `stepRoll` são funções puras
- **authorization**: n/a - jogo local, sem contas
- **concurrency**: n/a - um laço de física em passo fixo (AD-006) e a câmera no frame de render; nada assíncrono
- **data lifecycle**: n/a - nada persistido
- **dependency failure**: existing - sem o GLB o carro placeholder usa a mesma física (check 33 da free-roam-city)
- **state transitions**: C2 (curva → reta, a carroceria volta); C11, C12 (aderência → escorregamento → aderência)
- **observability**: C16 - `__game.camera.roll` em DEV; `__game.car.bodyRoll`, `bodyPitch`, `sideslip`, `lateralG` já existem (check 33 da car-handling)

## Handoff

- **Estimativa por slice:**
  - S1 ≈ 10k: `Car.ts` 15 KB, `carSpec.ts` 4 KB, harness 6 KB, `feel.test.ts` novo ~10 KB, `stability.test.ts` 5 KB.
  - S2 +13k → 23k: `drivetrain.ts` 7 KB, `drivetrain.test.ts` 14 KB, `grip.test.ts` 6 KB, `carSpec.test.ts` 3 KB, `harness.test.ts` 3 KB, releituras.
  - S3 +15k → 38k: `chaseMath.ts` 3 KB, `chaseMath.test.ts` 4 KB, `ChaseCamera.ts` 3 KB, `Game.ts` ~36 KB lido em parte, `visual.spec.ts` ~26 KB lido em parte.
- **Total:** ~38k, abaixo do budget de 150k - one builder.
- **Base:** `wc -c` dos arquivos existentes mais os novos pelo tamanho dos análogos, dividido por 4.
- **Números de ajuste:** os valores da ficha (`tireGrip`, `rearGripFactor`, suspensão, `comHeightM`) e o modo de reduzir a aderência (`frictionSlip` ou rigidez lateral) são do build, até C1-C12 e C17 passarem. Os limites não mudam. Se um limite novo brigar com um que continua valendo (por exemplo menos aderência lateral contra a frenagem de 34-45 m da car-handling C22), é stop-and-ask.
