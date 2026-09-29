# test-hardening

## Problem

A validação completa de 2026-09-29 (`.specs/audits/2026-09-29-validation.md`) achou as suítes verdes, mas pouco confiáveis como gate. Quem paga é cada rodada de Verifier e cada feature dos sub-projetos 3-5:

- `npm test` falha sem regressão quando a máquina está ocupada. Com ~20 processos node/chrome rodando, deu "4 failed | 198 passed (202)" por timeout de 5000 ms em testes que regeneram terreno e estradas dentro do corpo (docs-1). O AGENTS.md incentiva suítes em paralelo em worktrees, então esse é o cenário normal.
- `npm run test:e2e` num worktree sem `E2E_PORT` reaproveita o dev server do checkout principal na 5173 (`reuseExistingServer: true`, `playwright.config.ts:22`). A suíte testa o código errado e sai verde (tests-2).
- O e2e leva 60 min com 1 worker e um único teste de física leva ~145 s. Não há suíte rápida para rodar a cada mudança (gates-1, tests-15).
- Buracos de prova que deixam uma regressão real passar verde:
  - nenhum teste cruza um portão dirigindo. Apagar `RaceController.ts:175` mantém tudo verde (tests-1);
  - POS e a ordem do resultado são checados só por faixa (tests-3);
  - o `InputManager` não tem teste (tests-14);
  - o detector de travado não tem limite inferior (tests-12);
  - o caso de 2 rodas da yaw-assist só confere `!= 0` (tests-13);
  - `maxBuildsInOneFrame` mede o plano, não os builds (tests-9);
  - a trava de pureza só olha imports diretos (tests-8);
  - há asserções que só repetem constantes (tests-6).
- Esperas fixas de relógio no e2e (tests-10), loop sem prazo no teste da contagem (tests-11) e screenshot gravado sem asserção (tests-5).
- Código morto verde: `generateCity` e o teste dele (wgen-8, tests-7), o campo `canvas` do `Minimap` (gates-3) e o helper `g` em `visual.spec.ts` (gates-4). O hook DEV `placeOpponent` pula `Opponent.place` (veh-11).
- Nenhuma suíte roda sozinha no repositório público (tests-16).
- Documento desatualizado:
  - o README diz que as corridas não existem e não lista Enter/Esc (docs-2, docs-3);
  - a AD-004, o AGENTS.md e o README descrevem um layout sem `race` e sem `world/rail` (docs-4);
  - no STATE.md, a residuals não está marcada como concluída, a AD-017 vem antes da AD-016 e a lista de resíduos traz itens já resolvidos (docs-5, docs-6, docs-7);
  - a doc do `Car.teleport` diz "só para testes" (docs-12);
  - o README diz que toda feature tem `plan.md` (docs-14).

Quando isto sair: `npm test` não falha por carga, o e2e nunca testa outro checkout, existe uma suíte curta de minutos, as provas que faltavam pegam as regressões citadas e o documento bate com o código.

## Flow

Reusa os helpers de tempo simulado de `tests/e2e/helpers.ts` (`advanceSim`, `simTime`) no lugar dos sleeps, e o harness de física de `tests/physics/harness.ts` para a prova do portão.

1. `vite.config.ts` (exists): `testTimeout` do vitest.
2. `playwright.config.ts` (exists): reuso do servidor só com `E2E_REUSE`, e a tag `@smoke` (door 2).
3. `package.json` (exists): scripts `test:quick` e `test:e2e:smoke` (door 2).
4. `tests/unit/*`, `tests/physics/*`, `tests/e2e/*` (exists): provas novas e asserções trocadas. `tests/unit/cityGenerator.test.ts` perde os casos de `generateCity`.
5. `src/core/InputManager.ts`, `src/world/ChunkManager.ts`, `src/hud/Minimap.ts`, `src/world/CityGenerator.ts`, `src/core/Game.ts` (hook `placeOpponent`), `src/vehicle/Car.ts` (doc do `teleport`) (exists): só o necessário para as provas e o código morto. Nenhuma mudança de comportamento em jogo.
6. `.github/workflows/ci.yml` (door 1): build e unitários a cada push.
7. `README.md`, `AGENTS.md`, `.specs/STATE.md` (exists): texto corrigido e a AD de layout (door 3).

## Impact

