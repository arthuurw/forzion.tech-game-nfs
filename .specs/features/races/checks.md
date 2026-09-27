# races checks

Profile: standard
Plan: `.specs/features/races/plan.md`

36 checks in 5 slices · 3 one-way doors · 0 open, of which 0 block

Comandos: `npx vitest run <arquivo> -t "<nome>"` (unitários e `tests/physics`, AD-011) e `npx playwright test <arquivo> -g "<nome>"` (browser, AD-005). Seed de todas as provas: 1337 (`DEFAULT_SEED`).

## Checks

### S1 - corridas na cidade e largada · 10 files · 150 KB · ~38k

**C1** - ✅ `generateRaces(network)` do seed 1337 devolve exatamente 4 corridas, nesta ordem e com estes campos (AC 1, door 1):
- `circuito-centro`: `circuit`, 2 voltas;
- `circuito-anel`: `circuit`, 1 volta;
- `sprint-cruzada`: `sprint`, 1 volta;
- `sprint-morro`: `sprint`, 1 volta.

Cada uma tem `name` não vazio, `route.points` com comprimento múltiplo de 3, `gates` não vazio, 4 `grid` e `marker.radius` = 10.
Proof: `npx vitest run tests/unit/raceRoutes.test.ts -t "generates the four races of seed 1337"`

**C2** - ✅ O traçado de cada corrida segue a regra dela (AC 1). O quadrado das avenidas, na C2 e na C5, é o de x ≈ ±300 e z ≈ ±300:
- `circuito-centro`: todo ponto está a no máximo 40 m de uma das retas x = ±300 ou z = ±300, com |x| ≤ 340 e |z| ≤ 340, e o traçado passa a no máximo 40 m de cada um dos 4 cantos (±300, ±300).
- `circuito-anel`: todo ponto está a no máximo 1 m de um ponto da estrada `highway`.
- `sprint-cruzada`: o primeiro ponto fica a no máximo 20 m da ponta oeste (menor x) da avenida ao longo de x com z médio mais perto de 0, e o último a no máximo 20 m da ponta com z > 0 da avenida ao longo de z com x médio mais perto de 0. Algum ponto fica a no máximo 30 m de (0, 0).
- `sprint-morro`: o primeiro e o último ponto estão a no máximo 2 m do primeiro e do último ponto da estrada `hill` mais longa.

Proof: `npx vitest run tests/unit/raceRoutes.test.ts -t "each route follows its rule"`

**C3** - ✅ Duas chamadas de `generateRaces` sobre redes geradas do mesmo seed dão corridas iguais: `toEqual` sobre ids, pontos, portões, grid e marcador (AC 1)
Proof: `npx vitest run tests/unit/raceRoutes.test.ts -t "same seed same races"`

**C4** - ✅ Em cada uma das 4 corridas (AC 2):
- pontos consecutivos do traçado estão a no máximo 4.0 m um do outro na horizontal;
- cada ponto está a no máximo meia largura de um ponto de alguma estrada da rede;
- nos 2 circuitos, o último ponto está a no máximo 4.0 m do primeiro.

Proof: `npx vitest run tests/unit/raceRoutes.test.ts -t "routes are continuous and on the asphalt"`

**C5** - ✅ `route.length` (uma volta, no circuito) fica nestas faixas, com os limites incluídos e tolerância de ±0.01 m em cada limite, para o erro de float32 dos pontos das estradas (renegociado com o usuário em 2026-09-27: o morro mede 3000.000004 m) (AC 3):

| Corrida | Faixa (m) |
| --- | --- |
| `circuito-centro` | 2200-2700 |
| `circuito-anel` | 6200-6400 |
| `sprint-cruzada` | 1800-2300 |
| `sprint-morro` | 2800-3000 |

`route.length` bate com a soma das distâncias horizontais entre pontos consecutivos (fechando o laço no circuito), com erro ≤ 1 m.
Proof: `npx vitest run tests/unit/raceRoutes.test.ts -t "route lengths within bands"`

