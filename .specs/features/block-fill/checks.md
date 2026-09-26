# block-fill checks

Profile: standard
Plan: `.specs/features/block-fill/plan.md`

38 checks in 7 slices · 2 one-way doors · 0 open

## Comandos de prova

- **Unitário:** `npx vitest run <arquivo> -t "<nome>"`. Módulos puros, sem three nem rapier.
- **Física real (AD-011):** `npx vitest run tests/physics/<arquivo> -t "<nome>"`, com `RAPIER.init()` e o `WorldPhysics` real, como a prova de pilares da city-terrain.
- **Integração:** `npx playwright test <arquivo> -g "<nome>"`. Chromium headless contra `vite dev`, lendo `window.__game`. "N s" é tempo simulado.

"Seed 1337" é o mundo do jogo: `generateTerrain(1337)`, `carveRoads`, `generateRoads`, `generateLots` como o `Game` monta. "Mapa sintético" é um heightmap plano em y = 0 montado no teste, com as estradas e os lotes que o teste declara.

### Sondas DEV em `__game.world.interiors`

- `summary()`: `{ zones, downtown, outer, yards, pools, trees, sites, fireflies, walkersActive }`.
- `groundProbe(x, z, { bounce })`: põe a câmera 3 m acima de (x, z) olhando para baixo, esconde carro, farol, chuva, partículas e espelho da rua, renderiza 1 quadro e devolve a luminância média do quarto central da tela; `bounce: false` zera só a luz rebatida. Restaura tudo ao sair.
- `beamProbe(siteIndex)`: com o holofote 0 do canteiro parado no meio da varredura, devolve a luminância média de 9 × 9 px no centro do facho no chão e a de um ponto do mesmo canteiro a 12 m fora do facho.

## Checks

### S1 - O jogo sabe onde fica o miolo · 7 files · 70 KB · ~18k

**C1** - ✅ Regra de interior (AC 1), mapa sintético com uma estrada reta `avenue` (w = 16) no eixo z, um lote 10 × 10 sem rotação com centro em (40, 0) e o chão plano:
- vértice a 9.9 m do eixo (w/2 + 1.9) não é interior; a 10.1 m é.
- vértice a 0.9 m fora do footprint do lote não é interior; a 1.1 m é.
- com o chão em `WATER_Y + 0.4` o vértice não é interior; em `WATER_Y + 0.6` é.
- vértice a 7.9 m da borda do mapa não é interior; a 8.1 m é.

No seed 1337, todo vértice com `zoneOf` ≥ 0 cumpre as 4 condições, recalculadas no teste contra os segmentos de estrada e os footprints (busca exaustiva sobre os vértices interiores).
Proof: `npx vitest run tests/unit/interiors.test.ts -t "interior vertex rule"`

**C2** - ✅ Zonas por vizinhança de 4 (AC 2), mapa sintético sem estrada, com lotes que isolam grupos:
- um grupo em L de 30 vértices vira 1 zona com `cells` 30.
- dois grupos de 30 que só se tocam na diagonal viram 2 zonas.
- um grupo de 24 fica com `zoneOf` −1 em todos os 24.

No seed 1337: para cada zona, `cells` = número de vértices com `zoneOf` = id, `cells` ≥ 25, e uma busca em largura de 4 vizinhos a partir de um vértice da zona alcança exatamente esses vértices.
Proof: `npx vitest run tests/unit/interiors.test.ts -t "zones are 4-connected groups of at least 25"`

**C3** - ✅ Tipo e medidas da zona (AC 3): em mapa sintético, zona com centroide em (500, 0) é `downtown` e com centroide em (500.1, 0) é `outer`. No seed 1337, para toda zona: `kind` segue a regra do centroide, `centroid` é a média dos vértices (± 1e-6), `areaM2` = `cells` × 16 e `bbox` contém todos os vértices.
Proof: `npx vitest run tests/unit/interiors.test.ts -t "zone kind and measures"`

