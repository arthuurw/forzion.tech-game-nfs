# Validação completa - 2026-09-29

Workflow `jogo-full-validation` (13 agentes: gates + 6 revisores + verificadores adversariais) sobre `main` em 12bbc59. Achados REFUTED ficaram fora (RENDER-2, CORE-8, docs-11). Cada bloco: id, severidade final, veredito, evidência, correção sugerida e a razão do verificador.

Gates: build ok (aviso de chunk), 202/202 unitários, 132/132 e2e (60 min), npm audit 0.

### gates-1 [medium|CONFIRMED] tests/e2e:
A suíte e2e leva 1 hora em série (1 worker), o que torna o gate e2e caro demais para rodar a cada mudança
EVID: playwright.config.ts: `fullyParallel: false, workers: 1`. Saída desta execução: `132 passed (1.0h)` / `real 60m20.540s` / `Slow test file: tests\e2e\interiors.spec.ts (13.8m)`, `visual.spec.ts (11.6m)`, `race.spec.ts (10.0m)`, `drive.spec.ts (6.2m)`; vários testes passam de 50 s (ex.: `facade-glint › headlight adds no facade glint (56.5s)`, `extras.spec.ts:87 steam brightens the air above the vent (54.2s)`).
FIX: Separar em projetos/tags (ex.: @smoke rápido com menos de 10 min para cada build e a suíte completa só no Verifier). Dá para rodar 2 ou 3 workers com uma porta de dev server por worker, ou usar sharding (`--shard`). Também vale mover para tests/physics (AD-011) as provas que só leem estado da simulação e não precisam do render.
VR: 

### gates-2 [low|CONFIRMED] vite.config.ts:
O build gera um único chunk de 5,24 MB (1,94 MB gzip) com o WASM do Rapier embutido em base64 e dispara o aviso de chunk acima de 500 kB
EVID: npm run build: `dist/assets/index-Xbug7NzH.js   5,237.71 kB │ gzip: 1,936.61 kB` e `(!) Some chunks are larger than 500 kB after minification.` O bundle tem uma única linha de 4.502.108 caracteres, com uma ocorrência de `AGFzbQ` (o magic `\0asm` em base64), que vem do `@dimforge/rapier3d-compat`. Não há `import(` dinâmico em src/.
FIX: Separar vendor com `build.rolldownOptions.output` (chunks para three e rapier) e/ou carregar o Rapier com `import()` dinâmico no boot. Outra opção é a variante não-compat `@dimforge/rapier3d` com o .wasm servido como asset, se o Vite suportar. Depois, fixar `chunkSizeWarningLimit` num valor medido para o aviso voltar a significar algo.
VR: 

### gates-3 [low|CONFIRMED] src/hud/Minimap.ts:12
A parameter property `canvas` em Minimap é declarada como campo e nunca lida
EVID: npx tsc --noEmit -p . --noUnusedLocals --noUnusedParameters: `src/hud/Minimap.ts(12,22): error TS6138: Property 'canvas' is declared but its value is never read.` Trecho: `constructor(\n    private readonly canvas: HTMLCanvasElement,` (o construtor usa só o parâmetro local `canvas.getContext('2d')`).
FIX: Trocar `private readonly canvas` por um parâmetro simples `canvas: HTMLCanvasElement`.
VR: 

### gates-4 [low|CONFIRMED] tests/e2e/visual.spec.ts:12
O helper `g` em visual.spec.ts é declarado e nunca usado
EVID: tsc com noUnusedLocals: `tests/e2e/visual.spec.ts(12,7): error TS6133: 'g' is declared but its value is never read.` Trecho: `const g = (page: Page) => page.evaluate(() => (window as any).__game);`
FIX: Remover a linha 12.
VR: 

### veh-1 [high|CONFIRMED] src/race/Opponent.ts:59
No sprint, o oponente que já chegou continua dirigindo: esterço travado e sai da pista a ~190 km/h
EVID: Opponent.drive() chama aiDrive sempre, sem checar progress.finished:
  const input = aiDrive(...); this.lastInput = hold ? { ...HOLD_INPUT } : input;
No sprint, a partir do último ponto aiDrive mira o próprio último ponto (aiDriver.ts: `if (!route.closed && index + k >= n) break;` e `const last = !route.closed && j === n - 1`), que depois da chegada fica para trás. O reset de travado/água também é desligado: `if (racing && !this.progress.finished && checkStuck(...))` (Opponent.ts:72).
Simulei no scratchpad com o Rapier real no seed 1337 (oponente 2), 20 s depois da chegada: sprint-cruzada deu 1200/1200 passos com steer=±1, 191 km/h, 342 m longe do portão e parado em outro lugar; sprint-morro deu 1200/1200 passos com esterço travado e parou batido a 43 m da chegada.
FIX: Em Opponent.drive, quando progress.finished, entregar um input de parada controlada, por exemplo freio de serviço acima de ~5 km/h e depois HOLD_INPUT, com steer vindo do traçado. No sprint, estender o alvo do aiDriver além do último ponto na tangente final em vez de mirar um ponto que ficou para trás. Colocar um teste em raceAi.test.ts que corra N s depois da chegada e verifique a distância e a velocidade.
VR: Opponent.drive (Opponent.ts:59-64) always calls aiDrive, with no check of progress.finished. The sprint's last gate sits at s = total, the end of the route (raceRoutes.ts buildRace, gates at startS + step*k up to total), so once the car crosses it the look-ahead target is the last point, which is now behind the car. Stuck/water reset is off after finishing (Opponent.ts:72 `!this.progress.finished`). I reproduced it in the scratchpad (vv/f.probe.ts, seed 1337, opponent 2, 20 s after the finish). sprint-cruzada: steer at ±1 on 1200 of 1200 steps, 188-196 km/h for 10 s, then crashed and stopped 345 m from the gate. sprint-morro: full lock on every step, stopped crashed 43 m from the gate. The player is still racing (hold only applies when state != 'racing'), so this is visible.

### veh-2 [medium|PLAUSIBLE] src/race/raceSession.ts:98
Reset de travado ou de jogador vai para o mesmo ponto exato (centro do portão) para todos os racers, sem checar se está ocupado
EVID: resetTarget(race, lastGate, slot):
  if (lastGate < 0) return { ...race.grid[slot]! };
  const g = race.gates[lastGate]!;
  return { x: g.x, y: g.y, z: g.z, heading: g.heading };
`slot` só vale para o grid. Opponent.resetToLastGate (Opponent.ts:81) e RaceController.resetPlayer (RaceController.ts:141-142) chamam car.teleport nesse ponto (+1.2 m), sem olhar se tem outro corpo ali.
FIX: Deslocar o alvo de lado por slot (usar AI_OFFSETS e PLAYER_SLOT, como no grid) e/ou testar a sobreposição (world.intersectionsWithShape com o cuboid do chassi) e recuar ao longo do traçado até achar um lugar livre.
VR: The code matches the report. resetTarget (raceSession.ts:93-101) ignores `slot` after the first gate and returns the gate centre. Opponent.place and RaceController.resetPlayer (RaceController.ts:141-142) call teleport there with no occupancy check. The overlap needs timing to line up, though: two opponents hitting the 4 s stuck window at nearly the same time after the same gate, or the player pressing R while opponent 1 (AI_OFFSETS[1] = 0, so it drives through the gate centre) is passing. It is possible but I did not reproduce it, and C23 runs a single opponent.

### veh-3 [medium|CONFIRMED] src/vehicle/Car.ts:335
teleport() e reset() mantêm o estado do câmbio (marcha, shiftTimer, volante) e as amostras de g lateral
EVID: teleport(x,y,z,heading) só faz setTranslation/setRotation/setLinvel/setAngvel/sync. `this.drive` (DrivetrainState), `lateralSamples` e `skidding` ficam como estavam. O docstring diz "Só para testes e debug", mas o teleport é o caminho de jogo da largada (RaceController.ts:269), do reset para o portão (RaceController.ts:142, Opponent.ts:91) e do reset na água (Game.ts:313).
Simulei no scratchpad: 0 a 60 km/h a partir do carro novo levou 2.18 s; o mesmo carro, teleportado em 4ª, ainda estava em 3ª 1 s depois e levou 2.67 s. A redução desce 1 marcha a cada SHIFT_HOLD_S = 0.6 s (drivetrain.ts:145).
FIX: Em teleport() e reset(), fazer `this.drive = initialDrivetrain(this.spec)`, limpar lateralSamples/lateralG/skidding e chamar controller.updateVehicle(0), como o reset() já faz. Corrigir o docstring.
VR: Car.teleport (Car.ts:335-341) only sets translation, rotation and velocities and calls sync. this.drive (gear, shiftTimer, lastShiftAgo, steer) and lateralSamples keep their old values. In stepDrivetrain (drivetrain.ts:145-155) a downshift needs lastShiftAgo >= SHIFT_HOLD_S (0.6 s) and drops one gear at a time, so a stopped car in 5th takes about 2.4 s to reach 1st and pulls with the tall gear's torque until then. teleport is used in gameplay by the race start (RaceController.ts:269), the gate reset (:142, Opponent.ts:91) and the water reset (Game.ts:313). The reported slow restart after the water reset follows from this.

### veh-4 [low|PLAUSIBLE] src/race/aiDriver.ts:181
Volante da IA liga/desliga (bang-bang) e fica chacoalhando: o carro ziguezagueia em reta e em curva de um lado só
EVID: const steer = a > STEER_DEADBAND ? 1 : a < -STEER_DEADBAND ? -1 : 0;  // STEER_DEADBAND = 0.03 rad
Medi no scratchpad, oponente 2, depois dos primeiros 10 s:
- circuito-anel: 34.5 trocas de steer por segundo (em 60 passos/s) e 1.84 inversões por segundo do sinal do yaw rate. A rodovia em anel curva sempre para o mesmo lado (raio de 640 a 2500 m nos portões), então o sinal do giro não deveria inverter
- sprint-cruzada: 9.9 trocas/s, 2.49 inversões/s, |yaw| de até 0.30 rad/s acima de 150 km/h
- circuito-centro: 9.3 trocas/s, 2.22 inversões/s
FIX: Sem sair da AD-015 (DriveInput é o teclado, steer ±1/0): aumentar a zona morta com a velocidade, usar histerese (só inverter quando |a| passar de um limiar maior que o de soltar) ou modular por duty-cycle com a rampa do volante. Acrescentar uma medida de inversões de yaw por segundo em raceAi.test.ts.
VR: The bang-bang steering exists (aiDriver.ts:181), and the input chatter is real: 2876 steer changes on circuito-anel in my probe. The visible weaving is not borne out, though. I measured the lateral offset from the route with a 2 s high-pass filter (scratchpad vv/w.probe.ts, opponent 2). On circuito-anel the RMS is 0.00 m and the max 0.03 m, because the rate-limited steering ramp (steerRateRadS 4, tiny steerTarget at 200 km/h) filters it out. The other routes show RMS 0.27-0.38 m, but that includes real corner transitions. The weave does not show on screen or on the minimap. What remains is a control-quality issue.

### veh-5 [low|PLAUSIBLE] src/vehicle/Car.ts:321
R no free roam zera o heading: o carro desvira mas passa a apontar para +Z
EVID: reset():
  this.body.setTranslation({ x: t.x, y: t.y + 1, z: t.z }, true);
  this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
O plano de races diz (plan.md:162) "R desvira no lugar", e o docstring diz "em pé", mas a rotação identidade também zera o yaw. O e2e trava esse comportamento: drive.spec.ts:187-190 exige |rotation.y| < 0.01 e w > 0.99.
FIX: Montar a rotação só com o yaw atual (heading = atan2(f.x, f.z) de forwardWorld projetado no plano), igual ao teleport, e ajustar o C11 para checar que o carro está em pé (eixo +Y) em vez de rotação identidade.
VR: Car.reset (Car.ts:318-321) does set the identity rotation, which zeroes the heading. That is the specified behaviour, though. free-roam-city C11 requires |x|,|y|,|z| < 0.01 and w > 0.99 after R, and drive.spec.ts:186-190 tests it. It also does not violate races AC 31 ('R desvira no lugar' means it flips the car where it is, and the position is kept). It is a real UX gap, but the spec requires this behaviour and the code follows it, so it is not an implementation bug or an AD violation.

