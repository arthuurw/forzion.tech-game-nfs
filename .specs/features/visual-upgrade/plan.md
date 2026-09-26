# Visual upgrade

Sub-projeto 1.5 do jogo estilo NFSU2: texturas PBR reais, movimento na cena, câmera com
sensação de velocidade e pós-processamento moderno sobre a `free-roam-city` já verificada.
Aprovado em brainstorm de 2026-09-25 (abordagem A: pilha de passes do próprio three, sem
dependência nova). O som foi tratado na feature `engine-sound`, separada.

## Problem

A cidade atual é feita de caixas cinza com uma mesma textura de janelas repetida, a rua é um
plano preto sem detalhe, e nada se move além do carro. O usuário testou em GPU dedicada a 60
FPS e disse: "quero algo mais dinâmico e moderno". Quem paga é o jogador: a atmosfera NFSU2
(neon, asfalto molhado, velocidade) existe só em esboço e cansa em dois minutos.

Quando isto for entregue, o asfalto tem relevo e reflete os letreiros de verdade, os prédios
têm fachadas variadas com janelas em escala humana, chove, os letreiros piscam, o pneu marca o
chão no drift e solta fumaça, faíscas saltam na batida, a câmera abre e treme com a velocidade,
e a imagem passa por oclusão de ambiente, aberração cromática sutil, vinheta e anti-aliasing.

## Flow

Reusa o `EffectComposer` + `UnrealBloomPass` existentes, o `CityLayout` do `CityGenerator`, os
`InstancedMesh` do `CityScene`, o `RigidBody` do carro e o `window.__game` como superfície de
prova; o `Reflector`, `GTAOPass`, `SMAAPass` e `ShaderPass` vêm de `three/addons`.

1. boot -> `core/Loader` (exists) - além do Rapier e do GLB, carrega os 6 sets de textura de `public/textures/<Set>/` (door 1) via `TextureLoader`; um set que falhar vira material de cor chapada com `console.warn`; lê `QualitySettings` de `?quality=` (door 5)
2. `world/CityGenerator` (exists) - cada `Building` ganha `facadeType` 0..3 pelo PRNG; cada `Street` ganha `laneMarks` (posições dos traços)
3. `world/CityScene` (exists) - 4 `InstancedMesh` de fachada, um por `facadeType`, com atributo por instância `aRepeat` e janelas desenhadas no shader (door 2); chão = `Reflector` + malha PBR de asfalto semitransparente (door 3), com o render do espelho escondendo chuva, partículas, cones e faixas (menos draw calls); calçadas PBR; traços de faixa como um `InstancedMesh`; janelas distantes trocam o padrão pela média da célula (antialias por `fwidth`)
4. `world/Rain` (door 4) - `Points` com `ShaderMaterial` que anima a queda na GPU dentro de uma caixa que segue o carro
5. `vehicle/Car` (exists) - o collider do chassi passa a emitir eventos de força de contato (door 6); expõe `isSkidding` (freio de mão + velocidade) e a posição das rodas traseiras
6. `vehicle/Effects` (door 4) - marcas de derrapagem (ring buffer), fumaça de pneu e faíscas (partículas CPU), lê `Car` a cada passo fixo
7. `camera/ChaseCamera` (exists) - FOV por velocidade, offset lateral por velocidade angular, shake por impulso de colisão (fórmulas puras em `camera/chaseMath.ts`, exists)
8. `core/Game` (exists) - composer passa a ser `RenderPass → GTAOPass → UnrealBloomPass → ShaderPass(GradeShader) → SMAAPass → OutputPass` (door 7); anima o flicker dos 4 materiais de letreiro por frame; `world.step(eventQueue)` e drena os eventos para `vehicle/Effects` e a câmera
9. out: pixels no canvas; `__game` ganha `textures`, `post`, `effects`, `weather`, `quality`, `camera.fov`

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `FacadeType` - inteiro 0..3 (concreto, metal, tijolo, reboco) escolhido por seed para cada `Building`, vive em `world/CityGenerator.ts` |
| domain | new term: `QualitySettings` - `{ level: 'high' \| 'low' }` lido de `?quality=` no boot; `low` desliga GTAO e Reflector e reduz a chuva; vive em `core/` |
| domain | new term: `CollisionEvent` - `{ impulse: number, x, y, z }` derivado do evento de força de contato do Rapier (`totalForceMagnitude × dt`), consumido por efeitos e câmera |
| domain | new term: `SkidMark` - quad no chão sob uma roda traseira durante derrapagem; ring buffer de 400 |
| domain | existing term: `Building` ganha `facadeType`; `Street` ganha `laneMarks` - `CityScene` é o único consumidor hoje (C17/C18 da free-roam-city seguem verdadeiros) |
| domain | existing term: `Sign` - `emissiveIntensity` deixa de ser fixo 3.0 e passa a oscilar em `[2.0, 3.2]` (C22 da free-roam-city exige ≥ 2.0 e continua verdadeiro) |
| free-roam-city | C21 (draw calls ≤ 60) é superado: o `Reflector` renderiza a cena uma segunda vez e a pilha de pós adiciona ~10 passes; o novo limite é 120 por frame (AC 8 aqui) e o teste antigo passa a afirmar o novo valor |
| stored data | nothing - nada persistido; texturas são assets estáticos commitados |

