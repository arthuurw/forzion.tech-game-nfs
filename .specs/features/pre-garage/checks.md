# pre-garage checks

Profile: standard
Plan: `.specs/features/pre-garage/plan.md`

30 checks in 6 slices · 3 one-way doors · 0 open, of which 0 block

## Checks

### S1 - sobra de draw calls sem mudar a imagem · 7 files · 110 KB · ~28k

**C1** - No grid do `circuito-centro` com os 4 carros: `render.calls` ≤ 205 (AC 1, door 2)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "draw calls within budget while racing"`

**C2** - Nas 5 poses de `render.spec.ts`: `render.calls` ≤ 205 (AC 2, door 2)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "draw calls at most 205 across the world"`

**C3** - Renderizando só o carro do jogador (sonda `render.callsOf`), o passe custa 2 draw calls, o mesmo número de um oponente com o glb (AC 3)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "player car draws in two calls like an opponent"`

**C4** - Para cada malha do miolo e do trem (`world.cullVolumes`): se `frustumCulled` é false, o raio do volume dela é ≤ o raio de atividade declarado; se é true, a esfera de culling contém todas as instâncias ativas e tem raio ≤ 1.1 × o raio da caixa delas (AC 4)
Proof: `npx playwright test tests/e2e/extras.spec.ts -g "interior and train meshes cull with their real volume"`

**C5** - As provas de pixel do miolo, do trem e da pintura seguem verdes com os limites de hoje (AC 5)
Proof: `npx playwright test tests/e2e/extras.spec.ts tests/e2e/interiors.spec.ts tests/e2e/race.spec.ts -g "steam brightens the air above the vent|a searchlight beam is brighter than the sky|parked cars are one instanced mesh with their paints|ground bounce lights the block interior|construction floodlight lights the ground|opponent body reads its paint|opponent material is white and body color is the paint"`

### S2 - carro trocável e repintável · 9 files · 120 KB · ~30k

**C6** - `__game.setPlayerCar(spec, null)` com o carro parado numa pose conhecida: o número de corpos rígidos do mundo Rapier fica igual ao de antes, o carro novo está na mesma posição (± 0.01 m) e heading (± 0.001 rad), e os 2 faróis e os 2 cones são filhos do mesh novo (AC 6, door 3)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "set player car swaps the car in place"`

**C7** - Depois da troca, no quadro seguinte: a câmera segue o carro novo, `R` e a corrida (`race.resetPlayer`) movem o carro novo, o HUD mostra a velocidade dele e o áudio lê o RPM dele (AC 7, door 3)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "camera race hud and audio follow the new car"`

**C8** - Com o glb, depois de criar 2 carros sem pintura, `assets.carModel.parent` é `null` e os dois meshes têm geometrias distintas do original (AC 8)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "each car clones the model"`

**C9** - `car.setPaint('#2060ff')`: a média da carroceria do jogador na tela (`race.bodyProbe(-1)`) tem azul > vermelho; `setPaint(null)`: vermelho > azul (AC 9, door 3)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "player paint switches at run time"`

**C10** - Sem pintura, a média de cor da carroceria do jogador numa pose fixa fica a ≤ 3/255 por canal do valor medido antes desta feature, gravado no teste (AC 10)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "unpainted player keeps the original orange"`

**C11** - Com uma `CarSpec` de idle 1000 e redline 8500: `rpmPercent` dá 0 no idle e 100 no redline; o mapa de áudio (`engineCutoff` e o ganho que depende do RPM) chega a 1 no redline; `RPM_MIN` e `RPM_MAX` não existem mais em `src/` (AC 11)
Proof: `npx vitest run tests/unit/hudFormat.test.ts tests/unit/audioMap.test.ts -t "rpm limits come from the car in use"`

**C12** - `RaceController` com um grid de 3 e de 5 lugares: cria N − 1 oponentes, mostra `POS k/N` e o resultado tem N linhas com o nome pelo id do corredor (AC 12)
Proof: `npx vitest run tests/physics/raceAi.test.ts -t "racer count comes from the grid"`

### S3 - Game que cabe na cabeça, sem sonda em produção · 6 files · 100 KB · ~25k

**C13** - `src/core/Game.ts` tem ≤ 500 linhas e nenhum identificador que case `probe[A-Z]` ou `[a-z]Debug\(` (AC 13, door 1)
Proof: `npx vitest run tests/unit/debugSplit.test.ts -t "game file is small and has no probes"`

**C14** - Depois de `npm run build`, nenhum arquivo de `dist/assets` contém `probeRoadMarks`, `probeHeadlightShimmer`, `searchlightFrameDiff` ou `facadeSpans` (AC 14, door 1)
Proof: `node tests/tooling/bundle-has-no-probes.mjs`

