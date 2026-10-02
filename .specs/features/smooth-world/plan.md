# smooth-world

## Problem

A validação de 2026-09-29 (`.specs/audits/2026-09-29-validation.md`) achou problemas de movimento e de geometria que o jogador sente dirigindo e que nenhum teste mede:

- **Carro tremendo.** O render copia a pose física crua a cada quadro, sem interpolar entre passos fixos. Num monitor de 144 Hz, ~58 % dos quadros não têm passo: o carro e os oponentes andam aos saltos de 1/60 s, enquanto a câmera anda lisa (CORE-2, `Game.ts:349`, `GameLoop.ts:36-39`).
- **Degrau na rodovia.** Nas 12 junções entre avenida e rodovia em anel, a ponta da avenida fica até 0.23 m acima ou abaixo da fita do anel. A roda leva um tranco de ~20 cm no meio da pista. A sonda reproduziu com a geometria real (wgen-2, `RoadGenerator.ts:378-395`).
- **Pedestres atravessam prédios.** O teste "está na zona" arredonda para o vértice de 4 m, mas a folga do lote é de 1 m. A sonda achou pontos de segmento até 0.96 m dentro de um lote e 16 591 amostras dentro de algum, o que viola a AD-012 (miolo-1, `interiorMotion.ts:336`).
- **Engasgo no streaming.** Cada chunk é montado de uma vez, na thread principal: 7-19 ms depois do JIT aquecido e até 48 ms a frio. Isso é metade ou mais de um quadro de 16.7 ms a cada fronteira de chunk (wgen-3, `ChunkManager.ts:79-85`).
- **Chão com duas alturas.** `heightAt` é bilinear, enquanto a malha e o heightfield do Rapier usam dois triângulos por célula. A diferença chega a 0.19 m, e carros estacionados e piscinas podem ficar com fresta (wgen-5).
- **Bordas e normais:**
  - uma ponte que cruze a costura de uma estrada fechada perde o tabuleiro no trecho `n-1 → 0`. Não acontece no seed 1337, mas acontece noutro seed (wgen-6);
  - calçadas, tabuleiros, guarda-corpos e pilares têm normais médias nas quinas de 90° e aparecem arredondados sob o farol (wgen-7).
- **Custo por quadro:**
  - o miolo aloca ~45 objetos por quadro (miolo-8);
  - o minimapa redesenha as 13 683 amostras de estrada todo quadro (HUD-1).

Quando isto sair: o carro anda liso em qualquer taxa de quadros, a junção do anel é plana, ninguém entra em prédio, o streaming não derruba quadro, e o chão tem uma altura só.

## Flow

Reusa o `FixedStepper.accumulator`, que já existe e que ninguém lê, como fração de interpolação. A triangulação da malha de terreno (`ChunkManager.ts:317-321`) vira a única regra de altura, e o mapa `findBlockInteriors` (AD-012) continua sendo a fonte do "chão livre".

1. `core/GameLoop` (exists): passa `alpha = accumulator / step` ao render (door 1).
2. `vehicle/Car` (exists): guarda a pose anterior antes de cada passo e desenha a pose interpolada; `teleport` e `reset` zeram a interpolação (door 1). `race/RaceController` (exists) repassa o `alpha` aos oponentes.
3. `camera/ChaseCamera` (exists): segue a pose interpolada.
4. `world/roads/RoadGenerator` (exists): a ponta da avenida acompanha a inclinação do anel na junção.
5. `world/interiors/BlockInteriors` (exists): consulta de chão caminhável, com o vértice arredondado para baixo e a distância à fachada (door 2). `world/interiors/interiorMotion` (exists) usa essa consulta para o pedestre, a fuga e o empurrão do gato.
6. `world/ChunkManager` (exists): o build vira uma sequência de fatias, uma por `update`, e o boot pré-monta os chunks perto do spawn (door 3).
7. `world/terrain/TerrainGenerator` (exists): `heightAt` usa a mesma diagonal da malha.
8. `world/roads/RoadGenerator`, `world/roads/bridges` e `world/ChunkManager` (exists): trechos de ponte com índice modular em estrada fechada, e vértices por face nas extrusões.
9. `world/interiors/InteriorScene` (exists): temporários reaproveitados como campos. `hud/Minimap` (exists) redesenha com passo limitado.

## Impact

