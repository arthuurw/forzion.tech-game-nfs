# Free-roam city

Sub-projeto 1 de um jogo de corrida de rua no browser, estilo Need for Speed Underground 2.
Roadmap completo (2 corridas, 3 garagem/tuning visual, 4 tuning de performance, 5 carreira,
6 extras) vive em `.specs/STATE.md`. Este plano cobre só o primeiro: dirigir livremente numa
cidade noturna.

## Problem

Não existe nenhum jogo ainda. A pasta do projeto está vazia. Quem paga é o desenvolvedor: não
há base (carro, cidade, loop, HUD) sobre a qual construir corridas, garagem e carreira, e cada
um desses sub-projetos depende de um carro que já dirige numa cidade que já existe. A fonte
(brainstorm de 2026-09-25) não dá métricas; o custo é o de não ter onde começar.

Quando isto for entregue, o jogador abre uma página, vê uma cidade noturna com neon e asfalto
molhado, e dirige um carro com WASD, com velocímetro, marcha, minimapa e som de motor.

## Flow

Reusa `DynamicRayCastVehicleController` do Rapier em vez de física de carro própria, e
`EffectComposer` + `UnrealBloomPass` de `three/addons` em vez de pós-processamento próprio.
O repositório está vazio; todo módulo abaixo é criado pela porta 1 (layout de módulos).

1. página abre -> `src/main.ts` (door 1) - mostra overlay de loading, chama `core/Loader`
2. `core/Loader` (door 1) - inicializa WASM do Rapier, carrega o GLB do carro (door 7); se o GLB
   falhar, entrega um chassi placeholder em caixas; entrega `Assets` ao boot
3. `world/CityGenerator` (door 6) - função pura `generateCity(seed)` -> `CityLayout` (quarteirões,
   prédios, postes, letreiros, limites)
4. `world/CityScene` (door 1) - `CityLayout` -> `InstancedMesh` por tipo de peça + colliders
   fixos cuboides no Rapier + 4 paredes invisíveis nos limites
5. `vehicle/Car` (door 1) - chassi `RigidBody` dinâmico + 4 rodas via
   `DynamicRayCastVehicleController` (door 2); consome `InputState`; a parte pura
   `vehicle/drivetrain.ts` (door 1) converte velocidade + input em marcha, RPM, força de motor e
   ângulo de direção
6. `core/GameLoop` (door 1) - `requestAnimationFrame`; acumulador fixo 60 Hz (door 5): amostra
   input -> drivetrain -> `updateVehicle` -> `world.step`; depois, por frame: `camera/ChaseCamera`
   (door 1) -> sincroniza meshes -> `EffectComposer` (door 3) -> `hud/Hud` (door 1) lê `CarState`
   -> `audio/Engine` (door 8) lê RPM
7. out: pixels no `<canvas>`, HUD em DOM, áudio no `AudioContext`; em build DEV, `window.__game`
   (door 4) expõe `CarState` e `renderer.info` para os testes end-to-end

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `CityLayout` - dados puros da cidade gerada (quarteirões, prédios, postes, letreiros, limites), vive em `world/` |
| domain | new term: `CarState` - snapshot por frame do carro (posição, heading, velocidade em m/s, marcha, RPM), vive em `vehicle/` |
| domain | new term: `InputState` - teclas pressionadas neste tick (`throttle`, `brake`, `steerLeft`, `steerRight`, `handbrake`, `reset`, `mute`; `steerAxis()` deriva -1/0/+1), vive em `core/` |
| domain | new term: `Gear` - inteiro `-1` (ré), `0` (neutro), `1..6`; câmbio automático por faixa de velocidade, vive em `vehicle/drivetrain.ts` |
| stored data | nothing - o jogo não persiste nada neste sub-projeto |

## Relations

`None - no stored-data shape change` (nada é persistido; `localStorage` entra só no sub-projeto 5, carreira).

## Surface

