# block-life-extras checks

Profile: standard
Plan: `.specs/features/block-life-extras/plan.md`

39 checks in 8 slices · 3 one-way doors · 0 open, of which 0 block

Comandos: `npx vitest run <arquivo> -t "<nome>"` (unitários e `tests/physics`, AD-011) e `npx playwright test <arquivo> -g "<nome>"` (browser, AD-005). Seed de todas as provas: 1337 (`DEFAULT_SEED`). Bases medidas em 2026-09-27 no HEAD `d0a5dd2` (L-019): draw calls spawn 188, morro 80, ponte 114, baía 120, nordeste 102, grid do `circuito-centro` 182 livre e 207 em corrida.

## Checks

### S1 - pintura viva dos oponentes · 6 files · 114 KB · ~29k

**C1** - ✅ `recolorTexel(texel, paint)` sobre os texels que o `car.glb` usa (AC 1). Com `paint` = `#2f8cff`:

| Texel | Origem | Resultado |
| --- | --- | --- |
| `#ff7e44` | quadrado da paleta | `#2f8cff` (± 1/255 por canal) |
| `#ee6445` | gradiente da carroceria | `#2f8cff` × (lum `#ee6445` / lum `#ff7e44`), canais limitados a 1 (± 1/255) |
| `#fa6b41` | gradiente da carroceria | idem com a luminância dele |
| `#6d6e83` | vidro | igual à entrada |
| `#36363a` | roda | igual à entrada |
| `#3d3d44` | friso | igual à entrada |

Luminância = 0.2126 r + 0.7152 g + 0.0722 b em sRGB (a mesma conta do GLSL). Matiz medido a no máximo `PAINT_HUE_TOLERANCE` = 25° de `#ff7e44` e saturação ≥ 0.5 é o que decide a troca.
Proof: `npx vitest run tests/unit/carPaint.test.ts -t "recolors the orange swatch and keeps glass wheel and trim"`

**C2** - ✅ `CAR_PAINT_GLSL` lê as constantes da mesma fonte que `recolorTexel` (AC 2): o trecho contém os 3 canais de `PAINT_SWATCH` em [0, 1] com 4 casas, o cosseno de `PAINT_HUE_TOLERANCE` ou a tolerância em radianos, e o corte de saturação 0.5; fora esses e os pesos de luminância, nenhum outro literal numérico com ponto decimal aparece no trecho (mesmo padrão da prova "sway shaders carry no numeric literal").
Proof: `npx vitest run tests/unit/shaderConstants.test.ts -t "car paint shader reads the shared constants"`

**C3** - ✅ No grid do `circuito-centro` logo depois da largada (AC 3), `__game.race.bodyProbe(i)` lê a média de 9 × 9 px no ponto projetado do teto da carroceria (centro do chassi + 0.7 m) do oponente `i`, e `bodyProbe(-1)` a do jogador, numa vista ortográfica de cima do grid renderizada direto no canvas (sem bloom, chuva, partículas nem espelho), como a `probeBeam` da block-fill. Para o oponente 0 (`#2f8cff`): matiz a no máximo 30° de 210°; para os oponentes 0, 1 e 2: luminância ≥ 0.6 × a do jogador. Todos os 4 pontos projetados ficam dentro da tela.
Renegociado em 2026-09-27 (usuário: "Vista de cima, ortográfica"): a versão anterior lia o último `composer.render` com a câmera de perseguição, e o ponto caía no vidro (jogador lia azul-cinza) ou saía rasante (oponente do lado).
Proof: `npx playwright test tests/e2e/race.spec.ts -g "opponent body reads its paint"`

**C4** - ✅ `__game.race.opponents[i].bodyColor` = `AI_PAINTS[i]` e `__game.race.opponents[i].materialColor` = `#ffffff` para os 3 oponentes (AC 4); a prova C21 da races ("opponents wear their own paint") continua verde.
Proof: `npx playwright test tests/e2e/race.spec.ts -g "opponent material is white and body color is the paint"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "opponents wear their own paint"`

