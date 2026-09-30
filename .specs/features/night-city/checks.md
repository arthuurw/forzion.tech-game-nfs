# night-city checks

Profile: standard
Plan: `.specs/features/night-city/plan.md`

33 checks in 6 slices · 3 one-way doors · 0 open, of which 0 block

## Checks

### S1 - poste que ilumina o chão · 6 files · 110 KB · ~28k

**C1** - ✅ `lampHeadPosition(lamp)` fica a 6 m de altura sobre a base e 1.6 m ± 0.05 mais perto da linha central da estrada do poste que a base, em todos os postes do seed 1337 (AC 1)
Proof: `npx vitest run tests/unit/lampLight.test.ts -t "lamp head hangs over the road"`

**C2** - ✅ `generateLamps` guarda em cada poste o `heading` da estrada no ponto dele (rad, 0 = +Z), igual ao `atan2` do segmento, ± 1e-6 (AC 1)
Proof: `npx vitest run tests/unit/roads.test.ts -t "lamp posts every 40 m on both sides"`

**C3** - ✅ `lampColor`: `#dce6ff` para poste com |x| e |z| ≤ 500 em qualquer estrada, e para poste de `avenue` ou `highway` fora do centro; `#ff9d4a` para `hill` e `street` fora do centro. Uma linha por caso na tabela (5 linhas) (AC 2, door 1)
Proof: `npx vitest run tests/unit/lampLight.test.ts -t "lamp color by district"`

**C4** - ✅ Na grade de `buildLampLight` do seed 1337: a célula sob cada lente tem intensidade ≥ 0.9 × a cor do poste; toda célula a ≥ 9 m de qualquer lente é 0; e, ao longo de uma linha que sai de uma lente isolada, a intensidade nunca sobe (AC 3, door 2)
Proof: `npx vitest run tests/unit/lampLight.test.ts -t "lamp light grid falls off from each head"`

**C5** - ✅ A grade tem 1536 × 1536 células RGBA de 2 m, com a célula (0, 0) centrada em (−1535, −1535) (AC 3, door 2)
Proof: `npx vitest run tests/unit/lampLight.test.ts -t "lamp light grid covers the world"`

**C6** - ✅ Com `?quality=low` (sem espelho), carro parado numa avenida do centro: a luminância do asfalto sob a lente de um poste à frente ≥ 1.3 × a do asfalto 20 m adiante ao longo da estrada, na mesma imagem (`render.lumAt`) (AC 4)
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "street light pools on the asphalt"`

**C7** - ✅ `__game.world.lamps` tem exatamente 1 `InstancedMesh`, com `count` = número de postes, e a caixa da geometria mede ≥ 1.6 m na horizontal (o braço) (AC 5, AC 1; substitui city-terrain C25)
Proof: `npx playwright test tests/e2e/world.spec.ts -g "lamp posts are one instanced mesh"`

**C8** - ✅ A cor por instância da malha de postes é `#dce6ff` num poste do centro e `#ff9d4a` num poste de `hill`, lida no browser (AC 2)
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "lamp colors in the browser"`

### S2 - asfalto molhado sem confete · 4 files · 120 KB · ~30k

**C9** - ✅ `render.mirrorStreak(20)`: a mancha que o espelho soma abaixo do ponto do chão tem altura ≥ 3 × a largura, em pixels (AC 6)
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "reflections are vertical streaks"`

**C10** - ✅ `render.mirrorStreak(20, { mirrorBlur: false })`: altura ≤ 1.5 × a largura (AC 7)
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "probe sees a sharp reflection without streaks"`

**C11** - ✅ `mirrorStreak(60).h / mirrorStreak(60).srcH` > `mirrorStreak(20).h / mirrorStreak(20).srcH` (AC 8)
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "streaks grow with distance"`

