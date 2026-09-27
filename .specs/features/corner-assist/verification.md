# Corner assist verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: c9f1700..c3e564f (branch `corner-assist`: e0f605a, 0cf4e01, 7af7b8c; merge c3e564f com a block-fill)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Resumo: as 14 checks têm prova verde em c3e564f e asserção localizada. A fórmula bate com a door 1 ao pé da
letra, a força entra no centro de massa, na horizontal, perpendicular à velocidade e multiplicada por `dt`. A
AD-014 é respeitada: só existem duas ajudas arcade. O FAIL vem de **uma falta que sobreviveu**:
- Troquei o lado da força em ré no `Car` (`side = 1 / speed` em vez de `Math.sign(forwardSpeed) / speed`).
- Toda a suíte vitest (148 testes) passou com essa falta.
- A door 1 diz "positivo = para a esquerda do carro". A C6 prova o sinal em ré só na função pura (linha
  "ré"). Nenhuma prova dirige o `Car` de ré acima de 5 m/s.
- A ré chega a 30 km/h (8.3 m/s, `drivetrain.ts:174`), então esse ramo roda no jogo.

## Binding sources

O `plan.md` não marca nenhuma fonte como binding. As `Sources` são a fala do usuário e medições do harness.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| nenhuma fonte binding | n/a | - | - |

## Checks

Verified at c3e564f, no worktree do Verifier. Criei a junction de `node_modules`, que o git ignora, e o
`git status --porcelain` ficou vazio antes e depois.
- `npx vitest run` (suíte toda): 37 arquivos, **148 passaram**, 0 falharam, exit 0 (30.6 s). Os testes de
  geração do mundo e a matriz de capotamento não deram timeout, mesmo com a outra suíte rodando na máquina.
- Uma chamada só com os 9 arquivos e os 27 nomes das provas mais `car spec` (`--reporter=verbose`): **28
  passaram**, 5 skipped (os que ficaram fora do `-t`). Cada nome citado em C1-C14 aparece com ✓.
- `E2E_PORT=5203 npx playwright test tests/e2e/drive.spec.ts tests/e2e/visual.spec.ts -g "car debug exposes the
  corner assist force|A turns left|game builds the car from the default spec|car debug exposes the yaw assist
  torque|camera swings left while turning left|camera leans with the body"`: **6 passaram** (3.0 min, exit 0).
  - `drive.spec.ts:49`, `:64`, `:77` (novo) e `:164`.
  - `visual.spec.ts:272` e `:304`.

