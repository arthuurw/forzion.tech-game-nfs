# City terrain verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 307ce8c..b6c43a0 (rodada 1: 307ce8c..3b76758; rodada 2: 3b76758..e8f99fb; correção desta rodada: 09014ba, no merge 6a33253; entre e8f99fb e b6c43a0 também entrou o merge a46591b da feature `car-handling`, tratado como raio de impacto; 7e7ca10 e b6c43a0 só mexem em docs de spec)
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

Resumo: a correção 09014ba fecha o único gap da rodada 2. `WorldPhysics` agora guarda os
colliders dos pilares em `pillars` (`src/world/WorldPhysics.ts:19`, `:57`). O teste de C27
monta um `WorldPhysics` num mundo Rapier real e lê de volta, para cada um dos 77 pilares, a
meia-extensão, a translação e a rotação (`tests/unit/bridges.test.ts:143-164`). As 5 faltas que
injetei no collider do pilar morreram, cada uma numa asserção diferente. Todas as provas passam
em `b6c43a0`: 99/99 unitários e 71/71 Playwright. A linha `Instrumentation, pass-throughs`
de `Test policy` passa a ser cumprida. O merge da `car-handling` não afrouxou nenhuma prova da
city-terrain. A contagem do teste de pureza subiu de 23 para 24 porque entrou `carSpec.ts`, e os
9 módulos da C45 continuam na lista (detalhe em C45).

Escopo desta rodada (verify.md, "Re-verifying after a fix"): rodei de novo todas as provas em
`b6c43a0`. Julguei de novo C27 e a linha de `Test policy` que não tinha sido cumprida. Atualizei
as citações dos arquivos tocados (`tests/unit/bridges.test.ts`, `tests/unit/purity.test.ts`,
`src/world/WorldPhysics.ts`). Também conferi os arquivos compartilhados que o merge da
`car-handling` tocou: `src/core/Game.ts`, `src/vehicle/Car.ts`, `vite.config.ts`,
`tests/e2e/drive.spec.ts`, `tests/e2e/hud.spec.ts` e `tests/unit/purity.test.ts`. Recalculei as
linhas de `Coverage` cuja autoridade foi tocada e injetei 5 faltas na superfície nova. O resto
vem de e8f99fb e está marcado como tal.

Revisão da correção e do merge:

- 09014ba não remove nenhum `expect`. A única linha removida de teste é o comentário enganoso
  que a rodada 2 apontou. Em `src`, a mudança só guarda a referência do collider que já era
  criado (`WorldPhysics.ts:51-57`): a mesma chamada `cuboid(PILLAR_SIZE / 2, h, PILLAR_SIZE / 2)`,
  com a mesma translação e a mesma rotação.
- A montagem do teste bate com a do jogo no caminho dos pilares. O jogo gera as estradas e as
  pontes a partir do terreno cru (`src/core/Game.ts:134-135`) e passa esse `raw` para
  `WorldPhysics` (`:140`), que monta os pilares com `bridgeParts(road, range, raw)`
  (`WorldPhysics.ts:45`). O teste usa o mesmo `hm` cru (`bridges.test.ts:9-10`, `:146`). O
  heightfield e os lotes diferem entre as duas montagens, mas não entram nos pilares.
- `a46591b` (car-handling) só acrescenta testes em `drive.spec.ts` (depois da linha 106) e em
  `hud.spec.ts` (depois da 146). As linhas citadas da city-terrain nesses arquivos não mudaram
  (`drive.spec.ts:69`, `:74`, `:82`, `:104-105`; `hud.spec.ts:121-122`). Em `Game.ts` o carro
  passa a ser montado com `DEFAULT_CAR` (`:146`) e `__game.car` ganhou getters novos, sem tocar em
  `__game.world`. `Car.ts` mudou a dinâmica do carro, então as provas de browser que dirigem
  (C7, C10, C28, C29, C42, C44) valem pelo que rodou agora em `b6c43a0`, não pela rodada 2.
  `vite.config.ts` só inclui `tests/physics/**` no vitest.
- Nenhuma prova da city-terrain está em `tests/physics`, a pasta que o merge incluiu no vitest.