| Front | What changes |
| --- | --- |
| decisões | a AD-006 (passo fixo) ganha a interpolação no render como regra, por uma AD nova que a estende (door 1) |
| decisões | a AD-012 ganha a consulta de chão caminhável para o que se move, por uma AD nova que a estende (door 2) |
| checks de outras features | block-fill C32 (pedestre arredonda para vértice da zona) continua; os pedestres passam a ter caminhos menores perto das fachadas |
| checks de outras features | city-terrain C2 (`heightAt` no meio de 4 amostras = média bilinear): passa a ser o triângulo da malha (AC 14); o teste `769 x 769 samples every 4 m` troca a média pela média das pontas da diagonal |
| checks de outras features | city-terrain `world.spec.ts:361` (`maxBuildsInOneFrame` ≤ 1): depois da test-hardening mede builds por quadro; aqui passa a contar fatias |
| sondas DEV | `__game.car.x/y/z` e as posições dos oponentes continuam sendo a pose física. A pose desenhada entra como campo novo, para os testes de pixel não mudarem de referência |
| mundo | bases de lote, colunas do trem, carros estacionados e piscinas mudam de altura até 0.19 m, com a nova `heightAt` |
| mundo | com o seed 1337, as avenidas mudam de altura só nos últimos metros antes do anel |
| memória | as extrusões ganham ~4× vértices por seção (normais por face) |
| stored data | nada para migrar |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Interpolação de pose no render (padrão novo, que todo corpo desenhado vai copiar) | `GameLoop` chama `render(dt, alpha)`, com `alpha = stepper.accumulator / stepper.step` em [0, 1). Cada corpo desenhado guarda `prev` antes do passo e desenha `lerp(prev, curr, alpha)` na posição e `slerp` no quaternion. `teleport`/`reset` fazem `prev = curr`. AD nova estendendo a AD-006 | extrapolar a partir da velocidade: passa do ponto na batida e treme ao frear. Passo variável: quebra a AD-006 e os testes de física reproduzíveis |
| 2. Consulta de chão caminhável sobre o mapa do miolo (contrato que o conteúdo móvel futuro vai ler) | `walkable(bi, zoneId, x, z)`: verdadeiro só se os 4 vértices da célula de 4 m que contém o ponto (floor) são da zona e a `facadeDist` interpolada no ponto é ≥ `LOT_MARGIN + 0.25` m. O conteúdo parado continua com `zoneAt`. AD nova estendendo a AD-012 | aumentar `LOT_MARGIN`: muda as zonas, as áreas mínimas e a posição de todo o conteúdo já provado pela block-fill e pela block-life-extras |
| 3. Build de chunk em fatias (padrão de streaming) | o build de um chunk é uma sequência de fatias (terreno em faixas de ≤ 33 linhas das 129, depois estradas e calçadas, depois pontes e props); `update` roda no máximo uma fatia por chamada. O boot monta de uma vez os chunks a ≤ 900 m do spawn antes do primeiro quadro | Worker: exige um segundo bundle, transferir buffers e um fallback, para ganhar o que as fatias já ganham |

- Nothing else in this change is hard to reverse

## Criteria

### S1: carro liso em qualquer taxa de quadros (P1)

**Acceptance Criteria**

1. The system SHALL desenhar o carro do jogador e cada oponente na pose `lerp(anterior, atual, alpha)` na posição e `slerp` na rotação, com `alpha = accumulator / step` em [0, 1).
2. WHILE o carro anda em linha reta a 100 km/h com quadros de 1/144 s, the system SHALL avançar a posição desenhada a cada quadro. A diferença entre dois quadros seguidos SHALL ficar entre 0.5× e 1.5× de `v / 144`.
3. WHEN `teleport` ou `reset` roda THEN the system SHALL desenhar o próximo quadro exatamente na pose nova, sem rastro da pose antiga.
4. The system SHALL fazer a câmera de perseguição seguir a pose desenhada, não a pose física.

**Independent test:** teste de física em node com o `Car` real, um `GameLoop` com `requestAnimationFrame` falso a 144 Hz, lendo `car.mesh.position` a cada quadro.

### S2: junção do anel sem degrau (P1)

**Acceptance Criteria**

5. The system SHALL deixar cada vértice da borda final de cada avenida que termina no anel a no máximo 0.02 m de altura da fita do anel logo abaixo dele, nas 12 junções do seed 1337.
6. The system SHALL manter a mesma inclinação máxima de avenida que a city-terrain já prova no trecho que chega ao anel.

**Independent test:** `tests/unit/roads.test.ts` montando a fita do anel com `roadStripGeometry` e medindo cada vértice final de avenida.

### S3: ninguém entra em prédio (P1)

**Acceptance Criteria**

7. WHILE pedestres andam, fogem ou são empurrados, the system SHALL manter o centro do corpo a ≥ 0.25 m do footprint de todo lote, em cada passo. Medido com 400 pedestres do seed 1337, 3 posições de carro, 40 s.
8. WHILE gatos andam, sentam, fogem ou são empurrados, the system SHALL manter o centro a ≥ 0.25 m do footprint de todo lote, em cada passo. Medido com 200 gatos do seed 1337 e o carro passando a 8 e 20 m/s.
9. The system SHALL aceitar como caminho de pedestre só segmentos cujas amostras a cada 0.25 m estão todas no chão caminhável.