**C4** - ✅ `facadeDist` (AC 4): em mapa sintético com um lote 10 × 10 girado 30° em (0, 0), um vértice interior a 12 m da borda (medido no teste por geometria) tem `facadeDist` 12 ± 0.01, e um a 80 m tem 60. No seed 1337, 200 vértices interiores sorteados pelo teste batem com a distância exata ao footprint mais próximo ± 0.01 (ou 60 quando passa de 60).
Proof: `npx vitest run tests/unit/interiors.test.ts -t "facade distance"`

**C5** - ✅ Determinismo (AC 5): duas gerações do seed 1337 dão `zoneOf`, `facadeDist`, `zones` e `InteriorProps` iguais campo a campo; o seed 1338 dá `zoneOf` diferente em pelo menos 1000 vértices.
Proof: `npx vitest run tests/unit/interiors.test.ts -t "interiors and props are deterministic"`

**C6** - ✅ Seed 1337 tem pelo menos 1 zona `downtown` e 1 `outer` (AC 6).
Proof: `npx vitest run tests/unit/interiors.test.ts -t "seed 1337 has both zone kinds"`

**C7** - ✅ Os módulos novos `BlockInteriors.ts`, `InteriorProps.ts`, `interiorMotion.ts` e a função pura de cor do terreno estão na lista de módulos puros e não importam `three` nem `@dimforge/rapier3d-compat` (door 1, door 2).
Proof: `npx vitest run tests/unit/purity.test.ts -t "pure modules do not import three or rapier"`

### S2 - O chão deixa de ser preto · 9 files · 116 KB · ~29k

**C8** - ✅ Cor do terreno numa função pura `terrainColor(height, slope, noise, kind)` (`kind`: `'none' | 'downtown' | 'outer'`), componentes RGB lineares como o three guarda, tolerância 1e-6 (AC 7, AC 8):

| Caso | Resultado |
| --- | --- |
| h 10, slope 0, noise 0, `outer` ou `none` | `#3f5e36` |
| h 10, slope 0, noise +1 | `#3f5e36` × 1.08 |
| h 10, slope 0, noise −1 | `#3f5e36` × 0.92 |
| h 10, slope 0.4, noise 0 | rocha `#4d473d` (mistura cheia como hoje: `min(1, slope × 2.5)`) |
| h 0.5, slope 0, noise 0 | grama misturada 50 % com areia `#5a5242` (como hoje) |
| h 10, slope 0, noise 0, `downtown` | `#55555a` |

O ruído vem do seed, em escala de 8 m, sempre em [−1, 1] (varredura de 10 000 pontos no teste).
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "terrain color"`

**C9** - ✅ O chunk usa essa cor: no browser, a cor por vértice da malha de terreno do chunk do spawn, num vértice `downtown` interior e num vértice fora do miolo com slope < 0.05, é igual a `terrainColor` com os mesmos argumentos (± 1/255) (AC 7, AC 8).
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "ground uses the new terrain color"`

**C10** - ✅ Peso da luz rebatida `bounceWeight(zoneOf, facadeDist)`: `(−1, 0)` → 0; `(3, 0)` → 1; `(3, 12.5)` → 0.5; `(3, 25)` → 0; `(3, 40)` → 0 (AC 9). No browser, o atributo de peso por vértice do chunk do spawn é igual a `bounceWeight` do vértice em 50 vértices sorteados (± 1e-4).
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "bounce weight"`
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "ground bounce weight per vertex"`

**C11** - ✅ `groundProbe` num vértice interior `downtown` com `facadeDist` ≤ 8 (o primeiro achado a partir do spawn): luminância com `bounce: true` ≥ 2 × a com `bounce: false`, e ≤ 0.35 (AC 10).
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "ground bounce lights the block interior"`

**C12** - ✅ `groundProbe` num ponto com `facadeDist` > 40 (ou fora do miolo, a mais de 40 m de qualquer lote): |lum(true) − lum(false)| ≤ 0.05 × lum(false) (AC 11).
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "ground far from buildings is unchanged"`