`None - nothing consumed outside` (nenhuma rota, API ou comando; as telas estão em `## Observable`).

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. layout de módulos | `src/{core,world,vehicle,camera,hud,audio}/`; cada módulo com estado exporta uma classe com `update(dt: number)`; lógica pura em arquivos que não importam `three` nem `rapier` (ex.: `world/CityGenerator.ts`, `vehicle/drivetrain.ts`) | ECS (bitecs/miniplex) - abstração que um iniciante paga sem ter entidades suficientes para justificar; monólito em `main.ts` - sem fronteira testável |
| 2. motor de física | `@dimforge/rapier3d-compat@0.21`, chassi `RigidBodyDesc.dynamic()`, rodas via `world.createVehicleController(chassis)` + `addWheel` ×4, tração traseira | física arcade própria - colisão com prédios teria de ser reescrita à mão (escolha do usuário); `cannon-es` - sem manutenção ativa e raycast vehicle menos estável |
| 3. renderização | `three@0.186` `WebGLRenderer` + `EffectComposer` → `RenderPass` → `UnrealBloomPass(strength 0.8, radius 0.4, threshold 0.7)` → `OutputPass`; `renderer.toneMapping = ACESFilmicToneMapping` | `WebGPURenderer` + TSL - suporte de browser ainda parcial e menos material didático para iniciante |
| 4. estratégia de prova | `vitest` para módulos puros; `@playwright/test` (chromium) para integração, lendo `window.__game` que só existe quando `import.meta.env.DEV` é `true` | verificação manual no browser - não tem exit code, viola a regra 1 do processo; `window.__game` sempre exposto - vaza estado interno em produção |
| 5. passo de física fixo | `world.timestep = 1/60`; acumulador em `core/GameLoop` que roda N passos por frame e descarta excedente acima de 5 passos | passo variável `dt` do `requestAnimationFrame` - simulação muda com o FPS e testes não reproduzem |
| 6. gerador determinístico | `generateCity(seed: number): CityLayout` puro, PRNG `mulberry32(seed)`; `seed` padrão `1337`; grid 8×8 quarteirões de 40 m com ruas de 12 m (mundo 404 m × 404 m centrado na origem) | `Math.random()` - layout muda a cada reload e nenhum teste consegue afirmar contagens |
| 7. asset do carro | GLB do Kenney Car Kit (CC0) em `public/models/car.glb`; eixo frontal do carro = `+Z` local; se o arquivo não existir o `Loader` entrega chassi de `BoxGeometry` | modelo do Sketchfab CC-BY - atribuição obrigatória em cada build; carro só de primitivas - o usuário escolheu glTF |
| 8. áudio | Web Audio API nativa: motor = `OscillatorNode` (sawtooth) → `BiquadFilterNode` (lowpass) → `GainNode`; ambiente = ruído branco filtrado; sem arquivos de áudio | Howler.js + samples - dependência extra e licença de sample a resolver antes de existir jogo |
| 9. unidades e eixos | metros, segundos, `Y` para cima, velocidade interna em m/s, exibida em km/h (`× 3.6`); heading em radianos, 0 = `+Z` | unidades mistas (km/h internamente) - cada fórmula de física teria conversão escondida |

- Nothing else in this change is hard to reverse

## Criteria

### S1: Dirigir na cidade (P1)

Um carro que anda, freia, vira, derrapa, bate em prédio e pode ser resetado.

**Acceptance Criteria**

1. WHEN o jogador segura `W` com o carro parado em chão plano THEN the system SHALL levar a velocidade dianteira a no mínimo 50 km/h em até 5 s
2. WHEN o jogador segura `S` com velocidade dianteira acima de 1 km/h THEN the system SHALL aplicar freio nas 4 rodas de modo que a velocidade dianteira diminua a cada passo de física
3. WHILE a velocidade dianteira está em 1 km/h ou menos, WHEN o jogador segura `S` the system SHALL mover o carro em ré até no máximo 30 km/h
4. WHEN o jogador segura `A` ou `D` THEN the system SHALL aplicar ângulo de direção nas rodas dianteiras de 0.5 rad a 0 km/h, decaindo linearmente até 0.15 rad a 150 km/h ou mais
5. WHEN o jogador segura `Space` THEN the system SHALL aplicar freio máximo só nas rodas traseiras e reduzir o atrito lateral delas a 40 % do valor normal
6. The system SHALL limitar a velocidade dianteira a 220 km/h cortando a força do motor acima desse valor
7. IF o chassi encosta num prédio THEN the system SHALL manter o centro do chassi fora do volume do prédio (colisão resolvida pelo Rapier, sem atravessar)
8. IF o chassi cruza um limite da cidade THEN the system SHALL bloqueá-lo por uma parede invisível de modo que `|x|` e `|z|` do chassi fiquem em 202 m ou menos
9. WHEN o jogador pressiona `R` THEN the system SHALL reposicionar o chassi em pé (rotação identidade) 1 m acima da posição atual, com velocidade linear e angular zeradas
10. The system SHALL avançar a física em passos fixos de 1/60 s via acumulador, executando no máximo 5 passos por frame e descartando o tempo excedente
11. WHILE o jogo está rodando the system SHALL posicionar a câmera 6 m atrás e 2.5 m acima do chassi ao longo do heading, suavizada por interpolação com fator 5/s, olhando para 1 m acima do chassi

