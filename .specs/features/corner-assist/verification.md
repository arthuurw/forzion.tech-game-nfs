# Corner assist verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 0f48a03..54012bc (fix da rodada 2; rodada 2 verificada em b03a8d3, rodada 1 em c3e564f)
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

Resumo: os dois mutantes que sobreviveram na rodada 2 agora morrem.
- F8 (sem zerar o registro entre passos) morre em `tests/physics/cornering.test.ts:152`.
- F9 (vetor aplicado no corpo diferente do registrado, com o erro de F5 só no corpo) morre em
  `tests/physics/cornering.test.ts:172`.
- F5 continua morrendo em `:131`, e uma falta nova, F10 (o corpo não recebe o impulso em ré, mas o registro sim),
  morre em `:172`.

O fix só acrescentou linhas a um teste que já existia e não enfraqueceu nenhuma asserção. As provas rodaram de novo
no HEAD e passaram. A suíte inteira deu 148/148 com `--testTimeout=60000`. Com o timeout padrão, um teste fora da
feature (`interiorMotion.test.ts`, "string lights sway") estourou os 5 s com a máquina carregada; ver Gate.

Entre b03a8d3 e 0f48a03 só entraram docs (`block-fill/plan.md`, `block-fill/verification.md` e este relatório,
conferido com `git diff --stat b03a8d3..0f48a03`). Então o `src` do HEAD é o mesmo que a rodada 2 verificou.

## Binding sources

Carried from c3e564f. O fix não tocou o `plan.md` nem a interface.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| nenhuma fonte binding | n/a | - | - |

## Checks

Verified at 54012bc, no worktree do Verifier. Criei a junction de `node_modules` apontando para o `node_modules` do
repo principal, e o `git status --porcelain` ficou vazio antes e depois. As provas rodaram por inteiro no HEAD:
- `npx vitest run` com os 9 arquivos das provas (`--reporter=verbose`): **33 passaram**. Cada nome citado em
  C1-C14 aparece com ✓, incluindo `corner assist - spec > car applies the corner assist from its spec at the
  center of mass`.
- `npx vitest run` (suíte toda): 148/148 com `--testTimeout=60000`. Com o timeout padrão deu 147/148 duas vezes;
  a única falha é fora da feature (ver Gate).
- `E2E_PORT=5206 npx playwright test tests/e2e/drive.spec.ts tests/e2e/visual.spec.ts -g "car debug exposes the
  corner assist force|A turns left|game builds the car from the default spec|car debug exposes the yaw assist
  torque|camera swings left while turning left|camera leans with the body" --reporter=list`: **6 passaram**
  (2.7 min). Os testes rodados foram `drive.spec.ts:49`, `:64`, `:77`, `:164` e `visual.spec.ts:272`, `:304`.

