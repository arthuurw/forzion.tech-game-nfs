# test-hardening checks

Profile: standard
Plan: `.specs/features/test-hardening/plan.md`

32 checks in 6 slices · 3 one-way doors · 1 open, of which 0 block (1 blocks go-live)

## Checks

### S1 - suíte unitária estável sob carga · 6 files · 60 KB · ~15k

**C1** - ✅ Todo teste de `tests/unit` e de `tests/physics` sem timeout próprio roda com `task.timeout` = 30000 ms (AC 1)
Proof: `npx vitest run tests/unit/testConfig.test.ts -t "unit tests run with a 30 s timeout"`
Proof: `npx vitest run tests/physics/testConfig.test.ts -t "physics tests run with a 30 s timeout"`

**C2** - ✅ Com a máquina ociosa, nenhum teste de `tests/unit` leva mais que 3000 ms no relatório JSON do vitest (AC 2)
Proof: `npx vitest run tests/unit --reporter=json --outputFile=test-results/unit-durations.json && node tests/tooling/max-duration.mjs test-results/unit-durations.json 3000`

**C3** - ✅ `npm run test:quick` sai com 0, e a lista de testes que ele roda não tem `each opponent finishes every race in time` (AC 3, door 2)
Proof: `npm run test:quick`
Proof: `npx vitest list --tags-filter="!slow"` sem nenhuma linha com `each opponent finishes every race in time` (`node tests/tooling/list-has.mjs --tags-filter="!slow" --absent "each opponent finishes every race in time"`)

**C4** - ✅ `npm test` continua listando `each opponent finishes every race in time`, com 212 testes: os 202 de antes, menos os 6 do gerador antigo que a C26 remove, mais os 16 que esta feature cria (AC 4; corrigido na rodada 2: dizia C25 e não dava o número)
Proof: `node tests/tooling/list-has.mjs --present "each opponent finishes every race in time"` (a saída dá o total listado, 212)

### S2 - e2e no checkout certo e com suíte curta · 12 files · 180 KB · ~45k

**C5** - ✅ Com um servidor já respondendo na porta e sem `E2E_REUSE`, `playwright test` sai com código ≠ 0, a saída contém `is already used` e nenhum teste roda (AC 5, door 2)
Proof: `node tests/tooling/e2e-reuse.mjs` (caso `without E2E_REUSE`)

**C6** - ✅ Com `E2E_REUSE=1` e o servidor da porta de pé, o mesmo teste roda e sai com 0 (AC 6)
Proof: `node tests/tooling/e2e-reuse.mjs` (caso `with E2E_REUSE=1`)

**C7** - ✅ Cada um dos 9 arquivos `tests/e2e/*.spec.ts` tem pelo menos 1 teste com `tag: '@smoke'`, e `test:e2e:smoke` é `playwright test --grep @smoke` (AC 7, door 2)
Proof: `npx vitest run tests/unit/testHygiene.test.ts -t "every e2e spec file has a smoke test"`

**C8** - ✅ `npm run test:e2e:smoke` sai com 0 em até 10 min, com a máquina ociosa (AC 7)
Proof: `npm run test:e2e:smoke`, cronometrado, com duração e resultado anotados em `## Handoff`

**C9** - ✅ `npx playwright test --list` lista ≥ 132 testes (AC 8)
Proof: `npx playwright test --list`, linha `Total: N tests in 9 files`, N ≥ 132

### S3 - provas que pegam as regressões citadas · 14 files · 250 KB · ~60k

**C10** - ✅ Na `sprint-cruzada` em `racing`, com o carro do jogador posto 15 m antes de `gates[0]` no heading do portão e W segurado, `race.player.lastGate` vira 0 em ≤ 5 s de simulação, sem chamar `crossNextGate` (AC 9)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "player crosses a gate by driving"`

**C11** - ✅ Parado no grid 1.5 s depois do GO no `circuito-centro`: `race.player.position` = 4 e `#race-pos` = `POS 4/4` (AC 10)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "hud shows time lap and position"`

