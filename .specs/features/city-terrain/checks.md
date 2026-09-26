# City terrain - checks

Profile: standard
Plan: `.specs/features/city-terrain/plan.md`

46 checks in 5 slices · 9 one-way doors · 0 open (C46 adicionado no build: a pista só aparecia refletida no espelho)

Comandos de prova: unitário `npx vitest run <arquivo> -t "<nome>"`; integração
`npx playwright test <arquivo> -g "<nome>"` (chromium headless contra `vite dev`, lendo
`window.__game`; "N s" é tempo simulado via `__game.simTime`, como nas features anteriores).
Seed de todas as provas: 1337, salvo quando o check diz outro. "Altura crua" = `Heightmap` antes
de `carveRoads`; "altura" sem adjetivo = depois.

## Checks

### S1 - Terreno e água · 9 files · 60 KB · ~15k

**C1** - `generateTerrain(1337)` chamado duas vezes devolve `heights` iguais amostra a amostra, e `generateTerrain(1338)` difere de `generateTerrain(1337)` em pelo menos 1000 amostras (AC 1, door 3)
Proof: `npx vitest run tests/unit/terrain.test.ts -t "terrain is deterministic by seed"`

**C2** - O `Heightmap` tem `size` 769, `spacing` 4, `origin` -1536 e `heights.length` 591361; `sampleXZ(hm, 0, 0)` = `[-1536, -1536]` e `sampleXZ(hm, 768, 768)` = `[1536, 1536]`; `heightAt(hm, x, z)` num ponto de grade devolve a amostra exata e no meio de 4 amostras devolve a interpolação bilinear (± 1e-6) (AC 2, door 1)
Proof: `npx vitest run tests/unit/terrain.test.ts -t "769 x 769 samples every 4 m"`

**C3** - Toda amostra com `|x| ≤ 500` e `|z| ≤ 500` tem altura crua em `[-0.01, 0.01]` (AC 3, door 1)
Proof: `npx vitest run tests/unit/terrain.test.ts -t "downtown square is flat at 0"`

**C4** - A maior altura crua do mapa está em `[80, 140]` e a amostra onde ela ocorre fica a pelo menos 800 m da origem (AC 4, door 1)
Proof: `npx vitest run tests/unit/terrain.test.ts -t "hills peak between 80 and 140 m"`

**C5** - `riverCenterX(z)` (exportado pelo gerador) é > 500 para todo `z`; para cada linha de amostras com `z` em `[-1536, 1300]` a altura crua na amostra mais próxima de `x = riverCenterX(z)` é ≤ -5 (3 m abaixo da água); a linha `z = -1536` (borda norte) e a linha `z = 1300` (baía) estão entre elas (AC 5)
Proof: `npx vitest run tests/unit/terrain.test.ts -t "river bed runs from the north edge to the bay"`

**C6** - Toda amostra com `z ≥ 1300` tem altura crua < -2 (AC 6, door 1)
Proof: `npx vitest run tests/unit/terrain.test.ts -t "bay below water level"`

**C7** - No browser, para os 5 pontos fora de estrada listados no teste (pico de C4, uma encosta a 60 % da altura do pico, margem do rio 10 m acima da água, um ponto do centro plano entre prédios, um ponto a 1400 m ao norte), o carro teleportado 3 m acima de `__game.world.heightAt(x, z)` e solto fica, após 2 s, com o centro do chassi em `[h − 1.2, h + 1.2]` e nunca abaixo de `h − 1.2` em nenhuma amostra de 0.1 s (AC 7, door 4)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "car rests on the terrain heightfield"`

**C8** - No browser, `__game.world.raycastDown(x, z)` (raio para baixo contra os colliders estáticos) devolve `heightAt(x, z)` ± 0.05 em 20 pontos fora de estrada com `x ≠ z` (inclui 4 perto de cada canto do mapa, o que prova a convenção de linhas/colunas do heightfield), e `roadY + [0.0, 0.1]` em 10 pontos de eixo de estrada fora de ponte (AC 7, door 4)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "heightfield orientation matches the heightmap"`