**C12** - ✅ O fragment shader do espelho não contém `blendOverlay(`; o tom `MIRROR_TINT` tem os 3 canais em (0, 1]; `mirrorFresnel(cos)` fica em [0, 1] para cos em {0, 0.25, 0.5, 0.75, 1} e não sobe com cos. O texto do shader interpola `MIRROR_TINT` e as constantes da faixa (AC 9)
Proof: `npx vitest run tests/unit/nightCityShaders.test.ts -t "mirror never adds light"`

**C13** - ✅ As provas da residuals seguem com os limites de hoje: cintilação ≤ 0.001 acima do sem espelho e = 0 parada; ≥ 0.003 com `mirrorBlur: false`; alvo 320 × 180 com texel = 1/tamanho; ganho ≥ 0.6 × o nítido (AC 10)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "street reflection stays stable while the camera moves|probe detects reflection shimmer without blur|reflection blur keeps the half-resolution target|blurred reflection keeps most of its brightness"`

### S3 - céu com horizonte · 4 files · 70 KB · ~18k

**C14** - ✅ `render.skyProfile()` no spawn, câmera parada, só com a cúpula visível (os prédios do spawn tapam o centro do céu): o maior brilho médio de linha nos 25 % de baixo da faixa de céu (colunas do meio 10 %) ≥ 1.5 × a média das 10 % de linhas de cima (AC 11)
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "horizon glows above the skyline"`

**C15** - ✅ `scene.fog.color` e o uniform de horizonte da cúpula são o mesmo `SKY_HORIZON` (`#2a1a3e`); `scene.background` é `SKY_ZENITH` (`#03040c`) (AC 12, door 3)
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "fog takes the horizon color"`

**C16** - ✅ `skylineHeight(az)`: em 3600 amostras de uma volta, todos os valores em [0.02, 0.08], pelo menos 60 valores distintos (degraus), `skylineHeight(az) === skylineHeight(az + 2π)` e mesma saída em duas chamadas (AC 13)
Proof: `npx vitest run tests/unit/nightCityShaders.test.ts -t "skyline is a stepped silhouette"`

**C17** - ✅ Depois de um quadro, a cúpula (`name = 'sky'`) tem a posição da câmera ± 0.001 m, e `render.reflectorSkipped` inclui `sky` (AC 14, door 3)
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "sky dome follows the camera outside the mirror"`

**C18** - ✅ Com a câmera parada olhando 35° para cima (só céu), dois quadros com 1 s de simulação entre eles têm 0 pixels diferentes (AC 15)
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "sky is still"`

### S4 - letreiros e janelas · 4 files · 70 KB · ~18k

**C19** - ✅ `glyphMask(pattern)` de cada um dos 8 padrões (64 × 32): a fração de texels de tubo fica entre 0.15 e 0.45 (AC 16)
Proof: `npx vitest run tests/unit/nightCityShaders.test.ts -t "sign glyphs cover part of the face"`

**C20** - ✅ A geometria de letreiro é uma caixa de profundidade 0.12 m, e cada letreiro recebe um padrão em [0, 7] sorteado da sua semente com `mulberry32`, igual em duas montagens (AC 16)
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "signs are framed boxes with a glyph pattern"`

**C21** - ✅ Os 4 materiais de letreiro seguem com `emissiveIntensity` ≥ 2 e o respiro em [2.0, 3.2] (AC 17)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "neon emissive intensity at least 2"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "neon signs flicker"`

**C22** - ✅ `windowTint(h)` sobre 10 000 valores de `h` uniformes em [0, 1): 70 % ± 1 quente `#ffd9a0`, 20 % ± 1 fria `#cfe0ff`, 10 % ± 1 azul `#7fa8ff`; o shader de fachada usa os mesmos limites (0.70, 0.90) e cores, interpolados, e um hash separado do hash de janela acesa (AC 18; ver Handoff)
Proof: `npx vitest run tests/unit/nightCityShaders.test.ts -t "window tints come in three fixed colors"`

**C23** - ✅ As provas de janela estável e da facade-glint seguem com os limites de hoje (AC 19)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "lit windows stay stable while the camera moves|headlight adds no facade glint|probe detects glint without specular antialiasing|headlight still lights the facade|brick facade glint has margin"`

### S5 - orçamento e calma · 5 files · 60 KB · ~15k

**C24** - ✅ No grid do centro em corrida: `render.calls` ≤ 218 (AC 20)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "draw calls within budget while racing"`