**C6** - ✅ Portões de cada corrida (AC 4):
- `s` é crescente, e a distância ao longo do traçado entre dois portões consecutivos, e do começo ao primeiro, é ≤ 250 m;
- `halfWidth` = meia largura da estrada sob o portão + 4 m, com erro ≤ 0.01;
- no sprint, o último portão fica a no máximo 4 m do último ponto do traçado;
- no circuito, o último portão fica a no máximo 4 m do primeiro ponto do traçado (a linha de largada/chegada).

Proof: `npx vitest run tests/unit/raceRoutes.test.ts -t "gates spaced and sized"`

**C7** - ✅ Grid de cada corrida (AC 5):
- 4 lugares;
- cada um a no máximo (meia largura da estrada − 1 m) do ponto de estrada mais próximo;
- cada um entre 6 e 24 m antes da linha de largada ao longo do traçado;
- os 6 pares a pelo menos 5 m um do outro;
- `heading` a no máximo 5° da direção do traçado ali.

Proof: `npx vitest run tests/unit/raceRoutes.test.ts -t "grid slots on the asphalt behind the start line"`

**C8** - ✅ Numa rede sem estrada `hill` (a do seed 1337 sem as estradas de morro), `generateRaces` devolve só as outras 3, na mesma ordem, e chama `console.warn` uma vez com um texto que começa por `race sprint-morro skipped:` (AC 6)
Proof: `npx vitest run tests/unit/raceRoutes.test.ts -t "missing road skips only that race"`

**C9** - ✅ No free roam, `__game.race.markers` lista 4 marcadores visíveis, cada um com raio 10 m e centro igual a `marker` da corrida. No minimapa, a função pura de ícones devolve um ícone para cada marcador dentro da janela de 320 m e nenhum para os de fora. Com o carro a 50 m de um marcador, o pixel do minimapa na posição do ícone tem a cor do ícone (L-002) (AC 7)
Proof: `npx vitest run tests/unit/minimap.test.ts -t "race marker icons inside the window only"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "markers visible in free roam and on the minimap"`

**C10** - ✅ Prompt de largada (AC 8). Regra pura `promptFor`:
- centro a 10.0 m e 29.9 km/h: mostra o prompt;
- 10.01 m: não mostra;
- 30.0 km/h: não mostra;
- dois marcadores dentro do raio: vale o mais perto.

No browser, parado a 5 m do marcador de `circuito-centro`, `#race-prompt` fica visível com o texto `ENTER · <nome>`. A 15 m, fica escondido.
Proof: `npx vitest run tests/unit/raceSession.test.ts -t "prompt only within 10 m below 30 kmh"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "prompt appears at the marker"`

**C11** - ✅ Enter com o prompt visível (AC 9):
- `__game.race.state` = `countdown`;
- o jogador fica a no máximo 0.5 m do lugar 3 do grid, com velocidade < 1 km/h;
- 3 oponentes, cada um a no máximo 0.5 m dos lugares 0, 1 e 2;
- o número de corpos rígidos do mundo sobe exatamente 3.

Proof: `npx playwright test tests/e2e/race.spec.ts -g "enter at the marker starts the countdown on the grid"`

**C12** - ✅ Enter sem prompt (a 100 m de qualquer marcador): o estado continua `free`, o número de corpos rígidos não muda e o carro não sai do lugar (≤ 0.5 m) (AC 10)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "enter away from markers does nothing"`

**C13** - ✅ Contagem (AC 11). A sessão pura mostra:

| Tempo desde a largada | Texto |
| --- | --- |
| 0.00-0.99 s | `3` |
| 1.00-1.99 s | `2` |
| 2.00-2.99 s | `1` |
| 3.00 s | `GO`, estado `racing`, relógio 0 |

O `DriveInput` que a sessão entrega aos carros durante a contagem é freio, sem acelerador e sem volante. No browser, segurando W durante toda a contagem, os 4 carros ficam < 1 km/h até o GO, e `#race-countdown` mostra `3` logo depois do Enter.
Proof: `npx vitest run tests/unit/raceSession.test.ts -t "countdown 3 2 1 GO then racing"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "countdown holds every car"`

