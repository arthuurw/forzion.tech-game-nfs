# Car feel verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 2f99ff9..9e485a9 (85dd9ca, c42c59d, 75d8c43, e46c40a, dc41844 e o merge 9e485a9)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Resumo: as 15 provas nomeadas rodaram e passaram em 9e485a9. Foram 108/108 no vitest e 33/33 no Playwright
(`visual.spec.ts` inteiro, 31, mais 2 de `drive.spec.ts`) na porta 5193, sem timeout de boot. Os 7 testes da
car-handling que foram apagados (C4-C10) têm substituto, e nenhum outro teste foi apagado ou enfraquecido.

O veredito é FAIL por dois mutantes que sobreviveram. Os dois são lacunas de precisão nos próprios checks:
1. **F1b**: o `Car` pode ignorar `spec.suspensionStiffness` sem que nada falhe. O valor de prova de C13 (17) é
   igual ao de `DEFAULT_CAR` (17), então uma rigidez fixa em 17 passa na suíte vitest inteira (108/108).
2. **F3**: tirar `this.camera.rotateZ(-this.rollAngle)` de `ChaseCamera` não derruba C16. A prova lê
   `__game.camera.roll`, que é o número guardado, e a direção de visão, que um giro em torno do eixo de visão não
   muda. Nada afirma que a câmera do three de fato inclina.

Há também um membro sem prova: 2 dos 10 casos da car-handling C10 (60 e 90 km/h com acelerador) ficaram sem
nenhuma prova depois que os AC 11/12 foram retirados.

## Binding sources

O plano não marca nenhuma fonte como binding (`Sources` só cita o usuário e a car-handling). Com profile `standard`,
este passo não roda.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| nenhuma fonte binding | n/a | - | - |

## Checks

Verified at 9e485a9, no worktree do Verifier (junction de `node_modules`, `git status --porcelain` vazio antes):
- `npx vitest run --reporter=verbose`: 29 arquivos, **108 passaram**, 0 falharam. Conferi na saída verbose cada
  nome de `-t "..."` das provas vitest de C1-C15 e C17 (25 nomes): cada um aparece exatamente uma vez com ✓. A conta
  fecha com o diff: 103 (car-handling round 4) − 5 testes apagados (C4, C5, C8, C9, C10) + 10 novos = 108. C6 e C7
  foram renomeados no lugar.
- `E2E_PORT=5193 npx playwright test tests/e2e/visual.spec.ts`: 31 passaram (6.1 min, exit 0). Isso inclui
  "camera leans with the body" (C16, `:304`), "camera swings left while turning left" (C17, `:272`) e os 3 testes de
  `facade-glint` (`:459`, `:470`, `:484`), que dependem da altura da câmera e, por ela, da altura do carro.
- `E2E_PORT=5193 npx playwright test tests/e2e/drive.spec.ts -g "A turns left|game builds the car from the default spec"`:
  2 passaram (exit 0). O segundo é o C35 da car-handling, cujo literal de campos mudou.
- Antes da rodada, o `netstat` não mostrou nada escutando na 5193, e o log mostra o `vite --port 5193 --strictPort`
  subindo pelo próprio run. Não houve timeout de boot.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | média da rolagem 90-180 a 80 km/h: `steer +1` em [+3.5, +6], `steer −1` em [−6, −3.5] | vitest `body roll between 3.5 and 6 degrees` ✓ | `tests/physics/feel.test.ts:50-51` `left` ≥ 3.5, ≤ 6.0; `:53-54` `right` ≥ −6.0, ≤ −3.5; `:41` janela de 91 passos | PASS |
