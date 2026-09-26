# City terrain verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 307ce8c..e8f99fb (rodada 1: 307ce8c..3b76758; correção: 3b76758..e8f99fb, commits 2113102, 6b4e6f2, fa032ad, fa77592, c2a5256 no merge e8f99fb; db836b8 só mexe em docs de spec)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Resumo: a correção fecha 4 dos 5 gaps da rodada 1 e as duas linhas de `Test policy` que não
tinham sido cumpridas estão cumpridas agora. Os mutantes F1 (carve sem mistura) e F2 (ponte só
sobre água) morrem, e as 3 superfícies novas (tamanho do pilar, base da fachada, dispose de chunk)
também morreram quando recebi uma falta. Todas as provas passam em `e8f99fb`: 75/75 unitários e
68/68 Playwright. O FAIL que sobra é um resto do gap 3 da rodada 1. O pilar de 1.5 × 1.5 da AC 21
e da door 6 agora está provado na malha de render (`pillarBox`) e na constante. O **collider** do
pilar (`RAPIER.ColliderDesc.cuboid(PILLAR_SIZE / 2, h, PILLAR_SIZE / 2)`,
`src/world/WorldPhysics.ts:50`) não tem nenhuma prova. O comentário em
`tests/unit/bridges.test.ts:139` diz que ele está coberto, mas a asserção logo abaixo (`:140`) só
fixa `PILLAR_SIZE`. Um collider com `PILLAR_SIZE` no lugar de `PILLAR_SIZE / 2` passaria na
suíte inteira.

Escopo desta rodada (verify.md, "Re-verifying after a fix"): rodei de novo todas as provas em
`e8f99fb`. Julguei de novo cada veredito que não era PASS na rodada 1 (C20 e C26 com precision
gap, C27 e C33 PARTIAL, a door 7 sem prova, 2 linhas de `Test policy`). Atualizei as citações dos
arquivos tocados (`tests/unit/roads.test.ts`, `bridges.test.ts`, `lots.test.ts`,
`tests/e2e/world.spec.ts`) e recalculei as linhas de `Coverage` cuja autoridade a correção tocou.
Por fim, injetei 5 faltas nas superfícies tocadas ou criadas. O resto vem de 3b76758 e está
marcado como tal.

Revisão da correção: nenhuma asserção antiga foi removida nem afrouxada.
`git diff 3b76758..e8f99fb -- tests` não remove nenhuma linha com `expect`. As linhas removidas
são imports e a janela de varredura de `carve flattens`, onde `cross` continua com exatamente as
amostras a `d <= reach` (`tests/unit/roads.test.ts:205`), e as amostras de fora vão para o
`beyond` novo. O `src` novo não muda o que roda:

- `pillarBox` foi movido sem mudança de `ChunkManager.ts` para `src/world/roads/bridges.ts:129`
  (corpo idêntico ao removido).
- `facadeTransform` (`src/world/lots/LotGenerator.ts:78`) devolve a mesma conta que
  `CityScene.ts:166` fazia (`l.y + l.height / 2`, `rotation − π/2`).
- `ChunkManager` ganhou um contador de `dispose` por grupo (`src/world/ChunkManager.ts:147-153`)
  e uma lista `dropped` limitada a 64 (`:63-64`). Os dois rodam também em produção, sem porta
  DEV, mas são só registro: não muda nada do que é construído ou descartado.
- `facadeSpans` e `chunks.dropped` ficam no `debugHandle` (`src/core/Game.ts:358`, `:773`), que
  só chega a `window.__game` via `exposeDebug(import.meta.env, ...)` (`src/main.ts:42`).

## Binding sources

carried from 3b76758 - o plano não marca nenhuma fonte como binding, e a correção não tocou a
interface. Com profile `standard` este passo não roda.

## Checks

verified at e8f99fb (provas). Citações atualizadas nos 4 arquivos de teste tocados. As citações
em arquivos que a correção não tocou (`terrain.test.ts`, `worldMath.test.ts`, `roadMesh.test.ts`,
`chunks.test.ts`, `minimap.test.ts`, `purity.test.ts`, `drive.spec.ts`, `visual.spec.ts`,
`render.spec.ts`, `hud.spec.ts`) vêm de 3b76758 (mesmas linhas, arquivo inalterado).

