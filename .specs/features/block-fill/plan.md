# block-fill

## Problem

O miolo das quadras parece um abismo. O usuário disse (2026-09-26): "na parte 'de dentro' dos predios, entre rua > predio > espaço vazio > predio > rua, dá a sensação que voce vai cair no nada, porq apesar de existir terreno, é todo escuro". Pediu que o preenchimento "nao seja estático" e, depois de ver as ideias, que quintais, árvores, obras, pedestres e a cor da grama entrem "de uma vez".

Hoje, lido no código:
- Os prédios ficam recuados `w/2 + 3 m + depth/2` da rua (`src/world/lots/LotGenerator.ts:217`). Entre duas fileiras de costas sobram ~13–25 m de terreno; nos morros, áreas bem maiores.
- Esse terreno é grama escura `#2e4229` com rugosidade 0.95 (`src/world/ChunkManager.ts:238`, `:110`), em todo o mapa.
- A única luz ali é a hemisférica 0.35 e a lua 0.35 (`src/world/Environment.ts:55-59`). Postes só na beira da rua. A névoa `#05060d` engole o resto.
- Não há nada no miolo, e nenhum sistema do jogo sabe onde fica esse espaço.

Quando isto sair:
- O chão perto dos prédios recebe luz quente rebatida das janelas, que muda devagar. A grama fica mais clara e variada; no centro, o miolo vira pátio de concreto.
- Atrás das casas há quintais com poste de luz, cordão de lâmpadas balançando e, em alguns, piscina com água animada.
- Nas áreas de fora há árvores balançando ao vento e vagalumes.
- Nas áreas grandes do centro há canteiros de obra com guindaste girando, luz vermelha piscando no topo e holofotes varrendo o chão.
- Pedestres andam pelo miolo e saem do caminho quando o carro chega perto.

## Flow

Reusa o heightmap aplainado, a `RoadNetwork`, os `Lot`, a grade de 4 m e o material do terreno dos chunks, o `WorldPhysics` para colliders estáticos, o PRNG `mulberry32` por seed e o padrão de `InstancedMesh` por tipo já usado em fachadas, postes e letreiros.

1. `world/CityGenerator` (exists) - depois de estradas e lotes, chama o gerador de interiores e o de objetos do miolo
2. `world/interiors/BlockInteriors` (door 1) - puro: marca as células livres da grade de 4 m, agrupa em zonas, classifica centro ou fora e mede a distância de cada célula ao prédio mais próximo
3. `world/interiors/InteriorProps` (door 2) - puro: a partir das zonas e dos lotes, posiciona quintais, piscinas, árvores, canteiros de obra e as rotas dos pedestres
4. `world/interiors/interiorMotion` (new, no door - placement per conventions) - puro: nível de luz de cada zona, balanço de árvore e de lâmpada, giro do guindaste, pisca do farol, varredura do holofote, passo e fuga do pedestre, tudo em função do tempo
5. `world/ChunkManager` (exists) - o terreno ganha a cor nova da grama e do pátio e, por vértice, a zona e a distância ao prédio para a luz rebatida
6. `world/CityScene` (exists) - monta um `InstancedMesh` por tipo de objeto do miolo e atualiza a cada frame o que se move
7. `world/WorldPhysics` (exists) - colliders estáticos para tronco de árvore, base de guindaste e borda de piscina, criados no boot como os prédios
8. `core/Game` (exists) - atualiza pedestres perto do carro e expõe `__game.world.interiors` em DEV

## Impact