"Sem mudar asserções" (C9-C14): o `git diff c9f1700 c3e564f --stat` não toca `stability`, `feel`, `grip`,
`powertrain` nem `visual.spec.ts`. Em `agility.test.ts` só saiu o teste superado (ver Coverage).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | giro em regime a 100 km/h ≥ 31.8°/s | vitest `radius at most 50 m at 100 kmh` ✓ | `tests/physics/cornering.test.ts:52` `steadyYaw(hold(100, 180).yaw) >= 0.555`; média dos passos 120-180 em `:37-38` (61 amostras). Medido: 32.84°/s | PASS |
| C2 | giro em regime a 140 km/h ≥ 22.3°/s | vitest `radius at most 100 m at 140 kmh` ✓ | `tests/physics/cornering.test.ts:57` `>= 0.3892`. Medido: 23.67°/s | PASS |
| C3 | giro em regime a 60 km/h ≥ 35°/s | vitest `still turns at least 35 degrees per second at 60 kmh` ✓ | `tests/physics/cornering.test.ts:62` `>= 35 * DEG`. Medido: 54.89°/s | PASS |
| C4 | 60/90/120/150/180 km/h, janela ≤ 1.7 g em todo passo | vitest `lateral acceleration never exceeds 1.7 g` ✓ | `tests/physics/cornering.test.ts:71` `toBeLessThanOrEqual(1.7)` por passo; `:70` 180 passos; as 5 velocidades em `:67`. Maior medido: 1.633 g (60 km/h) | PASS |
| C5 | depois de soltar a 100 km/h, < 0.15 g em algum dos 60 passos | vitest `path straightens within 1 s after release` ✓ | `tests/physics/cornering.test.ts:84` `after.some(x => x < 0.15)`; `:83` 60 passos. Medido: passo 29 | PASS |
| C6 | fórmula da door 1, 9 linhas, tol 1e-3 | vitest `corner assist force fills lateral acceleration above the start` ✓ | `tests/unit/cornerAssist.test.ts:6-12` ficha 1000/2.6/0.9/1.7. Linhas `:23-31` iguais às 9 de `checks.md:43-51`. `:38` `Math.abs(f - expected) <= TOL`; `:33` `rows.length` = 9. Conferi à mão: 1000 · (400 · tan 0.1 / 2.6 − 8.829) = 6607.103 | PASS |
| C7 | ficha com 2 campos; `cornerAssistN` 0 com max = start e > 0 em ≥ 60 passos com a ficha; rolagem com e sem difere ≤ 1.0°; > 0 andando, 0 parado; no browser 0 no spawn e > 0 com W 2 s + A 0.5 s | vitest `car applies the corner assist from its spec at the center of mass` ✓; pw `car debug exposes the corner assist force` ✓ (porta 5203) | `tests/physics/cornering.test.ts:93-96` finitos, `start > 0`, `max > start`. `:102` `f` = 0 em todo passo com max = start. `:104` `>= 60`. `:109` `abs(rollOn - rollOff) <= 1.0`. `:112` `> 0`. `:117` `toBe(0)` parado. Browser: `tests/e2e/drive.spec.ts:78` `toBe(0)` e `:86` `toBeGreaterThan(0)`. O texto do 1º bullet, trocado em e0f605a, bate com `:97-104`. Medido: 180/180 passos > 0, rolagem 4.907° contra 5.038° (diferença de 0.13°) | PASS |
| C8 | `cornerAssist.ts` na lista pura | vitest `pure modules do not import three or rapier` ✓ | `tests/unit/purity.test.ts:40`; `:48` `toBe(29)`, a união do merge (25 + 3 da block-fill + 1); `:51` `FORBIDDEN.test(source)` é `false` | PASS |
| C9 | ch C2 e C3 verdes, sem mudança | vitest `no rollover across the maneuver matrix` ✓, `all four wheels back on the ground after release` ✓ | `tests/physics/stability.test.ts:74` `maxTilt <= 15`; `:83-84` de 1 a 60 passos. Medido: maior inclinação 5.33° (+1 com acelerador a 60 km/h); todas as rodas voltam no passo 1 | PASS |
| C10 | cf C1-C4 verdes, sem mudança | vitest os 4 nomes ✓ | `tests/physics/feel.test.ts:36-40` rolagem entre 3.5 e 6 (medido: ±4.93); `:53-57` balanço de volta (−0.91; 0.00); `:71-72` arfagem ao frear entre −5 e −2 (medido: −2.62); `:84-85` ao acelerar entre 1 e 4 (medido: 2.93) | PASS |
| C11 | cf C10, 10 casos, sideslip ≤ 12° | vitest `understeers without throttle or at speed` ✓ | `tests/physics/feel.test.ts:117` `slip <= 12`; `:122` `run` = 10. Maior medido: 4.99° | PASS |
| C12 | ch C11, C12, C13, C36 | vitest os 4 nomes ✓ | `tests/physics/grip.test.ts:25` `max > 20` (medido: 80.1°); `:50`, `:55`, `:59` (volta no passo 28); `:91` `turned >= 0.2` (0.605 rad); `:37` `run(true) > run(false) + 2` (59.2 contra 45.7) | PASS |
| C13 | ya C1, C4, C6 | vitest os 3 nomes ✓ | `tests/physics/agility.test.ts:45` `first <= 15` (medido: **14**); `:69` `first <= 48` (3) e `:71` `< 3°/s` até o passo 60; `:81` `max(g) >= 0.85` (1.632) | PASS |
| C14 | ch C19-C23 e provas do browser | vitest os 5 de `powertrain` ✓; pw 5 ✓ (porta 5203) | `tests/physics/powertrain.test.ts:20-21` (5.78 s), `:38-40` (223.7 km/h), `:53-54` (5.47 s), `:71-72` (40.5 m), `:84`. `tests/e2e/drive.spec.ts:60` `d > 0.15`, `:73`, `:169` `toBe(34)`, `:170` `live toEqual expected`. `tests/e2e/visual.spec.ts:291-293`, `:299-300`, `:324-325`, `:349`, `:351` | PASS |

### Julgamento da implementação

- **Fórmula (door 1).** `src/vehicle/cornerAssist.ts:28` `requested = v² · tan(steer) / wheelbaseM`. `:29-31` fazem
  `clamp(|a| − startG · 9.81, 0, (maxG − startG) · 9.81)`, e `:33` `sign(a) · massKg · fill`. `:27` dá zero com
  freio de mão, com `|v| < 5` e com menos de 2 rodas. Bate com a door literalmente.
