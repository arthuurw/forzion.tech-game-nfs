# play-fixes verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 8a7675f..55b64d7 (fix range f4ea74a..55b64d7)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Rodada 2, escopo: o diff `f4ea74a..55b64d7` e as 4 verdicts não-PASS da rodada 1. `git diff --stat f4ea74a..HEAD -- src tests/e2e` vazio: o fix mexeu só em `tests/physics/raceAi.test.ts`, `tests/unit/interiorMotion.test.ts`, `tests/unit/trainLine.test.ts`, `checks.md` e nos arquivos de lessons/verificação. Os 4 achados fecharam: o mutante F1 agora morre em `tests/physics/raceAi.test.ts:337`; a linha "Regra pura" ganhou os casos de borda da caixa do carro e do limite do portal, e a linha nova "Fiação da corrida" classifica `RaceController.beforeStep` e está cumprida; a C22 diz "± 0.05", igual a `toBeCloseTo(before.y + 1, 1)`; a linha "renegociados" conta 6, igual à `Impact` do plan.

Emendas do `checks.md` (`git diff f4ea74a..HEAD -- checks.md`), dentro do permitido: texto de claim mudou só na C22 (tolerância); 4 linhas `Proof:` só adicionadas (C14, C25, C26, C31); Test policy com 1 linha adicionada, as outras 3 iguais; linha "renegociados" do Coverage reescrita (achado 4); 3 entradas `Settled at verify` no `## Handoff`. Nota, sem efeito no veredito: as provas de borda novas de C25, C26 e C31 (achado 2) não têm entrada `Settled at verify` própria. A primeira entrada fala só da prova da C14 e da linha nova do Test policy.

## Binding sources

carried from f4ea74a (o fix não mexe na interface; o passo 1 roda só no profile `ui`)

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| nenhuma marcada como binding no plan | n/a no profile standard | - | - |

## Checks

verified at 55b64d7. As provas rodaram de novo por inteiro, e as citações dos 3 arquivos de teste que o fix mexeu foram atualizadas. As citações de arquivos que o fix não mexeu vêm de f4ea74a, e esses arquivos estão iguais (`git diff f4ea74a..HEAD` sem eles).