**C25** - ✅ Nas 5 poses de `render.spec.ts`: `render.calls` ≤ 220 (AC 21)
Proof: `npx playwright test tests/e2e/render.spec.ts -g "draw calls at most 220 across the world"`

**C26** - ✅ Os textos de shader novos (céu, lente do poste, luz no chão, faixa do espelho, tinta de janela, glifo de letreiro) não declaram nem leem uniform de tempo (`uTime`, `time`), e a grade de luz é montada uma vez (AC 22)
Proof: `npx vitest run tests/unit/nightCityShaders.test.ts -t "nothing new reads the clock"`
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "lamp light map is built once"` (mesma textura e mesma `version` depois de 1 s de simulação)

**C27** - ✅ Com `?quality=low`: 1 malha de postes, cúpula `sky` na cena, o material do asfalto com o uniform `uLampLight`, letreiros com profundidade 0.12 e nenhum espelho (AC 23)
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "low quality keeps the night city"`

**C28** - ✅ `src/world/lampLight.ts` é puro (sem `three` nem Rapier, direto ou por import relativo) e está na lista da trava de pureza (door 2)
Proof: `npx vitest run tests/unit/purity.test.ts -t "pure modules do not import three or rapier"`

**C29** - ✅ O asfalto do centro, o de fora, a calçada e o terreno leem o mesmo `uLampLight` (a mesma `DataTexture`), e a textura tem 1536 × 1536, filtro linear e sem mipmap (door 2)
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "ground materials share the lamp light map"`

### S6 - provas de pixel da rodada 1 do Verifier · 5 files · 70 KB · ~18k

Checks acrescentados depois do FAIL da rodada 1 (`verification.md`): o F5 sobreviveu e a linha "Shader" do `Test policy` não tinha sonda de pixel para a silhueta, a lente e o letreiro. Nenhum check aprovado foi reescrito.

**C30** - A cúpula desenha a silhueta de `skylineHeight`: o uniform `uSkyline` é `SKYLINE_TABLE`, o fragment indexa por `fract((atan(d.x, d.z) + PI) / (2π))` e pinta `SKY_SILHOUETTE` abaixo da altura; no browser, só com a cúpula, em 12 azimutes (meio dos degraus 0, 8, …, 88), a luminância 0.006 abaixo de `skylineHeight(az)` é ≤ 0.5 × a de 0.01 acima (AC 13, door 3)
Proof: `npx vitest run tests/unit/nightCityShaders.test.ts -t "dome shader draws the skyline table"`
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "dome draws the skyline silhouette"`

**C31** - A geometria do poste tem haste (cilindro de 6 lados) e 3 caixas; só os 24 vértices da lente têm `aLens` = 1, na ponta do braço (|x − 1.6| ≤ 0.25) a 5.82 m ± 0.01; a carcaça (0.6 m de largura) está lá, entre 5.83 e 5.97 m; o fragment só emite com `vLens · vLampColor`. No browser, só com os postes e sem luzes, a lente mede luminância ≥ 0.5, a haste e o braço ≤ 0.05 (AC 1; completa a carcaça de C7)
Proof: `npx vitest run tests/unit/nightCityShaders.test.ts -t "lamp geometry has a housing and only the lens glows"`
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "only the lamp lens glows"`

**C32** - O material do letreiro tem cor `#101014`, marca `vSignFace = step(0.5, abs(normal.z))` e emite só `tube · vSignFace`. No browser, só com os letreiros e sem luzes, um letreiro de ≥ 2 × 1 m tem luminância máxima ≥ 0.5 numa grade de 9 × 5 pontos da face da frente e da de trás, e ≤ 0.05 em 15 pontos da lateral da caixa (AC 16)
Proof: `npx vitest run tests/unit/nightCityShaders.test.ts -t "sign shader lights tubes only on the front and back faces"`
Proof: `npx playwright test tests/e2e/nightCity.spec.ts -g "sign tubes glow on both faces and the frame stays dark"`