Provas rodadas no worktree do Verifier em e8f99fb:

- `npx vitest run --reporter=verbose`: 22 arquivos, 75 passaram, cada teste nomeado aparece com ✓.
  É um a mais que na rodada 1: `carve bands: under the road, blend, outside and under a bridge`.
- `E2E_PORT=5184 npx playwright test --reporter=list`: 68 passaram em 19.6 min, sem falha, sem
  retry e sem rodar de novo nenhum teste isolado. Os 21 testes de browser nomeados aparecem com ✓.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | terreno determinístico; seed 1338 difere em ≥ 1000 amostras | vitest `terrain is deterministic by seed` ✓ | carried from 3b76758: `tests/unit/terrain.test.ts:12`, `:17` `toBeGreaterThanOrEqual(1000)` | PASS |
| C2 | 769×769, 4 m, origem -1536, bilinear | vitest `769 x 769 samples every 4 m` ✓ | carried: `tests/unit/terrain.test.ts:22-27`, `:32`, `:38` | PASS |
| C3 | centro plano em [-0.01, 0.01] | vitest `downtown square is flat at 0` ✓ | carried: `tests/unit/terrain.test.ts:51`, `:55` | PASS |
| C4 | pico em [80, 140], ≥ 800 m da origem | vitest `hills peak between 80 and 140 m` ✓ | carried: `tests/unit/terrain.test.ts:68-71` | PASS |
| C5 | leito do rio ≤ -5 da borda norte até a baía | vitest `river bed runs from the north edge to the bay` ✓ | carried: `tests/unit/terrain.test.ts:85`, `:87-88`, `:82`, `:90` | PASS |
| C6 | baía z ≥ 1300 abaixo de -2 | vitest `bay below water level` ✓ | carried: `tests/unit/terrain.test.ts:101`, `:105` | PASS |
| C7 | carro solto 3 m acima fica em h ± 1.2 nos 5 pontos | pw `car rests on the terrain heightfield` ✓ | `tests/e2e/world.spec.ts:65`, `:66` (linhas antes da inserção em `:324`, inalteradas) | PASS |
| C8 | raycast = heightAt ± 0.05; roadY + [0, 0.1] | pw `heightfield orientation matches the heightmap` ✓ | `tests/e2e/world.spec.ts:102`, `:89`, `:120-121` | PASS |
| C9 | limiar -1.49/-1.5/-1.51; ponto mais próximo exaustivo | vitest `water reset threshold and nearest road point` ✓ | carried: `tests/unit/worldMath.test.ts:12-14`, `:36`, `:42` | PASS |
| C10 | na água: reposiciona parado, em pé, heading ± 5° | pw `falling in the water respawns on the nearest road` ✓ | `tests/e2e/world.spec.ts:146`, `:148`, `:149`, `:151`, `:153` | PASS |
| C11 | água única em y -2, offset animado | pw `animated water plane at -2` ✓ | `tests/e2e/world.spec.ts:163-168`, `:171` | PASS |
| C12 | rede determinística | vitest `road network is deterministic` ✓ | `tests/unit/roads.test.ts:33-37` (antes da primeira inserção, `:167`) | PASS |
| C13 | `ROAD_SPECS` 4 tipos | vitest `road specs by kind` ✓ | `tests/unit/roads.test.ts:44-51` | PASS |
| C14 | 1 highway fechada, raio [900, 1350] | vitest `one closed highway ring around downtown` ✓ | `tests/unit/roads.test.ts:58`, `:60`, `:66-67`, `:71` | PASS |
| C15 | ≥ 6 avenidas cruzando o centro | vitest `six avenues cross downtown` ✓ | `tests/unit/roads.test.ts:77`, `:87`, `:90-92` | PASS |
| C16 | ≥ 5 hill subindo ≥ 40 m | vitest `hill roads start on the network and climb 40 m` ✓ | `tests/unit/roads.test.ts:99`, `:110`, `:117` | PASS |
| C17 | pontos a cada 2 m ± 0.05 | vitest `points every 2 m` ✓ | `tests/unit/roads.test.ts:130` | PASS |
| C18 | rampa ≤ 10 % | vitest `grade at most 10 percent` ✓ | `tests/unit/roads.test.ts:144` | PASS |
| C19 | hill: Σ\|Δheading\| ≥ π, passo ≤ 6° | vitest `hill roads curve` ✓ | `tests/unit/roads.test.ts:155`, `:158` | PASS |
| C20 | carve: ± 0.3 sob a pista; degrau ≤ 1.5 na faixa (w/2, w/2+6] | vitest `carve flattens terrain under roads` ✓; vitest `carve bands: under the road, blend, outside and under a bridge` ✓ | verified at e8f99fb: `tests/unit/roads.test.ts:213` `Math.abs(h - py) > 0.3` throw; `:228` degrau na faixa; `:220` par que cruza w/2; `:235` par que cruza w/2 + 6; `:242` mistura entre `py` e a altura crua; `:247-248` formato (1.º quarto ≤ 0.5, último ≥ 0.5); `:257-259` contagens > 100/100/20; caso sintético `:278` sob a pista, `:285-293` mistura estrita e crescente, `:296` chega ao terreno, `:300` fora intacto, `:308` sob ponte intacto | PASS (F1 morto) |
| C21 | fita: ±w/2, +0.05, uv | vitest `road strip vertices and uvs` ✓ | carried: `tests/unit/roadMesh.test.ts:31-33`, `:36-38` | PASS |
| C22 | materiais de asfalto | pw `road materials use the asphalt set` ✓ | `tests/e2e/world.spec.ts:178-184` | PASS |
| C23 | traço, borda, espaçamento 6 ± 0.25 | pw `lane marks drawn in the road shader` ✓ | `tests/e2e/world.spec.ts:207-210` | PASS |
| C24 | postes `2·floor(L/40)`, a w/2+1.5, 40 ± 0.5, fora de ponte | vitest `lamp posts every 40 m on both sides` ✓ | refreshed: `tests/unit/roads.test.ts:372` `toBe(expected)`; `:390` w/2+1.5; `:391` fora de ponte; `:401` `toBe(!kept)`; `:408` 40 ± 0.5 | PASS |
| C46 | fita virada para cima; caixas de ponte para fora | vitest `road strip faces up and bridge boxes face out` ✓ | carried: `tests/unit/roadMesh.test.ts:60`, `:84` | PASS |
| C25 | 2 InstancedMesh de postes | pw `lamp posts are two instanced meshes` ✓ | `tests/e2e/world.spec.ts:217-220` | PASS |
| C26 | ponto com água ou > 4 m está numa ponte; ponte tem 1 ponto assim; highway cruza o rio | vitest `bridge stretches where the road is high or over water` ✓ | verified at e8f99fb: `tests/unit/bridges.test.ts:22` throw `needs a bridge`, `:27`, `:39`; casos sintéticos de `markBridges`: `:61` viaduto sobre vale seco `toEqual([{ from: 70, to: 130 }])`, `:65` só água `toEqual([{ from: 92, to: 108 }])`, `:67` nenhum `toEqual([])` | PASS (F2 morto) |
| C27 | tabuleiro 0.8, guarda-corpos 1 m em ±w/2, pilares 1.5 × 1.5 a cada 24 ± 0.5 até o chão | vitest `deck rails and pillars` ✓ | verified at e8f99fb: `tests/unit/bridges.test.ts:83-86` tabuleiro, `:90`, `:97-98`, `:105`, `:108` guarda-corpos, `:112` 24 ± 0.5, `:118` topo, `:119` base, `:128` `toBeCloseTo(1.5, 3)` por aresta de `pillarBox`, `:130` diagonal `1.5 * Math.SQRT2`, `:131-132` centrado, `:140` `expect(PILLAR_SIZE).toBe(1.5)` | PASS (o check fala do módulo puro; o collider do pilar fica em Coverage) |
| C28 | atravessa a ponte da highway | pw `car crosses the highway bridge on the deck` ✓ | `tests/e2e/world.spec.ts:261`, `:268`, `:286` | PASS |
| C29 | guarda-corpo segura o carro | pw `guard rail keeps the car on the deck` ✓ | `tests/e2e/world.spec.ts:310`, `:311` | PASS |
| C30 | lotes determinísticos | vitest `lots are deterministic` ✓ | `tests/unit/lots.test.ts:39-41` | PASS |
| C31 | torres no centro, casas fora; prédio dos 2 lados | vitest `towers downtown and houses on the hills` ✓ | `tests/unit/lots.test.ts:48-52`, `:76` | PASS |
| C32 | footprint a ≥ w/2 + 2, fora da água | vitest `buildings keep off roads and water` ✓ | `tests/unit/lots.test.ts:86`, `:90` | PASS |
| C33 | rotação = heading ± 1°; base = menor altura ± 0.01; malha começa na base e sobe `height` | vitest `buildings face their road and sit on the lowest corner` ✓; pw `buildings are four instanced facade meshes` ✓ | verified at e8f99fb: `tests/unit/lots.test.ts:118`, `:121`; `:124` `t.position[1] - t.scale[1] / 2` `toBeCloseTo(l.y, 4)`, `:125` topo `l.y + l.height`; na malha real: `tests/e2e/world.spec.ts:339` `Math.abs(lo - l.y) <= 0.01`, `:340` `Math.abs(hi - (l.y + l.height)) <= 0.01`, `:344` `expect(checked).toBe(r.lots)` (as 1224 instâncias) | PASS |
| C34 | letreiros só no centro, paleta de 4 | vitest `neon signs only downtown with the 4-color palette` ✓ | refreshed: `tests/unit/lots.test.ts:136-140` | PASS |
| C35 | 4 malhas de fachada, soma = lotes | pw `buildings are four instanced facade meshes` ✓ | `tests/e2e/world.spec.ts:321-323` | PASS |
| C36 | 899/901/1199/1201, 1 construção | vitest `chunk build and dispose rules` ✓ | carried: `tests/unit/chunks.test.ts:20`, `:23`, `:26`, `:28`, `:32-33` | PASS |
| C37 | após teleporte: ≤ 900 carregados, nada além de 1200, `maxBuildsInOneFrame` = 1 | pw `chunks stream around the car` ✓ | refreshed: `tests/e2e/world.spec.ts:359-361`; door 7 dispose: `:364` `dropped.length > 0`, `:366` `dist > 1200`, `:369` `expect(d.disposed).toBe(d.geometries)` | PASS |
| C38 | draw calls ≤ 220 | pw `draw calls at most 220 across the world` ✓ | carried: `tests/e2e/render.spec.ts:53` | PASS |
| C39 | `ready` em até 30 s | pw `ready within 30 s at high quality` ✓ | carried: `tests/e2e/visual.spec.ts:399` | PASS |
| C40 | spawn numa avenida do centro | pw `spawn on a downtown avenue` ✓ | refreshed: `tests/e2e/world.spec.ts:382-385`, `:389` heading `< 5°` | PASS |
| C41 | minimapa: segmentos na janela; canvas com estrada e carro | vitest `road segments inside the 320 m window` ✓; pw `minimap draws roads and car` ✓ | carried: `tests/unit/minimap.test.ts:30`, `:36`; `tests/e2e/hud.spec.ts:121-122` | PASS |
| C42 | 4 paredes em ±1536 | pw `invisible walls at 1536` ✓ | carried: `tests/e2e/drive.spec.ts:82`, `:104-105` | PASS |
| C43 | espelho só em high | pw `reflector present only in high quality` ✓ | carried: `tests/e2e/visual.spec.ts:66`, `:70-74`, `:77` | PASS |
| C44 | cenários superados | pw `building blocks the chassis` ✓, `collision throws sparks` ✓, `gtao at half resolution` ✓, `landing door literals` ✓ | carried: `tests/e2e/drive.spec.ts:69`, `:74`; `tests/e2e/visual.spec.ts:248`, `:365-369`; `tests/e2e/render.spec.ts:120` | PASS |
| C45 | 23 módulos puros | vitest `pure modules do not import three or rapier` ✓ | carried: `tests/unit/purity.test.ts:38`, `:41` (`bridges.ts` e `LotGenerator.ts` continuam puros com `pillarBox` e `facadeTransform`) | PASS |