**C13** - ✅ `zoneLight(zoneId, t)`, para 50 ids e t de 0 a 600 s em passos de 1/60 (AC 12):
- sempre em [0.5, 1.0];
- fora das rampas o valor é exatamente 1.0 ou 0.5, e cada patamar dura entre 20 e 60 s;
- cada rampa dura 3 s ± 1/60 e é linear (segunda diferença 0 dentro dela, ± 1e-9);
- mesmo id e mesmo t dão sempre o mesmo valor.
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "zone light holds and ramps"`

**C14** - ✅ Calma e troca garantida (AC 13): na mesma varredura de C13, |zoneLight(t + 0.5) − zoneLight(t)| ≤ 0.1 sempre; e para todas as zonas do seed 1337, entre t = 0 e t = 180 há pelo menos uma troca de patamar. No browser, o valor que o shader do terreno recebe para a zona do spawn muda entre t e t + 60 s de simulação, ou já trocou em algum ponto desses 60 s.
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "zone light is calm and always changes"`
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "ground light changes over time"`

### S3 - Quintais · 6 files · 64 KB · ~16k

**C15** - ✅ Quem ganha quintal (AC 14): no seed 1337, para todo lote, existe `Yard` com `lotIndex` dele se e só se o lote é `outer` e os vértices da grade ao longo da reta que sai do centro da fachada de fundo, para fora do lote, de 0 a 8 m (passo de 1 m, arredondado ao vértice mais próximo) são todos interiores. O predicado é recalculado no teste.
Proof: `npx vitest run tests/unit/interiorProps.test.ts -t "yard for every outer lot with 8 m behind"`

**C16** - ✅ Partes do quintal (AC 15): em todo `Yard` do seed 1337, o poste fica a distância entre 4 e 8 m da fachada de fundo, em vértice interior, com altura 2.5 m acima do terreno (± 0.01); há exatamente 6 lâmpadas, todas a no máximo 0.5 m do segmento entre o centro da fachada de fundo (a 2.2 m de altura) e o topo do poste. No browser, `summary().yards` = número de `Yard` do seed 1337, e a cabeça do poste e as lâmpadas usam material com `emissiveIntensity` > 0.
Proof: `npx vitest run tests/unit/interiorProps.test.ts -t "yard lamp and six bulbs"`
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "yards are built"`

**C17** - ✅ Balanço das lâmpadas (AC 16): `bulbOffset(t, phase, freq)` tem |valor| ≤ 0.15 para t de 0 a 60 s; a frequência atribuída a cada lâmpada do seed 1337 está em [0.2, 0.4] Hz; `bulbOffset` com a mesma fase e t separados por 1/freq dá o mesmo valor (± 1e-9). No browser, a posição de uma lâmpada lida da malha (matriz de instância ou uniform de tempo aplicado) muda entre dois quadros separados por 0.5 s.
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "string lights sway"`
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "yard bulbs sway"`

**C18** - ✅ Piscinas (AC 17): no seed 1337, a fração de quintais com `Pool` está em [0.2, 0.4]; toda piscina tem `w` 4 e `d` 8; os 4 cantos e o centro, arredondados ao vértice mais próximo, são interiores da mesma zona; `y` = altura aplainada no centro + 0.05 (± 0.01).
Proof: `npx vitest run tests/unit/interiorProps.test.ts -t "pools fit in the yard"`