## Relations

`None - no stored-data shape change` (assets em `public/textures/` são arquivos estáticos, não dados).

## Surface

`None - nothing consumed outside` (`?quality=low` é um parâmetro de URL lido só pelo boot; está em `## Observable` como entrada de comando).

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. pipeline de texturas | `scripts/fetch-textures.mjs` baixa `https://ambientcg.com/get?file=<Set>_1K-JPG.zip`, extrai só `*_Color.jpg`, `*_NormalGL.jpg`, `*_Roughness.jpg` para `public/textures/<Set>/` (commitados, CC0, `public/textures/LICENSE-ambientcg.txt`); sets: `Asphalt012` (rua), `PavingStones070` (calçada), `Concrete034`, `MetalPlates006`, `Bricks059`, `PaintedPlaster017` (fachadas 0..3) | baixar em runtime do ambientCG - CORS e disponibilidade fora do nosso controle; KTX2/Basis - exige toolchain de compressão que um iniciante não precisa ainda |
| 2. fachadas por instância | `InstancedBufferAttribute` `aRepeat` (vec2 = largura/4, altura/4) e `aSeed` (float) injetados por `material.onBeforeCompile` em `MeshStandardMaterial`; o fragment calcula a célula de janela (grade de 4 m), decide acesa/apagada por hash de `aSeed` + célula, escurece o albedo na célula e soma emissive; 4 materiais (um por `FacadeType`) compartilham o mesmo patch | um `Mesh` por prédio - ~160 draw calls; textura esticada por UV 0..1 - janela de 10 m num prédio de 40 m; textura de fachada pronta com janelas (`Facade018A`) - impossível alinhar a máscara emissiva à grade da foto |
| 3. reflexo da rua | `Reflector` de `three/addons/objects/Reflector.js` num `PlaneGeometry` 444 × 444 em y = 0 com `textureWidth/Height = innerWidth/innerHeight × 0.5` e `clipBias 0.003`; por cima, malha PBR de asfalto em y = 0.02 com `transparent: true, opacity: 0.65`, `map/normalMap/roughnessMap` do `Asphalt012` e `roughness 0.2` | `SSRPass` - experimental, caro e com artefatos em superfícies grandes; só `envMap` (estado atual) - reflete um gradiente, não os letreiros reais |
| 4. sistema de partículas próprio | chuva = `Points` + `ShaderMaterial` com `uTime` (queda calculada no vertex shader, 4000 pontos em `high`, 1000 em `low`); fumaça e faíscas = `Points` com buffers CPU de no máximo 256 e 128 partículas ativas; marcas = `Mesh` com `BufferGeometry` ring buffer de 400 quads (`DynamicDrawUsage`); tudo em `world/Rain.ts` e `vehicle/Effects.ts` | biblioteca de partículas (`three.quarks`) - dependência nova; um `Sprite` por partícula - 4000 draw calls |
| 5. `QualitySettings` | `?quality=low` ou `high` (default `high`, valor inválido → `high`), lido uma vez no boot e exposto em `__game.quality.level`; `low` = sem `GTAOPass`, sem `Reflector`, chuva 1000 | detecção automática de GPU - não há API confiável no browser; menu de opções - vem com a carreira (sub-projeto 5) |
| 6. eventos de colisão | `new RAPIER.EventQueue(true)`, chassi com `.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(2000)`, `world.step(eventQueue)`, `drainContactForceEvents` → `CollisionEvent{ impulse: totalForceMagnitude() × dt }` | detectar batida por queda de velocidade - falso positivo em freada forte; `drainCollisionEvents` (início/fim de contato) - sem magnitude, não distingue encostar de bater |
| 7. pilha de pós-processamento | ordem fixa `RenderPass, GTAOPass, UnrealBloomPass, ShaderPass(GradeShader), SMAAPass, OutputPass`; `GradeShader` é um único `ShaderMaterial` em `post/GradeShader.ts` com uniforms `uAberration 0.0015`, `uVignette 0.35`, `uBlur` (radial, 0..0.6), `uLift vec3(0.0, 0.01, 0.03)`, `uGain vec3(1.05, 1.0, 0.95)`; GTAO em meia resolução com `blendIntensity 0.7` | quatro `ShaderPass` separados (aberração, vinheta, blur, grade) - 4 passes fullscreen a mais por frame; biblioteca `postprocessing` (pmndrs) - dependência e segunda API; `SSAOPass` - GTAO é o sucessor no próprio three |

