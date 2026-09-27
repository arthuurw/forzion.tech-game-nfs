# Block-fill verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 8c02e15..bf52b81 (correções 9de7a69, 4fd983e, bf52b81, entradas por 8e791f9; a nota de docs fb05348 no `plan.md` Landing também foi lida); HEAD verificado = 8e791f9 (main). Rodada 1: f5c3ade..ff0934a
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Resumo:
- As 5 lacunas da rodada 1 foram fechadas com prova localizada e verde em 8e791f9:
  1. AC 23 "perto das árvores" (C25): `tests/e2e/interiors.spec.ts:378`, `:386`, nas duas qualidades (`:395`, `:401`).
  2. AC 7 "do seed, em escala de 8 m" (C8): `tests/unit/interiorMotion.test.ts:83`, `:86`, `:106`.
  3. Folga de tempo de C17: `{ timeout: 60_000 }` em `interiorMotion.test.ts:184`. Rodou em 141 ms com o Playwright em paralelo.
  4. Máscara `aCrown` do tronco (C22): `interiors.spec.ts:303` (tronco parado vértice a vértice) e `:311` (copa se move).
  5. Docs: C28 lista a prova de browser (`checks.md:152`) e a linha "startup config" do Coverage cita `Game.ts` (`checks.md:216`).
- As edições do `checks.md` em C8, C17, C22, C25 e C28 **apertam** a obrigação aprovada, sem enfraquecer nem mudar o sentido (ver "Checks.md edits judged").
- As sondas novas `treeVertices(i)` e `fireflyPositions()` fazem a mesma conta dos shaders, termo a termo, e leem os mesmos buffers que a GPU recebe (ver "DEV probes judged").
- 5 faltas injetadas nas superfícies novas, 5 mortas.
- vitest 148/148. Playwright `interiors.spec.ts` 18/18 (porta 5207, 12.1 min).

## Binding sources

Carried from ff0934a. O `plan.md` não marca nenhuma fonte como binding e o profile é `standard`, então o passo 1 não roda. A correção não tocou interface.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| nenhuma fonte binding | n/a | - | - |

## Checks.md edits judged

Verified at 8e791f9 (`git diff 8c02e15 bf52b81 -- .specs/features/block-fill/checks.md`). Cada edição foi comparada com o AC do `plan.md` e com o texto aprovado antes.