**Independent test:** abrir a página, segurar `W` por 5 s e ler no HUD ≥ 50 km/h; virar contra um prédio e ver o carro parar; apertar `R` e ver o carro em pé.

### S2: Cidade noturna procedural (P1)

Uma cidade em grid gerada por seed, noturna, com neon que brilha e asfalto que reflete.

**Acceptance Criteria**

12. WHEN `generateCity(seed)` é chamado duas vezes com o mesmo `seed` THEN the system SHALL retornar `CityLayout` estruturalmente idênticos
13. The system SHALL gerar 64 quarteirões (8×8) de 40 m × 40 m separados por ruas de 12 m, centrados na origem
14. The system SHALL colocar em cada quarteirão de 1 a 4 prédios, cada um com altura entre 10 m e 60 m e base inteiramente dentro do quarteirão
15. The system SHALL colocar em cada quarteirão pelo menos 1 letreiro neon com cor tirada de uma paleta de exatamente 4 cores (`#ff2d95`, `#00e5ff`, `#b026ff`, `#ffd400`)
16. The system SHALL colocar postes de luz a cada 20 m ao longo dos dois lados de cada rua
17. The system SHALL renderizar prédios, postes e letreiros com emissive de intensidade 2.0 ou mais nos elementos neon e janelas, e a cena inteira com no máximo 60 draw calls por frame
18. The system SHALL usar material de rua com `roughness` 0.25 ou menos e `scene.environment` não nulo, de modo que as luzes neon apareçam refletidas no asfalto
19. The system SHALL renderizar através de `EffectComposer` com `UnrealBloomPass` ativo e `renderer.toneMapping` igual a `ACESFilmicToneMapping`

**Independent test:** abrir a página e ver grid de prédios com janelas acesas, neon com halo, reflexo colorido na rua; recarregar e ver o mesmo layout.

### S3: HUD (P2)

Velocímetro, marcha, RPM e minimapa no estilo NFSU2, mais telas de loading e erro.

**Acceptance Criteria**

20. WHILE o jogo está rodando the system SHALL exibir a velocidade dianteira em km/h como inteiro, atualizada a cada frame
21. The system SHALL calcular a marcha automaticamente pela velocidade dianteira em km/h: `1` de 0 a 30, `2` de 30 a 60, `3` de 60 a 95, `4` de 95 a 130, `5` de 130 a 170, `6` acima de 170, e `-1` (exibida como `R`) quando a velocidade dianteira é negativa
22. The system SHALL calcular o RPM como `1000 + fração × 6000`, onde `fração` é a posição da velocidade dentro da faixa da marcha atual, limitado ao intervalo `[1000, 7000]`, e exibi-lo como barra proporcional
23. WHILE o jogo está rodando the system SHALL desenhar um minimapa em `<canvas>` 2D de 160 × 160 px mostrando os quarteirões numa janela de 320 m × 320 m centrada no carro, com o carro como triângulo rotacionado pelo heading
24. WHILE o Rapier ou o GLB ainda carregam the system SHALL exibir um overlay de loading com o texto `Carregando...` e escondê-lo quando o primeiro frame renderiza
25. IF o browser não oferece WebGL2 THEN the system SHALL exibir um overlay de erro com o texto `Seu navegador não suporta WebGL2` e não iniciar o loop
26. IF o GLB do carro falha ao carregar THEN the system SHALL registrar `console.warn` com a URL e iniciar o jogo com o chassi placeholder de caixas

**Independent test:** abrir a página, ver `Carregando...` e depois o HUD; acelerar e ver marcha subir de 1 a 6; renomear `car.glb` e ver o carro-caixa dirigível.

### S4: Som (P2)

Motor que sobe de tom com o RPM e um ambiente de fundo, com mute.

**Acceptance Criteria**

27. WHEN o jogador pressiona qualquer tecla pela primeira vez THEN the system SHALL criar e retomar o `AudioContext` e iniciar o loop de motor e o ambiente
28. WHILE o áudio está ativo the system SHALL mapear RPM 1000..7000 linearmente para a frequência do oscilador do motor entre 60 Hz e 200 Hz
29. WHILE o áudio está ativo the system SHALL manter o ganho do ambiente em 0.3 e o do motor em 0.5
30. WHEN o jogador pressiona `M` THEN the system SHALL alternar o ganho master entre 0 e 1

**Independent test:** apertar `W`, ouvir o motor subir de tom junto com a barra de RPM; apertar `M` e ouvir silêncio.