**C33** - `lampFalloff(d)` = `(1 − (d/9)²)²` ± 1e-12 em d ∈ {0, 1, 2.25, 4.5, 6, 8, 8.99}; `lampFalloff(4.5)` = 0.5625; 0 em 9 e 12 m (door 2; precisão de C4)
Proof: `npx vitest run tests/unit/lampLight.test.ts -t "lamp falloff is squared"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| partes do poste (4) | haste C1, C7, C31 · braço C1, C7, C31 · carcaça C31 · lente C1, C8, C31 | - |
| casos de `lampColor` (5) | centro/qualquer C3 · `avenue` fora C3 · `highway` fora C3 · `hill` fora C3, C8 · `street` fora C3 | - |
| propriedades da grade de luz (5) | sob a lente C4 · zero a ≥ 9 m C4, C33 · não sobe com a distância C4 · queda quadrática C33 · tamanho e origem C5 | - |
| materiais de chão que leem a luz (4) | asfalto do centro C29 · asfalto de fora C29 · calçada C29 · terreno C29 | - |
| modos do espelho (2) | faixa C9, C11, C13 · amostra única C10, C13 | - |
| distâncias da faixa (2) | 20 m C9, C11 · 60 m C11 | - |
| garantias do reflexo (3) | sem overlay C12 · tom ≤ 1 C12 · Fresnel em [0, 1] C12 | - |
| provas da residuals mantidas (4) | cintilação C13 · sensibilidade C13 · alvo C13 · ganho C13 | - |
| partes do céu (4) | degradê e brilho C14 · névoa da mesma cor C15 · silhueta C16, C30 · segue a câmera fora do espelho C17 | - |
| faces do letreiro (3) | tubos da frente C32 · tubos de trás C32 · moldura escura C32 | - |
| cores de janela (3) | quente C22 · fria C22 · azul C22 | - |
| padrões de glifo (8) | C19, table-driven sobre os 8 | - |
| orçamento (2 lugares) | grid da corrida C24 · 5 poses do mundo C25 | - |
| qualidades (2) | high C7-C25 · low C27 | - |
| doors do plan (3) | door 1 C3 · door 2 C4, C5, C28, C29 · door 3 C15, C17 | - |

- Nenhum check afirma mais do que o caso que a própria prova exercita. C6 roda em `low` para medir só a luz no chão, sem a faixa do espelho somando no mesmo pixel.

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Regra pura de mundo (`lampColor`, `lampHeadPosition`, `buildLampLight`, `skylineHeight`, `windowTint`, `glyphMask`) | uma na própria camada, vitest | um caso por linha da tabela de decisão ou por propriedade afirmada |
| Shader (espelho, céu, lente, chão, fachada, letreiro) | uma unitária sobre o texto do shader (constantes interpoladas, nada de relógio) e uma no browser pela sonda de pixel | um caso por comportamento visual afirmado |
| Fiação da cena (`CityScene`, `Environment`, `Game`) | uma e2e lendo `__game` | um caso por objeto ou uniform afirmado |

Evidence:
- `lampColor`: 3 condições (centro, tipo de estrada, fora do centro), 5 linhas. Decide.
- O espelho é GLSL e decide o que aparece: não há como testar GLSL fora do browser, então o nível é a sonda de pixel, como na residuals (C1-C4) e na facade-glint.
- Precedente: `tests/unit/shaderConstants.test.ts` prova as constantes interpoladas no texto do shader (residuals C8-C10).

Cost: 1 arquivo unitário novo (`lampLight.test.ts`), 1 de shaders (`nightCityShaders.test.ts`), 1 e2e novo (`nightCity.spec.ts`, 13 testes), 2 e2e mudados (`world.spec.ts` C25 da city-terrain, `race.spec.ts` limite 218).

## Swept

- validation: C5 (limites da grade), C16 (faixa da silhueta), C19 (cobertura do glifo)
- failure modes: n/a - nenhum caminho de erro novo; um shader que não compila cai no overlay de erro de hoje (`main.ts`)
- idempotency: C20 (mesmo padrão de letreiro em duas montagens), C16 (mesma silhueta em duas chamadas)
- authorization: n/a - jogo local, sem conta
- concurrency: n/a - render de uma thread; a grade é montada uma vez no boot
- data lifecycle: n/a - nada persistido; a grade vive na memória da GPU como as outras texturas
- dependency failure: n/a - sem dependência externa nova
- state transitions: C27 (troca de qualidade), C17 (a cúpula acompanha cada quadro)
- observability: C9-C11, C14, C18 (sondas DEV `render.mirrorStreak`, `render.skyProfile`, `render.lumAt`)

## Handoff

- S1 = 28k (roadMesh 6 KB, CityScene 25 KB, lampLight novo, ChunkManager 16 KB, Game 60 KB lidos em parte, world.spec 16 KB). S2 soma 30k (shader do espelho, sondas no Game, visual.spec 23 KB) e chega a 58k. S3 soma 18k (Environment, Game) e chega a 76k. S4 18k chega a 94k. S5 15k chega a ~109k, abaixo do budget de 150k. Um builder só
- Mechanism: one builder (cabe no budget, sem pergunta)
- **Settled at checks:** o AC 18 pedia as proporções 70/20/10 contadas sobre as janelas acesas do seed 1337. O sorteio de janela é um hash `sin` que roda na GPU e não reproduz bit a bit em JavaScript, então contar janela na tela mediria o hash da GPU, não a regra. C22 prova a regra (`windowTint` sobre 10 000 valores uniformes) e que o shader usa os mesmos limites e cores com um hash separado do de janela acesa. Decisão delegada pelo usuário
- **Settled mid-build:** C14 mede só a cúpula. No spawn, as colunas do meio do quadro caem num prédio distante tingido pela névoa (luminância ~0.2 no topo), e a medida comparava prédio com prédio. A sonda esconde o resto da cena durante o quadro; a afirmação sobre o degradê do céu é a mesma
- **Settled mid-build:** door 3a no plan: cúpula de 500 m, porque a câmera tem `far` de 600 m
- **Settled mid-build:** o espelho sem faixa ficou mais escuro que o de antes (tom ≤ 1 e Fresnel, sem overlay), e a prova de sensibilidade da residuals (C2, ≥ 0.003) caiu para 0.0012 e depois 0.0029. Em vez de mexer no limite dela, o tom subiu para `[0.88, 0.92, 1.0]` e o Fresnel de cima para 0.65: medido 0.0042 (C2), +0.00016 (C1, limite 0.001), ganho 0.011 contra 0.6 × 0.0096 (C4)
- **Settled mid-build:** a faixa do espelho usa 13 amostras (o plano dizia 9 no doc do módulo): com 9, longe, o espaçamento passava do tamanho da fonte e a faixa virava pontos. A base passou de 6 para 10 texels, para o reflexo perto da câmera também virar faixa; o crescimento é 0.06 por metro
- **Settled mid-build:** a sonda `mirrorStreak` esconde o carro do jogador (o reflexo perto cai atrás dele), desliga o bloom (o halo da esfera escorria para baixo da linha do chão) e corta em 25 % do pico (mede a forma da mancha, não o brilho)
- **Settled mid-build:** `nightCity.spec.ts` entrou na lista da regra de higiene da test-hardening (C7 dela), com 2 testes `@smoke`
- **Settled after verification round 1:** o Verifier deu FAIL (F5 sobreviveu; linha "Shader" do `Test policy` sem sonda de pixel para silhueta, lente e letreiro; carcaça e faces do letreiro sem prova). Entraram C30-C33 (S6) e a sonda DEV `render.isolatedLum` (só os objetos pedidos, sem pós nem luzes, sobre preto). Com o F5 reinjetado, C30 falha nas duas provas (e2e: 0.118 contra ≤ 0.051). Os checks C1-C29 não mudaram