| C2 | depois de soltar: menor rolagem em 60 passos em [−1.5, −0.3]; \|rolagem\| < 0.5° nos passos 150-240 | vitest `body roll swings back after the turn` ✓ | `tests/physics/feel.test.ts:67-68` `minFirstSecond` ≥ −1.5, ≤ −0.3; `:71` `Math.abs(after[i]) < 0.5` para `i` de 149 a 239 | PASS |
| C3 | freio a 100 km/h: menor arfagem em 30 passos em [−5, −2] | vitest `nose dives 2 to 5 degrees under braking` ✓ | `tests/physics/feel.test.ts:85-86` | PASS |
| C4 | acelerador parado: maior arfagem em 60 passos em [+1, +4] | vitest `nose lifts under full throttle` ✓ | `tests/physics/feel.test.ts:98-99` | PASS |
| C5 | car-handling C2 e C3 verdes, sem mudança nas asserções | vitest `no rollover across the maneuver matrix` ✓; `all four wheels back on the ground after release` ✓ | `tests/physics/stability.test.ts:72` 54 casos, `:74` `maxTilt <= 15`; `:81`, `:83-84` `backOnGround` em [1, 60]. O diff de `stability.test.ts` só tira C4, C5 e imports: nenhuma linha desses dois testes mudou | PASS |
| C6 | rampa 4/60 até 0.55 no passo 9; volta 5/60; troca ≤ 5/60; espelho | vitest `steering ramps at 4 and 5 rad per second` ✓ | `tests/unit/drivetrain.test.ts:39-40` `up = 4.0/60`, `down = 5.0/60`; `:46` passo exato; `:49-50` `a[7] < 0.55`, `a[8]` = 0.55; `:51`; `:59-60` volta; `:71` troca ≤ `down`; `:75`; `:84` espelho | PASS |
| C7 | alvo `min(0.55, atan(43.3602/v²))`, 7 casos, ré −10 | vitest `steering target with 1.7 g` ✓ | `tests/unit/drivetrain.test.ts:100` sobre a tabela `:90-98` (inclui `[-10, atan(43.3602/100)]`); `:103` ré = frente; `:107` a rampa converge | PASS |
| C8 | 60-180 km/h, janela ≤ 0.95 g em todo passo | vitest `lateral grip never exceeds 0.95 g` ✓ | `tests/physics/feel.test.ts:110` `toBeLessThanOrEqual(0.95)` sobre `:106` (5 velocidades); `:109` 180 passos | PASS |
| C9 | 60 km/h: ≥ 0.75 g nos primeiros 120 passos | vitest `reaches at least 0.75 g at 60 kmh` ✓ | `tests/physics/feel.test.ts:117-118` | PASS |
| C10 | 8 casos, sideslip ≤ 12° | vitest `understeers without throttle or at speed` ✓ | `tests/physics/feel.test.ts:144` `slip <= 12`; `:149` `run` 8, tabela `:123-132` | PASS |
| C13 | 3 campos de suspensão finitos > 0; direção 4.0/5.0/1.7, `steerMaxRad` 0.55; harness lê 17/1.7/2.1 da ficha | vitest `default car spec values` ✓; `car reads suspension from its spec` ✓ | `tests/unit/carSpec.test.ts:54`, `:56-58`, `:61-62`, `:72-73`; `tests/physics/harness.test.ts:31-33` | FAIL - lacuna de precisão: a rigidez de prova (17) é igual à de `DEFAULT_CAR` (`src/vehicle/carSpec.ts:89`), então `:31` não separa "lê a ficha" de "usa 17 fixo". F1b sobrevive a 108/108. Compressão e extensão separam (F1a morre em `:32`) |
| C14 | `cameraRoll`: 6 casos, ±4° de limite | vitest `camera roll follows body roll` ✓ | `tests/unit/chaseMath.test.ts:18` sobre a tabela `:9-16` | PASS |
| C15 | `stepRoll` = suavização exponencial; 1 passo, 60 passos, ponto fixo | vitest `camera roll smoothing` ✓ | `tests/unit/chaseMath.test.ts:24`, `:26`, `:30`, `:37` | PASS |
| C16 | browser: `camera.roll` com o sinal de `bodyRoll`, \|roll\| ≥ 1°; direção de visão a < 0.5° do `lookAt` | pw `camera leans with the body` ✓ | `tests/e2e/visual.spec.ts:306` roll inicial < 0.001; `:323` `Math.sign(s.roll)` = `Math.sign(s.bodyRoll)`; `:324` ≥ 0.01745; `:333` `angleDeg < 0.5` | FAIL - lacuna de precisão: as asserções leem o número guardado (`src/camera/ChaseCamera.ts:37-39`) e a direção de visão, que `rotateZ` não muda por construção. Nada observa a orientação da câmera (por exemplo o `up` do mundo ou o quaternion). F3, sem o `rotateZ`, sobrevive |
| C17 | provas da car-handling e da visual/free-roam verdes, sem mudança nas asserções | vitest (4 de grip, 5 de powertrain) ✓; pw `camera swings left while turning left` ✓, `A turns left` ✓ | `tests/physics/grip.test.ts:25`, `:50`, `:55`, `:59`, `:91`, `:37`; `tests/physics/powertrain.test.ts:20-21`, `:38-40`, `:53-54`, `:71-72`, `:84`; `tests/e2e/visual.spec.ts:291-293`, `:299-300`; `tests/e2e/drive.spec.ts:60`. O diff de `grip.test.ts` só remove C8-C10, `SPEEDS`, `holdCorner` e o import de `LateralGWindow`. `powertrain.test.ts` não mudou. `visual.spec.ts` só ganhou linhas depois de `:300`, e `drive.spec.ts` só mudou `:143` | PASS |

