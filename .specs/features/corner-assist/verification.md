# Corner assist verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: c3e564f..b03a8d3 (fix 0051a1b, merge a726ee1, lição b03a8d3; rodada 1 verificada em c3e564f)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Resumo: os gaps da rodada 1 estão fechados. F5 (`side = 1 / speed`) agora morre em
`tests/physics/cornering.test.ts:131`, e o `<=` na guarda de 5 m/s morre em
`tests/unit/cornerAssist.test.ts:41`. O campo novo `Car.cornerAssistImpulse` não muda a física: a simulação ficou
idêntica bit a bit à de c3e564f.

O FAIL vem da superfície nova. A prova de direção lê o que o `Car` diz que aplicou, e não o que chegou ao corpo:
- F9: apliquei no corpo um vetor diferente do registrado, com o erro de F5 só no vetor aplicado. A suíte inteira
  passou (148/148).
- F8: tirei o zeramento do registro entre passos. A suíte inteira também passou. Para a física essa falta é
  equivalente, mas o comentário de `Car.ts:83` promete zero.

Hoje o registro e o vetor aplicado são o mesmo objeto (`Car.ts:393`), então o jogo está certo. Minha sonda física
em ré confirma. O problema é que só a leitura do código garante isso; nenhuma prova garante.

## Binding sources

Carried from c3e564f. O fix não tocou o `plan.md`.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| nenhuma fonte binding | n/a | - | - |

## Checks

Verified at b03a8d3, no worktree do Verifier. Criei a junction de `node_modules`, e o `git status --porcelain`
ficou vazio antes e depois. As provas rodaram por inteiro no HEAD:
- `npx vitest run` (suíte toda): 37 arquivos, **148 passaram**, 0 falharam, exit 0 (12.4 s). O número é o mesmo
  da rodada 1 porque as asserções novas entraram em testes que já existiam. Os testes de geração do mundo e a
  matriz de capotamento não deram timeout.
- `npx vitest run` com os 9 arquivos das provas (`--reporter=verbose`): **33 passaram**. Cada nome citado em C1-C14
  aparece com ✓.
- `E2E_PORT=5204 npx playwright test tests/e2e/drive.spec.ts tests/e2e/visual.spec.ts -g "car debug exposes the
  corner assist force|A turns left|game builds the car from the default spec|car debug exposes the yaw assist
  torque|camera swings left while turning left|camera leans with the body"`: **6 passaram** (2.3 min, exit 0). A
  porta vem de `playwright.config.ts:4`. Os testes são `drive.spec.ts:49`, `:64`, `:77`, `:164` e `visual.spec.ts:272`,
  `:304`.
- Fora do escopo: durante a rodada da falta F5 no rascunho, `tests/unit/interiorMotion.test.ts` ("string lights
  sway") falhou uma vez. Rodei o arquivo sozinho no rascunho limpo e deu 14/14. Foi carga da máquina (o Playwright
  rodava ao mesmo tempo), e esse arquivo não pertence a esta feature.

