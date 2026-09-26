# Car feel verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 2f99ff9..117bf84 (feature); correção em 9c9d043..117bf84 (137b255, 0aa602a, 04032b7 e o merge 117bf84)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Resumo: as três lacunas da rodada 1 (verificada em 9e485a9) estão fechadas em 117bf84.
1. **F1b** agora morre. O valor de prova da rigidez passou para 23, diferente dos 17 de `DEFAULT_CAR`
   (`tests/physics/harness.test.ts:26`, `:31`).
2. **F3** agora morre. C16 ganhou uma asserção sobre a orientação real da câmera do three, lida por
   `__game.camera.up` (`tests/e2e/visual.spec.ts:335-351`, `src/core/Game.ts:673-677`). A troca de sinal e a
   meia inclinação também morrem.
3. **ch-10 60/90 km/h com acelerador** voltou ao AC 10 e à C10, que agora tem 10 casos
   (`tests/physics/feel.test.ts:129-130`, `:151`). Uma falta que só afeta esses dois casos passa na C10 antiga,
   de 8 casos, e morre na nova.

Todas as provas rodaram de novo por inteiro em 117bf84: vitest 108/108 e Playwright 33/33 na porta 5196, sem
timeout de boot. Nenhuma asserção ficou mais fraca, e o refactor `RIDE_HEIGHT_REF_STIFFNESS` não muda o
comportamento.

Escopo desta rodada: o diff da correção (`git diff 9c9d043 117bf84`, sem block-fill e `STATE.md`) toca
`src/core/Game.ts`, `src/vehicle/Car.ts`, `tests/e2e/visual.spec.ts`, `tests/physics/feel.test.ts`,
`tests/physics/harness.test.ts`, o `plan.md`/`checks.md` da car-feel e o `checks.md` da car-handling. Entre
9e485a9 e 9c9d043 só entrou o relatório da rodada 1. Os commits de block-fill em main (e3478db, f5c3ade) só mexem
em `.specs/`.

## Binding sources

Carried from 9e485a9. O plano não marca nenhuma fonte como binding, e a correção não mudou `Sources`.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| nenhuma fonte binding | n/a | - | - |

## Checks

Verified at 117bf84, no worktree do Verifier. Antes de rodar, criei a junction de `node_modules`, e o
`git status --porcelain` estava vazio.
- `npx vitest run --reporter=verbose`: 29 arquivos, **108 passaram**, 0 falharam, exit 0.
  - Os 13 nomes de teste das provas vitest de C1-C10 e C13-C15 aparecem cada um com ✓, e as provas de C5 e C17
    (stability, grip, powertrain) também.
  - A contagem é igual à da rodada 1, porque os 2 casos novos de C10 são linhas da tabela do mesmo `it`.
- `E2E_PORT=5196 npx playwright test tests/e2e/visual.spec.ts`: **31 passaram** (6.6 min, exit 0). Isso inclui
  "camera leans with the body" (`:304`), "camera swings left while turning left" (`:272`) e os 4 de
  `facade-glint` (`:477`, `:488`, `:502`, `:513`, que se deslocaram 18 linhas com o C16 novo).
- `E2E_PORT=5196 npx playwright test tests/e2e/drive.spec.ts -g "A turns left|game builds the car from the default spec"`:
  **2 passaram** (exit 0).
- Antes da rodada, o `netstat` não mostrou nada escutando na 5196, e o log mostra o `[WebServer] vite --port 5196
  --strictPort` do próprio run. Não houve timeout de boot, então não precisei rodar de novo.
  - O aviso "Falha ao carregar texturas de /textures/Concrete034/" aparece no log do servidor. Vem de assets fora
    do git no worktree, cai na cor chapada e não afeta nenhuma prova.