- **Aplicação.** `src/vehicle/Car.ts:378` passa `this.drive.steer`, que é o ângulo das rodas em rad, e a
  velocidade ao longo da frente. `:386` usa `applyImpulse`, que o Rapier aplica no centro de massa, sem ponto.
  - `y: 0`: a força é horizontal.
  - A direção é `+Y × v` horizontal: perpendicular à velocidade, com módulo `N · dt` (`:385`).
  - O sinal em ré vem de `Math.sign(forwardSpeed)` (`:384`). Fiz a conta: de ré, `+Y × v` aponta para a
    direita do carro, e o sinal negativo leva de volta para a esquerda. Então está certo, mas **sem prova**
    (F5).
- **Ordem.** A chamada fica em `Car.ts:184`, depois de `updateVehicle` e da ajuda de giro, no passo fixo.
- **AD-014.** `.specs/STATE.md:43` admite duas ajudas e nenhuma outra. `rg applyImpulse|applyTorqueImpulse src`
  acha 4 lugares:
  - `Car.ts:315` é `applyResistance`: arrasto e rolamento, física.
  - `:354` é `restoreRollMoment`: física, já julgada na yaw-assist.
  - `:368` é a ajuda de giro.
  - `:386` é a força de curva.
  - Não há terceira ajuda. O `setLinvel` de `Game.ts:596` é o `setForwardSpeed` do handle DEV, só para testes.

## Coverage

Verified at c3e564f. Os membros vêm do `plan.md` (ACs, door, Surface) e de `src/` (ramos).

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (12) | `plan.md` Criteria, AC 1-12 | 1 `cornering.test.ts:52` · 2 `:57` · 3 `:62` · 4 `:71` · 5 `:84` · 6 `cornerAssist.test.ts:38` e `cornering.test.ts:117` · 7 `stability.test.ts:74`, `:83-84` · 8 `feel.test.ts:36-40`, `:53-57`, `:71-72`, `:84-85` · 9 `feel.test.ts:117` · 10 `grip.test.ts:25`, `:59`, `:91`, `:37` · 11 `agility.test.ts:45`, `:69`, `:81` · 12 `powertrain.test.ts:20-84` | - |
| door 1 - obrigações (6) | `plan.md` Landing | assinatura e fórmula `cornerAssist.test.ts:38` · 2 campos na `CarSpec` `cornering.test.ts:93-96`, `carSpec.test.ts:38-39`, `:77` · pura `purity.test.ts:40`, `:51` · no centro de massa `cornering.test.ts:109` (F1 morre) · horizontal e perpendicular, lado esquerdo de frente `cornering.test.ts:52`, `:104` · **lado esquerdo do carro em ré, no `Car`** | ré no `Car` (`Car.ts:384`): nenhuma prova; F5 sobrevive |
| corner assist cases (9) | `checks.md:43-51`, `src/vehicle/cornerAssist.ts:27-33` | abaixo do início `cornerAssist.test.ts:23` · livre `:24` · limitado `:25` · lado oposto `:26` · ré `:27` · abaixo de 5 m/s `:28` · 1 roda `:29` · 2 rodas `:30` · freio de mão `:31`; todos em `:38` | - |
| ramos de `applyCornerAssist` (4) | `src/vehicle/Car.ts:376-387` | força zero, sem impulso `cornering.test.ts:102` · de frente `:104`, `:52` · velocidade horizontal < 1e-6 (guarda sem efeito, a função já zera abaixo de 5 m/s) · **de ré** | ramo de ré: nenhuma prova (F5) |
| spec fields (2) | `plan.md` Landing, `src/vehicle/carSpec.ts:60-62`, `:105-106` | startG e maxG `cornering.test.ts:93-96`; lidos pelo `Car` `:102` e `:104`; `carSpec.test.ts:38-39`; browser `drive.spec.ts:169-170` | - |
| DEV field, Surface (1) | `plan.md` Surface; `src/core/Game.ts:581-582` | `__game.car.cornerAssistN` `drive.spec.ts:78` (0 no spawn), `:86` (> 0 virando à esquerda) | - |
| superseded yaw-assist checks (1) | diff de `tests/` e `yaw-assist/checks.md` (nota antes de C5) | ya-5 → C4 `cornering.test.ts:71` | - |
| startup config: car construction (1 assembly) | `src/core/Game.ts:164` `new Car(..., DEFAULT_CAR)` | ch C35 `drive.spec.ts:169-170` ✓ | - |