O fix mudou só `cornering.test.ts` e `cornerAssist.test.ts`. No primeiro, o único acréscimo acima da linha 118 é o
`axis` no import, então as citações de C1-C5 continuam válidas. As citações de C8-C14 vêm de arquivos que o fix não
tocou e estão carried from c3e564f, mas as provas rodaram de novo no HEAD.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | giro em regime a 100 km/h ≥ 31.8°/s | vitest `radius at most 50 m at 100 kmh` ✓ | `tests/physics/cornering.test.ts:52` `>= 0.555` (carried from c3e564f: 32.84°/s; física idêntica, ver Deviations) | PASS |
| C2 | giro em regime a 140 km/h ≥ 22.3°/s | vitest `radius at most 100 m at 140 kmh` ✓ | `tests/physics/cornering.test.ts:57` `>= 0.3892` | PASS |
| C3 | giro em regime a 60 km/h ≥ 35°/s | vitest `still turns at least 35 degrees per second at 60 kmh` ✓ | `tests/physics/cornering.test.ts:62` `>= 35 * DEG` | PASS |
| C4 | 5 velocidades, ≤ 1.7 g em todo passo | vitest `lateral acceleration never exceeds 1.7 g` ✓ | `tests/physics/cornering.test.ts:71` `toBeLessThanOrEqual(1.7)`; `:67` as 5 velocidades | PASS |
| C5 | < 0.15 g em algum dos 60 passos após soltar | vitest `path straightens within 1 s after release` ✓ | `tests/physics/cornering.test.ts:84` `after.some(x => x < 0.15)` | PASS |
| C6 | fórmula da door 1, **10 linhas** (inclui exatamente 5 m/s), tol 1e-3 | vitest `corner assist force fills lateral acceleration above the start` ✓ | `tests/unit/cornerAssist.test.ts:23-33` iguais às 10 linhas de `checks.md:43-52`. A linha nova `:33` é `1.2, 5, 4, false` e dá 1000 · min(25 · tan 1.2 / 2.6 − 8.829, 7.848) = 7848 (pede 15.90 m/s² acima do início, conferi à mão). `:35` `rows.length` = 10. `:36` a linha nova espera > 0. `:41` `Math.abs(f - expected) <= TOL`. O `<=` na guarda morre aqui (F6) | PASS |
| C7 | ficha; zero com max = start; ≥ 60 passos; rolagem ≤ 1.0°; > 0 andando, 0 parado; **impulso para a esquerda do carro e sem componente vertical a 100 e a −28 km/h, em ≥ 5 dos 40 passos**; browser | vitest `car applies the corner assist from its spec at the center of mass` ✓; pw `car debug exposes the corner assist force` ✓ (porta 5204) | `tests/physics/cornering.test.ts:93-96`, `:102`, `:104`, `:109`, `:112` e `:117` não mudaram. As linhas novas são `:120` `[100, -28]`, `:131` `along > 0` (produto com o `+X` do chassi, `:128`), `:132` `Math.abs(imp.y)` `toBe(0)` e `:135` `pushed >= 5`. Browser: `tests/e2e/drive.spec.ts:78`, `:86`. O texto de `checks.md:57-62` bate com `:119-136`. A prova lê `car.cornerAssistImpulse` e não o corpo: ver F8 e F9 | PASS |
| C8 | `cornerAssist.ts` na lista pura | vitest `pure modules do not import three or rapier` ✓ | `tests/unit/purity.test.ts:40`, `:48`, `:51` (carried from c3e564f, arquivo não tocado) | PASS |
| C9 | ch C2 e C3 verdes, sem mudança | vitest os 2 nomes ✓ | `tests/physics/stability.test.ts:74`, `:83-84` (carried from c3e564f) | PASS |
| C10 | cf C1-C4 verdes, sem mudança | vitest os 4 nomes ✓ | `tests/physics/feel.test.ts:36-40`, `:53-57`, `:71-72`, `:84-85` (carried from c3e564f) | PASS |
| C11 | cf C10, sideslip ≤ 12° | vitest `understeers without throttle or at speed` ✓ | `tests/physics/feel.test.ts:117`, `:122` (carried from c3e564f) | PASS |
| C12 | ch C11, C12, C13, C36 | vitest os 4 nomes ✓ | `tests/physics/grip.test.ts:25`, `:50`, `:55`, `:59`, `:91`, `:37` (carried from c3e564f) | PASS |
| C13 | ya C1, C4, C6 | vitest os 3 nomes ✓ | `tests/physics/agility.test.ts:45`, `:69`, `:71`, `:81` (carried from c3e564f) | PASS |
| C14 | ch C19-C23 e provas do browser | vitest os 5 de `powertrain` ✓; pw 5 ✓ (porta 5204) | `tests/physics/powertrain.test.ts:20-21`, `:38-40`, `:53-54`, `:71-72`, `:84`; `tests/e2e/drive.spec.ts:60`, `:73`, `:169`, `:170`; `tests/e2e/visual.spec.ts:291-293`, `:299-300`, `:324-325`, `:349`, `:351` (carried from c3e564f) | PASS |

### Julgamento do fix