**C5** - ✅ Sem `car.glb` (assets placeholder), um `Car` com `paint` `#2f8cff` tem `paintMaterial.color` = `#2f8cff` (AC 5, AD-009).
Proof: `npx vitest run tests/physics/extras.test.ts -t "placeholder body takes the paint"`

### S2 - provas que faltaram na races · 2 files · 35 KB · ~9k

**C6** - ✅ Em `countdown` do `circuito-centro`, o carro é levado (teleport) a 20 m do lugar 3 do grid; R o põe parado (< 1 km/h) a no máximo 0.5 m do lugar 3, com heading a no máximo 5° do lugar, e `__game.race.time` continua 0 (AC 6, races AC 27).
Proof: `npx playwright test tests/e2e/race.spec.ts -g "reset during countdown returns to the grid slot"`

**C7** - ✅ Carro parado sobre a estrada a 100 m (± 0.5 m, medido pela prova) do marcador mais próximo, a mais de 100 m de todos os outros; Enter mantém `free`, o mesmo `bodies` e o carro a no máximo 0.5 m de onde estava (AC 7, races AC 10).
Proof: `npx playwright test tests/e2e/race.spec.ts -g "enter at 100 m from the marker does nothing"`

**C8** - ✅ `.specs/features/races/checks.md` tem, logo abaixo da C13, a linha "Nota (2026-09-27, block-life-extras C8): o carro é segurado pelo freio de mão (`handbrake: true, brake: false`), como o teste prova"; o texto aprovado da C13 não muda (AC 8).
Proof: `grep -n "block-life-extras C8" .specs/features/races/checks.md`

### S3 - estacionamentos nos pátios do centro · 6 files · 81 KB · ~20k

**C9** - ✅ `placeInteriorProps` do seed 1337 devolve entre 60 e 160 `parking` (AC 9). Para cada carro: a zona é `downtown` com `areaM2` ≥ 800; distância horizontal ≥ 2 m ao retângulo de todo lote; ≥ `w/2 + 2` m a todo ponto de estrada de largura `w`; ≥ 12 m ao centro de todo canteiro; ≥ 8 m a todo poste de quintal, piscina e árvore.
Proof: `npx vitest run tests/unit/extras.test.ts -t "parked cars sit in downtown patios away from everything"`

**C10** - ✅ Fileiras (AC 10): para todo par de carros da mesma zona com headings a até 1°, ou o deslocamento ao longo da direita do primeiro (`(−cos h, sin h)`) é múltiplo de 2.8 m (± 0.1 m) e o deslocamento ao longo da frente é no máximo 0.1 m, ou a distância entre eles é ≥ 6 m. Nenhum par de carros a menos de 2.7 m.
Proof: `npx vitest run tests/unit/extras.test.ts -t "parked cars form rows with a 2.8 m pitch"`

**C11** - ✅ Toda `paint` de `parking` está em `PARKED_PAINTS` (8 cores), pelo menos 6 das 8 aparecem, e duas chamadas com o mesmo seed dão `parking` iguais (`toEqual`) (AC 11).
Proof: `npx vitest run tests/unit/extras.test.ts -t "parked paints come from the palette and repeat with the seed"`

**C12** - ✅ `WorldPhysics` com os `parking` do seed 1337 cria `parking.length` colliders a mais do que com `parking = []` (AC 12). Lido de volta do Rapier (L-009) para 3 carros: `halfExtents` = (0.9, 0.6, 2.1) (± 0.001), `translation.y` = terreno no ponto + 0.6 (± 0.05), e o quaternion gira o eixo z local para (sin h, 0, cos h) a no máximo 1°.
Proof: `npx vitest run tests/physics/extras.test.ts -t "parked cars get one fixed cuboid each"`

**C13** - ✅ `Car` real posto 25 m atrás de um carro estacionado, apontado para ele, com acelerador a fundo (AC 13): chega a pelo menos 35 km/h antes do contato; o contato é o primeiro passo em que a velocidade cai mais de 10 km/h; em até 1 s depois dele a velocidade fica abaixo de 5 km/h; o centro do `Car` nunca passa de 1.5 m antes do centro do estacionado ao longo do heading; o collider do estacionado não sai do lugar.
Proof: `npx vitest run tests/physics/extras.test.ts -t "driving into a parked car stops the car"`

