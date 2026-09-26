# car-handling

## Problem

O carro não se comporta como um carro. Em curva acima de ~110 km/h ele capota. O usuário disse: "curvas em alta velocidade, o carro capota. precisa ficar algo mais natural, mais proximo ao real" e "nao foque so no capotamento, mas na mecanica total".

Medições em `3b76758`, no spawn e em chão plano:

| Situação | Hoje | Carro de rua esportivo (referência) |
| --- | --- | --- |
| aceleração lateral em curva, 60 km/h | 3.5 g | 0.9 – 1.0 g |
| aceleração lateral em curva, 100 km/h | 9.9 g, depois capota | idem, derrapa antes de capotar |
| capota ao virar tudo a partir de | 120 km/h (a 90 km/h inclina 4°) | não capota em chão plano |
| frenagem 100 → 0 km/h | 2.1 m em 0.27 s (~10 g) | 35 – 42 m |
| 0 → 100 km/h | 5.2 s | 5.5 – 7.5 s |
| roda dianteira atinge o ângulo máximo | na hora (tecla digital) | volante leva ~0.2 s |
| velocidade máxima | corte seco a 220 km/h | limitada por arrasto e giro máximo |
| marcha e RPM | função da velocidade (faixas fixas) | função da marcha engatada; troca demora |

As causas estão no código:
- **Aderência cerca de 10× a de um pneu real.** `BASE_FRICTION_SLIP = 10` em `src/vehicle/Car.ts:37` é, na prática, o coeficiente de atrito do pneu.
- **Centro de massa alto para essa aderência.** Ele fica a ~0.8 m do chão, com meia bitola de 0.85 m. Capotar exige só ~1.06 g, então com 3–10 g de aderência o carro tomba antes de derrapar.
- **O resto é constante.** Força do motor fixa de 4000 N, freio que para a roda na hora e direção instantânea.

Quando isto sair:
- O carro derrapa antes de capotar.
- A traseira pode escapar com o freio de mão, e o motorista recupera o carro.
- Freia em distância de carro real.
- Troca marcha com queda de giro que se ouve.
- Sobe os morros da city-terrain com esforço visível.

## Flow

Reusa o `DynamicRayCastVehicleController` do Rapier. A AD-002 fica como está: o comportamento vem de parâmetros e de uma camada pura de decisão, sem física de pneu própria. O que muda são os números e a camada `drivetrain`.

1. teclado → `core/InputManager` (exists) → `InputState` digital (`steerAxis` −1/0/+1, `throttle`, `brake`, `handbrake`)
2. `vehicle/carSpec` (door 1) - uma ficha técnica pura, `DEFAULT_CAR`, com massa, geometria, curva de torque, relações de marcha, arrasto, freios, aderência e direção
3. `vehicle/drivetrain` (exists, contrato muda pela door 2) - passo puro e com estado a cada 1/60 s: volante com rampa, câmbio automático, torque pela curva, freio com ABS, arrasto e resistência de rolagem; devolve o comando por roda e o novo estado
4. `vehicle/Car` (exists)
   - aplica no corpo do Rapier a massa, o centro de massa e a inércia da ficha
   - aplica o comando no controlador e o arrasto como força no corpo
   - devolve ao corpo o momento de rolagem que o Rapier descarta: ele aplica a força lateral de cada roda a só 10 % da altura do contato ("roll influence" do Bullet), e sem isso a rolagem sai ~0.3° a 1 g
   - mede o escorregamento lateral das rodas para o campo `skidding` (exists)
   - expõe `gear` e `rpm` vindos do câmbio
5. `vehicle/Effects`, `hud/Hud`, `audio/AudioEngine`, `camera/ChaseCamera` (exist) - leem `skidding`, `gear`, `rpm` e `yawRate` como hoje
6. `tests/physics/` (door 3) - roda o `Car` real com Rapier real no vitest (node), sobre um plano e uma rampa, e mede as manobras