**C9** - `needsWaterReset(y)`: -1.49 → false, -1.5 → false, -1.51 → true; `nearestRoadPoint(network, x, z)` devolve a estrada, o índice do ponto de menor distância horizontal (conferido contra busca exaustiva em 200 posições aleatórias) e o heading da estrada nesse ponto (AC 8, door 9)
Proof: `npx vitest run tests/unit/worldMath.test.ts -t "water reset threshold and nearest road point"`

**C10** - No browser, com o carro teleportado para `(riverCenterX(0), -1.6, 0)` a 10 m/s, depois do passo fixo seguinte o chassi está a menos de 0.1 m de `nearestRoadPoint + (0, 1, 0)`, com velocidade linear < 0.1 m/s, vetor para cima com `y` > 0.99 e heading a menos de 5° do heading da estrada; `__game.world.waterResets` aumentou 1 (AC 8, door 9)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "falling in the water respawns on the nearest road"`

**C11** - `__game.world.water` reporta um único plano com `y` = -2, tamanho `[3072, 3072]`, `roughness` 0.08, `metalness` 0.2, `hasNormalMap` e `hasEnvMap` verdadeiros, e o `normalMap.offset` lido em dois frames seguidos é diferente (AC 9, door 8)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "animated water plane at -2"`

### S2 - Rede viária · 9 files · 75 KB · ~19k

**C12** - `generateRoads(1337, hm)` chamado duas vezes com o mesmo `hm` devolve redes iguais (mesmos ids, tipos, faixas, larguras, `closed`, `bridges` e `points` elemento a elemento) (AC 10, door 3)
Proof: `npx vitest run tests/unit/roads.test.ts -t "road network is deterministic"`

**C13** - `ROAD_SPECS` tem exatamente 4 entradas: `highway` 6 faixas 24 m, `avenue` 4 faixas 16 m, `hill` 2 faixas 10 m, `street` 2 faixas 10 m; toda estrada gerada tem `lanes` e `width` iguais aos de `ROAD_SPECS[kind]` (door 2)
Proof: `npx vitest run tests/unit/roads.test.ts -t "road specs by kind"`

**C14** - Há exatamente 1 estrada `highway`, com `closed` true, todo ponto a uma distância horizontal da origem em `[900, 1350]`, e o número de voltas (winding number) da sua polilinha em torno da origem é ±1 (AC 11)
Proof: `npx vitest run tests/unit/roads.test.ts -t "one closed highway ring around downtown"`

**C15** - Há pelo menos 6 estradas `avenue`; cada uma tem pelo menos 1 ponto com `max(|x|, |z|) < 500`, e seus pontos inicial e final têm `max(|x|, |z|) ≥ 498`, em lados diferentes do quadrado (AC 12)
Proof: `npx vitest run tests/unit/roads.test.ts -t "six avenues cross downtown"`

**C16** - Há pelo menos 5 estradas `hill`; o primeiro ponto de cada uma está a ≤ 30 m (horizontal) de algum ponto de uma `avenue` ou da `highway`, e `max(y) − min(y)` dos seus pontos é ≥ 40 (AC 13)
Proof: `npx vitest run tests/unit/roads.test.ts -t "hill roads start on the network and climb 40 m"`

**C17** - Em toda estrada a distância 3D entre pontos consecutivos está em `[1.95, 2.05]`, inclusive último→primeiro quando `closed` (AC 14, door 2)
Proof: `npx vitest run tests/unit/roads.test.ts -t "points every 2 m"`

**C18** - Em toda estrada, para todo par de pontos consecutivos, `|Δy| / distância horizontal` ≤ 0.10 (AC 15, door 5)
Proof: `npx vitest run tests/unit/roads.test.ts -t "grade at most 10 percent"`

