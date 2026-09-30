# play-fixes checks

Profile: standard
Plan: `.specs/features/play-fixes/plan.md`

34 checks in 9 slices · 0 one-way doors · 0 open, of which 0 block

## Checks

### S1 - teclas soltas quando a janela perde o foco · 3 files · 25 KB · ~6k

**C1** - Com W, S, A, D e Espaço segurados, um `blur` no alvo do `InputManager` deixa `throttle`, `brake`, `left`, `right` e `handbrake` = false (AC 1)
Proof: `npx vitest run tests/unit/inputManager.test.ts -t "blur releases every held key"`

**C2** - Com as mesmas 5 teclas seguradas, um `visibilitychange` com `document.visibilityState = 'hidden'` deixa os 5 campos = false; com `'visible'` não muda nada (AC 2)
Proof: `npx vitest run tests/unit/inputManager.test.ts -t "hidden page releases every held key"`

**C3** - No browser, com W segurado e 1 s de simulação, um `blur` na janela faz `__game.car.speedKmh` não subir mais que 0.5 km/h entre 0.5 s e 1.5 s de simulação depois do `blur` (AC 1)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "window blur releases the throttle"`

### S2 - áudio acompanha a aba e o jogador · 5 files · 70 KB · ~18k

**C4** - Com o áudio `running`, forçar `document.visibilityState = 'hidden'` e disparar `visibilitychange` leva `__game.audio.contextState` a `suspended`; voltar para `'visible'` leva de novo a `running` (AC 3)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "hidden tab suspends the audio"`

**C5** - Com o contexto suspenso por `__game.audio` (hook DEV `suspend`), um `keydown` (Shift) leva `contextState` a `running`; suspenso de novo, um `pointerdown` no canvas também (AC 4)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "key or pointer resumes a suspended context"`

**C6** - O `InputManager` chama o handler de gesto em todo `keydown` (inclusive repetido) e todo `pointerdown`, e o handler da primeira tecla roda depois de a tecla estar aplicada (`state.throttle` já true dentro dele para W) (AC 4, AC 5)
Proof: `npx vitest run tests/unit/inputManager.test.ts -t "gesture handler on every keydown and pointerdown"`
Proof: `npx vitest run tests/unit/inputManager.test.ts -t "first key handler runs after the key is applied"`

**C7** - `__game.audio.state` é `idle` antes de qualquer tecla (sem contexto; free-roam-city C35 segue) e, depois de criado, é igual a `__game.audio.contextState` em `running` e em `suspended` (AC 4)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "audio state mirrors the context"`
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "first keypress starts audio"`

**C8** - Com `window.AudioContext` trocado por um construtor que lança (init script), apertar W: o carro passa de 5 km/h em 1 s de simulação, o console tem um `warn` que começa com `Áudio indisponível` e nenhum erro de página (AC 5)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "game runs silent when audio fails"`