### S2 - portões, relógio, voltas e chegada · 6 files · 90 KB · ~22k

**C14** - ✅ Durante `racing`, exatamente 1 malha de portão está visível, centrada a no máximo 0.5 m do próximo portão do jogador e com altura 4 m. A função de minimapa inclui esse portão, e só ele (AC 12)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "only the next gate is shown"`
Proof: `npx vitest run tests/unit/minimap.test.ts -t "next gate on the minimap"`

**C15** - ✅ Cruzamento de portão, `raceProgress` puro (AC 13). Um passo que:
- cruza o segmento do próximo portão para a frente, dentro de `halfWidth`: avança 1;
- cruza a 0.1 m fora de `halfWidth`: não avança;
- cruza o portão seguinte ao próximo: não avança;
- cruza o próximo portão para trás: não avança;
- não chega a cruzar (para 0.1 m antes): não avança.

Proof: `npx vitest run tests/unit/raceProgress.test.ts -t "gate crossing rules"`

**C16** - ✅ Relógio (AC 14):
- depois de N passos de 1/60 s em `racing`, o tempo é N/60, com erro ≤ 1e-9;
- `formatRaceTime` dá `0:00.00` para 0, `1:01.23` para 61.239 e `9:59.99` para 599.999 (centésimos truncados).

No browser, o texto de `#race-time` é igual a `formatRaceTime(__game.race.time)` lido no mesmo quadro.
Proof: `npx vitest run tests/unit/raceProgress.test.ts -t "clock sums fixed steps and formats m:ss.cc"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "hud shows time lap and position"`

**C17** - ✅ Voltas (AC 15):
- num circuito de 2 voltas, cruzar a linha de largada/chegada antes dos outros portões da volta não soma volta;
- depois de todos, soma 1;
- `lapLabel` dá `VOLTA 1/2` na primeira volta e `VOLTA 2/2` na segunda.

No browser, em `circuito-centro`, `#race-lap` mostra `VOLTA 1/2` depois do GO.
Proof: `npx vitest run tests/unit/raceProgress.test.ts -t "lap counts only after every gate"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "hud shows time lap and position"`

**C18** - ✅ Chegada (AC 16):
- cruzar o último portão da última volta marca o racer como terminado e congela o tempo (mais 60 passos não o mudam);
- quando é o jogador, a sessão vai para `finished`.

No browser, levando o jogador portão a portão pela sonda DEV em `sprint-cruzada`, o estado vira `finished` e `#race-results` fica visível.
Proof: `npx vitest run tests/unit/raceSession.test.ts -t "player finish freezes time and finishes the session"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "finishing a sprint shows the results"`

**C19** - ✅ Durante `racing`, `#race-pos` mostra `POS p/4`, com `p` = posição do jogador na ordem da C27 (AC 17)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "hud shows time lap and position"`

### S3 - oponentes · 7 files · 120 KB · ~30k

**C20** - ✅ O oponente só recebe `DriveInput`, e nenhuma outra ação fora do reset (AC 18, door 2). Em node, no mundo real, um oponente corre 20 s de `sprint-cruzada`, gravando o `DriveInput` de cada passo. Um `Car` novo, num mundo novo igual, recebe a mesma sequência pelo `fixedUpdate`. A posição dos dois fica igual passo a passo (erro ≤ 1e-4 m) e a orientação também (erro ≤ 1e-4 no quaternion).
Proof: `npx vitest run tests/physics/raceAi.test.ts -t "ai is driven only through DriveInput"`

**C21** - ✅ Oponentes (AC 19):
- habilidade `[0.80, 0.88, 0.95]` e deslocamento lateral `[-3, 0, 3]` m para os oponentes 0, 1 e 2;
- 3 cores diferentes entre si e de `#ff4d1a`;
- no browser, a cor da carroceria de cada oponente é a do oponente;
- `aiDrive` com habilidade maior dá uma velocidade-alvo maior na mesma curva (raio 50 m: 0.95 > 0.88 > 0.80).

