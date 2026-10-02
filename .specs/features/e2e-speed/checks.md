# e2e-speed checks

Profile: standard
Plan: `.specs/features/e2e-speed/plan.md`

13 checks em 3 slices · 2 one-way doors · 0 open

## Checks

### S1 - avanço rápido no jogo · 4 files · 103 KB · ~26k

**C1** - `GameLoop.runSteps(5)` chama `fixedUpdate` exatamente 5 vezes, cada uma com dt = 1/60, e `render` 0 vezes; `runSteps(0)` não chama nenhum dos dois (AC 1)
Proof: `npx vitest run tests/unit/gameLoop.test.ts -t "runSteps calls fixedUpdate n times without render"`

**C2** - Com `fixedUpdate` lançando na 3ª chamada, `runSteps(5)` chama `fixedUpdate` 3 vezes, deixa `running` = false e chama `onError` 1 vez com o mesmo erro; `runSteps` não relança (AC 2)
Proof: `npx vitest run tests/unit/gameLoop.test.ts -t "runSteps stops on a throw and reports it once"`

**C3** - No browser, `__game.stepSim(s)` para s ∈ {0.5, 1, 1/60} devolve `simTime` igual ao de antes da chamada + `Math.round(s * 60) / 60` (± 1e-9), lido dentro do mesmo `evaluate` (AC 3)
Proof: `npx playwright test tests/e2e/harness.spec.ts -g "stepSim advances exactly the requested steps"`

**C4** - No browser, do spawn parado, com `KeyW` pressionada por `page.keyboard.down`, `__game.stepSim(2)` deixa `car.speedKmh` > 10 (AC 4)
Proof: `npx playwright test tests/e2e/harness.spec.ts -g "stepSim reads held keys"`

**C5** - No browser, depois de `KeyW` + `stepSim(2)` e da espera de 1 quadro (`__game.frames` + 1), `#speed` do HUD é igual a `round(|car.speedKmh|)` ± 1 (AC 5)
Proof: `npx playwright test tests/e2e/harness.spec.ts -g "next frame shows the last step"`

### S2 - helpers pelo avanço rápido · 12 files · 172 KB · ~43k

**C6** - `advanceSim(page, s)` sem opção, para s ∈ {3, 0.02}: os passos do próprio helper (espião em `__game.stepSim`, antes e depois lidos no mesmo `evaluate` da chamada) levam `simTime` de t0 a um valor ≥ t0 + s e ≤ t0 + s + 1/60 (± 1e-9); para s = 3, `__game.frames` cresce ≥ 1 e ≤ 10 durante a chamada (o laço de quadros levaria ≥ 36 quadros para 3 s a 5 passos por quadro). 0.02 s são 1.2 passos: `Math.round` dá 1 e só o passo extra alcança o alvo (AC 6; renegociado na verificação rodada 2, 2026-10-02, user delegated: o "cresce ≥ 3" lido entre `evaluate`s não via o passo extra)
Proof: `npx playwright test tests/e2e/harness.spec.ts -g "advanceSim steps fast and waits one frame"`

**C7** - `advanceSim(page, 1, { realtime: true })`: `simTime` cresce ≥ 1 e `__game.frames` cresce ≥ 12 durante a chamada (AC 7)
Proof: `npx playwright test tests/e2e/harness.spec.ts -g "advanceSim realtime waits on the frame loop"`

**C8** - Com `KeyW` pressionada, `waitSimUntil(page, 'g.car.speedKmh >= 30', 10)` devolve true e, na volta, 30 ≤ `speedKmh` < 30 + o ganho de um passo medido no mesmo teste (+ 0.5 km/h de folga); `waitSimUntil(page, 'false', 0.5)` devolve false e os passos do próprio helper (espião em `__game.stepSim`) levam `simTime` de t0 a um valor ≥ t0 + 0.5 e ≤ t0 + 0.5 + 1/60 (± 1e-9) (AC 8; renegociado na verificação rodada 2, 2026-10-02, user delegated: o "entre 0.5 e 0.75" lido entre `evaluate`s não via um prazo um passo curto)
Proof: `npx playwright test tests/e2e/harness.spec.ts -g "waitSimUntil stops on the first step that holds"`

**C9** - As provas que dependem do quadro (Coverage "provas por quadro") passam e cada uma usa `{ realtime: true }`, `waitFrames` ou `sampleCountdown` em toda espera de simulação do corpo do teste (AC 9)
Proof: `npx playwright test tests/e2e/visual.spec.ts tests/e2e/audio.spec.ts tests/e2e/race.spec.ts -g "camera fov follows speed|camera swings left while turning left|camera leans with the body|throttle raises engine gain|lowpass cutoff follows rpm|countdown holds every car"`