## Impact

| Front | What changes |
| --- | --- |
| domain | `gear`: antes era função pura da velocidade (`gearFor`); passa a ser a marcha **engatada**, com estado. Leem: `hud/Hud`, `__game.car.gear` e `tests/e2e/hud.spec.ts` |
| domain | `rpm`: antes era a posição da velocidade dentro da faixa da marcha; passa a ser o giro do motor, calculado da rotação da roda × relação da marcha × diferencial, com piso no marcha lenta. Leem: `audio/AudioEngine` (frequência e filtro do motor), `hud/Hud` (barra) e `tests/e2e/audio.spec.ts` |
| domain | `skidding`: antes era "freio de mão acima de 20 km/h"; passa a ser escorregamento lateral real ou freio de mão. Leem: `vehicle/Effects` (marcas e fumaça) |
| domain | novo termo `CarSpec`: ficha técnica do carro, lida por `drivetrain` e `Car`. Os sub-projetos 3 e 4 (garagem, tuning) vão ler e alterar esta ficha |
| checks existentes | free-roam-city AC 4 (ângulo 0.5 → 0.15 rad linear), AC 6 (corte seco a 220 km/h), AC 21 (faixas de marcha por velocidade) e AC 22 (RPM por faixa) ficam **superados** por este plano. Seus testes em `tests/unit/drivetrain.test.ts` (C6, C8, C27, C28) são substituídos pelos checks novos, não apagados em silêncio: a tabela de checks superados em `checks.md` registra cada um |
| checks existentes | visual-upgrade AC 13 (marcas "enquanto freio de mão acima de 20 km/h") fica superado pelo AC 22 daqui. O pool de 400 marcas, as 2 marcas por passo e a fumaça continuam iguais |
| checks existentes | continuam valendo sem mudança: free-roam-city AC 1 (50 km/h em até 5 s), AC 2 (freio reduz a velocidade), AC 3 (ré até 30 km/h), AC 5 (freio de mão: fator 0.4 na traseira), AC 9 (reset) |
| stored data | nothing to migrate - nada é persistido |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside. `window.__game.car` é só DEV. Ganha os campos de leitura `steerInput`, `bodyRoll`, `bodyPitch`, `sideslip`, `lateralG` e `spec`, lidos pelos testes.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. ficha técnica do carro | `src/vehicle/carSpec.ts` puro exporta `interface CarSpec { massKg; comHeightM; wheelbaseM; trackM; wheelRadiusM; torqueCurve: ReadonlyArray<readonly [rpm: number, nm: number]>; idleRpm; redlineRpm; gearRatios: readonly number[]; reverseRatio; finalDrive; drivetrainEfficiency; shiftUpRpm; shiftDownRpm; shiftTimeS; cdA; rollingResistance; brakeForceN; brakeBiasFront; tireGrip; rearGripFactor; handbrakeRearGrip; steerMaxRad; steerLateralG; steerRateRadS; steerReturnRadS }` e `const DEFAULT_CAR: CarSpec` | constantes soltas em `Car.ts` e `drivetrain.ts` (o que existe hoje): a garagem e o tuning (sub-projetos 3 e 4) não teriam como trocar de carro ou alterar peças sem reescrever os dois arquivos |
| 2. drivetrain com estado | `stepDrivetrain(spec: CarSpec, s: DrivetrainState, input: DriveInput, wheelSpeedMs: number, dt: number): { state: DrivetrainState; cmd: DriveCommand }` com `DrivetrainState { gear: number; rpm: number; shiftTimer: number; lastShiftAgo: number; steer: number }` (`gear` −1 = R, 1..6). `computeDrive`, `gearFor` e `rpmFor` somem | manter `gearFor(speed)`: não expressa o tempo de troca, não segura a marcha na frenagem e não dá o giro do motor, que é o que a curva de torque precisa |
| 3. teste de dirigibilidade com física real | `tests/physics/*.test.ts` no vitest em node. Faz `await RAPIER.init()`, cria um `World` com chão plano de 8 km (cuboid) e uma rampa, e instancia o `Car` real com `new THREE.Scene()` e assets placeholder. Passo de 1/60 s em loop. Medido: 240 passos em 74 ms. Registrado como AD-011, estendendo a AD-005 | só Playwright: o SwiftShader leva ~1 min por manobra e o mapa não tem 200 m planos livres para uma curva a 150 km/h (o raio na aderência limite é ~180 m) |

