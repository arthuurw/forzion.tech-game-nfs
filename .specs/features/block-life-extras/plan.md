# block-life-extras

## Problem

O miolo das quadras ganhou quintais, árvores, obras e pedestres na block-fill, mas a cidade ainda não tem as marcas de uma Bayview à noite: nada cruza o céu, nada sobe do chão, os pátios de concreto do centro estão vazios de carros e não há bicho nenhum. O usuário deixou isso para a 1.8 quando escolheu as ideias da block-fill (`.specs/features/block-fill/plan.md`, Out of scope: "vapor de dutos, holofotes para o céu, estacionamentos com carros (ideia E)" e "gatos e trem de superfície (resto da ideia F)") e pediu agora (2026-09-27): "bora planejar a block-life-extras e tambem as Pendências menores".

As pendências vêm do relatório da races (`.specs/features/races/verification.md`, notas não bloqueantes):
- A pintura dos oponentes sai escura. A cor é um tingimento (`material.color`) que multiplica a textura, e a carroceria do `car.glb` aponta para o quadrado laranja `#ff7e44` do `colormap.png` (medido em 2026-09-27: 512 × 512, paleta; carroceria lê `#ee6445`-`#fa6b41`, vidro `#6d6e83`, rodas `#36363a`). `#2f8cff` × laranja dá um azul quase preto. Quem joga não distingue BIA de CAIO de longe.
- C13 da races diz "freio", mas o carro fica parado na largada com o freio de mão (`HOLD_INPUT`), e é isso que o teste prova.
- C29 da races só aperta R em `racing`; em `countdown` o caminho não tem prova.
- C12 da races confia que o spawn fica longe dos marcadores e nunca mede os 100 m.

Quando isto sair:
- Um trem elevado corre num viaduto sobre as quatro avenidas do quadrado do centro, com as janelas acesas, e tu corres embaixo dele.
- Nos pátios do centro há carros estacionados em fileiras, de várias cores, sólidos, e grades de vapor soltando fumaça branca.
- Quatro holofotes no alto dos prédios mais altos varrem o céu.
- Gatos andam pelos quintais e pelas zonas de fora, param, sentam e fogem do carro.
- Os oponentes das corridas têm a cor deles, viva, com vidro e roda intactos; a mesma pintura vale para os carros estacionados.

## Flow

Reusa o mapa do miolo (`BlockInteriors`, AD-012), o posicionador `placeInteriorProps` (door 2 da block-fill), o PRNG `mulberry32` por seed, o padrão de `InstancedMesh` por tipo e a lista `objects()` que o espelho da rua pula (races), o `Points` com `uTime` da chuva, o passo e a fuga dos pedestres (`stepWalker`), o modelo do oponente (`Car.buildOpponentModel`: carroceria junta + rodas instanciadas) e as sondas de luminância por `readPixels` (`probeBeam`).

