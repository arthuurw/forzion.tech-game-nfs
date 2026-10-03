# smooth-world checks

Profile: standard
Plan: `.specs/features/smooth-world/plan.md`

26 checks in 7 slices · 3 one-way doors · 0 open, of which 0 block

## Checks

### S1 - carro liso em qualquer taxa de quadros · 7 files · 80 KB · ~20k

**C1** - ✅ `GameLoop` chama `render(dt, alpha)` em todo quadro com `alpha = stepper.accumulator / stepper.step`, em [0, 1), com `requestAnimationFrame` falso a 144 Hz e a 30 Hz (AC 1, door 1)
Proof: `npx vitest run tests/unit/gameLoop.test.ts -t "render receives the interpolation alpha"`

**C2** - ✅ Com o `Car` real, depois de passos com o carro andando e virando, `car.drawPose(alpha)` põe `mesh.position` em `lerp(prev, curr, alpha)` ± 1e-6 m e `mesh.quaternion` em `slerp(prev, curr, alpha)` ± 1e-6, para alpha ∈ {0, 0.25, 0.5, 0.75, 0.99} (AC 1, door 1)
Proof: `npx vitest run tests/physics/interpolation.test.ts -t "car draws the interpolated pose"`

**C3** - ✅ No browser, durante a corrida, a posição desenhada de cada um dos 3 oponentes (`__game.race.opponents[i].drawn`) fica no segmento entre a pose do passo anterior e a atual (distância ao segmento ≤ 1e-4 m), e não é sempre a atual (AC 1)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "opponents draw the interpolated pose"`

**C4** - ✅ Com o `Car` real a 100 km/h em linha reta e um `GameLoop` com quadros de 1/144 s por 2 s, a posição desenhada anda em todo quadro, entre 0.5 × e 1.5 × `v / 144` (AC 2)
Proof: `npx vitest run tests/physics/interpolation.test.ts -t "car moves every frame at 144 hz"`

**C5** - ✅ Depois de `teleport` e, noutro carro, de `reset`, o próximo desenho com alpha ∈ {0, 0.5, 0.99} fica exatamente na pose nova (distância 0 ± 1e-9 m, quaternion igual) (AC 3, door 1)
Proof: `npx vitest run tests/physics/interpolation.test.ts -t "teleport and reset leave no trail"`

**C6** - ✅ No browser, depois de um quadro, o alvo da câmera de perseguição é calculado da pose desenhada (`__game.car.drawn`), não da física: com o carro andando, a diferença entre o alvo e a pose desenhada é a mesma do caso parado ± 1e-4 m (AC 4)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "chase camera follows the drawn pose"`

**C7** - ✅ `.specs/STATE.md` tem duas ADs novas, `active`: uma que estende a AD-006 com a interpolação de pose no render e outra que estende a AD-012 com a consulta de chão caminhável (door 1, door 2)
Proof: `npx vitest run tests/unit/docs.test.ts -t "interpolation and walkable ground are recorded decisions"`

### S2 - junção do anel sem degrau · 2 files · 37 KB · ~9k

**C8** - ✅ Nas 12 junções entre avenida e anel do seed 1337, cada vértice da borda final da fita da avenida fica a ≤ 0.02 m da altura da fita do anel logo abaixo dele (AC 5)
Proof: `npx vitest run tests/unit/roads.test.ts -t "avenue ends meet the ring without a step"`

**C9** - ✅ A inclinação máxima de toda estrada segue ≤ 10 %, inclusive nos últimos metros das avenidas que chegam ao anel (AC 6)
Proof: `npx vitest run tests/unit/roads.test.ts -t "grade at most 10 percent"`

### S3 - ninguém entra em prédio · 5 files · 60 KB · ~15k

**C10** - ✅ `walkable(bi, zoneId, x, z)`: verdadeiro com os 4 vértices da célula (floor) na zona e `facadeDist` interpolada ≥ `LOT_MARGIN + 0.25`; falso com 1 vértice fora da zona; falso com a `facadeDist` interpolada 0.01 m abaixo do limite; falso fora da grade. Uma linha por caso (door 2)
Proof: `npx vitest run tests/unit/interiors.test.ts -t "walkable needs the whole cell and the facade gap"`

**C11** - ✅ Com 400 pedestres do seed 1337, carro em 3 posições (parado longe, parado a 5 m, passando a 8 m/s) por 40 s cada, em todo passo o centro de cada pedestre fica a ≥ 0.25 m do footprint (retângulo girado) de todo lote (AC 7)
Proof: `npx vitest run tests/physics/walkable.test.ts -t "walkers never enter a lot"`

**C12** - ✅ Com 200 gatos do seed 1337 e o carro passando a 8 e a 20 m/s, em todo passo o centro de cada gato fora de `gone` fica a ≥ 0.25 m do footprint de todo lote (AC 8)
Proof: `npx vitest run tests/physics/walkable.test.ts -t "cats never enter a lot"`

