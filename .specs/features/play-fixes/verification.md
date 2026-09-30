# play-fixes verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 8a7675f..f4ea74a
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Todas as 34 checks têm prova verde em `f4ea74a` e asserção localizada. O FAIL vem de um mutante que sobreviveu: tirar de `RaceController.beforeStep` o modo `stop` do oponente que já terminou (`src/race/RaceController.ts:159`) traz de volta exatamente o veh-1 da auditoria, e nem C14 nem C16 ficam vermelhas. C14 chama `Opponent.drive(DT, 'stop')` direto e não passa pela decisão do controlador. C16 só exercita a sessão `finished`. O membro "oponente que terminou" do set "quem para" fica sem prova no nível do sistema.

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| nenhuma marcada como binding no plan (`Sources` cita a auditoria `.specs/audits/2026-09-29-validation.md` e a decisão do usuário sobre o R) | auditoria aberta só como contexto (veh-1, linhas 31-38); o passo 1 roda só no profile `ui` | - | - |

## Checks

Provas unit/physics: uma invocação, `npx vitest run <11 arquivos> --reporter=verbose -t "<alternação dos 21 nomes>"`, exit 0, 21 passed | 44 skipped. Cada nome aparece com ✓ na saída.
Provas e2e: uma invocação, `E2E_PORT=5190 npx playwright test <6 specs> --reporter=list --grep "<alternação dos 17 nomes>"`, exit 0, 17 passed (7.0m). Cada nome aparece com ✓ na saída.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | blur zera os 5 campos | vitest "blur releases every held key" ✓ | `tests/unit/inputManager.test.ts:81` - os 5 true antes; `:83` - `expect(released(input)).toEqual(NONE)` | PASS |
| C2 | hidden zera, visible não muda | vitest "hidden page releases every held key" ✓ | `tests/unit/inputManager.test.ts:93` - os 5 continuam true depois de `visibilitychange` com visible; `:96` - `toEqual(NONE)` depois de hidden | PASS |
| C3 | blur no browser: velocidade sobe ≤ 0.5 km/h entre 0.5 e 1.5 s | playwright "window blur releases the throttle" ✓ | `tests/e2e/drive.spec.ts:64` - `expect(a).toBeGreaterThan(5)`; `:65` - `expect(b - a).toBeLessThanOrEqual(0.5)` | PASS |
| C4 | hidden → suspended, visible → running | playwright "hidden tab suspends the audio" ✓ | `tests/e2e/audio.spec.ts:147` - `waitForFunction(... contextState === 'suspended')`; `:149` - `=== 'running'` | PASS |
| C5 | Shift e pointerdown retomam o contexto | playwright "key or pointer resumes a suspended context" ✓ | `tests/e2e/audio.spec.ts:161` - running depois de `ShiftLeft`; `:164` - running depois de `pointerdown` no `#game` | PASS |
| C6 | gesto em todo keydown e pointerdown; first key depois de aplicar a tecla | vitest "gesture handler on every keydown and pointerdown" ✓ e "first key handler runs after the key is applied" ✓ | `tests/unit/inputManager.test.ts:109` - `expect(gestures).toBe(4)` (W, W repetido, Shift, pointerdown; keyup não conta); `:120` - `expect(seen).toBe(true)` | PASS |
| C7 | `idle` sem contexto, depois igual a `contextState` | playwright "audio state mirrors the context" ✓ e "first keypress starts audio" ✓ | `tests/e2e/audio.spec.ts:170` - `toEqual({ state: 'idle', ctx: 'none' })`; `:172` - `{ state: 'running', ctx: 'running' }`; `:175` - `{ state: 'suspended', ctx: 'suspended' }`; `:17` - `toBe('idle')` | PASS |
| C8 | AudioContext lança: carro > 5 km/h, warn `Áudio indisponível`, sem erro de página | playwright "game runs silent when audio fails" ✓ | `tests/e2e/audio.spec.ts:198` - `expect(kmh).toBeGreaterThan(5)`; `:199` - `w.startsWith('Áudio indisponível')`; `:200` - `expect(pageErrors).toEqual([])` | PASS |
| C9 | contagem: alvo 0.048 e valor real < 0.06 | playwright "countdown keeps the engine sound at idle" ✓ | `tests/e2e/race.spec.ts:153` - `toBe('countdown')`; `:154` - `expect(a.target).toBeCloseTo(0.048, 6)`; `:155` - `expect(a.real).toBeLessThan(0.06)` | PASS |
| C10 | throw em fixedUpdate e em render para o loop e reporta uma vez | vitest "a throw in the frame stops the loop and reports it" ✓ | `tests/unit/gameLoop.test.ts:50` - `expect(loop.running, where).toBe(false)`; `:51` - `expect(queue, where).toHaveLength(0)`; `:52` - `expect(reported, where).toEqual([boom])`, nos dois `where` | PASS |
| C11 | `#error` com `Erro no jogo: boom`, simTime parado 0.5 s | playwright "a frame error shows the error overlay" ✓ | `tests/e2e/hud.spec.ts:214` - `toBe('Erro no jogo: boom')`; `:220` - simTime `toBe(t0)` depois de ≥ 500 ms de `performance.now()` e 10 quadros | PASS |
| C12 | rAF vê `Gerando cidade...` sem `__game` | playwright "loading paints city generation before building the world" ✓ | `tests/e2e/hud.spec.ts:236` - `expect(... __sawCityText).toBe(true)` | PASS |
| C13 | tabela de `stopInput` com as bordas ±4.99 e ±5.01 | vitest "stop input after the finish" ✓ | `tests/unit/raceSession.test.ts:143` - `expect(stopInput(ai, kmh)).toEqual(want)` sobre as linhas 120, 5.01, 4.99, 0, −4.99, −5.01, −20 | PASS |
| C14 | cada oponente que termina para < 5 km/h em 8 s, dentro de `largura/2`, nas 4 corridas | vitest "finished opponents stop on the road in every race" ✓ | `tests/physics/raceAi.test.ts:226` - `stoppedAt <= 8`; `:227` - `endKmh < 5`; `:228` - `worst <= 0`; `:229` - `held === false`. Nota: a prova chama `op.drive(DT, 'stop')` direto (ver Faults F1) | PASS |
| C15 | oponente a ≥ 60 km/h no modo stop recebe stopInput e para | vitest "opponents still racing stop when the player finishes" ✓ | `tests/physics/raceAi.test.ts:252` - `toEqual({ throttle: false, brake: true, steer: ai.steer, handbrake: false })`; `:258-262` - `held` false, `stoppedAt <= 8`, `endKmh < 5`, `worst <= 0` | PASS |
| C16 | browser: oponente ainda correndo depois da chegada do jogador freia sem freio de mão | playwright "unfinished opponents brake after the player finishes" ✓ | `tests/e2e/race.spec.ts:228` - `expect(o.input.handbrake).toBe(false)`; `:229` - `expect(o.input.brake).toBe(true)` | PASS |
| C17 | 4 slots por portão: distintos, sem sobreposição, no asfalto; sem portão, o grid | vitest "gate reset spreads the four slots like the grid" ✓ e "reset target is last gate or grid slot" ✓ | `tests/unit/raceSession.test.ts:198` - `distToRoute <= widthAt/2 - 1`; `:200` - distância > 0; `:201` - `overlap(...) === false`; `:207` - `checked === 4 × portões`; `:98` - sem portão, `toEqual` o grid | PASS |
| C18 | empate no mesmo passo: menor fração na frente, nas duas ordens; tempo do passo | vitest "tie on the same step goes to the earlier crossing" ✓ | `tests/unit/raceProgress.test.ts:139-140` - `finishTime).toBe(61.25)`; `:142` - `toEqual([0, 1])` nas duas ordens | PASS |
| C19 | teleport e reset: marcha 1, volante 0, lateralG 0, sem derrapagem | vitest "teleport and reset return the drivetrain to rest" ✓ | `tests/physics/reset.test.ts:50` - `toEqual({ gear: 1, steer: [0, 0], lateralG: 0, skidding: false })` para os dois caminhos | PASS |
| C20 | 0-60 depois do teleport = carro novo ± 0.05 s | vitest "zero to 60 after a teleport matches a new car" ✓ | `tests/physics/reset.test.ts:70` - `expect(Math.abs(t1 - t0)).toBeLessThanOrEqual(0.05)` | PASS |
| C21 | reset: sobe 1 m ± 0.01, +Y ≥ 0.999, heading ± 0.01 | vitest "reset stands the car up and keeps the heading" ✓ | `tests/physics/reset.test.ts:86` - `toBeCloseTo(1, 2)`; `:87` - `axis(...).y >= 0.999`; `:89` - `Math.abs(d) <= 0.01`, para h ∈ {0, 1, −2.5} | PASS |
| C22 | browser: R de cabeça para baixo, sobe 1 m, em pé, heading mantido, velocidades < 0.01 | playwright "reset puts car upright and keeps the heading" ✓ | `tests/e2e/drive.spec.ts:211` - `upY >= 0.999`; `:212` - Δheading `<= 0.01`; `:213` - `toBeCloseTo(before.y + 1, 1)`; `:214-215` - `linvel`, `angvel` `< 0.01`. Precision gap: "sobe 1 m" não traz tolerância na check, o teste usa ± 0.05 | PASS |
| C23 | `rainY` em `[cy − 12, cy + 28)`; shader com o mesmo deslocamento e a caixa de 40 | vitest "rain box follows the car height" ✓ | `tests/unit/rainMath.test.ts:29` - `>= cy - 12`; `:30` - `< cy + 28`; `:37-38` - o vertex shader contém `uCenter.y - 12.0` e o mesmo `mod`; `:39` - `uBox.y === RAIN_BOX.y` | PASS |
| C24 | gotas no morro (y ≥ 60) ≥ 0.5 × as de y ≈ 2, e > 0 | playwright "rain falls on the hill roads" ✓ | `tests/e2e/visual.spec.ts:152` - `highAt.y >= 60`; `:155` - `low > 0`; `:157` - `high >= 0.5 * low` | PASS |
| C25 | gato nunca dentro da caixa + 0.3 m, a 8 e 20 m/s | vitest "cats are never inside the car box" ✓ | `tests/unit/extrasMotion.test.ts:281` - `if (!outside) expect.fail(...)`, com `outside = |along| >= 2.4 || |side| >= 1.2`; `:286` - `near > 1000` | PASS |
| C26 | pedestre nunca dentro da mesma caixa | vitest "walkers are never inside the car box" ✓ | `tests/unit/interiorMotion.test.ts:439` - `|along| < CAR_BOX_ALONG && |side| < CAR_BOX_SIDE` → `expect.fail` | PASS |
| C27 | fuga sem saída termina em ≤ 1 s; nenhum dos 400 parado em fuga > 2 s | vitest "cornered walker leaves the flee" ✓ | `tests/unit/interiorMotion.test.ts:478` - `maxStuck * DT <= 1 + 1e-9`; `:482` - andou > 0.1 m depois; `:498` - `worst * DT <= 2` | PASS |
| C28 | cor pela identidade, igual antes e depois de outros entrarem ou saírem | vitest "extra color follows its identity" ✓ e playwright "extra colors stay with their spawn" ✓ | `tests/unit/interiorMotion.test.ts:508-510` - `toBe(alone)`; `tests/e2e/interiors.spec.ts:546` - `expect(s.color).toBe(was.color)`; `:550` - `moved > 0` | PASS |
| C29 | 0 estacionados: sem malha `parked-cars`, sem erro de shader | playwright "no parked cars builds no parked mesh" ✓ | `tests/e2e/interiors.spec.ts:562` - `toEqual({ parkedMesh: false, named: false })`; `:563` - nenhum erro `/shader|WebGLProgram/` | PASS |
| C30 | comentário cita raio 4 m e fachada 5.5 m, lidos do código | vitest "parking comment matches wellInside" ✓ | `tests/unit/docs.test.ts:95` - `toEqual(['4', '5.5'])`; `:98-99` - o comentário contém `raio 4 m` e `fachada 5.5 m` | PASS |
| C31 | toda coluna ≥ `w/2 + 0.25 + 0.5` de outra estrada | vitest "portal columns stay off other roads" ✓ | `tests/unit/trainLine.test.ts:167` - `d >= road.width / 2 + 0.25 + 0.5`; `:172` - `checked` cobre todas as colunas × estradas | PASS |
| C32 | espelho 640×360 e `uTexel` (1/640, 1/360) depois do resize | playwright "reflection target follows a window resize" ✓ | `tests/e2e/visual.spec.ts:591` - `[320, 180]` antes; `:597` - `[640, 360]`; `:598-599` - `texel` `toBeCloseTo(1/640)`, `(1/360)` | PASS |
| C33 | DPR 1 → 2 e resize: pixelRatio 2 no renderer e no composer, GTAO na metade do buffer | playwright "pixel ratio and gtao follow the device" ✓ | `tests/e2e/visual.spec.ts:619` - `toEqual({ renderer: min(dpr,2), composer: min(dpr,2) })`; `:620-621` - `gtao.width/height === floor(W·2/2)`, `floor(H·2/2)` | PASS |
| C34 | `antialias` false e `SMAAPass` presente | playwright "renderer without msaa keeps smaa" ✓ | `tests/e2e/visual.spec.ts:631` - `toBe(false)`; `:632` - `toContain('SMAAPass')` | PASS |

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| eventos que soltam as teclas (2) | `InputManager.ts:26-27` e AC 1-2 | blur C1, C3 · visibilitychange hidden C2 (visible sem efeito C2) | - |
| campos do input zerados (5 segurados de 7) | `input.ts:8-16`; `releaseAll` volta os 7 com `createInputState` | throttle, brake, steerLeft, steerRight, handbrake C1, C2 (reset e mute são teclas de toque, fora do AC) | - |
| transições de visibilidade do áudio (2) | `Game.ts` `handleVisibility` e AC 3 | hidden → suspended C4 · visible → running C4 | - |
| gestos que retomam o áudio (2) | `InputManager.ts:25,60,68` | keydown C5, C6 · pointerdown C5, C6 | - |
| estados do áudio (3 alcançáveis) | `AudioState = 'idle' \| AudioContextState` | idle C7 · running C7 · suspended C7. `closed` existe no tipo, mas nenhum `ctx.close()` em `src/audio` (rg vazio), então não é alcançável | - |
| falhas tratadas (3) | AC 5, 7, 23 | AudioContext lança C8 · throw no quadro C10, C11 · miolo sem estacionados C29 | - |
| pontos de throw do loop (2) | `GameLoop.ts:39-47` | fixedUpdate C10, C11 · render C10 | - |
| casos de `stopInput` (3 + 2 limites) | `raceSession.ts` `stopInput` | frente > 5, parado, ré < −5 C13, com ±4.99 e ±5.01 | - |
| quem para (2) | AC 9 e AC 11; decisão em `RaceController.ts:159` | oponente correndo com a sessão `finished` C15, C16 (C16 passa pelo controlador) · oponente que terminou com a sessão ainda `racing`: C14 prova só `Opponent.drive(…, 'stop')`, e nenhuma prova afirma que o controlador escolhe `stop` para `op.progress.finished` (mutante F1 sobrevive a C14 e C16) | oponente que terminou (seleção do modo em `RaceController.beforeStep`) |
| corridas (4) | `generateRaces` ids, afirmados em `raceSession.test.ts:151` | circuito-centro, circuito-anel, sprint-cruzada, sprint-morro: C14 e C17 table-driven | - |
| slots no reset (4) | `gridSlotAt` slot 0-3 | C17 table-driven sobre os 4 | - |
| caminhos de reposição do carro (2) | `Car.ts` `reset`, `teleport` | teleport C19, C20 · reset C19, C21, C22 | - |
| estado zerado no reset (4) | `Car.rest()` | marcha, volante, lateralG, skidding C19 | - |
| alturas da chuva (2) | AC 17-18 | y ≈ 2 C23, C24 · morro y ≥ 60 C23, C24 (C23 também cy 0 e 94) | - |
| extras dentro da caixa do carro (2) | AC 19-20 | gato C25 · pedestre C26 | - |
| velocidades do carro nas provas do miolo (2) | AC 19-20 | 8 m/s e 20 m/s em C25 e C26 | - |
| tamanhos que seguem a janela (3) | `Game.handleResize` e AC 26-27 | alvo do espelho C32 · pixelRatio do renderer e do composer C33 · GTAO C33 | - |
| checks de outras features renegociados (6, pela tabela `Impact` do plan; a linha das checks lista 4) | `plan.md` Impact | free-roam-city C11 → C22 · block-life-extras C25 → C25 · races hold depois da chegada → C13-C16, e a contagem → C9 · visual-upgrade C4 → C32 · races AC 4/C6 → `tests/unit/raceRoutes.test.ts:189` `SPRINT_RUNOFF === 200` e distância da chegada ≤ 4 m (verde no gate) · races C29 e o portão de `aiDriver.test.ts` → C17 (`raceSession.test.ts:98-105`) e `aiDriver.test.ts` (verde no gate) | - |
| Observable (4) | plan `Observable` | `#error` C11 · `#loading` C12 · miolo vazio C29 · ordem do resultado C18 | - |

