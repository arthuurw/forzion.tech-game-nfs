# corner-assist

## Problem

Em velocidade, o carro faz curvas largas demais. O usuário testou a yaw-assist em 2026-09-26: "o carro ainda está duro. melhorou, mas segue ruim pra virar, principalmente em velocidade".

Medido no harness de física (`DEFAULT_CAR` da yaw-assist, direção toda, velocidade mantida):

| Velocidade | Giro em regime | Raio |
| --- | --- | --- |
| 60 km/h | 35°/s | 27 m |
| 100 km/h | 21°/s | 77 m |
| 140 km/h | 15°/s | 150 m |

A causa, medida:
- Em velocidade, o raio é dado pela aderência lateral (~1.0 g): `R = v² / a`. A ajuda de giro só faz o carro apontar; mais giro sem mais aderência faz o carro rodar (sideslip de 55° a 60 km/h com `yawAssistLateralG` 1.8).
- Mais aderência tomba o carro: com `tireGrip` 1.2 o zigue-zague a 200 km/h inclina 25–28° (limite 15°); com 1.4 o carro capota. O pneu empurra no chão, abaixo do centro de massa, e isso gera o momento que tomba.
- O usuário escolheu a saída arcade: uma força que puxa o carro para dentro da curva pelo centro de massa. Força pelo centro de massa não gera momento de tombamento.

Quando isto sair, o carro faz curvas bem mais fechadas em alta (raio ~48 m a 100 km/h, ~95 m a 140 km/h), sem capotar, sem inclinar mais que hoje e sem rodar. O freio de mão continua derrapando como hoje.

## Flow

Reusa a ficha `CarSpec`, o `Car` com o seu padrão de impulso por passo (`restoreRollMoment`, `applyYawAssist`), o ângulo das rodas do `drivetrain` e o harness de física (AD-011).

1. `vehicle/carSpec` (exists, estendido pela door 1) - ganha os 2 parâmetros da força de curva; `yawAssistLateralG` sobe para o carro apontar junto com a trajetória mais fechada
2. `vehicle/cornerAssist` (door 1) - puro: calcula a força lateral a partir do ângulo das rodas, da velocidade, das rodas no chão e do freio de mão
3. `vehicle/Car` (exists) - a cada passo fixo, junto da ajuda de giro, aplica essa força no centro de massa, na horizontal e perpendicular à velocidade, com `applyImpulse`
4. `tests/physics/` (exists, AD-011) - mede raio, giro, aceleração lateral, sideslip, rolagem e capotamento

## Impact

| Front | What changes |
| --- | --- |
| domain | AD-013 admitia uma única ajuda arcade (o torque de giro). Passa a admitir duas: o torque de giro e a força de curva desta feature. Registrado como AD-014, que substitui a AD-013 |
| domain | `CarSpec` ganha `cornerAssistStartG` e `cornerAssistMaxG` (door 1). Com `cornerAssistMaxG` = `cornerAssistStartG` a força some e o carro volta a ser o da yaw-assist |
| checks existentes | yaw-assist AC 5 (≤ 1.05 g) fica **superado** pelo AC 4 daqui (a aceleração lateral agora vai até ~1.6 g por projeto). O teste "lateral grip never exceeds 1.05 g" é substituído e registrado na tabela de superados do `checks.md` |
| checks existentes | continuam valendo: yaw-assist AC 1–4, 6–11 (resposta, giro mínimo, soltar, ajuda contida); car-feel AC 1–4 (rolagem 3.5–6°, balanço, arfagem), AC 6, AC 7, AC 10 (sideslip ≤ 12°); car-handling AC 1–3 (sem capotar), AC 11–22 (freio de mão, freios, motor), C36 |
| stored data | nothing to migrate - nada é persistido |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside. `window.__game.car` (só DEV) ganha o campo de leitura `cornerAssistN` (força aplicada no último passo, positivo = esquerda do carro).

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. força de curva arcade | `src/vehicle/cornerAssist.ts` puro exporta `cornerAssistForce(spec: CarSpec, steerRad: number, forwardSpeedMs: number, wheelsInContact: number, handbrake: boolean): number` (N, positivo = para a esquerda do carro), com aceleração pedida `a = v² · tan(steer) / wheelbaseM` e força `sign(a) · massKg · clamp(|a| − cornerAssistStartG · 9.81, 0, (cornerAssistMaxG − cornerAssistStartG) · 9.81)`; zero com `|v|` < 5 m/s, menos de 2 rodas no chão ou freio de mão puxado. O `Car` aplica na horizontal, perpendicular à velocidade, no centro de massa. `CarSpec` ganha `cornerAssistStartG: number; cornerAssistMaxG: number`. Registrado como AD-014 | mais aderência com centro de massa mais baixo: muda o balanço da carroceria aprovado na car-feel e ainda tomba (a força do pneu age no chão); e força aplicada no chão ou nas rodas, que gera o mesmo momento de tombamento do pneu |