O fix mudou só `tests/physics/cornering.test.ts`, com +36 linhas e nenhuma removida
(`git diff 0f48a03..54012bc -- tests src | grep -c '^-[^-]'` dá 0). Todas as linhas novas ficam depois da `:136`,
então as citações de C1-C6 e as antigas da C7 (`:93-135`) continuam válidas. As citações de C8-C14 vêm de arquivos
que o fix não tocou e estão carried from b03a8d3 (que as trouxe de c3e564f). As provas delas rodaram de novo no
HEAD.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | giro em regime a 100 km/h ≥ 31.8°/s | vitest `radius at most 50 m at 100 kmh` ✓ | `tests/physics/cornering.test.ts:52` `>= 0.555` (carried from b03a8d3; o `src` não mudou) | PASS |
| C2 | giro em regime a 140 km/h ≥ 22.3°/s | vitest `radius at most 100 m at 140 kmh` ✓ | `tests/physics/cornering.test.ts:57` `>= 0.3892` (carried from b03a8d3) | PASS |
| C3 | giro em regime a 60 km/h ≥ 35°/s | vitest `still turns at least 35 degrees per second at 60 kmh` ✓ | `tests/physics/cornering.test.ts:62` `>= 35 * DEG` (carried from b03a8d3) | PASS |
| C4 | 5 velocidades, ≤ 1.7 g em todo passo | vitest `lateral acceleration never exceeds 1.7 g` ✓ | `tests/physics/cornering.test.ts:71` `toBeLessThanOrEqual(1.7)`; `:67` as 5 velocidades (carried from b03a8d3) | PASS |
| C5 | < 0.15 g em algum dos 60 passos após soltar | vitest `path straightens within 1 s after release` ✓ | `tests/physics/cornering.test.ts:84` `after.some(x => x < 0.15)` (carried from b03a8d3) | PASS |
| C6 | fórmula da door 1, 10 linhas, tol 1e-3 | vitest `corner assist force fills lateral acceleration above the start` ✓ | `tests/unit/cornerAssist.test.ts:23-33` (as 10 linhas), `:35` `rows.length` = 10, `:41` `Math.abs(f - expected) <= TOL` (carried from b03a8d3, arquivo não tocado) | PASS |
| C7 | ficha; zero com max = start; ≥ 60 passos; rolagem ≤ 1.0°; > 0 andando, 0 parado; impulso aplicado para a esquerda do carro, sem componente vertical, a 100 e a −28 km/h; browser | vitest `car applies the corner assist from its spec at the center of mass` ✓; pw `car debug exposes the corner assist force` ✓ (porta 5206) | Sem mudança: `tests/physics/cornering.test.ts:93-96`, `:102`, `:104`, `:109`, `:112`, `:117`, `:131` `along > 0`, `:132` `Math.abs(imp.y)` `toBe(0)`, `:135` `pushed >= 5`. **Novas, verified at 54012bc:** `:147` `forced >= 5`; `:150` `cornerAssistN` `toBe(0)` depois de zerar a velocidade; `:152-154` `Math.abs(zero.x/y/z)` `toBe(0)`; `:172` `expect(driftOn).toBeGreaterThan(driftOff)`, que soma a velocidade do corpo ao longo do `+X` do chassi (`:164-166`) em 40 passos a −28 km/h. Browser: `tests/e2e/drive.spec.ts:78`, `:86` | PASS |
| C8 | `cornerAssist.ts` na lista pura | vitest `pure modules do not import three or rapier` ✓ | `tests/unit/purity.test.ts:40`, `:48`, `:51` (carried from b03a8d3) | PASS |
| C9 | ch C2 e C3 verdes, sem mudança | vitest os 2 nomes ✓ | `tests/physics/stability.test.ts:74`, `:83-84` (carried from b03a8d3) | PASS |
| C10 | cf C1-C4 verdes, sem mudança | vitest os 4 nomes ✓ | `tests/physics/feel.test.ts:36-40`, `:53-57`, `:71-72`, `:84-85` (carried from b03a8d3) | PASS |
| C11 | cf C10, sideslip ≤ 12° | vitest `understeers without throttle or at speed` ✓ | `tests/physics/feel.test.ts:117`, `:122` (carried from b03a8d3) | PASS |
| C12 | ch C11, C12, C13, C36 | vitest os 4 nomes ✓ | `tests/physics/grip.test.ts:25`, `:50`, `:55`, `:59`, `:91`, `:37` (carried from b03a8d3) | PASS |
| C13 | ya C1, C4, C6 | vitest os 3 nomes ✓ | `tests/physics/agility.test.ts:45`, `:69`, `:71`, `:81` (carried from b03a8d3) | PASS |
| C14 | ch C19-C23 e provas do browser | vitest os 5 de `powertrain` ✓; pw 5 ✓ (porta 5206) | `tests/physics/powertrain.test.ts:20-21`, `:38-40`, `:53-54`, `:71-72`, `:84`; `tests/e2e/drive.spec.ts:60`, `:73`, `:169`, `:170`; `tests/e2e/visual.spec.ts:291-293`, `:299-300`, `:324-325`, `:349`, `:351` (carried from b03a8d3) | PASS |

### Julgamento do fix

- **Só testes, nada mais fraco.** O diff tem um arquivo, `tests/physics/cornering.test.ts`, com +36 linhas e 0
  removidas. Nenhum matcher, tolerância ou contagem antiga mudou.