**C19** - ✅ Água da piscina (AC 18): no browser, o material da piscina tem normal map, o offset dele muda entre dois quadros separados por 1 s, e a cor emissiva tem azul > vermelho e verde > vermelho, com `emissiveIntensity` > 0.
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "pool water is animated"`

### S4 - Árvores e vagalumes · 8 files · 74 KB · ~19k

**C20** - ✅ Onde nascem árvores (AC 19): no seed 1337, toda `Tree` está num vértice interior de zona `outer` com `facadeDist` ≥ 6 e inclinação ≤ 0.35 (pela diferença central do heightmap aplainado, como o terreno); a menor distância entre duas árvores é ≥ 7 m (todas as duplas, por grade de busca); em toda zona, árvores ≤ `areaM2` / 120; e há pelo menos 1 árvore.
Proof: `npx vitest run tests/unit/interiorProps.test.ts -t "trees on outer interior ground"`

**C21** - ✅ Altura (AC 20): toda árvore tem `height` em [5, 10], e o seed 1337 tem árvores abaixo de 6 e acima de 9.
Proof: `npx vitest run tests/unit/interiorProps.test.ts -t "tree heights between 5 and 10"`

**C22** - ✅ Balanço da copa (AC 21): `crownSway(t, x, z)` tem |deslocamento horizontal| ≤ 0.3 m para t de 0 a 60 s em 100 posições; a frequência por posição fica em [0.2, 0.4] Hz. No browser, o uniform de tempo do material da copa avança entre dois quadros e as matrizes de instância dos troncos não mudam entre esses quadros.
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "tree crowns sway"`
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "tree crowns sway and trunks stay"`

**C23** - ✅ Colliders dos troncos (AC 22): com `RAPIER.init()` e o `WorldPhysics` do seed 1337, há um collider por árvore (`physics.trees.length` = número de `Tree`), cada um centrado na árvore (± 0.01 em x e z) e tocando o chão.
Proof: `npx vitest run tests/physics/interiors.test.ts -t "one collider per tree trunk"`

**C24** - ✅ Batida no tronco (AC 22): no browser, o carro é teleportado a 15 m de uma árvore, de frente para ela, com 40 km/h; com `W` segurado, a velocidade fica abaixo de 5 km/h em algum instante até 1 s depois do primeiro contato (distância horizontal ao tronco ≤ 3 m).
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "car stops at a tree trunk"`

**C25** - ✅ Vagalumes (AC 23): no browser, `summary().fireflies` ≤ 600 em high e ≤ 300 em low (reinício com `?quality=low`), e > 0 nos dois; `fireflyMotion` puro dá velocidade ≤ 0.5 m/s entre quaisquer dois passos de 1/60 em 60 s, e frequência de pulso em [0.3, 0.6] Hz para 200 vagalumes.
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "fireflies drift and pulse slowly"`
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "fireflies within budget"`

### S5 - Obras no centro · 7 files · 63 KB · ~16k

**C26** - ✅ Onde há obra (AC 24): no seed 1337, os canteiros são exatamente as zonas `downtown` com `areaM2` ≥ 1500, em ordem de área decrescente, cortadas em 6; cada canteiro fica no centroide da zona se ele cai num vértice interior da zona, senão no vértice interior da zona mais próximo do centroide. Em mapa sintético com 8 zonas `downtown` de 1600 m², há 6 canteiros.
Proof: `npx vitest run tests/unit/interiorProps.test.ts -t "construction sites in the largest downtown zones"`

**C27** - ✅ Guindaste (AC 25): todo canteiro tem `towerHeight` em [40, 60] e `jibLength` 30; `jibAngle(t, period)` completa 2π em `period`, com o `period` de cada canteiro em [90, 150] s, e é contínuo (passo de 1/60 muda no máximo 2π/90/60 + 1e-9). No browser, com pelo menos 1 canteiro, a rotação da lança lida da cena muda entre dois quadros separados por 1 s.
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "crane jib turns slowly"`
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "construction crane turns"`