Provas unit/physics: uma invocação, `npx vitest run <11 arquivos> --reporter=verbose -t "<alternação dos 24 nomes>"`, exit 0, `Tests 24 passed | 44 skipped`. Cada um dos 24 nomes aparece uma vez com ✓, incluindo os 3 novos: "race controller stops an opponent that finished while the race goes on" ✓ 1610ms, "car box edges on each axis" ✓, "portal column just past the road gap is kept and just short is skipped" ✓.
Provas e2e: uma invocação, `E2E_PORT=5192 npx playwright test <6 specs> --reporter=list --grep "<alternação dos 17 nomes>"`, exit 0, `17 passed (6.6m)`. Servidor novo (`vite --port 5192 --strictPort`), e cada um dos 17 nomes aparece uma vez com ✓.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | blur zera os 5 campos | vitest "blur releases every held key" ✓ | `tests/unit/inputManager.test.ts:83` - `expect(released(input)).toEqual(NONE)` (carried) | PASS |
| C2 | hidden zera, visible não muda | vitest "hidden page releases every held key" ✓ | `tests/unit/inputManager.test.ts:93` visible mantém; `:96` - `toEqual(NONE)` (carried) | PASS |
| C3 | blur no browser: sobe ≤ 0.5 km/h | playwright "window blur releases the throttle" ✓ | `tests/e2e/drive.spec.ts:65` - `expect(b - a).toBeLessThanOrEqual(0.5)` (carried) | PASS |
| C4 | hidden → suspended, visible → running | playwright "hidden tab suspends the audio" ✓ | `tests/e2e/audio.spec.ts:147`, `:149` (carried) | PASS |
| C5 | Shift e pointerdown retomam | playwright "key or pointer resumes a suspended context" ✓ | `tests/e2e/audio.spec.ts:161`, `:164` (carried) | PASS |
| C6 | gesto em todo keydown/pointerdown; first key depois de aplicar | vitest "gesture handler on every keydown and pointerdown" ✓, "first key handler runs after the key is applied" ✓ | `tests/unit/inputManager.test.ts:109` - `toBe(4)`; `:120` - `toBe(true)` (carried) | PASS |
| C7 | `idle` sem contexto, depois igual a `contextState` | playwright "audio state mirrors the context" ✓, "first keypress starts audio" ✓ | `tests/e2e/audio.spec.ts:170`, `:172`, `:175`, `:17` (carried) | PASS |
| C8 | AudioContext lança: > 5 km/h, warn, sem erro | playwright "game runs silent when audio fails" ✓ | `tests/e2e/audio.spec.ts:198-200` (carried) | PASS |
| C9 | contagem: alvo 0.048, real < 0.06 | playwright "countdown keeps the engine sound at idle" ✓ | `tests/e2e/race.spec.ts:154` - `toBeCloseTo(0.048, 6)`; `:155` - `toBeLessThan(0.06)` (carried) | PASS |
| C10 | throw em fixedUpdate/render para o loop e reporta uma vez | vitest "a throw in the frame stops the loop and reports it" ✓ | `tests/unit/gameLoop.test.ts:50-52` (carried) | PASS |
| C11 | `#error` = `Erro no jogo: boom`, simTime parado | playwright "a frame error shows the error overlay" ✓ | `tests/e2e/hud.spec.ts:214`, `:220` (carried) | PASS |
| C12 | rAF vê `Gerando cidade...` sem `__game` | playwright "loading paints city generation before building the world" ✓ | `tests/e2e/hud.spec.ts:236` (carried) | PASS |
| C13 | tabela de `stopInput` com ±4.99 / ±5.01 | vitest "stop input after the finish" ✓ | `tests/unit/raceSession.test.ts:143` - `expect(stopInput(ai, kmh)).toEqual(want)` (carried) | PASS |
| C14 | quem termina para < 5 km/h em 8 s, dentro de `largura/2`, nas 4 corridas | vitest "finished opponents stop on the road in every race" ✓ 12.4 s e "race controller stops an opponent that finished while the race goes on" ✓ | refreshed: `tests/physics/raceAi.test.ts:234` - `stoppedAt <= 8`; `:235` - `endKmh < 5`; `:236` - `worst <= 0`; `:237` - `held === false`. Pelo controlador: `:327` - sessão ainda `racing`; `:337` - `done.lastInput` `toEqual({ throttle: false, brake: true, steer: want.ai.steer, handbrake: false })`; `:339` - `toEqual(stopInput(want.ai, want.kmh))` a cada passo; `:345` - `stoppedAt <= 8` | PASS |
| C15 | oponente a ≥ 60 km/h no modo stop recebe stopInput e para | vitest "opponents still racing stop when the player finishes" ✓ | refreshed: `tests/physics/raceAi.test.ts:260` - `toEqual({ throttle: false, brake: true, steer: ai.steer, handbrake: false })`; `:261` - `not.toEqual(HOLD_INPUT)`; `:265-269` - `held` false, `stoppedAt <= 8`, `endKmh < 5`, `worst <= 0` | PASS |
| C16 | browser: quem ainda corre freia sem freio de mão | playwright "unfinished opponents brake after the player finishes" ✓ | `tests/e2e/race.spec.ts:228-229` (carried) | PASS |
| C17 | 4 slots por portão, sem sobreposição, no asfalto; sem portão, o grid | vitest "gate reset spreads the four slots like the grid" ✓, "reset target is last gate or grid slot" ✓ | `tests/unit/raceSession.test.ts:198`, `:201`, `:207`, `:98` (carried) | PASS |
| C18 | empate: menor fração na frente, nas duas ordens | vitest "tie on the same step goes to the earlier crossing" ✓ | `tests/unit/raceProgress.test.ts:139-142` (carried) | PASS |
| C19 | teleport e reset: marcha 1, volante 0, lateralG 0, sem derrapagem | vitest "teleport and reset return the drivetrain to rest" ✓ | `tests/physics/reset.test.ts:50` (carried) | PASS |
| C20 | 0-60 depois do teleport = carro novo ± 0.05 s | vitest "zero to 60 after a teleport matches a new car" ✓ | `tests/physics/reset.test.ts:70` (carried) | PASS |
| C21 | reset: sobe 1 m ± 0.01, +Y ≥ 0.999, heading ± 0.01 | vitest "reset stands the car up and keeps the heading" ✓ | `tests/physics/reset.test.ts:86-89` (carried) | PASS |
| C22 | browser: R de cabeça para baixo, sobe 1 m ± 0.05, em pé, heading ± 0.01, velocidades < 0.01 | playwright "reset puts car upright and keeps the heading" ✓ | `tests/e2e/drive.spec.ts:213` - `expect(snap.position.y).toBeCloseTo(before.y + 1, 1)`, que é abs(Δ) < 0.05, igual ao "± 0.05" da claim emendada; `:211` - `upY >= 0.999`; `:212` - Δheading `<= 0.01`; `:214-215` - `linvel`, `angvel` `< 0.01`. Precision gap da rodada 1 fechado | PASS |
| C23 | `rainY` em `[cy − 12, cy + 28)`; shader igual | vitest "rain box follows the car height" ✓ | `tests/unit/rainMath.test.ts:29-30`, `:37-39` (carried) | PASS |
| C24 | gotas no morro ≥ 0.5 × as de y ≈ 2, e > 0 | playwright "rain falls on the hill roads" ✓ | `tests/e2e/visual.spec.ts:155`, `:157` (carried) | PASS |
| C25 | gato nunca dentro da caixa + 0.3 m (2.4 / 1.2) | vitest "cats are never inside the car box" ✓, "car box edges on each axis" ✓ | `tests/unit/extrasMotion.test.ts:281` (carried); refreshed: `tests/unit/interiorMotion.test.ts:523` - `insideCarBox(0, ±2.4)` `toBe(false)`; `:524` - lado ±1.2 `toBe(false)`; `:544` - `toBe(r.inside)` para 2.39/2.41 e 1.19/1.21 em cada eixo e sinal, com h ∈ {0, 1, −2.5} | PASS |
| C26 | pedestre nunca dentro da mesma caixa | vitest "walkers are never inside the car box" ✓, "car box edges on each axis" ✓ | refreshed: `tests/unit/interiorMotion.test.ts:440-441` - `Math.abs(l.along) < CAR_BOX_ALONG && Math.abs(l.side) < CAR_BOX_SIDE` → `expect.fail`; `:544` como na C25 | PASS |
| C27 | fuga sem saída termina em ≤ 1 s; nenhum parado > 2 s | vitest "cornered walker leaves the flee" ✓ | refreshed: `tests/unit/interiorMotion.test.ts:479` - `maxStuck * DT <= 1 + 1e-9`; `:484` - andou > 0.1 m; `:499` - `worst * DT <= 2` | PASS |
| C28 | cor pela identidade | vitest "extra color follows its identity" ✓, playwright "extra colors stay with their spawn" ✓ | refreshed: `tests/unit/interiorMotion.test.ts:509-511` - `toBe(alone)`; `tests/e2e/interiors.spec.ts:546` (carried) | PASS |
| C29 | 0 estacionados: sem malha, sem erro de shader | playwright "no parked cars builds no parked mesh" ✓ | `tests/e2e/interiors.spec.ts:562-563` (carried) | PASS |
| C30 | comentário cita raio 4 m e fachada 5.5 m | vitest "parking comment matches wellInside" ✓ | `tests/unit/docs.test.ts:95`, `:98-99` (carried) | PASS |
| C31 | toda coluna ≥ `w/2 + 0.25 + 0.5` de outra estrada; o gerador pula o portal que violaria | vitest "portal columns stay off other roads" ✓, "portal column just past the road gap is kept and just short is skipped" ✓ | `tests/unit/trainLine.test.ts:167` - `d >= road.width / 2 + 0.25 + 0.5`; `:172` - `checked` cobre todas. Refreshed: `:195` - `limit = ST_W / 2 + 0.25 + 0.5`; `:209` - com a coluna a limite + 0.01, `kept.frames` `toEqual(base.frames)`; `:212` - com limite − 0.01, os portais ao lado da rua `toEqual([])`; `:213` - os outros ficam | PASS |
| C32 | espelho 640×360 e `uTexel` depois do resize | playwright "reflection target follows a window resize" ✓ | `tests/e2e/visual.spec.ts:591`, `:597-599` (carried) | PASS |
| C33 | DPR 1 → 2 e resize: pixelRatio 2, GTAO na metade | playwright "pixel ratio and gtao follow the device" ✓ | `tests/e2e/visual.spec.ts:619-621` (carried) | PASS |
| C34 | `antialias` false e `SMAAPass` | playwright "renderer without msaa keeps smaa" ✓ | `tests/e2e/visual.spec.ts:631-632` (carried) | PASS |

