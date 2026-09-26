# City terrain

Sub-projeto 1.6 do jogo estilo NFSU2: troca a cidade quadrada de 404 m por uma cidade orgânica
de 3 km × 3 km, com centro plano junto a uma baía, bairros subindo morros, rio, avenidas largas
com curvas, rodovia em anel, pontes e viadutos. Abordagem A aprovada pelo usuário em
2026-09-25: terreno por heightfield + rede de ruas por splines, tudo gerado por seed, malhas
carregadas por chunks.

## Problem

A cidade atual é um tabuleiro plano de 8 × 8 quarteirões iguais com ruas retas de 12 m. Depois
de testar, o usuário escreveu: "quero também melhorias no mapa. morros, descidas, pontes,
estradas maiores, curvas, declives, etc. esse mapa quadrado não cola". Quem paga é o jogador:
não há subida, descida, curva de verdade nem lugar para acelerar, e em 2 minutos já se viu tudo.
Também paga o roadmap: corridas (sub-projeto 2) precisam de uma rede de ruas com trechos longos
e curvas para ter pista.

Quando isto for entregue, o jogador nasce numa avenida do centro, sobe um morro por uma estrada
sinuosa, desce, cruza o rio por uma ponte, entra na rodovia em anel e dá a volta na cidade.

## Flow

Reusa `mulberry32` do `CityGenerator`, o `Reflector`, os materiais PBR e o shader de fachada do
`CityScene`, o `Car`, os efeitos, a pilha de pós, o `FixedStepper` e o `window.__game` como
superfície de prova. O `CityGenerator` de grade deixa de ser usado pelo jogo (fica para os
testes antigos até o supersede) e o `CityScene` é dividido: materiais e shaders ficam, a
construção de malhas passa para o `ChunkManager`.

1. boot -> `world/terrain/TerrainGenerator` (door 3) - função pura `generateTerrain(seed)` -> `Heightmap` (769 × 769 alturas a cada 4 m, door 1): ruído fbm com seed, máscara que zera o centro, vale do rio, baía ao sul
2. `world/roads/RoadGenerator` (door 3) - função pura `generateRoads(seed, heightmap)` -> `RoadNetwork` (door 2): avenidas do centro, rodovia em anel, estradas de morro; cada estrada amostrada a cada 2 m com altura suavizada e rampa máxima de 10 % (door 5); marca trechos de ponte (door 6)
3. `world/terrain/carveRoads` (door 3) - função pura: aplaina o `Heightmap` sob cada estrada (door 5)
4. `world/lots/LotGenerator` (door 3) - função pura `generateLots(seed, roads, heightmap)` -> prédios, postes e letreiros ao longo das ruas, sem invadir pista, ponte nem água
5. `world/WorldPhysics` (door 1, door 4) - um collider `heightfield` do Rapier para o terreno; `trimesh` por trecho de estrada; `trimesh` + `cuboid` para pontes e pilares; `cuboid` rotacionado por prédio; paredes nas bordas; tudo criado no boot
6. `world/ChunkManager` (door 7) - divide o mundo em 6 × 6 chunks de 512 m; a cada frame constrói as malhas (terreno, estradas, pontes, calçadas) dos chunks a até 900 m do carro e descarta as que passam de 1200 m; prédios, postes e letreiros continuam em `InstancedMesh` globais (4 fachadas + postes + 4 cores)
7. `world/Water` (door 8) - plano de água na baía e no rio com material escuro, normal map animado e env map
8. `world/CityScene` (exists) - vira o dono dos materiais; o `Reflector` cobre só o centro plano (y = 0)
9. `core/Game` (exists) - spawn numa avenida do centro; a cada passo fixo, se o chassi fica abaixo do nível da água, reposiciona no ponto de estrada mais próximo (door 9)
10. `hud/Minimap` (exists) - desenha as estradas (polilinhas) da janela de 320 m em vez dos quarteirões
11. out: pixels, `__game.world` (heightmap, rede, chunks carregados, lotes) para as provas

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `Heightmap` - `{ size: 769, spacing: 4, origin: -1536, heights: Float32Array }`, altura do terreno por amostra; vive em `world/terrain/` |
| domain | new term: `RoadNetwork` - estradas com tipo, faixas, largura e polilinha 3D amostrada a cada 2 m, mais trechos de ponte; vive em `world/roads/`; será lido pelo sub-projeto 2 (corridas) para checkpoints e IA |
| domain | new term: `Chunk` - quadrado de 512 m do mundo com malhas construídas sob demanda; vive em `world/ChunkManager.ts` |
| domain | new term: `Lot` - prédio posicionado ao longo de uma rua, com rotação, base na menor altura do terreno sob ele; substitui `Block` como fonte de prédios |
| domain | existing term: `CityLayout` / `Block` / `Street` do `CityGenerator` - deixam de alimentar o jogo; `Minimap`, `CityScene` e os testes e2e que leem `__game.city.blocks` (free-roam C9, visual C15) branch on it today |
| domain | existing term: limite do mundo - era ±202 m com paredes; passa a ±1536 m com paredes; free-roam AC 8 e C10 |
| free-roam-city | supersede: C9 (cenário de batida no quarteirão (-26, -130)) → prédio do centro escolhido pelo `LotGenerator`; C10 (±202) → ±1536; C17-C20 (grade 8×8, prédios por quarteirão, letreiros por quarteirão, postes a cada 20 m) → checks de rede, lotes e postes daqui; C30/C42 (minimapa com quarteirões) → minimapa com estradas; C45 `city.seed` 1337 continua |
| visual-upgrade | supersede: C3 (asfalto `repeat` 111 num plano de 444 m) → asfalto em fitas de estrada com 1 tile a cada 4 m; C5, C7 (faixas por `Street`, 938 traços) → faixas desenhadas no shader da fita; C8 (≤ 120 draw calls) → ≤ 220; C4 (reflector 444 m) → reflector só no centro; C32 (clip box ±202) → ±1536; C15/C19 cenário de batida → prédio do centro |
| stored data | nothing - nada persistido; o mundo é regerado por seed a cada boot |