| Front | What changes |
| --- | --- |
| domain | novo termo `BlockInteriors`: o mapa do chão livre em zonas `downtown` / `outer` (door 1). Lido pelo `InteriorProps` e pelas features seguintes (1.8) |
| domain | novo termo `InteriorProps`: o que existe no miolo e onde (door 2). Lido por `CityScene`, `WorldPhysics` e `Game` |
| domain | cor da grama: `#2e4229` fixa passa a uma grama mais clara com variação; o miolo do centro vira concreto. Muda a cara do mapa todo. A rocha nas encostas e a areia na beira d'água continuam |
| física | novos colliders estáticos no miolo (tronco, base de guindaste, borda de piscina). O carro que entra no miolo bate neles como bate nos prédios |
| checks existentes | continuam valendo: city-terrain C38 (draw calls ≤ 220), C39 (`ready` em até 30 s), C7/C8 (carro assenta no terreno), visual-upgrade C41 (janelas estáveis com a câmera andando), facade-glint C1-C3, car-feel e car-handling (dirigibilidade no plano, fora do mapa) |
| stored data | nothing to migrate - nada é persistido; tudo sai do seed |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside. `window.__game.world.interiors` (só DEV) expõe o resumo das zonas, a contagem de objetos, os pedestres ativos e sondas de luminância.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. mapa do miolo das quadras | `src/world/interiors/BlockInteriors.ts` puro exporta `interface BlockInteriors { spacing: number /* 4 */; origin: number /* -1536 */; size: number /* 769 */; zoneOf: Int32Array /* por vértice da grade, −1 = não é interior */; facadeDist: Float32Array /* m até o footprint de lote mais próximo, limitado a 60 */; zones: InteriorZone[] }`, `interface InteriorZone { id: number; kind: 'downtown' \| 'outer'; cells: number; areaM2: number; centroid: { x: number; z: number }; bbox: { minX: number; minZ: number; maxX: number; maxZ: number } }` e `findBlockInteriors(carved: Heightmap, network: RoadNetwork, lots: Lot[]): BlockInteriors`. Mesma grade do heightmap (AD-010): `spacing`, `origin` e `size` vêm do `Heightmap` recebido (4, -1536 e 769 no jogo; um mapa sintético de teste tem outros) e a borda de 8 m é contada a partir das paredes em ±1536 (`WORLD_HALF`). Registrado como AD-012 | cada tipo de objeto amostrar o "chão livre" por conta própria: critérios diferentes de "livre" põem árvore em estrada ou pedestre dentro de prédio, e nenhum sabe a zona do outro |
| 2. objetos do miolo | `src/world/interiors/InteriorProps.ts` puro exporta `placeInteriorProps(seed: number, interiors: BlockInteriors, lots: Lot[], carved: Heightmap): InteriorProps` (o `carved` dá a altura de poste, piscina, árvore e canteiro) com `interface InteriorProps { yards: Yard[]; pools: Pool[]; trees: Tree[]; sites: ConstructionSite[]; walkers: WalkerSpawn[] }`; cada item tem posição no mundo, `zoneId` e o que o descreve (`Yard { lotIndex; lamp: {x,y,z}; bulbs: {x,y,z}[] }`, `Pool { x; y; z; w; d; rotation }`, `Tree { x; y; z; height; crown }`, `ConstructionSite { x; y; z; towerHeight; jibLength; floodlights: {x,y,z,heading}[] }`, `WalkerSpawn { zoneId; x; z }`). Os mesmos dados alimentam render e física | posicionar dentro de `CityScene` e de `WorldPhysics` separadamente: render e colliders divergem (árvore visível sem collider, ou collider invisível), e nada disso seria testável sem three nem rapier |

- Nothing else in this change is hard to reverse. Cores, forças de luz, densidades e ritmos são ajuste.

## Criteria

### S1: o jogo sabe onde fica o miolo (P1)

**Acceptance Criteria**

1. The system SHALL marcar como interior um vértice da grade de 4 m somente se ele está a pelo menos `w/2 + 2 m` do eixo de toda estrada (`w` = largura da estrada), fora do footprint de todo lote expandido em 1 m, com altura aplainada ≥ `WATER_Y + 0.5` e a pelo menos 8 m da borda do mapa
2. The system SHALL agrupar os vértices interiores em zonas por vizinhança de 4; um grupo com menos de 25 vértices (400 m²) não vira zona e fica com `zoneOf` = −1
3. The system SHALL classificar a zona como `downtown` quando o centroide tem |x| ≤ 500 e |z| ≤ 500 (`DOWNTOWN_HALF`), e `outer` nos outros casos
4. The system SHALL guardar em `facadeDist` a distância horizontal de cada vértice interior à borda do footprint de lote mais próximo, limitada a 60 m
5. WHEN o mapa e os objetos são gerados duas vezes com o mesmo seed THEN the system SHALL produzir `BlockInteriors` e `InteriorProps` idênticos
6. WHEN o seed é 1337 THEN the system SHALL ter pelo menos 1 zona `downtown` e 1 zona `outer`

**Independent test:** `npx vitest run tests/unit/interiors.test.ts`

### S2: o chão do miolo deixa de ser preto (P1)

**Acceptance Criteria**