**C14** - ✅ No browser, `__game.world.extras.parking` = `{ count, meshName, instanceCount, placeholder, colorAt(i) }` com `meshName` = `parked-cars`, `instanceCount` = `count` = número de `parking` do seed 1337 (calculado no browser com os módulos puros, como `seedCounts` da interiors.spec), `placeholder` = `false` e `colorAt(i)` = `paint` do carro `i` para i ∈ {0, meio, último} (AC 14). Em node com assets placeholder, `InteriorScene` monta `parked-cars` com `placeholder` = `true`, `count` = `parking.length` e geometria de no máximo 200 vértices.
Proof: `npx playwright test tests/e2e/extras.spec.ts -g "parked cars are one instanced mesh with their paints"`
Proof: `npx vitest run tests/physics/extras.test.ts -t "parked cars fall back to boxes without the glb"`

### S4 - vapor das grades · 4 files · 20 KB · ~5k

**C15** - ✅ `vents` do seed 1337 (AC 15): entre 40 e 120; cada uma num vértice `downtown` com `facadeDist` entre 3 e 12 m; pares a ≥ 6 m; ≥ 4 m de toda vaga; ≥ 12 m do centro de todo canteiro; o total é `min(120, Σ floor(areaM2 / 500))` sobre as zonas `downtown`, menos as que não couberam (o teste aceita ≥ 80 % desse número).
Proof: `npx vitest run tests/unit/extras.test.ts -t "steam vents sit on the patio"`

**C16** - ✅ `steamPoint(t, seed)` (AC 16): para 50 seeds e t em [0, 4) a cada 0.1 s, `dy` sobe monotonicamente de 0 a 5 m (± 0.01 nos extremos), |dx| e |dz| ≤ 1.5 m, `size` vai de 1 a 3 monotonicamente, e `steamPoint(t + 4, seed)` = `steamPoint(t, seed)` (± 1e-6).
Proof: `npx vitest run tests/unit/extrasMotion.test.ts -t "steam rises drifts and grows in a 4 s cycle"`

**C17** - ✅ `STEAM_GLSL` contém `STEAM_RISE` = 5, `STEAM_PERIOD` = 4, `STEAM_DRIFT` = 1.5 e `STEAM_GROW` = 3 lidos das constantes, sem outro literal decimal além de 2π (AC 16). No browser, `__game.world.extras.steam` = `{ name: 'steam', points: 24 × vents, uTime }` e `uTime` avança 1 s (± 0.05) quando a simulação avança 1 s (AC 17).
Proof: `npx vitest run tests/unit/shaderConstants.test.ts -t "steam shader reads the shared constants"`
Proof: `npx playwright test tests/e2e/extras.spec.ts -g "steam is one points cloud driven by the sim clock"`

**C18** - ✅ Carro parado a 10 m de uma grade, apontado para ela; `__game.world.extras.steamProbe(i)` devolve a luminância média de 9 × 9 px no ponto projetado 1 m acima da grade (`over`) e num ponto na mesma altura a 6 m de lado (`aside`), ambos dentro da tela; `over − aside` ≥ 0.01 (AC 18).
Proof: `npx playwright test tests/e2e/extras.spec.ts -g "steam brightens the air above the vent"`

### S5 - holofotes para o céu · 3 files · 8 KB · ~2k

**C19** - ✅ `searchlights` do seed 1337 (AC 19): exatamente 4; cada um num lote `downtown`, com `y` = `lot.y + lot.height` (± 0.01); a escolha é gulosa por altura decrescente pulando lotes a menos de 250 m de um já escolhido (o teste recomputa e compara os `lotIndex`); `period` em [32, 48]; duas chamadas com o mesmo seed dão o mesmo resultado.
Proof: `npx vitest run tests/unit/extras.test.ts -t "four searchlights on the tallest towers"`