## Relations

`None - no stored-data shape change` (o `RoadNetwork` é um formato em memória consumido por outros sub-projetos; o contrato dele é a door 2 em `## Landing`).

## Surface

`None - nothing consumed outside` (nenhuma rota; o formato do `RoadNetwork` está em `## Landing`).

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. escala e coordenadas do mundo | mundo de 3072 m × 3072 m centrado na origem (x, z em [-1536, 1536]); `Heightmap` 769 × 769 amostras a cada 4 m; nível da água y = -2; centro plano em y = 0 no quadrado x, z em [-500, 500]; morros até 140 m; paredes invisíveis em ±1536 | 4096 m - exigiria carregar física por região também; 2 m entre amostras - 2.4 M alturas, geração e heightfield do Rapier 4× mais caros sem ganho visível com névoa |
| 2. formato do `RoadNetwork` | `{ roads: Road[] }` com `Road = { id: number, kind: 'highway' \| 'avenue' \| 'street' \| 'hill', lanes: 2 \| 4 \| 6, width: number, closed: boolean, points: Float32Array /* x,y,z a cada 2 m */, bridges: Array<{ from: number, to: number }> /* índices em points */ }`; larguras fixas: highway 24 m (6 faixas), avenue 16 m (4), hill 10 m (2), street 10 m (2) | grafo de nós e arestas com interseções explícitas - necessário só quando houver tráfego com prioridade; polilinha 2D + altura do terreno - perde a altura suavizada das rampas e das pontes |
| 3. geradores puros e determinísticos | `generateTerrain(seed)`, `generateRoads(seed, heightmap)`, `carveRoads(heightmap, roads)`, `generateLots(seed, roads, heightmap)` sem import de `three` nem `rapier`, PRNG `mulberry32`, ruído de valor 2D próprio (sem dependência) com seed padrão 1337 | biblioteca `simplex-noise` - dependência nova para ~40 linhas; geração dentro do `CityScene` - não testável sem browser |
| 4. física do terreno | um único `ColliderDesc.heightfield(nrows, ncols, heights, scale)` para os 769 × 769 pontos (convenção de linhas/colunas provada por raycast contra o `Heightmap`); estradas e pontes como `ColliderDesc.trimesh` por estrada, 5 cm acima do terreno aplainado | trimesh do terreno inteiro - 1.2 M triângulos na física; colliders criados por chunk junto com as malhas - carro cai num buraco quando o chunk ainda não carregou |
| 5. perfil das estradas | altura ao longo da estrada = média móvel de 40 m da altura do terreno, depois limitada a rampa ≤ 10 % em cada passo de 2 m; o terreno a até `width/2 + 6 m` do eixo é aplainado na altura da estrada (mistura suave nos 6 m externos) | seguir o terreno cru - degraus e rampas de 40 % que capotam o carro; túneis - custo de geometria e colisão sem pedido do usuário |
| 6. pontes e viadutos | trecho da estrada vira ponte onde a pista fica mais de 4 m acima do terreno original ou cruza água; tabuleiro = fita da estrada com 0.8 m de espessura e guarda-corpo de 1 m nos dois lados (collider); pilares cuboides de 1.5 m a cada 24 m até o terreno | ponte só onde cruza o rio - viadutos em vales viram aterros estranhos; pilares por física dinâmica - sem necessidade |
| 7. streaming de malhas | chunks de 512 m (grade 6 × 6); terreno de cada chunk = malha de 129 × 129 vértices; construir quando o centro do chunk fica a ≤ 900 m do carro, descartar (dispose de geometria) quando passa de 1200 m; no máximo 1 chunk construído por frame | chunks de 256 m - 144 malhas e mais draw calls; tudo carregado no boot - 36 chunks × malhas cheias, boot e memória maiores sem ganho com névoa de ~800 m |
| 8. água | plano único 3072 × 3072 em y = -2 com `MeshStandardMaterial` escuro (`roughness` 0.08, `metalness` 0.2), `normalMap` com offset animado e env map; o terreno acima da água cobre o resto | `Water2` do three - segundo render de reflexo, dobra o custo; água só no rio - a baía é a borda sul do mapa |
| 9. queda na água | IF o centro do chassi fica abaixo de y = -1.5 THEN reposiciona o carro em pé, parado, 1 m acima do ponto de estrada mais próximo, alinhado à estrada | reset manual (`R`) - `R` levanta 1 m no lugar e o carro continuaria na água |

