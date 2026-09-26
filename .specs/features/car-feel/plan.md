# car-feel

## Problem

A car-handling deixou o carro correto nos números, mas o carro parece rígido ao dirigir. O usuário testou em 2026-09-26 e disse: "a curva fico muito dura, o balanço tem que ser melhor trabalhado". Depois apontou quatro causas:
- a carroceria quase não se mexe;
- o volante é lento ou pesado;
- a aderência é demais;
- a câmera não acompanha.

Medições no harness de física (`tests/physics`, `DEFAULT_CAR`), round 4 da car-handling:

| Situação | Hoje | Por quê |
| --- | --- | --- |
| rolagem em curva a 80 km/h, direção toda | 2.8° | suspensão dura (`SUSPENSION_STIFFNESS` 32 em `src/vehicle/Car.ts:44`), sem oscilação ao sair da curva |
| arfagem na frenagem a 100 km/h | −1.3° | idem; ao acelerar a traseira quase não abaixa |
| volante do centro ao batente (0.55 rad) | 0.22 s (2.5 rad/s) | `steerRateRadS` 2.5 |
| ângulo alvo a 100 km/h | 2.5° | `steerLateralG` 1.3 no limite por velocidade |
| aceleração lateral máxima | 1.0 g | `tireGrip` 1.05 × `rearGripFactor` 1.2 |
| sideslip máximo acelerando em curva | 5° | a traseira nunca escapa sem o freio de mão |
| câmera | horizonte sempre reto | `ChaseCamera` usa só `lookAt`, sem inclinar junto |

Quando isto sair:
- A carroceria inclina e mergulha de forma visível, e balança um pouco ao sair da curva.
- O volante responde mais rápido e o carro vira mais em alta.
- O carro tem menos aderência. A traseira escapa com freio de mão + acelerador (power slide da car-handling), não só no acelerador (ver Out of scope).
- A câmera inclina junto com o carro.
- Nada disso volta a capotar o carro.

## Flow

Reusa a ficha `CarSpec` (door 1 da car-handling), o `stepDrivetrain`, o `Car`, o harness de física e a `ChaseCamera`. É ajuste de números mais uma inclinação nova da câmera.

1. `vehicle/carSpec` (exists, estendido pela door 1 daqui) - ganha a suspensão; `DEFAULT_CAR` muda os números de direção, aderência e suspensão
2. `vehicle/drivetrain` (exists) - rampa do volante e ângulo alvo com os números novos; contrato igual
3. `vehicle/Car` (exists) - lê a suspensão da ficha em vez das constantes de `Car.ts`; expõe `bodyRoll` e `bodyPitch` como hoje
4. `camera/chaseMath` (exists) - função pura nova: inclinação da câmera a partir da rolagem do carro
5. `camera/ChaseCamera` (exists) - suaviza essa inclinação e gira a câmera em torno do eixo de visão depois do `lookAt`; `core/Game` (exists) passa `car.bodyRoll`
6. `tests/physics/` (exists, AD-011) - mede rolagem, arfagem, aderência e sideslip

## Impact