### veh-6 [medium|CONFIRMED] src/vehicle/drivetrain.ts:46
RPM_MIN/RPM_MAX são constantes do DEFAULT_CAR e o conta-giros e o áudio usam essas constantes
EVID: export const RPM_MIN = DEFAULT_CAR.idleRpm;
export const RPM_MAX = DEFAULT_CAR.redlineRpm;
Usadas em src/hud/format.ts:14 `((rpm - RPM_MIN) / (RPM_MAX - RPM_MIN)) * 100` e src/audio/audioMap.ts:37,53.
FIX: Passar o spec (ou idle/redline) do carro atual para o HUD e o áudio (por exemplo, CarState com idleRpm/redlineRpm, ou uma função que recebe o spec) e remover as constantes globais.
VR: drivetrain.ts:46-47 fixes RPM_MIN and RPM_MAX from DEFAULT_CAR. format.ts:14 (rpmBarWidth, used unclamped in Hud.ts:29) and audioMap.ts:37,53 use those constants, while stepDrivetrain uses spec.idleRpm and spec.redlineRpm. With a car whose redline is 8500 rpm, the rev bar goes past 100%. One correction: audio does not go 'out of the map'. rpmFraction clamps to [0,1], so audio saturates early instead, which is still wrong. This debt will bite in garage/tuning.

### veh-7 [low|PLAUSIBLE] src/vehicle/drivetrain.ts:77
CarSpec não é validada: valores de tuning degenerados geram NaN/Infinity que vão para o corpo do Rapier
EVID: torqueAt: `return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);` dá NaN se dois pontos da curva tiverem o mesmo rpm. wheelRpm divide por spec.wheelRadiusM, yawAssist/cornerAssist dividem por spec.wheelbaseM, e Car.ts:141 divide por spec.suspensionStiffness. Nenhum lugar valida torqueCurve em ordem crescente estrita, gearRatios não vazio ou valores > 0. carSpec.ts diz que "A garagem e o tuning (sub-projetos 3 e 4) vão trocar ou alterar esta ficha".
FIX: Criar um validateCarSpec(spec) puro (rpm estritamente crescente, cobertura de [idle, redline], todos os escalares > 0, 0 ≤ bias ≤ 1, shiftDown < shiftUp < redline) chamado no construtor do Car, com teste unitário.
VR: The main example is wrong. In torqueAt (drivetrain.ts:70-80), reaching index i means rpm > curve[i-1][0]. If r1 == r0, the check `rpm <= r1` fails and the loop moves on, so there is no division by zero or NaN, and a non-increasing curve cannot divide either. DEFAULT_CAR is checked by tests/unit/carSpec.test.ts:70-75 (increasing curve covering idle to redline). The only real risk left is Infinity/NaN from wheelRadiusM, wheelbaseM or suspensionStiffness set to 0 by a future tuning control with no range. That is speculative debt, with no runtime path today.

### veh-8 [low|CONFIRMED] src/race/raceProgress.ts:102
Empate na chegada: tempo com resolução de passo e o jogador sempre perde o desempate
EVID: standings: `if (fa && fb) return a.progress.finishTime! - b.progress.finishTime!;`. O sort é estável e standingList põe o jogador por último (RaceController.ts:245 `list.push({ racer: PLAYER_SLOT, ...})`). stepProgress calcula a fração de cruzamento `t = a0 / (a0 - a1)` (raceProgress.ts:52), mas descarta o valor e grava finishTime = time do passo inteiro.
FIX: Desempatar pela fração do cruzamento: finishTime = time - dt·(1 - t), ou guardar a fração à parte e usar como segundo critério. A ordem da AD-016 continua sendo passos fixos.
VR: stepProgress computes the crossing fraction t (raceProgress.ts:52) but only uses it for the lateral check, and finishTime = time is the whole step. standings (raceProgress.ts:102) returns 0 on equal times. The sort is stable and standingList puts the player last (RaceController.ts:245), so on a tie in the same step the opponent always ranks ahead. The chance is low, but the ordering is deterministic against the player.

### veh-9 [low|CONFIRMED] src/race/RaceController.ts:273
O número de racers está escrito à mão em três lugares acoplados
EVID: `this.opponents = [0, 1, 2].map(...)` (RaceController.ts:273); `pos: `POS ${this.position()}/4`` (RaceController.ts:210); `names()` devolve `[...AI_NAMES, PLAYER_NAME]` e resultRows indexa `names[s.racer]` (raceProgress.ts:120), o que só funciona porque PLAYER_SLOT (3) === AI_NAMES.length.
FIX: Derivar tudo de race.grid.length e opponents.length e mapear os nomes por racer id (Map) em vez de posição no array.
VR: There are hard-coded literals at RaceController.ts:273 `[0, 1, 2].map`, :210 `POS ${...}/4`, and names() `[...AI_NAMES, PLAYER_NAME]` indexed by racer, which only works because PLAYER_SLOT = 3 equals AI_NAMES.length (raceRoutes.ts:50). race.grid also has exactly 4 slots (GRID_ROWS x 2). This is debt for career events with a different number of opponents. It does not break anything today.

### veh-10 [low|CONFIRMED] src/race/RaceController.ts:154
Quando o jogador chega, os oponentes ainda correndo puxam o freio de mão com o volante reto e saem da curva
EVID: beforeStep: `const hold = this.session.state !== 'racing'; for (const op of this.opponents) op.drive(dt, hold);`. Em 'finished' eles recebem HOLD_INPUT (handbrake, steer 0). Simulei no scratchpad no circuito-anel: 205 km/h no hold, heading mudou 0-2° em 8 s e ainda estavam a 75 km/h, ou seja, seguiram reto numa rodovia curva.
FIX: Em 'finished', entregar ao oponente o aiDrive com throttle=false e brake=true acima de ~5 km/h (mantendo o steer da IA), em vez de HOLD_INPUT, que foi pensado para o carro parado na contagem.
VR: beforeStep (RaceController.ts:154-155) holds whenever state != 'racing', including 'finished', and HOLD_INPUT (raceSession.ts:24) is handbrake with steer 0 and no throttle. From about 200 km/h, going straight on a curve of radius ≥640 m drifts d²/2R, tens of metres over a few hundred metres, so the car leaves the road. This is cosmetic, behind the results panel.

### veh-11 [low|PLAUSIBLE] src/core/Game.ts:464
O hook DEV placeOpponent teleporta o Car direto e pula Opponent.place (prev e estado da IA não atualizam)
EVID: placeOpponent: (i, x, y, z, heading) => game.race.opponents[i]?.car.teleport(x, y, z, heading),
Opponent.place faz também `this.prev = {x, z}` e `relocate(this.route, this.ai, x, z)` (Opponent.ts:91-93).
FIX: Expor um Opponent.placeAt(x, y, z, heading) público que faça o mesmo que place() e usar esse método no hook.
VR: The code matches the report. The DEV hook (Game.ts:463-464) calls car.teleport directly and skips the prev/relocate update in Opponent.place (Opponent.ts:90-94). The only use (race.spec.ts:226, C24) advances 0.05 s and only checks minimap pixels. A stuck check needs 4 s, and a phantom gate crossing needs the jump to cut the next gate within halfWidth. The current test is not affected, so the risk only applies to future e2e tests that use the hook for longer.

### wgen-1 [high|CONFIRMED] src/world/Rain.ts:112
A chuva fica numa faixa fixa de y 0 a 40 m e some nas estradas de morro
EVID: Rain.ts:112 `float y = mod(position.y - uSpeed * uTime, uBox.y);` e :116 `vec3 world = vec3(uCenter.x + rel.x, y, uCenter.z + rel.y);`. Só x e z seguem o carro; `center.y` chega em update() (:144) mas o shader nunca o lê. RAIN_BOX.y = 40 (rainMath.ts). Medi com uma sonda que roda a geração real (seed 1337): as estradas de morro 7 a 12 chegam a maxY = 68.6, 66.2, 93.8, 62.8, 63.6 e 64.1 m, e cerca de 3000 pontos de estrada (~6 km) ficam acima de 38 m. Os portões da corrida `sprint-morro` sobem até y = 93.4.
FIX: Enrolar y em volta do carro, como já é feito com x e z: `float y = uCenter.y - uBox.y*0.3 + mod(position.y - uSpeed*uTime, uBox.y);`, ajustando o fade para usar a altura relativa. Atualizar rainY/rainMath para a mesma conta e acrescentar um check com o carro em y = 80.
VR: The code is at Rain.ts:48 and :52, not :112 and :116. It reads `float y = mod(position.y - uSpeed * uTime, uBox.y);` and `vec3 world = vec3(uCenter.x + rel.x, y, uCenter.z + rel.y);`, so the y of uCenter is never used and drops stay in absolute world y 0 to 40 (RAIN_BOX.y = 40 in rainMath.ts). Game.ts:357 passes state.y, but the shader ignores it. My probe ran the real generation with seed 1337. Hill roads 7 to 12 have maxY 68.6, 66.2, 93.8, 62.8, 63.6 and 64.1 m, and 3062 of their points are above 38 m (road 9 alone has 1302 of 1501). HILL_MIN_CLIMB = 42 guarantees every hill road climbs past the box. Depth test stays on (only depthWrite is false), so on a hill the terrain and road hide the drops and the rain disappears for the player.

### wgen-2 [high|CONFIRMED] src/world/roads/RoadGenerator.ts:378
As pontas das avenidas deixam degraus de até 22 cm no meio da rodovia em anel
EVID: RoadGenerator.ts:378-395 puxa as 30 últimas alturas da avenida para `best`, a altura de UM ponto do anel (o mais perto da ponta). roadMesh.ts:65 faz a fita plana na transversal (os dois vértices com o mesmo y), e a ponta da avenida termina na linha central do anel (avenueEnd). Como o anel sobe ou desce ao longo do próprio traçado, a borda final da avenida fica acima ou abaixo da fita do anel. Medi a fita do anel sob cada vértice final das avenidas: avenida 4, vértice 1: +0.222 m (vértice 0: -0.229); avenida 1: +0.138/-0.201; avenida 3: +0.125/-0.170 e +0.116/-0.144; avenida 6: +0.145/-0.166. A sonda também achou o terreno carvado até 0.20 m acima do asfalto na ponta da avenida 4 (-281.7, -914.6).
FIX: Na junção, levar a altura final da avenida ao plano do anel no ponto exato (interpolar entre os dois pontos do anel e usar a inclinação ao longo do anel), ou terminar a fita da avenida na borda interna do anel (w/2 = 12 m antes) e emendar com a altura da fita do anel ali. Acrescentar um check: |y_avenida - y_anel| < 2 cm em cada vértice final.
VR: The probe reproduced it. I took the real ring strip (roadStripGeometry, flat across its width) and measured the height difference to each avenue's end-edge vertex. Results: avenue 4 end 0 -0.229/+0.222; avenue 1 +0.138/-0.201; avenue 3 -0.170/+0.125 and -0.144/+0.116; avenue 6 +0.145/-0.166. Within the last 16 m the gap reaches -0.247. The cause is the one described: RoadGenerator.ts:378-395 blends the avenue toward the height of a single ring point, while the ring slopes along its path. WorldPhysics.ts:54-57 creates both trimeshes. The car uses DynamicRayCastVehicleController, so the step is not a wall but a sudden ~20 cm suspension jolt on the lanes of the ring half the avenue covers. The z-fighting claim is minor: it only happens where the difference crosses zero. I did not verify the terrain being 0.20 m above the asphalt.

### wgen-3 [medium|PLAUSIBLE] src/world/ChunkManager.ts:79
Montar um chunk leva de 10 a 275 ms na thread principal: engasgo de frame no streaming
EVID: ChunkManager.update() (:79-84) chama `this.build(id)` de forma síncrona. O limite de 1 por frame conta chunks, não tempo. Cronometrei o ChunkManager real em node (V8, three sem GPU). A frio, com o carro em (0,0), os builds levaram 224, 67, 65, 113, 45, 80, 47, 78, 72, 275, 71 e 17 ms nos 12 primeiros frames. Depois do JIT aquecido, cada um dos 36 chunks levou de 8.5 a 35.7 ms (terrainMesh sozinho, de 7.7 a 18.9 ms). A subida para a GPU dos buffers de 129×129 vértices não entra nessas contas.
FIX: Dar ao build um orçamento de tempo em fatias (terreno por faixas de linhas entre frames), ou gerar os arrays num Worker (a parte pura já existe) e só montar a BufferGeometry na thread principal. No boot, pré-construir os chunks a ≤ 900 m antes do primeiro frame.
VR: The synchronous build is confirmed. ChunkManager.update (:79-85) calls this.build(id) in the frame, and planChunks caps the count at 1 but not the time. My timing of the real ChunkManager in node (interiors, seed 1337) disagrees with the numbers in the finding. Cold boot builds took 47.9, 24.4, 14.2, 15.4, 8.0 up to 15.8 ms, and warm builds took 7 to 19 ms, not 224 or 275 ms. That is still roughly half to all of a 16.7 ms frame before render and GPU upload. A dropped frame at each chunk boundary is likely, but I did not measure it in the browser. The boot claim of about 1.2 s of stutter is overstated; I measured about 0.2 s in total.