- **A asserção no corpo segue a C7 e a door 1, e não a implementação.**
  - A C7 fala do "impulso aplicado" apontando para a esquerda do carro (`checks.md:61`), e a door 1 diz que o
    `Car` aplica a força perpendicular à velocidade, positiva para a esquerda do carro (`plan.md:53`).
  - A prova nova lê o efeito no corpo (`h.car.body.linvel()` projetado no `+X` do chassi, `:164-166`) e compara
    com a ficha desligada (`offSpec`, `:171`). Ela não lê o registro e não depende de o registro e o vetor serem o
    mesmo objeto.
  - A margem no HEAD é de −97.37 com a força contra −110.28 sem ela, cerca de 12.9 unidades. Com F9 dá −119.05 e
    com F10 dá −110.28, igual a sem força. A comparação é relativa (> sem força), então não depende de valor
    ajustado.
- **A asserção de zero segue o contrato do campo, que não está no texto da C7.**
  - `:150-154` confere que `cornerAssistImpulse` volta a `{0, 0, 0}` num passo sem força depois de passos com
    força. Esse contrato está no comentário do campo (`src/vehicle/Car.ts:83`, "zero quando não houve força") e
    foi o que a rodada 2 pediu.
  - A C7 (`checks.md:60-61`) só fala em `cornerAssistN` 0 parado e no impulso dos passos com força. Nada
    contradiz, mas o texto do check não acompanhou as duas obrigações novas (registro zerado e empurrão no corpo).
    Ver Ranked gaps 1; não reprova.
- **Sem efeito na física.** O `src` do HEAD é o de b03a8d3, que a rodada 2 mostrou ser idêntico bit a bit ao de
  c3e564f. A prova nova só cria harnesses próprios.

## Coverage

Verified at 54012bc nas linhas cuja prova o fix tocou: door 1, ramos de `applyCornerAssist` e instrumentação. As
outras estão carried from b03a8d3, que as trouxe de c3e564f.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (12) | `plan.md` Criteria, AC 1-12 (carried from b03a8d3) | 1 `cornering.test.ts:52` · 2 `:57` · 3 `:62` · 4 `:71` · 5 `:84` · 6 `cornerAssist.test.ts:41` e `cornering.test.ts:117`, `:131`, `:172` · 7 `stability.test.ts:74`, `:83-84` · 8 `feel.test.ts:36-40`, `:53-57`, `:71-72`, `:84-85` · 9 `feel.test.ts:117` · 10 `grip.test.ts:25`, `:59`, `:91`, `:37` · 11 `agility.test.ts:45`, `:69`, `:81` · 12 `powertrain.test.ts:20-84` | - |
| door 1 - obrigações (6) | `plan.md:53` (verified at 54012bc) | assinatura e fórmula `cornerAssist.test.ts:41` · 2 campos `cornering.test.ts:93-96`, `carSpec.test.ts:38-39`, `:77` · pura `purity.test.ts:40`, `:51` · centro de massa `cornering.test.ts:109` · horizontal `:132` · lado esquerdo do carro, de frente e de ré: no registro `:131` (100 e −28 km/h, F5 morre) e **no corpo** `:172` (−28 km/h, F9 e F10 morrem). De frente, o corpo também é coberto pelo giro de C1-C3 | - |
| corner assist cases (10) | `checks.md:43-52`, `src/vehicle/cornerAssist.ts:27-33` (carried from b03a8d3) | abaixo do início `cornerAssist.test.ts:23` · livre `:24` · limitado `:25` · lado oposto `:26` · ré `:27` e `cornering.test.ts:131`, `:172` · abaixo de 5 m/s `:28` · 1 roda `:29` · 2 rodas `:30` · freio de mão `:31` · exatamente 5 m/s `:33`; todos em `:41` | - |
| ramos de `applyCornerAssist` (4) | `src/vehicle/Car.ts:378-394` (verified at 54012bc) | força zero: sem impulso e registro zerado, `cornering.test.ts:102`, `:117`, `:150-154` (F8 morre) · de frente `:131` (100 km/h), `:104` · velocidade horizontal < 1e-6 (`Car.ts:387`, sem efeito: a função já zera abaixo de 5 m/s) · de ré: registro `:131`, corpo `:172` | - |
| spec fields (2) | `plan.md` Landing, `src/vehicle/carSpec.ts` (carried from b03a8d3) | startG e maxG `cornering.test.ts:93-96`, `:102`, `:104`; `carSpec.test.ts:38-39`; browser `drive.spec.ts:169-170` | - |
| DEV field, Surface (1) | `plan.md:47`; `src/core/Game.ts:581-582` (carried from b03a8d3) | `__game.car.cornerAssistN` `drive.spec.ts:78`, `:86` | - |
| superseded yaw-assist checks (1) | carried from b03a8d3 | ya-5 → C4 `cornering.test.ts:71` | - |
| startup config: car construction (1 assembly) | `src/core/Game.ts:164` (carried from b03a8d3) | ch C35 `drive.spec.ts:169-170` ✓ | - |