Nota sobre a linha de renegociados: dois membros que a `Impact` nomeia (races C6 e races C29/aiDriver) não entram na linha de 4 das checks. Os dois têm prova na árvore, então não ficam sem prova, mas a linha subconta o set.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Regra pura, vitest, um caso por linha mais as bordas de cada limite | `raceSession.ts` (stopInput, resetTarget), `raceProgress.ts`, `rainMath.ts`, `interiorMotion.ts`, `trainLine.ts` | stopInput C13 · resetTarget C17 · desempate C18 · rainY C23 · gato/pedestre C25-C27 · portal C31 | no - stopInput (±4.99/±5.01), resetTarget (as 2 linhas × 4 slots) e o desempate (2 ordens) cumprem. A borda da caixa do carro (2.4 / 1.2 m) só é cruzada por varredura, sem caso logo dentro e logo fora dela. O limite do portal (`w/2 + 0.75`) só é conferido como invariante da saída do seed 1337: nenhum caso mostra que um portal logo acima do limite fica e um logo abaixo é pulado |
| Física com o `Car` real, em `tests/physics`, um caso por caminho com o número medido | `Opponent.ts` (modo stop), `Car.ts` (reset, teleport) | C14, C15, C19, C20, C21 | yes - os dois caminhos de parada do `Opponent`, e reset e teleport, cada um com o número medido |
| Fiação no browser (e2e lendo `__game`; InputManager e GameLoop também em unit) | `InputManager.ts`, `AudioEngine.ts`, `GameLoop.ts`, `main.ts`, `Game.ts` resize | InputManager C3 + C1, C2, C6 · AudioEngine C4, C5, C7, C8 · GameLoop C11 + C10 · main C11, C12 · resize C32, C33, C34 | yes |
| (sem linha) fiação da corrida: `RaceController.beforeStep` escolhe hold/stop/race | `RaceController.ts:156-161` | nenhuma linha classifica o arquivo; o ramo `op.progress.finished → 'stop'` não tem prova em nenhuma camada | no - o mutante F1 sobrevive |