**C19** - Toda estrada `hill` tem soma de `|Δheading|` entre passos consecutivos ≥ π e nenhum passo com `|Δheading|` > 6° (AC 16)
Proof: `npx vitest run tests/unit/roads.test.ts -t "hill roads curve"`

**C20** - Após `carveRoads`, para cada 5.º ponto de estrada fora de ponte (a cada 10 m), toda amostra do `Heightmap` a distância horizontal ≤ `width/2` do eixo tem altura a ± 0.3 m da altura do ponto; e entre amostras vizinhas (4-vizinhança) na faixa `(width/2, width/2 + 6]` nenhuma diferença passa de 1.5 m (AC 17, door 5)
Proof: `npx vitest run tests/unit/roads.test.ts -t "carve flattens terrain under roads"`

**C21** - `roadStripGeometry(road)` (módulo puro) gera, por ponto, 2 vértices a `±width/2` do eixo perpendicular ao heading, na altura do ponto + 0.05; `u` vai de 0 a `width / 4` de borda a borda e `v` cresce 0.5 por ponto (1 tile a cada 4 m) (AC 18)
Proof: `npx vitest run tests/unit/roadMesh.test.ts -t "road strip vertices and uvs"`

**C22** - No browser, `__game.materials.road` (centro, sobre o espelho) reporta `hasMap`, `hasNormalMap`, `hasRoughnessMap` verdadeiros, `transparent` true, `opacity` 0.65 e `mapSrc` em `/textures/Asphalt012/`; `__game.materials.roadOuter` (fora do centro) reporta os 3 mapas, `mapSrc` em `/textures/Asphalt012/` e `transparent` false (AC 18)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "road materials use the asphalt set"`

**C23** - No browser, `__game.render.probeRoadMarks(roadId, index)` renderiza uma vista ortográfica de cima (chuva, partículas e carro ocultos) sobre um ponto de avenida do centro e devolve luminâncias: centro de traço da linha central ≥ 1.5 × centro de vão; linha de borda ≥ 1.5 × meio da faixa; e a distância entre centros de 2 traços consecutivos medida na imagem é 6 m ± 0.25 (AC 18)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "lane marks drawn in the road shader"`

**C24** - `generateLamps(network)` devolve `{ lamps, skipped }`: para cada trecho contínuo fora de ponte de comprimento `L`, os dois lados recebem juntos `2 × floor(L / 40)` posições a `width/2 + 1.5` m do eixo, espaçadas de 40 m ± 0.5 ao longo do trecho; nenhuma posição fica num trecho de ponte; cada posição vai para `skipped` se cai a ≤ `width/2 + 1` do eixo de outra estrada (cruzamento) e para `lamps` caso contrário, e `lamps.length + skipped.length` = soma de `2 × floor(L / 40)` (AC 19)
Proof: `npx vitest run tests/unit/roads.test.ts -t "lamp posts every 40 m on both sides"`

**C46** - Todo triângulo de `roadStripGeometry` de toda estrada tem normal com `y` > 0 (anti-horário visto de cima), e todo triângulo do tabuleiro e dos guarda-corpos de `bridgeMeshes` tem normal apontando para fora da caixa (AC 18, AC 21)
Proof: `npx vitest run tests/unit/roadMesh.test.ts -t "road strip faces up and bridge boxes face out"`

