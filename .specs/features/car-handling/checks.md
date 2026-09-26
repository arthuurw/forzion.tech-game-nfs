# car-handling checks

Profile: standard
Plan: `.specs/features/car-handling/plan.md`

35 checks in 4 slices · 3 one-way doors · 0 open

## Comandos de prova

- **Unitário:** `npx vitest run <arquivo> -t "<nome>"`.
- **Física real (door 3):** `npx vitest run tests/physics/<arquivo> -t "<nome>"`. O build acrescenta `tests/physics/**/*.test.ts` ao `test.include` de `vite.config.ts`, para que `npm test` rode as duas pastas.
- **Integração:** `npx playwright test <arquivo> -g "<nome>"`. Chromium headless contra `vite dev`, lendo `window.__game`. "N s" é tempo simulado (`__game.simTime`).

### Harness de física

Os testes de física usam o harness de `tests/physics/`:
- `World` do Rapier com gravidade `-9.81`, passo 1/60 s e chão plano de 8 km × 8 km no topo `y = 0`.
- Para C23, uma rampa de 9 % com 400 m.
- O `Car` real, com `DEFAULT_CAR` e assets placeholder.
- Assentamento: o carro começa parado, em pé, e assenta 0.5 s antes de cada manobra.
- "Velocidade inicial V": `setLinvel` ao longo do heading, depois do assentamento.
- Entradas: são as do `DriveInput` do jogo, passadas a `fixedUpdate` a cada passo.

### Grandezas medidas a cada passo

| Grandeza | Definição |
| --- | --- |
| inclinação | ângulo entre o eixo `+Y` do chassi e o `+Y` do mundo |
| rolagem | `asin` da componente `y` do eixo `+X` do chassi; positiva = lado esquerdo para cima |
| arfagem | `asin` da componente `y` do eixo `+Z` do chassi; negativa = frente para baixo |
| sideslip | ângulo entre o eixo `+Z` do chassi projetado no plano e a velocidade horizontal; só com a velocidade horizontal acima de 3 m/s |
| aceleração lateral | `|v_horizontal| × |angvel.y| / 9.81` em g, em média numa janela deslizante de 30 passos (0.5 s) |

## Checks

### S1 - O carro não capota em chão plano · 6 files · 26 KB · ~7k

**C1** - No harness, parado e assentado:
- `body.mass()` está em `[1249, 1251]` kg.
- O centro de massa no mundo (`body.worldCom()`) fica no máximo 0.50 m acima do plano `y = 0`.
- `DEFAULT_CAR.trackM / (2 × essa altura)` ≥ 1.6.

(AC 1, door 1)
Proof: `npx vitest run tests/physics/stability.test.ts -t "mass and low center of mass"`

**C2** - Matriz table-driven de 54 casos: 6 manobras × velocidade inicial 40, 60, 80, 100, 120, 140, 160, 180 e 200 km/h. Cada caso dura 3 s, e a inclinação fica em no máximo 15° em todo passo. As 6 manobras:
- `steer +1`
- `steer −1`
- zigue-zague, trocando o sinal de `steer` a cada 30 passos
- `steer +1` com `throttle`
- `steer +1` com `brake`
- `steer +1` com `handbrake`

(AC 2)
Proof: `npx vitest run tests/physics/stability.test.ts -t "no rollover across the maneuver matrix"`

**C3** - Nos mesmos 54 casos, depois dos 3 s com todas as entradas soltas, as 4 rodas estão em contato (`wheelIsInContact`) em algum passo dentro de 60 passos (1.0 s) (AC 3)
Proof: `npx vitest run tests/physics/stability.test.ts -t "all four wheels back on the ground after release"`