## Coverage

As linhas "quem para" e "renegociados" estão verified at 55b64d7, porque o fix mexeu na autoridade ou no texto delas. As outras são carried from f4ea74a, porque `src/` não mudou.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| eventos que soltam as teclas (2) | carried from f4ea74a | blur C1, C3 · hidden C2 | - |
| campos do input zerados (5) | carried from f4ea74a | throttle, brake, left, right, handbrake C1, C2 | - |
| transições de visibilidade do áudio (2) | carried from f4ea74a | hidden → suspended C4 · visible → running C4 | - |
| gestos que retomam o áudio (2) | carried from f4ea74a | keydown C5, C6 · pointerdown C5, C6 | - |
| estados do áudio (3 alcançáveis) | carried from f4ea74a | idle, running, suspended C7 | - |
| falhas tratadas (3) | carried from f4ea74a | C8 · C10, C11 · C29 | - |
| pontos de throw do loop (2) | carried from f4ea74a | fixedUpdate C10, C11 · render C10 | - |
| casos de `stopInput` (3 + 2 limites) | carried from f4ea74a | C13 table-driven, ±4.99/±5.01 | - |
| quem para (2) | verified at 55b64d7; a decisão está em `src/race/RaceController.ts:158`: `stop` quando a sessão está `finished` OU `op.progress.finished` | oponente que terminou com a sessão `racing` → C14 pelo `RaceController.beforeStep` (`raceAi.test.ts:327`, `:337`, `:339`) · oponente correndo com a sessão `finished` → C15, C16 e a mesma prova do controlador (`raceAi.test.ts:356`, `:360-361`) | - |
| corridas (4) | carried from f4ea74a | C14, C17 table-driven sobre as 4 | - |
| slots no reset (4) | carried from f4ea74a | C17 table-driven | - |
| caminhos de reposição do carro (2) | carried from f4ea74a | teleport C19, C20 · reset C19, C21, C22 | - |
| estado zerado no reset (4) | carried from f4ea74a | C19 | - |
| alturas da chuva (2) | carried from f4ea74a | C23, C24 | - |
| extras dentro da caixa do carro (2) | carried from f4ea74a, mais a borda em `interiorMotion.test.ts:519` | gato C25 · pedestre C26 | - |
| velocidades do carro nas provas do miolo (2) | carried from f4ea74a | 8 e 20 m/s em C25, C26 | - |
| tamanhos que seguem a janela (3) | carried from f4ea74a | C32 · C33 · C33 | - |
| checks de outras features renegociados (6) | verified at 55b64d7: as 6 linhas "checks de outras features" da tabela `Impact` em `plan.md:55-60` | free-roam-city C11 → C22 · block-life-extras C25 → C25 · races, hold depois da chegada → C13-C16; a contagem → C9 e `race.spec.ts:129` "countdown holds every car" (carried: `race.spec.ts` e `src/` estão iguais desde f4ea74a) · races AC 4/C6 → `tests/unit/raceRoutes.test.ts:189` `SPRINT_RUNOFF === 200`, verde no gate · races C29/aiDriver → C17 (`raceSession.test.ts:98`) e `tests/unit/aiDriver.test.ts:47` "stuck detector thresholds and target", verde no gate · visual-upgrade C4 → C32. A linha agora conta 6, o mesmo número da `Impact` | - |
| Observable (4) | carried from f4ea74a | C11 · C12 · C29 · C18 | - |