1. `core/Game` (exists) - no boot, depois de lotes e interiores: `placeInteriorProps` devolve também estacionamentos, grades de vapor, pontos de gato e holofotes; `buildTrainLine` (door 2) devolve a linha do trem a partir da `RoadNetwork`
2. `world/interiors/InteriorProps` (door 1, alargada) - puro: fileiras de vagas nas zonas do centro, grades de vapor no pátio, pontos de partida dos gatos nos quintais e zonas de fora, holofotes nos 4 prédios mais altos do centro
3. `world/rail/trainLine` (door 2) - puro: o laço fechado sobre as 4 avenidas de x ≈ ±300 e z ≈ ±300, cantos em arco, deck a 8 m, portais a cada 24 m fora dos cruzamentos; lê as avenidas e os cruzamentos por `world/roads/roadQuery` (new, no door - placement per conventions), que recebeu os helpers que a `race/raceRoutes` já tinha, e as corridas passam a importar dali
4. `world/interiors/interiorMotion` (exists) - puro: pose do trem em função do tempo, heading do holofote, passo, pausa e fuga do gato (generaliza `stepWalker` com uma spec de velocidade); o vapor é GLSL com gêmeo em JS, como `FIREFLY_DRIFT_GLSL`
5. `world/interiors/InteriorScene` (exists) - 1 `InstancedMesh` de carros estacionados (carroceria + rodas numa geometria, cor por instância), 1 `Points` de vapor, 1 `InstancedMesh` de gatos, 1 `InstancedMesh` de cones de holofote; atualiza por quadro o que se move
6. `world/rail/TrainScene` (new, no door - placement per conventions) - 1 malha estática (deck + portais juntos) e 1 `InstancedMesh` de 3 vagões com janelas emissivas; move os vagões pela pose pura
7. `world/WorldPhysics` (exists) - cuboides fixos para cada carro estacionado e cada coluna de portal, criados no boot como os prédios
8. `vehicle/carPaint` (door 3) - puro: o trecho GLSL que troca o laranja da paleta pela pintura e o gêmeo `recolorTexel` em JS; `vehicle/Car` (exists) injeta no material do oponente e `InteriorScene` no dos estacionados
9. `core/Game` (exists) - por quadro: `uTime` do vapor, pose do trem, holofotes, gatos perto do carro; expõe `__game.world.extras` e a leitura de cor da carroceria em DEV
10. `tests/e2e/race.spec.ts` (exists) - ganha as provas de R em `countdown` e de Enter a 100 m; `races/checks.md` C13 ganha nota datada

## Impact