**C4** - Curva à esquerda (`steer +1`) a partir de 80 km/h, com `throttle` ligado sempre que a velocidade está abaixo de 80 km/h, por 3 s:
- A rolagem média dos passos 90–180 está entre −6.0° e −1.0°. Negativa: o lado esquerdo, de dentro da curva, sobe menos que o de fora, ou seja, o carro inclina para fora.
- O mesmo com `steer −1` dá média entre +1.0° e +6.0°.

(AC 4)
Proof: `npx vitest run tests/physics/stability.test.ts -t "body roll leans out of the turn"`

**C5** - Com `brake` a partir de 100 km/h, a menor arfagem nos primeiros 30 passos (0.5 s) está entre −4.0° e −0.5°, com a frente para baixo (AC 5)
Proof: `npx vitest run tests/physics/stability.test.ts -t "nose dives under braking"`

### S2 - Aderência, direção e derrapagem · 5 files · 22 KB · ~6k

**C6** - Rampa do volante em `stepDrivetrain`, a 0 km/h, com `dt` = 1/60 e partindo de `steer` 0:
- Com `steer` do input +1, o `steer` cresce exatamente 2.5/60 rad por passo. Chega a 0.55 no passo 14 e fica em 0.55, sem passar.
- Soltando (input 0), cai exatamente 3.5/60 por passo até 0, sem passar para o lado oposto.
- De +0.55 com input −1, vai até −0.55 sem pular valores: cada passo muda no máximo 3.5/60.
- `D` negativo é o espelho exato de `A`.

(AC 6, door 2)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "steering ramps toward the target"`

**C7** - O ângulo alvo do volante é `min(0.55, atan(1.3 × 9.81 × 2.6 / v²))`, com `v` a velocidade dianteira em m/s. Casos, com tolerância de 1e-6:

| `v` (m/s) | alvo esperado |
| --- | --- |
| 0 | 0.55 |
| 0.9 | 0.55 (guarda de `v` < 1) |
| 5 | 0.55 (a fórmula dá 0.924, e o `min` corta) |
| 10 | `atan(33.1578 / 100)` |
| 27.78 | `atan(33.1578 / 771.73)` |
| 55.56 | `atan(33.1578 / 3086.9)` |
| −5 (ré) | igual ao caso de 5 |

(AC 7)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "steering target shrinks with speed"`

**C8** - Para as velocidades 60, 90, 120, 150 e 180 km/h: `steer +1` por 3 s, com `throttle` ligado sempre que a velocidade está abaixo da inicial. A aceleração lateral em janela de 0.5 s fica ≤ 1.15 g em todo passo (AC 8)
Proof: `npx vitest run tests/physics/grip.test.ts -t "lateral grip never exceeds 1.15 g"`

**C9** - A 60 km/h, com `steer +1` e o mesmo controle de `throttle` de C8, a aceleração lateral em janela de 0.5 s atinge ≥ 0.80 g em algum passo dos primeiros 120 (2 s) (AC 9)
Proof: `npx vitest run tests/physics/grip.test.ts -t "reaches at least 0.8 g at 60 kmh"`

**C10** - 10 casos: velocidades 60, 90, 120, 150 e 180 km/h × {com `throttle`, sem `throttle`}. Com `steer +1`, sem `handbrake`, por 3 s, o sideslip fica ≤ 12° em todo passo (AC 10)
Proof: `npx vitest run tests/physics/grip.test.ts -t "understeers instead of spinning"`

**C11** - A 60 km/h, com `steer +1` e `handbrake`, o sideslip passa de 20° em algum passo dos primeiros 90 (1.5 s) (AC 11)
Proof: `npx vitest run tests/physics/grip.test.ts -t "handbrake kicks the rear out"`

**C12** - Na continuação de C11:
- No primeiro passo em que o sideslip passa de 20°, `handbrake` e `steer` são soltos.
- O sideslip fica abaixo de 8° em algum passo dentro dos 150 seguintes (2.5 s).
- O carro não passa a andar para trás: a velocidade dianteira fica > 0.

