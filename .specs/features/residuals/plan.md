# residuals

## Problem

As features do sub-projeto 1 fecharam com seis resíduos anotados em `.specs/STATE.md` ("Resíduos conhecidos"). Dois se veem jogando, três são buracos de prova e um é documento errado:

- O reflexo da rua cintila quando a câmera anda. A sonda `__game.render.shimmer` com o espelho ligado mediu 2.74 % a 640×360 e 0.27 % a 1280×720 (visual-upgrade `verification.md:25`). Nenhum check mede o espelho: a C41 da visual-upgrade roda com `mirror:false` (`tests/e2e/visual.spec.ts:355`).
  - Causa lida no código: o `Reflector` de `src/world/CityScene.ts:90-100` lê um alvo de meia resolução com uma amostra bilinear por pixel, sem mip nem blur. Lâmpadas e janelas menores que um pixel serrilham no alvo, e a grade desliza com a câmera.
- O tijolo passa a C1 da facade-glint por pouco: 0.00074-0.00075 contra o limite de 0.0010. A varredura do piso de rugosidade não foi monótona. A causa medida é o `roughnessMap` do tijolo (facade-glint `checks.md:144`).
- O "R" da ré no HUD só tem teste unitário de `gearLabel` (`tests/unit/hudFormat.test.ts:15`). Nenhum teste no browser vê `#gear` mostrar `R`.
- As sondas DEV `treeVertices` e `fireflyPositions` repetem em JS as contas do GLSL, com os números escritos duas vezes (`src/world/interiors/InteriorScene.ts:504-509` e `:523-525` contra `:715-728` e `:735-752`). Trocar uma frequência só no shader não quebra teste nenhum.
- O "Cost" do `checks.md` da block-fill diz 25/2/20 provas (`.specs/features/block-fill/checks.md:239`). O STATE diz 27/2/22.
- As margens da corner-assist são estreitas: C1 +3.3 % e C4 com pico de 1.633 g contra 1.7 g. As duas medem a mesma aceleração lateral por lados opostos, então alargar uma estreita a outra.

Quando isto sair: o chão molhado reflete sem pontos piscando, o tijolo tem folga na C1, o "R" tem prova no browser, mudar o movimento das árvores e dos vagalumes quebra teste de novo, e o documento da block-fill bate com a realidade.

## Flow

Reusa a sonda de cintilação que já existe (`__game.render.shimmer`, `src/core/Game.ts:614-661`), o teste de ré de `tests/e2e/drive.spec.ts:39`, e o padrão de constante interpolada no GLSL que o `BULB_AMPLITUDE` já usa em `InteriorScene.ts`.

1. `world/CityScene` (exists): o shader do `Reflector` passa a fazer várias amostras com blur no alvo, que continua do mesmo tamanho (door 3 da visual-upgrade intacta). O `roughnessMap` do tijolo é atenuado.
2. `world/interiors/InteriorScene` (exists): frequências e amplitudes do balanço das árvores, dos vagalumes e da lâmpada viram constantes TS exportadas. O mesmo valor vai interpolado no GLSL e é lido pelas sondas.
3. `tests/e2e/visual.spec.ts` (exists) e `tests/e2e/drive.spec.ts` (exists): provas novas de cintilação com o espelho e do "R".
4. `.specs/features/block-fill/checks.md` (exists): linha do custo recontada.

## Impact

| Front | What changes |
| --- | --- |
| visual | o reflexo da rua fica mais borrado, com cara de asfalto molhado em vez de espelho. As lâmpadas refletidas viram manchas em vez de pontos |
| visual | o tijolo perde parte do contraste de rugosidade de perto. Metal, vidro e concreto não mudam |
| checks existentes | continuam valendo: visual-upgrade C4 (alvo do espelho em meia resolução), C41 (janelas estáveis) e o restante do door 3; facade-glint C1-C3 dos 4 tipos; block-fill C22 e C25 (sondas de árvore e vagalume), agora lendo as constantes compartilhadas |
| stored data | nada para migrar |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| None | - | - |

- Nothing in this change is hard to reverse. O blur, a atenuação do tijolo e as constantes são ajuste e voltam num commit. A troca que mexeria numa porta (alvo do espelho em resolução cheia, que é a door 3 da visual-upgrade) foi rejeitada: custa GPU e, medida a 1280×720, ainda deixa 0.27 %.

## Criteria

### S1: reflexo da rua estável (P1)

**Acceptance Criteria**