**C9** - Na contagem da corrida, com W segurado por 1 s de simulação, `__game.audio.gains.engineTarget` = `engineGainFor(false)` (0.048) e o valor real `params.engineGain` < 0.06 (AC 6)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "countdown keeps the engine sound at idle"`

### S3 - erro visível e carregamento honesto · 5 files · 20 KB · ~5k

**C10** - `GameLoop`: um throw em `fixedUpdate` e, noutro loop, um throw em `render` param o loop (`running` = false, nenhum `requestAnimationFrame` novo) e chamam o handler de erro uma vez com o erro lançado (AC 7)
Proof: `npx vitest run tests/unit/gameLoop.test.ts -t "a throw in the frame stops the loop and reports it"`

**C11** - No browser, o hook DEV que lança `boom` no próximo `fixedUpdate` deixa `#error` visível com o texto exato `Erro no jogo: boom` e `__game.simTime` parado por 0.5 s de relógio (AC 7)
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "a frame error shows the error overlay"`

**C12** - Na carga, um callback de `requestAnimationFrame` roda com `#loading-text` = `Gerando cidade...` enquanto `window.__game` ainda não existe (init script que registra rAF e texto) (AC 8)
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "loading paints city generation before building the world"`

### S4 - oponentes param direito e o reset não empilha carros · 9 files · 80 KB · ~20k

**C13** - `stopInput(ai, speedKmh)` devolve: acima de 5 km/h para a frente, `{ throttle: false, brake: true, steer: ai.steer, handbrake: false }`; com |v| < 5, `HOLD_INPUT`; abaixo de −5 km/h (para trás), `{ throttle: true, brake: false, steer: ai.steer, handbrake: false }`. Uma linha por caso, mais 4.99, 5.01, −4.99 e −5.01 (AC 9)
Proof: `npx vitest run tests/unit/raceSession.test.ts -t "stop input after the finish"`

**C14** - Com o `Car` real, em cada uma das 4 corridas, cada oponente que termina fica com |velocidade| < 5 km/h em até 8 s de simulação depois da chegada, e em nenhum passo desse intervalo o centro do chassi passa de `largura da estrada / 2` do traçado (AC 9, AC 10)
Proof: `npx vitest run tests/physics/raceAi.test.ts -t "finished opponents stop on the road in every race"`

**C15** - Com o `Car` real, um oponente a ≥ 60 km/h no meio da corrida, dirigido no modo de parada (o que a sessão `finished` pede), recebe a cada passo `stopInput` (nunca `HOLD_INPUT` enquanto passa de 5 km/h), fica abaixo de 5 km/h em até 8 s e dentro de `largura / 2` do traçado (AC 11)
Proof: `npx vitest run tests/physics/raceAi.test.ts -t "opponents still racing stop when the player finishes"`

**C16** - No browser, depois que o jogador chega (hook DEV de chegada), um oponente ainda correndo a mais de 5 km/h tem `lastInput.handbrake` = false e `lastInput.brake` = true (AC 11)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "unfinished opponents brake after the player finishes"`

**C17** - `resetTarget(race, gate, slot)` para os 4 slots, em todos os portões das 4 corridas: 4 alvos diferentes, as 4 caixas de chassi (meia medida 0.9 × 2.1 m, orientadas pelo heading) sem sobreposição, e cada alvo a ≤ `largura / 2 − 1 m` do traçado. Sem portão cruzado, segue o lugar do grid (AC 12)
Proof: `npx vitest run tests/unit/raceSession.test.ts -t "gate reset spreads the four slots like the grid"`
Proof: `npx vitest run tests/unit/raceSession.test.ts -t "reset target is last gate or grid slot"`

**C18** - Dois corredores que cruzam o último portão da última volta no mesmo passo: fica na frente o de menor fração de cruzamento no passo, nas duas ordens de chamada; os dois `finishTime` são o tempo do passo (AC 13)
Proof: `npx vitest run tests/unit/raceProgress.test.ts -t "tie on the same step goes to the earlier crossing"`

### S5 - o carro volta inteiro de um reset · 3 files · 45 KB · ~11k

**C19** - Com o `Car` real em 4ª ou mais, esterçando e derrapando: depois de `teleport` e, noutro carro, depois de `reset`, `gear` = 1, volante das rodas da frente = 0, `lateralG` = 0 e `skidding` = false (AC 14)
Proof: `npx vitest run tests/physics/reset.test.ts -t "teleport and reset return the drivetrain to rest"`

**C20** - Um carro em 5ª a 150 km/h, teleportado parado, vai de 0 a 60 km/h no tempo de um carro novo ± 0.05 s (AC 15)
Proof: `npx vitest run tests/physics/reset.test.ts -t "zero to 60 after a teleport matches a new car"`

**C21** - Com o `Car` real virado de lado num heading h ∈ {0, 1, −2.5} rad, `reset()` sobe o chassi 1 m ± 0.01, deixa o eixo +Y do chassi com y ≥ 0.999 e o heading = h ± 0.01 rad (AC 16)
Proof: `npx vitest run tests/physics/reset.test.ts -t "reset stands the car up and keeps the heading"`