## Faults injected

Scratch: `git worktree add --detach <scratchpad>/pf-faults f4ea74a`, com junction para o `node_modules`. `git status --porcelain` do worktree play-fixes: vazio antes e vazio depois. Cada fault revertida com `git checkout -- <file>` no scratch antes da próxima. A junction foi apagada antes do `git worktree remove`, e o `node_modules` compartilhado continua intacto.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1: `st === 'finished' \|\| op.progress.finished ? 'stop'` → `st === 'finished' ? 'stop'`. O oponente que terminou com a sessão `racing` volta a correr com a IA, que é o veh-1. Rodei C14 (vitest, ✓ 21.5 s) e C16 (playwright :5191, ✓ 1.1 m), e as duas seguiram verdes | `src/race/RaceController.ts:159` | no |
| F2: centro da chuva com `y: 12` fixo, a caixa antiga `[0, 40)`. Rodei C24 | `src/core/Game.ts:379` | yes - `visual.spec.ts:156` `high > 0`, recebido 0 |
| F3: removida a checagem de `devicePixelRatio` a cada quadro. Rodei C33 | `src/core/Game.ts:369` | yes - `visual.spec.ts:614` `waitForFunction(renderer === 2)` estourou o tempo |
| F4: desligado o empurrão do pedestre para fora da caixa. Rodei C26 | `src/world/interiors/interiorMotion.ts:488` | yes - `interiorMotion.test.ts:440` "pedestre 0 a 8 m/s, passo 144: along 2.38 side 1.11" |
| F5: removido o `await nextPaint()` antes do `new Game`. Rodei C12 | `src/main.ts:39` | yes - `hud.spec.ts:236` esperado true, recebido false |

