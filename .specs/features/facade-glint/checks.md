# facade-glint checks

Profile: standard

## Intent

**O problema hoje.** O farol faz algumas fachadas brilharem aos pontos, piscando quando o carro anda. O usuário disse: "o reflexo do farol do carro em alguns predios. dependendo da textura do predio, o reflexo fica brilhando (piscando)".

**A causa, lida no código.**
- As fachadas usam os normal maps do ambientCG repetidos a cada 4 m, com `roughness` = 0.85 × roughnessMap (`src/world/CityScene.ts:348`). A de metal ainda tem `metalness` 0.5.
- De longe, a GPU usa mips do normal map: a média das normais de vários pixels de relevo.
- O three não aumenta a rugosidade para compensar. O ajuste embutido dele (`geometryRoughness`) só olha a normal da geometria, e a fachada é uma caixa plana.
- Resultado: o brilho do farol, um `SpotLight` de intensidade 40, cai em pontos menores que um pixel. Esses pontos acendem e apagam de um quadro para o outro conforme o carro e a câmera andam.
- É pior onde o relevo e o reflexo são fortes, como as placas de metal e o tijolo, e fraco no reboco. Isso bate com "dependendo da textura".

**O que muda para o jogador.** A fachada continua clara sob o farol, mas sem pontos piscando. A correção é antialiasing de especular no shader da fachada: a rugosidade sobe onde a normal do normal map varia muito dentro do pixel. As derivadas de tela da normal perturbada são somadas à rugosidade antes da iluminação.

**Tamanho.** Toca 3 arquivos: `CityScene.ts` (shader), `Game.ts` (sonda e chave no debug DEV) e `visual.spec.ts`. Não há door nem `plan.md`.

5 checks in 1 slice · 0 one-way doors · 0 open

## Comandos de prova

`npx playwright test tests/e2e/visual.spec.ts -g "<nome>"`: chromium headless contra `vite dev`, lendo `window.__game`.

A sonda `__game.render.headlightShimmer(type, { headlight, specularAA })`, só em DEV, faz o seguinte:
1. Escolhe o lote do centro com `facadeType` = `type` mais próximo do spawn.
2. Põe o carro na estrada do lote, a 12 m da fachada e virado para ela.
3. Esconde a chuva, as partículas e os cones, e troca o espelho da rua pelo chão escuro (como `render.shimmer` com `mirror: false`).
4. Liga ou desliga o farol e o antialiasing de especular.
5. Renderiza 12 quadros no canvas, movendo carro e câmera juntos 0.15 m por quadro, paralelo à fachada.

Ela devolve:
- `flicker`: a fração de pixels cuja luminância tem segunda diferença no tempo acima de 0.15, como `render.shimmer`.
- `litMean`: a luminância média do quarto central da tela no primeiro quadro.

## Checks

### S1 - Fachada sem brilho piscando sob o farol · 3 files · 55 KB · ~14k

**C1** - Para cada um dos 4 tipos de fachada, com `specularAA: true`:

`flicker(headlight: true) − flicker(headlight: false)` ≤ 0.0010 (0.10 % dos pixels). Ou seja, o farol não acrescenta cintilação.

Proof: `npx playwright test tests/e2e/visual.spec.ts -g "headlight adds no facade glint"`

**C2** - Com `specularAA: false` (o shader de antes), pelo menos um dos 4 tipos passa de 0.0010 na mesma diferença de C1. Isso prova que a sonda enxerga o defeito que o usuário viu e que C1 não passa por vazio.

Proof: `npx playwright test tests/e2e/visual.spec.ts -g "probe detects glint without specular antialiasing"`

**C3** - Para cada um dos 4 tipos, com `specularAA: true`, `litMean(headlight: true)` ≥ 1.2 × `litMean(headlight: false)`. O farol continua iluminando a fachada: a correção não apaga o farol.

Proof: `npx playwright test tests/e2e/visual.spec.ts -g "headlight still lights the facade"`

**C4** - Continuam verdes, sem mudar asserções:
- visual-upgrade "lit windows stay stable while the camera moves" (C41, janelas estáveis);
- "four facade meshes with per-instance repeat".

Proof: `npx playwright test tests/e2e/visual.spec.ts -g "lit windows stay stable while the camera moves"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "four facade meshes with per-instance repeat"`