- Nada mais aqui é difícil de reverter: quantidades de estradas, frequências do ruído e densidade de prédios são parâmetros do gerador.

## Criteria

### S1: Terreno e água (P1)

Um mundo de 3 km com centro plano, morros, vale do rio e baía, com colisão.

**Acceptance Criteria**

1. WHEN `generateTerrain(seed)` is called twice with the same seed THEN the system SHALL return identical heights, and different seeds SHALL produce different heights
2. The system SHALL produce a `Heightmap` of 769 × 769 samples spaced 4 m apart covering x, z in [-1536, 1536]
3. The system SHALL keep every sample inside the downtown square x, z in [-500, 500] at height 0 (± 0.01 m)
4. The system SHALL reach a maximum terrain height between 80 m and 140 m, located at least 800 m from the origin
5. The system SHALL carve a river valley whose bed is at least 3 m below the water level along its whole length, running from the north edge to the bay
6. The system SHALL make every sample with z ≥ 1300 lie below the water level (the bay)
7. WHEN the car is placed 3 m above any terrain sample and dropped THEN the system SHALL rest the chassis at the terrain height (± 1.2 m, the suspension) without falling through
8. IF the chassis center goes below y = -1.5 THEN the system SHALL reposition the car upright, at rest, 1 m above the nearest road point, heading along the road, within one fixed step
9. The system SHALL render the water as one plane at y = -2 whose normal map offset changes every frame

**Independent test:** voar com a câmera de debug (ou dirigir) do centro plano até o morro mais alto, ver o rio e a baía, cair na água e reaparecer numa estrada.

### S2: Rede viária (P1)

