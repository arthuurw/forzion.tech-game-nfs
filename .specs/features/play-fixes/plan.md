# play-fixes

## Problem

A validação de 2026-09-29 (`.specs/audits/2026-09-29-validation.md`) achou bugs que o jogador vê ou ouve, todos confirmados com o código ou com uma sonda do Rapier real. As suítes seguem verdes porque nenhum teste passa por eles:

- **Teclas presas.** Quem segura W e dá Alt+Tab volta com o carro acelerando sozinho, porque o `keyup` foi para outra janela (CORE-1, `InputManager.ts:16`).
- **Áudio fora de hora:**
  - com a aba oculta o motor continua tocando no último RPM (AUDIO-1);
  - se a primeira tecla for Esc, o `AudioContext` nasce suspenso e o jogo fica mudo a sessão inteira (AUDIO-2);
  - na contagem, segurar W sobe o volume sem subir o giro (AUDIO-3);
  - se `new AudioContext()` lançar, a primeira tecla se perde (AUDIO-4).
- **Jogo congela sem aviso.** Um throw no quadro para o loop e mostra só a última imagem (CORE-7). Na geração do mundo, a tela diz "Carregando carro..." por segundos (CORE-9).
- **Corrida:**
  - no sprint, o oponente que já chegou continua dirigindo com esterço travado a ~190 km/h e sai da pista. A sonda reproduziu nas duas sprints (veh-1);
  - depois que o jogador chega, os oponentes ainda correndo puxam o freio de mão com o volante reto e seguem reto numa curva (veh-10);
  - dois carros resetados no mesmo portão nascem no mesmo ponto (veh-2);
  - o carro volta da água em 5ª e sai lento: 0-60 km/h leva 2.67 s em vez de 2.18 s (veh-3);
  - num empate no mesmo passo, o jogador sempre perde (veh-8).
- **R no free roam.** O carro desvira, mas passa a apontar para +Z, atravessado na pista (veh-5).
- **Chuva.** Fica presa entre y 0 e 40 m do mundo e some nas estradas de morro, que sobem até 94 m (wgen-1).
- **Miolo das quadras:**
  - o gato fica dentro do capô por até 0.7 s: a sonda achou 638 passos dentro do chassi (miolo-2);
  - gatos e pedestres trocam de cor quando outro some (miolo-3);
  - o shader dos carros estacionados não compila num seed sem estacionamento (miolo-6);
  - o pedestre encurralado fica parado para sempre no estado de fuga: 6 de 400 na sonda (miolo-7);
  - o comentário do estacionamento cita uma folga que o código não usa (miolo-11).
- **Trem.** Uma coluna do portal entra 0.29 m no asfalto da avenida 4 e tem collider rígido (wgen-4).
- **Render:**
  - o reflexo da rua fica na resolução da janela do boot depois de maximizar (RENDER-1);
  - o GTAO ignora o pixelRatio e a troca de DPR nunca é reaplicada (RENDER-3);
  - `antialias: true` gasta memória sem suavizar nada, porque o composer já usa SMAA (RENDER-4).

Quando isto sair: soltar a janela solta as teclas, o som segue a aba e a corrida, um erro aparece na tela, os oponentes param direito depois da chegada, a chuva cai em qualquer altura, o miolo não atravessa o carro nem trava, e o render acompanha a janela.

## Flow

Reusa o que já decide cada caso: `createInputState` para limpar o input, o `showError` do `main.ts` para o overlay, `aiDrive` para o esterço depois da chegada, o desenho de grid de `raceRoutes.ts` (fileiras de 8/16 m, ±3 m de lado) para espalhar o reset, e a regra do gato (`stepCat`) para o pedestre.

1. `core/InputManager` (exists): `blur` e `visibilitychange` zeram o estado. `onFirstKey` roda depois de aplicar a tecla, e cada `keydown`/`pointerdown` pede `resume` se o áudio não está `running`.
2. `audio/AudioEngine` (exists): `suspend`/`resume` pela visibilidade, `state` espelhando `ctx.state`, falha do construtor tolerada.
3. `core/GameLoop` (exists) → `main.ts` (exists): um throw no quadro para o loop e chama `showError`. O `main` mostra "Gerando cidade..." e cede um quadro antes do `new Game`.
4. `core/Game` (exists): passa ao áudio o `DriveInput` efetivo do passo; o R do free roam chama `Car.reset` com heading; o resize refaz o espelho, o pixelRatio e o GTAO.
5. `vehicle/Car` (exists): `teleport` e `reset` voltam o câmbio, o volante e as amostras de g lateral ao estado inicial; `reset` mantém o yaw.
6. `race/Opponent`, `race/RaceController`, `race/raceSession`, `race/raceProgress`, `race/raceRoutes` (exists): input de parada depois da chegada, reset por slot (o grid montado atrás do portão), desempate pela fração do cruzamento e a chegada do sprint 200 m antes do fim do traçado.
7. `world/Rain` e `world/rainMath` (exists): a caixa da chuva segue a altura do carro.
8. `world/interiors/interiorMotion`, `world/interiors/InteriorScene`, `world/interiors/InteriorProps` (exists): caixa orientada do chassi para gato e pedestre, saída da fuga sem rota, cor por identidade, malha de estacionados só com carros.
9. `world/rail/trainLine` (exists): portal pulado quando uma coluna encosta noutra estrada.
10. `world/CityScene` (exists): o espelho expõe o redimensionamento do alvo e do `uTexel`.