Para C1-C9, C14, C15 e C17, as provas rodaram de novo e passaram em 117bf84. As citações continuam as da rodada 1
(carried from 9e485a9): a correção não tocou essas linhas. `feel.test.ts` só mudou depois de `:118`, e
`visual.spec.ts` só depois de `:316`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | rolagem média 90-180 a 80 km/h em [+3.5, +6] / [−6, −3.5] | vitest `body roll between 3.5 and 6 degrees` ✓ | `tests/physics/feel.test.ts:50-51`, `:53-54` (carried from 9e485a9) | PASS |
| C2 | volta depois de soltar | vitest `body roll swings back after the turn` ✓ | `tests/physics/feel.test.ts:67-68`, `:71` (carried from 9e485a9) | PASS |
| C3 | freio a 100 km/h, arfagem em [−5, −2] | vitest `nose dives 2 to 5 degrees under braking` ✓ | `tests/physics/feel.test.ts:85-86` (carried from 9e485a9) | PASS |
| C4 | acelerador, arfagem em [+1, +4] | vitest `nose lifts under full throttle` ✓ | `tests/physics/feel.test.ts:98-99` (carried from 9e485a9) | PASS |
| C5 | car-handling C2/C3 verdes, sem mudança | vitest `no rollover across the maneuver matrix` ✓, `all four wheels back on the ground after release` ✓ | `tests/physics/stability.test.ts:74`, `:83-84`. A correção não tocou `stability.test.ts` | PASS |
| C6 | rampa 4/60, volta 5/60 | vitest `steering ramps at 4 and 5 rad per second` ✓ | `tests/unit/drivetrain.test.ts:39-40`, `:46`, `:49-50` (carried from 9e485a9) | PASS |
| C7 | alvo com 1.7 g, 7 casos | vitest `steering target with 1.7 g` ✓ | `tests/unit/drivetrain.test.ts:90-100` (carried from 9e485a9) | PASS |
| C8 | ≤ 0.95 g, 60-180 km/h | vitest `lateral grip never exceeds 0.95 g` ✓ | `tests/physics/feel.test.ts:110` (carried from 9e485a9) | PASS |
| C9 | ≥ 0.75 g a 60 km/h | vitest `reaches at least 0.75 g at 60 kmh` ✓ | `tests/physics/feel.test.ts:117-118` (carried from 9e485a9) | PASS |
| C10 | 10 casos, 60-180 km/h × {sem, com acelerador}, sideslip ≤ 12° | vitest `understeers without throttle or at speed` ✓ | Verified at 117bf84: tabela `tests/physics/feel.test.ts:123-134`, com os novos `[60, true]` `:129` e `[90, true]` `:130`; `:146` `slip <= 12` por passo; `:148` `measured > 0`; `:151` `run` = 10. Bate com o check (`checks.md` C10) e com o AC 10 (`plan.md`). A falta F7 prova que os casos novos pegam algo que os 8 antigos não pegam | PASS |
| C13 | 3 campos de suspensão; direção 4.0/5.0/1.7; harness lê 23/1.7/2.1 da ficha | vitest `default car spec values` ✓, `car reads suspension from its spec` ✓ | Verified at 117bf84: `tests/physics/harness.test.ts:26` usa 23 / 1.7 / 2.1, os três diferentes de `DEFAULT_CAR` (17 / 2.7 / 0.8); `:31-33` com ± 1e-6 nas 4 rodas. `tests/unit/carSpec.test.ts` não mudou (carried from 9e485a9). F1a e F1b morrem | PASS |
| C14 | `cameraRoll`, 6 casos | vitest `camera roll follows body roll` ✓ | `tests/unit/chaseMath.test.ts:18` (carried from 9e485a9) | PASS |
| C15 | `stepRoll` suaviza | vitest `camera roll smoothing` ✓ | `tests/unit/chaseMath.test.ts:24-37` (carried from 9e485a9) | PASS |
| C16 | `roll` com o sinal de `bodyRoll`, ≥ 1°; direção de visão < 0.5° do `lookAt`; `up` da câmera inclinado para o lado de `bodyRoll` e `atan2` a ≤ 0.2° de `roll` | pw `camera leans with the body` ✓ | Verified at 117bf84: `tests/e2e/visual.spec.ts:306`, `:324-325`, `:334`. Base sem inclinação em `:337-346`, com `d × Y` = `(−d.z, 0, d.x)` e `u0 = r0 × d`, que conferi à mão. Depois `:349` o sinal e `:351` a tolerância de 0.2°. O `up` vem de `src/core/Game.ts:673-677`, que aplica `(0,1,0)` ao `getWorldQuaternion`. F3, F6 e F8 morrem | PASS |
| C17 | provas da car-handling e da visual/free-roam verdes, sem mudança | vitest (grip, powertrain) ✓; pw `camera swings left while turning left` ✓, `A turns left` ✓ | `tests/e2e/visual.spec.ts:291-293`, `:299-300`; `tests/e2e/drive.spec.ts:60`. `grip.test.ts`, `powertrain.test.ts` e `drive.spec.ts` não mudaram na correção (carried from 9e485a9) | PASS |