## Binding sources

carried from e8f99fb - o plano não marca nenhuma fonte como binding, e nem a correção nem o
merge tocaram a interface. Com profile `standard` este passo não roda.

## Checks

verified at b6c43a0 (provas). Citações atualizadas em `tests/unit/bridges.test.ts` (tudo depois
da linha 2 desceu 2 linhas) e em `tests/unit/purity.test.ts`. As citações em `drive.spec.ts` e
`hud.spec.ts` foram conferidas nesta rodada e não mudaram. As dos outros arquivos, que não foram
tocados desde e8f99fb (`terrain.test.ts`, `worldMath.test.ts`, `roads.test.ts`,
`roadMesh.test.ts`, `lots.test.ts`, `chunks.test.ts`, `minimap.test.ts`, `world.spec.ts`,
`visual.spec.ts`, `render.spec.ts`), vêm de e8f99fb (mesmas linhas, arquivo inalterado:
`git diff e8f99fb..HEAD --stat` só lista `WorldPhysics.ts` em `src/world`).

Provas rodadas no worktree do Verifier em b6c43a0:

- `npx vitest run --reporter=verbose`: 27 arquivos, 99 passaram, 0 falharam. São 24 a mais que
  na rodada 2, e todos vêm da `car-handling` (`carSpec`, `drivetrain`, `effectsMath` e
  `tests/physics/*`). Os 31 testes nomeados da city-terrain aparecem cada um com ✓, e
  `deck rails and pillars` levou 691 ms, com o Rapier rodando.
- `E2E_PORT=5186 npx playwright test --reporter=list`: 71 passaram em 22.6 min, sem falha e
  sem retry. Não precisei rodar nenhum teste de novo isolado. São 3 a mais que na rodada 2, e
  todos vêm da `car-handling`. Os 21 testes de browser nomeados da city-terrain aparecem cada um
  com ✓.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | terreno determinístico; seed 1338 difere em ≥ 1000 amostras | vitest `terrain is deterministic by seed` ✓ | carried from e8f99fb: `tests/unit/terrain.test.ts:12`, `:17` `toBeGreaterThanOrEqual(1000)` | PASS |