**C25** - No browser, `__game.world.lamps` reporta exatamente 1 `InstancedMesh` de postes e 1 de cabeças, ambos com `count` igual ao número de postes de `generateLamps` (AC 19)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "lamp posts are two instanced meshes"`

### S3 - Pontes e viadutos · 5 files · 40 KB · ~10k

**C26** - Para toda estrada, todo ponto onde a altura crua sob o eixo é < -2 ou onde `y − altura crua` > 4 está dentro de um intervalo de `bridges`; todo intervalo de `bridges` contém pelo menos 1 ponto com essa condição; e a `highway` tem um intervalo de ponte com um ponto a menos de 20 m de `x = riverCenterX(z)` (AC 20, door 6)
Proof: `npx vitest run tests/unit/bridges.test.ts -t "bridge stretches where the road is high or over water"`

**C27** - `bridgeParts(road, range, heightmap)` (módulo puro) devolve tabuleiro de 0.8 m de espessura com topo na altura da estrada, 2 guarda-corpos de 1 m de altura em `±width/2`, e pilares de 1.5 × 1.5 m espaçados de 24 m ± 0.5 ao longo do trecho, cada um com topo na base do tabuleiro e base ≤ altura (terreno ou leito do rio) sob ele + 0.01 (AC 21, door 6)
Proof: `npx vitest run tests/unit/bridges.test.ts -t "deck rails and pillars"`

**C28** - No browser, com o carro no início da ponte da `highway` sobre o rio, heading ao longo da estrada, `setForwardSpeed(15)` e `W` seguro, o índice do ponto de estrada mais próximo chega ao fim do trecho de ponte em até `comprimento do trecho / 15 + 4` s (tempo de simulação; decidido pelo usuário em 2026-09-25, o viaduto tem ~524 m), e em nenhuma amostra de 0.1 s o chassi fica abaixo de `altura do tabuleiro − 1.2` (AC 22)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "car crosses the highway bridge on the deck"`

**C29** - No browser, com o carro no meio da mesma ponte, heading perpendicular à estrada rumo ao guarda-corpo e `W` por 3 s, o centro do chassi termina a ≤ `width/2` do eixo e acima de `altura do tabuleiro − 1.2` (AC 23)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "guard rail keeps the car on the deck"`

### S4 - Prédios e bairros · 5 files · 45 KB · ~11k

**C30** - `generateLots(1337, network, hm)` chamado duas vezes devolve lotes iguais (AC 24, door 3)
Proof: `npx vitest run tests/unit/lots.test.ts -t "lots are deterministic"`

**C31** - Todo prédio com centro dentro do quadrado do centro tem altura em `[30, 90]` e todo prédio fora dele tem altura em `[6, 18]`; toda `avenue`, `street` e `hill` tem pelo menos 1 prédio a ≤ 30 m do eixo de cada lado (sinal do produto vetorial com o heading) (AC 25)
Proof: `npx vitest run tests/unit/lots.test.ts -t "towers downtown and houses on the hills"`

**C32** - Para todo prédio, a distância horizontal do retângulo (orientado) até o eixo de toda estrada, pontes incluídas, é ≥ `width/2 + 2`; e a altura crua nos 4 cantos e no centro é > -2 (AC 26)
Proof: `npx vitest run tests/unit/lots.test.ts -t "buildings keep off roads and water"`

**C33** - Todo prédio tem rotação igual ao heading da estrada no ponto mais próximo ± 1° (módulo π), e base `y` = menor altura (depois do carve) entre os 4 cantos e o centro (± 0.01), com a malha começando nessa base e subindo `height` (AC 27)
Proof: `npx vitest run tests/unit/lots.test.ts -t "buildings face their road and sit on the lowest corner"`

**C34** - Todo letreiro fica num prédio com centro dentro do quadrado do centro, toda cor de letreiro pertence a `#ff2d95 #00e5ff #b026ff #ffd400`, e as 4 cores aparecem (AC 28)
Proof: `npx vitest run tests/unit/lots.test.ts -t "neon signs only downtown with the 4-color palette"`