- Nothing else in this change is hard to reverse. Os números da ficha são ajuste e mudam no diff.

## Criteria

Os valores medidos saem do harness (door 3): chão plano, só gravidade, `DEFAULT_CAR`. "Aceleração lateral" é a velocidade horizontal × `yawRate`, em média numa janela de 0.5 s. "Rolagem" é o ângulo do eixo lateral do chassi com a horizontal. "Sideslip" é o ângulo entre a frente do carro e a velocidade horizontal.

### S1: o carro não capota em chão plano (P1)

Nenhuma combinação de teclas capota o carro no plano.

**Acceptance Criteria**

1. The system SHALL montar o chassi com massa `massKg` = 1250 kg e o centro de massa a no máximo 0.50 m acima do plano de contato das rodas em repouso, de modo que `trackM / (2 × altura)` ≥ 1.6
2. WHEN qualquer manobra da matriz roda por 3 s a partir de qualquer velocidade inicial de 40 a 200 km/h, em passos de 20 THEN the system SHALL manter a inclinação do chassi (ângulo do eixo vertical do carro com a vertical) em no máximo 15°. A matriz: direção toda à esquerda; à direita; zigue-zague trocando de lado a cada 0.5 s; direção + acelerador; direção + freio; direção + freio de mão
3. WHEN os comandos da matriz do AC 2 são soltos THEN the system SHALL estar com as 4 rodas em contato com o chão em até 1.0 s
4. WHILE o carro faz curva em regime com a direção toda para um lado a 80 km/h the system SHALL mostrar rolagem de carroceria entre 1.0° e 6.0°, inclinando para fora da curva
5. WHEN o freio é aplicado a 100 km/h THEN the system SHALL mergulhar a frente entre 0.5° e 4.0° (arfagem para baixo) no primeiro 0.5 s

**Independent test:** `npx vitest run tests/physics/stability.test.ts`

### S2: aderência, direção e derrapagem de carro real (P1)

O carro gira até o limite do pneu, sai de frente quando passa dele e pode escapar de traseira com o freio de mão.

**Acceptance Criteria**

6. WHILE o jogador segura `A` ou `D` the system SHALL girar o ângulo das rodas dianteiras em direção ao alvo a no máximo `steerRateRadS` = 2.5 rad/s e, ao soltar, voltar ao centro a no máximo `steerReturnRadS` = 3.5 rad/s
7. The system SHALL limitar o ângulo alvo das rodas dianteiras a `min(steerMaxRad, atan(steerLateralG × 9.81 × wheelbaseM / v²))`, com `steerMaxRad` = 0.55 rad e `steerLateralG` = 1.3, sendo `v` a velocidade dianteira em m/s (em `v` < 1 m/s, `steerMaxRad`)
8. WHILE a direção fica toda para um lado por 3 s, em velocidade constante mantida pelo acelerador, de 60 a 180 km/h the system SHALL manter a aceleração lateral média de cada janela de 0.5 s em no máximo 1.15 g
9. WHILE a direção fica toda para um lado a 60 km/h the system SHALL atingir aceleração lateral média de pelo menos 0.80 g numa janela de 0.5 s dentro dos primeiros 2 s
10. WHILE a direção fica toda para um lado sem freio de mão, com ou sem acelerador, a partir de 60 a 180 km/h, por 3 s the system SHALL manter o sideslip em no máximo 12° (o carro sai de frente, não roda)
11. WHEN o freio de mão é puxado com a direção toda para um lado a 60 km/h THEN the system SHALL levar o sideslip acima de 20° em até 1.5 s
12. WHEN, depois do AC 11, freio de mão e direção são soltos THEN the system SHALL trazer o sideslip abaixo de 8° em até 2.5 s
13. WHILE o freio fica pressionado a 100 km/h com a direção toda para um lado the system SHALL mudar o heading em pelo menos 0.20 rad no primeiro 1.0 s (ABS: frear não trava a direção)