(AC 12)
Proof: `npx vitest run tests/physics/grip.test.ts -t "car recovers after the handbrake is released"`

**C13** - A 100 km/h, com `brake` e `steer +1` por 60 passos (1.0 s), o heading muda pelo menos +0.20 rad, com diferença normalizada em (−π, π] (AC 13)
Proof: `npx vitest run tests/physics/grip.test.ts -t "steers while braking hard"`

**C14** - `stepDrivetrain` com `brake` a 60 km/h:
- `engineForce` é 0.
- `brakeFront + brakeRear` = `brakeForceN`.
- `brakeFront / (brakeFront + brakeRear)` = `brakeBiasFront` = 0.65 (± 1e-9).
- Os dois freios são > 0.

Substitui free-roam-city C2, que exigia freio igual nos dois eixos. (AC 13, AC 21)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "brake split front biased"`

### S3 - Motor, câmbio e freios · 4 files · 24 KB · ~6k

**C15** - Com `throttle`, marcha 3 e `wheelSpeedMs` tal que o `rpm` resultante seja 4500, `engineForce` = `torque(4500) × gearRatios[2] × finalDrive × drivetrainEfficiency / wheelRadiusM` (± 1e-6). Além disso:
- `torque` interpola linearmente: no ponto médio entre dois pontos consecutivos da `torqueCurve`, dá a média dos dois torques.
- Em cada ponto da curva, dá o valor exato.
- Com `rpm` ≥ `redlineRpm`, `engineForce` = 0 (limitador).
- Sem `throttle`, `engineForce` ≤ 0 (freio-motor).

(AC 14)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "engine force follows the torque curve"`

**C16** - `rpm` do estado devolvido, com `wheelSpeedMs` = `v`:

| Caso | `rpm` esperado |
| --- | --- |
| marcha 3, `v` = 20, sem `throttle` | `max(1000, 20 / wheelRadiusM × 60 / 2π × gearRatios[2] × finalDrive)` (± 1e-6) |
| marcha 2, `v` = 0, sem `throttle` | 1000 |
| marcha 1, `v` = 1, com `throttle` | ≥ 2500 (embreagem patinando) |
| ré, `v` = −1, com `brake` | ≥ 2500 |
| marcha 1, `v` = 60 (acima do corte) | 7000 |

O `rpm` fica sempre em `[1000, 7000]` numa varredura de `v` de −10 a 80 m/s em todas as marchas. Substitui free-roam-city C28. (AC 15)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "rpm from wheel speed and gear"`

**C17** - Troca para cima:
- Na marcha 2, com `throttle` e `v` que dá `rpm` ≥ 6500, o estado seguinte tem `gear` 3 e `shiftTimer` 0.25.
- Nos 15 passos seguintes (0.25 s), mantendo o input, `engineForce` = 0. No 16º passo, `engineForce` > 0.
- Na 6ª, com `rpm` ≥ 6500, `gear` continua 6.

(AC 16, door 2)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "upshift at 6500 rpm with power cut"`

**C18** - Troca para baixo:
- Na marcha 4, com `rpm` ≤ 2800 e `lastShiftAgo` ≥ 0.6, vai para a 3ª quando o `rpm` na 3ª fica abaixo de 6500.
- Na mesma situação, mas com `v` tal que o `rpm` na 3ª seria ≥ 6500, continua na 4ª.
- Com `lastShiftAgo` = 0.5, nenhuma troca acontece, nem para cima nem para baixo.
- Na 1ª, com `rpm` baixo, continua na 1ª.