- Nada mais aqui é difícil de reverter: fórmulas de FOV, shake e flicker são números em módulos puros.

## Criteria

### S2: Materiais PBR (P1)

Asfalto com relevo e reflexo real, fachadas variadas com janelas de 4 m, calçadas e faixas.

**Acceptance Criteria**

1. WHEN the game loads THEN the system SHALL request 18 texture files (`Color`, `NormalGL`, `Roughness` para cada um dos 6 sets em `/textures/<Set>/`) and every one SHALL answer HTTP 200 from the dev server
2. IF a texture file fails to load THEN the system SHALL log `console.warn` with its URL, use a flat-color material for that set and still reach the first frame
3. The system SHALL give the road material a non-null `map`, `normalMap` and `roughnessMap`, `roughness` of 0.25 or less, `opacity` 0.65 with `transparent` true, and texture `repeat` such that one tile spans 4 m
4. The system SHALL place a `Reflector` plane at y = 0 under the road with render target 0.5 × the viewport, present in the scene when quality is `high` and absent when `low`
5. The system SHALL assign each `Building` a `facadeType` in 0..3 from the seed, and `generateCity(1337)` SHALL use all 4 types across its 64 blocks
6. The system SHALL render buildings as exactly 4 `InstancedMesh` (one per `facadeType`) whose geometry carries instanced attributes `aRepeat` = (width / 4, height / 4) and `aSeed` per instance
7. The system SHALL render sidewalks with the `PavingStones070` set (non-null `map` and `normalMap`) and lane marks as one `InstancedMesh` with a dash every 6 m along each street
8. The system SHALL keep total draw calls per frame (main render + reflector render + post passes) at 120 or less with quality `high`

**Independent test:** abrir o jogo e ver asfalto com relevo refletindo os letreiros, prédios de 4 fachadas diferentes com janelas de 4 m, faixas na rua.

### S3: Movimento na cena (P1)

Chuva, neon que pisca, cones de farol, marcas de pneu, fumaça no drift, faíscas na batida.

**Acceptance Criteria**