## Impact

| Front | What changes |
| --- | --- |
| checks de outras features | free-roam-city C11 (`drive.spec.ts:186-190`) exige rotação identidade depois do R. Passa a exigir o carro em pé com o heading mantido. Renegociado com o usuário em 2026-09-29 |
| checks de outras features | block-life-extras C25 (`extrasMotion.test.ts:166`) cobra o gato a ≥ 0.5 m do centro do carro. Passa a cobrar fora da caixa do chassi, o que é mais forte |
| checks de outras features | races: o hold depois da chegada deixa de ser `HOLD_INPUT`. A contagem continua com `HOLD_INPUT` (races AC 29 e C29) |
| checks de outras features | races AC 4 e C6 (`raceRoutes.test.ts` "gates spaced and sized") exigiam a chegada do sprint a ≤ 4 m do fim do traçado. A chegada passa a ficar 200 m antes do fim (`SPRINT_RUNOFF`): nas duas sprints do seed 1337 o traçado acaba num T com o anel ou no fim da estrada do morro, e o AC 10 pede parar no traçado. Achado no build |
| checks de outras features | races C29 (`raceSession.test.ts` "reset target is last gate or grid slot") e o caso de portão de `aiDriver.test.ts` punham o alvo em cima do portão. Com o AC 12 passa a ser o lugar do grid montado atrás do portão, para todos os slots, inclusive o do jogador. Achado no build |
| checks de outras features | visual-upgrade C4 (alvo do espelho = `floor(innerWidth × 0.5) × floor(innerHeight × 0.5)`) continua valendo, agora também depois de um resize |
| termo | `AudioEngine.state` era "já chamei start". Passa a ser o `ctx.state` real. Quem lê: `tests/e2e/audio.spec.ts` e o hook DEV `audio` |
| mundo | com o seed 1337, um portal do trem some no canto NW (o da coluna sobre a avenida 4). A contagem de portais cai em 1 ou mais |
| stored data | nada para migrar |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| None | - | - |

- Nothing in this change is hard to reverse. São correções dentro de módulos que já existem, sem padrão novo, dependência nova nem dado gravado. A mudança do R é de comportamento e volta num commit.

## Criteria

### S1: teclas soltas quando a janela perde o foco (P1)

**Acceptance Criteria**

1. WHEN a janela dispara `blur` THEN the system SHALL zerar todo o input (`throttle`, `brake`, `left`, `right`, `handbrake` = false).
2. WHEN `document.visibilityState` vira `hidden` THEN the system SHALL zerar todo o input.

**Independent test:** no browser, segurar W, disparar `blur` na janela e ver `__game.car.speedKmh` parar de subir.

### S2: áudio acompanha a aba e o jogador (P1)

**Acceptance Criteria**

3. WHEN a página fica oculta com o áudio `running` THEN the system SHALL suspender o `AudioContext` (`ctx.state === 'suspended'`), e WHEN ela volta a ficar visível THEN SHALL retomá-lo (`running`).
4. WHEN chega um `keydown` ou `pointerdown` com o `AudioContext` criado e fora de `running` THEN the system SHALL chamar `resume()`. `audio.state` SHALL ser sempre igual a `ctx.state`.
5. IF `new AudioContext()` lança THEN the system SHALL aplicar mesmo assim a tecla que disparou a criação (o carro acelera com W) e seguir o jogo sem som, com um `console.warn` que começa com `Áudio indisponível`.
6. WHILE a corrida está em `countdown` com W segurado, the system SHALL levar o ganho do motor ao valor de acelerador solto, o mesmo de `engineGainFor(false)`.

**Independent test:** `tests/e2e/audio.spec.ts`, forçando `document.visibilityState` e lendo `__game.audio`.

### S3: erro visível e carregamento honesto (P1)

**Acceptance Criteria**

7. IF `fixedUpdate` ou `render` lança durante o jogo THEN the system SHALL parar o loop e mostrar o overlay `#error` com o texto `Erro no jogo: <mensagem do erro>`.
8. WHEN o carregamento dos assets termina THEN the system SHALL mostrar `Gerando cidade...` em `#loading` e deixar o browser pintar esse texto antes de gerar o mundo.