## Coverage

Verified at 9e485a9. Os membros saem do plano (ACs, door, Surface), do código (`src/vehicle/Car.ts`,
`src/camera/*`, `src/core/Game.ts`) e do diff de `tests/` (`git diff 2f99ff9..9e485a9 -- tests`).

Testes apagados e acrescentados, contados a partir das linhas `it(` / `test(` do diff:
- **Apagados (7):** `lateral grip never exceeds 1.15 g`, `reaches at least 0.8 g at 60 kmh`,
  `understeers instead of spinning`, `body roll leans out of the turn`, `nose dives under braking`,
  `steering ramps toward the target`, `steering target shrinks with speed`. São exatamente car-handling C8, C9, C10,
  C4, C5, C6 e C7. Nenhum outro teste saiu.
- **Acrescentados (13):** 7 em `feel.test.ts`, 1 em `harness.test.ts`, 2 em `chaseMath.test.ts`, 2 renomeados no
  lugar em `drivetrain.test.ts` e 1 e2e.
- **Linhas trocadas fora dos testes apagados:** os 3 valores de direção de C28 (`carSpec.test.ts:56-58`, superados
  por C13), `FIELDS.length` 26 → 29 (`:72`), e o literal 26 → 29 em `tests/e2e/drive.spec.ts:143`. O `toEqual`
  campo a campo de `:144` continua igual. Nenhum matcher ficou mais frouxo, nenhuma tolerância cresceu, nenhuma
  asserção sumiu de um teste que continua.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (13) | `plan.md` Criteria, AC 1-10 e 13-15 | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6, C13 · 7 C7, C13 · 8 C8 · 9 C9 · 10 C10 · 13 C14 · 14 C15 (unidade), C16 `:333` (o ponto de visão não muda) · 15 C16 `:323-324` | AC 14 "levar a inclinação da câmera ao alvo": nenhuma prova observa a câmera do three girando. `ChaseCamera.ts:92` (`rotateZ`) pode sumir ou trocar de sinal sem que nada falhe (F3) |