- Nothing else in this change is hard to reverse. Os números da ficha são ajuste.

## Criteria

Medido no harness (AD-011), direção toda para a esquerda (`steer +1`), acelerador ligado sempre que a velocidade está abaixo da inicial. "Giro em regime" é a média do giro (|angvel.y|) dos passos 120–180; raio = velocidade / giro.

### S1: curvas fechadas em velocidade (P1)

**Acceptance Criteria**

1. WHILE a direção fica toda para um lado a 100 km/h the system SHALL manter giro em regime de pelo menos 31.8°/s (raio ≤ 50 m)
2. WHILE a direção fica toda para um lado a 140 km/h the system SHALL manter giro em regime de pelo menos 22.3°/s (raio ≤ 100 m)
3. WHILE a direção fica toda para um lado a 60 km/h the system SHALL manter giro em regime de pelo menos 35°/s (não piora em baixa)
4. WHILE a direção fica toda para um lado por 3 s de 60 a 180 km/h the system SHALL manter a aceleração lateral de cada janela de 0.5 s em no máximo 1.7 g
5. WHEN a direção volta ao centro depois de 3 s de curva a 100 km/h THEN the system SHALL levar a aceleração lateral (janela de 0.5 s) abaixo de 0.15 g em até 1.0 s

**Independent test:** `npx vitest run tests/physics/cornering.test.ts`

### S2: a força não estraga o resto (P1)

**Acceptance Criteria**

6. The system SHALL calcular a força pela fórmula da door 1, e SHALL aplicar zero com velocidade abaixo de 5 m/s, com menos de 2 rodas no chão ou com o freio de mão puxado
7. The system SHALL continuar sem capotar: a matriz de 54 casos da car-handling (AC 2 e AC 3) segue com inclinação ≤ 15° e as 4 rodas no chão em até 1.0 s após soltar
8. The system SHALL manter a rolagem da car-feel (AC 1: 3.5–6° a 80 km/h, AC 2: balanço de volta) e a arfagem (AC 3, AC 4)
9. The system SHALL continuar saindo de frente sem freio de mão: o sideslip da car-feel AC 10 (10 casos) segue ≤ 12°
10. The system SHALL manter o freio de mão, o power slide e a frenagem com direção: car-handling AC 11, AC 12, AC 13 e C36
11. The system SHALL manter as metas da yaw-assist que continuam valendo: AC 1 (aponta em ≤ 0.25 s a 40 km/h), AC 4 (para de girar em ≤ 0.8 s) e AC 6 (≥ 0.85 g a 60 km/h)
12. The system SHALL manter aceleração, velocidade máxima e frenagem da car-handling (AC 18–22)

**Independent test:** `npx vitest run tests/unit/cornerAssist.test.ts tests/physics/`

## Out of scope

| Excluded | Why |
| --- | --- |
| força de curva durante o freio de mão | o freio de mão tem que derrapar (car-handling AC 11); a força seguraria o carro na trajetória |
| mudar a câmera | a câmera segue o carro; não pedido |
| ajuste por velocidade diferente do teto em g | um teto em g já dá raio proporcional a v²; curvas por faixa de velocidade são tuning (sub-projeto 4) |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| quanto mais fechado | raio ≤ 50 m a 100 km/h e ≤ 100 m a 140 km/h (hoje 77 e 150), teto de 1.7 g | opção escolhida: "~1.6 g no total, raio a 100 km/h ~48 m, a 140 km/h ~95 m" | y |
| quando a força entra | a partir de ~0.9 g pedidos pelo volante (`cornerAssistStartG`), para o pneu fazer a curva leve sozinho | curvas suaves continuam com o feeling da car-feel; a força só aparece perto do limite | y |
| giro acompanha | `yawAssistLateralG` sobe junto (~1.7) para o carro apontar na trajetória nova | sem isso a frente do carro fica atrás da trajetória (o carro anda de lado para dentro) | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| teclado | `A`/`D` em alta | AC 1, AC 2, AC 4 |
| teclado | `A`/`D` em baixa | AC 3 |
| teclado | soltar a direção | AC 5 |
| teclado | freio de mão | AC 6, AC 10 |
| tela do jogo | carro no ar ou parado | AC 6 - sem força com menos de 2 rodas no chão ou abaixo de 5 m/s |
| HUD, áudio | nada muda | n/a - a força só puxa o chassi |

## Sources

- Usuário, 2026-09-26: "o carro ainda está duro. melhorou, mas segue ruim pra virar, principalmente em velocidade"; escolheu "Força de curva arcade"
- Medições do harness em `6ecb5b7` (tabela do Problem); `.specs/STATE.md` AD-011, AD-013