| Front | What changes |
| --- | --- |
| domain | `CarSpec` ganha `suspensionStiffness`, `suspensionCompression`, `suspensionRelaxation` (door 1). Leem: `Car` e o `tests/physics`. A garagem e o tuning (sub-projetos 3 e 4) passam a poder mexer na suspensão |
| domain | acoplamento: `suspensionStiffness` também decide o comprimento livre da mola. Em `Car`, rest length = `LOADED_SUSPENSION` + g/(4·k), com `LOADED_SUSPENSION` fixo, então a altura parada do carro é a mesma com qualquer mola. O sub-projeto 4 (tuning) precisa saber disso: trocar `k` muda a rolagem, a arfagem e quanto a roda descarregada desce, mas não baixa nem sobe o carro parado |
| checks existentes | car-handling AC 4 (rolagem 1–6°), AC 5 (arfagem −0.5 a −4°), AC 6 (rampa 2.5 / 3.5 rad/s), AC 7 (`steerLateralG` 1.3), AC 8 (≤ 1.15 g), AC 9 (≥ 0.80 g) e AC 10 (sideslip ≤ 12°, com e sem acelerador, 60 a 180 km/h) ficam **superados** pelos ACs daqui; o AC 10 daqui mantém os 10 casos. Os testes C4, C5, C6, C7, C8, C9, C10 e os valores de direção de C28 viram os checks novos, registrados na tabela de superados do `checks.md` |
| checks existentes | continuam valendo sem mudança: car-handling AC 1–3 (sem capotar, matriz de 54 casos), AC 11–25 (freio de mão, freios, motor, câmbio, HUD), C36–C38; visual-upgrade C33 (câmera desloca para a esquerda virando à esquerda) |
| stored data | nothing to migrate - nada é persistido |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside. `window.__game.camera` (só DEV) ganha os campos de leitura `roll`, `direction` (direção de visão) e `up` (o "cima" da câmera no mundo), lidos pela prova do AC 14.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. suspensão na ficha do carro | `CarSpec` ganha `suspensionStiffness: number; suspensionCompression: number; suspensionRelaxation: number` (unidades do `DynamicRayCastVehicleController` do Rapier), lidos por `Car` em `setWheelSuspensionStiffness/Compression/Relaxation` | manter as constantes em `Car.ts`: o tuning de performance (sub-projeto 4) não conseguiria trocar a suspensão sem reescrever o `Car`, que é exatamente o que a door 1 da car-handling quis evitar |

- Nothing else in this change is hard to reverse. Os números da ficha e o fator da câmera são ajuste.

## Criteria

Medido no harness (AD-011), com as mesmas definições de rolagem, arfagem, sideslip e aceleração lateral do `checks.md` da car-handling.

### S1: a carroceria balança (P1)

O carro inclina na curva, mergulha na frenagem, agacha na aceleração e balança um pouco ao sair da curva.

**Acceptance Criteria**

1. WHILE o carro faz curva em regime com a direção toda para um lado a 80 km/h the system SHALL mostrar rolagem média entre 3.5° e 6.0°, inclinando para fora da curva
2. WHEN a direção é solta depois de 3 s de curva em regime a 80 km/h THEN the system SHALL passar a rolagem para o lado oposto entre 0.3° e 1.5° em até 1.0 s, e ficar com |rolagem| < 0.5° a partir de 2.5 s
3. WHEN o freio é aplicado a 100 km/h THEN the system SHALL mergulhar a frente entre 2.0° e 5.0° no primeiro 0.5 s
4. WHEN o acelerador é pressionado a partir do repouso THEN the system SHALL levantar a frente (traseira agacha) entre 1.0° e 4.0° no primeiro 1.0 s
5. The system SHALL continuar sem capotar: a matriz de 54 casos da car-handling (AC 2 e AC 3) segue com inclinação ≤ 15° e as 4 rodas no chão em até 1.0 s após soltar

**Independent test:** `npx vitest run tests/physics/feel.test.ts tests/physics/stability.test.ts`

### S2: volante mais rápido e aderência de carro de rua (P1)

As rodas viram mais rápido, o carro vira mais em alta e gruda menos.

**Acceptance Criteria**

6. WHILE o jogador segura `A` ou `D` the system SHALL girar as rodas dianteiras em direção ao alvo a no máximo `steerRateRadS` = 4.0 rad/s e, ao soltar, voltar ao centro a no máximo `steerReturnRadS` = 5.0 rad/s
7. The system SHALL limitar o ângulo alvo a `min(steerMaxRad, atan(steerLateralG × 9.81 × wheelbaseM / v²))` com `steerLateralG` = 1.7 (`steerMaxRad` continua 0.55)
8. WHILE a direção fica toda para um lado por 3 s, em velocidade constante mantida pelo acelerador, de 60 a 180 km/h the system SHALL manter a aceleração lateral de cada janela de 0.5 s em no máximo 0.95 g
9. WHILE a direção fica toda para um lado a 60 km/h the system SHALL atingir pelo menos 0.75 g numa janela de 0.5 s dentro dos primeiros 2 s
10. WHILE a direção fica toda para um lado por 3 s, sem acelerador ou com acelerador, de 60 a 180 km/h the system SHALL manter o sideslip em no máximo 12°
(AC 11 e AC 12, traseira escapando só no acelerador, foram retirados em 2026-09-26; ver Out of scope. A numeração segue.)