9. WHILE quality is `high` the system SHALL render rain as one `Points` object with 4000 vertices, and WHILE `low` with 1000
10. The system SHALL animate each rain drop falling at 12 m/s inside a 60 m × 40 m × 60 m box centered on the car, wrapping to the top when it reaches the ground (uniform `uTime` advanced every frame)
11. The system SHALL animate the `emissiveIntensity` of each of the 4 sign materials within `[2.0, 3.2]` every frame, such that at least one material's value differs by more than 0.05 between two samples 0.5 s apart
12. The system SHALL attach 2 additive, transparent cone meshes (`opacity` 0.12) to the car as visible headlight beams, pointing along local +Z
13. WHILE handbrake is held and forward speed exceeds 20 km/h the system SHALL append one skid quad per rear wheel per fixed step to a ring buffer of 400 quads, overwriting the oldest when full, and `__game.effects.skidCount` SHALL report the number written (capped at 400)
14. WHILE the car is skidding the system SHALL spawn 4 smoke particles per fixed step at the rear wheels, each living 0.8 s, with at most 256 alive at once
15. WHEN a `CollisionEvent` with `impulse` of 3000 N·s or more is drained THEN the system SHALL spawn 40 spark particles at the contact point living 0.4 s, and `__game.effects.lastCollision.impulse` SHALL report that impulse
16. IF a `CollisionEvent` has `impulse` below 3000 N·s THEN the system SHALL spawn no sparks and SHALL not update `lastCollision`

26. The system SHALL change each sign material's `emissiveIntensity` by at most 0.2 over any 0.5 s window, using breathing frequencies of 0.5 Hz or less - added 2026-09-25 at the user's request: "as luzes nas janelas estão piscando demais. coloque um ambiente um pouco mais low-cortisol"
27. WHEN the camera moves forward 0.05 m per frame over 10 frames at spawn, with rain, particles and the road mirror hidden, the system SHALL keep the fraction of pixels whose luminance second difference in time exceeds 0.15 below 1 % - added 2026-09-25 at the user's request: "as luzes so estão piscando quando o carro esta em movimento. se está parado, fica bom."

**Independent test:** dirigir na chuva, puxar o freio de mão a 60 km/h e ver marcas + fumaça, bater num prédio e ver faíscas; os letreiros respiram devagar, sem piscar.

### S4: Câmera e velocidade (P2)

FOV abre, blur radial em alta velocidade, shake na batida, câmera atrasa na curva.

**Acceptance Criteria**