**C22** - No browser, R no free roam com o carro de cabeça para baixo: `lastReset` sobe 1 m, o eixo +Y do chassi tem y ≥ 0.999, o heading é o de antes ± 0.01 rad e as velocidades < 0.01 (substitui a rotação identidade da free-roam-city C11) (AC 16)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "reset puts car upright and keeps the heading"`

### S6 - chuva em qualquer altura · 4 files · 35 KB · ~9k

**C23** - `rainY(seed, t, cy)` fica em `[cy − 12, cy + 28)` para cy ∈ {0, 2, 60, 94} e t em 0-100 s; o vertex shader da chuva usa o mesmo deslocamento `uCenter.y − 12.0` e a altura da caixa 40, interpolados de `rainMath` (AC 17)
Proof: `npx vitest run tests/unit/rainMath.test.ts -t "rain box follows the car height"`

**C24** - Com a mesma pose de câmera relativa ao carro, a contagem de pixels de gota (sonda DEV) com o carro no ponto mais alto da `sprint-morro` (y ≥ 60 m) é ≥ 0.5 × a contagem com o carro a y ≈ 2 m, e > 0 (AC 18)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "rain falls on the hill roads"`

### S7 - miolo não atravessa o carro nem trava · 6 files · 125 KB · ~31k

**C25** - Com os gatos do seed 1337 e o carro passando por eles a 8 m/s e a 20 m/s, em todo passo com o carro a < 8 m, cada gato está em `gone` ou fora da caixa do chassi + 0.3 m (|ao longo| ≥ 2.4 ou |de lado| ≥ 1.2). Substitui a folga de 0.5 m da block-life-extras C25 (AC 19)
Proof: `npx vitest run tests/unit/extrasMotion.test.ts -t "cats are never inside the car box"`

**C26** - Com 400 pedestres do seed 1337 e o carro passando a 8 m/s e a 20 m/s, em todo passo com o carro a < 8 m, cada pedestre está fora da mesma caixa (AC 20)
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "walkers are never inside the car box"`

**C27** - Um pedestre em fuga sem direção livre dentro da zona sai da fuga em ≤ 1 s de simulação e anda num segmento novo; nos 400 pedestres do seed 1337 com o carro parado ao lado, nenhum fica em fuga com deslocamento zero por mais de 2 s (AC 21)
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "cornered walker leaves the flee"`

**C28** - A cor de cada gato e de cada pedestre sai da identidade dele (índice do spawn): a cor de instância lida no browser de um gato/pedestre que continua ativo é a mesma antes e depois de outro sumir ou entrar (AC 22)
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "extra color follows its identity"`
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "extra colors stay with their spawn"`

**C29** - Um miolo com 0 carros estacionados não cria a malha `parked-cars`, e um quadro renderizado assim não dá erro de shader no console (AC 23)
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "no parked cars builds no parked mesh"`

**C30** - O comentário do estacionamento em `InteriorProps.ts` cita os números que as chamadas de `wellInside` usam, lidos do próprio código: raio 4 m e 5.5 m da fachada (AC 24)
Proof: `npx vitest run tests/unit/docs.test.ts -t "parking comment matches wellInside"`

### S8 - trem fora do asfalto · 2 files · 15 KB · ~4k

**C31** - Seed 1337: toda coluna de portal fica a ≥ `largura / 2 + 0.25 + 0.5` m de toda estrada que não é a avenida do portal; o gerador pula o portal que violaria isso, então a coluna que hoje entra 0.29 m na avenida 4 não existe (AC 25)
Proof: `npx vitest run tests/unit/trainLine.test.ts -t "portal columns stay off other roads"`

### S9 - render acompanha a janela · 5 files · 100 KB · ~25k

**C32** - Viewport 640×360 → 1280×720: o alvo do espelho fica 640×360 e `uTexel` = (1/640, 1/360); o C4 da visual-upgrade (`floor(W·0.5) × floor(H·0.5)`) vale nos dois tamanhos (AC 26)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "reflection target follows a window resize"`