**C28** - ✅ Farol do guindaste (AC 26): `beaconOn(t)` é true se e só se `t mod 1` < 0.2 (casos 0, 0.19, 0.2, 0.5, 1.1, 1.25). No browser, o `emissiveIntensity` da luz vermelha é > 0 com `beaconOn` true e 0 com false, lido em dois instantes.
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "crane beacon blinks at 1 Hz"`

**C29** - ✅ Holofotes (AC 27): todo canteiro tem 2 holofotes; `floodSweep(t, base)` fica em [base − 30°, base + 30°] e repete a cada 20 s (± 1e-9). No browser, `beamProbe(0)`: luminância no facho > 1.5 × a luminância fora dele.
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "floodlights sweep 30 degrees in 20 s"`
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "construction floodlight lights the ground"`

**C30** - ✅ Collider da torre (AC 28): no `WorldPhysics` do seed 1337, há um collider por canteiro (`physics.cranes.length`), centrado na base da torre (± 0.01 em x e z).
Proof: `npx vitest run tests/physics/interiors.test.ts -t "one collider per crane tower"`

### S6 - Pedestres · 6 files · 90 KB · ~23k

**C31** - ✅ Orçamento (AC 29): `walkerBudget(zonesInRange, quality)` = `min(cap, floor(Σ areaM2 × 3 / 1000))`, com `cap` 400 em high e 200 em low; casos: 10 000 m² → 30; 200 000 m² high → 400; 200 000 m² low → 200; 0 → 0. No browser, depois de 2 s parado no spawn, todo pedestre ativo está a ≤ 300 m do carro e `walkersActive` ≤ 400 e > 0.
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "walker budget"`
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "walkers near the car"`

**C32** - ✅ Caminhada (AC 30): simulando 20 pedestres do seed 1337 por 60 s em passos de 1/60 com o carro longe, todo trecho liga dois vértices interiores da mesma zona, todo ponto do trecho amostrado a cada 1 m arredonda para vértice interior dessa zona, e a velocidade em todo passo fora da fuga está em [1.2, 1.6] m/s.
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "walkers stay inside their zone"`

**C33** - ✅ Balanço do corpo (AC 31): `walkerBob(t)` fica em [−0.03, 0.03] m e repete a cada 0.5 s (± 1e-9).
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "walker bob"`

**C34** - ✅ Fuga (AC 32): num mapa sintético com uma zona 60 × 60 m, um pedestre em (0, 0) e o carro parado em (5, 0): a cada passo a velocidade dele é 3 m/s (± 0.01) e a distância ao carro cresce, até chegar a ≥ 15 m; depois volta a andar a [1.2, 1.6] m/s; todo ponto dele fica em vértice interior da zona. No browser, com o carro teleportado a 5 m de um pedestre ativo e parado, depois de 4 s a distância entre os dois é ≥ 12 m.
Proof: `npx vitest run tests/unit/interiorMotion.test.ts -t "walker flees the car"`
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "walkers step away from the car"`

**C35** - ✅ Sem collider de pedestre (AC 33): o número de colliders do mundo no browser é igual à soma dos colliders esperados (terreno, estradas, guarda-corpos, pilares, prédios, paredes, troncos, torres) e não muda depois de 5 s com pedestres ativos.
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "walkers have no colliders"`

### S7 - Leve como antes · 4 files · 18 KB · ~5k

**C36** - ✅ Continuam verdes, sem mudar asserções, com o miolo preenchido (AC 34, AC 35):
- city-terrain C38, draw calls ≤ 220 nos 5 lugares;
- city-terrain C39, `ready` em até 30 s em high.

Proof: `npx playwright test tests/e2e/render.spec.ts -g "draw calls at most 220 across the world"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "ready within 30 s at high quality"`

**C37** - ✅ O `Game` monta o miolo do mesmo seed: no browser, `summary()` tem `zones`, `downtown`, `outer`, `yards`, `pools`, `trees` e `sites` iguais aos de `findBlockInteriors` + `placeInteriorProps` do seed 1337 calculados no teste (módulos importados pelo `page.evaluate` do servidor Vite) (door 1, door 2, startup config).
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "game builds the interiors from the world seed"`