### wgen-4 [medium|CONFIRMED] src/world/rail/trainLine.ts:200
Coluna do portal do trem invade o asfalto da avenida transversal
EVID: placeFrames (:200-208) testa FRAME_ROAD_CLEAR = 12 m só no centro do portal. As colunas ficam 10.6 m para o lado (frameColumns, :216 `off = f.halfWidth + FRAME_SIDE`) e não são testadas. A sonda achou uma coluna em (-275.9, 318.9) a 8.11 m de um ponto da avenida 4 (meia largura 8 m, meia coluna 0.25 m): entra pelo menos 0.14 m na pista. WorldPhysics.ts:120-131 cria um cuboide para ela.
FIX: Em placeFrames, pular o portal quando qualquer coluna fica a menos de `road.width/2 + COLUMN_HALF + folga` de outra estrada. Um check em trainLine.test.ts pode percorrer todas as colunas contra todas as estradas.
VR: placeFrames (trainLine.ts:200-208) checks FRAME_ROAD_CLEAR only at the portal center. frameColumns puts the columns at halfWidth + 2.6 = 10.6 m to the side, and they are never checked against other roads. The probe measured distance to each polyline segment. The column at (-275.86, 318.89) intrudes 0.287 m into avenue 4, counting the half-width 8 m and COLUMN_HALF 0.25. WorldPhysics.ts:120-131 creates the rigid cuboid there. Impact is limited to the edge of the lane in one corner of the train square.

### wgen-5 [low|CONFIRMED] src/world/terrain/TerrainGenerator.ts:221
heightAt (bilinear) não bate com o heightfield e a malha (triangulados), até 8 cm de diferença
EVID: heightAt (:221-235) interpola de forma bilinear. O heightfield do Rapier e a malha de terreno (ChunkManager.ts:320-331, diagonal (ix+1,iz)-(ix,iz+1)) usam dois triângulos por célula. Sonda com Rapier real, 20000 raios: físico vs malha = 0.000 m de erro máximo (batem); físico vs heightAt = 0.081 m de erro máximo. heightAt posiciona a base das colunas do trem (WorldPhysics.ts:122, TrainScene.ts:162), a base dos lotes (LotGenerator.ts:245-246) e props apoiados no chão.
FIX: Trocar a interpolação de heightAt pela mesma triangulação da malha e do heightfield (a regra tx+tz <= 1 com a mesma diagonal).
VR: heightAt (TerrainGenerator.ts:58-72) is bilinear, while the mesh (ChunkManager.ts:317-321) and the heightfield use two triangles per cell. My probe of bilinear against the triangulated surface on the carved heightmap measured up to 0.19 m, more than the 0.08 m claimed. The impact is overstated for the train columns: TrainScene.ts:162 sinks the visual column base 0.5 m (`heightAt(...) - 0.5`), so no gap shows, and the gap at the collider base does not matter. Lots use the lowest corner (LotGenerator.ts:245-246). It does apply to parked cars (InteriorProps.ts:470) and pools, where a gap of a few cm can appear.

### wgen-6 [low|PLAUSIBLE] src/world/roads/RoadGenerator.ts:179
markBridges e o render de ponte por chunk não tratam ponte que cruza a costura da rodovia fechada
EVID: markBridges (:189-203) percorre o anel como estrada aberta (`while (a > 0 ...)`, `while (b < n - 1 ...)`), então uma ponte sobre o índice 0 vira dois trechos, [0..k] e [m..n-1]. ChunkManager.ts:149 só estende o trecho com `parts.indices.includes(last + 1)`, sem volta, e nonBridgeStretches (roadMesh.ts:101) supõe que bridges[0] não cruza a costura. Com o seed 1337 as pontes do anel são [257..519] e [2635..2903], então o caso não acontece hoje.
FIX: Em estrada fechada, juntar o primeiro e o último trecho quando from == 0 e to == n-1, e usar índice modular em bridgeParts, extrudeAlong e no filtro do ChunkManager.
VR: The code matches the description. markBridges (RoadGenerator.ts:189-203) does not wrap on a closed road, and ChunkManager.ts:155 extends a run with `parts.indices.includes(last + 1)` without modulo, so the n-1→0 segment of a bridge crossing the seam would get no deck or rails. nonBridgeStretches does handle that case correctly. With the seed actually used (DEFAULT_SEED 1337, fixed in Game.ts:156) the ring bridges are [257..519] and [2635..2903] with n = 3155, so the bug is latent and nothing in the codebase changes the seed.

### wgen-7 [low|CONFIRMED] src/world/ChunkManager.ts:379
Calçadas e pontes com normais suavizadas nas quinas de 90°
EVID: extrudeAlong (bridges.ts:245-265) cria 4 vértices por seção, compartilhados entre topo, laterais e fundo. MeshBuilder.mesh (ChunkManager.ts:379) chama `g.computeVertexNormals()` sobre a geometria indexada, e assim a normal de cada quina vira a média do topo com a lateral.
FIX: Duplicar os vértices por face em extrudeAlong (4 × 4 por seção) ou escrever normais planas explícitas em vez de computeVertexNormals.
VR: extrudeAlong (bridges.ts:76-114) creates 4 vertices per section shared by the top, side and bottom faces. MeshBuilder.mesh calls g.computeVertexNormals() on the indexed geometry (ChunkManager.ts:371, not :379), so each edge normal averages the top and side faces. That smooths the shading across the 5 m sidewalk top and on decks and rails. pillarBox has the same problem with its 8 shared corners.

### wgen-8 [low|CONFIRMED] src/world/CityGenerator.ts:125
generateCity (grade 8×8 antiga) é código morto e a doc do módulo descreve um mundo que não existe mais
EVID: Cabeçalho (:1-8): 'Grid 8×8 de quarteirões ... o mundo vai de -202 a +202 em x e z e termina em paredes invisíveis'. Hoje o mundo vai a ±1536 (worldMath.ts:12). generateCity, streetsFor, lampsFor e laneMarksFor só são chamados em tests/unit/cityGenerator.test.ts. O src importa do arquivo apenas mulberry32, NEON_PALETTE, FACADE_TYPES e DEFAULT_SEED.
FIX: Mover mulberry32, a paleta e DEFAULT_SEED para um módulo `world/seed.ts` (ou `worldMath`) e apagar generateCity e o teste dele, ou marcar o arquivo como legado.
VR: The header of CityGenerator.ts:1-8 still describes an 8×8 grid bounded at ±202 m, while WORLD_HALF = 1536. generateCity (:201, not :125) and CITY_EXTENT are used only in tests/unit/cityGenerator.test.ts. src imports only mulberry32, NEON_PALETTE, FACADE_TYPES and DEFAULT_SEED from this file. This is dead code with a misleading doc and a test covering an unused generator.

### miolo-1 [high|CONFIRMED] src/world/interiors/interiorMotion.ts:336
Pedestres cortam a quina dos prédios: o teste 'na zona' arredonda para o vértice de 4 m, mas a folga do lote é só de 1 m
EVID: interiorMotion.ts:336-338 `function inZone(bi, zoneId, x, z) { return bi.zoneOf[nearestVertex(bi, x, z)] === zoneId; }`; segmentInZone (341-349) amostra a cada 0.25 m com esse mesmo inZone. BlockInteriors.ts:25 `LOT_MARGIN = 1`: um vértice livre pode ficar a 1 m do lote, e a célula do vértice mais próximo vai até 2√2 ≈ 2.83 m dele. Probe (vitest no scratchpad, seed 1337, 400 pedestres × 3 posições do carro, 40 s): 'walker near lot -14.34 161.66 zone 30 penetration 0.57 fleeing false seg -12 164 -16 160' e 'walker near lot 41.98 94.02 zone 29 penetration 0.30'; min lot clearance 0.00, 11 de 96000 amostras a menos de 0.25 m (o corpo tem raio 0.22). Nenhum teste compara a posição do pedestre com o footprint do lote.
FIX: Para movimento, use uma máscara erodida: um ponto conta como livre só se os 4 vértices da célula que o contém (floor, não round) forem da zona, ou exija bi.facadeDist interpolado ≥ LOT_MARGIN + raio do corpo. Acrescente um teste que roda stepWalker/stepCat no seed 1337 e confere distanceToLot ≥ 0.25 em toda amostra.
VR: The code is as the finding quotes. inZone (interiorMotion.ts:336-338) rounds to the nearest 4 m vertex, and segmentInZone checks every 0.25 m with that same test. A vertex counts as free at 1 m from a lot (BlockInteriors.ts:25, :128). I ran my own probe on seed 1337: every segment that segmentInZone accepts (up to 16 m long, starting at vertices with facadeDist < 3), with a signed penetration test against the rotated lot rectangles. Worst case was 0.96 m inside a lot, on segment -28,-56 -> -24,-68 in downtown zone 21, and 16591 sample points fell inside a lot footprint. fleeStep and the cat push use the same inZone. No test compares walker positions with lot footprints; C32 only checks rounding to an interior vertex. This is visible clipping into buildings, the exact thing AD-012's 'chão livre' is meant to prevent.

### miolo-2 [medium|CONFIRMED] src/world/interiors/interiorMotion.ts:525
Gato fica dentro do carro: CAT_CLEAR é um raio de 1.5 m, mas o chassi tem 0.9 × 2.1 m de meia medida
EVID: interiorMotion.ts:525 `export const CAT_CLEAR = 1.5;` e 617-626 empurra o gato na radial até exatamente 1.5 m do centro do carro; Car.ts:44 `const CHASSIS_HALF = { x: 0.9, y: 0.35, z: 2.1 };`. O C25 (tests/unit/extrasMotion.test.ts:166) só confere `>= 0.5` m do centro. Probe: 400 passadas do carro sobre gatos do seed 1337 (8 e 20 m/s) deram 'cat-steps 119655 inside chassis footprint 558 longest consecutive steps 21'.
FIX: Passe o heading do carro para stepCat e teste contra a caixa orientada (|along| < 2.1 + margem e |across| < 0.9 + margem). Empurre para fora pelo eixo lateral da caixa (ou mande para 'gone'). Troque a asserção do C25 para 'fora da caixa do chassi'.
VR: CAT_CLEAR = 1.5 is a radial clearance (interiorMotion.ts:525, 617-631), while CHASSIS_HALF is 0.9 x 2.1 (Car.ts:44). My probe ran 200 cats x 2 speeds (8 and 20 m/s) with the car driving straight at each cat. 638 of 143517 non-gone steps had the cat inside the chassis footprint, with runs of up to 42 consecutive steps (0.7 s). So the stepCat doc promise 'nunca fica debaixo do carro' is false, and C25 only checks >= 0.5 m. I lowered it to medium: the cat is 0.36 m tall and hides inside the front bumper, below the hood, so the chase camera mostly cannot see it.

### miolo-3 [medium|CONFIRMED] src/world/interiors/InteriorScene.ts:358
A cor do gato e do pedestre vai pelo slot da instância, não pela identidade: trocam de cor quando outro sai
EVID: InteriorScene.ts:358 `for (let i = 0; i < this.catCap; i++) mesh.setColorAt(i, c.set(CAT_PALETTE[i % CAT_PALETTE.length]!));` é fixo por slot, e updateCatMesh (427-433) põe os gatos em slots `k++` na ordem do Map, pulando os `gone`. O mesmo vale para os pedestres (518 e 556-561). stepCats/stepWalkers apagam entradas do Map (409, 414, 537, 542).
FIX: Tire a cor do índice do spawn (guardado em Cat/Walker) e chame setColorAt(k, palette[spawnIndex % n]) junto com a matriz em updateCatMesh/updateWalkerMesh, com instanceColor.needsUpdate = true. Outra saída é um atributo por instância reescrito com a matriz.
VR: Colors are set once per slot: buildCats (InteriorScene.ts:358) and buildWalkers (518). updateCatMesh (427-433) fills slots in Map order with k++ and skips 'gone' cats, and updateWalkerMesh (556-561) does the same for walkers. stepCats/stepWalkers delete Map entries on replan or out of range. So when one cat goes 'gone' or leaves, every later cat moves down a slot and takes that slot's palette color (orange can turn white). The mechanism is real. Walkers only swap when an earlier entry is deleted, not on every replan. I rated it medium because it is a cosmetic color pop, mostly on farther cats (Map order roughly follows distance).