**C12** - ✅ Depois da `sprint-cruzada` por `crossNextGate` sem oponente chegado: linha 1 do resultado = `VOCÊ`, linhas 2-4 com tempo `--:--.--` (AC 11)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "finishing a sprint shows the results"`

**C13** - ✅ `InputManager` num alvo falso: `keydown` com `repeat: true` não muda o estado nem chama o handler de `onPress` (AC 12)
Proof: `npx vitest run tests/unit/inputManager.test.ts -t "repeat keydown changes nothing"`

**C14** - ✅ `onFirstKey` roda 1 vez em 3 `keydown` de teclas distintas (AC 12)
Proof: `npx vitest run tests/unit/inputManager.test.ts -t "first key handler runs once"`

**C15** - ✅ `keyup` de W depois do `keydown` de W deixa `throttle` = false, e o handler de `onPress('KeyR')` roda 1 vez por pressão, 2 vezes em 2 pressões (AC 12)
Proof: `npx vitest run tests/unit/inputManager.test.ts -t "keyup clears and press handler runs per press"`

**C32** - ✅ `keydown` de `Space` sai com `defaultPrevented` = true, e `keydown` de `KeyW` com false (AC 12; acrescentado na rodada 2: o ramo `Space` estava na evidência do Test policy e fora do Coverage)
Proof: `npx vitest run tests/unit/inputManager.test.ts -t "space keydown prevents the default action and other keys do not"`

**C16** - ✅ `checkStuck` com 4.9 m de progresso: `false` em t = 3.99 s, `true` em t = 4.0 s (AC 13)
Proof: `npx vitest run tests/unit/aiDriver.test.ts -t "stuck detector thresholds and target"`

**C17** - ✅ No teste de física do oponente travado, o reset acontece a ≥ 3.9 s e ≤ 4.1 s do instante em que parou (AC 13)
Proof: `npx vitest run tests/physics/raceAi.test.ts -t "stuck opponent is reset to its last gate"`

**C18** - ✅ `yawAssistTorque(SPEC, 0.3, 10, 0, 2, INERTIA)` = 5000 ± 1e-6, como linha da tabela (AC 14)
Proof: `npx vitest run tests/unit/yawAssist.test.ts -t "yaw assist torque follows the target yaw rate"`

**C19** - ✅ `ChunkManager` com 2 chunks faltando e 2 `update` antes de `endFrame()`: `maxBuildsInOneFrame` = 2; com 1 `update` por `endFrame()`: 1 (AC 15)
Proof: `npx vitest run tests/unit/chunkManager.test.ts -t "max builds counts builds between frames"`
Proof: `npx playwright test tests/e2e/world.spec.ts -g "chunks stream around the car"`

**C20** - ✅ A trava de pureza acha `three` importado indiretamente: um módulo de fixture que importa um arquivo local que importa `three` é marcado; um que só faz `import type` de um arquivo que importa `three` não é (AC 16)
Proof: `npx vitest run tests/unit/purity.test.ts -t "transitive imports are followed"`
Proof: `npx vitest run tests/unit/purity.test.ts -t "pure modules do not import three or rapier"`

**C21** - ✅ `effect constants` prova comportamento: 1 passo derrapando soma exatamente 4 partículas de fumaça; uma partícula está viva a 0.79 s e morta a 0.81 s; impulso 3001 solta 40 faíscas e 2999 nenhuma. Nenhum `expect(CONST).toBe(literal)` sobra no teste (AC 17)
Proof: `npx vitest run tests/unit/effectsMath.test.ts -t "effect constants"`
Proof: `npx vitest run tests/unit/testHygiene.test.ts -t "no literal-only assertions left"` (rodada 2: nenhum `expect(CONSTANTE).toBe(...)` em `effectsMath.test.ts`)

**C22** - ✅ `cornerAssist.test.ts` não tem mais as asserções de aritmética com literais das linhas 19-20, e `drivetrain.test.ts` não tem a variável `t` que só era conferida `> 0` (AC 17)
Proof: `npx vitest run tests/unit/testHygiene.test.ts -t "no literal-only assertions left"`

**C23** - ✅ `tests/e2e` tem 0 chamadas a `waitForTimeout` e 0 `screenshot` com `path` fixo em `test-results/` (AC 18, AC 20)
Proof: `npx vitest run tests/unit/testHygiene.test.ts -t "e2e has no fixed clock waits nor fixed screenshot paths"`

**C24** - ✅ Com a contagem presa em `countdown` (hook DEV que congela a sessão), o teste da contagem falha com a mensagem `countdown não terminou em 4 s`; sem o hook, passa (AC 19)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "countdown holds every car"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "countdown deadline message"`