Proof: `npx vitest run tests/unit/aiDriver.test.ts -t "skills offsets and paints"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "opponents wear their own paint"`

**C22** - ✅ Em node, no mundo físico real do seed 1337, cada oponente (habilidade 0.80, 0.88 e 0.95) corre sozinho cada uma das 4 corridas (12 corridas no total). Em cada uma (AC 20):
- termina antes de 420 s de simulação;
- tem no máximo 1 reset de travado;
- na mesma corrida, os tempos caem com a habilidade: t(0.95) < t(0.88) < t(0.80).

Proof: `npx vitest run tests/physics/raceAi.test.ts -t "each opponent finishes every race in time"`

**C23** - ✅ Reset de travado (AC 21). Detector puro:
- andou 4.9 m em 4 s: dispara;
- andou 5.1 m: não dispara;
- chassi em y = -1.51: dispara;
- y = -1.49: não dispara.

O alvo do reset é o último portão cruzado, ou o lugar do oponente no grid se ele ainda não cruzou nenhum. Em node, um oponente preso contra uma parede de collider fixo é posto parado (< 1 km/h), a no máximo 0.5 m do alvo e com heading a no máximo 5° do traçado, até 4.1 s depois de parar.
Proof: `npx vitest run tests/unit/aiDriver.test.ts -t "stuck detector thresholds and target"`
Proof: `npx vitest run tests/physics/raceAi.test.ts -t "stuck opponent is reset to its last gate"`

**C24** - ✅ Minimapa (AC 22):
- a função pura devolve um ponto por oponente dentro da janela, com a cor dele, e nenhum para quem está fora;
- no browser, durante `racing`, o pixel do minimapa na posição de cada oponente visível tem a cor dele.

Proof: `npx vitest run tests/unit/minimap.test.ts -t "opponent dots in their paint"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "opponents on the minimap"`

**C25** - ✅ Tirar um `Car` do mundo (AC 23). Em node, depois de `dispose`, voltam ao valor de antes do `new Car`:
- o número de corpos rígidos;
- o número de colliders;
- o número de controladores de veículo;
- `mesh.parent` = null.

No browser, depois de fechar o resultado e depois de abandonar, o número de corpos rígidos do mundo e o de malhas de carro na cena (`car`) voltam ao valor de antes da largada (renegociado com o usuário em 2026-09-27: os filhos da cena mudam com o streaming de chunks).
Proof: `npx vitest run tests/physics/raceAi.test.ts -t "car dispose removes body collider controller and mesh"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "abort with escape returns to free roam"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "enter on the results returns to free roam"`

### S4 - posição e resultado · 4 files · 70 KB · ~17k

**C26** - ✅ Ordem dos racers, `standings` puro, com um caso para cada chave, em que só ela decide (AC 24):
- dois terminados: o de menor tempo na frente;
- um terminado na frente de um não terminado, mesmo com volta maior;
- volta 2 na frente de volta 1;
- mesma volta: próximo portão 7 na frente de 5;
- mesma volta e mesmo portão: 12 m do portão na frente de 30 m.

Proof: `npx vitest run tests/unit/raceProgress.test.ts -t "standings order by finish lap gate distance"`

**C27** - ✅ Resultado, `resultRows` puro (AC 25):
- 4 linhas na ordem da C26;
- cada linha com posição 1-4, nome (`VOCÊ` para o jogador) e tempo `m:ss.cc`, ou `--:--.--` para quem não terminou.

No browser, `#race-results` tem 4 linhas, e a linha do jogador tem `VOCÊ`.
Proof: `npx vitest run tests/unit/raceProgress.test.ts -t "result rows with times and dashes"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "finishing a sprint shows the results"`