| C2 | 769×769, 4 m, origem -1536, bilinear | vitest `769 x 769 samples every 4 m` ✓ | carried: `tests/unit/terrain.test.ts:22-27`, `:32`, `:38` | PASS |
| C3 | centro plano em [-0.01, 0.01] | vitest `downtown square is flat at 0` ✓ | carried: `tests/unit/terrain.test.ts:51`, `:55` | PASS |
| C4 | pico em [80, 140], ≥ 800 m da origem | vitest `hills peak between 80 and 140 m` ✓ | carried: `tests/unit/terrain.test.ts:68-71` | PASS |
| C5 | leito do rio ≤ -5 da borda norte até a baía | vitest `river bed runs from the north edge to the bay` ✓ | carried: `tests/unit/terrain.test.ts:85`, `:87-88`, `:82`, `:90` | PASS |
| C6 | baía z ≥ 1300 abaixo de -2 | vitest `bay below water level` ✓ | carried: `tests/unit/terrain.test.ts:101`, `:105` | PASS |
| C7 | carro solto 3 m acima fica em h ± 1.2 nos 5 pontos | pw `car rests on the terrain heightfield` ✓ | carried: `tests/e2e/world.spec.ts:65`, `:66` | PASS |
| C8 | raycast = heightAt ± 0.05; roadY + [0, 0.1] | pw `heightfield orientation matches the heightmap` ✓ | carried: `tests/e2e/world.spec.ts:102`, `:89`, `:120-121` | PASS |
| C9 | limiar -1.49/-1.5/-1.51; ponto mais próximo exaustivo | vitest `water reset threshold and nearest road point` ✓ | carried: `tests/unit/worldMath.test.ts:12-14`, `:36`, `:42` | PASS |
| C10 | na água: reposiciona parado, em pé, heading ± 5° | pw `falling in the water respawns on the nearest road` ✓ | carried: `tests/e2e/world.spec.ts:146`, `:148`, `:149`, `:151`, `:153` | PASS |
| C11 | água única em y -2, offset animado | pw `animated water plane at -2` ✓ | carried: `tests/e2e/world.spec.ts:163-168`, `:171` | PASS |
| C12 | rede determinística | vitest `road network is deterministic` ✓ | carried: `tests/unit/roads.test.ts:33-37` | PASS |
| C13 | `ROAD_SPECS` 4 tipos | vitest `road specs by kind` ✓ | carried: `tests/unit/roads.test.ts:44-51` | PASS |
| C14 | 1 highway fechada, raio [900, 1350] | vitest `one closed highway ring around downtown` ✓ | carried: `tests/unit/roads.test.ts:58`, `:60`, `:66-67`, `:71` | PASS |
| C15 | ≥ 6 avenidas cruzando o centro | vitest `six avenues cross downtown` ✓ | carried: `tests/unit/roads.test.ts:77`, `:87`, `:90-92` | PASS |
| C16 | ≥ 5 hill subindo ≥ 40 m | vitest `hill roads start on the network and climb 40 m` ✓ | carried: `tests/unit/roads.test.ts:99`, `:110`, `:117` | PASS |
| C17 | pontos a cada 2 m ± 0.05 | vitest `points every 2 m` ✓ | carried: `tests/unit/roads.test.ts:130` | PASS |
| C18 | rampa ≤ 10 % | vitest `grade at most 10 percent` ✓ | carried: `tests/unit/roads.test.ts:144` | PASS |
| C19 | hill: soma de abs(Δheading) ≥ π, passo ≤ 6° | vitest `hill roads curve` ✓ | carried: `tests/unit/roads.test.ts:155`, `:158` | PASS |
| C20 | carve: ± 0.3 sob a pista; degrau ≤ 1.5 na faixa (w/2, w/2+6] | vitest `carve flattens terrain under roads` ✓; vitest `carve bands: under the road, blend, outside and under a bridge` ✓ | carried from e8f99fb: `tests/unit/roads.test.ts:213`, `:228`, `:242`, `:247-248`, `:278`, `:285-293`, `:300`, `:308` | PASS |
| C21 | fita: ±w/2, +0.05, uv | vitest `road strip vertices and uvs` ✓ | carried: `tests/unit/roadMesh.test.ts:31-33`, `:36-38` | PASS |
| C22 | materiais de asfalto | pw `road materials use the asphalt set` ✓ | carried: `tests/e2e/world.spec.ts:178-184` | PASS |
| C23 | traço, borda, espaçamento 6 ± 0.25 | pw `lane marks drawn in the road shader` ✓ | carried: `tests/e2e/world.spec.ts:207-210` | PASS |
| C24 | postes `2·floor(L/40)`, a w/2+1.5, 40 ± 0.5, fora de ponte | vitest `lamp posts every 40 m on both sides` ✓ | carried: `tests/unit/roads.test.ts:372`, `:390`, `:391`, `:401`, `:408` | PASS |
| C46 | fita virada para cima; caixas de ponte para fora | vitest `road strip faces up and bridge boxes face out` ✓ | carried: `tests/unit/roadMesh.test.ts:60`, `:84` | PASS |
| C25 | 2 InstancedMesh de postes | pw `lamp posts are two instanced meshes` ✓ | carried: `tests/e2e/world.spec.ts:217-220` | PASS |
| C26 | ponto com água ou > 4 m está numa ponte; ponte tem 1 ponto assim; highway cruza o rio | vitest `bridge stretches where the road is high or over water` ✓ | refreshed at b6c43a0 (+2 linhas): `tests/unit/bridges.test.ts:24` throw `needs a bridge`, `:29`, `:41`; `markBridges` sintético `:63` `toEqual([{ from: 70, to: 130 }])`, `:67` `toEqual([{ from: 92, to: 108 }])`, `:69` `toEqual([])` | PASS |
| C27 | tabuleiro 0.8, guarda-corpos 1 m em ±w/2, pilares 1.5 × 1.5 a cada 24 ± 0.5 até o chão | vitest `deck rails and pillars` ✓ (Rapier real) | verified at b6c43a0: tabuleiro `tests/unit/bridges.test.ts:85-88`; guarda-corpos `:99`, `:100`, `:107`, `:110`; espaçamento `:114`; topo `:120`; base `:121`; seção da malha de render `:130` `toBeCloseTo(1.5, 3)`, `:132` diagonal; `:141` `expect(PILLAR_SIZE).toBe(1.5)`. Collider de física, lido do Rapier para cada pilar: `:148` `expect(physics.pillars.length).toBe(expected.length)` (77); `:152` `expect(he.x).toBeCloseTo(0.75, 4)`, `:153` `he.z` 0.75; `:154` `he.y` = `(top − bottom) / 2`; `:156-158` translação = `(x, (top + bottom) / 2, z)`; `:160` sem inclinação em x/z; `:162` yaw = heading ± 1e-4 | PASS (gap da rodada 2 fechado, 5 faltas mortas) |
| C28 | atravessa a ponte da highway | pw `car crosses the highway bridge on the deck` ✓ | carried: `tests/e2e/world.spec.ts:261`, `:268`, `:286` (rodou de novo com o `Car.ts` da car-handling) | PASS |
| C29 | guarda-corpo segura o carro | pw `guard rail keeps the car on the deck` ✓ | carried: `tests/e2e/world.spec.ts:310`, `:311` (rodou de novo com o `Car.ts` novo) | PASS |
| C30 | lotes determinísticos | vitest `lots are deterministic` ✓ | carried: `tests/unit/lots.test.ts:39-41` | PASS |
| C31 | torres no centro, casas fora; prédio dos 2 lados | vitest `towers downtown and houses on the hills` ✓ | carried: `tests/unit/lots.test.ts:48-52`, `:76` | PASS |
| C32 | footprint a ≥ w/2 + 2, fora da água | vitest `buildings keep off roads and water` ✓ | carried: `tests/unit/lots.test.ts:86`, `:90` | PASS |
| C33 | rotação = heading ± 1°; base = menor altura ± 0.01; malha começa na base e sobe `height` | vitest `buildings face their road and sit on the lowest corner` ✓; pw `buildings are four instanced facade meshes` ✓ | carried from e8f99fb: `tests/unit/lots.test.ts:118`, `:121`, `:124-125`; `tests/e2e/world.spec.ts:339-340`, `:344` | PASS |
| C34 | letreiros só no centro, paleta de 4 | vitest `neon signs only downtown with the 4-color palette` ✓ | carried: `tests/unit/lots.test.ts:136-140` | PASS |
| C35 | 4 malhas de fachada, soma = lotes | pw `buildings are four instanced facade meshes` ✓ | carried: `tests/e2e/world.spec.ts:321-323` | PASS |
| C36 | 899/901/1199/1201, 1 construção | vitest `chunk build and dispose rules` ✓ | carried: `tests/unit/chunks.test.ts:20`, `:23`, `:26`, `:28`, `:32-33` | PASS |
| C37 | após teleporte: ≤ 900 carregados, nada além de 1200, `maxBuildsInOneFrame` = 1 | pw `chunks stream around the car` ✓ | carried: `tests/e2e/world.spec.ts:359-361`, `:364`, `:366`, `:369` | PASS |
| C38 | draw calls ≤ 220 | pw `draw calls at most 220 across the world` ✓ | carried: `tests/e2e/render.spec.ts:53` | PASS |
| C39 | `ready` em até 30 s | pw `ready within 30 s at high quality` ✓ | carried: `tests/e2e/visual.spec.ts:399` | PASS |
| C40 | spawn numa avenida do centro | pw `spawn on a downtown avenue` ✓ | carried: `tests/e2e/world.spec.ts:382-385`, `:389` | PASS |
| C41 | minimapa: segmentos na janela; canvas com estrada e carro | vitest `road segments inside the 320 m window` ✓; pw `minimap draws roads and car` ✓ | carried: `tests/unit/minimap.test.ts:30`, `:36`; conferido em b6c43a0: `tests/e2e/hud.spec.ts:121-122` (inserção da car-handling começa em `:149`) | PASS |
| C42 | 4 paredes em ±1536 | pw `invisible walls at 1536` ✓ | conferido em b6c43a0: `tests/e2e/drive.spec.ts:82` `toEqual(['x-1:1536', ...])`, `:104-105` `toBeLessThanOrEqual(1536)` | PASS |
| C43 | espelho só em high | pw `reflector present only in high quality` ✓ | carried: `tests/e2e/visual.spec.ts:66`, `:70-74`, `:77` | PASS |
| C44 | cenários superados | pw `building blocks the chassis` ✓, `collision throws sparks` ✓, `gtao at half resolution` ✓, `landing door literals` ✓ | conferido em b6c43a0: `tests/e2e/drive.spec.ts:69`, `:74`; carried: `tests/e2e/visual.spec.ts:248`, `:365-369`; `tests/e2e/render.spec.ts:120` | PASS |
| C45 | os 9 módulos puros novos sem `three`/Rapier; lista de 14 para 23 | vitest `pure modules do not import three or rapier` ✓ | verified at b6c43a0: os 9 módulos da city-terrain em `tests/unit/purity.test.ts:22-30`, cada um passando por `:43` `expect(FORBIDDEN.test(source), rel).toBe(false)`; `:40` `expect(PURE_MODULES.length).toBe(24)` = as 23 do fim da city-terrain (`:7-30`) + `src/vehicle/carSpec.ts` (`:32`, car-handling C27) | PASS (o literal "23" do check foi superado pela car-handling; ver Resíduos) |

