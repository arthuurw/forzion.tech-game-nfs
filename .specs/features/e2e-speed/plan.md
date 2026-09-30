# e2e-speed

## Problem

A suíte e2e (`npm run test:e2e`, 166 testes) leva cerca de 60 min numa máquina ociosa (auditoria de
2026-09-29: `132 passed (1.0h)`; em 2026-09-30, 85 testes em ~35 min). Quem paga é quem valida uma
feature: o gate completo só roda no fim, o terminal em segundo plano do agente mata a suíte antes
de ela acabar (2026-09-30, parada no teste 85 de 166) e a falta de memória derrubou duas rodadas
na mesma noite. Enquanto isso, uma quebra real ficou em `main` sem ninguém ver: as provas no
browser da races C29 e C30 falharam com 16.27 m depois do merge da `play-fixes`, e só uma rodada
completa as pegaria.

Medido em 2026-09-30 com o jogo sozinho no SwiftShader do Playwright (640 × 360): boot de 3-5 s,
render a 6-7 quadros/s e física a 0.22-0.28 do tempo real. Cada segundo de simulação que um teste
espera custa ~4 s de relógio, porque a física só anda dentro do quadro e o quadro é caro. Rodar
3 workers em paralelo deu só ~1.4× (a CPU já está ocupada pelo SwiftShader) e 7 falhas de prazo
de relógio.

Quando isto sair: a suíte completa roda em até 25 min e o gate completo volta a caber numa
feature.

## Flow

Reusa o `fixedUpdate` do `Game` e o tratamento de erro do `GameLoop` como estão; o avanço rápido é
só outra forma de chamar os mesmos passos de 1/60 s, sem render entre eles.

1. teste -> `tests/e2e/helpers.ts` (exists) - `advanceSim`, `holdKeySim`, `waitSimUntil` pedem N
   segundos de simulação; por padrão pelo avanço rápido, com `{ realtime: true }` pelo laço de
   quadros como hoje
2. `__game.stepSim(seconds)` no hook DEV de `src/core/Game.ts` (exists; door 1) - converte em N
   passos e chama o `GameLoop`
3. `GameLoop.runSteps(n)` em `src/core/GameLoop.ts` (exists; door 1) - roda `fixedUpdate(1/60)`
   n vezes dentro do mesmo try/catch do quadro: um throw para o laço e vai para `onError`
4. out: `simTime` avançou n/60 s; o helper espera 1 quadro renderizado para HUD, minimapa, malhas
   e câmera lerem o último passo
5. `playwright.config.ts` (exists) - `workers` lido de `E2E_WORKERS`, padrão 2

## Impact

| Front | What changes |
| --- | --- |
| domain | termo novo: avanço rápido - `stepSim(s)`, passos fixos seguidos sem quadro entre eles, só no hook DEV |
| domain | termo existente: `advanceSim(page, s)` significava "esperar o laço de quadros andar s"; passa a "rodar s de passos agora e esperar 1 quadro". Quem depende do quadro no meio (câmera suavizada, efeitos por quadro, amostragem por quadro da contagem) passa `{ realtime: true }` |
| decisão | AD-006 (máximo 5 passos por quadro) segue valendo no jogo; a AD nova vale só para o hook DEV |
| testes | `tests/unit/gameLoop.test.ts` ganha `runSteps`; todas as specs em `tests/e2e/` passam pelos helpers novos; `sampleCountdown` e `waitFrames` continuam por quadro |
| docs | `AGENTS.md` (tempos da suíte e `E2E_WORKERS`), `README.md` se citar o tempo |
| stored data | nada a migrar |

## Relations

`None - no stored-data shape change`

## Surface

`None - nothing consumed outside` (o hook `__game` só existe em `import.meta.env.DEV` e só os
testes do próprio repositório o leem)

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Avanço rápido para testes (padrão que as próximas features vão copiar; AD-019) | `GameLoop.runSteps(n: number): void` roda `fixedUpdate(this.stepper.step)` n vezes no mesmo try/catch do quadro; `__game.stepSim(seconds)` chama `runSteps(Math.round(seconds * 60))` e devolve `simTime`; nos helpers, `advanceSim(page, s, { realtime?: boolean })` | escala de tempo no laço (`?simScale=k`, k vezes mais passos por quadro): continua preso ao quadro de ~150 ms, ganha no máximo ~2×; mover as provas para `tests/physics`: não prova a integração no browser e custa reescrever teste por teste |
| 2. Paralelismo por variável | `workers: Number(process.env.E2E_WORKERS ?? 2)` em `playwright.config.ts` | 3 workers fixos: medido ~1.4× com 2.8 GB livres no pior ponto, e sem margem para outra suíte num worktree |

- Nothing else in this change is hard to reverse

## Criteria

### S1: avanço rápido no jogo (P1)