- **Neutro para a física.** Antes, `Car.ts` passava ao `applyImpulse` um literal `{ x: v.z * k, y: 0, z: -v.x * k }`.
  Agora ele preenche `cornerAssistImpulse.x/z` (`src/vehicle/Car.ts:391-392`), com `y` zerado em `:382`, e passa o
  objeto (`:393`).
  - O Rapier copia o vetor na hora da chamada: `applyImpulse(A,I){const g=oI.intoRaw(A);...}` em
    `rapier.mjs`. Então o vetor aplicado é o mesmo de antes.
  - Rodei uma sonda no rascunho com 180 passos e `steer +1`, a 100, 60, 140 e −28 km/h, mais 40 passos de ré com e
    sem a força. Ela deu **saída idêntica bit a bit** com o `src` de b03a8d3 e com o de c3e564f (posição, rotação e
    velocidade finais).
- **O zeramento** (`Car.ts:381-383`) roda antes do `return` de `:384`, então o campo fica zero nos passos sem força,
  como promete o comentário de `:83`. **Mas nenhuma prova olha esses passos** (F8).
- **Nenhuma asserção ficou mais fraca.** `git diff c3e564f b03a8d3 -- tests src | grep '^-'` só mostra a chamada
  literal do `applyImpulse`, o import sem `axis`, o comentário "9 rows" e `rows.length).toBe(9)`, que virou `10`.
  Nenhum matcher ou tolerância mudou.
- **A nota "(Prova trocada...)"** agora fica depois de todos os bullets da C7 (`checks.md:64`). O item cosmético da
  rodada 1 está resolvido.
- **Campo público novo.** `Car.cornerAssistImpulse` não está no `Surface` do plano (`plan.md:47`). Só o harness usa
  o campo (`cornering.test.ts:129`), e o `Game.ts` não o expõe. É instrumentação, sem efeito fora dos testes.

## Coverage

Verified at b03a8d3 nas linhas que o fix tocou: door 1, casos, ramos. As outras estão carried from c3e564f.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (12) | `plan.md` Criteria, AC 1-12 (carried from c3e564f) | 1 `cornering.test.ts:52` · 2 `:57` · 3 `:62` · 4 `:71` · 5 `:84` · 6 `cornerAssist.test.ts:41` e `cornering.test.ts:117`, `:131` · 7 `stability.test.ts:74`, `:83-84` · 8 `feel.test.ts:36-40`, `:53-57`, `:71-72`, `:84-85` · 9 `feel.test.ts:117` · 10 `grip.test.ts:25`, `:59`, `:91`, `:37` · 11 `agility.test.ts:45`, `:69`, `:81` · 12 `powertrain.test.ts:20-84` | - |
| door 1 - obrigações (6) | `plan.md:53` | assinatura e fórmula `cornerAssist.test.ts:41` · 2 campos `cornering.test.ts:93-96`, `carSpec.test.ts:38-39`, `:77` · pura `purity.test.ts:40`, `:51` · centro de massa `cornering.test.ts:109` · horizontal `:132` · lado esquerdo do carro de frente e **de ré, no `Car`**: `:131` com `v0` 100 e −28 (F5 morre). Essa prova lê o registro do `Car`, não o corpo (F9 sobrevive) | - |
| corner assist cases (10) | `checks.md:43-52`, `src/vehicle/cornerAssist.ts:27-33` | abaixo do início `cornerAssist.test.ts:23` · livre `:24` · limitado `:25` · lado oposto `:26` · ré `:27` e `cornering.test.ts:131` · abaixo de 5 m/s `:28` · 1 roda `:29` · 2 rodas `:30` · freio de mão `:31` · **exatamente 5 m/s** `:33` (F6 morre); todos em `:41` | - |
| ramos de `applyCornerAssist` (4) | `src/vehicle/Car.ts:378-394` | força zero, sem impulso `cornering.test.ts:102`, `:117` · de frente `:131` (100 km/h), `:104` · velocidade horizontal < 1e-6 (`Car.ts:387`, sem efeito: a função já zera abaixo de 5 m/s) · **de ré** `:131` (−28 km/h; F5 morre) | - |
| spec fields (2) | `plan.md` Landing, `src/vehicle/carSpec.ts` (carried from c3e564f) | startG e maxG `cornering.test.ts:93-96`, `:102`, `:104`; `carSpec.test.ts:38-39`; browser `drive.spec.ts:169-170` | - |
| DEV field, Surface (1) | `plan.md:47`; `src/core/Game.ts:581-582` (carried from c3e564f) | `__game.car.cornerAssistN` `drive.spec.ts:78`, `:86` | - |
| superseded yaw-assist checks (1) | carried from c3e564f | ya-5 → C4 `cornering.test.ts:71` | - |
| startup config: car construction (1 assembly) | `src/core/Game.ts:164` (carried from c3e564f) | ch C35 `drive.spec.ts:169-170` ✓ | - |