## Coverage

Recalculadas em b6c43a0 as linhas cuja autoridade a correção ou o merge tocaram: plan ACs
(AC 21), landing doors (door 6, e a door 3 pela lista de pureza), partes da ponte, pilares
(linha nova: os 77 do seed 1337) e módulos puros. As outras vêm de e8f99fb.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (36) - verified at b6c43a0 | `plan.md` Criteria | AC 21 C27: tabuleiro, guarda-corpos, espaçamento, seção de render (`bridges.test.ts:130-134`) e collider de física 1.5 × 1.5 de cada pilar (`:152-154`) · demais ACs como na rodada 2 (carried from e8f99fb, provas rodadas de novo em b6c43a0) | - |
| landing doors (9) - verified at b6c43a0 | `plan.md` Landing | door 6 "pilares cuboides de 1.5 m a cada 24 m até o terreno": cuboide de física `bridges.test.ts:152-158`, espaçamento `:114`, base `:121` · door 3 C45 (`purity.test.ts:22-30`, `:43`) · 1, 2, 4, 5, 7, 8, 9 carried from e8f99fb | - |
| bridge parts (3) - verified at b6c43a0 | door 6 / AC 21 | tabuleiro C27 `:85-88` · guarda-corpos C27 `:99-110`, C29 · pilares C27 render `:130-134` e collider `:148-162` | - |
| bridge pillars (77) - verified at b6c43a0 | `bridgeParts` sobre as 5 pontes do seed 1337, lido do teste (`bridges.test.ts:147`); o F5 mostra o total: "expected 72 to be 77" | cada pilar: meia-extensão `:152-154`, translação `:156-158`, rotação `:160-162`; contagem `:148` | - |
| pillar collider fields (3) - verified at b6c43a0 | `WorldPhysics.ts:52-54` (`cuboid`, `setTranslation`, `setRotation`) | meia-extensão `bridges.test.ts:152-154` (F1, F4 mortos) · translação `:156-158` (F2 morto) · rotação `:160-162` (F3 morto) | - |
| pure modules (24 no teste; 9 da city-terrain) - verified at b6c43a0 | lista de C45 + `tests/unit/purity.test.ts:6-33` | os 9 da city-terrain em `:22-30`, cada um em `:43` · contagem `:40` | - |
| door 6 bridge conditions (2) · `markBridges` decision rows (5) · carve bands (4) · facade instances (1224) · chunk disposal | carried from e8f99fb (`RoadGenerator.ts`, `carveRoads.ts`, `LotGenerator.ts`, `ChunkManager.ts` não mudaram); citações de `bridges.test.ts` +2 linhas: `:63`, `:67`, `:69` | como na rodada 2 | - |
| road kinds in `ROAD_SPECS` (4) · road kinds with buildings (3) · water reset threshold (3 edges) · chunk decisions (5) · terrain regions (4) · drop-test points (5) · bridges generated (5) | carried from e8f99fb | como na rodada 2 | - |
| road materials (2) · lane mark kinds (2) · draw-call locations (5) · walls (4) · minimap outcomes (2) · reflector levels (2) | carried from e8f99fb | como na rodada 2 | - |
| superseded free-roam (9) e visual (8) checks | carried from e8f99fb | como na rodada 2 | - |
| startup config (1 assembly) - verified at b6c43a0 | `src/core/Game.ts:134-140` (terreno cru, rede, carve, `WorldPhysics(this.world, carved, raw, network, lots)`); carro em `:146` com `DEFAULT_CAR` | C39, C40 rodaram contra esta montagem; o teste de C27 reproduz o caminho dos pilares (`raw` e `network` iguais) | - |