**C13** - ✅ Em 2 000 trechos novos sorteados por pedestres do seed 1337, toda amostra a cada 0.25 m do trecho é `walkable` (AC 9)
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "walker segments stay on walkable ground"`

### S4 - streaming sem engasgo · 4 files · 60 KB · ~15k

**C14** - ✅ No browser, antes do primeiro quadro todos os chunks a ≤ 900 m do spawn estão montados, e nos 60 primeiros quadros com o carro parado o contador de builds fica em 0 (AC 10, door 3)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "boot prebuilds the chunks near the spawn"`

**C15** - ✅ `ChunkManager.update` roda no máximo 1 fatia por chamada, com 5 chunks pendentes; e no browser, andando, o maior número de fatias num quadro é 1 (substitui a contagem de builds da city-terrain `world.spec.ts:360`) (AC 11, door 3)
Proof: `npx vitest run tests/unit/chunkManager.test.ts -t "one build slice per update"`
Proof: `npx playwright test tests/e2e/world.spec.ts -g "chunks stream around the car"`

**C16** - ✅ Em node, JIT aquecido, carro percorrendo o anel inteiro do seed 1337 a passos de 2 m: nenhuma chamada a `ChunkManager.update` passa de 8 ms (AC 12)
Proof: `npx vitest run tests/physics/streaming.test.ts -t "chunk update stays under 8 ms around the ring"`

**C17** - ✅ Para todos os chunks do seed 1337, o build em fatias dá o mesmo número de vértices e as mesmas posições (± 1e-6 m) do build de uma vez, em cada uma das 3 partes (terreno em faixas de ≤ 33 linhas; estradas e calçadas; pontes e props) (AC 13, door 3)
Proof: `npx vitest run tests/physics/streaming.test.ts -t "sliced build equals the one-shot build"`

### S5 - uma altura de chão só · 3 files · 20 KB · ~5k

**C18** - ✅ Em 20 000 pontos aleatórios do seed 1337, `heightAt(x, z)` difere ≤ 0.005 m do raio vertical no heightfield do Rapier (AC 14)
Proof: `npx vitest run tests/physics/walkable.test.ts -t "heightAt matches the physics heightfield"`

**C19** - ✅ Numa grade sintética com as 2 diagonais possíveis de uma célula, `heightAt` num ponto de cada triângulo é o plano daquele triângulo da malha (± 1e-9), inclusive sobre a diagonal (AC 14)
Proof: `npx vitest run tests/unit/terrain.test.ts -t "heightAt follows the mesh diagonal"`

### S6 - pontes e extrusões certas · 4 files · 40 KB · ~10k

**C20** - ✅ Numa estrada fechada sintética com ponte sobre o índice 0, sai 1 trecho de ponte que passa pela costura, e o tabuleiro e o guarda-corpo têm quads em todos os segmentos dele, inclusive `n-1 → 0` (AC 15)
Proof: `npx vitest run tests/unit/bridges.test.ts -t "bridge across the closed road seam"`

**C21** - ✅ Em calçada, tabuleiro, guarda-corpo e pilar montados do seed 1337, a normal de cada vértice difere ≤ 1° da normal da face do triângulo a que pertence (AC 16)
Proof: `npx vitest run tests/unit/chunkManager.test.ts -t "extrusions have flat face normals"`

### S7 - menos trabalho por quadro · 4 files · 55 KB · ~14k

**C22** - ✅ `InteriorScene.update` chamado 100 vezes depois da primeira cria 0 `Vector3`, `Matrix4`, `Quaternion` e `Euler` novos (contador nos construtores do three, em node) (AC 17)
Proof: `npx vitest run tests/physics/extras.test.ts -t "interior update allocates no math objects"`

**C23** - ✅ O minimapa redesenha no máximo 30 vezes em 1 s de simulação a 60 passos, e redesenha no quadro seguinte a uma mudança do estado da corrida mesmo dentro do intervalo (AC 18)
Proof: `npx vitest run tests/unit/minimap.test.ts -t "minimap redraws at most 30 times per second"`