Ferramentas de teste mudadas, conferidas pelo diff (`git diff 9c9d043 117bf84 -- tests`):
- `harness.test.ts`: só troca o literal 17 por 23 em `:26` e `:31`, o que é mais forte.
- `feel.test.ts`: acrescenta 2 linhas à tabela, troca `run` 8 por 10 e muda um comentário.
- `visual.spec.ts`: só acrescenta linhas (`:317`, `:335-351`).

Nenhum matcher ficou mais frouxo, nenhuma tolerância cresceu e nenhuma asserção sumiu.

## Coverage

Verified at 117bf84 nas linhas que a correção tocou. As outras são carried from 9e485a9, com os mesmos membros e
as mesmas provas.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (13) | `plan.md` Criteria, AC 1-10 e 13-15 (AC 10 reescrito em 04032b7) | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6, C13 · 7 C7, C13 · 8 C8 · 9 C9 · 10 C10 (10 casos) · 13 C14 · 14 C15, C16 `:334` (o ponto de visão não muda) e `:349`, `:351` (a câmera gira) · 15 C16 `:324-325` | - |
| landing doors (1) | `plan.md` Landing | door 1: campos `tests/unit/carSpec.test.ts:61-62`, `:73`; leitura pelo `Car` `tests/physics/harness.test.ts:31-33` com valores ≠ padrão | - |
| suspension fields (3) | `src/vehicle/carSpec.ts` e `src/vehicle/Car.ts:105`, `:143-145` | stiffness `harness.test.ts:31` (F1b morre) · compression `:32` (F1a morre) · relaxation `:33` | - |
| roll directions (2) | AC 1 (carried from 9e485a9) | esquerda C1, C2 · direita C1 | - |
| understeer cases (10) | AC 10 em 117bf84: 5 velocidades × {sem, com acelerador} | `tests/physics/feel.test.ts:124-133`, um por linha, `:146`, `:151` | - |
| steering target cases (7) | C7 (carried from 9e485a9) | `tests/unit/drivetrain.test.ts:90-98` | - |
| camera roll cases (6) | AC 13 (carried from 9e485a9) | `tests/unit/chaseMath.test.ts:9-16` | - |
| camera roll directions (2) | AC 14, lado da inclinação | só a esquerda (`A`) é exercida no browser, em `visual.spec.ts:309`, `:349`. A direita vem do sinal de `cameraRoll` na unidade (C14 `−0.05`, `−limite`) e de a mesma linha `ChaseCamera.ts:92` servir aos dois sentidos | - |
| superseded car-handling checks (8) | diff de `tests/` 2f99ff9..117bf84 e `car-handling/checks.md:60` | ch-4 → C1 · ch-5 → C3 · ch-6 → C6 · ch-7 → C7 · ch-8 → C8 · ch-9 → C9 · ch-10 → C10, os 10 casos (os de 60 e 90 km/h com acelerador voltaram) · ch-28 direção → C13 | - |
| DEV fields do plano, Surface (3) | `plan.md` Surface em 117bf84; `src/core/Game.ts:664`, `:668`, `:673` | `roll` C16 `:306`, `:324-325` · `direction` C16 `:334` · `up` C16 `:349`, `:351` | - |
| startup config: car and camera (2 assemblies) | `src/core/Game.ts:159`, `:324`; `tests/physics/harness.ts:72` | Game → car-handling C35 `tests/e2e/drive.spec.ts:143-144` (rodado, ✓) e C16 · harness → C13, C1-C10 | - |