| Front | What changes |
| --- | --- |
| domain | `InteriorProps` ganha `parking`, `vents`, `cats` e `searchlights` (door 1 alargada). Lidos por `InteriorScene`, `WorldPhysics` e `Game`; `walkers`, `yards`, `pools`, `trees` e `sites` não mudam |
| domain | novo termo `TrainLine`: o laço do viaduto (pontos do deck, comprimento, portais), derivado da `RoadNetwork` por regra (door 2). Lido por `TrainScene`, `WorldPhysics` e `interiorMotion` |
| domain | "pintura" de um `Car` deixa de ser tingimento e passa a ser troca do laranja da paleta (door 3). Quem depende hoje: `Car.buildOpponentModel` (`material.color`), a sonda `bodyColor` de `__game.race.opponents` e a prova C21 da races (`tests/e2e/race.spec.ts`), que continua verde porque a sonda passa a ler a pintura do mesmo lugar |
| física | novos colliders fixos no boot: 1 cuboide por carro estacionado e 1 por coluna de portal. O carro bate neles como bate nos prédios. O trem e o deck não têm collider (escolha do usuário, 2026-09-27: elevado, sem colisão) |
| render | draw calls ≤ 220 continuam (city-terrain C38, races C34). Bases medidas em 2026-09-27 no HEAD `d0a5dd2`: spawn 188, morro 80, ponte 114, baía 120, nordeste 102; grid do `circuito-centro` livre 182 e em corrida 207; `sprint-cruzada` 162 e 181. Sobram 13 no pior caso, então a decoração nova perto do centro custa no máximo 12: 1 malha por tipo (6 malhas), todas fora do espelho da rua (2 passes cada: cena e GTAO). Se a medida real passar de 220, é stop-and-ask, não troca de limite (L-019) |
| boot | `ready` em até 30 s continua (city-terrain C39) com ~250 colliders a mais |
| docs da races | `races/checks.md` C13 recebe nota datada dizendo "freio de mão" (aditiva, o texto aprovado não é reescrito); C12 e C29 ganham as provas que faltavam, listadas nos checks desta feature |
| código da races | `src/race/raceRoutes.ts` perde `findAvenue`, `avenueAxis`, `crossing`, `pointOf` e `count`, movidos sem mudança para `src/world/roads/roadQuery.ts`; as provas C1-C8 da races continuam verdes |
| câmera e fachos | a câmera de perseguição (2.5 m acima, 14° para baixo, FOV 62° parado) só mostra céu até ~18° acima do horizonte; os fachos ficaram a 80° da vertical (usuário, 2026-09-27) e aparecem na faixa de cima do quadro, mais quando o FOV abre em velocidade |
| stored data | nothing to migrate - nada é persistido; tudo sai do seed |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside. `window.__game.world.extras` (só DEV) expõe contagens, poses, a pose do trem e as sondas de pixel; `__game.race.opponents[i].bodyColor` continua e passa a ler a pintura.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. `InteriorProps` alargada | `src/world/interiors/InteriorProps.ts` mantém `placeInteriorProps(seed, interiors, lots, carved)` e `interface InteriorProps` ganha `parking: ParkedCar[]; vents: Vent[]; cats: CatSpawn[]; searchlights: Searchlight[]` com `ParkedCar { x; y; z; heading; paint: string; zoneId }`, `Vent { x; y; z; zoneId }`, `CatSpawn { zoneId; x; z; yard: number \| null }`, `Searchlight { x; y; z; lotIndex; period: number; phase: number }`. AD-012 não muda | um `placeExtras()` separado: dois passes sobre as mesmas zonas não se veem (grade de vapor dentro de uma vaga, gato nascendo debaixo de um carro); é o mesmo argumento da door 2 da block-fill |
| 2. linha do trem por regra | `src/world/rail/trainLine.ts` puro exporta `interface TrainLine { points: Float32Array /* x, y, z do deck a cada 2 m */; length: number; frames: Array<{ x: number; z: number; y: number; heading: number }> }` e `buildTrainLine(network: RoadNetwork): TrainLine \| null` pela regra "quadrado das avenidas de x ≈ ±300 e z ≈ ±300, cantos em arco de 20 m, deck 8 m acima do asfalto, portais a cada 24 m e a pelo menos 12 m de qualquer outra estrada"; `null` com `console.warn` se uma avenida falta. Nunca coordenada escrita à mão (estende a AD-016 ao mundo) | reusar o `route` do `RaceDef` `circuito-centro`: acopla `src/world` a `src/race`, e o canto da corrida é uma junção seca que um deck não consegue seguir |
| 3. repintura no shader | `src/vehicle/carPaint.ts` puro exporta `PAINT_SWATCH = '#ff7e44'`, `PAINT_HUE_TOLERANCE` (graus), `CAR_PAINT_GLSL` (trecho para depois de `map_fragment`: texel com matiz a até a tolerância do laranja e saturação ≥ 0.5 vira `pintura × luminância do texel / luminância do laranja`; o resto fica) e o gêmeo `recolorTexel(texel: [r,g,b], paint: [r,g,b]): [r,g,b]`. `Car` (oponente) injeta por `onBeforeCompile` com o uniform `uPaint`; os estacionados usam a mesma string com a cor por instância. `material.color` volta a branco | manter o tingimento (é o sintoma); material sem `map` só na carroceria (a primitiva `body` também carrega vidro `#6d6e83` e frisos `#3d3d44`, que virariam cor de pintura) |

- Nothing else in this change is hard to reverse. Densidades, velocidades, cores, tamanhos e ritmos são ajuste.
- A door 2 estende a AD-016 (nada escrito à mão sobre a rede) para fora das corridas; registrar em `.specs/STATE.md` como AD-017 no build.

## Criteria

### S1: pintura viva dos oponentes (P1)

Os oponentes têm a cor deles, com vidro e roda como no modelo.

**Acceptance Criteria**