## Test policy rows

Verified at 54012bc nas linhas do `Car.ts` e da instrumentação, que classificam o que o fix passou a provar. As
outras estão carried from b03a8d3.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/vehicle/cornerAssist.ts` | própria C6 · fronteira C1-C5, C7 | yes. 10 linhas da tabela, cada uma com caso (`cornerAssist.test.ts:23-33`). Carried from b03a8d3 |
| Car aplica no centro de massa e lê a ficha ("fronteira pelo harness") | `src/vehicle/Car.ts` | C7 | yes. O lado da força pelo sentido da marcha (`Car.ts:389`) tem caso de ré pelo registro (`cornering.test.ts:131`) e agora também pelo corpo (`:172`). A ressalva da rodada 2 (a prova lia só o registro) está fechada: F9 e F10 morrem |
| Dados | `src/vehicle/carSpec.ts` | C7 | yes (carried from b03a8d3) |
| Instrumentation, pass-throughs | `src/core/Game.ts` (`:581-582`); `Car.cornerAssistImpulse` (`Car.ts:84`) | coberto pela prova do consumidor | yes. `drive.spec.ts:78`, `:86`. O consumidor do campo novo, `cornering.test.ts:129-132` e `:151-154`, agora confere também o zero prometido em `Car.ts:83` |

## Faults injected

Verified at 54012bc. Rodei num worktree de rascunho separado, sem `git stash`:
- O `git status --porcelain` do worktree do Verifier estava vazio antes de começar.
- Criei o rascunho com `git worktree add --detach <scratchpad>/ca-r3-faults HEAD` e pus uma junction de
  `node_modules`.
- Desenhei as faltas sem copiar os diffs da rodada 2. Apliquei uma por vez com `sed`, rodei a prova mais estreita
  (`npx vitest run tests/physics/cornering.test.ts -t "car applies the corner assist from its spec at the center of
  mass"`) e desfiz cada uma com `git checkout -- src`. O porcelain do rascunho ficou vazio depois de cada uma.
- Apaguei a junction com `(Get-Item ...\node_modules).Delete()` antes do `git worktree remove`. O `node_modules`
  compartilhado continua lá (`node_modules\vitest\package.json` existe), e o porcelain do worktree do Verifier
  ficou vazio no fim.

| Mutation | Location | Killed |
| --- | --- | --- |
| F8 (reinjetada) registro sem zerar entre passos: apaguei as 3 atribuições `cornerAssistImpulse.{x,y,z} = 0` | `src/vehicle/Car.ts:381-383` | yes. C7 `tests/physics/cornering.test.ts:152`: "x after force: expected 150.8368111633499 to be +0" |
| F9 (reinjetada) corpo recebe `{ x: v.z·N·dt/speed, y: 0, z: −v.x·N·dt/speed }`, ou seja, o erro de F5 só no vetor aplicado, com o registro certo | `src/vehicle/Car.ts:393` | yes. C7 `tests/physics/cornering.test.ts:172`: "reverse left drift on -119.05 off -110.28: expected -119.05 to be greater than -110.28" |
| F5 (regressão) sem o sinal da marcha no registro e no corpo: `side = 1 / speed` | `src/vehicle/Car.ts:389` | yes. C7 `tests/physics/cornering.test.ts:131`: "-28 km/h step 6: expected -21.31 to be greater than 0" |
| F10 (nova) o corpo só recebe o impulso de frente: `if (forwardSpeed > 0) this.body.applyImpulse(...)`, com o registro preenchido também em ré | `src/vehicle/Car.ts:393` | yes. C7 `tests/physics/cornering.test.ts:172`: "reverse left drift on -110.28 off -110.28: expected -110.28 to be greater than -110.28" |