**Independent test:** `npx vitest run tests/physics/grip.test.ts tests/unit/drivetrain.test.ts`

### S3: motor, câmbio e freios de carro real (P1)

Aceleração, velocidade máxima, frenagem e subida vêm de torque, marchas, arrasto e aderência, não de constantes.

**Acceptance Criteria**

14. The system SHALL calcular a força motriz nas rodas traseiras como `torque(rpm) × relação da marcha × finalDrive × drivetrainEfficiency / wheelRadiusM`. O `torque(rpm)` interpola linearmente a `torqueCurve`, e a força é zero fora de `[idleRpm, redlineRpm]` enquanto a embreagem não patina
15. The system SHALL calcular o `rpm` como `max(idleRpm, |velocidade das rodas traseiras| / wheelRadiusM × 60 / 2π × relação × finalDrive)`. Em 1ª e ré com acelerador, o piso é de 2500 rpm (embreagem patinando na saída), e o valor é limitado a `redlineRpm` = 7000
16. WHEN o acelerador está pressionado e `rpm` ≥ `shiftUpRpm` = 6500 numa marcha abaixo da 6ª THEN the system SHALL engatar a marcha seguinte, com força motriz zero por `shiftTimeS` = 0.25 s
17. WHEN `rpm` ≤ `shiftDownRpm` = 2800 numa marcha acima da 1ª THEN the system SHALL engatar a marcha anterior se, nela, o `rpm` ficar abaixo de `shiftUpRpm`; e nenhuma troca acontece a menos de 0.6 s da anterior
18. WHEN o acelerador fica pressionado a partir do repouso em chão plano THEN the system SHALL atingir 100 km/h entre 5.5 s e 7.5 s
19. WHEN o acelerador fica pressionado por 60 s em chão plano THEN the system SHALL estabilizar a velocidade entre 215 e 240 km/h, sem corte seco de força por velocidade (limitada por arrasto `0.5 × 1.2 × cdA × v²` e resistência de rolagem)
20. WHEN o carro anda a 100 km/h sem acelerador nem freio THEN the system SHALL levar entre 4 s e 12 s para cair a 60 km/h (arrasto + rolagem + freio-motor)
21. WHEN o freio é pressionado a 100 km/h em linha reta THEN the system SHALL parar em 34 m a 45 m
22. WHEN o acelerador fica pressionado a partir do repouso numa rampa de 9 % (a rampa máxima das estradas da city-terrain) THEN the system SHALL atingir 60 km/h em até 10 s

**Independent test:** `npx vitest run tests/physics/powertrain.test.ts tests/unit/drivetrain.test.ts`

### S4: o jogo mostra e ouve a mecânica nova (P2)

HUD, som e efeitos leem o estado real do carro.

**Acceptance Criteria**

23. WHILE o carro escorrega the system SHALL marcar `skidding` quando a velocidade lateral no ponto de contato de qualquer roda passa de 2.5 m/s, ou com freio de mão acima de 20 km/h. Com `skidding`, as marcas e a fumaça do visual-upgrade são geradas como hoje
24. WHILE o jogo está rodando the system SHALL exibir no HUD a marcha engatada do câmbio (`R` na ré) e a barra de RPM a partir do `rpm` do AC 15, e o som do motor SHALL seguir esse mesmo `rpm`
25. WHEN o jogador acelera no jogo a partir do spawn por 4 s THEN the system SHALL mostrar no HUD pelo menos uma troca de marcha, com queda de `rpm` de pelo menos 1500 na troca