**C20** - ✅ `searchlightHeading(t, period, phase)` = `phase + 2π t / period` para (t, period, phase) ∈ {(0, 40, 1), (10, 40, 0), (60, 32, 2)} (± 1e-9), e `SEARCHLIGHT_TILT` = 80° da vertical e `SEARCHLIGHT_LENGTH` = 400 (AC 20).
Renegociado em 2026-09-27 (usuário: "Deitar os fachos"): era 20° da vertical; a câmera de perseguição (2.5 m acima, 14° para baixo, FOV 62°) só mostra céu até ~17° acima do horizonte, e o facho quase vertical saía do quadro logo acima da base do prédio (medido no spawn: base do holofote mais perto projetava em y = 334 de 360). A 70° (20° acima do horizonte) ainda saía, porque longe o facho tende a 20° de elevação; a 80° (10°) fica dentro.
Proof: `npx vitest run tests/unit/extrasMotion.test.ts -t "searchlight heading turns once per period"`

**C21** - ✅ No browser, `__game.world.extras.searchlights` = `{ name: 'searchlights', count: 4, additive: true, headings[4] }`, e `headings` avança `2π · 2 / period` (± 0.01) quando a simulação avança 2 s (AC 21).
Proof: `npx playwright test tests/e2e/extras.spec.ts -g "four additive searchlight cones turn with the sim clock"`

**C22** - ✅ No spawn, `__game.world.extras.beamProbe(i)` procura ao longo do facho `i`, de 30 a 300 m da base a cada 10 m, entre os pontos projetados dentro da tela com 40 px de margem horizontal e 8 px vertical, o ponto em que os fachos mais clareiam (perto da base o próprio telhado esconde o facho; nota de 2026-09-27: antes era o primeiro ponto dentro da tela) e devolve `{ beam, sky, without }`: luminância média de 9 × 9 px nesse ponto, num ponto 40 px ao lado (horizontal) e no mesmo ponto com a malha dos fachos escondida, ou `null`. Pelo menos um dos 4 fachos devolve valor, e nele `beam − without` ≥ 0.02 (AC 22).
Renegociado em 2026-09-27: a comparação era com o céu 40 px ao lado; no spawn o facho passa rente à silhueta dos prédios do fundo (elevação 13-16°) e a amostra ao lado caía em prédio aceso (`beam − sky` = −0.038). Comparar o ponto com ele mesmo sem os fachos mede o que o critério pede: o facho clareia aquele pedaço do céu.
Nota (2026-09-27): a margem vertical era 40 px. Medido no spawn com o facho a 80° da vertical: os pontos do facho mais perto projetam a 8-25 px do topo do quadro (elevação 13-16°, com o topo a ~18°; parado, o FOV é 62° e a câmera olha 14° para baixo), então só a margem do próprio quadrado de 9 px (8 px) cabe. Em movimento o FOV abre até 78° e sobra mais céu.
Proof: `npx playwright test tests/e2e/extras.spec.ts -g "a searchlight beam is brighter than the sky"`

### S6 - gatos · 4 files · 10 KB · ~3k

**C23** - ✅ `cats` do seed 1337 (AC 23): o número é (quintais com `hash` < 0.35) + Σ floor(`areaM2` / 2000) das zonas `outer`; cada ponto está na própria zona (`zoneOf` do vértice mais perto = `zoneId`); os de quintal têm `yard` ≥ 0 e ficam a até 8 m da fachada de fundo do lote, os outros `yard` = null. `activeCatSpawns(cats, car, quality)` devolve só pontos a até 200 m, no máximo 60 em `high` e 30 em `low`.
Proof: `npx vitest run tests/unit/extras.test.ts -t "cat spawns in yards and outer zones with a range cap"`

**C24** - ✅ 20 gatos do seed 1337 simulados por 120 s em passos de 1/60 com o carro a 1 km (AC 24): fora de `sit` a velocidade por passo está em [0.5, 0.9] m/s; todo `sit` começa depois de 6-12 m andados desde o anterior e dura 2-5 s com `crouch` = 0.3 (0 fora dele); todo trecho amostrado a cada 1 m arredonda para vértice interior da zona do gato.
Proof: `npx vitest run tests/unit/extrasMotion.test.ts -t "cats walk sit and stay in their zone"`