| Front | What changes |
| --- | --- |
| testes existentes | `cityGenerator.test.ts` perde os casos de `generateCity`, `streetsFor`, `lampsFor` e `laneMarksFor`, porque o código morre junto. Sobra o teste de determinismo do `mulberry32` |
| testes existentes | as asserções de constante de `effectsMath.test.ts:65-76`, `cornerAssist.test.ts:19-20` e `drivetrain.test.ts:324,329` são trocadas por propriedades. A contagem de testes pode cair; a de comportamentos provados não cai |
| termo | `maxBuildsInOneFrame` media o tamanho do plano. Passa a medir builds feitos entre dois renders. Quem lê: `tests/e2e/world.spec.ts:361` (city-terrain) |
| checks de outras features | os testes de POS e de resultado em `race.spec.ts:176-201` (races) ganham asserções mais fortes: POS exato e VOCÊ em 1º. Nenhum check aprovado é afrouxado |
| processo | agentes passam a ter `npm run test:quick` e `npm run test:e2e:smoke` para iteração. O Verifier continua rodando `npm test` e `npm run test:e2e` completos |
| decisões | a AD-004 vira `superseded` pela AD de layout nova |
| stored data | nada para migrar |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside. Os comandos novos (`npm run test:quick`, `npm run test:e2e:smoke`, `E2E_REUSE`) e o workflow de CI são convenção do repositório: a forma deles é a door 2 e a door 1, e os exit codes são os AC 3, 5, 7 e 24.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. CI no GitHub Actions (dependência externa nova, repositório público) | `.github/workflows/ci.yml`: `on: [push, pull_request]`, um job `ubuntu-latest`, Node 24, passos `npm ci`, `npm run build`, `npm test` | e2e no CI: 60 min de SwiftShader por push, e o teste mede pixels que dependem da GPU virtual. Fica manual/Verifier |
| 2. Convenção de suíte curta, que as features seguintes copiam | tag Playwright `{ tag: '@smoke' }` em pelo menos um teste por arquivo de spec; `"test:e2e:smoke": "playwright test --grep @smoke"`; `"test:quick"` roda o vitest sem os testes marcados como lentos, pela variável `SLOW` desligada. `npm test` continua rodando tudo | vários workers no e2e: as sondas de pixel e de tempo simulado disputam CPU no SwiftShader, e o `workers: 1` foi escolhido por isso. Tirar o teste lento de `npm test` também foi rejeitado, porque esconde a prova do gate completo |
| 3. AD de layout que substitui a AD-004 | `src/{core,world,vehicle,camera,hud,audio,post,race}/` com `world/{terrain,roads,lots,interiors,rail}/`. Pasta nova de topo só com AD | editar a AD-004 no lugar: a tabela é log, e a regra é acrescentar e substituir |

| 2a. (achado nos checks) mecanismo do teste lento | o vitest 5.0.2 tem tags nativas: `test.tags: [{ name: 'slow' }]` no `vite.config.ts`, `it(nome, { tags: ['slow'] }, fn)` no teste e `"test:quick": "vitest run --tags-filter=!slow"`. Isso substitui a variável `SLOW` da door 2; o resto da door 2 fica como aprovado | variável de ambiente `SLOW`: no Windows o `npm run` passa pelo `cmd`, que não aceita `SLOW=0 comando`, e o `it.skipIf` por variável é o mecanismo de skip que a regra de teste proíbe como atalho |

- Nothing else in this change is hard to reverse

## Criteria

### S1: suíte unitária estável sob carga (P1)

Rodar `npm test` numa máquina ocupada não falha sem regressão.

**Acceptance Criteria**

1. The system SHALL definir `testTimeout` de 30000 ms para todos os testes de `tests/unit` e `tests/physics`, exceto os que já declaram um timeout próprio maior.
2. WHEN `npx vitest run tests/unit` roda com a máquina ociosa THEN nenhum teste individual SHALL levar mais que 3000 ms. Terreno e estradas são gerados no máximo uma vez por arquivo.
3. WHEN `npm run test:quick` roda THEN the system SHALL rodar `tests/unit` e `tests/physics` sem os testes marcados como lentos (hoje só "each opponent finishes every race in time", `raceAi.test.ts`) e sair com 0 se tudo passar.
4. WHEN `npm test` roda THEN the system SHALL continuar rodando todos os testes, inclusive os marcados como lentos.

**Independent test:** `npm run test:quick` e `npx vitest run tests/unit --reporter=json` para ler as durações.

### S2: e2e no checkout certo e com suíte curta (P1)

**Acceptance Criteria**

5. IF já existe um servidor respondendo na porta do e2e e `E2E_REUSE` não está setado THEN `npm run test:e2e` SHALL falhar antes de rodar qualquer teste, sem reaproveitar o servidor.
6. WHERE `E2E_REUSE=1` está setado the system SHALL reaproveitar o servidor da porta, como hoje.
7. The system SHALL marcar com `@smoke` pelo menos um teste em cada um dos 9 arquivos de spec de `tests/e2e` (o plano dizia 10 por erro de contagem; `helpers.ts` não é spec), e WHEN `npm run test:e2e:smoke` roda com a máquina ociosa THEN SHALL terminar em até 10 min.
8. WHEN `npm run test:e2e` roda THEN the system SHALL rodar todos os testes, no mínimo os 132 de hoje.