**C28** - ✅ Enter com o resultado na tela (AC 26):
- o estado vira `free`;
- o carro do jogador fica a no máximo 0.5 m de onde estava;
- `#race-panel` e `#race-results` ficam escondidos;
- vale a C25.

Proof: `npx playwright test tests/e2e/race.spec.ts -g "enter on the results returns to free roam"`

### S5 - reset, abandono e free roam intacto · 5 files · 80 KB · ~20k

**C29** - ✅ R em `countdown` ou `racing` (AC 27):
- sem portão cruzado, põe o jogador parado (< 1 km/h) a no máximo 0.5 m do lugar 3 do grid;
- depois de cruzar o portão k, a no máximo 0.5 m do portão k, com heading a no máximo 5° do traçado;
- o relógio não volta.

A regra pura de alvo cobre os dois casos.
Proof: `npx vitest run tests/unit/raceSession.test.ts -t "reset target is last gate or grid slot"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "r returns to the last gate during a race"`

**C30** - ✅ Em `racing`, com o jogador teleportado para 3 m abaixo da água depois de cruzar o portão 1, ele volta a no máximo 0.5 m do portão 1, e não ao ponto de estrada mais próximo. `__game.waterResets` não muda (AC 28)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "water during a race returns to the last gate"`

**C31** - ✅ Escape em `countdown` e Escape em `racing` (AC 29):
- o estado vira `free`;
- `#race-panel` fica escondido;
- `#race-results` nunca aparece;
- vale a C25.

Proof: `npx playwright test tests/e2e/race.spec.ts -g "abort with escape returns to free roam"`

**C32** - ✅ Transições da sessão, puras (AC 30, AC 29, AC 26):

| Estado | Enter | Escape |
| --- | --- | --- |
| `free` com prompt | `countdown` | nada |
| `free` sem prompt | nada | nada |
| `countdown` | nada | `free` |
| `racing` | nada | `free` |
| `finished` | `free` | nada |

No browser, em `countdown` e em `racing`, os 4 marcadores e o prompt ficam escondidos.
Proof: `npx vitest run tests/unit/raceSession.test.ts -t "session transitions on enter and escape"`
Proof: `npx playwright test tests/e2e/race.spec.ts -g "markers hidden during a race"`

**C33** - ✅ No free roam, R e o reset na água continuam como hoje (AC 31). As provas existentes da free-roam-city e da city-terrain continuam verdes: R desvira no lugar, e a água leva ao ponto de estrada mais próximo.
Proof: `npx playwright test tests/e2e/drive.spec.ts tests/e2e/world.spec.ts -g "reset puts car upright|falling in the water respawns on the nearest road"`