## Test policy rows

verified at b6c43a0 para a linha que não tinha sido cumprida (`Instrumentation, pass-throughs`) e
para a que classifica `bridges.ts`. "Decides, reached across a boundary" vem de e8f99fb
(`chunks.ts`, `worldMath.ts` e `minimapMath.ts` não foram tocados).

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/world/chunks.ts`, `src/world/worldMath.ts`, `src/hud/minimapMath.ts` | own layer C36, C9, C41 · boundary C37, C10, C41 | yes (carried from e8f99fb) |
| Decides, not reached across a boundary | `TerrainGenerator.ts` + `noise.ts`, `carveRoads.ts`, `RoadGenerator.ts` (`markBridges`), `bridges.ts` (`pillarBox`), `roadMesh.ts`, `LotGenerator.ts` (`facadeTransform`) | um caso afirmado por linha da tabela de decisão | yes - como na rodada 2; citações de `bridges.test.ts` atualizadas: `markBridges` água `:67`, alto `:63`, nenhum `:69`; seção do pilar `:130-134` |
| Entry point that decides nothing | nenhum arquivo do diff | accepted / rejected / error paths | n/a - nenhum arquivo nesta forma |
| Instrumentation, pass-throughs | `WorldPhysics.ts`, `ChunkManager.ts`, `Water.ts`, `CityScene.ts`, `Minimap.ts`, `Game.ts` | coberto pela prova do consumidor | yes - o collider do pilar, que faltava, agora é lido do Rapier por C27 (`bridges.test.ts:148-162`, 5 faltas mortas); `ChunkManager` dispose `world.spec.ts:369` e base da fachada `world.spec.ts:339-340` (carried from e8f99fb); heightfield, guarda-corpos e paredes por C8, C29, C42 |

## Faults injected

verified at b6c43a0. Worktree isolado `<scratchpad>/vt3` (`git worktree add --detach` em
b6c43a0, junction de `node_modules`). `git status --porcelain` do worktree do Verifier estava
vazio antes e continuou vazio depois. Cada mutação foi aplicada com `sed` sobre
`src/world/WorldPhysics.ts` e revertida copiando de volta o original salvo antes. No fim, o
porcelain do rascunho estava vazio, a junction foi removida sem recursão e o worktree foi removido
com `git worktree remove`. Prova usada em cada uma:
`npx vitest run tests/unit/bridges.test.ts -t "deck rails and pillars"`. As 5 faltas atacam os 3
campos do collider do pilar e o registro, e cada uma falhou numa asserção diferente.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 meia-extensão horizontal dobrada: `cuboid(PILLAR_SIZE, h, PILLAR_SIZE)` (o mutante que a rodada 2 disse que passaria) | `src/world/WorldPhysics.ts:52` | yes - `tests/unit/bridges.test.ts:152` "expected 1.5 to be close to 0.75" |
| F2 centro do pilar no topo: `setTranslation(p.x, p.top + h, p.z)` | `src/world/WorldPhysics.ts:53` | yes - `tests/unit/bridges.test.ts:157` "expected 8.889 to be close to 7.555" |
| F3 pilar sem girar: `setRotation(yaw(0))` | `src/world/WorldPhysics.ts:54` | yes - `tests/unit/bridges.test.ts:162` "expected 0.4879 to be less than 0.0001" |
| F4 meia altura: `cuboid(PILLAR_SIZE / 2, h / 2, PILLAR_SIZE / 2)` | `src/world/WorldPhysics.ts:52` | yes - `tests/unit/bridges.test.ts:154` "expected 0.3337 to be close to 0.6673" |
| F5 primeiro pilar de cada ponte sem collider: `for (const p of parts.pillars.slice(1))` | `src/world/WorldPhysics.ts:49` | yes - `tests/unit/bridges.test.ts:148` "expected 72 to be 77" |

Cap de 5 atingido. As faltas das rodadas 1 e 2 (F1 carve sem mistura, F2 ponte só sobre água,
seção do pilar de render, base da fachada, dispose de chunk, e da rodada 1 F3 heightfield sem
transpor, F4 tracejado 7 m, F5 guarda-corpo sem collider) são carried from e8f99fb: nenhuma
dessas linhas de `src` mudou desde lá, e as asserções que as mataram continuam no lugar (só
desceram 2 linhas em `bridges.test.ts`).

## Swept existing

carried from e8f99fb:

- failure modes: `new Game` dentro do `try` em `src/main.ts:27-38`.
- dependency failure: texturas ausentes seguem o caminho antigo, e `CityScene.ts` não mexeu nos
  materiais.
- data lifecycle, "malhas de chunk descartadas (dispose)": `tests/e2e/world.spec.ts:369` contra
  `src/world/ChunkManager.ts:67`.

## Gate

`npx vitest run` - 99 passed, 0 failed · `E2E_PORT=5186 npx playwright test` - 71 passed, 0 failed (22.6 min)

## Ranked gaps

Nenhum. O gap único da rodada 2 fechou:

| Gap da rodada 2 | Status em b6c43a0 | Evidência |
| --- | --- | --- |
| 1. Collider do pilar sem prova (C27, AC 21, door 6, linha Instrumentation) | fechado | `tests/unit/bridges.test.ts:148-162` lê os 77 colliders do Rapier; F1-F5 mortos em `:148`, `:152`, `:154`, `:157`, `:162` |

Resíduos (não mudam o veredito):

- Novos nesta rodada:
  - C45 diz que a lista "passa de 14 para 23", e a linha `pure modules (23 files)` do `Coverage`
    de `checks.md` também. Em b6c43a0 a asserção é `toBe(24)` (`tests/unit/purity.test.ts:40`)
    porque a `car-handling` C27 acrescentou `carSpec.ts`. O que a C45 exige continua valendo (os
    9 módulos na lista e puros), mas o literal de `checks.md` ficou histórico. Quem deve atualizar
    ou marcar isso como superado é a `car-handling`, não esta feature.
  - `tests/unit/bridges.test.ts` agora importa `@dimforge/rapier3d-compat` e `WorldPhysics`. O
    `AGENTS.md` descreve o vitest como "unitários, src puro". Nenhum check proíbe isso, e o teste
    de pureza só olha `src`, mas a pasta `tests/unit` deixou de ser só lógica pura (a
    `car-handling` separou esse tipo de teste em `tests/physics`).
  - `WorldPhysics.pillars` guarda 77 referências de collider também fora de DEV. É só registro:
    não muda o que é criado.
  - O yaw do collider é comparado ao `heading` do pilar, e a malha de render (`pillarBox`,
    `src/world/roads/bridges.ts:136`) gira pela mesma convenção (`x + a·cos + b·sin`,
    `z − a·sin + b·cos`, igual ao quaternion `(0, sin(h/2), 0, cos(h/2))` de
    `WorldPhysics.ts:94-95`). Nenhum teste compara as duas diretamente.
- carried from e8f99fb: C46 e C21 amostram algumas pontes e estradas; `street` nunca é gerado;
  `maxBuildsInOneFrame` vem da saída do plano; o snapshot de C10 é lido no mesmo passo do
  teleporte; "Gerando cidade..." não tem check; o ramo que junta intervalos adjacentes em
  `markBridges` (`RoadGenerator.ts:200`) não tem caso sintético; o registro `dropped` e os
  listeners de `dispose` de `ChunkManager` rodam também fora de DEV.
