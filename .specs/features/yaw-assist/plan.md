# yaw-assist

## Problem

O carro demora para virar e faz curvas largas. O usuário testou a car-feel em 2026-09-26 e disse: "carro ainda esta muito duro, demorando demais pra virar".

Medido no harness de física (`DEFAULT_CAR` da car-feel, direção toda, velocidade mantida):

| Velocidade | Giro em regime | Raio | Tempo até 90 % do giro |
| --- | --- | --- | --- |
| 40 km/h | 35°/s | 18 m | 0.60 s |
| 60 km/h | 26°/s | 37 m | 0.30 s |
| 100 km/h | 16°/s | 100 m | 0.10 s |
| 140 km/h | 11.5°/s | 194 m | 0.05 s |

A causa, medida:
- A partir de ~60 km/h a curva é limitada pela aderência (~0.8 g, `tireGrip` 0.86 da car-feel). Mexer em volante, amortecimento angular (1.2 → 0.2) ou balanço traseiro (1.25 → 1.0) muda o giro em 5–10 %.
- Só mais aderência gira mais (1.3 → raio 65 m a 100 km/h), mas com 1.5 o carro capotou a 140 km/h. E o giro em baixa continua levando ~0.6 s, que é a inércia do carro.
- O usuário escolheu a saída dos jogos arcade: uma ajuda de giro que faz o carro apontar mais rápido, com aderência moderada.

Quando isto sair, o carro aponta para a curva logo que o volante vira, faz curvas mais fechadas em qualquer velocidade e para de girar logo que o volante volta ao centro. A aderência sobe só um pouco (~1.0 g), e o carro continua sem capotar.

## Flow

Reusa a ficha `CarSpec`, o `Car` e o seu padrão de torque corretivo (`restoreRollMoment` já aplica `applyTorqueImpulse` a cada passo), o `steerTarget` do `drivetrain` e o harness de física (AD-011).

1. `vehicle/carSpec` (exists, estendido pela door 1) - ganha os 3 parâmetros da ajuda de giro; `tireGrip` sobe
2. `vehicle/yawAssist` (door 1) - puro: calcula o torque de giro a partir do ângulo das rodas, da velocidade, do giro atual e das rodas no chão
3. `vehicle/Car` (exists) - a cada passo fixo, depois do `updateVehicle`, aplica esse torque no eixo vertical do chassi com `applyTorqueImpulse`
4. `tests/physics/` (exists, AD-011) - mede giro, raio, tempo de resposta, sideslip e capotamento

## Impact

| Front | What changes |
| --- | --- |
| domain | AD-002 dizia "feeling arcade vem de parâmetros, não de física própria". Passa a admitir uma única ajuda arcade: o torque de giro desta feature. Registrado como AD-013, que substitui a AD-002 (esta fica `superseded by AD-013`) |
| domain | `CarSpec` ganha `yawAssistGain`, `yawAssistMaxNm`, `yawAssistLateralG` (door 1). O tuning (sub-projeto 4) poderá mexer neles; com `yawAssistMaxNm` 0 o carro volta a ser o da car-feel |
| checks existentes | car-feel AC 8 (≤ 0.95 g) e AC 9 (≥ 0.75 g a 60 km/h) ficam **superados** pelos ACs 5 e 6 daqui. Os testes "lateral grip never exceeds 0.95 g" e "reaches at least 0.75 g at 60 kmh" são substituídos, registrados na tabela de superados do `checks.md` |
| checks existentes | continuam valendo sem mudança: car-feel AC 1–7 e AC 10 (balanço, volante, sideslip ≤ 12° sem freio de mão), car-handling AC 1–3 (sem capotar), AC 11–22 (freio de mão, freios, motor), C36–C38; free-roam-city "A turns left"; visual-upgrade "camera swings left while turning left" |
| stored data | nothing to migrate - nada é persistido |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside. `window.__game.car` (só DEV) ganha o campo de leitura `yawAssistNm` (torque aplicado no último passo).

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. ajuda de giro arcade | `src/vehicle/yawAssist.ts` puro exporta `yawAssistTorque(spec: CarSpec, steerRad: number, forwardSpeedMs: number, yawRate: number, wheelsInContact: number, yawInertia: number): number` (N·m no eixo Y do mundo, positivo = esquerda), com alvo `r* = sign · min(|v · tan(steer) / wheelbaseM|, yawAssistLateralG · 9.81 / |v|)` e torque `clamp(yawAssistGain · yawInertia · (r* − yawRate), ±yawAssistMaxNm)`, zero com `|v|` < 2 m/s ou menos de 2 rodas no chão. `CarSpec` ganha `yawAssistGain: number; yawAssistMaxNm: number; yawAssistLateralG: number`. Registrado como AD-013 | só aderência mais alta: o giro em baixa continua levando ~0.6 s e acima de ~1.3 de aderência o carro volta a capotar; e modelo de pneu próprio (círculo de atrito), que a car-feel mediu mudando aceleração e arfagem juntas |