## Test policy rows

Verified at 117bf84 para as duas linhas que não bateram na rodada 1 e para as que classificam arquivos tocados
(`Car.ts`, `Game.ts`). A linha "Dados" é carried from 9e485a9.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/camera/chaseMath.ts`; `src/vehicle/drivetrain.ts` | própria C14, C15, C6, C7 · fronteira C16, C8-C10 | yes. Um caso por linha da tabela nas unidades. Na fronteira, C16 `:324-325` e agora `:349-351` levam `cameraRoll` até a orientação da câmera; C10 cobre as 10 linhas |
| Car lê a ficha ("Fronteira pelo harness") | `src/vehicle/Car.ts` | harness C13, C1-C4 | yes. `harness.test.ts:31-33` separa "lê a ficha" de "usa constante" nos 3 campos (F1a e F1b morrem). O refactor em `Car.ts:47`, `:53` é neutro (ver Deviations) |
| Dados | `src/vehicle/carSpec.ts` | C13 | yes. `carSpec.test.ts:54-62`, `:72-73` (carried from 9e485a9) |
| Instrumentation, pass-throughs | `src/camera/ChaseCamera.ts`, `src/core/Game.ts` | coberto pela prova do consumidor (C16) | yes. A decisão de `ChaseCamera.ts:92` (se gira, para que lado e quanto) é afirmada por `visual.spec.ts:349`, `:351`: F3, F6 e F8 morrem. O getter `up` de `Game.ts:673-677` só existe em DEV e é lido pela mesma prova. Passar `bodyRoll` em `Game.ts:324` continua provado por `:324-325` |

## Faults injected

Verified at 117bf84. Tudo rodou num worktree de rascunho separado
(`git worktree add --detach <scratchpad>/faults HEAD`, junction de `node_modules`), nunca com `git stash`.
- Cada mutação partiu de uma cópia do arquivo original. Conferi o `git diff` de cada uma antes de rodar e restaurei
  a cópia entre uma falta e outra. Depois de restaurar, o `git status --porcelain` do rascunho estava vazio.
- As faltas de câmera rodaram uma por vez na porta 5196, depois de a rodada principal terminar. Antes de cada uma,
  o `netstat` estava vazio na 5196, e o log mostra o `[WebServer]` do próprio rascunho subindo. Então o servidor
  servia o código mutado.
- No fim apaguei a junction do rascunho (`.Delete()`) e rodei `git worktree remove`. O `git worktree list` não
  mostra mais o rascunho, e o `git status --porcelain` do worktree do Verifier estava vazio antes e depois.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1b (reinjetada) a rigidez fica fixa: `setWheelSuspensionStiffness(i, 17)` e `restLength` com `4 * 17` | `src/vehicle/Car.ts:105`, `:143` | yes. C13 `tests/physics/harness.test.ts:31` "wheel 0 stiffness: expected 6 to be ≤ 0.000001". Só esse teste falhou (1 failed / 107 passed) |
| F3 (reinjetada) a câmera nunca gira: remove `this.camera.rotateZ(-this.rollAngle)` | `src/camera/ChaseCamera.ts:92` | yes. C16 `tests/e2e/visual.spec.ts:351` "expected ≤ 0.00349, received 0.0415". O sinal de `:349` não pegou: sem giro, `upRight` fica ~0 e o sinal sai do ruído de ponto flutuante. Quem mata é a tolerância de `:351` |
| F6 inclinação invertida: `rotateZ(this.rollAngle)` | `src/camera/ChaseCamera.ts:92` | yes. C16 `tests/e2e/visual.spec.ts:349` "Expected: 1, Received: -1" |
| F7 traseira escapa no acelerador abaixo de 27 m/s: o `frictionSlip` traseiro × 0.3 quando `input.throttle && speedMs < 27` | `src/vehicle/Car.ts:168` | yes. C10 `tests/physics/feel.test.ts:146` "60 km/h throttle true step 45: expected 12.32 ≤ 12", ou seja, um caso novo. A C10 antiga de 8 casos (`feel.test.ts` de 9c9d043), rodada contra a mesma falta, passou (1 passed). Os casos novos são o que pega a falta dentro da C10. C1, C4, C8 e duas de powertrain também caíram |
| F8 meia inclinação: `rotateZ(-0.5 * this.rollAngle)` | `src/camera/ChaseCamera.ts:92` | yes. C16 `tests/e2e/visual.spec.ts:351` "expected ≤ 0.00349, received 0.0208" (metade de `roll`) |

As faltas F2, F4 e F5 da rodada 1 atacam superfícies que a correção não tocou (`chaseMath.ts:86`,
`carSpec.ts:82`, `:87`), por isso são carried from 9e485a9: todas morreram lá. F1a também é carried from 9e485a9
(morria em `harness.test.ts:32`, linha que não mudou).

## Swept existing

Carried from 9e485a9 (idempotency, dependency failure, teclado, áudio). A correção só toca a observability: o
`__game.camera.up` novo é só de DEV, está no bloco de `exposeDebug` (`src/core/Game.ts:673`) e é lido por C16.
Confere. O plano agora cita `src/core/input.ts:49`, que é a linha certa.

## Deviations judged

1. **Refactor `RIDE_HEIGHT_REF_STIFFNESS`** (0aa602a, `src/vehicle/Car.ts:47`, `:53`) - verified at 117bf84.
   - É só dar nome a um literal: `GRAVITY / (4 * 32)` virou `GRAVITY / (4 * RIDE_HEIGHT_REF_STIFFNESS)`, com a
     constante `= 32`. É a mesma expressão, com o mesmo resultado em ponto flutuante.
   - Nenhum outro uso de 32 mudou. O `grep` em 9e485a9 e em 117bf84 só acha essa conta e o comentário de `:49`.
   - As provas que dependem da altura parada continuaram verdes: C1-C4, car-handling C29 e os 4 `facade-glint`.
   - Comportamento neutro. Aceito.
2. **Acoplamento stiffness → comprimento livre**: foi registrado no `plan.md` Impact (linha "domain", acoplamento),
   como a rodada 1 recomendou. Bate com `Car.ts:105-106`. Aceito.
3. **Resíduo da car-handling**: `car-handling/checks.md:60` agora diz que C4-C10 foram superados pela car-feel e
   que as provas deles não existem mais. Fechado.
4. **Desvios 2-4 da rodada 1** (contagem de campos 26 → 29, `camera.direction`, Flow): carried from 9e485a9. A
   linha do Impact que estava desatualizada (a parte "com acelerador" do AC 10) foi corrigida em 04032b7 e agora
   bate com o AC 10 de 10 casos.

## Gate

`npx vitest run` - 108 passed, 0 failed · `E2E_PORT=5196 npx playwright test tests/e2e/visual.spec.ts` - 31 passed, 0 failed · `E2E_PORT=5196 npx playwright test tests/e2e/drive.spec.ts -g "A turns left|game builds the car from the default spec"` - 2 passed, 0 failed

## Ranked gaps

Nenhuma lacuna que mude o veredito. Resíduos:
1. **Sinal de `visual.spec.ts:349` sensível a ruído.** Se não há giro, `Math.sign(upRight)` de um valor ~1e-17
   pode bater com o sinal de `bodyRoll` por acaso. Foi o que aconteceu com F3. A falta morre de qualquer jeito por
   `:351`, que mede a magnitude, então não há lacuna. Mas `:349` sozinho não prova que a câmera gira.
2. **F5 morre por pouco** (carried from 9e485a9): com `tireGrip` 1.05, o pico é 0.955 g contra o teto de 0.95.
3. **Direita no browser.** C16 só dirige para a esquerda. Com `rotateZ` linear em `roll`, o lado direito fica
   coberto pela unidade (C14) e pela mesma linha de código. Não é membro sem prova, só uma prova indireta.