**C5** - Em build de produção, o antialiasing de especular fica sempre ligado. A chave `specularAA` só existe na sonda DEV, e o valor padrão do uniform é 1: `__game.materials.facadeSpecularAA` lê `true` logo depois de `ready`, antes de qualquer sonda.

Proof: `npx playwright test tests/e2e/visual.spec.ts -g "specular antialiasing on by default"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| facade types (4) | 0 Concrete034 C1, C3 · 1 MetalPlates006 C1, C3 · 2 Bricks059 C1, C3 · 3 PaintedPlaster017 C1, C3 | - |
| probe states, farol × AA (4) | on+AA C1, C3 · off+AA C1, C3 · on sem AA C2 · off sem AA C2 | - |
| startup config: facade material (1 assembly) | `makeFacadeMaterial` em `src/world/CityScene.ts`, único criador dos 4 materiais - C5 | - |

- **Checks cruzando a fronteira do browser:** C1-C5. Não há lógica pura nova. A correção é GLSL e só se observa renderizada.

## Test policy

Mesmas linhas das features anteriores.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence:
- **Trecho GLSL em `makeFacadeMaterial`:** sem ramo. Uma fórmula contínua (rugosidade² + variância da normal, limitada). Não tem camada própria testável fora do render, então é provado na fronteira: C1-C3, pelos 4 tipos.
- **Sonda em `Game.ts`:** instrumentation. É usada pelas provas.

Cost: 5 provas Playwright em 1 arquivo.

## Swept

- **validation**: n/a - sem entrada do usuário; a rugosidade corrigida fica limitada a `[0, 1]` pelo shader
- **failure modes**: C2 (a sonda falha sem a correção); C3 (a correção não apaga o farol)
- **idempotency**: n/a - render sem estado; a sonda restaura carro, câmera e visibilidade ao terminar
- **authorization**: n/a - jogo local
- **concurrency**: n/a - render single-thread; a sonda roda dentro de um `evaluate`
- **data lifecycle**: n/a - nada persistido; o chão temporário da sonda é descartado com dispose, como em `render.shimmer`
- **dependency failure**: existing - sem o set de textura, a fachada cai em cor chapada sem normal map (visual-upgrade C2) e não há o que cintilar
- **state transitions**: n/a - sem estado
- **observability**: C5 - `__game.materials.facadeSpecularAA` em DEV

## Handoff

- **Estimativa:** S1 = `CityScene.ts` 17 KB + `Game.ts` ~30 KB + `visual.spec.ts` 18 KB lido em parte ≈ 55 KB / 4 ≈ 14k, abaixo do budget de 150k - one builder.
- **Antes da correção:** o build mede e registra aqui o `flicker` dos 4 tipos sem AA, com o número exato.
- **Se a correção não bastar:** se o antialiasing de especular sozinho não fizer C1 passar sem quebrar C3, stop-and-ask antes de trocar a abordagem (por exemplo, baixar o `metalness` do metal ou o `normalScale`), porque isso muda a aparência das fachadas.
- **Medido no build (antes da correção, `specularAA: false`, `flicker` farol ligado / desligado / diferença):**
  - 0 Concrete034: 0.006439 / 0.003916 / **0.002523**
  - 1 MetalPlates006: 0.026073 / 0.003761 / **0.022313**
  - 2 Bricks059: 0.009730 / 0.002668 / **0.007063**
  - 3 PaintedPlaster017: 0.004071 / 0.002246 / **0.001826**
- **Com `specularAA: true` (Tokuyoshi-Kaplanyan, σ² 0.25, κ 0.18), diferença:** 0 ≈ 0.0023-0.0030 · 1 0.0183 · 2 0.0038 · 3 0.0018. C1 falha. `litMean` ligado/desligado: 1.47 · 2.28 · 1.31 · 1.27 (C3 passa).
- **Stop (build parado):** sem especular nenhum (só difuso), a diferença ainda é 0 0.0023 · 1 0.0000 · 2 0.0003 · 3 0.0016; sem especular e sem textura (parede lisa + janelas) é 0 0.0040 · 3 0.0024. O que a sonda conta nos tipos 0 e 3 são as bordas das janelas escuras passando sob o foco do farol (a segunda diferença acima de 0.15 marca qualquer borda de contraste > 0.15 andando ~2.5 px por quadro). Nenhum antialiasing de especular chega a 0.0010 nesses tipos; C1 precisa de decisão do usuário.