Com C17, substitui free-roam-city C27. (AC 17, door 2)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "downshift with hysteresis and hold time"`

**C19** - No harness, parado e com `throttle`, o carro atinge 100 km/h num passo entre 5.5 s e 7.5 s de simulação (AC 18)
Proof: `npx vitest run tests/physics/powertrain.test.ts -t "zero to 100 kmh between 5.5 and 7.5 s"`

**C20** - Top speed:
- No harness, com `throttle` por 60 s, a velocidade aos 60 s está em `[215, 240]` km/h.
- Entre 50 s e 60 s, ela varia menos de 3 km/h.
- Em `stepDrivetrain` na 6ª a 230 km/h, com `rpm` abaixo de 7000, `engineForce` > 0: não há corte por velocidade.

Substitui free-roam-city C8. (AC 19)
Proof: `npx vitest run tests/physics/powertrain.test.ts -t "top speed limited by drag"`
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "no speed cut below redline"`

**C21** - No harness, a 100 km/h e sem entradas, o carro cai a 60 km/h num passo entre 4 s e 12 s (AC 20)
Proof: `npx vitest run tests/physics/powertrain.test.ts -t "coasting from 100 to 60 kmh"`

**C22** - No harness, com `brake` a partir de 100 km/h em linha reta, a distância horizontal até a velocidade dianteira chegar a ≤ 1 km/h está em `[34, 45]` m (AC 21)
Proof: `npx vitest run tests/physics/powertrain.test.ts -t "braking from 100 kmh stops in 34 to 45 m"`

**C23** - No harness, parado na rampa de 9 % e virado para cima, com `throttle`, o carro atinge 60 km/h em até 10 s (AC 22)
Proof: `npx vitest run tests/physics/powertrain.test.ts -t "climbs a 9 percent grade"`

**C24** - Ré em `stepDrivetrain`:
- Com `brake` e velocidade dianteira ≤ 1 km/h, entra em `gear` −1 com `engineForce` < 0.
- Em ré, `engineForce` < 0 a −29 km/h e = 0 a −30 e a −31 km/h (corte a −29.5).
- Com `throttle` em `gear` −1 e velocidade ≥ −1 km/h, volta para `gear` 1.

Substitui free-roam-city C4, com o mesmo contrato do AC 3. (free-roam-city AC 3, door 2)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "reverse gear capped at 30 kmh"`

**C25** - Com `handbrake` a 60 km/h, `stepDrivetrain` dá:
- `brakeFront` = 0.
- `brakeRear` > 0.
- `rearFrictionFactor` = `handbrakeRearGrip` = 0.4.
- Sem `handbrake`, `rearFrictionFactor` = 1.

Substitui free-roam-city C7, com o mesmo contrato do AC 5. (free-roam-city AC 5)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "handbrake locks rear and cuts rear grip"`

**C26** - `stepDrivetrain` é pura:
- Duas chamadas com o mesmo `(spec, state, input, wheelSpeedMs, dt)` devolvem resultados iguais campo a campo.
- O objeto `state` recebido não muda (congelado com `Object.freeze` no teste).
- O módulo não exporta mais `computeDrive`, `gearFor` nem `rpmFor`.

(door 2)
Proof: `npx vitest run tests/unit/drivetrain.test.ts -t "drivetrain step is pure"`

### S4 - Jogo, efeitos e fichas · 9 files · 90 KB · ~23k

**C27** - `src/vehicle/carSpec.ts` e `src/vehicle/drivetrain.ts` estão na lista de módulos puros: nenhum importa `three` nem `@dimforge/rapier3d-compat` (door 1, door 2)
Proof: `npx vitest run tests/unit/purity.test.ts -t "pure modules do not import three or rapier"`

**C28** - Valores de `DEFAULT_CAR`:
- `massKg` 1250, `wheelbaseM` 2.6, `trackM` 1.7, `wheelRadiusM` 0.45.
- `idleRpm` 1000, `redlineRpm` 7000.
- `gearRatios` com 6 valores estritamente decrescentes.
- `shiftUpRpm` 6500, `shiftDownRpm` 2800, `shiftTimeS` 0.25.
- `brakeBiasFront` 0.65, `handbrakeRearGrip` 0.4.
- `steerMaxRad` 0.55, `steerLateralG` 1.3, `steerRateRadS` 2.5, `steerReturnRadS` 3.5.
- `torqueCurve` com pelo menos 4 pontos em rpm crescente, cobrindo `[idleRpm, redlineRpm]`.
- Todos os 26 campos de `CarSpec` estão presentes e são finitos.