1. WHILE a câmera anda com o espelho da rua ligado, a 640×360, the system SHALL manter a cintilação medida por `__game.render.shimmer` com `mirror: true` abaixo de 0.010. A medida de base é 0.0274.
2. The system SHALL manter o alvo do espelho em `floor(largura × 0.5) × floor(altura × 0.5)` (visual-upgrade C4).
3. The system SHALL manter visível o brilho que o espelho soma à rua: a luminância média da área de rua com o espelho, menos a mesma área sem o espelho, SHALL ser pelo menos 0.6 × essa diferença medida antes da mudança.

**Independent test:** `npm run test:e2e -- visual` com a prova nova.

### S2: folga do tijolo na facade-glint (P2)

**Acceptance Criteria**

4. The system SHALL manter a C1 da facade-glint no tijolo (`flicker(specular) − flicker(sem specular)`, farol ligado, AA ligado) ≤ 0.0006, e nos outros 3 tipos ≤ 0.0010 como hoje.
5. The system SHALL manter a C3 da facade-glint em todos os tipos: o `litMean` com o farol ligado ≥ 1.2 × o `litMean` com ele desligado.

**Independent test:** a prova da facade-glint em `tests/e2e/visual.spec.ts`.

### S3: "R" da ré no HUD (P2)

**Acceptance Criteria**

6. WHEN o jogador segura S com o carro parado até ele andar de ré THEN the system SHALL mostrar `R` em `#gear`, e `__game.car.gear` SHALL ser -1.

**Independent test:** `tests/e2e/drive.spec.ts`, teste da ré.

### S4: sondas do miolo com uma só fonte (P2)

**Acceptance Criteria**

7. The system SHALL definir uma vez só, como constantes TS exportadas, cada frequência e amplitude do balanço de árvore, do voo de vagalume e do balanço de lâmpada. O GLSL SHALL receber esses valores por interpolação, e as sondas SHALL ler as mesmas constantes. Nenhum desses números SHALL aparecer como literal no texto do shader.
8. WHEN uma dessas constantes muda THEN the system SHALL mudar junto o movimento renderizado e a posição devolvida pela sonda. As provas C22 e C25 da block-fill SHALL continuar passando.

**Independent test:** teste unitário que lê o texto do shader montado e confere que cada constante aparece interpolada e nenhum literal antigo sobrou.

### S5: documento da block-fill (P3)

**Acceptance Criteria**

9. The system SHALL ter, na linha "Cost" de `.specs/features/block-fill/checks.md`, as contagens recontadas de provas unitárias, de física real e Playwright da block-fill. O `.specs/STATE.md` SHALL citar os mesmos números.

**Independent test:** recontar os `it(`/`test(` citados pelos checks da block-fill.

## Out of scope

| Excluded | Why |
| --- | --- |
| alargar as margens da corner-assist | C1 e C4 medem a mesma aceleração lateral por lados opostos. Alargar as duas pede um limite que muda com a velocidade, que a corner-assist deixou para o tuning de performance (sub-projeto 4, `corner-assist/plan.md:93`). Mexer agora muda a sensação do carro |
| sondas que leem a posição da GPU (transform feedback ou readback) | pegaria mudança na estrutura da fórmula, não só nos números, mas precisa de um caminho WebGL2 novo em DEV. Fica se voltar a doer |
| espelho em resolução cheia | reabre a door 3 da visual-upgrade, custa GPU e só reduz a cintilação (0.27 % ainda a 720p) |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| como estabilizar o reflexo | blur de várias amostras no shader do `Reflector`, com o alvo do mesmo tamanho | ataca a causa (uma amostra por pixel num alvo pequeno) sem mexer em porta. O reflexo fica mais "molhado" | y |
| como dar folga ao tijolo | atenuar o `roughnessMap` do tijolo na direção de 0.85; se não bastar, `normalScale` 0.25 → 0.18 | a varredura mostrou que o `roughnessMap` é a causa, e o piso de rugosidade não ajuda. Muda a cara do tijolo de perto | y |
| corner-assist | não mexer, só registrar em Out of scope | qualquer ajuste muda a sensação do carro, que o usuário aprovou | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| reflexo da rua (tela) | densidade (quanto brilho sobra) | AC 3 |
| fachada de tijolo (tela) | densidade (contraste de perto) | AC 5 |
| HUD `#gear` | estado de ré | AC 6 |
| documento `block-fill/checks.md` | o que o leitor faz a seguir | AC 9: confiar no custo para estimar a próxima feature |

## Sources

- `.specs/STATE.md` "Resíduos conhecidos" - a lista dos seis itens
- `.specs/features/visual-upgrade/verification.md:25` - medida de base da cintilação com o espelho