**C15** - Em DEV, a lista recursiva de chaves de `window.__game` (até 3 níveis) é igual à gravada antes desta feature (AC 15, door 1)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "debug handle keeps every key"`

**C16** - `main.ts` só importa `./core/debug` por `import()` dentro de `if (import.meta.env.DEV)`, e nenhum outro arquivo de `src/` fora de `src/core/debug/` importa o módulo de debug (AC 16, door 1)
Proof: `npx vitest run tests/unit/debugSplit.test.ts -t "debug module is loaded only in dev"`

### S4 - desmontar e montar de novo · 10 files · 140 KB · ~35k

**C17** - `__game.dispose()`: `frames` não muda em 0.5 s de relógio (medido por `pageFrames`), os listeners de `resize`, `keydown`, `keyup`, `blur`, `pointerdown` e `visibilitychange` que o jogo pôs somem (contador por init script), o áudio fica `closed` e o mundo Rapier é liberado (`world.free` chamado) (AC 17)
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "dispose stops the loop and releases listeners audio and physics"`

**C18** - Depois de `dispose`, `renderer.info.memory.geometries` e `.textures` são 0 (AC 18)
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "dispose frees every geometry and texture"`

**C19** - Um `Game` novo no mesmo canvas depois do `dispose` chega ao primeiro quadro; com W apertado 1 s, um só carro acelera (um só corpo dinâmico com velocidade > 1 m/s) e um só `AudioContext` está `running` (AC 19)
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "a new game after dispose runs alone"`

**C20** - `InteriorScene`, `TrainScene`, `CityScene`, `AudioEngine` e `InputManager` têm `dispose()`: em node, cada cena montada e desmontada deixa 0 geometrias e materiais sem `dispose` (contador); o `InputManager` num alvo falso não reage a teclas depois do `dispose` (AC 17, AC 18)
Proof: `npx vitest run tests/physics/extras.test.ts -t "scenes dispose everything they built"`
Proof: `npx vitest run tests/unit/inputManager.test.ts -t "dispose removes every listener"`

### S5 - bundle separado · 3 files · 10 KB · ~3k

**C21** - `npm run build` emite ≥ 3 arquivos JS em `dist/assets`, um com o código do `three` e outro com o Rapier, separados do código do jogo, e a saída não tem o aviso de chunk grande; `chunkSizeWarningLimit` = maior chunk medido + 10 % (AC 20)
Proof: `node tests/tooling/bundle-split.mjs`

**C22** - O build servido por `vite preview` na porta 5198 chega ao primeiro quadro (`#loading` escondido, `#hud` visível) sem erro no console (AC 21)
Proof: `npx playwright test --config tests/tooling/preview.config.ts -g "production build reaches the first frame"`

### S6 - miolo sem deriva · 3 files · 70 KB · ~18k

**C23** - O atributo `aAngle` (e a fase) da malha de vapor é igual, elemento a elemento, ao que a função pura de vapor devolve para cada fio (AC 22)
Proof: `npx vitest run tests/physics/extras.test.ts -t "steam angles come from the pure function"`

**C24** - Os shaders do vagalume e do vapor leem a densidade da névoa de uma constante interpolada igual à do `FogExp2` da cena; o texto não tem o literal antigo; o vapor tem névoa (AC 23)
Proof: `npx vitest run tests/physics/extras.test.ts -t "fog density has one source"`

**C25** - O shader do chão declara `uFlood[${MAX_FLOODS}]` interpolado e o texto não tem `uFlood[12]` (AC 24)
Proof: `npx vitest run tests/physics/extras.test.ts -t "flood array size comes from MAX_FLOODS"`

**C26** - No browser, o vapor a 150 m do carro fica mais escuro que o mesmo vapor a 20 m (luminância média do fio, sonda `render.isolatedLum`) (AC 23)
Proof: `npx playwright test tests/e2e/extras.spec.ts -g "steam fades with the fog"`

### Decisões e fronteiras

**C27** - `.specs/STATE.md` tem as 3 ADs novas, `active`: sondas só no bundle de DEV (estende a AD-005), orçamento 220 com 15 de reserva e declaração de draw calls em todo plan, carro trocável com `setPlayerCar` e `setPaint` (door 1, door 2, door 3)
Proof: `npx vitest run tests/unit/docs.test.ts -t "pre-garage decisions are recorded"`

**C28** - `race.spec.ts` e `render.spec.ts` não têm mais o limite 220 nem 218 de draw calls; os dois usam 205 (Impact, orçamento)
Proof: `npx vitest run tests/unit/testHygiene.test.ts -t "draw call limits use the 205 budget"`