No harness, um `Car` construído com `{ ...DEFAULT_CAR, massKg: 1500 }` tem `body.mass()` em `[1499, 1501]`: a ficha é lida, não copiada. (door 1)
Proof: `npx vitest run tests/unit/carSpec.test.ts -t "default car spec values"`
Proof: `npx vitest run tests/physics/harness.test.ts -t "car reads mass from its spec"`

**C29** - O harness monta o jogo de verdade:
- O `Car` tem um `DynamicRayCastVehicleController` com 4 rodas.
- Depois de 60 passos parado no plano, as 4 rodas estão em contato, a velocidade é < 0.1 km/h e a inclinação < 1°.
- `npm test` inclui `tests/physics`: o `test.include` de `vite.config.ts` contém `tests/physics/**/*.test.ts`.

(door 3)
Proof: `npx vitest run tests/physics/harness.test.ts -t "harness builds the real car at rest"`

**C30** - `isSkidding(handbrake, kmh, lateralSlipMs)`:

| Entrada | Resultado |
| --- | --- |
| `(false, 100, 2.6)` | true |
| `(false, 100, 2.5)` | false |
| `(false, 5, 3)` | true |
| `(true, 21, 0)` | true |
| `(true, 20, 0)` | false |
| `(false, 100, 0)` | false |

Substitui a parte unitária do check 36 da visual-upgrade. (AC 23)
Proof: `npx vitest run tests/unit/effectsMath.test.ts -t "skidding from lateral slip or handbrake"`

**C31** - No harness, com o carro assentado:
- Com velocidade de 60 km/h ao longo do heading mais 5 m/s de lado, `car.skidding` fica true já no primeiro passo, sem freio de mão.
- Em linha reta a 100 km/h, sem entradas, `car.skidding` fica false em todos os 60 passos.

(AC 23)
Proof: `npx vitest run tests/physics/grip.test.ts -t "skidding from real lateral slip"`

**C32** - No browser, segurando `W` a partir do spawn por 4 s de simulação e amostrando `__game.car.gear`, `__game.car.rpm` e o texto de `#gear`:
- Há pelo menos uma amostra em que `gear` aumenta de uma para a seguinte.
- Nessa troca, o `rpm` da amostra anterior menos o menor `rpm` nas amostras dentro dos 0.3 s seguintes é ≥ 1500.
- `#gear` mostra `String(gear)` em toda amostra.

(AC 24, AC 25)
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "automatic upshift drops rpm on the hud"`

**C33** - No browser, `__game.car` expõe:
- `spec.massKg` = 1250.
- `steerInput` em `[-0.55, 0.55]`.
- `bodyRoll`, `bodyPitch`, `sideslip` e `lateralG` como números finitos.
- Depois de segurar `A` por 0.5 s a 0 km/h, `steerInput` > 0.5.

(Surface, AC 6)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "car debug exposes handling state"`

**C34** - Continuam verdes, sem mudança nas asserções, as provas não superadas que leem a mecânica do carro:
- free-roam-city C1, C3, C5 e "A turns left"
- free-roam-city C29 (HUD de marcha e RPM)
- engine-sound C13 e C15 (som segue `rpm`)
- visual-upgrade C13 e C14 (marcas e fumaça com freio de mão)
- visual-upgrade "camera swings left while turning left"

(AC 24)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "throttle reaches 50 kmh within 5s"`
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "brake reduces speed"`
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "reverse drives backward up to 30 kmh"`
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "A turns left"`
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "gear and rpm bar match car state"`
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "lowpass cutoff follows rpm"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "handbrake leaves skid marks"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "tire smoke while skidding"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "camera swings left while turning left"`