**C38** - ✅ Continuam verdes, sem mudar asserções, as provas que olham telas e chão que esta feature muda:
- city-terrain C7 "car rests on the terrain heightfield" e C8 "heightfield orientation matches the heightmap";
- visual-upgrade "lit windows stay stable while the camera moves";
- facade-glint "headlight adds no facade glint", "probe detects glint without specular antialiasing" e "headlight still lights the facade".

Proof: `npx playwright test tests/e2e/world.spec.ts -g "car rests on the terrain heightfield|heightfield orientation matches the heightmap"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "lit windows stay stable while the camera moves|headlight adds no facade glint|probe detects glint without specular antialiasing|headlight still lights the facade"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| plan ACs (35) | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6 · 7 C8, C9 · 8 C8, C9 · 9 C10 · 10 C11 · 11 C12 · 12 C13 · 13 C14 · 14 C15 · 15 C16 · 16 C17 · 17 C18 · 18 C19 · 19 C20 · 20 C21 · 21 C22 · 22 C23, C24 · 23 C25 · 24 C26 · 25 C27 · 26 C28 · 27 C29 · 28 C30 · 29 C31 · 30 C32 · 31 C33 · 32 C34 · 33 C35 · 34 C36 · 35 C36 | - |
| landing doors (2) | 1 C1-C7, C37 · 2 C5, C7, C15-C18, C20, C21, C26, C37 | - |
| interior conditions (4) | estrada C1 · lote C1 · água C1 · borda C1 | - |
| zone kinds (2) | downtown C3, C6 · outer C3, C6 | - |
| terrain color cases (6) | grama C8 · +ruído C8 · −ruído C8 · rocha C8 · areia C8 · pátio C8 | - |
| bounce weight cases (5) | fora do miolo C10 · 0 m C10 · 12.5 m C10 · 25 m C10 · 40 m C10 | - |
| prop kinds (5) | yards C15, C16 · pools C18 · trees C20, C21 · sites C26, C27 · walkers C31, C32 | - |
| moving things (9) | luz da zona C13, C14 · lâmpadas C17 · água C19 · copas C22 · vagalumes C25 · lança C27 · farol C28 · holofotes C29 · pedestres C32-C34 | - |
| static colliders added (2) | troncos C23, C24 · torres C30 | - |
| quality levels (2) | high C25, C31 · low C25, C31 | - |
| beacon cases (6) | 0 C28 · 0.19 C28 · 0.2 C28 · 0.5 C28 · 1.1 C28 · 1.25 C28 | - |
| walker budget cases (4) | 10 000 m² C31 · 200 000 high C31 · 200 000 low C31 · 0 C31 | - |
| startup config: interiors assembly (1) | `src/core/Game.ts` via `CityGenerator` C37 | - |

- **Checks cruzando a fronteira do browser:** C9, C10 (2ª prova), C11, C12, C14 (2ª), C16 (2ª), C17 (2ª), C19, C22 (2ª), C24, C25 (2ª), C27 (2ª), C28, C29 (2ª), C31 (2ª), C34 (2ª), C35-C38.
- **Checks com física real:** C23, C30.

## Test policy

Mesmas linhas das features anteriores.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence (forma prevista; o Verifier reconta sobre o diff):
- **`BlockInteriors.ts`** → decides, reached across a boundary (chega ao jogo pelo `Game`). Própria: C1-C6. Fronteira: C37.
- **`InteriorProps.ts`** → decides, reached across a boundary. Própria: C15, C16, C18, C20, C21, C26. Fronteira: C16 (2ª), C37.
- **`interiorMotion.ts`** e `terrainColor` → decides, reached across a boundary. Própria: C8, C10, C13, C14, C17, C22, C25, C27-C29, C31-C34. Fronteira: as segundas provas Playwright de cada um.
- **`WorldPhysics.ts`** → instrumentation que monta colliders a partir de `InteriorProps`; provado com Rapier real em C23, C30 e no browser em C24, C35.
- **`ChunkManager.ts`, `CityScene.ts`, `Game.ts`** → instrumentation; cobertos pelas provas Playwright (C9-C12, C14, C16, C17, C19, C22, C24, C25, C27-C29, C31, C34-C37).

Cost: 25 provas unitárias em 4 arquivos, 2 de física real em 1 arquivo e 20 Playwright num arquivo novo.

## Swept

- **validation**: C1 (borda do mapa, água), C10 (peso só dentro do miolo e até 25 m), C25 e C31 (limites de quantidade por qualidade)
- **failure modes**: existing - falha de geração no boot cai no overlay de erro (`src/main.ts`, city-terrain); C36 (boot continua em até 30 s)
- **idempotency**: C5 (mesmo seed, mesmo mapa e mesmos objetos); C13 (mesmo id e mesmo t, mesmo nível)
- **authorization**: n/a - jogo local, sem contas
- **concurrency**: n/a - geração síncrona no boot; o movimento roda no frame de render e os pedestres no mesmo laço, sem workers
- **data lifecycle**: C31 (pedestres criados e descartados conforme a distância ao carro); existing - as malhas do terreno seguem o descarte dos chunks (city-terrain door 7)
- **dependency failure**: existing - sem textura, o material cai em cor chapada como os outros materiais do mundo (visual-upgrade C2); os objetos do miolo são geometria procedural, sem asset externo
- **state transitions**: C13 (aceso → rampa → meia-luz), C34 (andando → fugindo → andando)
- **observability**: C37 - `__game.world.interiors.summary()` e as sondas `groundProbe` e `beamProbe` em DEV

## Handoff

- **Estimativa por slice** (`wc -c` dos existentes, novos pelo tamanho dos análogos, ÷ 4):
  - S1 ≈ 18k: `LotGenerator` 10 KB, `RoadGenerator` 17 KB, `TerrainGenerator` 9 KB, `worldMath` 4 KB, `CityGenerator` 8 KB, `BlockInteriors` novo ~12 KB, teste ~10 KB.
  - S2 +29k → 47k: `ChunkManager` 14 KB, `CityScene` 20 KB, `Game` 44 KB, `interiorMotion` novo ~5 KB, `world.spec` 19 KB, `interiors.spec` novo ~8 KB, teste ~6 KB.
  - S3 +16k → 63k: `InteriorProps` ~8 KB, `CityScene` 20 KB, `Game` ~20 KB em parte, testes ~16 KB.
  - S4 +19k → 82k: `InteriorProps` ~6 KB, `CityScene` 20 KB, `WorldPhysics` 4 KB, `Rain` 4 KB (análogo de partículas), `Game` ~20 KB, testes ~20 KB.
  - S5 +16k → 98k: `InteriorProps` ~5 KB, `CityScene` 20 KB, `WorldPhysics` 4 KB, `Game` ~20 KB, testes ~14 KB.
  - S6 +23k → 121k: `interiorMotion` ~8 KB, `Game` 44 KB, `CityScene` 20 KB, testes ~18 KB.
  - S7 +5k → 126k: `render.spec` 6 KB, `visual.spec` ~10 KB em parte, `purity.test` 2 KB.
- **Total:** ~126k, abaixo do budget de 150k - one builder. Mecanismo: one builder (sem pergunta, cabe no budget).
- **Números de ajuste:** cores exatas da luz, geometria low-poly, shaders de balanço e de água, e como cada tipo vira `InstancedMesh` (global ou por chunk) são do build, até C1-C38 passarem. Os limites não mudam. Se o orçamento de 220 draw calls ou o boot de 30 s não couberem com tudo, é stop-and-ask (a troca seria cortar densidade ou um tipo de objeto, decisão do usuário).