1. The system SHALL trocar, no texel da carroceria, todo texel com matiz a no máximo `PAINT_HUE_TOLERANCE` = 25° do laranja `#ff7e44` e saturação ≥ 0.5 pela pintura escalada pela luminância relativa do texel (`recolorTexel`), e SHALL deixar intacto qualquer outro texel (vidro `#6d6e83`, roda `#36363a`, friso `#3d3d44`)
2. The system SHALL usar em GLSL e em JS a mesma conta: `CAR_PAINT_GLSL` e `recolorTexel` vêm do mesmo arquivo e as constantes (`PAINT_SWATCH`, tolerância, corte de saturação) aparecem uma vez cada
3. WHEN um oponente de pintura `#2f8cff` está parado no grid a até 12 m da câmera THEN the system SHALL mostrar no teto da carroceria (média de 9 × 9 px no ponto projetado, lida por `readPixels`) uma cor com matiz a no máximo 30° da pintura e luminância de pelo menos 0.6 × a do teto do carro do jogador lido do mesmo jeito na mesma pose
4. The system SHALL manter `__game.race.opponents[i].bodyColor` igual à pintura do oponente `i` e o `material.color` da carroceria em `#ffffff`
5. WHERE `car.glb` falta the system SHALL pintar o placeholder com `material.color` = pintura, como hoje (AD-009)

**Independent test:** começar `circuito-centro` e olhar os 3 carros no grid: azul, amarelo e verde vivos, vidro escuro.

### S2: provas que faltaram na races (P1)

R durante a contagem e Enter a 100 m ficam provados.

**Acceptance Criteria**

6. WHILE a sessão está em `countdown`, WHEN o carro é levado a 20 m do lugar 3 do grid e R é apertado THEN the system SHALL pôr o carro parado (< 1 km/h) a no máximo 0.5 m do lugar 3, com heading a no máximo 5° do lugar, e o relógio SHALL continuar em 0
7. WHEN o carro está parado sobre a estrada a exatamente 100 m (± 0.5 m) do marcador mais próximo e Enter é apertado THEN the system SHALL manter `free`, o mesmo número de corpos rígidos e o carro a no máximo 0.5 m de onde estava
8. The system SHALL registrar em `.specs/features/races/checks.md`, abaixo de C13, uma nota datada de que o carro é segurado pelo freio de mão (`handbrake: true, brake: false`), sem reescrever o texto aprovado

**Independent test:** `npx playwright test tests/e2e/race.spec.ts -g "countdown|100 m"`.

### S3: estacionamentos nos pátios do centro (P2)

Fileiras de carros parados, sólidos, de várias cores.

**Acceptance Criteria**

9. The system SHALL pôr entre 60 e 160 carros estacionados no seed 1337, todos em zonas `downtown` com pelo menos 800 m², em vagas a pelo menos 2 m de qualquer lote, `w/2 + 2` m de qualquer estrada, 12 m do centro de um canteiro de obra e 8 m de qualquer poste de quintal, piscina ou árvore
10. The system SHALL organizar as vagas em fileiras: carros da mesma fileira com heading igual (± 1°) e passo de 2.8 m (± 0.1 m) entre centros; fileiras a pelo menos 6 m entre si; ocupação por vaga decidida pelo PRNG do seed com 60 %
11. The system SHALL escolher a pintura de cada carro entre 8 cores fixas (`PARKED_PAINTS`), por PRNG do seed, e o mesmo seed SHALL dar as mesmas vagas, headings e cores
12. The system SHALL criar 1 collider cuboide fixo de 0.9 × 0.6 × 2.1 m (metades) por carro estacionado, com o centro a 0.6 m acima do terreno e o eixo longo no heading do carro; `world.colliders.len()` SHALL crescer exatamente pelo número de carros estacionados
13. WHEN o carro do jogador bate de frente num carro estacionado a 40 km/h THEN the system SHALL trazer a velocidade abaixo de 5 km/h em até 1 s, e o carro estacionado SHALL continuar no lugar
14. The system SHALL desenhar todos os carros estacionados com 1 `InstancedMesh` chamada `parked-cars` (carroceria + aerofólio + 4 rodas numa geometria) e a cor por instância SHALL ser a pintura do carro; WHERE `car.glb` falta SHALL usar a caixa do placeholder

**Independent test:** ir ao pátio atrás do spawn e bater num carro estacionado; olhar as cores.

### S4: vapor das grades (P2)

Fumaça branca subindo de grades no pátio.