**Independent test:** hook DEV que lança no próximo `fixedUpdate` e checa `#error`.

### S4: oponentes param direito e o reset não empilha carros (P1)

**Acceptance Criteria**

9. WHEN um oponente termina a corrida (`progress.finished`) THEN the system SHALL dar a ele o esterço da IA com acelerador solto e freio até |velocidade| < 5 km/h, e depois `HOLD_INPUT`. Com a velocidade para trás acima de 5 km/h, SHALL frear pelo lado oposto (acelerador, sem freio).
10. WHEN um oponente termina qualquer uma das 4 corridas (`circuito-centro`, `circuito-anel`, `sprint-cruzada`, `sprint-morro`) THEN, em até 8 s de simulação, the system SHALL tê-lo com |velocidade| < 5 km/h, e em nenhum passo desse intervalo ele SHALL ficar a mais de `largura da estrada / 2` do traçado da corrida.
11. WHILE a sessão está `finished` (o jogador chegou) e um oponente ainda não terminou, the system SHALL aplicar a esse oponente a mesma parada do AC 9, não `HOLD_INPUT`.
12. WHEN os 4 corredores resetam para o mesmo portão THEN the system SHALL dar a cada slot um alvo diferente, na mesma forma relativa do grid (fileiras 8 e 16 m atrás, ±3 m de lado), de modo que as 4 caixas de chassi (0.9 × 2.1 m de meia medida) não se sobreponham e cada alvo fique no asfalto (a ≤ `largura / 2 − 1 m` do traçado).
13. WHEN dois corredores cruzam a chegada no mesmo passo THEN the system SHALL pôr na frente o de menor fração de cruzamento dentro do passo. O tempo mostrado continua o do passo (AD-016).

**Independent test:** `tests/physics/raceAi.test.ts`, correndo 8 s depois da chegada de cada oponente em cada corrida.

### S5: o carro volta inteiro de um reset (P1)

**Acceptance Criteria**

14. WHEN `teleport` ou `reset` roda THEN the system SHALL deixar o carro em 1ª marcha, volante em 0, `lateralG` = 0 e `skidding` = false.
15. WHEN o carro, em 5ª a 150 km/h, é teleportado parado THEN the system SHALL levá-lo de 0 a 60 km/h no mesmo tempo de um carro novo, ±0.05 s.
16. WHEN o jogador aperta R no free roam THEN the system SHALL levantar o carro 1 m, pô-lo em pé (eixo +Y do chassi com y ≥ 0.999) e manter o heading de antes do R, ±0.01 rad. Substitui a exigência de rotação identidade da C11 da free-roam-city, decisão do usuário em 2026-09-29.

**Independent test:** `tests/physics` com o `Car` real: 5ª a 150 km/h, teleport, cronometrar 0-60.

### S6: chuva em qualquer altura (P1)

**Acceptance Criteria**

17. WHILE o carro está na altura `cy`, the system SHALL pôr a altura de cada gota em `[cy − 12, cy + 28)` m, a caixa de 40 m com 30 % abaixo do carro. A mesma conta SHALL valer no shader e em `rainMath`.
18. WHILE o carro está numa estrada de morro a y ≥ 60 m, the system SHALL mostrar gotas visíveis na tela, na mesma ordem de grandeza (≥ 0.5 ×) da contagem com o carro a y ≈ 2 m na mesma pose de câmera.

**Independent test:** teleportar o carro para o ponto mais alto da `sprint-morro` e contar pixels de gota.

### S7: miolo não atravessa o carro nem trava (P2)

**Acceptance Criteria**

19. WHILE o carro está a menos de 8 m de um gato, the system SHALL manter o gato, em cada passo, fora da caixa orientada do chassi aumentada em 0.3 m (|ao longo| ≥ 2.4 m ou |de lado| ≥ 1.2 m), ou em `gone`.
20. WHILE o carro está a menos de 8 m de um pedestre, the system SHALL manter o pedestre, em cada passo, fora da mesma caixa do AC 19.
21. IF o pedestre em fuga não acha nenhuma direção dentro da zona por 1 s de simulação THEN the system SHALL tirá-lo da fuga e mandá-lo andar num segmento novo. Nenhum pedestre SHALL ficar em fuga com deslocamento zero por mais de 2 s.
22. The system SHALL dar a cada gato e a cada pedestre uma cor fixa pela identidade dele (índice do spawn), que não muda quando outro gato ou pedestre entra, sai ou vira `gone`.
23. IF o miolo não tem nenhum carro estacionado THEN the system SHALL não criar a malha de estacionados, e o render SHALL rodar sem erro de shader no console.
24. The system SHALL descrever no comentário do estacionamento os números que `wellInside` usa: raio 4 m e 5.5 m da fachada.