**C35** - No browser, `__game.city.facadeMeshes` tem exatamente 4 entradas, a soma de `count` é igual ao número de prédios de `__game.world.lots`, e os 4 tipos de fachada aparecem (AC 29)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "buildings are four instanced facade meshes"`

### S5 - Streaming, desempenho e integração · 14 files · 115 KB · ~29k

**C36** - `planChunks(carX, carZ, loaded)` (módulo puro) sobre a grade 6 × 6 de 512 m: chunk não carregado com centro a 899 m → construir; a 901 m → não; carregado a 1199 m → manter; a 1201 m → descartar; com 3 candidatos a construir, devolve só 1, o mais próximo; descartes não têm limite por chamada (AC 30, door 7)
Proof: `npx vitest run tests/unit/chunks.test.ts -t "chunk build and dispose rules"`

**C37** - No browser, após teleportar o carro para `(0, *, -1300)` e esperar 3 s, todo chunk com centro a ≤ 900 m do carro está em `__game.world.chunks.loaded`, nenhum carregado está a > 1200 m (entre as duas distâncias pode estar ou não, door 7; decidido pelo usuário em 2026-09-25), e `__game.world.chunks.maxBuildsInOneFrame` = 1 (AC 30, door 7)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "chunks stream around the car"`

**C38** - No browser, com qualidade `high`, depois de 3 s parado em cada um dos 5 locais (spawn, estrada de morro perto do pico, ponte da `highway`, orla da baía na `highway`, canto nordeste da `highway`), `__game.render.calls` ≤ 220 (AC 31)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "draw calls at most 220 across the world"`

**C39** - No browser, `__game.ready` fica `true` em até 30 s com qualidade `high` (AC 32; mesmo teste da visual-upgrade, agora com a geração do mundo)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "ready within 30 s at high quality"`

**C40** - No browser, 1 s após o boot: velocidade < 0.5 m/s, a estrada mais próxima do chassi é uma `avenue`, o chassi está a ≤ `width/2` do eixo dela e o heading difere do heading da estrada em < 5° (módulo π) (AC 33)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "spawn on a downtown avenue"`

**C41** - `minimapSegments(network, carX, carZ)` (módulo puro) devolve só segmentos com pelo menos uma ponta dentro da janela de 320 m, em coordenadas de minimapa; para um carro a mais de 400 m de qualquer estrada devolve 0 segmentos; no browser, no spawn, o `<canvas id="minimap">` tem ≥ 200 pixels na cor de estrada `#4a5068` e ≥ 10 pixels laranja `#ff7a1a` a até 10 px do centro (AC 34)
Proof: `npx vitest run tests/unit/minimap.test.ts -t "road segments inside the 320 m window"`
Proof: `npx playwright test tests/e2e/hud.spec.ts -g "minimap draws roads and car"`

**C42** - `__game.world.walls` reporta 4 cuboides em `x = ±1536` e `z = ±1536`; no browser, com o carro teleportado a 12 m da borda `+x`, da `-x` e da `-z`, de frente para ela, e `W` por 3 s, `|x|` e `|z|` ficam ≤ 1536 (a borda `+z` é a baía, coberta por C10) (AC 35)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "invisible walls at 1536"`

**C43** - Sem parâmetro, `__game.scene.reflector` reporta `present` true, `planeSize` `[1000, 1000]`, posição `(0, y, 0)` com `y` em `[0, 0.05]` e `size` = `[floor(innerWidth × 0.5), floor(innerHeight × 0.5)]` (door 3 da visual-upgrade intacta); com `?quality=low`, `present` false (AC 36)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "reflector present only in high quality"`