## Coverage

Recalculadas em e8f99fb as linhas cuja autoridade a correção tocou: plan ACs (17, 21, 27, 30),
landing doors (5, 6, 7), condições de ponte da door 6, faixas do carve, partes da ponte, a tabela
de decisão de `markBridges` (linha nova) e instâncias de fachada (linha nova). As outras são
carried from 3b76758.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (36) - verified at e8f99fb | `plan.md` Criteria | AC 17 C20 (`roads.test.ts:220`, `:235`, `:242`, `:247-248`, `:285-296`) · AC 21 C27: tabuleiro, guarda-corpos, espaçamento e seção 1.5 × 1.5 da malha de render (`bridges.test.ts:128-132`) · AC 27 C33 (`lots.test.ts:124-125`, `world.spec.ts:339-340`) · AC 30 C36, C37 + dispose (`world.spec.ts:369`) · demais ACs como na rodada 1 | AC 21: collider do pilar 1.5 × 1.5 (`src/world/WorldPhysics.ts:50` `cuboid(PILLAR_SIZE / 2, h, PILLAR_SIZE / 2)`; `rg -i "pillar\|cuboid" tests` só acha `tests/unit/bridges.test.ts`, que não lê collider nenhum; `:140` fixa só a constante) |
| landing doors (9) - verified at e8f99fb | `plan.md` Landing | 1-4, 8, 9 carried · 5 C18, C20 com mistura suave (F1 morto) · 6 C26 com viaduto sobre vale seco (`bridges.test.ts:61`, F2 morto), C27 · 7 C36, C37 com "dispose de geometria" (`world.spec.ts:369`, falta morta) | door 6 "pilares cuboides de 1.5 m": o cuboide de física (`WorldPhysics.ts:50`) sem prova |
| door 6 bridge conditions (2) - verified at e8f99fb | door 6 literal | cruza água `bridges.test.ts:65` + C26 no seed · > 4 m sobre terreno seco `bridges.test.ts:61` (vale mínimo em 2 m, acima da água) | - |
| `markBridges` decision rows (5) - verified at e8f99fb | `RoadGenerator.ts:179-205` | água `:65` · alto `:61` · extensão até ≤ 1.5 m (i 73..127 / 95..105) `:61`, `:65` · folga de 3 pontos `:61`, `:65` · nenhum `:67` (sem extensão ou sem folga os intervalos esperados mudam) | - |
| carve bands (4) - verified at e8f99fb | `carveRoads.ts:55-64` + door 5 | sob a pista `roads.test.ts:278`, `:213` · mistura `:285-296`, `:242`, `:247-248` · fora `:300`, `:342` (> 500 000 amostras, `:344`) · sob ponte `:308`, `:342` com `underBridge > 500` `:345` | - |
| bridge parts (3) - verified at e8f99fb | door 6 / AC 21 | tabuleiro C27 · guarda-corpos C27, C29 · pilares C27 (espaçamento, topo, base, seção de render 1.5 × 1.5) | pilares: tamanho e posição do collider (`WorldPhysics.ts:48-53`) |
| facade instances (1224) - verified at e8f99fb | lotes do seed 1337 via `__game.world.lots` | `world.spec.ts:339-340` por instância, `:344` conta = lotes | - |
| chunk disposal (dropped chunks) - verified at e8f99fb | door 7 + `ChunkManager.ts:61-69` | `world.spec.ts:364-369` para cada chunk descartado depois do teleporte | - |
| road kinds in `ROAD_SPECS` (4) | carried from 3b76758 | highway, avenue, hill, street C13 | - |
| road kinds with buildings (3) | carried from 3b76758 | avenue, hill C31 · street vácuo | - |
| water reset threshold (3 edges) | carried from 3b76758 | `tests/unit/worldMath.test.ts:12-14` | - |
| chunk decisions (5) | carried from 3b76758 (`chunks.ts` não foi tocado) | `tests/unit/chunks.test.ts:20-33` | - |
| terrain regions (4) | carried from 3b76758 | C3, C4, C5, C6 | - |
| drop-test points (5) | carried from 3b76758 | `tests/e2e/world.spec.ts:54-66` | - |
| bridges generated (5) | carried from 3b76758 | C26 e C27 as 5 | - |
| road materials (2) · lane mark kinds (2) · draw-call locations (5) · walls (4) · minimap outcomes (2) · reflector levels (2) | carried from 3b76758 | como na rodada 1 | - |
| pure modules (23) | carried from 3b76758; a correção não criou arquivo | `tests/unit/purity.test.ts:38` | - |
| superseded free-roam (9) e visual (8) checks | carried from 3b76758 | como na rodada 1 | - |
| startup config (1 assembly) | carried from 3b76758 | `src/main.ts:32`; C39, C40 | - |