**Independent test:** subir `npx vite --port 5199` e rodar `E2E_PORT=5199 npm run test:e2e -- --list`; depois `npm run test:e2e:smoke`.

### S3: provas que pegam as regressões citadas (P1)

**Acceptance Criteria**

9. WHEN o carro do jogador é posto 15 m antes de `gates[0]` da `sprint-cruzada`, alinhado ao heading do portão, com a corrida em `racing`, e segura o acelerador THEN the system SHALL marcar `lastGate === 0` do jogador em até 5 s de simulação, sem `crossNextGate`.
10. WHILE o jogador está parado no grid 1.5 s depois do GO, com os 3 oponentes andando, the system SHALL mostrar exatamente `POS 4/4`.
11. WHEN o jogador termina a `sprint-cruzada` por `crossNextGate` antes de qualquer oponente THEN a linha 1 do resultado SHALL ser `VOCÊ`, e as outras 3 SHALL ter o tempo `--:--.--`.
12. The system SHALL provar o `InputManager` num alvo de eventos falso: um `keydown` com `repeat: true` não muda o estado nem chama handler; `onFirstKey` roda exatamente uma vez em 3 `keydown` distintos; `keyup` limpa a tecla; o handler de `onPress` roda uma vez por pressão sem repeat.
13. WHEN `checkStuck` recebe progresso menor que 5 m THEN SHALL devolver `false` em t = 3.99 s e `true` em t = 4.0 s. A prova de física SHALL cobrar também que o reset do oponente travado acontece a ≥ 3.9 s do instante em que parou.
14. The system SHALL provar `yawAssistTorque(SPEC, 0.3, 10, 0, 2, INERTIA)` = 5000 exatamente, como uma linha da tabela.
15. The system SHALL medir `maxBuildsInOneFrame` como o maior número de builds de chunk feitos entre dois renders. WHEN `update` é chamado 2 vezes no mesmo frame com 2 chunks faltando THEN o valor SHALL ser 2.
16. The system SHALL falhar a trava de pureza quando um módulo da lista importa, direta ou indiretamente por imports relativos que não são `import type`, `three` ou `@dimforge/rapier3d-compat`.
17. The system SHALL trocar as asserções que só comparam constante com literal (`effectsMath.test.ts:65-76`, `cornerAssist.test.ts:19-20`, `drivetrain.test.ts:324,329`) por uma propriedade do comportamento cada, ou removê-las quando outro caso do arquivo já prova a mesma propriedade.
18. The system SHALL ter zero chamadas a `waitForTimeout` em `tests/e2e`. As esperas SHALL ser por tempo simulado, por quadros (`__game.frames`) ou por um estado do DOM.
19. IF a contagem da corrida não sai de `countdown` em 4 s de simulação depois do início THEN o teste da contagem SHALL falhar com a mensagem `countdown não terminou em 4 s`.
20. The system SHALL não gravar arquivo fixo em `test-results/` fora do diretório de saída do próprio teste.
21. WHEN o hook DEV `race.placeOpponent(i, x, y, z, h)` roda THEN the system SHALL atualizar a posição anterior e o estado da IA do oponente como `Opponent.place`, de modo que o `track()` seguinte não registre cruzamento de portão entre a posição antiga e a nova.

**Independent test:** apagar a linha 175 de `RaceController.ts` num branch descartável e ver a prova do AC 9 ficar vermelha.

### S4: sem código morto verde (P2)

**Acceptance Criteria**

22. The system SHALL não ter `generateCity`, `streetsFor`, `lampsFor`, `laneMarksFor` nem `CITY_EXTENT` em `src/`. `mulberry32`, `NEON_PALETTE`, `FACADE_TYPES` e `DEFAULT_SEED` SHALL continuar exportados, com o cabeçalho do módulo descrevendo o que ele é hoje.
23. WHEN `npx tsc --noEmit -p . --noUnusedLocals --noUnusedParameters` roda THEN the system SHALL reportar 0 erros.

**Independent test:** o comando do AC 23 e `grep -rn generateCity src tests`.

### S5: CI no repositório (P3)

**Acceptance Criteria**

24. WHEN um push ou pull request chega ao GitHub THEN the system SHALL rodar `npm ci`, `npm run build` e `npm test` em Node 24 e marcar o commit com o resultado.

**Independent test:** depois do push autorizado pelo usuário, o job `ci` aparece verde em `gh run list`.

### S6: documento que bate com o código (P2)