**Acceptance Criteria**

15. The system SHALL pôr 1 grade de vapor por 500 m² de zona `downtown`, no máximo 120, em vértices do pátio com `facadeDist` entre 3 e 12 m, a pelo menos 6 m entre si, 4 m de qualquer vaga e 12 m do centro de um canteiro
16. WHILE o jogo roda cada grade SHALL soltar 24 partículas em ciclo de 4 s: cada uma sobe de `y` a `y + 5` m com deriva lateral de no máximo 1.5 m e tamanho crescendo até 3×; a posição SHALL vir de `steamPoint(t, seed)` em JS com a mesma conta do GLSL (`STEAM_GLSL`), constantes de uma fonte só
17. The system SHALL desenhar todo o vapor com 1 `Points` chamado `steam`, com `uTime` avançado pelo relógio da simulação
18. WHEN a câmera olha uma grade a 10 m THEN the system SHALL ter luminância média (9 × 9 px) 1 m acima da grade maior que a de um ponto na mesma altura a 6 m de lado, por pelo menos 0.01

**Independent test:** parar perto de uma grade e ver a fumaça subir e sumir.

### S5: holofotes para o céu (P2)

Fachos varrendo o céu do centro.

**Acceptance Criteria**

19. The system SHALL pôr 4 holofotes, um no teto (`lot.y + lot.height`) de cada um dos 4 lotes `downtown` mais altos que fiquem a pelo menos 250 m entre si, com período de 32 a 48 s e fase por PRNG do seed
20. WHILE o jogo roda cada facho SHALL girar em torno da vertical com heading `searchlightHeading(t, period, phase)` = `phase + 2π · t / period`, inclinado 80° da vertical (10° acima do horizonte; era 20° da vertical, mudado em 2026-09-27 com o usuário porque a câmera não mostra céu acima de ~17°), com 400 m de comprimento
21. The system SHALL desenhar os 4 fachos com 1 `InstancedMesh` chamada `searchlights`, aditiva, fora do espelho da rua
22. WHEN a câmera está no spawn THEN the system SHALL ter, no ponto projetado a 150 m ao longo de um facho, luminância média (9 × 9 px) maior que a do céu 40 px ao lado, por pelo menos 0.02

**Independent test:** olhar para cima no centro e ver os fachos girando.

### S6: gatos (P2)

Gatos pequenos que andam, param e fogem.

**Acceptance Criteria**

23. The system SHALL criar pontos de gato em 1 a cada 3 quintais (PRNG do seed, 35 %) e 1 por 2000 m² de zona `outer`; SHALL manter ativos só os pontos a até 200 m do carro, no máximo 60 em `high` e 30 em `low`
24. WHILE anda o gato SHALL mover-se a 0.5-0.9 m/s dentro da própria zona (`segmentInZone`), e a cada 6-12 m SHALL parar por 2-5 s sentado (corpo 30 % mais baixo)
25. WHEN o carro chega a 6 m de um gato THEN the system SHALL fazê-lo fugir a 4 m/s na direção contrária ao carro até 12 m, e em nenhum passo o gato SHALL ficar a menos de 0.5 m do centro do carro
26. The system SHALL desenhar todos os gatos com 1 `InstancedMesh` chamada `cats` (corpo, cabeça, rabo e 2 olhos emissivos numa geometria de até 120 vértices)

**Independent test:** parar atrás de uma casa de fora e ver um gato sentar e fugir do carro.

### S7: trem elevado (P2)

Um trem de 3 vagões corre num viaduto sobre o quadrado do centro.

**Acceptance Criteria**