**Independent test:** `tests/unit/extrasMotion.test.ts` e `tests/unit/interiorMotion.test.ts`, com 200 gatos e 400 pedestres do seed 1337 e o carro passando a 8 e 20 m/s.

### S8: trem fora do asfalto (P2)

**Acceptance Criteria**

25. The system SHALL manter cada coluna de portal do trem a ≥ `largura da estrada / 2 + 0.25 m + 0.5 m` de toda estrada que não é a avenida que o portal atravessa. Um portal com uma coluna mais perto que isso SHALL ser pulado.

**Independent test:** `tests/unit/trainLine.test.ts` percorrendo todas as colunas contra todas as estradas do seed 1337.

### S9: render acompanha a janela (P2)

**Acceptance Criteria**

26. WHEN a janela muda para W × H px (CSS) THEN the system SHALL redimensionar o alvo do espelho da rua para `floor(W × 0.5) × floor(H × 0.5)` e o `uTexel` dele para o inverso desse tamanho.
27. WHEN a janela muda de tamanho ou de `devicePixelRatio` THEN the system SHALL aplicar ao renderer e ao composer o pixelRatio `min(devicePixelRatio, 2)`, e o GTAO SHALL ter metade do tamanho em pixels do buffer (`floor(W × pr / 2) × floor(H × pr / 2)`).
28. The system SHALL criar o `WebGLRenderer` com `antialias: false` e manter o `SMAAPass`.

**Independent test:** `page.setViewportSize` de 640×360 para 1280×720 e leitura do tamanho do alvo do espelho por `__game`.

## Out of scope

| Excluded | Why |
| --- | --- |
| volante da IA liga/desliga (veh-4) | o verificador mediu desvio lateral RMS de 0.00 m no anel: a rampa do volante filtra, e o zigue-zague não aparece na tela. Sobra qualidade de controle, que o equilíbrio da carreira (sub-projeto 5) pode pedir |
| validar a `CarSpec` (veh-7) | o exemplo principal foi refutado (a curva não divide por zero). O risco restante nasce com os controles do tuning, e o plano do sub-projeto 4 define as faixas |
| collider para pedestre | a block-fill AC 33 decidiu pedestre sem collider. O AC 20 só impede que ele fique dentro do carro |
| re-gerar o mundo em tempo de execução | ver pre-garage (dispose) |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| comportamento do R no free roam | desvira, levanta 1 m e mantém o heading | decisão do usuário em 2026-09-29 | y |
| parada do oponente depois da chegada | freio de serviço com o esterço da IA até 5 km/h, depois `HOLD_INPUT` | AD-015: só `DriveInput`. O freio de mão com volante reto é o que tira o carro da curva hoje | n |
| a quem vai a fração do cruzamento | só desempate; `finishTime` continua no passo | a AD-016 fixa o relógio como soma de passos. O desempate não muda nenhum tempo mostrado | n |
| como espalhar o reset | a mesma forma do grid (8/16 m atrás, ±3 m de lado) relativa ao portão, por slot | já provada no asfalto pela races. Não precisa de consulta de sobreposição ao Rapier | n |
| caixa da chuva | 30 % abaixo e 70 % acima do carro | a câmera fica atrás e acima do carro, e as gotas caem de cima | n |
| texto do erro em jogo | `Erro no jogo: <mensagem>` | mesmo padrão do `Falha ao iniciar o jogo:` do boot | n |
| pedestre dentro da caixa | empurrado para fora pelo eixo lateral, como o gato | o pedestre não tem estado `gone`, e sumir com ele na frente do jogador chamaria mais atenção | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| overlay `#error` | estado de erro | AC 7 |
| overlay `#loading` | estado de carregamento | AC 8 |
| tela de jogo | estado vazio (seed sem estacionamento) | AC 23 |
| tela de jogo | ação destrutiva confirma | n/a - R e Esc já são reversíveis; nenhuma ação apaga dado |
| tela de jogo | não autorizado | n/a - jogo local, sem conta |
| tela de resultado da corrida | ordenação | AC 13 |
| tela de resultado da corrida | densidade | existing - 4 linhas, races AC 25 |

## Sources

- `.specs/audits/2026-09-29-validation.md` - achados CORE-1, CORE-7, CORE-9, AUDIO-1..4, veh-1, veh-2, veh-3, veh-5, veh-8, veh-10, wgen-1, wgen-4, miolo-2, miolo-3, miolo-6, miolo-7, miolo-11, RENDER-1, RENDER-3, RENDER-4
- decisão do usuário em 2026-09-29: R mantém o heading