**Acceptance Criteria**

25. The system SHALL ter, no README, as corridas e os extras da block-life-extras em "O que já existe", o item 2 do roadmap como concluído, e nenhuma frase dizendo que as corridas não existem.
26. The system SHALL ter, na tabela de teclas do README, `Enter` (entrar na corrida perto do marcador), `Esc` (sair da corrida) e, na linha de `R`, o comportamento na corrida (volta ao último portão).
27. The system SHALL descrever o mesmo layout no AGENTS.md, na árvore do README e numa AD nova que marca a AD-004 como `superseded`, com `race` e `world/rail`.
28. The system SHALL ter, no STATE.md, a residuals marcada `(concluída, verificada rodada 1)`, as ADs em ordem numérica, e a lista "Resíduos conhecidos" só com itens abertos.
29. The system SHALL documentar em `Car.teleport` que ele é usado no grid, no reset de corrida (AD-015) e no reset por água, além de testes.
30. The system SHALL dizer no README que uma mudança pequena, sem door, pode ter só `checks.md` com `## Intent`, como a engine-sound e a facade-glint.

**Independent test:** leitura do diff de `README.md`, `AGENTS.md` e `.specs/STATE.md`.

## Out of scope

| Excluded | Why |
| --- | --- |
| trocar os literais de `DEFAULT_CAR` em `carSpec.test.ts` por invariantes (tests-4) | são checks aprovados de propósito (car-handling C28, car-feel C13) que congelam a ficha padrão. O tuning vai criar fichas derivadas sem mudar a padrão. Reavaliar no plano do sub-projeto 4 |
| juntar lições equivalentes em `.specs/lessons.json` (docs-13) | o arquivo pertence ao `lessons.py` do skill, não ao projeto. É limite do processo, não do repo |
| e2e com mais de 1 worker ou com sharding | as sondas de pixel e de tempo simulado disputam CPU no SwiftShader. A suíte curta resolve a iteração sem mexer nisso |
| e2e no CI | ver door 1 |
| teste do `GameLoop` | entra na play-fixes, junto com a mudança do loop (CORE-7) |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| incluir CI | sim, só build e unitários | o repositório é público e não tem gate automático. Precisa de `git push` com ok do usuário para rodar a primeira vez | n |
| versão do Node no CI | 24, a mesma do ambiente local (`node v24.18.0`) | evita diferença de runtime entre local e CI | n |
| orçamento da suíte curta | ≤ 10 min, com 1 teste `@smoke` ou mais por arquivo | cabe numa iteração e cobre cada área; o Verifier roda a completa | n |
| limite de 3000 ms por teste unitário | 10× abaixo do timeout novo | deixa a folga do AC 1 para a carga, e o AC 2 pega quem volta a regenerar o mundo no corpo do teste | n |

**Open questions:**

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | blocks go-live | `git push` do workflow de CI (remoto público, AGENTS.md exige ok explícito) | o AC 24 fica provado só pelo arquivo, sem execução real |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| comando `npm run test:quick` | formato e verbosidade da saída | existing - saída padrão do vitest |
| comando `npm run test:quick` | flags e padrões | n/a - sem flags; exclui a tag `slow` (door 2a) |
| comando `npm run test:quick` | exit codes | AC 3 |
| comando `npm run test:quick` | falha no meio | existing - o vitest reporta cada falha e sai 1 |
| comando `npm run test:e2e:smoke` | formato, verbosidade e falha no meio | existing - reporter padrão do Playwright |
| comando `npm run test:e2e:smoke` | flags e padrões | AC 7: `E2E_PORT` opcional, padrão 5173 |
| comando `npm run test:e2e:smoke` | exit codes | AC 7 |
| comando `npm run test:e2e` | flags e padrões | AC 5, AC 6: `E2E_REUSE` desligado por padrão |
| comando `npm run test:e2e` | exit codes e falha no meio | AC 5 |
| tarefa `ci` no GitHub | saída, flags, exit codes e falha no meio | AC 24; flags n/a - disparado por push |
| documento README | estrutura e profundidade | AC 25, AC 26, AC 30 |
| documento README | tom | existing - pt-BR direto, como hoje |
| documento README | o que o leitor faz a seguir | AC 26: jogar e achar as corridas |
| documento AGENTS.md e STATE.md | o que o leitor faz a seguir | AC 27, AC 28: criar pasta no lugar certo e retomar pelo roadmap certo |

## Sources

- `.specs/audits/2026-09-29-validation.md` - achados docs-1..14, tests-1..16, gates-1..4, wgen-8, veh-11, com evidência e veredito
- `AGENTS.md` "Worktrees de agentes" - suítes em paralelo são o uso normal