### Diff de `tests/`: nada enfraquecido além do superado

`git diff c9f1700 c3e564f -- tests | grep '^-'` só mostra estas remoções:
- o teste `lateral grip never exceeds 1.05 g` de `agility.test.ts`, que é o superado previsto;
- as contagens `32 → 34`, em `carSpec.test.ts:77` e `drive.spec.ts:169`;
- a contagem `25 → 29`, em `purity.test.ts:48`;
- dois comentários.

As contagens subiram porque a lista ficou maior, então não ficaram mais fracas. Nenhum matcher ou tolerância
mudou.

## Test policy rows

Verified at c3e564f.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/vehicle/cornerAssist.ts` | própria C6 · fronteira C1-C5, C7 | yes. Cada linha da tabela de decisão tem caso (`cornerAssist.test.ts:23-31`). Na fronteira: C1-C5 e C7 `:102`, `:104`. F2 e F3 morrem na C6 |
| Car aplica no centro de massa e lê a ficha ("fronteira pelo harness") | `src/vehicle/Car.ts` | C7 | no. Centro de massa (`cornering.test.ts:109`, F1 morre), `dt` (F4 morre) e ficha (`:102`) estão provados. O `Car` também decide o lado da força pelo sentido da marcha (`Car.ts:384`), e o ramo de ré não tem caso: gap, F5 sobrevive |
| Dados | `src/vehicle/carSpec.ts` | C7 | yes. `cornering.test.ts:93-96`, `carSpec.test.ts:77` |
| Instrumentation, pass-throughs | `src/core/Game.ts` (getter DEV `:581-582`) | coberto pela prova do consumidor | yes. `drive.spec.ts:78` e `:86` |

## Faults injected

Rodei num worktree de rascunho separado (`git worktree add --detach <scratchpad>/ca-faults HEAD`), sem
`git stash`.
- O rascunho usou uma junction de `node_modules`. Apliquei uma falta por vez e desfiz cada uma com
  `git checkout -- src`.
- No rascunho também rodei sondas de medição (arquivos `z*.test.ts`) e apaguei todas. O `git status
  --porcelain` do rascunho ficou vazio no fim.
- Apaguei a junction com `(Get-Item ...\node_modules).Delete()` antes do `git worktree remove`. O
  `node_modules` compartilhado continua (`vitest` presente).
- O `git status --porcelain` do worktree do Verifier ficou vazio antes e depois.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 força no chão, abaixo do centro de massa: `applyImpulseAtPoint(..., { y: com.y - comHeightM })` | `src/vehicle/Car.ts:386` | yes. C7 `tests/physics/cornering.test.ts:109`: "expected 82.49 to be less than or equal to 1" (o carro capota) |
| F2 sem a guarda do freio de mão em `:27` | `src/vehicle/cornerAssist.ts:27` | yes. C6 `tests/unit/cornerAssist.test.ts:38` "handbrake: got 7848, expected 0". Na fronteira também: C12 `grip.test.ts:25` (17.66 ≤ 20) e `:50` |
| F3 sem subtrair o início: `extra = Math.abs(requested)` | `src/vehicle/cornerAssist.ts:29` | yes. C6 `tests/unit/cornerAssist.test.ts:38` "below the start: got 1924.68, expected 0". C4, C10 e C11 passam com essa falta, então só a própria camada pega |
| F4 sem `dt`: `k = cornerAssistN * side` | `src/vehicle/Car.ts:385` | yes. C4 `tests/physics/cornering.test.ts:71` "60 km/h step 12: 1.77 ≤ 1.7" e C7 `:109` (9.997 ≤ 1) |
| F5 sem o sinal da marcha: `side = 1 / speed` (em ré a força vai para a direita do carro) | `src/vehicle/Car.ts:384` | no. `npx vitest run tests/physics tests/unit`: 37 arquivos, 148 testes passaram. Nenhuma prova dirige o `Car` de ré. A sonda a −28 km/h com `steer +1` mostra que a falta muda o comportamento: força em 24 de 60 passos contra 42 no original, giro −1.085 contra −1.283 rad/s |

## Swept existing

- **dependency failure**: "sem o GLB, o carro placeholder usa a mesma física (check 33 da free-roam-city)".
  Confere:
  - A C33 existe em `free-roam-city/checks.md:119`.
  - Em `Car.ts`, `assets` só decide `placeholder` (`:102`) e o modelo visual (`:453`).
  - `applyCornerAssist` (`:376-387`) não lê `assets`.
- **observability** (C7): `car.cornerAssistN` está em `Car.ts:82` e `:378`, e `__game.car.cornerAssistN` em
  `Game.ts:581-582`. As provas são `cornering.test.ts:112`, `:117` e `drive.spec.ts:78`, `:86`. Confere.
- Os `n/a` são idempotência, autorização, concorrência e ciclo de vida. Validation, failure modes e state
  transitions apontam para C6, C9, C5 e C12, julgadas acima.

## Deviations judged

Os valores da ficha são números de ajuste que o Handoff autoriza. As mudanças foram `tireGrip` 0.97 → 0.7,
`rearGripFactor` 1.25 → 1.6, `yawAssistGain` 10 → 40, `yawAssistMaxNm` 12000 → 16000, `yawAssistLateralG`
1.25 → 1.7, e os campos novos 0.9 e 1.7. Nenhum limite mudou. Medi as margens no harness em c3e564f, com
sondas no rascunho:

| Prova | Limite | Medido | Margem |
| --- | --- | --- | --- |
| C1 giro a 100 km/h | ≥ 31.8°/s | 32.84°/s | **estreita** (+3.3 %) |
| C2 giro a 140 km/h | ≥ 22.3°/s | 23.67°/s | +6 % |
| C4 g lateral | ≤ 1.7 g | 1.633 g | **estreita** (0.067 g) |
| ya C1 (C13) | ≤ 15 passos | 14 | **estreita** (1 passo). Com a ficha anterior eram 12, então o ajuste comeu 2 passos |
| cf C3 (C10) | −5 a −2° | −2.62° | 0.62°. A ficha nova e a anterior dão o mesmo número |
| ch C19 (C14) | 5.5-7.5 s | 5.78 s | 0.28 s. A ficha nova e a anterior dão o mesmo número |
| C7 rolagem | ≤ 1.0° | 0.13° | folgada |
| C9 inclinação | ≤ 15° | 5.33° | folgada |
| C11 sideslip | ≤ 12° | 4.99° | folgada |
| C12 freio de mão | > 20° | 80.1° | folgada |

As outras provas têm folga grande. Ajuste futuro da ficha pode derrubar C1, C4 e ya C1 primeiro.

Texto da C7 trocado em e0f605a: a prova antiga era "giro ≥ 20 % menor sem a força". A nova diz que
`cornerAssistN` é 0 com `maxG = startG` e > 0 em pelo menos 60 passos com a ficha, e bate com
`cornering.test.ts:97-104`.
- Esta prova mata um `Car` que ignora a ficha, porque com `DEFAULT_CAR` fixo o `off` teria força.
- Ela não mostra que a força muda a trajetória. Quem mostra isso são C1 e C2.
- O commit diz que a troca foi combinada com o usuário. Não tenho como confirmar isso, e registro só a origem.

## Gate

`npx vitest run` - 148 passed, 0 failed · `E2E_PORT=5203 npx playwright test tests/e2e/drive.spec.ts tests/e2e/visual.spec.ts -g "car debug exposes the corner assist force|A turns left|game builds the car from the default spec|car debug exposes the yaw assist torque|camera swings left while turning left|camera leans with the body"` - 6 passed, 0 failed

## Ranked gaps

1. **O lado da força em ré no `Car` não tem prova** (C7 / door 1, "positivo = para a esquerda do carro").
   - Onde: `src/vehicle/Car.ts:384`.
   - F5 sobrevive à suíte inteira.
   - A C6 prova a ré só na função pura (`cornerAssist.test.ts:27`).
   - Falta uma prova no harness: de ré, acima de 5 m/s, com `steer +1`, verificar que o impulso aplicado (ou a
     velocidade lateral que ele causa) aponta para a esquerda do carro.
2. **Borda de 5 m/s na própria camada** (C6, lacuna de precisão, não reprova sozinha).
   - A tabela tem 4.9 e 20, mas não 5.0.
   - Um `<=` em `cornerAssist.ts:27` passaria na C6. É o mesmo tipo de lacuna que a yaw-assist fechou com a
     linha "exactly 2 m/s".
3. **Margens estreitas** (não reprovam): C1 (+3.3 %), C4 (0.067 g) e ya C1 (14 de 15 passos). Ver
   Deviations.
4. Cosmético: em `checks.md`, a nota "(Prova trocada...)" da C7 fica no meio da lista de bullets e parte a lista
   em duas.