**Independent test:** `tests/unit/interiorMotion.test.ts` com a distância com sinal até o retângulo girado de cada lote.

### S4: streaming sem engasgo (P2)

**Acceptance Criteria**

10. WHEN o jogo inicia THEN the system SHALL montar todos os chunks a ≤ 900 m do spawn antes do primeiro quadro, e SHALL fazer zero builds de chunk nos 60 primeiros quadros com o carro parado.
11. WHILE o carro anda, the system SHALL rodar no máximo uma fatia de build por `update`.
12. WHEN o carro percorre de ponta a ponta a rodovia em anel (seed 1337, JIT aquecido, máquina ociosa, node) THEN nenhuma chamada a `ChunkManager.update` SHALL levar mais que 8 ms.
13. The system SHALL produzir, pelas fatias, a mesma geometria do build de uma vez: mesmo número de vértices e mesmas posições em todos os chunks do seed 1337.

**Independent test:** teste em node com o `ChunkManager` real, cronometrando cada `update` ao longo do anel.

### S5: uma altura de chão só (P2)

**Acceptance Criteria**

14. The system SHALL devolver em `heightAt(x, z)` a altura do triângulo da malha de terreno que contém o ponto. Em 20 000 pontos aleatórios do seed 1337, a diferença para um raio vertical no heightfield do Rapier SHALL ser ≤ 0.005 m.

**Independent test:** `tests/physics` com o heightfield real e 20 000 raios.

### S6: pontes e extrusões certas (P3)

**Acceptance Criteria**

15. WHEN uma estrada fechada tem ponte sobre o índice 0 THEN the system SHALL marcar um único trecho de ponte que passa pela costura, e SHALL montar tabuleiro e guarda-corpo em todos os segmentos dele, inclusive o `n-1 → 0`.
16. The system SHALL dar a cada vértice de calçada, tabuleiro, guarda-corpo e pilar a normal da própria face (≤ 1° de diferença), sem média entre faces de quina.

**Independent test:** estrada fechada sintética com ponte sobre a costura em `tests/unit/bridges.test.ts`; leitura das normais da geometria montada.

### S7: menos trabalho por quadro (P3)

**Acceptance Criteria**

17. WHEN `InteriorScene.update` roda 100 vezes depois da primeira THEN the system SHALL criar zero `Vector3`, `Matrix4`, `Quaternion` ou `Euler` novos.
18. The system SHALL redesenhar o minimapa no máximo 30 vezes por segundo de simulação e SHALL redesenhar no quadro seguinte a qualquer mudança de estado da corrida.

**Independent test:** contador nos construtores do three em node, durante 100 `update`.

## Out of scope

| Excluded | Why |
| --- | --- |
| build de chunk num Worker | ver door 3 |
| interpolar partículas, fumaça e marcas de pneu | já nascem da pose física no passo e são desenhadas sem salto visível; interpolar custaria um buffer anterior por partícula |
| terreno carvado acima do asfalto na ponta da avenida 4 | o verificador não confirmou a medida de 0.20 m. Volta se o AC 5 mostrar o mesmo lugar |
| cache de barra de RPM do HUD | o verificador mostrou que reescrever a mesma largura não reinicia a transição. O custo é desprezível |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| orçamento por `update` de chunk | 8 ms em node com JIT aquecido e máquina ociosa | metade do quadro de 16.7 ms, deixando a outra metade ao render e à subida para a GPU, que o node não mede | y (user delegated) |
| raio de pré-montagem no boot | 900 m | é o raio em que o `planChunks` já pede chunk hoje; custa ~0.2 s no boot, que o "Gerando cidade..." da play-fixes cobre | y (user delegated) |
| folga do chão caminhável | `LOT_MARGIN + 0.25` m na `facadeDist` interpolada | 0.25 m ≥ raio do corpo do pedestre (0.22 m) | y (user delegated) |
| taxa do minimapa | 30 Hz | o carro a 200 km/h anda 1.85 m por atualização, menos de 1 px na escala do minimapa | y (user delegated) |

**Open questions:** none - all resolved or logged above.

## Observable

None - no user-facing surface. Tudo aqui é movimento e geometria, e fica medido nos AC.

## Sources

- `.specs/audits/2026-09-29-validation.md` - achados CORE-2, wgen-2, wgen-3, wgen-5, wgen-6, wgen-7, miolo-1, miolo-8, HUD-1
- AD-006, AD-010 e AD-012 em `.specs/STATE.md`