7. The system SHALL pintar a grama com base `#3f5e36` e variação de brilho de ±8 % por ruído do seed em escala de 8 m, no lugar de `#2e4229`; a mistura com rocha por inclinação e com areia perto da água continua
8. The system SHALL pintar os vértices de zonas `downtown` com concreto `#55555a` (pátio), com a mesma variação de ±8 %
9. The system SHALL somar ao terreno de cada vértice interior uma luz emissiva quente proporcional a `max(0, 1 − facadeDist / 25)` × o nível da zona, e nada fora do miolo ou a mais de 25 m de um prédio
10. WHEN a câmera olha o chão de um miolo do centro a até 8 m de um prédio, sem farol e sem chuva THEN the system SHALL mostrar luminância média do quarto central da tela de pelo menos 2× a da mesma cena com a luz rebatida desligada, e no máximo 0.35
11. WHEN a câmera olha o chão a mais de 40 m de qualquer prédio THEN the system SHALL mudar a luminância média em no máximo 5 % ao ligar ou desligar a luz rebatida
12. The system SHALL dar a cada zona um nível de luz sempre em [0.5, 1.0], alternando entre 1.0 e 0.5 com rampa linear de 3 s e segurando cada estado de 20 a 60 s (duração pelo PRNG do seed a partir do id da zona)
13. WHILE o jogo roda the system SHALL mudar o nível de uma zona em no máximo 0.1 a cada 0.5 s, e WHEN passam 180 s de tempo simulado THEN todas as zonas SHALL ter trocado de estado pelo menos uma vez

**Independent test:** `npx vitest run tests/unit/interiorMotion.test.ts` e `E2E_PORT=<porta> npx playwright test tests/e2e/interiors.spec.ts -g "ground"`

### S3: quintais atrás das casas (P1)

**Acceptance Criteria**

14. The system SHALL criar um quintal para cada lote `outer` que tem, atrás da fachada de fundo, pelo menos 8 m de vértices interiores na direção do fundo do lote
15. The system SHALL pôr no quintal um poste de jardim de 2.5 m a uma distância entre 4 e 8 m da fachada de fundo, com cabeça emissiva quente, e um cordão de 6 lâmpadas emissivas entre a fachada e o poste
16. WHILE o jogo roda the system SHALL balançar cada lâmpada do cordão com deslocamento `A · sin(2π · f · t + fase)`, com A ≤ 0.15 m, f entre 0.2 e 0.4 Hz e fase pela posição
17. The system SHALL pôr piscina em 30 % dos quintais (sorteio pelo seed), retangular de 4 × 8 m, somente onde os 4 cantos e o centro caem em vértices interiores da mesma zona, com a água na altura do terreno + 0.05 m
18. WHILE o jogo roda the system SHALL animar a água da piscina deslocando o offset do normal map com o tempo, e dar a ela um brilho emissivo ciano

**Independent test:** `npx vitest run tests/unit/interiorProps.test.ts -t "yard"` e `E2E_PORT=<porta> npx playwright test tests/e2e/interiors.spec.ts -g "yard"`

### S4: árvores ao vento e vagalumes (P1)

**Acceptance Criteria**

19. The system SHALL plantar árvores somente em vértices interiores de zonas `outer` com `facadeDist` ≥ 6 m e inclinação do terreno ≤ 35 %, com distância mínima de 7 m entre árvores e no máximo 1 árvore por 120 m² de zona
20. The system SHALL dar a cada árvore altura entre 5 e 10 m pelo seed
21. WHILE o jogo roda the system SHALL balançar a copa de cada árvore (o tronco fica parado) com deslocamento horizontal ≤ 0.3 m, frequência entre 0.2 e 0.4 Hz e fase pela posição
22. The system SHALL criar para cada tronco um collider estático; WHEN o carro bate de frente num tronco a 40 km/h THEN the system SHALL deixar a velocidade do carro abaixo de 5 km/h em até 1 s
23. The system SHALL mostrar vagalumes perto das árvores, no máximo 600 em qualidade high e 300 em low, cada um se movendo a no máximo 0.5 m/s e pulsando o brilho a uma frequência entre 0.3 e 0.6 Hz

**Independent test:** `npx vitest run tests/unit/interiorProps.test.ts -t "tree"` e `E2E_PORT=<porta> npx playwright test tests/e2e/interiors.spec.ts -g "tree"`

### S5: canteiros de obra no centro (P2)

**Acceptance Criteria**

24. The system SHALL criar um canteiro de obra no centroide de cada zona `downtown` com área ≥ 1500 m², no máximo 6 no mapa (os de maior área primeiro); o centroide precisa ser vértice interior, senão o vértice interior mais próximo dele
25. The system SHALL montar no canteiro um guindaste com torre entre 40 e 60 m e lança de 30 m; WHILE o jogo roda a lança SHALL girar em torno da torre com uma volta completa entre 90 e 150 s
26. WHILE o jogo roda the system SHALL piscar uma luz vermelha no topo da torre a 1 Hz, acesa 0.2 s de cada segundo
27. The system SHALL pôr 2 holofotes por canteiro que iluminam o chão; WHILE o jogo roda cada holofote SHALL varrer ±30° em torno da sua direção num ciclo de 20 s, e o chão sob o facho SHALL ter luminância maior que fora dele
28. The system SHALL criar um collider estático na base da torre do guindaste