Avenidas no centro, rodovia em anel, estradas de morro com curvas, sem rampas absurdas.

**Acceptance Criteria**

10. WHEN `generateRoads(seed, heightmap)` is called twice with the same inputs THEN the system SHALL return identical networks
11. The system SHALL generate exactly one closed `highway` of 6 lanes and 24 m width forming a loop that encloses the downtown square, with every point at least 900 m and at most 1350 m from the origin
12. The system SHALL generate at least 6 `avenue` roads of 4 lanes and 16 m width inside or crossing the downtown square, each connecting two edges of the square
13. The system SHALL generate at least 5 `hill` roads of 2 lanes that each start within 30 m of a point on an avenue or the highway and climb at least 40 m of height along their length
14. The system SHALL sample every road every 2 m (± 0.05 m) along its length
15. The system SHALL keep the grade between consecutive road points at 10 % or less on every road
16. The system SHALL make every `hill` road curve: its total absolute heading change SHALL be at least 180° over its length, and no single 2 m step SHALL turn more than 6°
17. WHEN `carveRoads` runs THEN the terrain within `width/2` of a non-bridge road axis SHALL match the road height (± 0.3 m), and within the next 6 m SHALL blend without a step greater than 1.5 m between neighbour samples
18. The system SHALL render every road as a strip mesh with the asphalt PBR set (1 tile every 4 m along and across), dashed center lines every 6 m in the shader, and edge lines; the downtown roads SHALL lie over the `Reflector`
19. The system SHALL place lamp posts every 40 m on both sides of every road (not on bridges), all as one instanced mesh for posts and one for heads (40 m, not 25 m: the user asked for fewer posts on 2026-09-25)

**Independent test:** gerar a rede, contar tipos, medir rampas e curvas; dirigir pela rodovia inteira sem sair da pista.

### S3: Pontes e viadutos (P1)

A estrada vira ponte onde cruza o rio ou fica alta sobre um vale.

**Acceptance Criteria**

20. The system SHALL mark as bridge every road stretch that crosses water or where the road is more than 4 m above the uncarved terrain, and the highway SHALL cross the river on a bridge
21. The system SHALL build each bridge deck 0.8 m thick with 1 m guard rails on both sides, and pillars of 1.5 m × 1.5 m every 24 m reaching down to the terrain or the water bed
22. WHEN the car drives along a bridge THEN the system SHALL keep the chassis on the deck (never below deck height − 1.2 m) from one end to the other
23. IF the car drives into a guard rail THEN the system SHALL keep the chassis on the deck side of the rail

**Independent test:** dirigir pela ponte da rodovia sobre o rio, bater no guarda-corpo, ver os pilares de baixo.

### S4: Prédios e bairros (P1)

Prédios altos no centro, casas baixas nos morros, sempre fora da pista.

**Acceptance Criteria**

24. WHEN `generateLots(seed, roads, heightmap)` is called twice with the same inputs THEN the system SHALL return identical lots
25. The system SHALL place buildings along both sides of avenues and streets with heights between 30 m and 90 m inside the downtown square and between 6 m and 18 m outside it
26. The system SHALL keep every building footprint at least 2 m from the edge of every road and every bridge, and out of the water
27. The system SHALL rotate each building to face its road (rotation equal to the road heading at the closest point, ± 1°) and set its base at the lowest terrain height under its footprint, extending into the ground
28. The system SHALL place neon signs only on downtown buildings, with the 4-color palette of free-roam-city
29. The system SHALL render buildings with the 4 facade materials of visual-upgrade as 4 instanced meshes for the whole world

**Independent test:** dirigir do centro para o morro e ver a transição de torres para casas; nenhum prédio na pista.

### S5: Streaming, desempenho e integração (P2)

Carregar só o que está perto, manter o frame barato, e o resto do jogo continuar funcionando.

**Acceptance Criteria**