## Test policy rows

As linhas "Regra pura" (a que a rodada 1 deu como descumprida) e "Fiação da corrida" (nova) estão verified at 55b64d7. As outras duas são carried from f4ea74a, porque os arquivos delas não mudaram.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Regra pura, vitest, um caso por linha mais as bordas de cada limite | `raceSession.ts`, `raceProgress.ts`, `rainMath.ts`, `interiorMotion.ts`, `trainLine.ts` | C13 · C17 · C18 · C23 · C25-C27 · C31 | yes - caixa do carro: `interiorMotion.test.ts:523-524` (exatamente em 2.4/1.2 conta como fora) e `:544` (2.39/2.41 e 1.19/1.21 em cada eixo e sinal, carro girado). Limite do portal `w/2 + 0.75`: `trainLine.test.ts:209` (+0.01 fica) e `:212` (−0.01 some). stopInput, resetTarget, desempate e rainY são carried |
| Física com o `Car` real (AD-011) | `Opponent.ts`, `Car.ts` | C14, C15, C19, C20, C21 | yes (carried from f4ea74a) |
| Fiação da corrida (`RaceController.beforeStep`), em `tests/physics` com `RaceController` e `Car` reais | `src/race/RaceController.ts:154-161` | "race controller stops an opponent that finished while the race goes on" | yes - o passo chama `rc.beforeStep` (`raceAi.test.ts:290-295`, a chamada em `:292`). hold na contagem: `:299` `toEqual(HOLD_INPUT)`. race correndo: `:323-324` `toEqual(want.ai)` a cada passo. stop de quem terminou com a sessão `racing`: `:337`, `:339` `toEqual(stopInput(...))`. stop de quem corre com a sessão `finished`: `:360-361` |
| Fiação do browser | `InputManager.ts`, `AudioEngine.ts`, `GameLoop.ts`, `main.ts`, `Game.ts` resize | C1-C12, C32-C34 | yes (carried from f4ea74a) |