**C25** - ✅ Depois de `race.placeOpponent(i, …)` a 2 m depois de um portão que ele ainda não cruzou, 0.2 s de simulação não mudam o `lastGate` dele, e a posição anterior guardada (`race.opponents[i].prev`) é a posta, ±0.01 m (AC 21)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "placing an opponent does not cross gates"`

### S4 - sem código morto verde · 5 files · 40 KB · ~10k

**C26** - ✅ `src/` não tem `generateCity`, `streetsFor`, `lampsFor`, `laneMarksFor` nem `CITY_EXTENT`; `mulberry32`, `NEON_PALETTE`, `FACADE_TYPES` e `DEFAULT_SEED` continuam exportados de `src/world/CityGenerator.ts`, e o cabeçalho não fala mais em grade 8×8 nem em ±202 m (AC 22)
Proof: `npx vitest run tests/unit/testHygiene.test.ts -t "old city generator is gone"`
Proof: `npx vitest run tests/unit/cityGenerator.test.ts -t "mulberry32 is deterministic"`

**C27** - ✅ `npx tsc --noEmit -p . --noUnusedLocals --noUnusedParameters` sai com 0 e 0 erros (AC 23)
Proof: `npx tsc --noEmit -p . --noUnusedLocals --noUnusedParameters`

### S5 - CI no repositório · 1 file · 1 KB · ~1k

**C28** - ✅ `.github/workflows/ci.yml` dispara em `push` e `pull_request`, roda num job `ubuntu-latest` com Node 24 e tem, nesta ordem, os passos `npm ci`, `npm run build` e `npm test` (AC 24, door 1)
Proof: `npx vitest run tests/unit/testHygiene.test.ts -t "ci workflow runs build and unit tests"`
Proof (go-live, depois do push autorizado): `gh run list --workflow ci --limit 1` com `completed success`

### S6 - documento que bate com o código · 4 files · 40 KB · ~8k

**C29** - ✅ O README não contém `as corridas ainda não existem`; o item 2 do roadmap está marcado como concluído; "O que já existe" cita corridas e trem; a tabela de teclas tem `Enter` e `Esc`, e a linha do `R` cita o último portão (AC 25, AC 26)
Proof: `npx vitest run tests/unit/docs.test.ts -t "readme describes what exists"`

**C30** - ✅ AGENTS.md, a árvore do README e a AD nova citam `race` e `world/rail`; a AD-004 está `superseded by AD-018`; a AD-018 é `active` e fica depois da AD-017 (AC 27, door 3)
Proof: `npx vitest run tests/unit/docs.test.ts -t "layout is the same in agents readme and state"`

**C31** - ✅ No STATE.md: a linha da residuals tem `(concluída, verificada rodada 1)`; as linhas das ADs estão em ordem numérica crescente; "Resíduos conhecidos" não tem o bloco `races: pintura dos oponentes sai escura`. A doc de `Car.teleport` cita grid, reset de corrida (AD-015) e água. O README diz que uma mudança pequena sem door pode ter só `checks.md` com `## Intent` (AC 28, AC 29, AC 30)
Proof: `npx vitest run tests/unit/docs.test.ts -t "state and docs are current"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| diretórios do vitest com timeout (2) | tests/unit C1 · tests/physics C1 | - |
| scripts npm novos e mudados (3) | `test:quick` C3 · `test:e2e:smoke` C7, C8 · `test` C4 | - |
| modos do servidor do e2e (2) | porta ocupada sem `E2E_REUSE` C5 · com `E2E_REUSE=1` C6 | - |
| arquivos de spec com `@smoke` (9) | C7, table-driven sobre os 9 (`audio`, `drive`, `extras`, `hud`, `interiors`, `race`, `render`, `visual`, `world`) | - |
| exit codes dos comandos novos (2) | 0 C3, C6, C8 · ≠ 0 C5 | - |
| comportamentos do `InputManager` (5) | repeat C13 · primeira tecla C14 · keyup C15 · press por pressão C15 · `Space` sem ação padrão C32 | - |
| lados do limiar de travado (2) | 3.99 s C16 · 4.0 s C16, C17 | - |
| asserções só-de-constante a trocar (3 arquivos) | `effectsMath.test.ts` C21 · `cornerAssist.test.ts` C22 · `drivetrain.test.ts` C22 | - |
| esperas fixas a trocar (6) | `hud.spec.ts:45` C23 · `hud.spec.ts:93` C23 · `hud.spec.ts:101` C23 · `hud.spec.ts:128` C23 · `extras.spec.ts:36` C23 · `render.spec.ts:7` C23 | - |
| imports na trava de pureza (3) | direto C20 · relativo que chega a three C20 · `import type` ignorado C20 | - |
| símbolos mortos (5) | `generateCity` C26 · `streetsFor` C26 · `lampsFor` C26 · `laneMarksFor` C26 · `CITY_EXTENT` C26 | - |
| sobras do `tsc` (2) | `Minimap.canvas` C27 · `visual.spec.ts` `g` C27 | - |
| door 1 (CI), eventos e passos (5) | `push` C28 · `pull_request` C28 · `npm ci` C28 · `npm run build` C28 · `npm test` C28 | - |
| documentos (3) | README C29, C30, C31 · AGENTS.md C30 · STATE.md C30, C31 | - |
| metades do layout da AD-018 (2) | `src/{…,race}/` C30 · `world/{…,rail}/` C30 | - |

- Claims naming a command's exit code: C3, C5, C6, C8, C27 - cada um roda o comando de verdade
- C28 prova o arquivo; a execução no GitHub fica para o go-live (open question 1 do plan)
- Nenhum outro check afirma mais do que o caso que a própria prova exercita

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Configuração de teste (`vite.config.ts`, `playwright.config.ts`, `package.json`) | uma que roda a ferramenta real e lê o efeito (timeout do task, exit code, lista de testes) | um caso por modo (C1: 2 diretórios; C5/C6: 2 modos) |
| Decide, puro (`checkStuck`, `yawAssistTorque`, `InputManager`) | uma na própria camada, vitest | um caso por linha da tabela de decisão |
| Contador do `ChunkManager` | uma unitária com o `ChunkManager` real e a e2e que já existe | os dois ritmos: 1 e 2 `update` por quadro |
| Fiação da corrida (`RaceController` → HUD) | uma e2e, porque o `RaceController` monta DOM e cena | um caso por valor afirmado (POS, linha 1, linhas 2-4) |
| Texto de documento e regras de higiene | uma unitária que lê o arquivo | uma asserção por frase ou arquivo afirmado |

Evidence:
- `src/core/InputManager.ts`: 4 ramos (`Space`, primeira tecla, `repeat`, handler por código) mais o `keyup`, e nenhum teste. Decide.
- `src/race/RaceController.ts:175-176`: o único caminho real de progresso do jogador. O construtor recebe `hudRoot` (DOM), então o nível é o e2e, como os testes vizinhos em `race.spec.ts`.
- Precedente: `tests/unit/purity.test.ts` e `tests/unit/shaderConstants.test.ts` já provam regras de repositório lendo arquivos. O `docs.test.ts` e o `testHygiene.test.ts` seguem o mesmo padrão.

Cost: 5 arquivos de teste novos (`testConfig` ×2, `inputManager`, `chunkManager`, `testHygiene`, `docs`), 2 scripts em `tests/tooling`, 4 testes e2e novos ou mudados em `race.spec.ts`.

## Swept

- validation: C2 (limite de 3000 ms por teste), C9 (mínimo de 132 testes)
- failure modes: C5 (porta ocupada falha antes de rodar), C24 (a contagem presa falha com mensagem)
- idempotency: n/a - nenhum comando grava estado; rodar de novo dá o mesmo resultado
- authorization: n/a - sem conta nem permissão; o push do CI depende de ok do usuário (open question 1)
- concurrency: C5, C6 (duas suítes e um servidor na mesma porta), C2 (testes pesados sob carga, pelo teto que sobra no C1)
- data lifecycle: C23 (nenhum arquivo fixo gravado em `test-results/`)
- dependency failure: C28 (o CI falha o commit quando build ou teste falha)
- state transitions: C10 (portão `-1 → 0` dirigindo), C24 (`countdown → racing` com prazo), C25 (posição anterior do oponente)
- observability: C24 (mensagem de falha explícita), C8 (duração da suíte curta anotada)

## Handoff

- S1 = 15k (vite.config 0.3 KB, testes de física e unitários regenerando o mundo, ~55 KB). S2 soma 45k (playwright.config, 9 specs com tag, ~180 KB lidos de passagem) e chega a 60k. S3 soma 60k (race.spec 20 KB, InputManager, aiDriver, yawAssist, ChunkManager, purity, effectsMath, hud/extras/render spec) e chega a 120k. S4 soma 10k (130k), S5 1k, S6 8k: total ~139k, abaixo do budget de 150k. Um builder só
- Mechanism: one builder (cabe no budget, sem pergunta)
- **C8, medida:** `npm run test:e2e:smoke` em 2026-09-29: 18 passed (3.6m), exit 0, 2 testes `@smoke` por arquivo de spec
- **C9, medida:** `npx playwright test --list` → `Total: 132 tests in 9 files`
- **Settled mid-build:** o plano dizia 10 arquivos de spec no AC 7; são 9 (`helpers.ts` não é spec). O plano foi corrigido e C7 já dizia 9
- **Settled mid-build:** door 2a no plano. O vitest 5.0.2 tem tags nativas (`tags: ['slow']` e `--tags-filter=!slow`), que substituem a variável `SLOW`; no Windows o `cmd` do `npm run` não aceita `SLOW=0 comando`
- **Settled mid-build:** os testes de determinismo precisam gerar o mundo duas vezes. A segunda geração foi para o `beforeAll` do arquivo (interiors, raceRoutes, roads), e o teste só compara. O teste dos carros estacionados juntava um `expect` por par carro×objeto e levava 3.0 s; virou uma lista de violações com um `expect(bad).toEqual([])`, com a mesma exigência
- **Settled mid-build:** C21 prova os números pelo `Effects` real em node, com um canvas falso por `vi.stubGlobal('document', …)` só para a textura da partícula. A linha nova da yaw-assist (C18) foi para o fim da tabela, porque o teste lê `rows[7]` e `rows[8]` por índice
- **Settled mid-build:** a regra do C22 é genérica (todo `expect(` só de literais em `tests/unit` e `tests/physics`) e pegou também 2 linhas de `yawAssist.test.ts` com o mesmo defeito, removidas
- **Settled mid-build:** C24 usa um campo DEV `RaceController.holdCountdown` (hook `__game.race.holdCountdown`) para segurar a contagem; C25 expõe `Opponent.prev` e o método `Opponent.placeAt`, que o hook `placeOpponent` passou a usar
- **Abandoned:** o primeiro log das e2e foi para `test-results/`, que o Playwright apaga ao iniciar; os logs de execução ficam fora do repositório