**C25** - ✅ Fuga (AC 25): carro parado a 5 m → o gato entra em `flee` no mesmo passo, anda a 4 m/s (± 0.01) e a distância ao carro cresce a cada passo até ≥ 12 m, quando volta a andar. Carro indo direto ao gato a 20 m/s: em nenhum passo o gato fica a menos de 0.5 m do centro do carro; o mecanismo é que a menos de 1.5 m o gato é empurrado radialmente para 1.5 m dentro da zona ou, se não há lugar, marca `gone` = true e some, voltando ao ponto de partida depois de 10 s com o carro a mais de 30 m.
Proof: `npx vitest run tests/unit/extrasMotion.test.ts -t "cats flee and are never under the car"`

**C26** - ✅ No browser, `__game.world.extras.cats` = `{ name: 'cats', vertices, active, cap }` com `vertices` ≤ 120, `cap` = 60, e depois de o carro parar atrás de uma casa de fora (ponto de gato mais perto do spawn) `active` ≥ 1 (AC 26, AC 23).
Proof: `npx playwright test tests/e2e/extras.spec.ts -g "cats are one instanced mesh near the car"`

### S7 - trem elevado · 6 files · 30 KB · ~8k

**C27** - ✅ `buildTrainLine(network)` do seed 1337 (AC 27): laço fechado (primeiro e último ponto a ≤ 2 m), `length` entre 2300 e 2500 m (± 1 m da soma dos segmentos); todo ponto a ≤ 6 m (`w/2 − 2`, w = 16) da linha central da avenida mais perto e a 8 m (± 0.5) acima do ponto de estrada mais perto; a mudança de heading entre pontos consecutivos ≤ 6°; passo entre pontos ≤ 2.5 m.
Proof: `npx vitest run tests/unit/trainLine.test.ts -t "the line loops over the four downtown avenues"`

**C28** - ✅ Removendo da rede uma das 4 avenidas do quadrado, cada uma por vez, `buildTrainLine` devolve `null` e chama `console.warn` uma vez com prefixo `train line skipped:`; com a rede inteira nunca avisa (AC 28).
Proof: `npx vitest run tests/unit/trainLine.test.ts -t "a missing avenue skips the line with a warning"`

**C29** - ✅ `frames` do seed 1337 (AC 29): espaçamento ao longo da linha de 24 m (± 2) entre portais consecutivos, exceto onde um cruzamento foi pulado; cada portal a 2 colunas em `x, z ± (w/2 + 2.6) · (cos h, −sin h)` (± 0.1); nenhum portal a menos de 12 m da linha central de qualquer estrada que não seja a avenida sob a linha; `y` (terreno na coluna) < altura do deck ali.
Proof: `npx vitest run tests/unit/trainLine.test.ts -t "portals every 24 m on the sidewalks away from crossings"`

**C30** - ✅ `WorldPhysics` com a `TrainLine` cria `2 × frames.length` colliders a mais (AC 30), nenhum para deck ou vagões (a diferença é exata); lido de volta para 3 colunas: `halfExtents` = (0.25, h/2, 0.25) com `h` = deck − terreno (± 0.05) e `translation` = (coluna.x, terreno + h/2, coluna.z) (± 0.05).
Proof: `npx vitest run tests/physics/extras.test.ts -t "portal columns get one fixed cuboid each"`

**C31** - ✅ `trainPose(t, line, k)` (AC 31): `s` = `(18 t − 13 k) mod length` para (t, k) ∈ {(0, 0), (0, 2), (100, 1), (200, 0)} (± 1e-6), posição = `routeAt`-like no `s`, heading tangente (± 1°). No browser, `__game.world.extras.train.s[0]` avança 36 m (± 1, módulo `length`) quando a simulação avança 2 s.
Proof: `npx vitest run tests/unit/extrasMotion.test.ts -t "train pose follows the line at 18 m per second"`
Proof: `npx playwright test tests/e2e/extras.spec.ts -g "the train advances 36 m in 2 s"`