30. The system SHALL divide the world into 6 × 6 chunks of 512 m and build the meshes of a chunk only while its center is within 900 m of the car, disposing them beyond 1200 m, building at most 1 chunk per frame
31. The system SHALL keep total draw calls per frame at 220 or less with quality `high` anywhere in the world
32. The system SHALL reach the first frame within 30 s in the test environment with quality `high`
33. The system SHALL spawn the car at rest on a downtown avenue, heading along it
34. The system SHALL draw the minimap from the road network: every road polyline inside the 320 m window, the car triangle in the center
35. The system SHALL keep invisible walls at x, z = ±1536 so the chassis never leaves [-1536, 1536]
36. The system SHALL place the `Reflector` only over the downtown square (1000 m × 1000 m at y = 0) when quality is `high`

**Independent test:** dirigir da ponta sul à ponta norte observando chunks aparecerem antes da névoa, conferir draw calls no debug, minimapa mostrando as curvas.

## Out of scope

| Excluded | Why |
| --- | --- |
| Túneis | não pedido; geometria e colisão de túnel é outro sub-projeto |
| Interseções com prioridade, semáforos, rotatórias | só importam com tráfego (sub-projeto 6) |
| LOD de terreno (malhas mais simples de longe) | névoa a ~800 m e chunks de 512 m cobrem; entra se o FPS pedir |
| Streaming da física por região | 769 × 769 heightfield + colliders estáticos cabem no boot |
| Mapa desenhado à mão | usuário escolheu a abordagem A (procedural por seed) |
| Vegetação, árvores | não pedido; candidata a polimento |
| Mapa-múndi / tela de mapa grande | o minimapa cobre; mapa grande entra com a carreira |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Convenção de linhas/colunas do heightfield do Rapier | descoberta no build e provada por raycast (AC 7) | a doc diz "column-major" mas não diz se `nrows` conta amostras ou segmentos; um teste decide | n |
| Seed padrão | 1337, como a cidade atual | coerência com AD-008 e com os testes | n |
| Onde fica cada coisa | centro na origem, baía ao sul (z > 1300), rio de norte a sul a leste do centro, morros ao norte e a leste | geografia clássica de cidade costeira; dá rodovia com ponte e estradas de morro nos dois lados | n |
| Velocidade de dirigir em rampas | física atual sem mudança | o motor de 4000 N/roda sobe 10 % a ~80 km/h pelo cálculo; ajuste só se o teste de rampa falhar | n |
| Tempo de geração no boot | orçamento de 30 s (AC 32) já cobre | 591 k amostras de ruído + rede + lotes em JS ≈ 1 s numa máquina comum | n |
| Abordagem | A: heightfield + splines + chunks | escolha do usuário | y |
| Tamanho | ~3 km × 3 km | escolha do usuário | y |
| Estilo | cidade orgânica em colina (Olympic City/Bayview) | escolha do usuário | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `game` (canvas 3D) | loading state | existing - overlay `Carregando...`; texto de progresso ganha `Gerando cidade...` |
| screen `game` (canvas 3D) | error state | existing - free-roam-city AC 25, C41 (o `catch` do boot cobre falha de geração) |
| screen `game` (canvas 3D) | empty state | n/a - o mundo é sempre gerado por seed |
| screen `game` (canvas 3D) | unauthorised, destructive, density | n/a - sem auth; reset por água é automático e reversível dirigindo; sem lista |
| screen `minimap` | empty state | AC 34 - numa área sem estrada na janela de 320 m o minimapa mostra só o fundo e o carro |
| data contract `RoadNetwork` | shape, versioning | door 2 - formato literal; sem versionamento (em memória, regerado a cada boot) |
| API / command / document / collection | all | n/a - nenhuma |

## Sources

- Pedido do usuário em 2026-09-25: "morros, descidas, pontes, estradas maiores, curvas, declives, etc. esse mapa quadrado não cola"; escolhas do brainstorm: cidade orgânica em colina, ~3 km × 3 km, abordagem A
- Rapier `collider.d.ts` instalado - `ColliderDesc.heightfield(nrows, ncols, heights, scale)` (column-major), `ColliderDesc.trimesh(vertices, indices)`
- `.specs/features/free-roam-city/checks.md` e `.specs/features/visual-upgrade/checks.md` - checks superados listados em `## Impact`