**C29** - A pintura dos oponentes segue: races C19/C32 e block-life-extras door 3 (Impact)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "opponents wear their own paint|opponent body reads its paint|opponent material is white and body color is the paint"`

**C30** - Os cones de farol seguem com as medidas da free-roam-city AC 12, agora montados em `src/vehicle/` (Impact)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "headlight cones"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| lugares do orçamento (2) | grid da corrida C1 · poses do mundo C2 | - |
| o que o `setPlayerCar` reaplica (6) | corpo Rapier C6 · pose C6 · faróis e cones C6 · câmera C7 · corrida C7 · HUD e áudio C7 | - |
| estados da pintura (2) | cor C9 · `null` C9, C10 | - |
| limites de RPM (2) | idle C11 · redline C11 | - |
| tamanhos de grid (2) | 3 C12 · 5 C12 | - |
| sondas que não vão para produção (4) | `probeRoadMarks` C14 · `probeHeadlightShimmer` C14 · `searchlightFrameDiff` C14 · `facadeSpans` C14 | - |
| listeners removidos no dispose (6) | `resize` C17 · `keydown` C17 · `keyup` C17 · `blur` C17 · `pointerdown` C17 · `visibilitychange` C17 | - |
| recursos liberados (4) | loop C17 · áudio C17 · Rapier C17 · GPU C18 | - |
| classes com `dispose` (5) | `InteriorScene` C20 · `TrainScene` C20 · `CityScene` C20 · `AudioEngine` C17, C20 · `InputManager` C20 | - |
| chunks do bundle (3) | `three` C21 · Rapier C21 · jogo C21 | - |
| fontes únicas no miolo (3) | ângulo do vapor C23 · névoa C24, C26 · `MAX_FLOODS` C25 | - |
| doors do plan (3) | door 1 C13-C16, C27 · door 2 C1, C2, C27 · door 3 C6, C9, C27 | - |
| Impact (6 linhas) | ADs C27 · sondas DEV C15 · pintura dos oponentes C29 · cones C30 · orçamento C28 · RPM C11 · build C21 | - |
| Observable (5 decididos) | sem pintura C10 · troca de carro C6, C7 · barra de RPM C11 · posição e resultado C12 · build de produção C22 | - |

- Nenhum check afirma mais do que o caso que a própria prova exercita. C14 e C21 leem o `dist/` de um build feito pela própria prova.

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Regra pura (limites de RPM, contagem de corredores) | uma na própria camada, vitest | um caso por limite e por tamanho de grid |
| Montagem e desmontagem de cenas (`dispose`, clonagem, orçamento) | uma em node com contador quando o three permite, e uma no browser lendo `__game` | um caso por classe e por recurso |
| Build (`vite.config.ts`, split de sondas) | um script em `tests/tooling/` que roda o build e lê o `dist/` | um caso por arquivo ou nome afirmado |
| Pixel (pintura, névoa do vapor) | uma sonda de pixel no browser | um caso por comportamento visual |

Evidence:
- o orçamento decide se a garagem cabe: é regra, com duas medidas (grid e poses).
- Precedente: `tests/tooling/suite-split.mjs` e `list-has.mjs` (test-hardening) rodam comandos e leem a saída; `render.isolatedLum` (night-city C30-C32) isola objetos para medir pixel.

Cost: 2 scripts novos em `tests/tooling/` (`bundle-has-no-probes.mjs`, `bundle-split.mjs`), 1 config de preview, 1 unitário novo (`debugSplit.test.ts`), 17 testes novos em arquivos existentes, 3 testes mudados (limites 205 e o nome do teste de poses).

## Swept

- validation: C11 (limites de RPM do carro em uso), C12 (tamanhos de grid)
- failure modes: C22 (build de produção sem erro no console)
- idempotency: C19 (montar de novo depois do dispose dá um jogo só)
- authorization: n/a - jogo local, sem conta
- concurrency: C19 (um só `AudioContext` e um só carro depois de remontar)
- data lifecycle: C17, C18 (tudo liberado no dispose)
- dependency failure: n/a - sem dependência externa nova
- state transitions: C6, C7 (troca de carro), C9 (pintura liga e desliga)
- observability: C15 (mesmas chaves em `__game`)

## Handoff

- S1 28k (InteriorScene 47 KB, TrainScene, CityScene, Game em partes, render.spec), S2 30k (58k: Car 26 KB, RaceController, drivetrain, hud, audio), S3 25k (83k: Game 90 KB inteiro, o módulo de debug novo), S4 35k (118k: dispose em 6 classes), S5 3k (121k), S6 18k (139k). Abaixo do budget de 150k por pouco. Um builder só
- Mechanism: one builder (cabe no budget, sem pergunta)
- **Settled at checks:** o alvo de 205 parte de 218 no grid depois da night-city (não mais 219). Se não chegar a 205 sem mudar a imagem, para e pergunta, como o plan manda
- **Settled at checks:** C17 soma `pointerdown` aos listeners, porque a play-fixes passou a ouvir `pointerdown` no `InputManager`
