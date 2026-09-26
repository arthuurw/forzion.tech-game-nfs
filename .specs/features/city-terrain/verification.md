# City terrain verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 307ce8c..3b76758 (main, merge de 157cd02..f080e65 do branch `city-terrain`)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Resumo: as 48 provas nomeadas existem e passam em `HEAD` (74/74 unitários, 68/68 Playwright), e
43 dos 46 checks estão provados como escritos. O FAIL vem de 2 mutantes sobreviventes (C20 blend,
C26 viaduto), de 2 checks com uma parte da afirmação sem nenhuma asserção (C27 tamanho do pilar,
C33 base da malha do prédio), de 1 efeito colateral da door 7 sem prova (dispose de geometria) e
de 2 linhas de `Test policy` que não foram cumpridas.

## Binding sources

O plano não marca nenhuma fonte como binding (as `Sources` são o pedido do usuário, o `.d.ts` do
Rapier e os checks antigos, lidos como contexto). Com profile `standard` este passo não roda.

## Checks

Provas rodadas no worktree de rascunho em 3b76758: `npx vitest run` (22 arquivos, 74 passaram,
cada teste nomeado aparece com ✓ na saída verbose) e `E2E_PORT=5178 npx playwright test` (68
passaram em 15.1 min, cada um dos 21 testes de browser nomeados aparece com ✓).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | terreno determinístico; seed 1338 difere em ≥ 1000 amostras | vitest `terrain is deterministic by seed` ✓ | `tests/unit/terrain.test.ts:12` - `if (again.heights[i] !== hm.heights[i]) throw`; `:17` - `expect(differ).toBeGreaterThanOrEqual(1000)` | PASS |
| C2 | 769×769, 4 m, origem -1536, bilinear | vitest `769 x 769 samples every 4 m` ✓ | `tests/unit/terrain.test.ts:22-27` - size/spacing/origin/591361/sampleXZ; `:32` exato na grade; `:38` `toBeCloseTo((a+b+c+d)/4, 5)` | PASS |
| C3 | centro plano em [-0.01, 0.01] | vitest `downtown square is flat at 0` ✓ | `tests/unit/terrain.test.ts:51` - `if (h < -0.01 \|\| h > 0.01) throw`; `:55` `toBe(251 * 251)` | PASS |
| C4 | pico em [80, 140], ≥ 800 m da origem | vitest `hills peak between 80 and 140 m` ✓ | `tests/unit/terrain.test.ts:68-71` | PASS |
| C5 | leito do rio ≤ -5 da borda norte até a baía, `riverCenterX > 500` | vitest `river bed runs from the north edge to the bay` ✓ | `tests/unit/terrain.test.ts:85` - `if (h > -5) throw`; `:87-88` linhas -1536 e 1300; `:82`, `:90` `> 500` | PASS |
| C6 | baía z ≥ 1300 abaixo de -2 | vitest `bay below water level` ✓ | `tests/unit/terrain.test.ts:101` - `if (!(h < -2)) throw`; `:105` `60 * 769` | PASS |
| C7 | carro solto 3 m acima fica em h ± 1.2 nos 5 pontos | pw `car rests on the terrain heightfield` ✓ | `tests/e2e/world.spec.ts:65` - `expect(min).toBeGreaterThanOrEqual(p.h - 1.2)`; `:66` `abs(end.y - p.h) <= 1.2` | PASS |
| C8 | raycast = heightAt ± 0.05 em 20 pontos (4 por canto), roadY + [0, 0.1] em 10 | pw `heightfield orientation matches the heightmap` ✓ | `tests/e2e/world.spec.ts:102` - `abs(p.ray - p.h) <= 0.05`; `:89` 4 por canto; `:120-121` `[h.y, h.y + 0.1]` | PASS |
| C9 | limiar -1.49/-1.5/-1.51; ponto mais próximo = busca exaustiva em 200 posições | vitest `water reset threshold and nearest road point` ✓ | `tests/unit/worldMath.test.ts:12-14`; `:36` `toEqual([bestRoad, bestIndex])`; `:42` heading | PASS |
| C10 | na água: reposiciona 1 m acima do ponto mais próximo, parado, em pé, heading ± 5° | pw `falling in the water respawns on the nearest road` ✓ | `tests/e2e/world.spec.ts:146` `count == before + 1`; `:148` `< 0.1`; `:149` linvel `< 0.1`; `:151` up `> 0.99`; `:153` heading `< 5°` | PASS (nota: o snapshot `lastWaterReset` é lido logo depois do teleport, no mesmo passo, `src/core/Game.ts:276`; o alvo é comparado com `nearestRoad` só a < 15 m, `:156`) |
| C11 | água única em y -2, 3072², roughness 0.08, metalness 0.2, normal/env map, offset animado | pw `animated water plane at -2` ✓ | `tests/e2e/world.spec.ts:163-168`; `:171` `expect(b).not.toEqual(a.water.offset)` | PASS |
| C12 | rede determinística | vitest `road network is deterministic` ✓ | `tests/unit/roads.test.ts:33-37` | PASS |
| C13 | `ROAD_SPECS` com 4 tipos e larguras/faixas fixas | vitest `road specs by kind` ✓ | `tests/unit/roads.test.ts:44-51` | PASS |
| C14 | 1 highway fechada, raio [900, 1350], winding ±1 | vitest `one closed highway ring around downtown` ✓ | `tests/unit/roads.test.ts:58`, `:60`, `:66-67`, `:71` | PASS |
| C15 | ≥ 6 avenidas cruzando o centro entre lados diferentes | vitest `six avenues cross downtown` ✓ | `tests/unit/roads.test.ts:77`, `:87`, `:90-92` | PASS |
| C16 | ≥ 5 hill começando a ≤ 30 m da rede e subindo ≥ 40 m | vitest `hill roads start on the network and climb 40 m` ✓ | `tests/unit/roads.test.ts:99`, `:110`, `:117` | PASS |
| C17 | pontos a cada 2 m ± 0.05 | vitest `points every 2 m` ✓ | `tests/unit/roads.test.ts:130` | PASS |
| C18 | rampa ≤ 10 % | vitest `grade at most 10 percent` ✓ | `tests/unit/roads.test.ts:144` | PASS |
| C19 | hill: soma de \|Δheading\| ≥ π, passo ≤ 6° | vitest `hill roads curve` ✓ | `tests/unit/roads.test.ts:155`, `:158` | PASS |
| C20 | carve: ± 0.3 sob a pista; degrau ≤ 1.5 entre vizinhas da faixa (w/2, w/2+6] | vitest `carve flattens terrain under roads` ✓ | `tests/unit/roads.test.ts:206`, `:213`, `:219-220` | PASS como escrito; precision gap - mutante F1 (sem mistura) sobrevive, ver Faults |
| C21 | fita: vértices a ±w/2, +0.05, u 0..w/4, v +0.5 por ponto | vitest `road strip vertices and uvs` ✓ | `tests/unit/roadMesh.test.ts:31-33`, `:36-38` | PASS (amostragem: highway e 1 hill, 1 ponto a cada 7; o Verifier recalculou todas as 13 estradas e todos os pontos: 27366 vértices, 0 fora) |
| C22 | materiais de asfalto (centro transparente 0.65, fora opaco) | pw `road materials use the asphalt set` ✓ | `tests/e2e/world.spec.ts:178-184` | PASS |
| C23 | traço ≥ 1.5× vão, borda ≥ 1.5× faixa, espaçamento 6 ± 0.25 medido na imagem | pw `lane marks drawn in the road shader` ✓ | `tests/e2e/world.spec.ts:207-210` (sonda real com `readPixels`, `src/core/Game.ts:781`) | PASS |
| C24 | postes: soma `2·floor(L/40)`, a w/2+1.5, 40 ± 0.5, fora de ponte, skipped ⇔ cruzamento | vitest `lamp posts every 40 m on both sides` ✓ | `tests/unit/roads.test.ts:247`, `:265`, `:266`, `:276`, `:283` | PASS |
| C46 | fita virada para cima; tabuleiro e guarda-corpos virados para fora | vitest `road strip faces up and bridge boxes face out` ✓ | `tests/unit/roadMesh.test.ts:60` (todas as estradas), `:84` (só a 1ª ponte da 1ª estrada com ponte) | PASS (amostragem: 1 de 5 pontes; o Verifier recalculou as 5: 22812 triângulos, 0 para dentro) |
| C25 | 2 InstancedMesh (postes, cabeças) com count = `generateLamps` | pw `lamp posts are two instanced meshes` ✓ | `tests/e2e/world.spec.ts:217-220` | PASS |
| C26 | todo ponto com água ou > 4 m está numa ponte; toda ponte tem 1 ponto assim; highway cruza o rio | vitest `bridge stretches where the road is high or over water` ✓ | `tests/unit/bridges.test.ts:22`, `:27`, `:39` | PASS como escrito; mutante F2 (ponte só sobre água, a alternativa rejeitada da door 6) dá saída idêntica no seed 1337, ver Faults |
| C27 | tabuleiro 0.8, guarda-corpos 1 m em ±w/2, pilares **1.5 × 1.5** a cada 24 ± 0.5 até o chão | vitest `deck rails and pillars` ✓ | `tests/unit/bridges.test.ts:55-58`, `:62`, `:69-70`, `:77`, `:80`, `:84`, `:90-91`; tamanho do pilar: nenhuma asserção (`bridgeParts` não devolve tamanho; `PILLAR_SIZE` só é lido em `src/world/WorldPhysics.ts:50` e `src/world/ChunkManager.ts:327`; `rg "PILLAR_SIZE" tests` vazio) | PARTIAL |
| C28 | atravessa a ponte da highway em ≤ L/15 + 4 s sem cair abaixo do tabuleiro − 1.2 | pw `car crosses the highway bridge on the deck` ✓ | `tests/e2e/world.spec.ts:261` limite; `:268` `>= P(i).y - 1.2`; `:286` `expect(reached).toBe(true)` | PASS |
| C29 | guarda-corpo segura o carro no tabuleiro | pw `guard rail keeps the car on the deck` ✓ | `tests/e2e/world.spec.ts:310` `lateral <= width/2`; `:311` | PASS |
| C30 | lotes determinísticos | vitest `lots are deterministic` ✓ | `tests/unit/lots.test.ts:39-41` | PASS |
| C31 | torres 30-90 no centro, casas 6-18 fora; prédio dos 2 lados de avenue/street/hill | vitest `towers downtown and houses on the hills` ✓ | `tests/unit/lots.test.ts:48-52`, `:76` | PASS (`street`: 0 estradas geradas no seed 1337, então essa parte é vácua) |
| C32 | footprint a ≥ w/2 + 2 de toda estrada, fora da água | vitest `buildings keep off roads and water` ✓ | `tests/unit/lots.test.ts:86`, `:90` | PASS (mede até os vértices; o Verifier recalculou contra os segmentos: folga mínima 0.501 m) |
| C33 | rotação = heading ± 1°; base = menor altura ± 0.01; **malha começa na base e sobe `height`** | vitest `buildings face their road and sit on the lowest corner` ✓ | `tests/unit/lots.test.ts:118`, `:121`; malha: nenhuma asserção (a matriz de instância é montada em `src/world/CityScene.ts:166`, `l.y + l.height / 2`; `rg "getMatrixAt\|instanceMatrix" tests` vazio) | PARTIAL |
| C34 | letreiros só no centro, paleta de 4, as 4 aparecem | vitest `neon signs only downtown with the 4-color palette` ✓ | `tests/unit/lots.test.ts:131-135` | PASS |
| C35 | 4 malhas de fachada, soma = lotes, as 4 presentes | pw `buildings are four instanced facade meshes` ✓ | `tests/e2e/world.spec.ts:321-323` | PASS |
| C36 | 899 constrói, 901 não, 1199 mantém, 1201 descarta, 1 construção, descartes sem limite | vitest `chunk build and dispose rules` ✓ | `tests/unit/chunks.test.ts:20`, `:23`, `:26`, `:28`, `:32-33` | PASS |
| C37 | após teleporte: ≤ 900 m carregados, nada além de 1200, `maxBuildsInOneFrame` = 1 | pw `chunks stream around the car` ✓ | `tests/e2e/world.spec.ts:338-340` | PASS (nota: `maxBuildsInOneFrame` é `max(plan.build.length)`, `src/world/ChunkManager.ts:64`, e não conta construções reais por frame) |
| C38 | draw calls ≤ 220 nos 5 lugares | pw `draw calls at most 220 across the world` ✓ | `tests/e2e/render.spec.ts:53` | PASS |
| C39 | `ready` em até 30 s em high | pw `ready within 30 s at high quality` ✓ | `tests/e2e/visual.spec.ts:399` - `expect(Date.now() - start).toBeLessThan(30_000)` | PASS |
| C40 | spawn parado numa avenida do centro, a ≤ w/2 do eixo, heading ± 5° | pw `spawn on a downtown avenue` ✓ | `tests/e2e/world.spec.ts:352-355`, `:359` | PASS |
| C41 | segmentos com uma ponta na janela; 0 longe; canvas com ≥ 200 px de estrada e ≥ 10 px laranja | vitest `road segments inside the 320 m window` ✓; pw `minimap draws roads and car` ✓ | `tests/unit/minimap.test.ts:30`, `:36`; `tests/e2e/hud.spec.ts:121-122` | PASS |
| C42 | 4 paredes em ±1536; carro segurado em +x, -x, -z | pw `invisible walls at 1536` ✓ | `tests/e2e/drive.spec.ts:82`, `:104-105` | PASS |
| C43 | espelho 1000×1000 em (0, [0, 0.05], 0), meia resolução; ausente em low | pw `reflector present only in high quality` ✓ | `tests/e2e/visual.spec.ts:66`, `:70-74`, `:77` | PASS |
| C44 | cenários superados: batida em prédio do centro, clip box ±1536 e ≥ 160, seed 1337 | pw `building blocks the chassis` ✓, `collision throws sparks` ✓, `gtao at half resolution` ✓, `landing door literals` ✓ | `tests/e2e/drive.spec.ts:69`, `:74`; `tests/e2e/visual.spec.ts:248`, `:365-369`; `tests/e2e/render.spec.ts:120` | PASS |
| C45 | 23 módulos puros sem three/rapier | vitest `pure modules do not import three or rapier` ✓ | `tests/unit/purity.test.ts:38` `toBe(23)`; `:41` | PASS |