**Independent test:** `E2E_PORT=<porta> npx playwright test tests/e2e/hud.spec.ts tests/e2e/audio.spec.ts tests/e2e/visual.spec.ts`

## Out of scope

| Excluded | Why |
| --- | --- |
| câmbio manual (teclas de troca) | não pedido; a door 2 já comporta `gear` controlado de fora mais tarde |
| controle de tração e de estabilidade (ESC) | um carro de rua sem assistência já é "natural"; assistência muda o feeling e é escolha de tuning (sub-projeto 4) |
| aderência diferente em asfalto molhado, terra ou grama | a chuva é visual; não há superfícies diferentes no mapa ainda |
| modelo de pneu próprio (Pacejka) no lugar do Rapier | contradiz a AD-002; os números alvo são alcançáveis com o controlador do Rapier |
| gamepad e volante analógico | não pedido; a rampa do AC 6 substitui o analógico no teclado |
| dano e capotamento por batida | bater num prédio ou num guarda-corpo em alta velocidade ainda pode virar o carro, como na vida real; `R` desvira |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| nível de realismo | "arcade realista": números de carro real (aderência ~1 g, frenagem ~40 m, 0–100 em ~6.5 s), sem punir erro pequeno (o carro sai de frente, não roda sozinho) | pedido "natural, próximo ao real" num jogo estilo NFSU2; escolhido pelo usuário em 2026-09-26 | y |
| carro de referência | esportivo compacto de tração traseira: 1250 kg, ~300 Nm, 6 marchas | é o carro que já existe (placeholder / Kenney) e casa com os números do problema; escolhido pelo usuário em 2026-09-26 | y |
| freio de mão | fica o fator 0.4 na aderência traseira (free-roam-city AC 5) | derrapagem controlável já cabe no AC 11 e AC 12 | n |
| freio de mão com acelerador | o motor continua empurrando (power slide); sem acelerador, nem motor nem freio-motor. Com a ré engatada, acelerador andando para trás ou S andando para frente acionam o freio de serviço; de ré sem input, freio-motor contra o sentido em que o carro rola, como nas marchas para frente (escolhido pelo usuário em 2026-09-26, depois do round 2) | pedido "estilo NFSU2"; o build tinha cortado o motor sem registro, e o Verifier do round 1 apontou; escolhido pelo usuário em 2026-09-26 | y |
| raio físico da roda | fica 0.45 m (o modelo visual é escalado 1.8×); a relação final compensa no cálculo de rpm | trocar o raio muda a altura do carro e o visual | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen HUD | marcha durante a troca (0.25 s sem força) | AC 24 - mostra a marcha nova assim que engata |
| screen HUD | barra de RPM no corte (7000) | AC 15, AC 24 - barra cheia, sem passar de 100 % |
| screen HUD | estados vazio, loading, erro | n/a - o HUD já existe e estes estados não mudam |
| teclado | `A` e `D` juntos | existing - `steerAxis` devolve 0 (`src/core/input.ts:52`), a rampa do AC 6 volta ao centro |
| teclado | soltar a direção em alta velocidade | AC 6 - volta ao centro a 3.5 rad/s |
| áudio | queda de giro na troca | AC 24, AC 25 |

## Sources

- Pedido do usuário (2026-09-25): "curvas em alta velocidade, o carro capota. precisa ficar algo mais natural, mais proximo ao real"; "nao foque so no capotamento, mas na mecanica total"
- `.specs/STATE.md` AD-002 (Rapier raycast vehicle, feeling por parâmetros), AD-005 (vitest + Playwright), AD-006 (passo fixo 1/60 s)
- `@dimforge/rapier3d-compat` 0.21 `ray_cast_vehicle_controller.d.ts`: `frictionSlip` é o coeficiente de tração do pneu ("risk of causing the vehicle to flip if it's too strong")