27. The system SHALL construir `TrainLine` do seed 1337 como um laço fechado de 2300 a 2500 m sobre as 4 avenidas de x ≈ ±300 e z ≈ ±300: todo ponto do deck a no máximo `w/2 − 2` m (horizontal) da linha central da avenida mais próxima e a 8 m (± 0.5 m) acima do asfalto, com heading mudando no máximo 6° entre pontos consecutivos
28. IF uma das 4 avenidas falta na rede THEN `buildTrainLine` SHALL devolver `null` com `console.warn('train line skipped: ...')` e o resto do mundo SHALL carregar
29. The system SHALL pôr portais a cada 24 m (± 2 m) da linha, com 2 colunas a `w/2 + 2.6` m (± 0.1 m) de cada lado da linha central, do terreno até o deck, e nenhum portal a menos de 12 m da linha central de outra estrada
30. The system SHALL criar 1 collider cuboide fixo de 0.25 × (altura/2) × 0.25 m (metades) por coluna, e nenhum collider para o deck nem para os vagões
31. WHILE o jogo roda o trem SHALL ter 3 vagões de 12 m com 1 m entre eles, a 18 m/s ao longo do laço, pose de `trainPose(t, line, wagon)` com o centro do vagão `k` em `s = (18 · t − 13 · k) mod length` e heading tangente à linha; WHEN 2 s de simulação passam THEN o vagão 0 SHALL ter avançado 36 m (± 1 m) ao longo da linha
32. The system SHALL desenhar o viaduto (deck + portais) com 1 malha chamada `train-line` e os vagões com 1 `InstancedMesh` chamada `train`, com faixa de janelas emissiva de intensidade ≥ 2
33. The system SHALL deixar o vão livre: em todo ponto da linha a face de baixo do deck SHALL ficar a pelo menos 6.5 m do asfalto, e o carro SHALL cruzar por baixo de um portal sem bater (velocidade não cai abaixo de 90 % ao passar a 60 km/h)

**Independent test:** parar na avenida z ≈ 300 e ver o trem passar por cima.

### S8: orçamento (P1)

Tudo isso sem estourar o que a cidade já garante.

**Acceptance Criteria**

34. The system SHALL manter as draw calls em no máximo 220 nos 5 lugares da city-terrain C38 e no grid do `circuito-centro` em corrida com os 3 oponentes (races C34), com todos os extras ligados
35. The system SHALL pular no espelho da rua todos os objetos novos (`parked-cars`, `steam`, `cats`, `searchlights`, `train-line`, `train`), pela lista `objects()` que o `Game` já passa ao reflector
36. The system SHALL chegar a `ready` em até 30 s em `high` (city-terrain C39) com os colliders novos
37. WHERE a qualidade é `low` the system SHALL manter trem, estacionamentos e holofotes, e SHALL reduzir gatos a 30 ativos e o vapor a 12 partículas por grade

**Independent test:** `E2E_PORT=<porta> npx playwright test tests/e2e/render.spec.ts tests/e2e/race.spec.ts tests/e2e/visual.spec.ts -g "draw calls|ready within 30 s"`.

## Out of scope

Product capabilities only. Process and harness rules live in AGENTS.md or as Observable `n/a`.