## Coverage

Recalculado da autoridade de cada conjunto: o plano (ACs, doors, Impact, Observable) e, para os
conjuntos gerados, a saída do gerador no seed 1337 lida por um teste de rascunho do Verifier
(tipos: highway 1, avenue 6, hill 6, street 0; 5 pontes; 77 pilares; 1224 lotes; 210 letreiros;
1236 postes + 20 pulados).

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (36) | `plan.md` Criteria | 1-16, 18-20, 22-26, 28-29, 31-36 como na tabela do autor, cada uma com asserção localizada acima; AC 17 C20 parcial; AC 21 C27 parcial; AC 27 C33 parcial; AC 30 C36/C37 parcial | AC 17 mistura nos 6 m externos (F1 sobrevive); AC 21 pilar 1.5 × 1.5; AC 27 malha começando na base; AC 30 "disposing them" (dispose de geometria) |
| landing doors (9) | `plan.md` Landing | 1 C2-C4, C6 · 2 C13, C17 · 3 C1, C12, C30, C45 · 4 C7, C8 (F3 morto) · 5 C18, C20 · 6 C26-C29 · 7 C36, C37 · 8 C11 · 9 C9, C10 | door 5 "mistura suave nos 6 m externos" (F1); door 6 viaduto sobre vale seco (0 instâncias no seed 1337, F2 equivalente) e pilar 1.5 m; door 7 "dispose de geometria" (`src/world/ChunkManager.ts:60` sem asserção) |
| door 6 bridge conditions (2) | door 6 literal ("mais de 4 m acima do terreno original ou cruza água") | água C26 · > 4 m sobre terra seca: as 194 amostras secas altas ficam todas nas rampas das 5 travessias do rio | > 4 m sobre vale seco (nenhuma ponte só de viaduto; saída idêntica com o ramo removido) |
| carve bands (4) | `carveRoads.ts` + door 5 | sob a pista C20 · faixa de mistura: só degrau entre vizinhas da faixa, formato da mistura não afirmado · fora do alcance: não afirmado · sob ponte nada muda: não afirmado | mistura; fora; sob ponte |
| road kinds in `ROAD_SPECS` (4) | door 2 | highway C13, C14 · avenue C13, C15 · hill C13, C16 · street C13 (só a spec; 0 estradas `street` geradas) | - |
| road kinds with buildings (3) | AC 25 | avenue C31 · hill C31 · street vácuo (0 estradas) | - |
| water reset threshold (3 edges) | door 9 | -1.49, -1.5, -1.51 em `tests/unit/worldMath.test.ts:12-14` | - |
| chunk decisions (5) | door 7 | 899, 901, 1199, 1201, 1 por chamada: `tests/unit/chunks.test.ts:20-33` | - |
| terrain regions (4) | door 1 | centro C3 · morros C4 · rio C5 · baía C6 | - |
| drop-test points (5) | C7 | pico, encosta, margem, centro, norte: `tests/e2e/world.spec.ts:54-66` | - |
| bridge parts (3) | door 6 / AC 21 | tabuleiro C27 · guarda-corpos C27, C29 (F5 morto) · pilares C27 (espaçamento, topo, base) | pilares: tamanho 1.5 × 1.5 |
| bridges generated (5) | saída do gerador | C26 as 5; C27 as 5; C46 só a 1ª (recalculado pelo Verifier: as 5 sem triângulo invertido); C28/C29 só a da highway sobre o rio (é o que os checks pedem) | - |
| road materials (2) | AC 18 | centro C22 · fora C22 | - |
| lane mark kinds (2) | AC 18 | tracejado central C23 (F4 morto) · borda C23 | - |
| draw-call locations (5) | C38 | 5 em `tests/e2e/render.spec.ts:44-53` | - |
| walls (4) | AC 35 | +x, -x, -z dirigidos `tests/e2e/drive.spec.ts:104-105` · +z só a listagem `:82` (o check aceita isso: a baía reseta pela água, C10) | - |
| minimap outcomes (2) | AC 34 | estradas na janela e nenhuma: `tests/unit/minimap.test.ts:30`, `:36` | - |
| reflector quality levels (2) | AC 36 | high e low: `tests/e2e/visual.spec.ts:70-77` | - |
| pure modules (23) | `rg -L "three\|rapier"` nos arquivos novos do diff: 9 novos puros + 14 antigos | `tests/unit/purity.test.ts:38`, tabela com os 23 | - |
| superseded free-roam checks (9) | `plan.md` Impact (C9, C10, C17-C20, C30, C42, C45) | C9 → C44 · C10 → C42 · C17 → C14, C15 · C18 → C31 · C19 → C34 · C20 → C24 · C30 fica · C42 → C41 · C45 → C44 (`tests/e2e/render.spec.ts:120`; a tabela do autor lista 8 e deixa C45 dentro de C44) | - |
| superseded visual checks (8) | `plan.md` Impact | C3 → C21/C22 · C4 → C43 · C5, C7 → C23 · C8 → C38 · C15, C19 → C44 · C32 → C44; as asserções removidas (`repeat` 111, `laneMarkCount` 938, `≤ 120`) são só essas | - |
| startup config (1 assembly) | `src/main.ts:32` constrói o único `Game`; geração em `src/core/Game.ts:133-139` | C39, C40 | - |
| Observable rows (plano) | `plan.md` Observable | erro de boot: `src/main.ts:27-38` (existing) · minimapa vazio C41 · loading "Gerando cidade...": sem check e sem código (`rg "Gerando" src index.html` vazio) | - (não é check; ver resíduos) |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/world/chunks.ts` (5 regras), `src/world/worldMath.ts` (3 arestas + ponto mais próximo), `src/hud/minimapMath.ts` (dentro / uma ponta / fora) | own layer C36, C9, C41 · boundary C37, C10, C41 | yes |
| Decides, not reached across a boundary | `TerrainGenerator.ts` + `noise.ts` (4 regiões), `carveRoads.ts` (sob / mistura / fora / ponte), `RoadGenerator.ts` (3 famílias, rampa, `markBridges`: água / alto / extensão / folga), `bridges.ts` (tabuleiro, guarda-corpos, pilares), `roadMesh.ts` (fita, postes), `LotGenerator.ts` | um caso afirmado por linha da tabela de decisão | not met - `carveRoads.ts`: mistura, fora e sob-ponte sem caso afirmado (F1 sobrevive); `markBridges`: ramo "alto sobre terra seca" sem instância (F2 equivalente), extensão e folga sem caso; `bridges.ts`: tamanho do pilar sem caso. Terreno, famílias de estrada, postes, fita e lotes cumprem |
| Entry point that decides nothing | nenhum arquivo do diff | accepted / rejected / error paths | n/a - nenhum arquivo nesta forma |
| Instrumentation, pass-throughs | `WorldPhysics.ts`, `ChunkManager.ts`, `Water.ts`, `CityScene.ts`, `Minimap.ts`, `Game.ts` | coberto pela prova do consumidor | not met - `WorldPhysics` coberto (F3, F5 mortos), `Water` C11, `Minimap` C41, `Game` C10/C40; mas `ChunkManager.ts:60` (`geometry.dispose()`) e `CityScene.ts:166` (base da malha do prédio) não têm consumidor que os afirme |

## Faults injected

Worktree isolado em `<scratchpad>/verify-terrain` (3b76758, junction de `node_modules`), Playwright
com `E2E_PORT=5179`. `git status --porcelain` da árvore principal vazio antes e depois; cada
mutação foi revertida com `git checkout --` e o worktree conferido limpo entre as faltas.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 carve sem mistura: `s = t >= 1 ? 1 : 0` (faixa de 6 m inteira na altura da pista, degrau na borda externa) | `src/world/terrain/carveRoads.ts:62` | no - survived: `roads.test.ts` "carve flattens terrain under roads" passa; o degrau máximo na borda da área aplainada vai de 1.62 m (HEAD) para 2.93 m e nenhuma asserção olha o par que cruza `w/2 + 6` |
| F2 ponte só sobre água: `cond.push(h < WATER_Y)` (a alternativa rejeitada da door 6) | `src/world/roads/RoadGenerator.ts:185` | no - survived (equivalente no seed 1337: as 5 pontes saem idênticas; não há viaduto sobre vale seco para C26 ver) |
| F3 heightfield sem transpor: `hf[iz * n + ix]` | `src/world/WorldPhysics.ts:33` | yes - `tests/e2e/world.spec.ts:102` "(1201.3, 1452.7) ray 23.32 vs -8"; também `:65` C7 "peak dipped below the terrain" |
| F4 período do tracejado 6 → 7 m | `src/world/CityScene.ts:321` | yes - `tests/e2e/world.spec.ts:209` `spacing.length` 1 < 2 |
| F5 guarda-corpos sem collider | `src/world/WorldPhysics.ts:45` | yes - `tests/e2e/world.spec.ts:310` lateral 24.2 > 12 |

Cap de 5 atingido. Sem mutante (ausência mostrada por busca, acima): tamanho do pilar (C27),
base da malha do prédio (C33), dispose de geometria (door 7). Ficaram sem falta própria as
superfícies de chunks, lotes, postes, minimapa e draw calls.

## Swept existing

- failure modes, "falha de geração cai no overlay de erro existente": confirmado, `new Game` fica
  dentro do `try` em `src/main.ts:27-38`.
- dependency failure, "texturas ausentes caem em cor chapada (visual C2)": caminho de assets antigo,
  que o diff não toca (`src/core/Loader.ts` fica fora do diff); os materiais novos leem
  `assets.textures[...]` como antes (`src/world/CityScene.ts:90`, `:94`).
- data lifecycle cita C36/C37 para "malhas descartadas (dispose)": a decisão está provada, o
  `geometry.dispose()` não (lacuna acima).

## Gate

`npx vitest run` - 74 passed, 0 failed · `E2E_PORT=5178 npx playwright test` - 68 passed, 0 failed (15.1 min)

## Ranked gaps

1. F1 sobrevive: C20 não pega um carve sem mistura (door 5 / AC 17). O check só compara vizinhas
   que estão as duas dentro da faixa; falta o par que cruza `w/2 + 6` (e o que cruza `w/2`) -
   `tests/unit/roads.test.ts:208-213`.
2. F2 equivalente: o ramo "> 4 m sobre terra seca" da door 6 não tem instância no seed 1337, então
   remover o ramo (a alternativa rejeitada) não muda nada - `tests/unit/bridges.test.ts:22`.
3. C27 PARTIAL: nenhuma asserção sobre pilar 1.5 × 1.5 - `tests/unit/bridges.test.ts:83-93`.
4. C33 PARTIAL: nenhuma asserção sobre a malha começar na base - `src/world/CityScene.ts:166`.
5. Door 7 dispose de geometria sem prova - `src/world/ChunkManager.ts:60`.

Resíduos (não mudam o veredito): C46 amostra 1 de 5 pontes e C21 2 de 13 estradas (o
recálculo do Verifier mostra que todas cumprem); `street` é um tipo declarado que nunca é gerado;
`maxBuildsInOneFrame` vem da saída do plano; o snapshot de C10 é lido no mesmo passo do teleporte;
o texto "Gerando cidade..." da linha Observable do plano não tem check nem código.