**C34** - ✅ Em `racing` com os 3 oponentes, no grid de `circuito-centro` logo depois do GO (os 4 carros perto da câmera, o pior caso), `__game.render.calls` ≤ 220 (AC 32)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "draw calls within budget while racing"`

**C35** - ✅ `src/race/raceRoutes.ts`, `raceProgress.ts`, `raceSession.ts` e `aiDriver.ts` estão na lista de módulos puros e não importam `three` nem `@dimforge/rapier3d-compat` (convenção AD-004)
Proof: `npx vitest run tests/unit/purity.test.ts -t "pure modules"`

**C36** - ✅ O jogador também só dirige pelo `DriveInput` do teclado fora da contagem: em `racing`, segurar W por 2 s de simulação leva o jogador a > 20 km/h (a sessão não trava o input depois do GO) (AC 11, AC 18)
Proof: `npx playwright test tests/e2e/race.spec.ts -g "player drives after go"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| corridas (4) | `circuito-centro` C1, C2, C5 · `circuito-anel` C1, C2, C5 · `sprint-cruzada` C1, C2, C5 · `sprint-morro` C1, C2, C5 | - |
| tipos de corrida (2) | `circuit` C4, C6, C17 · `sprint` C6, C18 | - |
| estados da sessão (4) | `free` C12, C32 · `countdown` C11, C13 · `racing` C13, C19 · `finished` C18, C28 | - |
| transições da sessão (6) | free→countdown C11, C32 · countdown→racing C13 · racing→finished C18 · finished→free C28, C32 · countdown→free C31, C32 · racing→free C31, C32 | - |
| teclas ignoradas por estado (5) | Enter em free sem prompt C12, C32 · Enter em countdown C32 · Enter em racing C32 · Escape em free C32 · Escape em finished C32 | - |
| casos de cruzamento de portão (5) | para a frente dentro C15 · fora da meia largura C15 · portão errado C15 · de ré C15 · sem cruzar C15 | - |
| chaves da ordem (4) | tempo de chegada C26 · volta C26 · portão C26 · distância C26 | - |
| oponentes (3) | habilidade 0.80 C21, C22 · 0.88 C21, C22 · 0.95 C21, C22 | - |
| gatilhos de travado (2) | sem progresso C23 · água C23 | - |
| alvos de reset (2) | último portão C23, C29 · lugar do grid C23, C29 | - |
| partes tiradas do mundo (4) | corpo C25 · collider C25 · controlador C25 · malha C25 | - |
| saídas da corrida que tiram os oponentes (2) | resultado fechado C25, C28 · abandono C25, C31 | - |
| elementos do HUD de corrida (6) | `#race-prompt` C10 · `#race-countdown` C13 · `#race-time` C16 · `#race-lap` C17 · `#race-pos` C19 · `#race-results` C18, C27 | - |
| desenhos no minimapa (3) | marcador C9 · próximo portão C14 · oponente C24 | - |
| limites do prompt (4 bordas) | 10.0 m C10 · 10.01 m C10 · 29.9 km/h C10 · 30.0 km/h C10 | - |
| doors (3) | `RaceDef` C1-C8 · IA só por `DriveInput` C20 · relógio de passos fixos C16 | - |

- Claims que citam elemento de tela: C9-C11, C13, C14, C16-C19, C27, C28, C31, C32. Cada um tem uma prova Playwright que lê o DOM ou o canvas.
- C22 cobre 12 combinações (4 corridas × 3 habilidades) num teste por tabela. O tamanho está na própria asserção.

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decide, alcançado pela fronteira (`raceRoutes`, `raceProgress`, `raceSession`, `aiDriver`) | uma na própria camada (vitest) **e** uma na fronteira (Playwright ou `tests/physics` com o mundo real) | um caso por linha de cada tabela de decisão na própria camada; o contrato na fronteira |
| Cola no `Game`, `Hud` e `Minimap` que só repassa estado | nenhuma própria | coberta pelas provas Playwright do consumidor |
| `Car.dispose` e a cor no construtor | uma em `tests/physics` com o Rapier real | cada parte tirada do mundo (L-009: ler de volta do Rapier) |

Evidence:
- `raceProgress`: cruzamento (5 casos), voltas, relógio e ordem (4 chaves). Decide.
- `raceSession`: 5 estados × 2 teclas, contagem e alvo de reset. Decide.
- `raceRoutes`: 4 regras de corrida, portões e grid. Decide, lido no boot pelo `Game`.
- `aiDriver`: volante, acelerador e freio por curvatura e habilidade, e detector de travado. Decide.
- Precedente no repo: `interiorMotion.ts` (puro, provado em `tests/unit/interiorMotion.test.ts` e na fronteira em `tests/e2e/interiors.spec.ts`), e `yawAssist.ts` (puro, provado em unitário e com o `Car` real em `tests/physics`).

Cost: ~22 provas vitest em 5 arquivos, 4 de física real num arquivo novo, ~16 Playwright num arquivo novo. A C22 roda 12 corridas no mundo real e deve levar alguns minutos.

## Swept