| Check | Antes | Depois | Julgamento |
| --- | --- | --- | --- |
| C8 (AC 7) | "O ruído vem do seed, em escala de 8 m, sempre em [−1, 1] (10 000 pontos)" | mantém o intervalo e os 10 000 pontos; "do seed" vira: mesmo seed dá o mesmo valor e 1338 difere de 1337 (> 1e-6) em ≥ 900 de 1000 pontos; "escala de 8 m" vira: ruído de valor com nós a cada 8 m, em 500 pontos dentro de células 8 × 8 m (u, v em [0.05, 0.95]) o valor é a interpolação smoothstep dos 4 cantos ± 1e-9 | Aperto. As três afirmações antigas continuam e as duas vagas ganharam valor concreto. A forma escolhida (smoothstep de nós a 8 m) é mais estrita que "escala de 8 m", e a F1 mostra que nós a 16 m quebram a igualdade |
| C17 (AC 16) | "(± 1e-9)" por lâmpada | "(± 1e-9), no pior caso sobre todas as lâmpadas e instantes (teste com timeout de 60 s)" | Só harness. Os mesmos limites (0.15, [0.2, 0.4], 1e-9) |
| C22 (AC 21) | uTime anda, matrizes de instância dos troncos não mudam | mantém tudo e soma: nas 5 primeiras árvores, com os vértices onde o shader os põe, todo vértice marrom (r > g, independente da máscara) fica parado e algum vértice verde (g > r) se move | Aperto. Fecha "o tronco fica parado" no nível do vértice. Classificar o tronco pela cor, e não pela máscara, é o que impede a prova de se apoiar no mesmo dado que ela testa |
| C25 (AC 23) | teto 600/300, > 0, velocidade ≤ 0.5 m/s, pulso [0.3, 0.6] Hz | mantém tudo e soma: nas duas qualidades, em dois instantes separados por 2 s, todo vagalume a ≤ 6 m na horizontal de alguma árvore e entre 0.4 e 3.2 m acima do pé dela (± 0.01), com a conta do 6 m | Aperto. A conta confere: âncora `r = crown·(0.8 + 0.6·frac) < 1.4·crown` (`InteriorScene.ts:468`), `crown = 1.2 + 0.2·height ≤ 3.2` (`InteriorProps.ts:270`), deriva ±1 m em x e z (`InteriorScene.ts:746-748`): 1.4 × 3.2 + √2 ≈ 5.89 ≤ 6. Altura: 0.8 + [0, 2) ± 0.4 = [0.4, 3.2] (`:469`, `:747`) |
| C28 (AC 26) | só a prova unitária listada | soma `Proof: npx playwright test tests/e2e/interiors.spec.ts -g "crane beacon blinks"` | Só docs. A prova existia e já contava na rodada 1 (Deviation 6) |
| Coverage "startup config" | "`src/core/Game.ts` via `CityGenerator`" | "`src/core/Game.ts` (`findBlockInteriors` + `placeInteriorProps` no boot)" | Correção de docs. Confere em `src/core/Game.ts:154-155` |
| "Sondas DEV" | 3 sondas | soma `treeVertices(i)` e `fireflyPositions()` (`checks.md:21-22`) | Aditivo |

Nenhuma edição enfraquece ou troca o sentido de um check.

**Diff dos testes.** Nenhuma asserção enfraqueceu:
- C17 (`tests/unit/interiorMotion.test.ts:184-208`): os `expect` por passo viraram acumuladores de pior caso, `freqLo = min`, `freqHi = max` e `worstPeriod = max`, com os mesmos limites (`:203` ≥ 0.2, `:204` ≤ 0.4, `:205` ≤ 1e-9). As asserções de amplitude (`:206-207`) não mudaram. Um `NaN` também reprova: `Math.min`/`Math.max` propagam `NaN`, e `expect(NaN).toBeLessThanOrEqual(x)` falha.
- C8, C22 e C25: só acréscimos. As asserções antigas estão intactas (`interiorMotion.test.ts:72-75`; `interiors.spec.ts:295-297`, `:393-394`, `:399-400`).

## DEV probes judged

Verified at 8e791f9. As duas sondas foram lidas contra o GLSL que o material de fato compila.

- **`treeVertices(i)`** (`src/world/interiors/InteriorScene.ts:496-512`).
  - O shader da copa (`:726-728`, injetado depois do `#include <begin_vertex>`, antes do `instanceMatrix` do `project_vertex`) faz `transformed.xz += aSway.zw * aCrown * sin(6.28318530718 * aSway.x * uTime + aSway.y)`.
  - A sonda faz `s = sin(2π · sway.getX(i) · swayTime.value + sway.getY(i))` (`:504`), soma `sway.getZ/W(i) · mask.getX(k) · s` a x e z e depois aplica a matriz da instância `i` (`:507`). É a mesma ordem.
  - `uTime` é o próprio objeto `swayTime` (`:716`, `:150`). `aSway` é o `InstancedBufferAttribute` da instância `i` (`:431`). `aCrown` e `color` são os buffers da geometria (`:708-709`). A sonda lê exatamente o que a GPU recebe.
  - O `group` e a malha não têm transformação (nenhum `position`/`scale` em `InteriorScene.ts`), então a matriz do mundo é a identidade.