### S3 - suíte mais curta · 3 files · 4 KB · ~1k

**C10** - `playwright.config.ts` tem `workers: Number(process.env.E2E_WORKERS ?? 2)`; `npx playwright test --list` com `E2E_WORKERS=1` e sem a variável lista os mesmos testes, e o config importado com a variável ausente dá `workers` = 2 e com `E2E_WORKERS=1` dá 1 (AC 10)
Proof: `npx vitest run tests/unit/e2eConfig.test.ts -t "workers come from E2E_WORKERS with default 2"`

**C11** - `npm run test:e2e` numa máquina ociosa termina com exit 0, 0 falhas, todos os testes listados rodando, em até 30 min de relógio (AC 11; renegociado de 25 min pelo usuário em 2026-10-01)
Proof: `npm run test:e2e` com `E2E_PORT` livre, tempo pelo `Measure-Command` ou pelo total que o Playwright imprime

**C12** - `npm run test:e2e:smoke` numa máquina ociosa termina com exit 0 e 0 falhas em até 3 min (AC 12)
Proof: `npm run test:e2e:smoke`, tempo pelo total que o Playwright imprime

**C13** - `AGENTS.md` cita `E2E_WORKERS` e os tempos medidos em C11 e C12 nas linhas de `npm run test:e2e` e `npm run test:e2e:smoke` (AC 13)
Proof: `npx vitest run tests/unit/docs.test.ts -t "agents gives the e2e times and workers"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| door 1: avanço rápido (3 partes) | `GameLoop.runSteps` C1, C2 · `__game.stepSim` C3, C4, C5 · helpers `advanceSim`/`waitSimUntil` C6, C7, C8 | - |
| door 2: paralelismo (2 valores) | sem variável → 2 C10 · `E2E_WORKERS=1` → 1 C10 | - |
| `runSteps` saídas (3) | n passos C1 · n = 0 C1 · throw no meio C2 | - |
| modos do helper (2) | rápido C6, C8 · tempo real C7, C9 | - |
| `waitSimUntil` saídas (2) | predicado vale C8 · prazo esgota C8 | - |
| provas por quadro (6) | `camera fov follows speed` C9 · `camera swings left while turning left` C9 · `camera leans with the body` C9 · `throttle raises engine gain` C9 · `lowpass cutoff follows rpm` C9 · `countdown holds every car` C9 | - |
| suítes com tempo (2) | completa C11 · smoke C12 | - |

- Claims naming a runtime value in the browser (C3-C9) have browser proofs; the loop's decision table (C1, C2) is proven at its own layer
- C11 is the only proof that every existing e2e test keeps its meaning under the fast helpers; a test in the "provas por quadro" set that should have stayed on frames and did not shows up there as a failure

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, not reached across a boundary (`GameLoop.runSteps`: laço com contagem e try/catch, 3 saídas) | uma na própria camada, vitest | um caso por saída: n passos, n = 0, throw no meio |
| Decides, reached across a boundary (helpers: 2 modos, 2 saídas do `waitSimUntil`; `stepSim` no hook DEV) | uma no browser | cada modo e cada saída com o valor do check |
| Instrumentation (`playwright.config.ts` lendo a variável) | uma que importa o config | os 2 valores da door 2 |

Evidence:

- `src/core/GameLoop.ts` `frame`: 1 try/catch, 1 laço -> decides; `runSteps` repete a forma
- closest analogue: `tests/unit/gameLoop.test.ts` já prova o `frame` (throw → `onError`) na própria camada
- `tests/e2e/helpers.ts` `waitSimUntil`: 2 saídas (vale / prazo) -> decides, só roda no browser

## Swept

- validation: C3 (s fracionário e 1/60 viram passos inteiros por `Math.round`)
- failure modes: C2 (throw no passo), C11 (suíte inteira sob os helpers novos)
- idempotency: n/a - `stepSim` avança o estado de propósito; chamar duas vezes anda duas vezes
- authorization: existing - o hook `__game` só existe em `import.meta.env.DEV` (AD-005)
- concurrency: C6 (o `evaluate` síncrono não intercala com o quadro; o quadro seguinte roda depois), C10 (workers em paralelo)
- data lifecycle: n/a - nada persiste
- dependency failure: existing - o vite não cai mais com arquivo travado na raiz (commit 28a6976)
- state transitions: C2 (`running` → false no throw)
- observability: C11, C12 (tempo da suíte medido), C13 (tempos no `AGENTS.md`)

## Handoff

- S1 = 26k (Game.ts é 98 KB e domina), S2 entra em `tests/e2e` com 69k no total, S3 1k: 70k, abaixo do budget de 150k - um builder