## Test policy rows

verified at e8f99fb para as duas linhas que não tinham sido cumpridas e para as que classificam
arquivos tocados. "Decides, reached across a boundary" vem de 3b76758 (`chunks.ts`,
`worldMath.ts` e `minimapMath.ts` não foram tocados).

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/world/chunks.ts`, `src/world/worldMath.ts`, `src/hud/minimapMath.ts` | own layer C36, C9, C41 · boundary C37, C10, C41 | yes (carried from 3b76758) |
| Decides, not reached across a boundary | `TerrainGenerator.ts` + `noise.ts`, `carveRoads.ts`, `RoadGenerator.ts` (`markBridges`), `bridges.ts` (`pillarBox`), `roadMesh.ts`, `LotGenerator.ts` (`facadeTransform`) | um caso afirmado por linha da tabela de decisão | yes - carve: sob `roads.test.ts:278` / mistura `:285-296` / fora `:300` / sob ponte `:308`; `markBridges`: água `bridges.test.ts:65`, alto `:61`, extensão e folga `:61`, `:65`, nenhum `:67`; `bridges.ts` seção do pilar `:128-132`; `facadeTransform` `lots.test.ts:124-125` |
| Entry point that decides nothing | nenhum arquivo do diff | accepted / rejected / error paths | n/a - nenhum arquivo nesta forma |
| Instrumentation, pass-throughs | `WorldPhysics.ts`, `ChunkManager.ts`, `Water.ts`, `CityScene.ts`, `Minimap.ts`, `Game.ts` | coberto pela prova do consumidor | not met - `ChunkManager` dispose está coberto agora (`world.spec.ts:369`, falta morta) e a base da malha de `CityScene` também (`world.spec.ts:339-340`, falta morta). Mas o collider do pilar em `WorldPhysics.ts:50` não tem consumidor que o afirme: nenhum teste lê os colliders de pilar e `bridges.test.ts:140` só fixa `PILLAR_SIZE` |

## Faults injected

verified at e8f99fb. Worktree isolado `<scratchpad>/vt2` (`git worktree add` em e8f99fb, junction
de `node_modules`). O Playwright rodou com `E2E_PORT=5184` depois que o servidor da suíte cheia
caiu (conferi a porta fechada antes). `git status --porcelain` do worktree do Verifier estava vazio
antes e continuou vazio depois. Cada mutação foi revertida com `git checkout -- .`, e o worktree de
rascunho foi conferido limpo e removido com `git worktree remove`. As faltas 4 e 5 rodaram juntas
num único `playwright test -g`: cada uma só afeta o próprio teste (lote × chunk), e cada teste
falhou na asserção da sua falta.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 carve sem mistura: `s = t >= 1 ? 1 : 0` | `src/world/terrain/carveRoads.ts:62` | yes - `carve flattens`: `tests/unit/roads.test.ts:242` "blend 12.047 outside [12.39, 12.549]"; `carve bands`: `:287` "x 6: expected 0 to be greater than 0" |
| F2 ponte só sobre água: `cond.push(h < WATER_Y)` | `src/world/roads/RoadGenerator.ts:185` | yes - `tests/unit/bridges.test.ts:61` "expected [] to deeply equal [ { from: 70, to: 130 } ]" |
| pilar de render com seção 1.2 m: `s = PILLAR_SIZE / 2.5` | `src/world/roads/bridges.ts:130` | yes - `tests/unit/bridges.test.ts:128` "expected 1.19998 to be close to 1.5" |
| fachada com centro na altura do topo: `position: [l.x, l.y + l.height, l.z]` | `src/world/lots/LotGenerator.ts:84` | yes - unit `tests/unit/lots.test.ts:124` "mesh base: expected 12.52 to be close to 8.40"; pw `tests/e2e/world.spec.ts:339` "facade 0 instance 0 at -832.3,-309.4 base", 7.60 > 0.01 (lê `getMatrixAt` das malhas reais) |
| chunk descartado sem `geometry.dispose()` | `src/world/ChunkManager.ts:67` | yes - `tests/e2e/world.spec.ts:369` "dropped chunk 21 geometries disposed: expected 4, received 0" |

Cap de 5 atingido. Da rodada 1 vêm F3 (heightfield sem transpor), F4 (tracejado 7 m) e F5
(guarda-corpo sem collider), todos mortos, carried from 3b76758 (`WorldPhysics.ts` e
`CityScene.ts:321` não foram tocados nessas linhas). Sem falta própria, só mostrado por busca: o
collider do pilar (`WorldPhysics.ts:50`). Nenhum teste lê esse collider, então uma troca para
`cuboid(PILLAR_SIZE, h, PILLAR_SIZE)` não tem asserção capaz de falhar.

## Swept existing

carried from 3b76758, com uma atualização:

- failure modes: `new Game` dentro do `try` em `src/main.ts:27-38` (carried).
- dependency failure: texturas ausentes seguem o caminho antigo, e `CityScene.ts` não mexeu nos
  materiais (carried).
- data lifecycle, "malhas de chunk descartadas (dispose)": verified at e8f99fb, agora provado,
  `tests/e2e/world.spec.ts:369` contra `src/world/ChunkManager.ts:67`.

## Gate

`npx vitest run` - 75 passed, 0 failed · `E2E_PORT=5184 npx playwright test` - 68 passed, 0 failed (19.6 min)

## Ranked gaps

1. Collider do pilar sem prova (resto do gap 3 da rodada 1; AC 21, door 6, linha
   Instrumentation). `src/world/WorldPhysics.ts:50` monta o cuboide com meia-extensão
   `PILLAR_SIZE / 2`, mas só a malha de render (`pillarBox`) e a constante são afirmadas
   (`tests/unit/bridges.test.ts:128-132`, `:140`). O comentário de `bridges.test.ts:139` diz que
   cobre o collider e não cobre. Falta ler a meia-extensão e a posição dos colliders de pilar
   (por exemplo via `__game`), ou tirar a conta do collider para uma função pura afirmada.

Status dos gaps da rodada 1:

| Gap da rodada 1 | Status em e8f99fb | Evidência |
| --- | --- | --- |
| 1. F1 sobrevive (C20 mistura) | fechado | F1 morto em `tests/unit/roads.test.ts:242` e `:287` |
| 2. F2 equivalente (viaduto em vale seco) | fechado | F2 morto em `tests/unit/bridges.test.ts:61` |
| 3. C27 tamanho do pilar | parcial | render e constante provados em `tests/unit/bridges.test.ts:128-132` e `:140`; collider sem prova em `src/world/WorldPhysics.ts:50` |
| 4. C33 base da malha | fechado | `tests/unit/lots.test.ts:124-125`, `tests/e2e/world.spec.ts:339-340`, falta morta nas duas |
| 5. door 7 dispose de geometria | fechado | `tests/e2e/world.spec.ts:369`, falta morta |

Resíduos (não mudam o veredito):

- carried from 3b76758: C46 e C21 amostram algumas pontes e estradas; `street` nunca é gerado;
  `maxBuildsInOneFrame` vem da saída do plano; o snapshot de C10 é lido no mesmo passo do
  teleporte; "Gerando cidade..." não tem check.
- Novos:
  - o ramo que junta intervalos adjacentes em `markBridges` (`RoadGenerator.ts:200`) não tem
    caso sintético. Não é uma linha da door 6.
  - o registro `dropped` e os listeners de `dispose` em `ChunkManager` rodam também fora de DEV
    (64 entradas e 1 listener por geometria, sem efeito no que é construído).