## Gate

`npm test` (vitest, tudo, com as `slow`) em `f4ea74a`: 58 arquivos, 242 passed, 0 failed.
e2e dos checks: 17 passed, 0 failed. Rodei só os testes que as checks nomeiam, não a suíte e2e inteira.

**Ranked gaps**
1. O oponente que terminou numa sessão ainda `racing` não tem prova de que o sistema o manda parar. O mutante F1, que reproduz o veh-1, passa por C14 e C16. Isso afeta a C14 e o AC 9, em `src/race/RaceController.ts:159`. Falta uma prova que passe por `RaceController.beforeStep`, por exemplo no browser ou numa unitária do controlador, com um oponente `finished` e a sessão `racing`, e que afirme `lastInput` = `stopInput`.
2. Na linha "Regra pura" do Test policy faltam as bordas da caixa do carro (C25, C26) e do limite do portal (C31). Afeta `interiorMotion.ts` `insideCarBox` e `trainLine.ts` `COLUMN_ROAD_GAP`.
3. Precision gap na C22: "sobe 1 m" sem tolerância na check, e o teste aceita ± 0.05 (`tests/e2e/drive.spec.ts:213`).
4. A linha "renegociados" do Coverage conta 4 membros, e a `Impact` do plan nomeia 6. Os 2 que faltam têm prova (`raceRoutes.test.ts:189`, `raceSession.test.ts:98-105`, `aiDriver.test.ts`).