**Independent test:** `npx vitest run tests/physics/feel.test.ts tests/unit/drivetrain.test.ts`

### S3: a câmera acompanha (P2)

O horizonte inclina junto com a carroceria, suavizado.

**Acceptance Criteria**

13. The system SHALL calcular a inclinação alvo da câmera como `cameraRoll(bodyRoll)` = 0.6 × `bodyRoll`, limitada a ±4°, no mesmo sentido da carroceria
14. WHILE o jogo roda the system SHALL levar a inclinação da câmera ao alvo com a mesma suavização exponencial da posição (`1 − e^(−5·dt)`), sem mudar o ponto para onde a câmera olha
15. WHEN o carro faz curva à esquerda no jogo com `W` + `A` por 2 s a partir de 60 km/h THEN the system SHALL mostrar `__game.camera.roll` com o mesmo sinal de `__game.car.bodyRoll` e |roll| ≥ 1°

**Independent test:** `npx vitest run tests/unit/chaseMath.test.ts` e `E2E_PORT=<porta> npx playwright test tests/e2e/visual.spec.ts -g "camera leans with the body"`

## Out of scope

| Excluded | Why |
| --- | --- |
| traseira escapando só no acelerador (antigos AC 11 e AC 12) | no veículo do Rapier o acelerador deixa a traseira mais estável: o círculo de atrito escala tração e força lateral juntas. Medido no build: ~2° de sideslip em 2ª a 50 km/h, contra 10° pedidos, em ~90 combinações de números. Fazer escapar exige física de pneu própria (contraria a AD-002; o protótipo levou o 0–100 a 9.5 s). Retirado pelo usuário em 2026-09-26; o power slide com freio de mão + acelerador (car-handling C36) continua |
| inclinar a câmera na arfagem (frenagem e aceleração) | não pedido; o balanço da câmera pedido é na curva. A arfagem já aparece na carroceria (AC 3, AC 4) |
| controle de tração ou estabilidade | continua fora, como na car-handling |
| modelo de pneu próprio | contradiz a AD-002 |
| ajuste pelo jogador (menu de sensibilidade) | não pedido; a ficha é o ponto de ajuste para o sub-projeto 4 |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| quanto a carroceria balança | rolagem 3.5–6° a 80 km/h e oscilação de volta 0.3–1.5° | "carroceria parada" e "rolagem na curva"; acima de ~6° parece carro de passeio mole | y |
| quanto a câmera inclina | 60 % da rolagem, até 4° | acompanha sem enjoar; 100 % faria o horizonte girar tanto quanto o carro | y |
| menos aderência | teto de 0.95 g (era 1.15) e mínimo de 0.75 g a 60 km/h | "aderência demais"; carro de rua esportivo fica em ~0.9 g | y |
| volante | 4.0 rad/s para virar (0.14 s até o batente), 5.0 para voltar, `steerLateralG` 1.7 | "volante lento/pesado"; o teclado é digital, mais rápido que isso fica nervoso | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| tela do jogo | horizonte inclinado na curva | AC 13, AC 14, AC 15 |
| tela do jogo | câmera parado ou em linha reta | AC 13 - rolagem ~0 dá inclinação ~0 |
| teclado | `A` e `D` juntos | existing - `steerAxis` devolve 0 (`src/core/input.ts:49`), a rampa volta ao centro |
| HUD | marcha, RPM, velocidade | n/a - o HUD não muda |
| áudio | motor e derrapagem | existing - `skidding` já liga pelo escorregamento lateral (car-handling AC 23), então a traseira escapando no freio de mão já faz som e marca |

## Sources

- Usuário, 2026-09-26, depois de testar o jogo: "a curva fico muito dura, o balanço tem que ser melhor trabalhado". Nas perguntas: "carroceria parada", "volante lento/pesado", "aderência demais"; balanço: "câmera acompanhar", "rolagem na curva", "arfagem"
- `.specs/features/car-handling/plan.md` e `checks.md` (ACs e checks superados), AD-002, AD-011