Um teste manda o jogo andar s segundos de simulação e o jogo anda na hora, com os mesmos passos.

**Acceptance Criteria**

1. WHEN `GameLoop.runSteps(n)` é chamado THEN o `GameLoop` SHALL chamar `fixedUpdate` exatamente n vezes, cada uma com dt = 1/60, sem chamar `render`
2. IF `fixedUpdate` lança dentro de `runSteps` THEN o `GameLoop` SHALL parar (`running` = false), chamar `onError` uma vez com o erro e não rodar os passos restantes
3. WHEN um teste chama `__game.stepSim(s)` THEN o jogo SHALL devolver um `simTime` exatamente `Math.round(s * 60) / 60` maior que o de antes da chamada, medido na mesma chamada
4. WHILE uma tecla está pressionada (`page.keyboard.down`) os passos de `stepSim` SHALL ler essa tecla: com `KeyW` segurada, `stepSim(2)` a partir do spawn parado deixa o carro a mais de 10 km/h
5. WHEN o laço de quadros roda depois de um `stepSim` THEN o próximo quadro SHALL mostrar o estado do último passo: o `#speed` do HUD igual a `round(|speedKmh|)` ± 1

**Independent test:** no browser, `__game.stepSim(1)` devolve `simTime` + 1 e o carro com W segurado anda.

### S2: helpers pelo avanço rápido (P1)

As esperas de simulação dos testes deixam de depender do quadro, com saída explícita para quem precisa dele.

**Acceptance Criteria**

6. WHEN `advanceSim(page, s)` roda sem opção THEN o helper SHALL avançar a simulação pelo `stepSim` e esperar pelo menos 1 quadro renderizado antes de voltar
7. WHERE a chamada passa `{ realtime: true }` o helper SHALL esperar o laço de quadros avançar s de simulação, como antes desta feature
8. WHEN `waitSimUntil(page, predicate, s)` roda sem opção THEN o helper SHALL avançar um passo por vez pelo `stepSim` e parar no primeiro passo em que o predicado vale, ou em s de simulação; devolve se valeu
9. The e2e suite SHALL manter em `{ realtime: true }` ou em espera por quadro toda prova que mede algo atualizado só no `render` ao longo do tempo (suavização da câmera, efeitos visíveis, amostragem por quadro)

**Independent test:** `hud.spec.ts` "speed label matches car state" passa com o helper novo.

### S3: suíte mais curta (P1)

**Acceptance Criteria**

10. The `playwright.config.ts` SHALL ler `workers` de `E2E_WORKERS`, com padrão 2
11. WHEN `npm run test:e2e` roda numa máquina ociosa THEN a suíte SHALL terminar com todos os testes passando em até 25 min
12. WHEN `npm run test:e2e:smoke` roda numa máquina ociosa THEN a suíte SHALL terminar com todos os testes passando em até 3 min
13. The `AGENTS.md` SHALL dar os tempos medidos da suíte completa e do smoke e citar `E2E_WORKERS`

**Independent test:** `npm run test:e2e` com o relógio ao lado.

## Out of scope

| Excluded | Why |
| --- | --- |
| e2e no CI | a test-hardening deixou fora por custo e por medir pixels da GPU virtual; continua manual e no Verifier |
| trocar SwiftShader por GPU real | depende da máquina; os limiares de pixel foram medidos no SwiftShader |
| reaproveitar a página entre testes | vaza estado de um teste para o outro; o boot custa só 3-5 s |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Fazer o avanço rápido e depois paralelizar | as duas coisas nesta feature | o usuário aprovou o plano de 2026-09-30 ("siga") | y |
| Meta de tempo | 25 min completo, 3 min smoke | estimativa de 60 → 15-20 min dada ao usuário, com folga para a máquina | n |
| Qual prova fica em tempo real | decidida teste a teste no build, pelo critério do AC 9 | é posição de código, reversível, e o AC 9 dá a regra | y - user delegated |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| command `npm run test:e2e` | output e verbosidade | existing - reporter padrão do Playwright |
| command `npm run test:e2e` | flags e padrões | AC 10 (`E2E_WORKERS`, padrão 2); `E2E_PORT` e `E2E_REUSE` existing |
| command `npm run test:e2e` | exit codes | existing - Playwright sai com 1 em qualquer falha |
| command `npm run test:e2e` | falha no meio | existing - o Playwright lista as falhas no fim; o vite não cai mais com arquivo travado na raiz (commit 28a6976) |
| document `AGENTS.md` | o que o leitor faz depois | AC 13 |
| hook DEV `__game.stepSim` | erro no passo | AC 2 |

## Sources

- Pedido do usuário em 2026-09-30: "1h e muito tempo"; plano aprovado com "siga"
- `.specs/audits/2026-09-29-validation.md` - item gates-1 (suíte de 60 min, sugestões de workers e de mover provas)