**C44** - Os checks superados continuam provados com o mundo novo: free-roam C9 e visual C15/C19 com o cenário de batida contra um prédio do centro escolhido de `__game.world.lots` (carro a 8 m da fachada voltada para a rua, de frente); visual C32 com `gtaoClipBox` contendo `[-1536, 1536]` em x/z e `max.y` ≥ 160; free-roam C45 com `city.seed` = 1337 (Impact: supersede)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "building blocks the chassis"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "collision throws sparks"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "gtao at half resolution"`
Proof: `npx playwright test tests/e2e/render.spec.ts -g "landing door literals"`

**C45** - Os módulos puros novos (`src/world/terrain/noise.ts`, `src/world/terrain/TerrainGenerator.ts`, `src/world/terrain/carveRoads.ts`, `src/world/roads/RoadGenerator.ts`, `src/world/roads/roadMesh.ts`, `src/world/roads/bridges.ts`, `src/world/lots/LotGenerator.ts`, `src/world/chunks.ts`, `src/world/worldMath.ts`) não importam `three` nem `@dimforge/rapier3d-compat`; a lista do teste de pureza passa de 14 para 23 (door 3)
Proof: `npx vitest run tests/unit/purity.test.ts -t "pure modules do not import three or rapier"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| plan ACs (36) | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6 · 7 C7, C8 · 8 C9, C10 · 9 C11 · 10 C12 · 11 C14 · 12 C15 · 13 C16 · 14 C17 · 15 C18 · 16 C19 · 17 C20 · 18 C21, C22, C23, C46 · 19 C24, C25 · 20 C26 · 21 C27, C46 · 22 C28 · 23 C29 · 24 C30 · 25 C31 · 26 C32 · 27 C33 · 28 C34 · 29 C35 · 30 C36, C37 · 31 C38 · 32 C39 · 33 C40 · 34 C41 · 35 C42 · 36 C43 | - |
| landing doors (9) | 1 C2, C3, C4, C6 · 2 C13, C17 · 3 C1, C12, C30, C45 · 4 C7, C8 · 5 C18, C20 · 6 C26, C27 · 7 C36, C37 · 8 C11 · 9 C9, C10 | - |
| road kinds in `ROAD_SPECS` (4) | highway C13, C14 · avenue C13, C15 · hill C13, C16 · street C13 | - |
| road kinds with buildings (3) | avenue C31 · street C31 · hill C31 | - |
| water reset threshold (3 edges) | -1.49 C9 · -1.5 C9 · -1.51 C9 | - |
| chunk decisions (5) | build at 899 C36 · skip at 901 C36 · keep at 1199 C36 · dispose at 1201 C36 · one build per call C36, C37 | - |
| terrain regions (4) | downtown flat C3 · hills C4 · river C5 · bay C6 | - |
| drop-test points (5) | peak C7 · slope C7 · river bank C7 · downtown C7 · north C7 | - |
| bridge parts (3) | deck C27 · rails C27, C29 · pillars C27 | - |
| road materials (2) | downtown over mirror C22 · outer opaque C22 | - |
| lane mark kinds (2) | dashed center C23 · edge line C23 | - |
| draw-call locations (5) | spawn C38 · hill near peak C38 · highway bridge C38 · bay shore C38 · northeast highway C38 | - |
| walls (4) | +x C42 · -x C42 · -z C42 · +z C42 (collider listed; drive test replaced by the water reset C10) | - |
| minimap outcomes (2) | roads in window C41 · no road in window C41 | - |
| quality levels for the reflector (2) | high C43 · low C43 | - |
| pure modules (23 files) | C45, table-driven over all 23 | - |
| superseded free-roam checks (8) | C9 → C44 · C10 → C42 · C17 → C14, C15 · C18 → C31 · C19 → C34 · C20 → C24 · C30 → stays (pure mapping unchanged, still consumed by C41) · C42 → C41 | - |
| superseded visual checks (8) | C3 → C22 · C4 → C43 · C5 → C23 · C7 → C22, C23 · C8 → C38 · C15 → C44 · C19 → C44 · C32 → C44 | - |
| startup config: world generation (1 assembly) | `src/core/Game.ts` constructor, used by the dev server and every Playwright test - C39, C40 | - |

- Claims cruzando a fronteira browser (Playwright): C7, C8, C10, C11, C22, C23, C25, C28, C29, C35, C37-C44
- Nenhum outro check afirma mais que o caso que sua prova exercita; os geradores são provados por varredura completa da saída do seed 1337 (todas as estradas, todos os pontos, todos os lotes)

## Test policy