**C35** - `Game` constrói o carro com `DEFAULT_CAR`: no browser, `__game.car.spec` é igual campo a campo a `DEFAULT_CAR` (importado no teste via `page.evaluate` sobre o módulo servido pelo Vite) (door 1, startup config)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "game builds the car from the default spec"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| plan ACs (25) | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6, C33 · 7 C7 · 8 C8 · 9 C9 · 10 C10 · 11 C11 · 12 C12 · 13 C13, C14 · 14 C15 · 15 C16 · 16 C17 · 17 C18 · 18 C19 · 19 C20 · 20 C21 · 21 C22, C14 · 22 C23 · 23 C30, C31 · 24 C32, C34 · 25 C32 | - |
| landing doors (3) | 1 C1, C27, C28, C35 · 2 C6, C17, C18, C24, C26, C27 · 3 C29 | - |
| rollover matrix, 6 manobras × 9 velocidades (54) | C2 e C3, table-driven over all 54 | - |
| maneuvers in the matrix (6) | steer left C2 · steer right C2 · zigzag C2 · steer+throttle C2 · steer+brake C2 · steer+handbrake C2 | - |
| understeer cases, 5 velocidades × 2 (10) | C10, table-driven over all 10 | - |
| gearbox transitions (8) | up 2→3 C17 · no up from 6th C17 · power cut during shift C17 · down 4→3 C18 · down blocked by overrev C18 · hold 0.6 s C18 · no down from 1st C18 · into and out of R C24 | - |
| rpm regimes (5) | wheel-driven C16 · idle floor C16 · clutch floor in 1st C16 · clutch floor in R C16 · redline cap C16, C15 | - |
| drive input regimes (6) | throttle C15, C19 · brake forward C14, C22 · reverse C24 · handbrake C25, C11 · coast C21, C15 · steer C6, C7 | - |
| steering target cases (7) | v=0 C7 · v<1 guard C7 · min cut C7 · 10 m/s C7 · 27.78 m/s C7 · 55.56 m/s C7 · reverse C7 | - |
| skidding table (6) | slip 2.6 C30 · slip 2.5 C30 · slip at 5 km/h C30 · handbrake 21 C30 · handbrake 20 C30 · nothing C30 | - |
| superseded free-roam checks (7) | C2 → C14 · C4 → C24 · C6 → C6, C7 · C7 → C25 · C8 → C20 · C27 → C17, C18 · C28 → C16 | - |
| superseded visual checks (1) | visual-upgrade check 36 (parte unitária) → C30 (browser part: skidCount = 2 × passos com freio de mão continua valendo e é provada por visual C13) | - |
| startup config: car construction (2 assemblies) | `src/core/Game.ts` (browser) C35 · `tests/physics` harness C29 | - |

- **Checks cruzando a fronteira do browser (Playwright):** C32, C33, C34, C35.
- **Checks com física real (harness):** C1-C5, C8-C13, C19-C23, C28 (segunda prova), C29 e C31.
- Nenhum outro check afirma mais que o caso que sua prova exercita. As matrizes de C2, C3 e C10 são enumeradas no próprio teste.

## Test policy

Mesmas linhas das features anteriores (o repositório ainda não as tem em diretrizes).

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence (forma prevista; o Verifier reconta sobre o diff):

- **`src/vehicle/drivetrain.ts`** → decides, reached across a boundary (teclas → Rapier). Pontos de decisão:
  - rampa do volante (subir, voltar, trocar de lado)
  - guarda de `v` < 1 no alvo
  - 3 regras de troca (subir, descer, segurar)
  - corte de força na troca
  - piso da embreagem (1ª e R)
  - limitador
  - ré (entrar, cortar, sair)
  - freio de mão
  - divisão de freio

  Próprias: C6, C7, C14-C18, C20 (unit), C24-C26. Fronteira: C8-C13, C19-C23 (harness) e C32.