**Independent test:** `npx vitest run tests/unit/interiorProps.test.ts -t "construction"` e `E2E_PORT=<porta> npx playwright test tests/e2e/interiors.spec.ts -g "construction"`

### S6: pedestres no miolo (P2)

**Acceptance Criteria**

29. The system SHALL manter pedestres somente a até 300 m do carro, com no máximo 400 ativos em qualidade high e 200 em low, na densidade de 3 por 1000 m² de zona
30. WHILE um pedestre anda the system SHALL movê-lo em trechos retos entre vértices interiores da mesma zona a uma velocidade entre 1.2 e 1.6 m/s, e todo ponto do trecho amostrado a cada 1 m SHALL cair num vértice interior dessa zona
31. WHILE um pedestre anda the system SHALL balançar o corpo verticalmente ±3 cm a 2 Hz
32. IF o carro chega a menos de 8 m de um pedestre THEN the system SHALL afastá-lo do carro a 3 m/s, ainda só em vértices interiores da zona, até ficar a 15 m ou mais
33. The system SHALL não criar collider para pedestres: o carro nunca bate em pedestre

**Independent test:** `npx vitest run tests/unit/interiorMotion.test.ts -t "walker"` e `E2E_PORT=<porta> npx playwright test tests/e2e/interiors.spec.ts -g "walker"`

### S7: o mundo continua leve (P1)

**Acceptance Criteria**

34. The system SHALL manter as draw calls em no máximo 220 nos 5 lugares da city-terrain C38, com o miolo preenchido
35. The system SHALL chegar a `ready` em até 30 s em qualidade high (city-terrain C39), com o miolo gerado

**Independent test:** `E2E_PORT=<porta> npx playwright test tests/e2e/render.spec.ts tests/e2e/visual.spec.ts -g "draw calls|ready within 30 s"`

## Out of scope

| Excluded | Why |
| --- | --- |
| vapor de dutos, holofotes para o céu, estacionamentos com carros (ideia E) | o usuário listou quintais, árvores, obras, pedestres e grama; E fica para a 1.8 |
| gatos e trem de superfície (resto da ideia F) | idem; o trem precisa de trilho próprio. Fica para a 1.8 |
| pedestre atropelável, ragdoll, som de pedestre | jogo de corrida sem violência; pedestre sempre sai do caminho (AC 32, AC 33) |
| objetos no miolo aparecendo no minimapa | não pedido |
| árvores nas calçadas e canteiros de rua | só o miolo foi pedido |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| cor nova da grama e do pátio | grama `#3f5e36` ±8 %, pátio de concreto `#55555a` no centro | "cor da grama" pedida; mais clara que a atual sem virar dia; concreto é o chão de pátio de prédio | y |
| luz rebatida | alcance de 25 m, luminância no máximo 0.35, trocas a cada 20–60 s com rampa de 3 s | janela acesa à noite; ritmo calmo como os letreiros ("low-cortisol", 2026-09-25) | y |
| densidades | 1 árvore por 120 m², piscina em 30 % dos quintais, até 6 obras, 3 pedestres por 1000 m² (até 400) | preencher sem estourar draw calls e boot | y |
| pedestres | aparência de silhueta low-poly (cápsula com cabeça), cores escuras variadas; somem e reaparecem além de 300 m | estilo noturno; pedestres detalhados custariam modelo e animação | y |
| obras | guindaste de torre + lança, farol vermelho, 2 holofotes; sem prédio em construção | a parte que se mexe é o guindaste e o holofote | y |
| qualidade low | tudo ligado, com metade dos vagalumes e dos pedestres | o miolo vazio é o problema em qualquer qualidade | y |
| menor zona | 400 m² (25 vértices) | abaixo disso é sobra entre dois lotes | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| tela do jogo | miolo perto de prédio | AC 7-11 |
| tela do jogo | terreno longe de prédio, morros sem casas | AC 7, AC 11 - grama nova, sem luz rebatida |
| tela do jogo | o que se move | AC 12, 13, 16, 18, 21, 23, 25-27, 30-32 |
| tela do jogo | carro entrando no miolo | AC 22, AC 28 (bate em tronco e guindaste), AC 32, AC 33 (pedestre sai do caminho) |
| tela do jogo | loading e erro | existing - a geração roda dentro do boot atual; erro cai no overlay de `src/main.ts` |
| HUD e minimapa | objetos do miolo | n/a - fora de escopo |

## Sources

- Usuário, 2026-09-26: pedido do miolo escuro, "algo que nao seja estático", escolha das ideias A, B, C, D e F, e "ja coloque quintais, árvores, obras e pedestres, alem da cor da grama, de uma vez"
- `.specs/STATE.md` AD-008 (PRNG por seed), AD-010 (grade de 4 m do terreno, chunks de 512 m)