- validation: C8 (rede sem a estrada de uma corrida); C10 (bordas do prompt); C4 e C7 (traçado e grid sobre o asfalto)
- failure modes: C8 (corrida faltando não derruba o boot); C23 (oponente travado ou na água volta ao portão); C30 (jogador na água durante a corrida)
- idempotency: C3 (mesmo seed, mesmas corridas); C12 (Enter repetido fora do marcador não muda nada); C32 (Enter em `countdown` ou `racing` não começa outra corrida)
- authorization: n/a - jogo local de um jogador, sem conta nem rede
- concurrency: C15 e C26 (vários racers cruzam portões no mesmo passo; a ordem é decidida pelas chaves da C26, não por quem foi processado primeiro); C20 (IA e jogador no mesmo passo fixo, sem estado compartilhado fora do `World`)
- data lifecycle: C25, C28, C31 (os oponentes existem só entre a largada e o fim; nada persiste)
- dependency failure: n/a - sem dependência externa nova; `car.glb` ausente já cai no chassi placeholder (free-roam-city), e os oponentes usam o mesmo caminho
- state transitions: C32 (tabela completa), C11, C13, C18, C28, C31
- observability: `__game.race` (só DEV) com estado, racers, tempo, marcadores e sondas; lido pelas provas C9-C19, C21, C24, C25, C28-C32, C34, C36

## Handoff

- Base medida antes de escrever limites (L-019): 186 draw calls no spawn do centro, e `car.glb` com 6 primitivas. Um oponente pode custar até 6 × 3 passes (cena, espelho e GTAO) = 18 calls, então 3 oponentes perto da câmera dariam 186 + 54 = 240 > 220. A C34 fica como aprovada. Se o build não couber em 220 com medida real, é stop-and-ask, não mudança silenciosa de limite.
- Estimativa de tamanho (`wc -c` / 4):
  - arquivos existentes lidos ou tocados: `Game.ts` 59 KB, `Car.ts` 20 KB, `RoadGenerator.ts` 17 KB, `WorldPhysics.ts` 6 KB, `tests/physics/harness.ts` 6 KB, `helpers.ts` 5 KB, `worldMath.ts` 4 KB, HUD/minimapa/input/html/css ~11 KB. Total 128 KB ≈ 32k;
  - código e testes novos: ~100 KB ≈ 25k;
  - S1 38k, S2 entra em 60k, S3 em 90k, S4 em 107k, S5 em 127k. Tudo abaixo do budget de 150k: um builder só.
- Mechanism: one builder (cabe no budget, sem pergunta)
- **Settled mid-build (2026-09-27):**
  - C5 ganhou tolerância de ±0.01 m nos limites, escolha do usuário: o morro mede 3000.000004 m por erro de float32 nos pontos.
  - Ajuste da IA medido no mundo real: com a velocidade de curva `sqrt(habilidade · A · raio)`, a habilidade mudava o tempo menos que o ruído (cruzada 54.1/54.0/54.1 s). Ficou `habilidade² · sqrt(A · raio)` com A = 1 g, e a frenagem antes da curva também escala com a habilidade. Resultado: centro 170.4/162.0/156.1 s, anel 118.9/113.2/113.0 s, cruzada 55.7/54.7/54.2 s, morro 92.2/85.2/82.4 s, sem reset.
  - O detector de travado usa uma marca que sobe a cada 5 m andados, e dispara 4 s depois da última marca. A janela fixa de 4 s podia atrasar o reset até 8 s depois de parar, e a C23 pede 4.1 s. Os limites da C23 (4.9/5.1 m, -1.51/-1.49) não mudaram.
  - C25 mede malhas de carro (`car`) na cena em vez de todos os filhos, escolha do usuário: o `ChunkManager` põe e tira grupos da cena direto quando o carro anda.
  - C34 mediu 249 draw calls com os oponentes montados como o jogador (6 malhas × 3 passes cada). O oponente com glb passou a ter carroceria e aerofólio numa malha só e as 4 rodas numa `InstancedMesh` (o lado direito espelhado), com as rodas girando e esterçando como antes. Fica ≤ 220 sem mudar o limite.
  - As batidas (faíscas e tranco de câmera) passam a contar só o collider do chassi do jogador: os oponentes também geram eventos de força de contato.