### miolo-4 [medium|CONFIRMED] src/world/interiors/InteriorScene.ts:230
O miolo gasta 14 draw calls fixas (mais 2 do trem) com o orçamento em 219 de 220
EVID: InteriorScene.ts:230-245 põe 14 objetos no grupo, cada um com material próprio. walkerMesh, catMesh, searchlightMesh e fireflies têm frustumCulled = false (361, 383, 522, 710); os outros usam uma esfera do mundo todo ou da zona (trees, bulbs, yardLamps, pools, parked, steam), então quase nunca saem do frustum. TrainScene.ts:68 soma lineMesh + wagons. .specs/STATE.md:52 'draw calls no grid do centro em corrida: 219 de 220'; tests/e2e/race.spec.ts:338 e render.spec.ts:53 travam em 220.
FIX: Reduza o custo fixo: junte towers + jibs (mesmo material `steel`) numa geometria com a lança instanciada à parte, ou beacons + floodHeads + yardLamps numa InstancedMesh com aGlow e cor por instância; junte gatos e pedestres num mesmo material com geometria escolhida por atributo, ou esconda (visible = false) os grupos cujo AABB real está fora do raio do carro. Registre numa AD o orçamento por subsistema antes do sub-projeto 3.
VR: InteriorScene.ts:230-245 adds 14 objects to the group, and walkerMesh, catMesh, searchlightMesh and fireflies have frustumCulled=false. STATE.md:52 records 219 of 220, and race.spec.ts:338 and render.spec.ts:53 fail above 220. One correction: an InstancedMesh with count 0 returns before info.update (three primcount===0 path), so walkers and cats cost no call when none are active. The budget is already listed as a known residual, but the headroom problem for sub-projects 3 and 5 is real.

### miolo-5 [low|PLAUSIBLE] src/world/interiors/InteriorScene.ts:1
InteriorScene e TrainScene sem dispose(); o cache global de zoneLight nunca é limpo
EVID: Não existe `dispose` em InteriorScene.ts nem em TrainScene.ts (o grep por dispose em src só acha Car, Opponent, ChunkManager, Environment e as sondas DEV do Game). São ~20 BufferGeometry, ~13 materiais (5 com onBeforeCompile, 2 ShaderMaterial), zoneTexture (169) e uma segunda cópia do waveNormalMap (193; Water.ts:19 já cria outra). interiorMotion.ts:99 `const schedules = new Map<string, ZoneSchedule>();` é chaveado por seed e cresce sem limpeza.
FIX: Implemente dispose() nos dois (percorra o group chamando geometry.dispose, material.dispose e os mapas, zoneTexture.dispose) e chame a partir de CityScene/Game. Exporte um clearZoneSchedules() ou chaveie o cache por instância. Reaproveite a textura de onda da Water em vez de gerar outra.
VR: It is true that InteriorScene and TrainScene have no dispose(), and neither does the city as a whole. The world is built once from DEFAULT_SEED (Game.ts:155-171), so nothing leaks today. The zone schedule Map is keyed per seed and zone and grows by about one entry per zone every 20-63 s, which is negligible. The impact depends on a future city rebuild or seed swap that nothing plans yet, so it is speculative debt.

### miolo-6 [medium|CONFIRMED] src/world/interiors/InteriorScene.ts:284
O shader dos carros estacionados usa vColor, que só existe se houver instanceColor (quebra com zero vagas)
EVID: InteriorScene.ts:282-284 remove `#include <color_fragment>` e injeta `vec3 carPaint = sRGBTransferOETF( vec4( vColor.rgb, 1 ) ).rgb;`. Só as linhas 301-305 criam instanceColor (setColorAt), dentro de `cars.forEach`. Com props.parking vazio (nenhuma zona downtown ≥ PARKING_MIN_AREA = 800 m², ou outro seed), o three não define USE_COLOR e vColor fica sem declaração.
FIX: Se cars.length === 0, não crie a malha (ou use o material placeholder). Outra saída é chamar setColorAt(0, ...) sempre, ou proteger o trecho injetado com `#ifdef USE_INSTANCING_COLOR`.
VR: InteriorScene.ts:282-284 removes color_fragment and uses vColor unconditionally. In three, the fragment shader defines USE_COLOR only when vertexColors or instancingColor is set (three.module.js:6899), and instancingColor requires object.instanceColor !== null (7511). instanceColor is only created by setColorAt inside cars.forEach (301-305), so with zero parked cars vColor is undeclared and the shader fails to compile. setProgram runs before any draw-count check (17239). With count 0, the empty bounding sphere (center at the origin, radius -1) can still pass the frustum test. Today the seed is always DEFAULT_SEED with 81 cars, so this is a latent edge case.

### miolo-7 [medium|CONFIRMED] src/world/interiors/interiorMotion.ts:422
Pedestre sem proteção 'debaixo do carro' e travado no estado de fuga quando encurralado
EVID: interiorMotion.ts:422-435: o pedestre só foge a 3 m/s quando o carro chega a menos de 8 m, e não existe o equivalente ao CAT_CLEAR. fleeStep (447-459) tenta 11 direções e, se todas saem da zona, não se mexe. `fleeing` só volta a false com toCar >= 15 (426).
FIX: Aplique ao pedestre a mesma regra de afastar ou sumir do gato, já com a caixa orientada do miolo-2. Com fleeStep sem saída, volte a andar (pickSegment) ou dê um tempo máximo de fuga.
VR: fleeStep (447-459) does not move if all 11 headings leave the zone, and fleeing only clears at >= 15 m (426). My probe used 400 walker spawns (seed 1337) with the car parked 7 m away in varying directions. 6 of 400 were still fleeing and had not moved for the last 30+ s of a 60 s run, for example walker 57 stuck at 9.56 m from the car. The pass-through at speed matches the spec: AC 33 (block-fill plan.md:135) requires no pedestrian collider, so that half is by design. The stuck state is a real edge bug.

### miolo-8 [low|CONFIRMED] src/world/interiors/InteriorScene.ts:387
Alocação por quadro em updateSites, updateSearchlights, updateWalkerMesh e updateCatMesh
EVID: Linhas 388-392 (Matrix4, 2 Quaternion, 3 Vector3) e 397 `m.compose(new THREE.Vector3(s.x, s.y, s.z), ...)` a cada holofote; 626-629 e 633 `new THREE.Vector3(...)` por canteiro; 642-643 `q.setFromEuler(new THREE.Euler(...))` e `new THREE.Vector3(f.x, f.y, f.z)` por holofote; 421-425 e 550-554 criam 5 objetos por quadro cada. update() roda a cada render (Game.ts:354). TrainScene.ts:33-37 já guarda os temporários como campos.
FIX: Guarde Matrix4/Quaternion/Vector3/Euler como campos privados (como faz TrainScene) e troque os `new` do laço por `.set()`.
VR: The per-frame allocations are there: updateSearchlights 388-397 (new Matrix4/Quaternion/Vector3s plus a Vector3 per light), updateSites 626-643 (a Vector3 per site, and a Euler plus a Vector3 per floodlight), updateCatMesh 421-425 and updateWalkerMesh 550-554. update() runs every render (Game.ts:354). This is GC pressure only, so low.

### miolo-9 [low|PLAUSIBLE] src/world/interiors/InteriorScene.ts:326
A direção do vapor na tela não é a conta provada por steamPoint
EVID: InteriorScene.ts:326 `angles[k] = ((i * 7 + j * 13) % 17) * ((Math.PI * 2) / 17);` versus interiorMotion.ts:494 `const a = hash01(seed, 1) * Math.PI * 2;`. STEAM_GLSL (927-929) reescreve a conta à mão; tests/unit/shaderConstants.test.ts:81 só confere que as constantes aparecem no texto. O cabeçalho de interiorMotion.ts:5-6 diz que 'o que o teste prova aqui é o que a tela mostra'.
FIX: Tire aAngle/aPhase de uma função pura exportada por interiorMotion (steamAngle(vent, j)) e use a mesma função em steamPoint, ou crie uma sonda DEV que leia os atributos e rode steamPoint.
VR: The divergence is real: the render derives the angle as ((i*7+j*13)%17)*2pi/17 (InteriorScene.ts:326), while steamPoint uses hash01(seed,1) (interiorMotion.ts:494). That contradicts the header claim that tests prove what the screen shows. The stated impact is overstated, though. C16 (extrasMotion.test.ts:34-52) only checks rise, growth, the |dx|,|dz| <= 1.5 bound and periodicity, which hold for any angle, and STEAM_GLSL has the same structure as steamPoint. Only the angle source is untested.

### miolo-10 [low|CONFIRMED] src/world/interiors/InteriorScene.ts:1070
A densidade da névoa está copiada como literal no shader do vagalume; o vapor não tem névoa
EVID: InteriorScene.ts:1070 `float f = 0.0035 * -mv.z;` repete Environment.ts:49 `new THREE.FogExp2('#05060d', 0.0035)`. steamMaterial (932-968) é um ShaderMaterial sem `fog: true` e sem conta de névoa. Também: 816 `uniform vec4 uFlood[12];` é literal, enquanto o laço usa `${MAX_FLOODS}` (828).
FIX: Passe a densidade como uniform lido de scene.fog (ou exporte a constante de Environment) e aplique no vapor também. Interpole MAX_FLOODS na declaração do uniform.
VR: InteriorScene.ts:1070 hard-codes 0.0035, duplicating FogExp2 density at Environment.ts:49. steamMaterial (932-968) is a ShaderMaterial with no fog handling. The fragment shader declares `uniform vec4 uFlood[12]` as a literal (816) while the loop bound uses ${MAX_FLOODS} (828) and the uniform array length uses MAX_FLOODS (100). Raising MAX_FLOODS would make the loop index past the end of the array. All of this is latent drift, so low.

### miolo-11 [low|CONFIRMED] src/world/interiors/InteriorProps.ts:409
O comentário do estacionamento promete 7 m do lote, mas o código usa 5.5
EVID: InteriorProps.ts:409-410 '...o vértice mais perto fica a 7 m ou mais de qualquer lote: assim o carro fica a 2 m dos lotes', mas 455 e 465 chamam `wellInside(zone.id, x, z, 4, 5.5)`. Com 5.5 m no vértice e até 2.83 m de arredondamento, o centro do carro pode ficar a ~2.7 m do lote, e o nariz (2.1 m) a ~0.6 m.
FIX: Use 7 no código, como o comentário diz, ou corrija o comentário e prove a folga real com o footprint do carro num teste.
VR: The comment at InteriorProps.ts:408-410 says 8 points at 6 m and 7 m facade clearance, but the calls at 455/465 pass radius 4 and facade 5.5, so the comment is stale. The claimed impact is refuted: the comment's actual guarantee (car center 2 m from lots) still holds, because 5.5 - 2.83 m of rounding = 2.67 >= 2, and extras.test.ts:75 checks center >= 2 m. The comment never promised nose clearance. This is only a stale comment.

### CORE-1 [high|CONFIRMED] src/core/InputManager.ts:16
Teclas presas quando a janela perde o foco (sem blur/visibilitychange)
EVID: InputManager.ts:16-17 só registra `keydown`/`keyup`; nenhum `blur` nem `visibilitychange` no src (grep `'blur'|visibilitychange` sem resultado). O estado só é zerado por `keyup` (linha 44-46: `this.state = applyKey(this.state, event.code, false)`).
FIX: No InputManager, ouvir `blur` em window e `visibilitychange` (hidden) e fazer `this.state = createInputState()`; remover os dois em `dispose()`.
VR: InputManager.ts:16-17 registers only keydown/keyup, and a grep of src finds no blur or visibilitychange listener. The state is cleared only in handleKeyUp (44-46). Game.ts:297 reads s.throttle on every step, so a key held during Alt+Tab stays pressed when the player comes back.

### CORE-2 [high|CONFIRMED] src/core/Game.ts:349
Render sem interpolação entre passos fixos: o carro trepida em monitor acima de 60 Hz
EVID: GameLoop.ts:36-39 roda `steps` passos e chama `render(dt)`; FixedStepper expõe `accumulator` mas nada no src o lê (grep `accumulator` só acha FixedStepper.ts). Game.ts:349 `this.car.sync()` copia a pose física crua (Car.ts:265-269 `this.mesh.position.set(t.x, t.y, t.z)`), enquanto ChaseCamera.update (Game.ts:351) suaviza com o dt real do quadro.
FIX: Guardar a pose anterior e a atual de cada corpo no fixedUpdate, e no render interpolar com `alpha = stepper.accumulator / step` (lerp na posição, slerp no quaternion). A câmera segue a pose interpolada.
VR: GameLoop.ts:36-39 runs N fixed steps, then render(dt). FixedStepper.accumulator is never read outside FixedStepper. Car.sync (Car.ts:265-269) copies the raw pose, while ChaseCamera.update smooths with the real dt (smoothPos.lerp, ChaseCamera.ts:71), so the car moves in steps against a smooth camera. One detail is wrong: at 144 Hz about 58% of frames get 0 steps (60/144 = 0.42 steps per frame), not 1 frame in 2.4. The jitter is real either way.