Mesmas linhas das features anteriores (o repositório ainda não as tem em diretrizes).

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence (forma prevista; recontada pelo Verifier sobre o diff):

- `src/world/terrain/TerrainGenerator.ts` + `noise.ts`: máscaras por região (centro, rio, baía, morros) → decides; C1-C6
- `src/world/terrain/carveRoads.ts`: 3 faixas por amostra (sob a pista, mistura, fora) e pula pontes → decides; C20
- `src/world/roads/RoadGenerator.ts`: 3 famílias de estrada, suavização com limite de rampa, marcação de pontes → decides; C12-C19, C26
- `src/world/roads/bridges.ts`, `roadMesh.ts`: geometria com espaçamento de pilares e postes, limites de trecho → decides; C21, C24, C27
- `src/world/lots/LotGenerator.ts`: centro × fora, lados, rejeição por estrada/água → decides; C30-C34
- `src/world/chunks.ts`: 5 regras de construir/manter/descartar → decides, reached across a boundary (posição do carro → malhas); C36 na própria camada, C37 na fronteira
- `src/world/worldMath.ts`: limiar da água (3 arestas), ponto de estrada mais próximo → decides, reached across a boundary; C9 na própria camada, C10 na fronteira
- `src/hud/minimapMath.ts`: recorte de segmentos pela janela → decides, reached across a boundary; C41 nas duas camadas
- `src/world/WorldPhysics.ts`, `src/world/ChunkManager.ts`, `src/world/Water.ts`, `src/world/CityScene.ts`, `src/hud/Minimap.ts`, `src/core/Game.ts`: montam objetos three/Rapier a partir das saídas puras → instrumentation; cobertos pelas provas Playwright dos consumidores (C7, C8, C10, C11, C22, C23, C25, C28, C29, C35, C37-C44)

Cost: 26 provas unitárias em 7 arquivos e 22 provas Playwright em 6 arquivos. Sem essas linhas, as regras de chunk e o limiar da água seriam provados só pelo caminho que o teste de browser percorre.

## Swept

- validation: C2 - tamanho e coordenadas do `Heightmap`; C13 - `ROAD_SPECS` fecha os 4 tipos; seeds diferentes C1
- failure modes: C10 - carro na água volta para a estrada; C42 - paredes seguram o carro na borda; falha de geração no boot cai no overlay de erro existente (free-roam C41)
- idempotency: C1, C12, C30 - mesmo seed, mesmo mundo; C37 - teleportar de novo não duplica chunks (o conjunto carregado é exato)
- authorization: n/a - jogo local, sem contas
- concurrency: C36, C37 - no máximo 1 chunk construído por frame; geração síncrona no boot, sem workers
- data lifecycle: C36, C37 - malhas de chunk descartadas (dispose) além de 1200 m; nada persistido
- dependency failure: existing - texturas ausentes caem em cor chapada (visual C2); a geração não depende de rede
- state transitions: C36 - chunk descarregado → carregado → descartado; C9, C10 - carro na água → reposicionado
- observability: `__game.world` expõe heightmap, rede, lotes, chunks, paredes, água e `waterResets` em DEV; C7-C11, C25, C35, C37 leem daí

## Handoff