**C24** - ✅ `__game.car.x/y/z` e a posição dos oponentes nas sondas continuam sendo a pose física; a pose desenhada é um campo novo `drawn` (Impact, sondas DEV)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "probes keep the physics pose and add the drawn one"`

**C25** - ✅ Com a nova `heightAt`, a base de cada lote do seed 1337 fica a ≤ 0.01 m do chão da malha (raio vertical no heightfield do Rapier) no mais baixo dos pontos que o `LotGenerator` amostra (centro e 4 cantos); cada carro estacionado fica a ≤ 0.01 m do chão da malha sob o centro dele, e cada piscina a ≤ 0.01 m do chão da malha sob o centro mais os 0.05 m documentados de `Pool.y` (superfície da água) (Impact, mundo; renegociado no build, 2026-10-02, decisão do usuário: a base do lote fica no ponto mais baixo (city-terrain), não no centro)
Proof: `npx vitest run tests/physics/walkable.test.ts -t "props stand on the mesh ground"`

**C26** - ✅ `interiorMotion.ts` e `BlockInteriors.ts` seguem puros e na lista da trava de pureza (door 2)
Proof: `npx vitest run tests/unit/purity.test.ts -t "pure modules do not import three or rapier"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| corpos desenhados com interpolação (2) | carro do jogador C2, C4, C6 · oponentes C3 | - |
| caminhos que zeram a interpolação (2) | `teleport` C5 · `reset` C5 | - |
| taxas de quadro do alpha (2) | 144 Hz C1, C4 · 30 Hz C1 | - |
| casos de `walkable` (4) | tudo certo C10 · vértice fora C10 · fachada perto C10 · fora da grade C10 | - |
| extras que não entram em lote (2) | pedestre C11, C13 · gato C12 | - |
| partes do build em fatias (3) | terreno em faixas C17 · estradas e calçadas C17 · pontes e props C17 | - |
| extrusões com normal por face (4) | calçada C21 · tabuleiro C21 · guarda-corpo C21 · pilar C21 | - |
| alocações zeradas no `update` (4) | `Vector3` C22 · `Matrix4` C22 · `Quaternion` C22 · `Euler` C22 | - |
| gatilhos de redesenho do minimapa (2) | teto de 30 Hz C23 · mudança da corrida C23 | - |
| doors do plan (3) | door 1 C1, C2, C5, C7 · door 2 C7, C10 · door 3 C14, C15, C17 | - |
| Impact (5 linhas) | AD-006 estendida C7 · AD-012 estendida C7 · world.spec:360 C15 · sondas DEV C24 · mundo muda de altura C25, C18 | - |

- Nenhum check afirma mais do que o caso que a própria prova exercita. C16 mede em node; o custo de subir o buffer para a GPU fica fora, como o plan assume.

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Regra pura (`walkable`, `heightAt`, junção do anel, trechos de ponte) | uma na própria camada, vitest | um caso por linha da tabela de decisão |
| Física e desenho com o `Car` real (interpolação, teleporte, reset) | uma em `tests/physics` (AD-011) | um caso por caminho, com o número medido |
| Streaming (`ChunkManager`) | uma em node com o `ChunkManager` real e uma no browser lendo `__game` | fatias por chamada, tempo por chamada e equivalência de geometria |
| Fiação no browser (`Game`, câmera, oponentes, minimapa) | uma e2e lendo `__game` ou uma unitária com alvo falso | um caso por objeto afirmado |

Evidence:
- `walkable`: 3 condições (célula inteira, fachada, dentro da grade), 4 linhas. Decide.
- Precedente: `tests/physics/raceAi.test.ts` (IA com o `Car` real) e `tests/unit/chunkManager.test.ts` (ChunkManager em node, test-hardening).

Cost: 3 arquivos novos (`tests/physics/interpolation.test.ts`, `tests/physics/walkable.test.ts`, `tests/physics/streaming.test.ts`), 12 testes novos em arquivos existentes, 1 teste mudado (`world.spec.ts` "chunks stream around the car" passa a contar fatias).

## Swept

- validation: C10 (limites do `walkable`), C19 (diagonal)
- failure modes: n/a - nenhum caminho de erro novo; um throw no quadro cai no overlay da play-fixes
- idempotency: C17 (fatias = build de uma vez)
- authorization: n/a - jogo local, sem conta
- concurrency: n/a - uma thread; as fatias rodam em série dentro do `update`
- data lifecycle: n/a - nada persistido
- dependency failure: n/a - sem dependência externa nova
- state transitions: C5 (teleporte e reset zeram a interpolação), C23 (mudança da corrida redesenha o minimapa)
- observability: C24 (pose desenhada nas sondas DEV)

## Handoff

- S1 20k (Game 90 KB lido em partes, Car 26 KB, RaceController 11 KB, ChaseCamera, GameLoop), S2 9k (29k), S3 15k (44k), S4 15k (59k), S5 5k (64k), S6 10k (74k), S7 14k (~88k: InteriorScene 47 KB). Abaixo do budget de 150k. Um builder só
- Mechanism: one builder (cabe no budget, sem pergunta)
- **Settled at checks:** a play-fixes (S7) já tira gato e pedestre da caixa do carro; aqui C11 e C12 medem contra o footprint do lote, e o empurrão do carro passa a respeitar `walkable`. As provas pesadas (400 pedestres por 40 s, 20 000 raios) vão para `tests/physics`, fora do teto de 3 s por teste unitário da test-hardening