## Test policy rows

Verified at b03a8d3 na linha do `Car.ts`, que foi re-julgada. As outras estão carried from c3e564f.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/vehicle/cornerAssist.ts` | própria C6 · fronteira C1-C5, C7 | yes. 10 linhas da tabela, cada uma com caso (`cornerAssist.test.ts:23-33`), incluindo a borda de 5 m/s. Carried from c3e564f, com a linha nova verificada em b03a8d3 |
| Car aplica no centro de massa e lê a ficha ("fronteira pelo harness") | `src/vehicle/Car.ts` | C7 | yes. O lado da força pelo sentido da marcha (`Car.ts:389`) agora tem caso de ré, `cornering.test.ts:131` com −28 km/h, e F5 morre. A ressalva sobre a prova ler o registro e não o corpo está em Faults (F9) |
| Dados | `src/vehicle/carSpec.ts` | C7 | yes (carried from c3e564f) |
| Instrumentation, pass-throughs | `src/core/Game.ts` (`:581-582`); `Car.cornerAssistImpulse` (`Car.ts:84`) | coberto pela prova do consumidor | yes. `drive.spec.ts:78`, `:86`. O único consumidor do campo novo é `cornering.test.ts:129-132` |

## Faults injected

Verified at b03a8d3. Rodei num worktree de rascunho separado, sem `git stash`:
- Criei com `git worktree add --detach <scratchpad>/ca-r2-faults HEAD` e pus uma junction de `node_modules`.
- Apliquei uma falta por vez e desfiz cada uma com `git checkout -- src`.
- As sondas (`zprobe.test.ts`) foram apagadas, e o `git status --porcelain` do rascunho ficou vazio no fim.
- Apaguei a junction com `(Get-Item ...\node_modules).Delete()` antes do `git worktree remove`, e o
  `node_modules` compartilhado continua lá.
- O `git status --porcelain` do worktree do Verifier ficou vazio antes e depois.

| Mutation | Location | Killed |
| --- | --- | --- |
| F5 (reinjetada) sem o sinal da marcha: `side = 1 / speed` | `src/vehicle/Car.ts:389` | yes. C7 `tests/physics/cornering.test.ts:131`: "-28 km/h step 6: expected -21.31 to be greater than 0" |
| F6 guarda de 5 m/s com `<=`: `Math.abs(forwardSpeedMs) <= MIN_SPEED_MS` | `src/vehicle/cornerAssist.ts:27` | yes. C6 `tests/unit/cornerAssist.test.ts:41`: "exactly 5 m/s: got 0, expected 7848" |
| F7 componente vertical no impulso: `cornerAssistImpulse.y = -Math.abs(k) * speed * 0.2` | `src/vehicle/Car.ts:392` | yes. C7 `tests/physics/cornering.test.ts:132`: "expected 32.54 to be +0". Também caiu `agility.test.ts:95` (ya C7) |
| F8 registro sem zerar entre passos (apaguei `:381-383`) | `src/vehicle/Car.ts:381-383` | no. `npx vitest run tests/physics tests/unit`: 148/148. A prova pula os passos com `cornerAssistN <= 0` (`cornering.test.ts:127`), então nunca vê o valor velho. Para a física a falta é equivalente, porque o vetor aplicado não muda. Mas o campo contradiz o próprio comentário (`Car.ts:83`, "zero quando não houve força") |
| F9 vetor aplicado diferente do registrado: `applyImpulse({ x: v.z·N·dt/speed, y: 0, z: −v.x·N·dt/speed })`, que é o erro de F5 só no corpo, com o registro certo | `src/vehicle/Car.ts:393` | no. `npx vitest run tests/physics tests/unit`: 148/148. Em ré o carro é empurrado para a direita (a door 1 é violada) e nenhuma prova vê. A C7 lê `car.cornerAssistImpulse`, e o elo entre registro e corpo é só o mesmo objeto em `:393` |

### Sonda física em ré (evidência do Verifier, não é prova de check)

Rodei 40 passos a −28 km/h com `steer +1` e somei a velocidade ao longo do `+X` do chassi (a esquerda do carro) em
cada passo:

| Código | Com a ficha (`DEFAULT_CAR`) | Sem a força (`maxG = startG`) |
| --- | --- | --- |
| b03a8d3 (igual a c3e564f) | −97.24 | −110.12 |
| com F5 | −118.88 | −110.12 |

No HEAD a força empurra para a esquerda do carro em ré. Uma asserção física como "com a ficha > sem a força" separa
o código certo de F5 e de F9 com folga (~9-13 unidades).

## Swept existing

Carried from c3e564f. Na observability, o campo novo `cornerAssistImpulse` fica em `Car.ts:84` e só o harness o lê.
A dependency failure (placeholder sem GLB) continua valendo: `applyCornerAssist` (`Car.ts:378-394`) não lê
`assets`.

## Deviations judged

Carried from c3e564f: os valores da ficha, a troca de texto da C7 e as margens. A física de b03a8d3 é idêntica bit a
bit à de c3e564f (sonda acima), então as margens medidas na rodada 1 continuam as mesmas: C1 +3.3 %, C4 0.067 g e
ya C1 14 de 15 passos, todas **estreitas**.

Verified at b03a8d3: o fix trocou o texto de `checks.md`.
- C6 ganhou a linha "exatamente 5 m/s".
- C7 ganhou o bullet de direção.
- Os bullets de centro de massa e browser foram reorganizados, sem mudar o conteúdo.

As trocas acompanham os gaps 1 e 2 da rodada 1. Nenhum limite mudou.

## Gate

`npx vitest run` - 148 passed, 0 failed · `E2E_PORT=5204 npx playwright test tests/e2e/drive.spec.ts tests/e2e/visual.spec.ts -g "car debug exposes the corner assist force|A turns left|game builds the car from the default spec|car debug exposes the yaw assist torque|camera swings left while turning left|camera leans with the body"` - 6 passed, 0 failed

## Ranked gaps

1. **A prova de direção da C7 lê o registro do `Car`, não o corpo** (F9 sobrevive; C7 / door 1).
   - Onde: `tests/physics/cornering.test.ts:129-131` e `src/vehicle/Car.ts:393`.
   - Hoje o registro e o impulso aplicado são o mesmo objeto, e a sonda física confirma que a ré está certa. Mas
     se alguém calcular o vetor aplicado separado do registrado, o empurrão em ré para a direita volta sem nenhuma
     prova falhar.
   - Como fechar: acrescentar à C7 uma asserção sobre o corpo. Por exemplo, a −28 km/h com `steer +1` por 40
     passos, a soma da velocidade ao longo do `+X` do chassi com `DEFAULT_CAR` é maior que com
     `maxG = startG`. Medido: −97.24 contra −110.12; com F5 dá −118.88.
2. **O registro não é conferido nos passos sem força** (F8 sobrevive; é equivalente para a física).
   - Onde: `src/vehicle/Car.ts:381-383`. O comentário de `:83` promete zero.
   - Como fechar: uma asserção de `cornerAssistImpulse` igual a `{0, 0, 0}` no passo parado
     (`cornering.test.ts:116-117`) ou num passo com `cornerAssistN` 0 depois de passos com força.
3. **Margens estreitas** (carried from c3e564f, não reprovam): C1 +3.3 %, C4 0.067 g e ya C1 14 de 15 passos.
4. Fora da feature: `tests/unit/interiorMotion.test.ts` ("string lights sway") falhou uma vez com a máquina
   carregada e passou sozinho (14/14).

Resolvidos desde c3e564f:
- F5 em `Car.ts:389` (era `:384`) morre.
- A borda de 5 m/s morre em `cornerAssist.test.ts:41`.
- A nota da C7 está no lugar certo.