| landing doors (1) | `plan.md` Landing | door 1: campos C13 `carSpec.test.ts:61-62`, `:73`; leitura pelo `Car` `harness.test.ts:31-33` | door 1, leitura da rigidez: o valor de prova é igual ao padrão (F1b) |
| suspension fields (3) | `src/vehicle/carSpec.ts:48-52` e `src/vehicle/Car.ts:103`, `:141-143` | compression `harness.test.ts:32` (F1a morre) · relaxation `:33` · stiffness `:31`, que não separa | stiffness (F1b) |
| roll directions (2) | AC 1 | esquerda C1 `feel.test.ts:50-51`, C2 · direita C1 `:53-54` | - |
| understeer cases (8) | AC 10 | `feel.test.ts:123-132`, `:144`, `:149` | - |
| steering target cases (7) | C7 | `drivetrain.test.ts:90-98` | - |
| camera roll cases (6) | AC 13 | `chaseMath.test.ts:9-16` | - |
| superseded car-handling checks (8) | diff de `tests/` (7 testes apagados) mais C28 | ch-4 → C1 · ch-5 → C3 · ch-6 → C6 · ch-7 → C7 · ch-8 → C8 · ch-9 → C9 · ch-10 → C10 (8 de 10 casos) · ch-28 direção → C13 | ch-10, 60 e 90 km/h com acelerador: saíram do AC 10 porque o AC 11 afirmava o oposto. O AC 11 foi retirado, e hoje nenhum check afirma nada nesses dois casos. Medi no rascunho: 1.47° e 0.72° de sideslip máximo, então o comportamento ainda vale, mas sem prova |
| DEV fields do plano, Surface (2) | `plan.md` Surface; `src/core/Game.ts:664`, `:668` | `roll` C16 `:306`, `:323-324` · `direction` C16 `:333` | - |
| startup config: car and camera (2 assemblies) | `src/core/Game.ts:159` (`new Car(..., DEFAULT_CAR)`), `:324` (`chase.update(..., this.car.bodyRoll)`); `tests/physics/harness.ts:72` | Game → car-handling C35 `tests/e2e/drive.spec.ts:143-144` (rodado, ✓) e C16 · harness → C13, C1-C10 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/camera/chaseMath.ts` (`cameraRoll`, `stepRoll`); `src/vehicle/drivetrain.ts` | própria C14, C15, C6, C7 · fronteira C16, C8-C10 | yes - uma linha por caso da tabela (C14 6 casos, C15 3 regras, C6 4 regras, C7 7 casos). Na fronteira, `cameraRoll` chega ao browser com sinal e magnitude (C16 `:323-324`) |
| Car lê a ficha (evidence de checks.md: "Fronteira pelo harness") | `src/vehicle/Car.ts` | harness C13, C1-C4 | no - a leitura de `suspensionStiffness` (`Car.ts:103`, `:141`) não é afirmada de forma que separe (F1b) |
| Dados | `src/vehicle/carSpec.ts` | C13 | yes - `carSpec.test.ts:54-62`, `:72-73` |
| Instrumentation, pass-throughs | `src/camera/ChaseCamera.ts`, `src/core/Game.ts` | coberto pela prova do consumidor (C16) | no - `ChaseCamera.ts:92` decide que a câmera gira e para que lado, e C16 não observa isso (F3 sobrevive). `Game.ts:324` passar `bodyRoll` fica provado por `:323-324`: sem ele, `roll` ficaria 0 |

## Faults injected

Verified at 9e485a9. Tudo rodou num worktree isolado: `git worktree add --detach <scratchpad>/faults HEAD`, com
junction de `node_modules`, nunca `git stash`. Cada mutação partiu da cópia original do arquivo, e conferi o `diff`
antes de rodar. Entre uma falta e outra, `cmp` (ignorando CR) confirmou o arquivo restaurado. F3 rodou na porta
5193 depois que a rodada principal terminou: o `netstat` estava vazio, e o log mostra o `[WebServer]` do próprio
rascunho subindo. Então o servidor era do código mutado, e não um reaproveitado.

Baseline do `git status --porcelain` do worktree do Verifier: vazio. Depois de apagar a junction do rascunho
(`.Delete()`) e rodar `git worktree remove`, continuou vazio antes de este relatório ser escrito, e `git worktree list`
não mostra mais o rascunho.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1a `Car` ignora a suspensão da ficha: `setWheelSuspension{Stiffness,Compression,Relaxation}(i, spec.…)` → constantes 17 / 2.7 / 0.8 | `src/vehicle/Car.ts:141-143` | yes - C13 `tests/physics/harness.test.ts:32` "wheel 0 compression: expected 1.00000004… to be ≤ 0.000001" |
| F1b só a rigidez fixa: `setWheelSuspensionStiffness(i, 17)` e `restLength` com `4 * 17` | `src/vehicle/Car.ts:103`, `:141` | no - survived. Rodei a suíte vitest inteira: 108/108. A prova de C13 usa 17, que é o valor de `DEFAULT_CAR` |
| F2 sem limite: `cameraRoll` → `bodyRoll * ROLL_GAIN` | `src/camera/chaseMath.ts:86` | yes - C14 `tests/unit/chaseMath.test.ts:18` "bodyRoll 0.2: expected 0.0502 to be ≤ 1e-9" |
| F3 a câmera nunca gira: remove `this.camera.rotateZ(-this.rollAngle)` | `src/camera/ChaseCamera.ts:92` | no - survived. `E2E_PORT=5193 npx playwright test tests/e2e/visual.spec.ts -g "camera leans with the body"` passou (1 passed) |
| F4 volante de volta a 2.5: `steerRateRadS: 4.0` → `2.5` | `src/vehicle/carSpec.ts:87` | yes - C6 `tests/unit/drivetrain.test.ts:46` "step 1: expected 0.025 to be less than 1e-12" |
| F5 aderência de volta: `tireGrip: 0.86` → `1.05` | `src/vehicle/carSpec.ts:82` | yes - C8 `tests/physics/feel.test.ts:110` "90 km/h step 55: expected 0.9553 ≤ 0.95". Morre por pouco (0.5 % acima do teto) |

F1a e F1b atacam a mesma superfície (a leitura da ficha pelo `Car`). F1b foi a segunda sonda, porque F1a morria só
por causa da compressão. Por isso são 6 mutações em 5 superfícies. `stepRoll` (C15) não recebeu falta própria por
causa do teto de 5.

## Swept existing

Verified at 9e485a9:
- **idempotency**: existing. O teste `drivetrain step is pure` (car-handling C26) passou na saída verbose.
  `cameraRoll` e `stepRoll` (`src/camera/chaseMath.ts:85-92`) não guardam estado. Confere.
- **dependency failure**: existing. `Car` lê `assets.placeholder` (`src/vehicle/Car.ts:94`), e o harness usa
  `PLACEHOLDER_ASSETS` (`tests/physics/harness.ts:72`), então as provas de física já rodam no caminho sem GLB com a
  mesma física. O teste de free-roam-city C33 (`hud.spec.ts`) não foi rodado aqui, e o diff não toca o Loader. Confere.
- **Observable, teclado**: `steerAxis` devolve 0 com os dois lados apertados (`src/core/input.ts:49-51`). O plano cita
  `:52`, o que é só um deslize de linha.
- **Observable, áudio**: `isSkidding` existe (`src/vehicle/effectsMath.ts:97`), e `skidding from real lateral slip`
  passou. Confere.

## Deviations judged

1. **Ride height** (`src/vehicle/Car.ts:51`, `:103-104`, commit 75d8c43):
   - **O que ficou igual.** `rideHeight` = `-WHEEL_Y + LOADED_SUSPENSION + r`, com
     `LOADED_SUSPENSION = 0.35 − 9.81/128`. Isso é algebricamente a fórmula de antes com a mola 32. A altura parada
     e o offset do centro de massa (`:113`) ficaram iguais, então car-handling C1, C29 e o `facade-glint` seguem
     verdes.
   - **O que mudou.** O comprimento livre da mola passou de 0.35 m para 0.2734 + 9.81/68 = 0.4176 m. A roda
     descarregada (a de dentro da curva, ou no ar) desce 6.8 cm a mais antes de perder o chão, dentro do curso de 0.3.
     Isso muda o comportamento da rolagem e do contato, e é parte do ajuste medido por C1-C5 (C3 da car-handling
     continua verde).
   - **Veredito.** Não é uma door: é uma constante interna, reversível, sem forma exposta nem dado persistido, e cabe
     em "Números de ajuste ... são do build" do Handoff. Mas cria um acoplamento que o plano não registra: na ficha,
     `suspensionStiffness` também decide o comprimento livre (semântica de pré-carga, altura fixa com qualquer mola).
     O sub-projeto 4 deveria saber disso. Recomendo registrar no plano ou no STATE. O literal 32 ficou dentro de
     `LOADED_SUSPENSION` como número mágico. Nada disso muda o veredito.
2. **Contagem de campos 26 → 29**: é forçada pela door 1. Em `tests/unit/carSpec.test.ts`, os 3 nomes entraram em
   `FIELDS` e `:73` compara as chaves ordenadas, o que é mais forte, não mais fraco. Em `tests/e2e/drive.spec.ts:143`
   só o literal mudou, e `:144` `toEqual` campo a campo continua. C35 rodou e passou. Aceito.
3. **`__game.camera.direction`**: não é um campo extra. O `plan.md` Surface já declarava `roll` e `direction` desde
   2f99ff9, e o diff do plano no range só mexe no texto de dc41844. Os campos são só de DEV (`exposeDebug`,
   `src/main.ts:42`). Aceito.
4. **Flow e Impact do plano**:
   - O Flow continua verdadeiro. Os passos 1-6 batem com o diff: `Game.ts:324` passa `bodyRoll`, e
     `ChaseCamera.ts:64`, `:92` suaviza e gira.
   - O Impact está desatualizado numa linha. Ele diz que "a parte 'com acelerador' do AC 10" da car-handling fica
     superada pelos ACs daqui. Depois de dc41844, os casos 60 e 90 km/h com acelerador não são superados por nada:
     é o membro sem prova da Coverage.
   - O `checks.md` da car-handling continua citando provas que não existem mais (por exemplo
     `-t "body roll leans out of the turn"`, `checks.md:67`), sem nota de que foram superadas. É um resíduo de
     documentação.

## Gate

`npx vitest run` - 108 passed, 0 failed · `E2E_PORT=5193 npx playwright test tests/e2e/visual.spec.ts` - 31 passed, 0 failed · `E2E_PORT=5193 npx playwright test tests/e2e/drive.spec.ts -g "A turns left|game builds the car from the default spec"` - 2 passed, 0 failed

## Ranked gaps

1. **F3 sobrevive: nada prova que a câmera inclina de fato.** Afeta C16 e AC 14 (`src/camera/ChaseCamera.ts:92`,
   `tests/e2e/visual.spec.ts:323-333`). Precisa de uma asserção sobre a orientação da câmera. Por exemplo: o `up` do
   mundo da câmera, `(0,1,0)` aplicado ao quaternion, deve estar inclinado de `roll` em torno da direção de visão,
   no sentido da carroceria. Hoje nem a remoção nem a troca de sinal do `rotateZ` falham.
2. **F1b sobrevive: a leitura da rigidez não é provada.** Afeta C13 e a door 1 (`tests/physics/harness.test.ts:26`,
   `:31`). Os valores de prova precisam ser diferentes dos de `DEFAULT_CAR` (por exemplo `suspensionStiffness: 23`),
   no check e no teste.
3. **ch-10: 60 e 90 km/h com acelerador sem prova.** Afeta a Coverage "superseded" e o AC 10 (`plan.md` Impact).
   Os casos ficaram órfãos quando os AC 11/12 saíram. Ou voltam ao AC 10 e a C10 (hoje medem 1.47° e 0.72°), ou o
   plano registra que ficam sem prova.

Resíduos que não mudam o veredito:
- F5 morre por pouco: com `tireGrip` 1.05, o pico é 0.955 g contra o teto de 0.95. O teto quase não separa o valor
  antigo do novo.
- O acoplamento stiffness → comprimento livre (desvio 1) não está no plano.
- O `checks.md` da car-handling não marca C4-C10 como superados.
- O plano cita `src/core/input.ts:52`, mas a função está em `:49`.