### AUDIO-1 [high|CONFIRMED] src/audio/AudioEngine.ts:124
Som do motor continua tocando com a aba em segundo plano
EVID: Não há `visibilitychange` em nenhum lugar do src. `AudioEngine` não tem suspend/stop. Os osciladores e o ruído (linhas 119-122 `start()`) ficam ligados, e `update()` (linha 129) só roda dentro do rAF, que para com a aba oculta.
FIX: No Game (ou num módulo de ciclo de vida), ouvir `visibilitychange`: com a página oculta, `ctx.suspend()`; com ela visível de novo, `ctx.resume()`. Expor `suspend()`/`resume()` no AudioEngine.
VR: AudioEngine has no suspend, stop or close, and src has no visibilitychange. The oscillators, LFO and noise start at 119-122 and never stop. update() (129) runs only inside the rAF, which pauses when the tab is hidden. Browsers do not suspend a running AudioContext when a tab is hidden, so the engine keeps sounding at the last target.

### CORE-3 [medium|CONFIRMED] src/core/Game.ts:387
Game.ts é um god object: 78 % do arquivo são sondas de debug, e as responsabilidades do jogo estão todas no mesmo construtor
EVID: O arquivo tem 1756 linhas. `debugHandle()` vai da linha 387 à 963, `worldDebug`/`extrasDebug`/`interiorsDebug` da 965 à 1342, e as sondas `probeSteam`/`probeSearchlight`/`probeBody`/`probeGround`/`probeBeam`/`probeHeadlightShimmer`/`probeRoadMarks` da 1073 à 1755. São cerca de 1370 linhas de debug. O construtor (131-286) acumula: geração do mundo (155-171), spawn (47-64, 173-179), farol e cones presos ao carro (181-218), hack do onBeforeRender do espelho (223-234), montagem do pós-processamento (239-266), atalhos de teclado globais (274-281) e listener de resize (283). O fixedUpdate mistura reset por água (308-321) com faísca e shake de batida (323-343). A justificativa da AD-004 diz 'cada arquivo cabe na cabeça'.
FIX: Antes da garagem, extrair: (1) `src/core/debug/` com debugHandle e as sondas, carregado por `import()` dinâmico só em DEV; (2) `WorldBuilder` para as linhas 155-179; (3) `PostPipeline` para as linhas 239-266 e o resize; (4) farol e cones para `src/vehicle/`; (5) um `InputRouter` ou uma máquina de modos (menu/garagem/rua/corrida) que decide quem recebe os atalhos.
VR: Game.ts has 1756 lines. debugHandle starts at 388, worldDebug/extrasDebug/interiorsDebug run to about 1342, and the probe methods run from 1073 to the end. The one exception is reflectorSkipList (1024), which is runtime code, not debug. The constructor mixes world, spawn, headlights, the mirror hack, post-processing and input (131-286). The Enter/Escape/R bindings (274-280) have no screen mode; today race.enter checks a prompt, but nothing distinguishes a menu or garage. This is real architecture debt for sub-projects 3-5.

### CORE-4 [medium|CONFIRMED] src/core/Game.ts:177
Carro do jogador fixo: `readonly car` construído uma vez com DEFAULT_CAR, e os faróis presos ao mesh dentro do Game
EVID: Game.ts:94 `readonly car: Car;` e linha 177 `this.car = new Car(this.world, this.scene, assets, {...}, DEFAULT_CAR);`. As linhas 185 e 216 fazem `this.car.mesh.add(headlight, headlight.target)` e `this.car.mesh.add(cone)`, com posições fixas (±0,6, 0,35, 2,0) que não dependem do modelo. fixedUpdate, render, `race.enter(this.car)` e as sondas referenciam `this.car` diretamente.
FIX: Tornar o carro substituível (`setPlayerCar(spec, model)`, que faz dispose do antigo e reaplica os acessórios). Mover farol e cones para uma fábrica em `src/vehicle/`, parametrizada pela bounding box do modelo.
VR: Game.ts:94 declares `readonly car: Car`, and line 177 builds it once with DEFAULT_CAR. The headlight (185) and the cones (216) are added to this.car.mesh inside the Game with fixed positions. Swapping the car or its CarSpec at runtime needs a refactor, and a new Car would have no headlights.

### CORE-5 [medium|CONFIRMED] src/core/Game.ts:283
Game não tem dispose: listener de resize, InputManager, World/EventQueue do Rapier, renderer e AudioContext nunca são liberados
EVID: Game.ts:283 `window.addEventListener('resize', this.handleResize);` não tem `removeEventListener` correspondente. `InputManager.dispose()` (InputManager.ts:28) nunca é chamado (grep sem chamadores). Não há `world.free()`, `eventQueue.free()`, `renderer.dispose()`, `composer.dispose()` nem `ctx.close()`. AudioEngine não tem stop nem dispose, e o `lfo` e o `noise` (linhas 96 e 106) são variáveis locais que ninguém para.
FIX: Implementar `Game.dispose()`: `loop.stop()`, remover o resize, `input.dispose()`, `audio.dispose()` (parar as fontes e fechar o ctx), `race.dispose()`, `world.free()`/`eventQueue.free()`, `composer.dispose()`, `renderer.dispose()`.
VR: Game.ts:283 adds the resize listener and nothing removes it. InputManager.dispose has no callers (only its definition shows up in grep). There is no world.free, eventQueue.free, renderer.dispose, composer.dispose or ctx.close, and the lfo and noise are unstoppable local variables (AudioEngine.ts:96, 106). Rebuilding the Game would duplicate handlers and leak WASM memory and the AudioContext.

### CORE-6 [low|CONFIRMED] src/main.ts:42
debugHandle() é executado e empacotado também em produção
EVID: main.ts:42 `exposeDebug(import.meta.env, game.debugHandle(), window ...)`: o argumento é avaliado antes do teste de `env.DEV`. `debugHandle` chama `worldDebug()` (Game.ts:521), que copia `data.lots.map`, `roads.map`, `walls.map`, zonas, árvores e canteiros no boot. Build de produção gerada no scratchpad: `probeHeadlightShimmer`, `probeRoadMarks`, `searchlightFrameDiff` e `facadeSpans` aparecem no bundle (index-*.js, 5.237 kB).
FIX: `if (import.meta.env.DEV) { const { debugHandle } = await import('./core/debug'); exposeDebug(..., debugHandle(game), window); }`, para o Rollup eliminar tudo no build de produção.
VR: main.ts:42 evaluates game.debugHandle() before exposeDebug checks env.DEV (exposeDebug.ts:11). worldDebug (966+) runs eagerly at boot and makes shallow copies of lots, roads and walls (lines 975, 985, 997). Class methods are always bundled. The cost is only a few thousand small objects at boot plus bundle size, and nothing is exposed (AD-005 holds), so the severity drops to low.

### CORE-7 [medium|CONFIRMED] src/core/GameLoop.ts:36
Uma exceção em fixedUpdate ou render mata o loop em silêncio
EVID: GameLoop.ts:36-40: `for (...) this.fixedUpdate(...); this.render(dt); this.handle = requestAnimationFrame(this.frame);`. O próximo rAF só é agendado no fim, sem try/catch, e main.ts só captura erros do boot (linhas 27-40).
FIX: Agendar o rAF no início do quadro, ou pôr try/catch que para o loop e chama o `showError` do main (passado como callback) com a mensagem.
VR: GameLoop.ts:36-40 schedules the next requestAnimationFrame only at the end of frame, with no try/catch. main.ts catches errors only during boot (27-40). A throw in fixedUpdate or render stops the loop silently, and the player sees no message.

### RENDER-1 [medium|CONFIRMED] src/world/CityScene.ts:140
Render target do Reflector fica no tamanho da janela do boot e não acompanha o resize
EVID: CityScene.ts:140-141 `const textureWidth = Math.floor(window.innerWidth * 0.5)`, e o `uTexel` do shader nasce com `1 / width` (linha 63). Game.handleResize (Game.ts:378-385) redimensiona renderer, composer, grade e câmera, mas não o reflector (`getRenderTarget().setSize`) nem o `uTexel`.
FIX: No handleResize: `reflector.getRenderTarget().setSize(w/2, h/2)` e atualizar `uTexel` para `1/(w/2), 1/(h/2)`. Melhor ainda: mover isso para um `PostPipeline.resize`, que cuida de todos os alvos.
VR: CityScene.ts:140-141 sizes the render target from window.innerWidth/innerHeight at boot, and uTexel (63) uses those same values. Game.handleResize (378-385) never touches the reflector or its uTexel. After a maximize or fullscreen, the reflection stays at the boot resolution.

### AUDIO-2 [medium|CONFIRMED] src/core/InputManager.ts:35
AudioContext é criado uma única vez, no primeiro keydown; se ele nascer suspenso, o jogo fica mudo a sessão inteira
EVID: InputManager.ts:35-38: `if (!this.firstKeySeen) { this.firstKeySeen = true; this.onFirstKey?.(); }`, que dispara em qualquer tecla. AudioEngine.ts:124 `void ctx.resume();` e linha 125 `this.state = 'running'`, sem olhar `ctx.state`. Nada volta a chamar resume depois.
FIX: Em todo keydown e pointerdown, se `ctx.state !== 'running'`, chamar `ctx.resume()`. `state` deve refletir `ctx.state`.
VR: InputManager.ts:35-38 calls onFirstKey on any key, Escape included, and only once. AudioEngine.ts:124-125 calls resume() and sets state = 'running' without checking ctx.state. Nothing calls resume again later. The HTML spec excludes Esc from activation-triggering keydowns, so if Esc is the player's first interaction the context stays suspended. The trigger is narrow (an edge case), but the code path is certain.

### RENDER-3 [low|CONFIRMED] src/core/Game.ts:250
GTAO ignora o pixelRatio, e a mudança de DPR (zoom, outro monitor) nunca é reaplicada
EVID: Game.ts:250 `gtao.setSize = () => baseSetSize(Math.floor(window.innerWidth / 2), ...)` descarta o tamanho já multiplicado pelo pixelRatio que o composer passa. Game.ts:142 `setPixelRatio(Math.min(window.devicePixelRatio, 2))` só roda no construtor, e handleResize (378-385) não chama `setPixelRatio` nem `composer.setPixelRatio`.
FIX: No resize: `renderer.setPixelRatio(min(dpr,2))` e `composer.setPixelRatio(...)`. No GTAO: `baseSetSize(Math.floor(w/2), Math.floor(h/2))`, usando os argumentos recebidos.
VR: Game.ts:250 overrides gtao.setSize with innerWidth/2 in CSS pixels and ignores the pixelRatio-scaled size the composer passes, so at DPR 2 it is 1/4 of the linear buffer. setPixelRatio runs only in the constructor (142), and handleResize (378-385) never reapplies it after zoom or a monitor change.

### RENDER-4 [low|CONFIRMED] src/core/Game.ts:141
`antialias: true` no canvas não tem efeito com o EffectComposer, que já usa SMAA
EVID: Game.ts:141 `new THREE.WebGLRenderer({ canvas, antialias: true, ... })`. O RenderPass desenha no render target do composer, sem MSAA, e a linha 265 adiciona `SMAAPass`. O MSAA do backbuffer só alcança o blit final do OutputPass.
FIX: `antialias: false`; manter só o SMAA (ou, se quiser MSAA, criar o composer com um render target com `samples: 4`).
VR: Game.ts:141 sets antialias: true, but RenderPass draws into the EffectComposer render targets, which have no MSAA, and there is already a SMAAPass (265). The multisampled backbuffer only receives the final OutputPass blit, which costs memory without smoothing anything.