| Excluded | Why |
| --- | --- |
| estações, paradas e passageiros do trem | o pedido é o trem passando; parada muda o ritmo e pede plataforma |
| colisão com o trem ou com o deck | escolha do usuário (2026-09-27): elevado, sem colisão |
| carros estacionados na beira da rua | tomariam a faixa de fora das ruas de 10 m e os oponentes (offset ± 3 m) bateriam neles; só pátios |
| gatos na rua, gato atropelado, som de gato | jogo sem violência, como os pedestres da block-fill; gato sempre foge |
| vapor em bueiros na rua | só o pátio foi pedido ("vapor de dutos"); bueiro na pista mexe no espelho da rua |
| holofote iluminando o chão ou o carro | é facho para o céu; luz real no chão custaria uma das 3 luzes (AD-003) |
| estacionamentos e vapor nas zonas de fora | pátio de concreto é o do centro; fora tem quintal, árvore e gato |
| mudar as cores dos oponentes (`AI_PAINTS`) | a cor está certa; o que sai errado é como ela é aplicada |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| onde o trem passa | viaduto sobre as 4 avenidas do quadrado do centro, colunas na calçada coladas nas fachadas, com collider, sem colisão com o trem | escolha do usuário entre elevado no centro, ao lado do anel e bonde na avenida | y |
| carros estacionados sólidos | collider fixo por carro | escolha do usuário entre sólidos e só visual | y |
| paleta dos estacionados | 8 cores: branco, prata, preto, vermelho escuro, azul marinho, verde escuro, bege e cinza | carros comuns de rua, sem competir com os oponentes | n |
| aparência do gato | corpo 0.5 × 0.2 × 0.2 m, cabeça, rabo, olhos emissivos amarelos; cores preto, cinza, laranja e branco | low-poly como os pedestres; olhos brilhando é o que se vê à noite | n |
| aparência do trem | vagões azul escuro 12 × 2.6 × 3 m, faixa de janelas quente, deck de concreto cinza com guarda-corpo | metrô de superfície genérico, sem marca | n |
| velocidade e sentido do trem | 18 m/s (65 km/h), sentido horário visto de cima, um trem só | mais devagar que o carro; um trem basta para passar a cada ~2 min | n |
| vapor | branco `#dfe6ee`, opacidade 0.16 e ponto de 70 px a 1 m, aditivo; 24 partículas por grade em `high` | fumaça leve que o bloom pega sem virar nuvem; 0.35 e 220 px (o primeiro chute) saturavam a tela de branco a 12 m (medido em 2026-09-27) | n |
| cone do holofote | raio 2 m na base e 22 m no topo, cor `#cfe0ff`, opacidade 0.12, aditivo, sem névoa | facho longo; 12 m no topo dava ~5 px de largura a 450 m, e com névoa o facho a 300 m sumia (medido em 2026-09-27) | n |
| tolerância da repintura | matiz ± 25° do laranja e saturação ≥ 0.5 | ± 25° pega o quadrado `#ff7e44` e os gradientes `#ee6445`-`#fa6b41`; o marrom `#b06041` tem o mesmo matiz (17°) mas nenhuma primitiva do carro aponta para ele (medido em 2026-09-27), e o vidro `#6d6e83` (matiz 237°) e os cinzas ficam fora pela saturação | n |
| `__game.race.opponents[i].bodyColor` | passa a ler o uniform `uPaint` | a prova C21 da races continua verde sem mudar a asserção | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| tela do jogo | oponentes no grid e em corrida | AC 3, AC 4 |
| tela do jogo | pátio do centro (carros, vapor) | AC 9-11, AC 14-18 |
| tela do jogo | carro batendo em estacionado ou coluna | AC 12, AC 13, AC 30, AC 33 |
| tela do jogo | céu do centro | AC 19-22 |
| tela do jogo | quintais e zonas de fora | AC 23-26 |
| tela do jogo | avenidas do quadrado do centro | AC 27, AC 29, AC 31-33 |
| tela do jogo | o que se move | AC 16, AC 20, AC 24, AC 25, AC 31 |
| tela do jogo | rede sem uma avenida | AC 28 |
| tela do jogo | qualidade `low` | AC 37 |
| tela do jogo | loading e erro | existing - a geração roda dentro do boot atual; erro cai no overlay de `src/main.ts`; AC 36 |
| HUD e minimapa | extras e trem | n/a - fora de escopo, como na block-fill |
| documento `races/checks.md` | nota da C13 | AC 8 |

## Sources

- Usuário, 2026-09-27: "bora planejar a block-life-extras e tambem as Pendências menores listadas anteriormente"; respostas: trem "Elevado no centro", estacionados "Sólidos"
- `.specs/features/block-fill/plan.md` Out of scope (ideias E e F ficam para a 1.8); `.specs/features/races/verification.md` notas 1-4
- `.specs/STATE.md` AD-008 (PRNG por seed), AD-009 (fallback sem glb), AD-012 (mapa do miolo), AD-016 (nada à mão sobre a rede); lição L-019 (medir a base antes do limite) e L-002 (provar desenho com pixel)