**C33** - Com `deviceScaleFactor` trocado de 1 para 2 (CDP) e depois um resize, o renderer e o composer têm pixelRatio `min(dpr, 2)` = 2, e o GTAO mede `floor(W·2/2) × floor(H·2/2)` (AC 27)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "pixel ratio and gtao follow the device"`

**C34** - `gl.getContextAttributes().antialias` = false e a lista de passes do composer segue com `SMAAPass` (AC 28)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "renderer without msaa keeps smaa"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| eventos que soltam as teclas (2) | `blur` C1, C3 · `visibilitychange` hidden C2 | - |
| campos do input zerados (5) | `throttle` C1, C2 · `brake` C1, C2 · `left` C1, C2 · `right` C1, C2 · `handbrake` C1, C2 | - |
| transições de visibilidade do áudio (2) | hidden → suspended C4 · visible → running C4 | - |
| gestos que retomam o áudio (2) | `keydown` C5, C6 · `pointerdown` C5, C6 | - |
| estados do áudio (3) | `idle` C7 · `running` C7 · `suspended` C7 | - |
| falhas tratadas (3) | `AudioContext` lança C8 · throw no quadro C10, C11 · miolo sem estacionados C29 | - |
| pontos de throw do loop (2) | `fixedUpdate` C10, C11 · `render` C10 | - |
| casos de `stopInput` (3) | para a frente > 5 C13 · parado abaixo de 5 C13 · para trás > 5 C13 | - |
| quem para (2) | oponente que terminou C14 · oponente correndo com a sessão `finished` C15, C16 | - |
| corridas (4) | C14, table-driven sobre as 4 · C17, table-driven sobre as 4 | - |
| slots no reset (4) | C17, table-driven sobre os 4 | - |
| caminhos de reposição do carro (2) | `teleport` C19, C20 · `reset` C19, C21, C22 | - |
| estado zerado no reset (4) | marcha C19, C20 · volante C19 · `lateralG` C19 · `skidding` C19 | - |
| alturas da chuva (2) | y ≈ 2 C23, C24 · morro y ≥ 60 C23, C24 | - |
| extras dentro da caixa do carro (2) | gato C25 · pedestre C26 | - |
| velocidades do carro nas provas do miolo (2) | 8 m/s C25, C26 · 20 m/s C25, C26 | - |
| tamanhos que seguem a janela (3) | alvo do espelho C32 · pixelRatio C33 · GTAO C33 | - |
| checks de outras features renegociados (4) | free-roam-city C11 → C22 · block-life-extras C25 → C25 · races hold da contagem → C9 e `race.spec` "countdown holds every car" · visual-upgrade C4 → C32 | - |
| Observable (4) | `#error` C11 · `#loading` C12 · miolo vazio C29 · ordem do resultado C18 | - |

- Nenhum check afirma mais do que o caso que a própria prova exercita. C3 mede o efeito no carro; C1 e C2 medem os 5 campos.

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Regra pura (`stopInput`, `resetTarget`, desempate em `raceProgress`, `rainY`, movimento de gato e pedestre, portal do trem) | uma na própria camada, vitest | um caso por linha da tabela de decisão, mais as bordas de cada limite |
| Física com o `Car` real (parada do oponente, reset, teleport) | uma em `tests/physics` (AD-011) | um caso por caminho, com o número medido |
| Fiação no browser (`InputManager`, `AudioEngine`, `GameLoop`, `main`, `Game` resize) | uma e2e lendo `__game`; o `InputManager` e o `GameLoop` também numa unitária com alvo falso | um caso por evento ou estado afirmado |