## Out of scope

Product capabilities only.

| Excluded | Why |
| --- | --- |
| Corridas, checkpoints, cronômetro, IA oponente | sub-projeto 2 |
| Garagem, pintura, rodas, body kit, underglow | sub-projeto 3 |
| Tuning de performance (motor, turbo, pneus) | sub-projeto 4 |
| Carreira, dinheiro, save em `localStorage` | sub-projeto 5 |
| Tráfego, pedestres, multiplayer, drag/drift como modo | sub-projeto 6 |
| Câmbio manual | entra com drag race (sub-projeto 6); v1 é automático |
| Gamepad e controle por toque | teclado é o input do brainstorm; gamepad é uma camada sobre `InputState` depois |
| Partículas de chuva, ciclo dia/noite | atmosfera pedida foi "noite + neon + chão molhado"; chuva visível é polimento posterior |
| Dano visual no carro | não existe no pedido |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Testes de integração precisam de browser real | `@playwright/test` com chromium headless lendo `window.__game` | única forma de ter exit code sobre física e render; vitest não roda WebGL nem WASM do Rapier com fidelidade | n |
| Qual GLB do Kenney Car Kit | qualquer carro sedan do kit, salvo como `public/models/car.glb`; o usuário baixa manualmente (CC0) | o kit é CC0 e tem vários carros; o nome do arquivo é fixo pelo `Loader` | n |
| Som sintetizado, sem samples | osciladores + ruído filtrado | zero assets e zero licença; troca por samples é reversível no sub-projeto 4 | n |
| Idioma dos textos de tela | pt-BR (`Carregando...`, mensagem de erro) | idioma do usuário | n |
| Meta de desempenho | sem critério de FPS; instancing obrigatório via limite de 60 draw calls (AC 17) | FPS não é provável em uma execução; draw calls é | n |
| Iluminação dinâmica | no máximo 4 luzes reais (`PointLight`/`SpotLight`) na cena; o resto é emissive + bloom | 100+ postes com luz real não roda em GPU integrada | n |
| Tamanho do bundle | sem limite formal | Rapier WASM (~1 MB) já foi aceito ao escolher Rapier | y |
| Escolha de física | Rapier + raycast vehicle | escolha explícita do usuário no brainstorm | y |
| Escolha de stack | Vite + TypeScript vanilla, sem framework de UI | escolha explícita do usuário no brainstorm | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `game` (canvas 3D) | loading state | AC 24 |
| screen `game` (canvas 3D) | error state | AC 25, AC 26 |
| screen `game` (canvas 3D) | empty state | n/a - a cidade é sempre gerada por seed; não existe estado sem dados |
| screen `game` (canvas 3D) | unauthorised state | n/a - não há autenticação |
| screen `game` (canvas 3D) | destructive action confirms | n/a - `R` (reset) é instantâneo e reversível dirigindo; nada é apagado |
| screen `game` (canvas 3D) | density and ordering | n/a - cena 3D, sem lista |
| screen `hud` (overlay DOM) | empty state | n/a - velocidade 0 e marcha 1 são o estado inicial válido (AC 20, AC 21) |
| screen `hud` (overlay DOM) | loading state | AC 24 - o HUD fica oculto sob o overlay |
| screen `hud` (overlay DOM) | error state | AC 25 - o HUD fica oculto sob o overlay de erro |
| screen `hud` (overlay DOM) | unauthorised, destructive, density | n/a - sem auth, sem ação destrutiva, sem lista |
| screen `minimap` (canvas 2D) | empty, loading, error | n/a - segue o `hud`; desenha assim que `CityLayout` existe (AC 23) |
| API / webhook | all | n/a - nenhuma rota exposta |
| command / scheduled task | all | n/a - nenhum comando além dos scripts npm padrão (`dev`, `build`, `test`, `test:e2e`) |
| document / copy | all | n/a - textos de tela são dois literais cobertos por AC 24 e AC 25 |
| collection being organised | all | n/a - nada é organizado pelo usuário |

## Sources

- Brainstorm de 2026-09-25 nesta sessão - núcleo v1 (cidade aberta), Three.js 3D, cidade procedural + carro glTF, Rapier, Vite + TS, os 4 obrigatórios da v1
- rapier.rs `DynamicRayCastVehicleController` (javascript3d) - `addWheel`, `setWheelEngineForce`, `setWheelSteering`, `updateVehicle(dt)`
- threejs.org `UnrealBloomPass`, `EffectComposer`, `OutputPass` - ordem dos passes e exigência de tone mapping