**C32** - ✅ No browser, `__game.world.extras.train` = `{ lineMesh: 'train-line', lineInstanced: false, name: 'train', count: 3, windowEmissive }` com `windowEmissive` ≥ 2 (AC 32).
Proof: `npx playwright test tests/e2e/extras.spec.ts -g "the viaduct is one mesh and the wagons one instanced mesh"`

**C33** - ✅ Vão livre (AC 33): em todo ponto da linha, `y − DECK_THICKNESS / 2` ≥ estrada + 6.5 (unitário). Com o Rapier real, o `Car` a pelo menos 55 km/h cruzando sob um portal da avenida z ≈ 300 (acelerador a fundo desde 120 m antes) tem, 10 m depois do portal, velocidade ≥ 90 % da de 10 m antes.
Proof: `npx vitest run tests/unit/trainLine.test.ts -t "the deck clears the road by 6.5 m"`
Proof: `npx vitest run tests/physics/extras.test.ts -t "the car passes under a portal without slowing"`

### S8 - orçamento · 4 files · 25 KB · ~6k

**C34** - ✅ Draw calls ≤ 220 nos 5 lugares da city-terrain C38 e no grid do `circuito-centro` em corrida (races C34), com todos os extras ligados (AC 34).
Proof: `npx playwright test tests/e2e/render.spec.ts -g "draw calls at most 220 across the world"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "draw calls within budget while racing"`

**C35** - ✅ `__game.render.reflectorSkipped` (nomes dos objetos que o espelho da rua pula) contém `parked-cars`, `steam`, `cats`, `searchlights`, `train-line` e `train` (AC 35).
Proof: `npx playwright test tests/e2e/extras.spec.ts -g "the street mirror skips every extra"`

**C36** - ✅ `ready` em até 30 s em `high` com os colliders novos (AC 36, city-terrain C39).
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "ready within 30 s at high quality"`

**C37** - ✅ Com `?quality=low`: `extras.cats.cap` = 30, `extras.steam.points` = 12 × vents, `extras.train.count` = 3, `extras.parking.count` = número de `parking` e `extras.searchlights.count` = 4 (AC 37).
Proof: `npx playwright test tests/e2e/extras.spec.ts -g "low quality halves cats and steam and keeps the rest"`

**C38** - ✅ `tests/unit/purity.test.ts` trava `src/vehicle/carPaint.ts` e `src/world/rail/trainLine.ts` como módulos puros (AD-004); `interiorMotion.ts` e `InteriorProps.ts` continuam na lista.
Proof: `npx vitest run tests/unit/purity.test.ts -t "pure modules do not import three or rapier"`

**C39** - ✅ `.specs/STATE.md` ganha AD-017 (linha do trem por regra sobre a rede, door 2) com status `active`.
Proof: `grep -n "AD-017" .specs/STATE.md`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| texels da paleta que o carro usa (6) | `#ff7e44` C1 · `#ee6445` C1 · `#fa6b41` C1 · `#6d6e83` C1 · `#36363a` C1 · `#3d3d44` C1 | - |
| consumidores da repintura (2) | oponente `Car` C3, C4 · estacionados C14 | - |
| fallback sem `car.glb` (2) | oponente C5 · estacionados C14 | - |
| oponentes lidos em pixel (3) | 0 C3 (matiz e luminância) · 1 C3 (luminância) · 2 C3 (luminância) | - |
| provas que faltaram na races (3) | R em `countdown` C6 · Enter a 100 m C7 · nota da C13 C8 | - |
| campos novos de `InteriorProps` (4) | `parking` C9, C10, C11 · `vents` C15 · `cats` C23 · `searchlights` C19 | - |
| distâncias mínimas das vagas (4) | lote 2 m C9 · estrada `w/2 + 2` C9 · canteiro 12 m C9 · poste, piscina e árvore 8 m C9 | - |
| colliders novos (3) | carro estacionado C12 · coluna de portal C30 · deck e vagões sem collider C30 | - |
| avenidas do laço (4) | x ≈ +300 C28 · x ≈ −300 C28 · z ≈ +300 C28 · z ≈ −300 C28, table-driven over all 4 | - |
| estados do gato (4) | `walk` C24 · `sit` C24 · `flee` C25 · `gone` C25 | - |
| malhas novas fora do espelho (6) | `parked-cars` C35 · `steam` C35 · `cats` C35 · `searchlights` C35 · `train-line` C35 · `train` C35 | - |
| lugares das draw calls (6) | spawn C34 · morro C34 · ponte C34 · baía C34 · nordeste C34 · grid do centro em corrida C34 | - |
| qualidades (2) | `high` C23, C26 · `low` C37 | - |
| trechos GLSL com gêmeo em JS (2) | `CAR_PAINT_GLSL` C2 · `STEAM_GLSL` C17 | - |
| módulos puros novos (2) | `carPaint` C38 · `trainLine` C38 | - |