Evidence:
- `stopInput`: 3 linhas (frente, parado, ré), 2 limites. Decide.
- `resetTarget`: hoje 2 linhas (sem portão, com portão); passa a depender do slot. Decide.
- `stepProgress`/`standings`: o desempate é uma regra de ordem. Decide.
- Precedente: `tests/unit/inputManager.test.ts` (alvo de eventos falso, test-hardening C13-C15) e `tests/physics/raceAi.test.ts` (IA com o `Car` real, races).

Cost: 3 arquivos novos (`tests/unit/gameLoop.test.ts`, `tests/physics/reset.test.ts`, e a sonda de gota no `Game`), 11 testes novos em arquivos existentes, 2 testes mudados (drive C11 da free-roam-city e extrasMotion C25 da block-life-extras).

## Swept

- validation: C17 (alvo no asfalto), C31 (coluna fora da outra estrada)
- failure modes: C8 (Web Audio lança), C10, C11 (throw no quadro), C29 (miolo sem estacionados)
- idempotency: C28 (a cor não muda quando outro extra entra ou sai)
- authorization: n/a - jogo local, sem conta
- concurrency: n/a - uma thread; os eventos de janela e o passo fixo não se sobrepõem
- data lifecycle: n/a - nada persistido
- dependency failure: C8 (sem `AudioContext`)
- state transitions: C4 (visível ↔ oculto), C14, C15 (chegada → parado), C27 (fuga → andar)
- observability: C8 (`console.warn`), C11 (overlay com a mensagem)

## Handoff

- S1 6k, S2 18k (24k), S3 5k (29k), S4 20k (49k), S5 11k (60k), S6 9k (69k), S7 31k (100k: `InteriorScene` 47 KB, `interiorMotion` 25 KB, `InteriorProps` 21 KB e os dois testes), S8 4k (104k), S9 25k (~129k: `CityScene` 28 KB, `Game` 89 KB lido em partes, `visual.spec` 23 KB). Abaixo do budget de 150k. Um builder só
- Mechanism: one builder (cabe no budget, sem pergunta)
- **Settled at checks:** o AC 4 diz que `audio.state` é sempre `ctx.state`. Antes da primeira tecla não há contexto, e a free-roam-city C35 exige `idle` nesse momento. C7 fica com `idle` sem contexto e `ctx.state` depois. Decisão delegada pelo usuário
- **Settled at checks:** a free-roam-city C11 (`drive.spec.ts` "reset puts car upright") é trocada pela C22, com o nome novo "reset puts car upright and keeps the heading". A rotação identidade deixa de ser exigida, decisão do usuário em 2026-09-29
- **Settled mid-build:** C14 falhou nas duas sprints (`sprint-cruzada`: 100 m fora do traçado). A chegada ficava no fim do traçado, que acaba num T com o anel ou no fim da estrada do morro, e quem chega a ~150 km/h precisa de uns 100 m para parar. A chegada do sprint passou para 200 m antes do fim (`SPRINT_RUNOFF`), o que renegocia a races AC 4 (C6 dela). Linha nova no `Impact` do plan. Decisão delegada pelo usuário
- **Settled mid-build:** o AC 12 vale para os 4 slots, inclusive o do jogador; a races C29 e o caso de portão de `aiDriver.test.ts` passam a esperar o lugar do grid atrás do portão. Linha nova no `Impact`
- **Settled mid-build:** C11 mede "0.5 s de relógio" com `pageFrames` e uma espera por `performance.now()`, porque a regra de higiene da test-hardening proíbe `waitForTimeout`
- **Settled mid-build:** recuar a chegada redistribuía todos os portões da sprint, e a test-hardening C17 ("stuck opponent is reset to its last gate", janela de 4 s ± 0.1) mediu 3.88 s num cenário que mudou de lugar. Os portões do meio voltaram às posições de antes; só a chegada vai para `fim − 200 m`, e cai o portão que ficaria a menos de 50 m antes dela. C17 da test-hardening passa sem mudança