17. The system SHALL set the camera `fov` to `62 + 16 × clamp(kmh / 220, 0, 1)`: 62 at 0 km/h, 70 at 110 km/h, 78 at 220 km/h or more
18. The system SHALL set the radial blur strength `uBlur` to `0.6 × clamp((kmh − 120) / 100, 0, 1)`: 0 at 120 km/h or less, 0.3 at 170, 0.6 at 220 or more
19. WHEN a `CollisionEvent` with `impulse` I is drained THEN the system SHALL start a camera shake of amplitude `min(0.4, I / 20000)` m that decays as `e^(−t / 0.15)`, applied as a random offset to the camera position each frame
20. The system SHALL offset the chase camera laterally by `clamp(angularVelocityY × 0.8, −1.2, 1.2)` m (positive = to the car's left), smoothed with the existing `1 − exp(−5·dt)` factor

**Independent test:** acelerar a 200 km/h e ver o FOV abrir e o blur nas bordas; bater e sentir a câmera tremer.

### S5: Pós-processamento moderno (P2)

GTAO, color grade teal/orange, aberração sutil, vinheta, SMAA, toggle de qualidade.

**Acceptance Criteria**

21. The system SHALL order the composer passes exactly `RenderPass, GTAOPass, UnrealBloomPass, ShaderPass, SMAAPass, OutputPass` when quality is `high`, and `RenderPass, UnrealBloomPass, ShaderPass, SMAAPass, OutputPass` when `low`
22. The system SHALL configure `GTAOPass` at half the viewport resolution with `blendIntensity` 0.7 and `output` = `GTAOPass.OUTPUT.Default`
23. The system SHALL set the `GradeShader` uniforms `uAberration` 0.0015, `uVignette` 0.35, `uLift` (0.0, 0.01, 0.03), `uGain` (1.05, 1.0, 0.95) and keep `renderer.toneMapping` = `ACESFilmicToneMapping`
24. WHEN the page is opened with `?quality=low` THEN the system SHALL set `__game.quality.level` to `low`; WHEN opened with no parameter or an unknown value THEN `high`
25. WHILE quality is `high` the system SHALL render the first frame within the same 30 s loading budget already proven for free-roam-city (`__game.ready` true)

**Independent test:** comparar `?quality=low` e sem parâmetro: cantos escurecidos, franja de cor sutil nas bordas, oclusão nos cantos dos prédios só em `high`.

## Out of scope

Product capabilities only.

| Excluded | Why |
| --- | --- |
| Sombras dinâmicas (shadow maps) | cena noturna com luz emissiva; sombra da "lua" quase invisível; farol com sombra exige spot shadow caro - candidata a polimento depois |
| SSR (reflexo em tela) | `Reflector` planar cobre o asfalto, que é a única superfície que importa; SSR é experimental no three |
| LUT por arquivo (`.cube`) | grade lift/gain no shader entrega o teal/orange sem asset; LUT entra se um artista quiser assinar o look |
| Menu de opções gráficas | `?quality=` cobre o toggle; menu vem com a carreira (sub-projeto 5) |
| Tráfego, dano visual, ciclo dia/noite | sub-projetos 6 e além |
| Poças com física (aquaplanagem) | efeito visual só; física do pneu não muda |
| Janelas acendendo e apagando ao longo do tempo | ambiente calmo pedido pelo usuário; janelas são estáticas |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Nomes exatos dos sets ambientCG | os 6 nomes da porta 1, sondados com HTTP 200 em 2026-09-25; se um sumir, `fetch-textures.mjs` falha com o nome e o build usa a cor chapada (AC 2) | validado por sondagem, não por download completo | n |
| Tamanho dos assets no repositório | ≤ 15 MB (6 sets × 3 JPG 1K) | JPG 1K é o menor formato do ambientCG sem toolchain | n |
| Chuva não afeta física nem aderência | só visual | aquaplanagem está fora de escopo | n |
| Marcas de pneu não somem no reset (`R`) | persistem até serem sobrescritas no ring buffer | reset é do carro, não do mundo | n |
| Custo do GTAO + Reflector | aceito em `high`; `low` existe para o resto | usuário reportou 60 FPS em GPU dedicada | y |
| Abordagem de pós | pilha do próprio three (A), sem `postprocessing` lib | escolha do usuário no brainstorm | y |
| Fonte das texturas | CC0 do ambientCG, baixadas e commitadas | escolha do usuário no brainstorm | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `game` (canvas 3D) | loading state | existing - overlay `Carregando...` da free-roam-city (AC 24 lá); texto de progresso passa a listar `Carregando texturas...` |
| screen `game` (canvas 3D) | error state (textura ausente) | AC 2 |
| screen `game` (canvas 3D) | error state (sem WebGL2, boot lança) | existing - free-roam-city AC 25 e C41 |
| screen `game` (canvas 3D) | empty, unauthorised, destructive, density | n/a - iguais à free-roam-city: cidade sempre gerada, sem auth, sem ação destrutiva, sem lista |
| command `?quality=<level>` | every flag and its default | AC 24 |
| command `?quality=<level>` | invalid value | AC 24 - valor desconhecido cai em `high` |
| command `?quality=<level>` | output format, exit codes, fails halfway | n/a - parâmetro de URL lido uma vez; não há saída nem processo |
| command `scripts/fetch-textures.mjs` | output, flags, exit codes | n/a - script de desenvolvimento rodado uma vez pelo autor; imprime cada set e sai 1 no primeiro 404; não é superfície do jogo |
| API / webhook / document / collection | all | n/a - nenhuma |

## Sources

- Feedback do usuário em 2026-09-25 após testar a free-roam-city ("mais dinâmico e moderno"; GPU dedicada, 60 FPS) e as 4 escolhas do brainstorm (PBR CC0, movimento, câmera, pós)
- threejs.org `GTAOPass` (`new GTAOPass(scene, camera, width, height)`, `setSceneClipBox`, `blendIntensity`, `output`), `SMAAPass()`, `Reflector(geometry, { clipBias, textureWidth, textureHeight, color })` - assinaturas conferidas no r186 instalado
- Rapier `event_queue.d.ts` e `collider.d.ts` - `ActiveEvents.CONTACT_FORCE_EVENTS`, `setContactForceEventThreshold`, `drainContactForceEvents`, `TempContactForceEvent.totalForceMagnitude()`
- ambientCG (CC0) - sets sondados com HTTP 200 em 2026-09-25