- Claims lidos no browser ou no Rapier real: C3, C4, C5, C6, C7, C12, C13, C14, C17, C18, C21, C22, C26, C30, C31, C32, C33, C34, C35, C36, C37 - cada um cruza a fronteira
- Nenhum outro check afirma mais do que o caso que a prova exercita

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decide, alcançado pela fronteira (`InteriorProps` extras, `trainLine`, `interiorMotion` gato/trem/holofote/vapor, `carPaint`) | uma na própria camada (vitest) **e** uma na fronteira (Playwright ou `tests/physics` com o mundo real) | um caso por linha de cada tabela de decisão na própria camada; o contrato na fronteira |
| Cola (`InteriorScene`, `TrainScene`, sondas do `Game`) | nenhuma própria | coberta pelas provas Playwright do consumidor |
| Colliders do `WorldPhysics` | uma em `tests/physics` com o Rapier real | cada forma lida de volta (L-009) |

Evidence:
- `carPaint`: 2 portões (matiz, saturação) × 6 texels, mais o gêmeo GLSL. Decide.
- `InteriorProps` extras: vagas (5 distâncias, fileiras, ocupação, paleta), grades (4 distâncias), gatos (2 origens), holofotes (guloso por altura e 250 m). Decide.
- `trainLine`: 4 avenidas, cantos, deck, portais fora de cruzamento, `null` por avenida faltando. Decide.
- `interiorMotion` novo: gato (walk/sit/flee/gone, 4 estados), trem (módulo do laço), holofote (1 fórmula), vapor (ciclo). Decide.
- `InteriorScene`, `TrainScene`, sondas: montam malhas e repassam poses; nenhuma condicional muda resultado. Cola.
- análogo mais perto: `InteriorProps` e `interiorMotion` da block-fill, provados em `tests/unit/interiorProps.test.ts` e `interiorMotion.test.ts` com um caso por regra e no browser por `interiors.spec.ts`.

Cost: 12 provas na própria camada em 5 arquivos, 8 em `tests/physics`, 13 no browser. Sem essas linhas, 4 tabelas de decisão seriam provadas só pelo caminho que passa por elas.

## Swept

- validation: C1 (portões de matiz e saturação), C9, C10, C15, C19, C27, C29 (distâncias e faixas de tudo que é posicionado)
- failure modes: C28 (avenida faltando não derruba o boot); C5, C14 (sem glb cai no placeholder)
- idempotency: C11, C19, C23 (mesmo seed, mesmos extras); C3 e C31 leem do mesmo quadro/relógio sem estado próprio
- authorization: n/a - jogo local de um jogador, sem conta nem rede
- concurrency: n/a - tudo roda no passo fixo de uma thread; vapor, holofote e trem são função só do tempo (C16, C20, C31), sem estado partilhado
- data lifecycle: C23, C25 (gatos existem só a 200 m do carro e o `gone` renasce em 10 s); nada persiste
- dependency failure: C5, C14 (AD-009); nenhuma dependência nova
- state transitions: C24, C25 (walk → sit → walk, walk → flee → walk, flee → gone → walk)
- observability: `__game.world.extras` e `__game.race.bodyProbe` (só DEV), lidos por C3, C4, C14, C17, C18, C21, C22, C26, C31, C32, C35, C37

## Handoff