- **`fireflyPositions()`** (`:516-529`).
  - O vertex shader (`:744-749`) soma a `position` a deriva `(1.0·sin(2π·0.05·t + aParams.x), 0.4·sin(2π·0.06·t + aParams.z), 1.0·sin(2π·0.045·t + aParams.y))`.
  - A sonda (`:522-526`) usa as mesmas frequências, amplitudes e componentes de `aParams`, com a mesma troca y ↔ z. Também lê o `position` reescrito por `anchorFireflies` (`:470`) e o `uTime` compartilhado.
- **Resíduo, sem ser lacuna.** As sondas espelham o GLSL em JS. Uma edição só no texto do shader, sem mexer na sonda, não seria pega pelo teste. A equivalência hoje está provada pela leitura acima. As faltas F3 e F4 mostram que os dados que o shader consome (máscara e âncora) chegam às provas.

## Checks

Proofs re-run at 8e791f9, no worktree do Verifier (junction de `node_modules`, porcelain vazio antes e depois):
- `npx vitest run`: 37 arquivos, **148 passaram**, exit 0. Os 6 a mais que na rodada 1 são de outras features entradas depois (corner-assist).
- `npx vitest run <5 arquivos da feature> --reporter=verbose`: 29/29 ✓, cada nome aparece. "string lights sway" levou 141 ms com o Playwright rodando.
- `E2E_PORT=5207 npx playwright test tests/e2e/interiors.spec.ts`: **18 passaram** em 12.1 min, exit 0. Cada um dos 18 nomes aparece com ✓ (#1-#18). Os logs de sonda mostram: C11 "(32, -36) facadeDist 5.50 on 0.2541 off 0.0468"; C12 "on 0.0468 off 0.0468"; C29 "beam 0.3976 outside 0.0123"; C34 "start 5.00 m, after 4 s 16.01 m". "tree crowns sway and trunks stay" levou 20.1 s e "fireflies within budget" levou 57.4 s.
- C36 e C38 usam `render.spec.ts`, `world.spec.ts` e `visual.spec.ts`. Nenhum deles está no diff da correção, e os arquivos de código que a correção tocou (`Game.ts`, `InteriorScene.ts`) só ganharam sondas DEV que não rodam no quadro. O resultado vem de ff0934a (95/95).

Os checks marcados "verified at 8e791f9" tiveram a asserção relida nesta rodada. Os "carried from ff0934a" mantêm o julgamento da asserção da rodada 1, com a citação atualizada onde o arquivo mudou (`interiorMotion.test.ts`, `interiors.spec.ts`). A prova de todos rodou de novo em 8e791f9, exceto C36 e C38, como explicado acima.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | regra de interior; seed 1337 exaustivo | vitest ✓ (8e791f9) | carried from ff0934a: `tests/unit/interiors.test.ts:132-133`, `:135-139`, `:147`, `:161-166`, `:169` | PASS |
| C2 | zonas 4-vizinhas, mínimo 25 | vitest ✓ | carried from ff0934a: `tests/unit/interiors.test.ts:189-190`, `:202-203`, `:211`, `:214`, `:248` | PASS |
| C3 | kind pelo centroide, medidas | vitest ✓ | carried from ff0934a: `tests/unit/interiors.test.ts:265`, `:288-295` | PASS |
| C4 | `facadeDist` exata, teto 60 | vitest ✓ | carried from ff0934a: `tests/unit/interiors.test.ts:323`, `:332`, `:346` | PASS |
| C5 | determinismo; 1338 difere | vitest ✓ | carried from ff0934a: `tests/unit/interiors.test.ts:356-359`, `:364` | PASS |
| C6 | 1337 tem downtown e outer | vitest ✓ | carried from ff0934a: `tests/unit/interiors.test.ts:370-371` | PASS |
| C7 | módulos novos puros | vitest ✓ | carried from ff0934a: `tests/unit/purity.test.ts:46`, `:49` | PASS |
| C8 | `terrainColor` 6 casos; ruído em [−1, 1], do seed, nós a 8 m | vitest `terrain color` ✓ | verified at 8e791f9: `tests/unit/interiorMotion.test.ts:54-60` (6 casos + `none`); `:72-73` intervalo; `:83` `expect(terrainNoise(1337, x, z)).toBe(n)`; `:86` `expect(differ).toBeGreaterThanOrEqual(900)`; `:106` `expect(worstCell).toBeLessThanOrEqual(1e-9)` (F1 e F2 mortas) | PASS |
| C9 | cor do chunk = `terrainColor` | pw ✓ | carried from ff0934a: `tests/e2e/interiors.spec.ts:104-107` | PASS |
| C10 | `bounceWeight`; atributo por vértice | vitest ✓ · pw ✓ | carried from ff0934a (citação atualizada): `tests/unit/interiorMotion.test.ts:111-115`; `tests/e2e/interiors.spec.ts:138-140` | PASS |
| C11 | on ≥ 2 × off, ≤ 0.35 | pw ✓ (log "on 0.2541 off 0.0468") | carried from ff0934a: `tests/e2e/interiors.spec.ts:152-154` | PASS |
| C12 | variação ≤ 5 % longe | pw ✓ (log "on 0.0468 off 0.0468") | carried from ff0934a: `tests/e2e/interiors.spec.ts:183`, `:195-197` | PASS |
| C13 | `zoneLight` patamares, rampa | vitest ✓ | carried from ff0934a (citação atualizada): `tests/unit/interiorMotion.test.ts:125`, `:130`, `:138-139`, `:149-150`, `:152`, `:157` | PASS |
| C14 | calma; troca até 180 s; browser em 60 s | vitest ✓ · pw ✓ | carried from ff0934a (citação atualizada): `tests/unit/interiorMotion.test.ts:171-172`, `:179`; `tests/e2e/interiors.spec.ts:225-226` | PASS |
| C15 | quintal ⇔ 8 m atrás | vitest ✓ | carried from ff0934a: `tests/unit/interiorProps.test.ts:65`, `:67` | PASS |
| C16 | poste, 6 lâmpadas; browser | vitest ✓ · pw ✓ | carried from ff0934a: `tests/unit/interiorProps.test.ts:78-79`, `:84-85`, `:87`, `:90`; `tests/e2e/interiors.spec.ts:241-243` | PASS |
| C17 | `bulbOffset` ≤ 0.15, f em [0.2, 0.4], periódico (pior caso, 60 s); lâmpada se move | vitest `string lights sway` ✓ 141 ms · pw ✓ | verified at 8e791f9: `tests/unit/interiorMotion.test.ts:184` `{ timeout: 60_000 }`; `:203` `expect(freqLo).toBeGreaterThanOrEqual(0.2)`; `:204` `expect(freqHi).toBeLessThanOrEqual(0.4)` (F5 morta); `:205` `expect(worstPeriod).toBeLessThanOrEqual(1e-9)`; `:206-207`; `tests/e2e/interiors.spec.ts:255` | PASS |
| C18 | piscinas | vitest ✓ | carried from ff0934a: `tests/unit/interiorProps.test.ts:97-98`, `:100-101`, `:108`, `:112`, `:114` | PASS |
| C19 | água animada, emissivo ciano | pw ✓ | carried from ff0934a: `tests/e2e/interiors.spec.ts:265-269` | PASS |
| C20 | regra das árvores | vitest ✓ | carried from ff0934a: `tests/unit/interiorProps.test.ts:121`, `:134-137`, `:140`, `:143`, `:160` | PASS |
| C21 | altura [5, 10] | vitest ✓ | carried from ff0934a: `tests/unit/interiorProps.test.ts:166-170` | PASS |
| C22 | copa ≤ 0.3 m, 0.2-0.4 Hz; uTime anda, matrizes paradas; tronco parado vértice a vértice, copa se move | vitest `tree crowns sway` ✓ · pw `tree crowns sway and trunks stay` ✓ | verified at 8e791f9: `tests/unit/interiorMotion.test.ts:230-231`, `:234-235`; `tests/e2e/interiors.spec.ts:296-297`; `:301` `expect(trunkA.length).toBeGreaterThan(0)`; `:303` `expect(trunkB).toEqual(trunkA)` (F3 morta); `:311` `expect(moved).toBeGreaterThan(0)` | PASS |
| C23 | collider por tronco | vitest ✓ | carried from ff0934a: `tests/physics/interiors.test.ts:34`, `:38-39`, `:43-45` | PASS |
| C24 | 40 km/h → < 5 km/h em 1 s | pw ✓ | carried from ff0934a (citação atualizada): `tests/e2e/interiors.spec.ts:360`, `:364` | PASS |
| C25 | teto 600/300 e > 0; perto das árvores (≤ 6 m, 0.4-3.2 m) em 2 instantes, nas duas qualidades; ≤ 0.5 m/s; pulso 0.3-0.6 Hz | vitest `fireflies drift and pulse slowly` ✓ · pw `fireflies within budget` ✓ | verified at 8e791f9: `tests/e2e/interiors.spec.ts:378` (predicado ≤ 6 m e [t.y + 0.4, t.y + 3.2] ± 0.01), `:385` `expect(r.count).toBe(expected)`, `:386` `expect(r.bad).toBe(0)` (F4 morta), chamado em `:395` (high) e `:401` (low); `:393-394`, `:399-400`; `tests/unit/interiorMotion.test.ts:254-258` | PASS |
| C26 | canteiros | vitest ✓ | carried from ff0934a: `tests/unit/interiorProps.test.ts:179`, `:184-185`, `:188-199`, `:202`, `:225` | PASS |
| C27 | torre, lança, período; gira | vitest ✓ · pw ✓ | carried from ff0934a (citação atualizada): `tests/unit/interiorMotion.test.ts:266-268`, `:270-272`, `:275`; `tests/e2e/interiors.spec.ts:415` | PASS |
| C28 | `beaconOn` 6 casos; emissivo aceso > 0 e apagado 0 | vitest ✓ · pw `crane beacon blinks` ✓ (agora listado, `checks.md:152`) | verified at 8e791f9: `tests/unit/interiorMotion.test.ts:281-286`; `tests/e2e/interiors.spec.ts:430`, `:433`, `:437-438` | PASS |
| C29 | holofotes | vitest ✓ · pw ✓ | carried from ff0934a (citação atualizada): `tests/unit/interiorMotion.test.ts:291`, `:301`, `:303-305`; `tests/e2e/interiors.spec.ts:447-448` | PASS |
| C30 | collider por torre | vitest ✓ | carried from ff0934a: `tests/physics/interiors.test.ts:54`, `:57-58` | PASS |
| C31 | `walkerBudget`; ≤ 300 m, ≤ 400 | vitest ✓ · pw ✓ | carried from ff0934a (citação atualizada): `tests/unit/interiorMotion.test.ts:311-316`; `tests/e2e/interiors.spec.ts:462-465` | PASS |
| C32 | trechos na zona, 1.2-1.6 m/s | vitest ✓ | carried from ff0934a (citação atualizada): `tests/unit/interiorMotion.test.ts:339`, `:346-348`, `:353`, `:355`, `:358` | PASS |
| C33 | bob ±0.03, 0.5 s | vitest ✓ | carried from ff0934a (citação atualizada): `tests/unit/interiorMotion.test.ts:370`, `:372-374` | PASS |
| C34 | foge a 3 m/s até 15 m | vitest ✓ · pw ✓ | carried from ff0934a (citação atualizada): `tests/unit/interiorMotion.test.ts:398`, `:401-402`, `:412-414`; `tests/e2e/interiors.spec.ts:506`, `:518` | PASS |
| C35 | total de colliders | pw ✓ | carried from ff0934a (citação atualizada): `tests/e2e/interiors.spec.ts:533-539`, `:543` | PASS |
| C36 | draw calls ≤ 220; ready ≤ 30 s | carried from ff0934a (95/95) | carried from ff0934a: `tests/e2e/render.spec.ts:52-53`; `tests/e2e/visual.spec.ts:451` | PASS |
| C37 | `summary()` = recálculo | pw ✓ | carried from ff0934a (citação atualizada): `tests/e2e/interiors.spec.ts:554-556` | PASS |
| C38 | provas antigas seguem verdes | carried from ff0934a (95/95) | carried from ff0934a: `tests/e2e/world.spec.ts:65-66`, `:102`; `tests/e2e/visual.spec.ts:360-361`, `:483`, `:498`, `:508` | PASS |

## Coverage

As linhas cuja autoridade a correção tocou foram recalculadas em 8e791f9. As demais vêm de ff0934a.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (35) - verified at 8e791f9 | `plan.md` Criteria (`:68-143`), cada AC quebrado em suas afirmações | como na rodada 1, mais os dois trechos que faltavam: AC 7 "do seed" C8 `interiorMotion.test.ts:83`, `:86` (F2 morre) · AC 7 "escala de 8 m" C8 `:106` (F1 morre) · AC 23 "perto das árvores" C25 `interiors.spec.ts:386` (F4 morre) · AC 21 "o tronco fica parado" agora no vértice, C22 `:303` (F3 morre) | - |
| noise properties (3) - verified at 8e791f9 | AC 7 e C8 | intervalo `interiorMotion.test.ts:72-73` · seed `:83`, `:86` · escala `:106` | - |
| tree vertex classes (2) - verified at 8e791f9 | `mergeTree` (`InteriorScene.ts:686-689`: tronco `#3b2a1e` com máscara 0, copa `#2f5a2a` com máscara ≥ 0) | tronco `interiors.spec.ts:301`, `:303` · copa `:311` | - |
| firefly bounds (2) - verified at 8e791f9 | AC 23 e C25 (derivação em "Checks.md edits judged") | horizontal ≤ 6 m e vertical [0.4, 3.2] m, os dois no predicado de `interiors.spec.ts:378`, afirmados em `:386` | - |
| quality levels (2) - verified at 8e791f9 | AC 23, AC 29 | high C25 (teto `:393-394`, perto `:395`), C31 pw · low C25 (teto `:399-400`, perto `:401`), C31 só na unidade (`interiorMotion.test.ts:314`) | - |
| DEV probes (`summary` 9 campos, `groundProbe`, `beamProbe`, `treeVertices`, `fireflyPositions`) - verified at 8e791f9 | `checks.md:18-22` "Sondas DEV" e `src/core/Game.ts:878-961` | campos de `summary` C37, C25, C31, C35 · `groundProbe` C11, C12 · `beamProbe` C29 · `treeVertices` C22 (`Game.ts:940`) · `fireflyPositions` C25 (`Game.ts:942`); as duas novas espelham o shader (ver "DEV probes judged") | - |
| startup config: interiors assembly (1) - verified at 8e791f9 | leitura direta de `src/core/Game.ts:154-155` (`findBlockInteriors(carved, network, lots)`, `placeInteriorProps(seed, interiors, lots, carved)`); a linha do `checks.md:216` agora bate | C37 `interiors.spec.ts:554-556`; física com os mesmos `props` C35 `:536-537` | - |
| moving things (9) - verified at 8e791f9 | plan Observable "o que se move" | luz da zona C13, C14 · lâmpadas C17 · água C19 · copas C22 (agora também no vértice) · vagalumes C25 · lança C27 · farol C28 · holofotes C29 · pedestres C32-C34 | - |
| landing doors (2) - carried from ff0934a | `plan.md` Landing; a nota fb05348 registra o de acordo do usuário ao alargamento (só docs) | door 1 C1-C4 · door 2 C15, C16, C18, C20, C21, C23, C26, C27, C30-C32 | - |
| interior conditions (4) - carried from ff0934a | AC 1 | `interiors.test.ts:132-133`, `:135-136`, `:138-139`, `:147` | - |
| zone kinds (2) - carried from ff0934a | AC 3 | `interiors.test.ts:265`, `:290`, `:370-371` | - |
| terrain color cases (6) - carried from ff0934a | C8 | `interiorMotion.test.ts:54-60` | - |
| bounce weight cases (5) - carried from ff0934a | AC 9 | `interiorMotion.test.ts:111-115` | - |
| prop kinds (5) - carried from ff0934a | door 2 | yards C15, C16 · pools C18 · trees C20, C21 · sites C26, C27 · walkers C31, C32 | - |
| static colliders added (2) - carried from ff0934a | plan Flow 7, `WorldPhysics.ts:81-99` | troncos C23, C24 · torres C30 | - |
| beacon cases (6) - carried from ff0934a | C28 | `interiorMotion.test.ts:281-286` | - |
| walker budget cases (4) - carried from ff0934a | C31 | `interiorMotion.test.ts:311-316` | - |
| seed-1337 counts (7) - carried from ff0934a | geradores puros do seed 1337 | todos iguais a `summary()` em C37 `interiors.spec.ts:556` | - |

## Test policy rows

Re-julgadas as linhas que classificam arquivos tocados (`InteriorScene.ts`, `Game.ts`, e `interiorMotion.ts` pelos testes). Na rodada 1 as linhas estavam atendidas com ressalva. As demais vêm de ff0934a.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary - carried from ff0934a | `src/world/interiors/BlockInteriors.ts` | própria C1-C6 · fronteira C37 | yes |
| Decides, reached across a boundary - carried from ff0934a | `src/world/interiors/InteriorProps.ts` | própria C15, C16, C18, C20, C21, C26 · fronteira C16 pw, C37 | yes |
| Decides, reached across a boundary - verified at 8e791f9 | `src/world/interiors/interiorMotion.ts` | própria C8 (agora com seed e escala), C10, C13, C14, C17, C22, C25, C27-C29, C31-C34 · fronteira C9, C10, C14, C17, C22, C25, C27-C29, C31, C34 pw | yes. A ressalva da rodada 1 (copa e vagalume sem prova de fronteira dos valores) caiu: C22 e C25 agora afirmam posições por vértice e por vagalume, com as contas do shader aplicadas |
| Instrumentation, pass-throughs - carried from ff0934a | `src/world/WorldPhysics.ts` | Rapier real C23, C30 · browser C24, C35 | yes |
| Instrumentation, pass-throughs - verified at 8e791f9 | `src/world/ChunkManager.ts`, `src/world/CityScene.ts`, `src/world/interiors/InteriorScene.ts`, `src/core/Game.ts` | provas Playwright C9-C12, C14, C16, C17, C19, C22, C24, C25, C27-C29, C31, C34-C37 | yes. O que `InteriorScene.ts` decide agora tem prova: a âncora dos vagalumes (`:457-474`) por C25 `:386`, e a máscara do tronco (`:702`) por C22 `:303`. As sondas novas são só DEV: ficam em `interiorsDebug()` (`Game.ts:876`, `:940-942`), que só chega a `window.__game` por `exposeDebug` (`src/core/exposeDebug.ts:11` `if (!env.DEV) return;`), e só são chamadas pelos testes |

## Faults injected

Verified at 8e791f9, num worktree de rascunho separado (`git worktree add --detach <scratchpad>/fault-wt HEAD` + junction de `node_modules`), nunca com `git stash`.
- A porcelain do worktree do Verifier estava vazia antes e continuou vazia depois.
- Cada falta foi aplicada com `sed`, conferida com `diff` e revertida copiando o arquivo original antes da próxima.
- As faltas de browser rodaram num servidor próprio na porta 5208, depois que a rodada principal na 5207 terminou. Assim nenhum servidor da prova serviu código mutado.
- As 5 faltas miram as superfícies que a correção criou (as asserções novas de C8, C17, C22 e C25). Cada uma é derrubada por uma asserção diferente.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 escala do ruído `GROUND_NOISE_SCALE` 8 → 16 | `src/world/interiors/interiorMotion.ts:24` | yes. C8 `tests/unit/interiorMotion.test.ts:106` "expected 0.2018… to be less than or equal to 1e-9" |
| F2 ruído ignora o seed (`seed ^ 0x6a55` → `0x6a55`) | `src/world/interiors/interiorMotion.ts:46` | yes. C8 `tests/unit/interiorMotion.test.ts:86` "expected 0 to be greater than or equal to 900" |
| F5 frequência da lâmpada `0.2 + 0.2 * h` → `0.2 + 0.3 * h` (até 0.5 Hz) | `src/world/interiors/interiorMotion.ts:152` | yes. C17 `tests/unit/interiorMotion.test.ts:204` "expected 0.4997… to be less than or equal to 0.4" |
| F3 máscara do tronco `aCrown` 0 → 1 | `src/world/interiors/InteriorScene.ts:702` | yes. C22 `tests/e2e/interiors.spec.ts:303` "tree 0 trunk", 72 coordenadas diferentes (porta 5208) |
| F4 vagalumes ancorados 20 m ao lado da árvore (`t.x + 20 + sin(a)·r`) | `src/world/interiors/InteriorScene.ts:470` | yes. C25 `tests/e2e/interiors.spec.ts:386` "Expected: 0, Received: 503" (503 de 600 vagalumes longe de toda árvore, porta 5208) |

## Swept existing

Carried from ff0934a. A correção não tocou `main.ts`, `ChunkManager.ts`, `Water.ts` nem o descarte, então as três leituras (falha no boot → `showError` em `src/main.ts:36-38`; descarte de geometria em `src/world/ChunkManager.ts:69-75`; normal map procedural em `src/world/Water.ts:38`) continuam valendo.

## Deviations judged

Carried from ff0934a (Deviations 1-8 da rodada 1), com duas atualizações:
- **Deviation 1** (alargamento das doors): o commit fb05348 registra no `plan.md` Landing o de acordo do usuário. O ponto em aberto da rodada 1 (gap 6) está fechado.
- **Deviation 6** (prova extra do farol): a linha de Proof agora está no `checks.md:152`.

Nesta rodada, a correção não trouxe desvio novo. O código de produção só ganhou as duas sondas DEV (`InteriorScene.ts:492-529`, `Game.ts:939-942`), sem mudar render nem física.

## Gate

`npx vitest run` - 148 passed, 0 failed · `E2E_PORT=5207 npx playwright test tests/e2e/interiors.spec.ts` - 18 passed, 0 failed (12.1 min) · C36/C38 (`render`, `world`, `visual`) carried from ff0934a, 95 passed

## Ranked gaps

Nenhuma lacuna aberta. As 6 da rodada 1 estão fechadas:
1. AC 23 "perto das árvores": C25 `interiors.spec.ts:386`, F4.
2. AC 7 "do seed, escala de 8 m": C8 `interiorMotion.test.ts:83`, `:86`, `:106`, F1 e F2.
3. Folga de tempo de C17: `interiorMotion.test.ts:184`, 141 ms sob carga.
4. Tronco parado: C22 `interiors.spec.ts:303`, F3.
5. Docs: `checks.md:152` e `:216`.
6. Door alterada: de acordo registrado em fb05348.

Nota, sem ser lacuna: as sondas `treeVertices` e `fireflyPositions` espelham o GLSL em JS. Hoje a equivalência vale por leitura (`InteriorScene.ts:728` ↔ `:504-507`, `:745-748` ↔ `:522-526`), e uma edição só no texto do shader passaria despercebida pelas provas.