- Nothing else in this change is hard to reverse. Os números da ficha são ajuste.

## Criteria

Medido no harness (AD-011), direção toda para a esquerda (`steer +1`), acelerador ligado sempre que a velocidade está abaixo da inicial. "Giro em regime" é a média do giro (|angvel.y|) dos passos 120–180.

### S1: o carro aponta rápido e vira mais (P1)

**Acceptance Criteria**

1. WHEN a direção vai toda para um lado a 40 km/h THEN the system SHALL atingir 90 % do giro em regime em até 0.25 s
2. WHILE a direção fica toda para um lado a 60 km/h the system SHALL manter giro em regime de pelo menos 32°/s (raio ≤ 30 m)
3. WHILE a direção fica toda para um lado a 100 km/h the system SHALL manter giro em regime de pelo menos 20°/s (raio ≤ 80 m)
4. WHEN a direção volta ao centro depois de 3 s de curva a 100 km/h THEN the system SHALL levar o giro abaixo de 3°/s em até 0.8 s
5. WHILE a direção fica toda para um lado por 3 s de 60 a 180 km/h the system SHALL manter a aceleração lateral de cada janela de 0.5 s em no máximo 1.05 g
6. WHILE a direção fica toda para um lado a 60 km/h the system SHALL atingir pelo menos 0.85 g numa janela de 0.5 s dentro dos primeiros 2 s

**Independent test:** `npx vitest run tests/physics/agility.test.ts`

### S2: a ajuda é contida (P1)

**Acceptance Criteria**

7. The system SHALL calcular o torque da ajuda pela fórmula da door 1, e SHALL aplicar zero com velocidade dianteira abaixo de 2 m/s ou com menos de 2 rodas no chão
8. The system SHALL continuar sem capotar: a matriz de 54 casos da car-handling (AC 2 e AC 3) segue com inclinação ≤ 15° e as 4 rodas no chão em até 1.0 s após soltar
9. The system SHALL continuar saindo de frente sem freio de mão: o sideslip da car-feel AC 10 (10 casos, 60 a 180 km/h, com e sem acelerador) segue ≤ 12°
10. The system SHALL manter o freio de mão como está: car-handling AC 11 e AC 12 (sideslip > 20° em até 1.5 s e recuperação abaixo de 8° em até 2.5 s) e o power slide com acelerador (car-handling C36)
11. The system SHALL manter aceleração, velocidade máxima e frenagem da car-handling (AC 18–22)

**Independent test:** `npx vitest run tests/unit/yawAssist.test.ts tests/physics/stability.test.ts tests/physics/grip.test.ts tests/physics/feel.test.ts tests/physics/powertrain.test.ts`

## Out of scope

| Excluded | Why |
| --- | --- |
| suavização da câmera (0.2 s) | não pedido; a câmera segue o carro, e o carro passa a girar mais rápido |
| ajuda diferente por modo (drift, drag) | modos são o sub-projeto 6 |
| controle de estabilidade que evita rodar | a ajuda leva o giro ao alvo nos dois sentidos, então já freia o giro ao soltar (AC 4); ESC completo continua fora, como na car-handling |
| menu para ligar/desligar a ajuda | não pedido; `yawAssistMaxNm` 0 na ficha desliga para o tuning |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| quanto mais rápido | 90 % do giro em ≤ 0.25 s a 40 km/h (hoje 0.60 s) | resposta de jogo arcade sem virar instantâneo, que parece sem peso | y |
| quanto mais fechado | ≥ 32°/s a 60 km/h e ≥ 20°/s a 100 km/h (hoje 26 e 16) | ~25 % mais curva; o usuário disse "demorando demais pra virar" | y |
| aderência | teto de 1.05 g, mínimo de 0.85 g a 60 km/h (hoje 0.95 e 0.75) | a opção escolhida falava em aderência moderada ~1.0 g | y |
| giro alvo da ajuda | limitado a `yawAssistLateralG` ~1.1 g, pouco acima da aderência | o carro aponta um pouco mais do que a trajetória, sensação de NFS, sem rodar | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| teclado | `A`/`D` em baixa e em alta | AC 1–3 |
| teclado | soltar a direção | AC 4 |
| teclado | freio de mão | AC 10 |
| tela do jogo | carro parado ou no ar (pulo de morro) | AC 7 - sem ajuda abaixo de 2 m/s ou com menos de 2 rodas no chão |
| HUD, áudio | nada muda | n/a - a ajuda só gira o chassi |

## Sources

- Usuário, 2026-09-26: "carro ainda esta muito duro, demorando demais pra virar"; escolheu "Assistência de giro arcade"
- Medições do harness em `6dba1c6` (tabela do Problem); `.specs/STATE.md` AD-002, AD-011