- **`src/vehicle/effectsMath.ts` `isSkidding`** → decides, reached across a boundary. Tem 2 regras (escorregamento e freio de mão) com arestas. Própria: C30. Fronteira: C31 (harness) e visual C13/C14 (browser).
- **`src/vehicle/Car.ts`** → decide pouco. Aplica massa e centro de massa da ficha, o comando nas rodas e o arrasto no corpo, e mede o escorregamento lateral por roda. Provado na fronteira pelo harness: C1, C28, C29, C31.
- **`src/vehicle/carSpec.ts`** → dados. Os valores estão em C28.
- **`src/core/Game.ts`, `src/hud/Hud.ts`, `src/audio/AudioEngine.ts`** → instrumentation. Cobertos por C32-C35.

Cost: 13 provas unitárias em 4 arquivos, 17 de física real em 4 arquivos e 4 Playwright novas. Sem essas linhas, as regras do câmbio seriam provadas só pelo caminho que um teste de aceleração percorre.

## Swept

- **validation**: C7 (guarda de `v` < 1 e ré), C15 (limitador, `rpm` fora da curva), C16 (`rpm` sempre em `[1000, 7000]`)
- **failure modes**: C2, C3 (nenhuma manobra capota no plano). Capotar por batida continua possível e é desfeito pelo reset existente (free-roam-city C9 do AC 9, "reset puts car upright")
- **idempotency**: C26 (mesmo estado e entrada, mesmo resultado; o estado não é mutado)
- **authorization**: n/a - jogo local, sem contas
- **concurrency**: n/a - um único laço de física em passo fixo de 1/60 s (AD-006). O estado do câmbio só muda dentro de `fixedUpdate`; não há workers nem async na física
- **data lifecycle**: n/a - nada é persistido; a ficha é uma constante do código
- **dependency failure**: existing - sem o GLB, o carro placeholder usa a mesma física (free-roam-city C33). O harness roda sempre com o placeholder (C29)
- **state transitions**: C17, C18, C24 (marchas, incluindo R); C11, C12 (aderência → derrapagem → aderência); C6 (volante centro → lado → centro)
- **observability**: C33 - `__game.car` expõe `spec`, `steerInput`, `bodyRoll`, `bodyPitch`, `sideslip` e `lateralG` em DEV; C32 lê `gear` e `rpm`

## Handoff

- **Estimativa por slice:**
  - S1 ≈ 7k: `Car.ts` 10 KB, `carSpec.ts` novo ~3 KB, harness + `stability.test` novos ~10 KB, `vite.config` e `purity.test` ~2 KB.
  - S2 +6k → 13k: `drivetrain.ts` 4 KB, `drivetrain.test` 3 KB, `grip.test` novo ~8 KB, releituras.
  - S3 +6k → 19k: `powertrain.test` novo ~6 KB, mais `drivetrain` e seu teste de novo.
  - S4 +23k → 42k: `Game.ts` ~30 KB, `effectsMath` e seu teste ~7 KB, `hud.spec` 7.5 KB, `audio.spec` 6.7 KB, `drive.spec` 6 KB, `visual.spec` 18 KB lido em parte, `carSpec.test` novo ~2 KB.
- **Total:** ~42k, abaixo do budget de 150k - one builder.
- **Base:** estimativa por `wc -c` dos arquivos existentes (medidos antes deste artefato) mais os novos pelo tamanho dos análogos, dividido por 4.
- **Números de ajuste:** os números da ficha (relações de marcha, curva de torque, `cdA`, `tireGrip`, altura do centro de massa, rigidez e amortecimento da suspensão) são ajustados no build até C1-C23 passarem. Os limites dos checks não mudam para caber o ajuste. Um limite impossível de cumprir ao mesmo tempo que outro é stop-and-ask.