- S1 = 15k (TerrainGenerator, noise, worldMath, WorldPhysics, Water, Game, helpers, 2 testes); S2 entra em roads/CityScene a +19k → 34k; S3 +10k → 44k; S4 +11k → 55k; S5 +29k (ChunkManager, chunks, Minimap, minimapMath, Game, visual/drive/hud/render specs) → 84k total, abaixo do budget de 150k - one builder
- Estimativa por `wc -c` dos arquivos existentes tocados (Game 23 KB, CityScene 16 KB, visual.spec 18 KB, hud.spec 7 KB, drive.spec 5 KB, render.spec 4 KB, Minimap 2 KB) mais os novos previstos no tamanho dos análogos (CityGenerator 8 KB por gerador), dividido por 4
- O `CityGenerator` fica no repositório (mulberry32 e paleta são reusados; seus testes unitários continuam verdes), mas deixa de alimentar o jogo; free-roam C17-C19 e visual C5 passam a ser histórico, superados como diz `## Coverage`
- **Settled mid-build:** (autor, antes do código) C24 contava `2 × floor(L / 40)` postes por estrada, mas um poste que cai sobre outra estrada num cruzamento seria um obstáculo no meio da pista; o check passou a separar `lamps` e `skipped` e a provar a soma, sem afrouxar o espaçamento.
- **Settled mid-build (terreno e estradas):** para as estradas de morro cumprirem C18-C20 ao mesmo tempo (rampa ≤ 10 %, curva ≥ 180° e degrau ≤ 1.5 m na mistura de 6 m), o terreno ficou mais largo e mais baixo do que o rascunho do plano sugeria: rampa convexa até a borda e pico de 95 m (AC 4 pede 80-140, então nada muda no contrato). Encosta lateral acima de ~17 % torna C20 impossível com amostras a cada 4 m; o gerador de estradas de morro só anda onde a inclinação lateral é ≤ 15 %, em zigue-zague, mirando 6.5 % de rampa a 20 m à frente. Os corredores sob rodovia e avenidas usam média gaussiana dos pontos próximos (o ponto mais próximo criava paredões onde dois corredores se encontram).
- **Settled mid-build (pontes):** a ponte sobre água liga o alto de uma margem ao alto da outra (até 80 m antes e depois da água), e cada trecho de ponte se estende até a pista voltar a ficar a ≤ 1.5 m do terreno; sem isso a rampa de 9 % cortava o barranco e C20 falhava. C26 continua valendo como escrito (todo ponto com a condição está numa ponte; toda ponte contém um ponto com a condição).
- **Settled mid-build (lotes):** lote de esquina cujo ponto de estrada mais próximo é de outra rua é descartado, para C33 (rotação = heading da estrada mais próxima) valer em todo lote.
- **Settled mid-build (render):** a fita da estrada, as caixas extrudadas e os pilares estavam com os triângulos no sentido horário visto de fora; com `FrontSide` a pista sumia vista de cima e só aparecia no reflexo do espelho (a câmera virtual fica abaixo do plano), então fora do centro e em `?quality=low` não havia pista visível. Nenhum check pegava isso; C46 foi adicionado e mata o mutante do sentido invertido. A sonda de C23 renderiza no canvas (num render target a noite em cor linear quantiza para preto).
- **Settled mid-build (C8):** um raio exatamente vertical sobre um vértice do heightfield atravessa o collider no Parry (caso de borda medido: 0 m de desvio erra, 0.01 m acerta); a prova usa pontos fora dos vértices da grade, onde a interpolação bilinear e a do triângulo diferem menos de 0.01 m.
- **Checks corrigidos com o usuário (2026-09-25, depois do build):** C28 dava 12 s para atravessar a ponte, mas a ponte da rodovia sobre o rio virou um viaduto de ~524 m (topo a topo de barranco); o limite passou a `comprimento / 15 + 4` s. C37 exigia o conjunto exato de chunks a ≤ 900 m, o que a histerese da door 7 (descartar só além de 1200 m) torna impossível depois de um teleporte; passou a exigir os dois limites.
- AC 19 mudou de 25 m para 40 m entre postes antes destes checks, a pedido do usuário ("pode diminuir a quantidade de postes na via", 2026-09-25)
- **Boundary:** C1-C46 fechados no branch `city-terrain` (68/68 e2e e 74/74 unitários verdes antes do merge); falta só o Verifier
- **Abandoned:** hill roads por caminhada gulosa sem antecipação (travavam em 30-60 m contra encostas de 12 %); corredor por ponto mais próximo (paredões entre corredores); sonda de faixas em render target (cor linear quantizava para preto)