Carried from b03a8d3 (superfícies que o fix não tocou): F6 (`<=` na guarda de 5 m/s, `cornerAssist.ts:27`) morre em
`cornerAssist.test.ts:41`, e F7 (componente vertical no impulso, `Car.ts:392`) morre em `cornering.test.ts:132`.

Também medi a margem da prova nova no HEAD, trocando só no rascunho o matcher de `:172` por um que sempre falha para
ler os valores: com a força dá −97.37, sem ela −110.28. Depois desfiz com `git checkout -- tests`.

## Swept existing

Carried from b03a8d3. A dependency failure (placeholder sem GLB) continua valendo: `applyCornerAssist`
(`Car.ts:378-394`) não lê `assets`. Na observability, o contrato de zero de `cornerAssistImpulse` (`Car.ts:83`) agora
tem prova em `cornering.test.ts:152-154`.

## Deviations judged

Carried from b03a8d3 (e de c3e564f): valores da ficha, a troca de texto da C7 e as margens estreitas (C1 +3.3 %,
C4 0.067 g, ya C1 14 de 15 passos). O `src` não mudou desde b03a8d3, então as margens são as mesmas.

Verified at 54012bc: o fix não mexeu em `checks.md` nem em `plan.md`. A única diferença de escopo é o texto da C7,
que não nomeia as duas asserções novas (ver Julgamento do fix).

## Gate

- `npx vitest run --testTimeout=60000`: 37 arquivos, **148 passed, 0 failed**.
- `npx vitest run` (timeout padrão de 5 s), rodado 2 vezes: 147 passed, 1 failed. A falha é sempre
  `tests/unit/interiorMotion.test.ts > interior motion > string lights sway`, "Test timed out in 5000ms" (5.6 a
  6.0 s). Esse arquivo é de outra feature (interiores das quadras) e o fix não o toca. Durante a rodada a CPU estava em ~80 %, com um
  `chrome-headless-shell` de outra sessão rodando. Com timeout maior o teste passa em 3.4 s (14/14 no arquivo). A
  rodada 2 viu o mesmo teste falhar uma vez com a máquina carregada.
- `npx vitest run` com os 9 arquivos das provas (verbose): 33 passed, 0 failed.
- `E2E_PORT=5206 npx playwright test tests/e2e/drive.spec.ts tests/e2e/visual.spec.ts -g "car debug exposes the
  corner assist force|A turns left|game builds the car from the default spec|car debug exposes the yaw assist
  torque|camera swings left while turning left|camera leans with the body"`: 6 passed, 0 failed.

## Ranked gaps

Nenhum gap reprova a corner-assist. Ficam só estas observações:

1. **O texto da C7 não acompanhou o fix.** A C7 (`checks.md:60-61`) não fala do registro zerado nos passos sem
   força nem do empurrão no corpo em ré, que `cornering.test.ts:150-154` e `:172` agora provam. Sugestão:
   acrescentar os dois bullets à C7 para o check dizer o que a prova garante.
2. **Margens estreitas** (carried from c3e564f, não reprovam): C1 +3.3 %, C4 0.067 g e ya C1 14 de 15 passos.
3. **Fora da feature:** `tests/unit/interiorMotion.test.ts` ("string lights sway") leva 3.4 a 6.0 s, perto do
   timeout padrão de 5 s. Com a máquina carregada ele falha (2 de 2 rodadas completas nesta verificação). Vale um
   `timeout` explícito no teste ou deixar o cálculo mais leve, na feature dona do arquivo.

Resolvidos desde b03a8d3:
- F8 morre em `cornering.test.ts:152`.
- F9 morre em `cornering.test.ts:172`, e a variante F10 também.
- F5 continua morrendo em `cornering.test.ts:131`.