### HUD-1 [low|PLAUSIBLE] src/hud/Hud.ts:29
Barra de RPM escreve estilo a cada quadro e reinicia a transição CSS
EVID: Hud.ts:29 `this.rpmEl.style.width = `${rpmBarWidth(state.rpm).toFixed(1)}%`;` roda sempre, sem o cache usado em speed e gear. style.css (#rpm-fill) tem `transition: width 60ms linear`. O Minimap refaz o canvas inteiro todo quadro e percorre as 13.683 amostras de estrada (medido: 13 estradas, 0,27 ms por chamada no node, com alocação de `number[][]`).
FIX: Aplicar o mesmo cache de `lastSpeed` na largura (comparando a string) e remover a transition. No minimapa, redesenhar a 20-30 Hz, ou só quando o carro andar mais de 1 px.
VR: Hud.ts:29 writes the width every frame without the cache used for speed and gear. But when the value is the same, the browser does not start a transition, and when the value changes, retargeting the 60 ms transition is the intended smoothing, so 'restarts the transition' is overstated. The Minimap part is real: Minimap.update (21-36) clears and redraws the canvas and walks minimapSegments every frame. I did not re-measure the 0.27 ms cost.

### AUDIO-3 [low|CONFIRMED] src/core/Game.ts:365
O áudio lê o acelerador cru, não o input que a corrida realmente aplica
EVID: Game.ts:365 `this.audio.update(state.rpm, this.input.state.throttle);`, enquanto o carro recebe `this.race.playerInput(...)` (linha 297), que na contagem devolve `HOLD_INPUT` (raceSession.ts:89).
FIX: Passar ao áudio o `DriveInput` efetivo do último passo (guardar em `lastInput` no fixedUpdate).
VR: Game.ts:365 passes this.input.state.throttle to audio.update, while the car receives race.playerInput. During the countdown that is HOLD_INPUT with throttle: false (raceSession.ts:24, 89). engineGainFor(true) raises the gain to ENGINE_GAIN_MAX while the RPM stays at idle.

### AUDIO-4 [low|PLAUSIBLE] src/audio/AudioEngine.ts:53
Se `new AudioContext()` lançar, a primeira tecla se perde
EVID: InputManager.ts:37 chama `onFirstKey` antes de `applyKey` (linha 40), e AudioEngine.ts:53 `new AudioContext()` não tem try/catch. Se o construtor lançar (sem dispositivo de saída, política do navegador), o handler aborta, e os keydown repetidos seguintes saem na linha 39 (`if (event.repeat) return;`).
FIX: Envolver o `start()` do áudio em try/catch (ou chamar `onFirstKey` depois de `applyKey`).
VR: The path exists: onFirstKey (InputManager.ts:37) runs before applyKey (40) with no try/catch, and new AudioContext() (AudioEngine.ts:53) is unprotected. A throw would lose the first press, and the repeats return at line 39. The trigger is doubtful, though: Chrome and Firefox do not throw in the AudioContext constructor when there is no output device.

### CORE-9 [low|CONFIRMED] src/main.ts:32
A geração do mundo é síncrona e fica escondida atrás do texto 'Carregando carro...'
EVID: main.ts:28-35: o último `onProgress` do Loader é 'Carregando carro...' (Loader.ts:82). Depois, `new Game(...)` gera, síncrono, o terreno 769×769, estradas, lotes, miolos e toda a física (Game.ts:156-179), sem ceder a vez ao navegador.
FIX: Atualizar o texto para 'Gerando cidade...' e dar um `await new Promise(requestAnimationFrame)` antes do `new Game`. Melhor ainda: quebrar a geração em etapas com yield.
VR: The last onProgress message is 'Carregando carro...' (Loader.ts:82). main.ts:32 then calls new Game, whose constructor (Game.ts:156-179) generates the terrain, roads, lots, interiors and physics synchronously without updating the text or yielding to the browser. I did not measure how long it takes.

### tests-1 [medium|CONFIRMED] src/race/RaceController.ts:175
Nenhum teste passa um portão dirigindo o carro do jogador: todas as provas usam o atalho DEV crossNextGate
EVID: RaceController.ts:175 `stepProgress(this.player, race, this.playerPrev, { x: t.x, z: t.z }, time);` é o único caminho real de progresso do jogador. Nos testes, todo avanço de portão vem de `g.race.crossNextGate()` (race.spec.ts:189, 257, 283, 305), e esse atalho chama stepProgress com pontos sintéticos, fora de afterStep (RaceController.ts:299-307). O grep por afterStep/RaceController em tests/ não acha nada. Os oponentes são cobertos por Opponent.track (raceAi.test.ts), o jogador não.
FIX: Criar um teste de física (Rapier em node) que monte RaceController com Car e WorldPhysics do seed 1337. Ou criar um e2e que teleporte o carro alguns metros antes de gates[0] alinhado ao heading e segure W até `player.nextGate === 1` / `lastGate === 0`, sem crossNextGate.
VR: RaceController.ts:175 is the only real progress path. crossNextGate (297-307) calls stepProgress on its own and rewrites playerPrev, so deleting line 175 or breaking the playerPrev update at 176 would leave every race.spec test green (189, 257, 283, 305 all use crossNextGate). grep in tests/ finds no afterStep or RaceController test. The one driving test, 'player drives after go' (:342), checks only speed. This is a real coverage gap, but it is a test gap and not a player-visible bug, so medium, not high.

### tests-2 [medium|CONFIRMED] playwright.config.ts:22
reuseExistingServer: true com porta padrão fixa faz o e2e rodar contra o servidor de outro checkout
EVID: playwright.config.ts:4 `const PORT = Number(process.env.E2E_PORT ?? 5173);` e :22-24 `webServer: { command: `npx vite --port ${PORT} --strictPort`, url: ..., reuseExistingServer: true`. O AGENTS.md prevê vários worktrees em .claude/worktrees/ e só recomenda E2E_PORT para suítes em paralelo.
FIX: Usar `reuseExistingServer: !!process.env.E2E_REUSE` (desligado por padrão). Ou fazer o globalSetup conferir que o servidor serve o cwd atual, por exemplo com um endpoint/meta que exponha o caminho ou o hash do checkout.
VR: playwright.config.ts:4 defaults the port to 5173 and :22 sets reuseExistingServer: true. With vite already running on 5173 from another checkout, Playwright reuses it and never starts the worktree's server. AGENTS.md only asks for E2E_PORT when suites run in parallel, not when a dev server is open, so a false green for the wrong branch is realistic in this worktree-based agent flow.

### tests-3 [low|CONFIRMED] tests/e2e/race.spec.ts:176
A posição na corrida e a ordem dos resultados no browser só são checadas por faixa ou formato
EVID: race.spec.ts:179-181 `expect(s.posText).toBe(`POS ${s.pos}/4`); expect(s.pos).toBeGreaterThanOrEqual(1); expect(s.pos).toBeLessThanOrEqual(4);`. Nesse cenário o jogador está parado 1.5 s depois do GO, então deveria ser 4. Em :196-201 o teste só confere que existe uma linha 'VOCÊ' com tempo válido. O jogador cruza tudo em menos de 1 s por crossNextGate e deveria ser 1º, com os 3 oponentes em '--:--.--'.
FIX: Parado após o GO, cobrar `pos === 4`. No sprint via crossNextGate, cobrar `rows[0][1] === 'VOCÊ'` e `rows.slice(1).every(r => r[2] === '--:--.--')`.
VR: race.spec.ts:179-181 checks only the POS format and the 1..4 range, and :196-201 checks row numbering and time format but not that VOCÊ is 1st. The pure functions standings and resultRows have ordering tests (raceProgress.test.ts:87, :107), so what is left untested is the RaceController wiring (position() at :230-231 with PLAYER_SLOT=3, and standingList() at :234-245). The gap is smaller than described, so low.

### tests-4 [low|PLAUSIBLE] tests/unit/carSpec.test.ts:46
Os testes travam os valores literais de DEFAULT_CAR e o número exato de campos, o que quebra o tuning (sub-projeto 4)
EVID: carSpec.test.ts:46-63 repete 17 literais (`expect(c.massKg).toBe(1250)`, `shiftUpRpm 6500`, `steerLateralG 1.7`...) e :77-78 exige `FIELDS.length === 34` e as chaves exatas. drive.spec.ts:175 `expect(Object.keys(expected).length).toBe(34)`. drivetrain.test.ts:116 e :285 repetem `brakeBiasFront 0.65` e `handbrakeRearGrip 0.4`. Todas as envoltórias de física (tests/physics/*) medem só DEFAULT_CAR.
FIX: Trocar os literais por invariantes (monotonia das marchas, curva cobrindo idle..redline, campos finitos e > 0) e derivar a lista de campos do tipo. Parametrizar os testes de física com um conjunto de fichas (padrão e extremos do tuning permitido).
VR: The literals do exist (carSpec.test.ts:46-63, FIELDS.length 34 at :77, drive.spec.ts:175). They are spec checks by design (car-handling C28, car-feel C13) that freeze the default spec. Runtime tuning would build a derived CarSpec and would not change DEFAULT_CAR, so the claim that these tests 'break tuning' is overstated. Only adding a new field breaks the 34 check, and that is a deliberate door. It is true that the physics envelopes run only with DEFAULT_CAR, apart from a few spreads such as massKg 1500 in harness.test.ts:15, but tuned cars do not exist yet.

### tests-5 [low|CONFIRMED] tests/e2e/race.spec.ts:337
Um teste grava screenshot fixo em test-results sem conferir nada nele
EVID: race.spec.ts:337 `await page.screenshot({ path: 'test-results/race-grid.png' });`, e nenhuma asserção usa essa imagem.
FIX: Remover o screenshot, ou usar testInfo.outputPath() e anexar com testInfo.attach().
VR: race.spec.ts:337 calls page.screenshot({ path: 'test-results/race-grid.png' }) and nothing asserts on the image. The overwrite risk needs two runs from the same checkout, which is rare because each worktree has its own directory.

### tests-6 [low|CONFIRMED] tests/unit/effectsMath.test.ts:65
Vários testes só repetem constantes do código ou fazem aritmética com literais
EVID: effectsMath.test.ts:65-76 (`expect(SMOKE_PER_STEP).toBe(4)` ... 10 constantes); audioMap.test.ts:38-41 (`RAMP_TAU_S 0.15`) e :55-60; rainMath.test.ts:7-8; quality.test.ts:13-14; flicker.test.ts:7-8; minimap.test.ts:15-16; aiDriver.test.ts:32-33; cornerAssist.test.ts:19-20, 36, 38 (`expect(0.9 * 9.81).toBeCloseTo(8.829, 6)` testa o JS, não o código); yawAssist.test.ts:22-25 e :40-43; drivetrain.test.ts:324 e :329 (`t` calculado e só conferido > 0); harness.test.ts:213-214 (lê o texto do vite.config.ts).
FIX: Remover as asserções de constante ou trocar por propriedades (por exemplo, o pool nunca passa do cap, o tremolo some acima de 2500 rpm), que já existem em outros its do mesmo arquivo.
VR: effectsMath.test.ts:65-76 only repeats 10 constants. cornerAssist.test.ts:19-20 checks JS arithmetic (`0.9 * 9.81` toBeCloseTo 8.829). drivetrain.test.ts:324/329 computes t and only checks t > 0, which the rpm > idle assertion already implies. The yaw and corner assist tables themselves do test behavior, so the finding applies only to the parts cited.

### tests-7 [low|CONFIRMED] tests/unit/cityGenerator.test.ts:6
cityGenerator.test testa generateCity, que o jogo não chama mais
EVID: Um grep por generateCity em src/ só acha a definição em src/world/CityGenerator.ts:201. CityScene.ts e Environment.ts importam só NEON_PALETTE/FACADE_TYPES, e o resto usa só mulberry32. cityGenerator.test.ts:6-111 cobre a grade 8×8 de 40 m, os 64 blocos e os postes a cada 40 m, que vêm do layout antigo, trocado pela city-terrain (lots).
FIX: Apagar generateCity e seus testes, mover mulberry32/NEON_PALETTE para um módulo próprio (por exemplo, src/core/rng.ts) e manter só o teste de determinismo do PRNG.
VR: In src/, generateCity appears only in its definition at CityGenerator.ts:201. Every import from CityGenerator takes only DEFAULT_SEED, NEON_PALETTE, FACADE_TYPES or mulberry32. cityGenerator.test.ts:7-90 tests generateCity, which is dead code.

### tests-8 [low|PLAUSIBLE] tests/unit/purity.test.ts:6
A lista de módulos puros não tem GameLoop.ts, e a checagem só olha imports diretos
EVID: src/core/GameLoop.ts só importa './FixedStepper' (sem three nem rapier) e não está em PURE_MODULES, que tem 36 itens travados em :58. Também não há teste para GameLoop (clamp de 0.25 s, stop cancelando o rAF). O regex FORBIDDEN (:55) só pega import direto de three/rapier: um módulo listado que importe '../vehicle/Car' passaria. Hoje o fecho transitivo dos 36 está limpo, conferido com script. roadQuery.ts e terrain/noise.ts estão na lista, mas nenhum teste os importa direto.
FIX: Adicionar GameLoop.ts à lista, com teste usando rAF/performance falsos. Tornar a checagem transitiva, seguindo imports relativos sem `import type`. Criar testes diretos pequenos para findAvenue/crossing e fbm/valueNoise.
VR: GameLoop is untested and missing from PURE_MODULES, and the FORBIDDEN regex (purity.test.ts:55) only catches direct imports. The stated impact is wrong, though: removing the 0.25 s clamp in GameLoop would not cause a step spiral, because FixedStepper caps at maxSteps=5 and drops the rest (FixedStepper.ts:24-30), and that is tested in fixedStepper.test.ts. GameLoop also depends on requestAnimationFrame, so it is questionable as a pure module. The transitive-import gap is real but the closure is clean today.

### tests-9 [low|CONFIRMED] src/world/ChunkManager.ts:79
maxBuildsInOneFrame mede o tamanho do plano, que já vem limitado a 1, e não os builds feitos por quadro
EVID: ChunkManager.ts:79 `this.maxBuildsInOneFrame = Math.max(this.maxBuildsInOneFrame, plan.build.length);`, e chunks.ts:40 devolve `build: nearest >= 0 ? [nearest] : []`. world.spec.ts:361 `expect(r.chunks.maxBuildsInOneFrame).toBe(1);`
FIX: Contar `builds` por chamada de render(): guardar o delta de `this.builds` entre quadros no Game e expor o máximo desse delta.
VR: ChunkManager.ts:79 records plan.build.length, and planChunks (chunks.ts:40) always returns at most [nearest]. The counter therefore measures the plan, not builds per frame, and world.spec.ts:361 would stay green if update() were called several times per frame. Today it is called once, from render (Game.ts:352).

### tests-10 [low|CONFIRMED] tests/e2e/hud.spec.ts:45
Esperas fixas de relógio no e2e, algumas antes de asserções negativas
EVID: hud.spec.ts:45 `await page.waitForTimeout(1_000);` seguido de `expect(hasGame).toBe(false)`, e :93 (500 ms, o mesmo padrão). hud.spec.ts:101 (200 ms) e :128 (100 ms) esperam o minimapa redesenhar. extras.spec.ts:36 (300 ms) e render.spec.ts:7 (500 ms) no beforeEach. O próprio helpers.ts:4-8 diz que o tempo de relógio não corresponde ao tempo simulado no SwiftShader.
FIX: Trocar por advanceSim/waitForFunction sobre `__game.frames` (por exemplo, esperar frames avançarem 2) e, para as negativas, esperar N quadros ou o `#error` estável.
VR: hud.spec.ts:45 (1000 ms) and :93 (500 ms) sleep before the __game===undefined assertion, :101 (200 ms) and :128 (100 ms) wait for the minimap, and extras.spec.ts:36 and render.spec.ts:7 sleep in beforeEach. The false-negative risk is limited, because #error is already visible and startup has already failed at that point, but these are real fixed waits that helpers.ts:4-8 itself warns about.

### tests-11 [low|CONFIRMED] tests/e2e/race.spec.ts:131
O teste da contagem tem loop de polling sem limite e waitForFunction sem timeout
EVID: race.spec.ts:131 `await page.waitForFunction(() => document.querySelector('#race-countdown')!.textContent !== '');` (sem timeout) e :135 `for (;;) { const s = await page.evaluate(...); if (s.state !== 'countdown') break; ... }`
FIX: Amostrar dentro do browser via rAF, como no teste de upshift do hud.spec.ts, com prazo em simTime (por exemplo, start + 4 s), e dar uma mensagem de falha explícita.
VR: race.spec.ts:131 calls waitForFunction without a timeout and :135 has a for(;;) loop with no limit, so both are bounded only by the 120 s test timeout, with no clear message. The sampling concern is minor.

### tests-12 [low|CONFIRMED] tests/unit/aiDriver.test.ts:48
A janela de 4 s do detector de travado não tem limite inferior testado
EVID: aiDriver.test.ts:48-56 só chama `checkStuck(ai, 4, y)` com t = 4 (run(4.9) é true, run(5.1) é false), sem caso t < 4. raceAi.test.ts:137 `expect(k * DT - stoppedAt).toBeLessThanOrEqual(4.1);` só dá teto. aiDriver.ts:219 `if (t - ai.stuckT0 < STUCK_WINDOW_S - 1e-9) return false;`
FIX: Na unidade, conferir que `checkStuck(ai, 3.99, 0)` é false com progresso < 5 m e que em 4.0 é true. Na física, cobrar também `k*DT - stoppedAt >= 3.9`.
VR: aiDriver.test.ts:48-56 only calls checkStuck at t=4, and raceAi.test.ts:137 only sets an upper bound (≤4.1). Changing STUCK_WINDOW_S (aiDriver.ts:35) to 1 would pass the unit test. It could be caught indirectly by `resets ≤ 1` in raceAi.test.ts:99, but that is not guaranteed.

### tests-13 [low|CONFIRMED] tests/unit/yawAssist.test.ts:49
O caso de duas rodas no chão da ajuda de giro só confere que o valor não é 0
EVID: yawAssist.test.ts:49-51 `const twoWheels = yawAssistTorque(SPEC, 0.3, 10, 0, 2, INERTIA); expect(twoWheels).not.toBe(0); expect(Number.isFinite(twoWheels)).toBe(true);`. O valor esperado é exatamente 5000 (mesma entrada da linha 'limited target'). O comentário da :17 fala em 10 linhas, mas a tabela tem 9. No corner assist o mesmo caso tem valor exato (cornerAssist.test.ts:30).
FIX: Colocar a linha ['two wheels on the ground', 0.3, 10, 0, 2, 5000] na tabela.
VR: yawAssist.test.ts:49-51 only checks that twoWheels is non-zero and finite. yawAssist.ts:28 does not scale by wheels, so the exact value for (0.3, 10, 0, 2) is 5000, the same as the 'limited target' row, and a `* wheels/4` mutation would pass. The table has 9 rows even though the comment says 10.

### tests-14 [medium|CONFIRMED] src/core/InputManager.ts:33
InputManager (repeat, primeira tecla, press handlers) não tem teste unitário
EVID: Nenhum arquivo em tests/ importa InputManager. A lógica em :33-46 (`if (event.repeat) return;`, disparo único de onFirstKey, handler por código) só é exercida indiretamente no e2e. Não há teste nem tratamento de `blur`: uma tecla segurada ao trocar de janela fica presa em `state`.
FIX: Teste vitest com um EventTarget falso (o construtor já aceita `target`): repeat ignorado, onFirstKey uma vez, keyup limpando o estado. Depois tratar `blur` e cobrir esse caso também.
VR: No test imports InputManager. Beyond the missing test there is a real bug: InputManager.ts only listens for keydown/keyup and a grep for blur/visibilitychange in src finds nothing. Holding W and alt-tabbing leaves the key stuck in state, so the car keeps accelerating until the key is pressed again. That is visible to the player, so the severity goes up to medium.

### tests-15 [low|CONFIRMED] tests/physics/raceAi.test.ts:91
Um único teste de física leva cerca de 72 s e roda em todo `npm test`
EVID: `npx vitest run tests/physics --reporter=verbose`: 'each opponent finishes every race in time 72191ms', com timeout de 900_000 em :106. Ele corre 4 corridas × 3 habilidades até o fim com o Rapier.
FIX: Deixar o C22 atrás de uma flag (por exemplo, `describe.runIf(process.env.SLOW)`) ou num projeto vitest separado, e manter na suíte padrão uma versão curta (1 corrida, 1 habilidade, limite de tempo).
VR: vite.config.ts:6 includes tests/physics in `npm test`. Run alone here, 'each opponent finishes every race in time' took ~145 s (the finding measured 72 s), with a 900_000 timeout at raceAi.test.ts:106. It dominates the suite.

### tests-16 [low|CONFIRMED] package.json:12
Não há CI: nenhuma suíte roda de forma automática no repositório público
EVID: A raiz do repositório não tem `.github/` (o `ls -a` lista .claude, .git, .specs, docs, public, scripts, src, tests e outros). Os scripts `test` e `test:e2e` (package.json:12-17) só rodam à mão.
FIX: Criar um workflow GitHub Actions com `npm ci`, `npm run build` e `npm test`, e um job separado (manual ou noturno) para `npx playwright install chromium && npm run test:e2e`.
VR: There is no .github/ at the repo root, and package.json:12-17 has only manual scripts. For a solo project where tlc-spec's independent Verifier runs the suites, the risk is process rather than a code defect, so low, not medium.

### docs-1 [medium|CONFIRMED] tests/unit/extras.test.ts:67
`npm test` não fica verde em HEAD: 3 testes pesados estouram o timeout padrão de 5 s do vitest
EVID: `npx vitest run` em 12bbc59 deu primeiro 'Tests 2 failed | 200 passed (202)' e depois 3 falhas: `× parked cars sit in downtown patios away from everything 5369ms`, `× cats walk sit and stay in their zone 5236ms`, `× same seed same races 5441ms`, todas com 'Error: Test timed out in 5000ms'. Rodando só os 3 arquivos, falham de novo (6186 ms, 5285 ms, 6350 ms), e `routes are continuous and on the asphalt` passa com 4809 ms. `vite.config.ts` não define `testTimeout`. `tests/unit/raceRoutes.test.ts:126-128` gera terreno e estradas de novo dentro do corpo do teste (`generateRaces(generateRoads(SEED, generateTerrain(SE…`). As medições foram feitas com cerca de 19 processos node/chrome de outros agentes rodando em paralelo (CPU a 37 %).
FIX: Definir `test.testTimeout` (ex.: 30_000) em `vite.config.ts`, ou passar o timeout por teste nesses `it`. Levar a geração do mundo para `beforeAll` ou para o topo do módulo (como em extras.test.ts:18-23), para não repetir dentro do teste. Medir de novo com a máquina ocupada.
VR: Reproduzi: `npx vitest run` com cerca de 20 processos node/chrome ativos deu 'Tests 4 failed | 198 passed (202)', com timeouts de 5000 ms em raceRoutes.test.ts:126 ('same seed same races'), roads.test.ts:28 ('road network is deterministic') e outros. vite.config.ts não define `testTimeout`. Rodando só raceRoutes+roads, os testes passam, mas perto do limite: 'same seed same races' levou 4151 ms, 'routes are continuous' 3229 ms e 'road network is deterministic' 3020 ms. O problema é real: testes que regeneram terreno e estradas dentro do corpo do teste ficam perto do timeout padrão e falham sob carga paralela, que o AGENTS.md incentiva. Baixei para medium porque só falha com a máquina ocupada e não há regressão de código.

### docs-2 [medium|CONFIRMED] README.md:7
README diz que as corridas não existem e trata o block-life-extras como próximo passo
EVID: README.md:7 'por enquanto dá para dirigir livre pela cidade; as corridas ainda não existem.'; README.md:123 '(concluído). Próximo extra: vapor de dutos, holofotes, estacionamentos, gatos e trem.'; README.md:124 '2. Corridas: ...' sem marca de concluído. Em STATE.md:20-21 as duas features estão 'concluída' (races rodada 1, block-life-extras rodada 3), e o código existe em src/race/*.ts e src/world/rail/*.ts.
FIX: Tirar a frase de README.md:7, riscar ou marcar como concluído o item 2 do roadmap, trocar 'Próximo extra' pela lista do que já foi entregue e acrescentar essas coisas em 'O que já existe'.
VR: README.md:7 diz 'por enquanto dá para dirigir livre pela cidade; as corridas ainda não existem.' README.md:123 diz 'Próximo extra: vapor de dutos, holofotes, estacionamentos, gatos e trem.' e a linha 124 traz '2. Corridas' sem marca de concluído. STATE.md marca races e block-life-extras como concluídas, e o código existe em src/race e src/world/rail.

### docs-3 [low|CONFIRMED] README.md:27
A tabela de teclas do README não tem Enter e Esc, que são as teclas das corridas
EVID: README.md:27-34 lista só W, S, A/D, Espaço, R e M. O código liga `this.input.onPress('Enter', () => this.race.enter(this.car));` e `this.input.onPress('Escape', () => this.race.escape());` em src/core/Game.ts:279-280.
FIX: Acrescentar as linhas `Enter` (entrar na corrida perto do marcador) e `Esc` (sair/cancelar), e dizer que R, durante a corrida, volta ao último portão ou ao grid.
VR: A tabela de teclas do README não tem Enter nem Esc, e Game.ts:279-280 liga as duas. O impacto alegado não acontece: dentro do jogo, index.html:31 mostra '... ENTER corrida · ESC sai' no #help, e RaceController.ts:193 mostra 'ENTER · <nome>' perto do marcador. O jogador descobre as teclas na tela. Sobra só a desatualização do README, por isso low.

### docs-4 [low|CONFIRMED] AGENTS.md:17
O layout no AGENTS.md, no README e na AD-004 (active) não inclui src/race e src/world/rail
EVID: AGENTS.md:17: '`src/{core,world,vehicle,camera,hud,audio,post}/`, com `world/{terrain,roads,lots,interiors}/`'. STATE.md:34 (AD-004, active): 'Layout: `src/{core,world,vehicle,camera,hud,audio}/`', sem `post` e sem `race`. A árvore do README.md:79-96 também não tem `race/` nem `world/rail/`. O código tem src/race/{Opponent,RaceController,aiDriver,raceProgress,raceRoutes,raceSession}.ts e src/world/rail/{TrainScene,trainLine}.ts.
FIX: Atualizar a AD-004, ou registrar uma AD nova que a estenda, com `post`, `race` e `world/rail` e a regra para as pastas novas. Replicar no AGENTS.md:17 e na árvore do README.
VR: O texto confere. AGENTS.md:17 lista `src/{core,world,vehicle,camera,hud,audio,post}/` sem race e sem world/rail. AD-004 em STATE.md:34 lista `src/{core,world,vehicle,camera,hud,audio}/`, sem post e sem race. A árvore do README também não tem race/ nem rail/. O código tem src/race e src/world/rail. É desvio de documentação, não quebra nada, então fica low.

### docs-5 [low|CONFIRMED] .specs/STATE.md:19
O roadmap não marca a residuals como concluída, mas o handoff diz PASS
EVID: STATE.md:19 '1.7.1 `residuals` - reflexo da rua sem cintilar, ... custo da block-fill recontado', sem '(concluída)'. STATE.md:58 'residuals (PASS rodada 1)'. `.specs/features/residuals/verification.md`: '**Verdict**: PASS', '**Round**: 1 - full, verified at 6f6379d'. As outras linhas do roadmap trazem '(concluída, verificada ...)'.
FIX: Acrescentar '(concluída, verificada rodada 1)' em STATE.md:19.
VR: STATE.md:19, a linha 1.7.1 `residuals`, não tem '(concluída...)', enquanto as linhas vizinhas têm. O handoff (STATE.md:58) diz 'residuals (PASS rodada 1)'.

### docs-6 [low|CONFIRMED] .specs/STATE.md:46
Na tabela de decisões, a AD-017 vem antes da AD-016, que ela estende
EVID: STATE.md:46 é a linha da AD-017 ('... Estende a AD-016 ao mundo ...') e STATE.md:47 é a da AD-016. A verificação da block-life-extras cita `.specs/STATE.md:46` como prova de C39.
FIX: Pôr a AD-016 antes da AD-017 e, se o relatório for reaberto, atualizar a citação de C39.
VR: Na tabela de decisões, a linha da AD-017 ('Estende a AD-016 ao mundo') vem antes da AD-016. É problema de ordem e legibilidade.

### docs-7 [low|CONFIRMED] .specs/STATE.md:60
A lista 'Resíduos conhecidos' ainda traz como abertos os resíduos da races que a mesma linha diz resolvidos
EVID: STATE.md:60: 'Resolvidos pela block-life-extras: pintura escura dos oponentes, C13 "freio de mão", R no countdown, Enter a 100 m. races: pintura dos oponentes sai escura (a cor multiplica a textura laranja); C13 diz "freio" mas segura com freio de mão; C29 sem prova no `countdown`; C12 não mede os 100 m.' Os quatro itens da races são os mesmos quatro já marcados como resolvidos (provas em race.spec.ts:376-390, :413-417, :427-436 e races/checks.md:110).
FIX: Tirar o bloco 'races: ...' da lista de abertos ou movê-lo para 'Resolvidos'. Deixar em aberto só o que está de fato aberto (block-life-extras C2/C3 colour space, AC 28 no browser, fachos, draw calls 219/220, margens da corner-assist, sonda treeVertices).
VR: Em STATE.md:60, 'Resíduos conhecidos' diz 'Resolvidos pela block-life-extras: pintura escura dos oponentes, C13 "freio de mão", R no countdown, Enter a 100 m.' e logo depois lista 'races: pintura dos oponentes sai escura...; C13 diz "freio"...; C29 sem prova no `countdown`; C12 não mede os 100 m' sem marcar como resolvidos. São os mesmos quatro itens. race.spec.ts tem os testes novos que os cobrem, por exemplo 'opponent material is white...' e 'enter at 100 m from the marker does nothing'. A lista fica ambígua e redundante.

### docs-8 [medium|CONFIRMED] src/vehicle/Car.ts:512
O carro do jogador usa o glTF compartilhado sem clonar e não aceita pintura: a garagem do sub-projeto 3 esbarra nisso
EVID: Car.ts:512 `const model = this.paint ? assets.carModel.clone(true) : assets.carModel;`. Na sequência o código muda o objeto compartilhado (`model.scale.setScalar(MODEL_SCALE); model.position.y = ...`, :517-519) e o adiciona em `this.mesh` (:525). A pintura só existe no caminho do oponente (`buildOpponentModel`, :536-584), vem de `readonly paint` do construtor (:130) e não tem setter. Com `paint === null` o jogador fica com o laranja do atlas. O shader supõe um material único: `(parts[0]!.material as THREE.MeshStandardMaterial).clone()` (:555).
FIX: Clonar sempre (`carModel.clone(true)`), unificar os caminhos do jogador e do oponente com um `setPaint(hex)` que atualize o `paintUniform`, e registrar numa AD (ou no plan da garagem) que a pintura é por swatch do atlas.
VR: Car.ts:512 `const model = this.paint ? assets.carModel.clone(true) : assets.carModel;`. Sem pintura, o código muda scale e position do Object3D compartilhado e o adiciona em this.mesh (:525). `paint` é readonly no construtor (:130), e só o caminho do oponente usa o shader de pintura, com parts[0].material (:555). Hoje só existe um Car sem pintura (Game.ts:177), então não há bug atual. Um segundo Car sem pintura, como um preview de garagem, roubaria o Object3D. Não dá para repintar o jogador sem recriar o Car. É dívida real para o sub-projeto 3.

### docs-9 [medium|CONFIRMED] .specs/STATE.md:60
Draw calls no grid da corrida em 219 de 220: o sub-projeto 3 estoura o orçamento na primeira peça visual
EVID: STATE.md:52 'draw calls no grid do centro em corrida: 219 de 220'; tests/e2e/race.spec.ts:338 `expect(... __game.render.calls ...).toBeLessThanOrEqual(220);`. Car.ts:533-535 diz que cada oponente custa '2 draw calls por passe'. A lista de resíduos (STATE.md:60) registra o número mas não traz plano.
FIX: Antes de planejar o sub-projeto 3, decidir numa AD o novo teto ou onde economizar (instanciar oponentes, juntar as peças de tuning na malha da carroceria, cortar os extras do miolo durante a corrida), e registrar isso como pré-condição no plan.
VR: tests/e2e/race.spec.ts:338 exige `render.calls` <= 220, e o handoff registra 219. Car.ts:533-535 confirma 2 draw calls por oponente. A folga é de 1 draw call, e o STATE.md não traz plano para ela. Qualquer malha ou material a mais por carro no sub-projeto 3 derruba o C34, a menos que o orçamento seja renegociado. O resíduo já está registrado, mas o risco é real.

### docs-10 [medium|CONFIRMED] src/core/Game.ts:388
Cerca de 1370 das 1756 linhas de Game.ts são sondas de teste que vão para o bundle de produção
EVID: `debugHandle()` começa em Game.ts:388, seguido de `worldDebug` (:966), `probeSteam` (:1073), `probeSearchlight` (:1095), `extrasDebug` (:1167), `interiorsDebug` (:1246), `probeBody` (:1363), `probeGround` (:1438), `probeBeam` (:1481), `probeHeadlightShimmer` (:1556) e `probeRoadMarks` (:1680) até o fim do arquivo (1756 linhas). src/main.ts:42 chama `game.debugHandle()` sem condição, e só `exposeDebug` confere `env.DEV` (exposeDebug.ts:11). Como são métodos de classe, o bundler não os remove.
FIX: Mover o `debugHandle` e as sondas para `src/core/debug/*.ts`, importados por `import()` dinâmico só quando `import.meta.env.DEV`, e guardar a chamada em main.ts:42 atrás do mesmo `if`.
VR: Game.ts tem 1756 linhas. De :388 até o fim só há debugHandle, worldDebug, probes, extrasDebug, interiorsDebug e helpers. Só reflectorSkipList (:1024) é usado também no render (:228). main.ts:42 chama `game.debugHandle()` sem condição, e só exposeDebug confere env.DEV. dist/assets/index-*.js contém 'probeRoadMarks' e 'probeHeadlightShimmer', ou seja, o código das sondas vai para produção. A AD-005 não é violada ao pé da letra, porque __game não é exposto em produção. O peso da dívida e o código morto no bundle são reais.

### docs-12 [low|CONFIRMED] src/vehicle/Car.ts:334
A doc de `Car.teleport` diz 'só para testes e debug', mas o método é a base do reset de corrida da AD-015
EVID: Car.ts:334 `/** Só para testes e debug: coloca o carro em qualquer lugar, parado. */`. Chamadas em gameplay: RaceController.ts:142 (reset do jogador), :269 (grid), :306, e Opponent.ts:91 (`this.car.teleport(...)`, usado pelo reset de travado permitido pela AD-015).
FIX: Atualizar a doc: uso em gameplay para o grid e o reset de corrida (AD-015), além de testes.
VR: Car.ts:334 diz '/** Só para testes e debug: coloca o carro em qualquer lugar, parado. */'. O método é chamado em gameplay: RaceController.ts:142, :269 e :306, Opponent.ts:91, e também no spawn e reset, Game.ts:178 e :313. A doc está errada.

### docs-13 [low|PLAUSIBLE] .specs/lessons.json:1
A camada de lições não junta lições equivalentes, então 'provar os dois lados do limiar' repetiu em 3 features sem ser promovida
EVID: LESSONS.md:51 L-006 (engine-sound) 'Sample both sides of every clamp...'; :99 L-015 (yaw-assist) 'A table case that saturates at an outer clamp cannot prove an inner limit'; :129 L-020 (block-life-extras) 'A threshold claim needs a case just below and just above the number'. As três estão como `candidate` com recurrence 1, porque a promoção compara a `key` textual exata (lessons.json 'key': 'ac_gap::...'). A verificação da block-life-extras (rodada 2, F5 CAT_GONE_CAR 30->15) caiu exatamente nesse padrão. LESSONS.md:1 diz 'auto-maintained by scripts/lessons.py', mas o repositório só tem scripts/fetch-textures.mjs.
FIX: Juntar L-006, L-015 e L-020 numa lição só (recorrência 3, confirmada), e fazer o mesmo com as de precisão de check (L-003, L-018, L-019). Corrigir o cabeçalho para apontar onde o script realmente mora (no skill, não em `scripts/`).
VR: L-006 (ac_gap, audio), L-015 e L-020 (surviving_mutant) estão como candidate com recurrence 1, e as keys são textuais ('ac_gap::...'). L-006 e L-020 tratam da mesma ideia, os dois lados de um limiar. L-015 é diferente: fala de clamp interno contra externo. A afirmação de que o repositório 'só tem scripts/fetch-textures.mjs' é verdade, mas o lessons.py pertence ao skill tlc-spec-lean, não ao repositório, então isso não é um defeito do projeto. É uma limitação do processo do skill, com impacto especulativo.

### docs-14 [low|CONFIRMED] .specs/features/engine-sound:1
engine-sound e facade-glint não têm plan.md, embora o README diga que toda feature passa pelo plano
EVID: `ls .specs/features/engine-sound/` mostra só checks.md e verification.md, e o mesmo vale para `.specs/features/facade-glint/`. README.md:107-109: 'Cada funcionalidade passa por quatro etapas ... 1. **Plano** (`plan.md`)'.
FIX: Reconstruir um plan.md mínimo a partir dos checks, ou registrar no STATE.md que essas features foram feitas antes do processo ou num fluxo reduzido.
VR: .specs/features/engine-sound e .specs/features/facade-glint só têm checks.md e verification.md, sem plan.md. README.md:107-109 diz que cada funcionalidade passa por um plan.md.