- Estimativa de tamanho (`wc -c` / 4):
  - existentes lidos ou tocados: `Game.ts` 63 KB, `Car.ts` 25 KB, `InteriorScene.ts` 34 KB, `interiorMotion.ts` 18 KB, `InteriorProps.ts` 13 KB, `WorldPhysics.ts` 6 KB, `LotGenerator.ts` 10 KB, `race.spec.ts` 15 KB, `interiors.spec.ts` 26 KB (lido), `raceAi.test.ts` 7 KB, `interiorProps.test.ts` 10 KB, `interiorMotion.test.ts` 18 KB, `shaderConstants.test.ts` 3 KB, `helpers.ts` 5 KB, `quality.ts` 1 KB, `races/checks.md` 20 KB. Total 274 KB ≈ 68k;
  - código e testes novos: `carPaint.ts` ~4 KB, `trainLine.ts` ~8 KB, `TrainScene.ts` ~8 KB, extras em `InteriorProps` ~12 KB, em `InteriorScene` ~15 KB, em `interiorMotion` ~8 KB, testes ~50 KB. Total ~105 KB ≈ 26k;
  - S1 29k, S2 entra em 38k, S3 em 58k, S4 em 63k, S5 em 65k, S6 em 68k, S7 em 76k, S8 em 82k. Tudo abaixo do budget de 150k: um builder só.
- Mechanism: one builder (cabe no budget, sem pergunta)
- Orçamento de draw calls (L-019): pior caso 207 no grid do centro em corrida; os extras perto do centro custam no máximo 12 (6 malhas × 2 passes, fora do espelho). Se a medida real da C34 passar de 220, é stop-and-ask, não troca de limite.
- **Settled mid-build (2026-09-27):**
  - C3: leitura da carroceria em vista ortográfica de cima (usuário: "Vista de cima, ortográfica"); a câmera de perseguição lia o vidro.
  - C20: fachos a 80° da vertical (usuário: "Deitar os fachos"); a câmera só mostra céu até ~18° acima do horizonte; 70° ainda saía do quadro.
  - C22: a sonda varre o facho e devolve o ponto mais clareado, comparado com o mesmo ponto sem os fachos (o primeiro ponto ficava atrás do telhado; a amostra "céu ao lado" caía em prédio); margem vertical 8 px; cone de 2 → 22 m sem névoa (12 m no topo dava ~5 px a 450 m; a névoa apagava o facho a 300 m).
  - C17 e C31: a diferença de `uTime` e de `s` é comparada com a diferença de `simTime` lida no mesmo instante (o relógio anda em tempo real entre as leituras do Playwright).
  - C10: `PARKING_ROW_GAP` = 6.5 m (a 6.0 m o teste "≥ 6" empatava em float); fileiras ao longo da rua com os carros de nariz para o prédio, centradas a 40 m do centroide (o guindaste fica no centroide).
  - C24: o passo em que o gato senta ainda anda; o passo em que levanta já anda (velocidade nunca 0 fora de `sit`).
  - Vapor: opacidade 0.16 e ponto de 70 px (0.35 e 220 px saturavam a tela a 12 m).
  - `roadQuery.ts`: helpers de avenida e cruzamento saíram da `raceRoutes` para `src/world/roads/roadQuery.ts` (puro, na lista de pureza); as corridas importam dali.
  - Draw calls medidas com tudo ligado (HEAD do build): spawn 198, morro 87, ponte 114 (antes), baía 127, nordeste 103, sob o trem 196, pátio 200, grid do centro em corrida 219.
  - Regressões pegas pela suíte e2e inteira (132 testes) e corrigidas: a sonda `probeRoadMarks` (city-terrain C23) olha a avenida de cima e o deck do trem a cobria, então ela esconde o trem como já escondia o carro; a contagem de colliders da block-fill C35 ganhou `parked` e `columns` (a afirmação "pedestre sem collider" não muda); C21 comparava o giro com 2 s fixos e passa a usar o `simTime` lido junto, como C17 e C31.
- **Abandoned:** fileiras centradas no centroide do pátio (7 carros no seed 1337: o canteiro de obra a 12 m rejeitava quase tudo); tingimento por `material.color` para os estacionados (mesmo escurecimento dos oponentes); sonda C22 pelo primeiro ponto na tela.