## Faults injected

verified at 55b64d7, nas superfícies que o fix criou: a prova do controlador e as duas provas de borda. O scratch foi criado com `git worktree add --detach <scratchpad>/pf-r2 HEAD` (55b64d7), e a junction do `node_modules` com PowerShell `New-Item -ItemType Junction`. Cada fault foi revertida com `git checkout -- <file>` no scratch, e o `git status --porcelain` do scratch estava vazio antes da remoção. Na limpeza, `(Get-Item <scratch>\node_modules).Delete()` apagou a junction e depois o `git worktree remove` rodou sem `--force`. O `C:\Users\arthu\source\repos\Jogo\node_modules\three\package.json` continua existindo. O `git status --porcelain` do worktree play-fixes deu vazio (0 linhas) antes e depois.

As faults F2-F5 da rodada 1 mexem em arquivos de `src/` que o fix não tocou. Ficam carried from f4ea74a, e todas foram mortas.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 (reinjetada): tirado o `op.progress.finished` da condição do `stop`, que fica só `st === 'finished'` (o veh-1) | `src/race/RaceController.ts:158` | yes - `raceAi.test.ts:337` "expected { throttle: true, brake: false, … } to deeply equal { throttle: false, brake: true, … }" |
| F6: o outro ramo: tirado o `st === 'finished'`, e a condição fica só `op.progress.finished` | `src/race/RaceController.ts:158` | yes - `raceAi.test.ts:360` "expected { throttle: false, brake: false, … } to deeply equal { throttle: false, brake: true, … }" |
| F7: borda de lado da caixa, `< CAR_BOX_SIDE` → `< CAR_BOX_SIDE - 0.05` | `src/world/interiors/interiorMotion.ts:336` | yes - `interiorMotion.test.ts:544` "h 0 ao longo 0 de lado 1.19: expected false to be true" (a varredura dos pedestres em `:441` também falhou) |
| F8: borda ao longo, `<` → `<=` | `src/world/interiors/interiorMotion.ts:336` | yes - `interiorMotion.test.ts:523` "ao longo 2.4: expected true to be false". As varreduras de pedestre e de gato continuaram verdes, então só a prova de borda nova pega essa fault |
| F9: limite do portal `COLUMN_ROAD_GAP` 0.5 → 0.47 | `src/world/rail/trainLine.ts:45` | yes - `trainLine.test.ts:212` "expected [ { x: 300, … }, …(7) ] to deeply equal []". A prova do seed 1337 ("portal columns stay off other roads") continuou verde, então só a prova de borda nova pega essa fault |

## Gate

`npm test` (vitest completo, incluindo as `slow`) em 55b64d7: 58 arquivos, 245 passed, 0 failed, exit 0.
e2e dos checks (`E2E_PORT=5192`): 17 passed, 0 failed, exit 0. Só rodei os testes que as checks nomeiam, não a suíte e2e inteira.
