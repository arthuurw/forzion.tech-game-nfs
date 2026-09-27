# Block-fill verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: f5c3ade..2456366 (branch `block-fill`: bbf232d, 09d40cd, 50b591f, 9679601, 9198fe2, 0897717, 8ca79ca, 2456366) + a resolução do merge ff0934a (união do `purity.test.ts`, correções de Flow/Impact no `plan.md`); HEAD verificado = ff0934a
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Resumo:
- Os 38 checks têm prova localizada e verde em ff0934a: vitest 142/142 e Playwright 95/95 (porta 5202, 43.6 min, sem timeout de boot). As 5 faltas injetadas morreram.
- O veredito é FAIL por **cobertura**, não por teste vermelho. Recalculando os ACs do plano, dois trechos que o próprio plano escreve não têm prova nenhuma:
  1. AC 23 "vagalumes **perto das árvores**". Nenhuma asserção olha onde os vagalumes estão. C25 só conta e mede o movimento puro.
  2. AC 7 "ruído **do seed** em **escala de 8 m**". C8 afirma só o intervalo [−1, 1] e que o ruído varia. Trocar a escala para 80 m ou ignorar o seed passa em tudo.
- Risco de tempo: a prova unitária de C17 ("string lights sway") não tem timeout próprio e roda no limite do padrão de 5 s. Deu timeout 2 vezes com o Playwright rodando em paralelo (5315 ms e 5516 ms). Sem carga passou 3 de 3 (2.6 s, 4.5 s e 2.9 s) e passou nas duas rodadas completas do vitest.

## Binding sources

O `plan.md` não marca nenhuma fonte como binding. `Sources` só traz o pedido do usuário e as AD-008/AD-010. O profile é `standard`, então o passo 1 não roda.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| nenhuma fonte binding | n/a | - | - |

## Checks

Tudo verificado em ff0934a, no worktree do Verifier (junction de `node_modules`; `git status --porcelain` vazio antes e depois).
- `npx vitest run`: 35 arquivos, **142 passaram**, exit 0. Rodei de novo no fim, sem carga: 142/142.
- `npx vitest run --reporter=verbose` nos 5 arquivos da feature (`interiors`, `interiorProps`, `interiorMotion`, `physics/interiors`, `purity`): 29 nomes, cada um com ✓. A exceção foi "string lights sway", com timeout de 5 s enquanto o Playwright rodava (ver resumo).
- `E2E_PORT=5202 npx playwright test`: **95 passaram** em 43.6 min, exit 0. O `[WebServer] vite --port 5202 --strictPort` subiu no próprio run.
  - Os 18 testes de `interiors.spec.ts` aparecem cada um com ✓ (#29-#46).
  - Os logs de sonda mostram: C11 "(32, -36) facadeDist 5.50 on 0.2541 off 0.0468"; C12 "on 0.0468 off 0.0468"; C29 "beam 0.3976 outside 0.0123"; C34 "start 5.00 m, after 4 s 16.11 m".
- Todo nome de prova existe no tree (achado com `rg`/leitura) e foi tocado pela feature. As exceções são C36 e C38, que são provas antigas de propósito. `render.spec.ts`, `world.spec.ts` e o trecho de `visual.spec.ts` que elas usam não mudaram no range da feature.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | regra de interior: estrada w/2+2, lote +1, água +0.5, borda 8 m; seed 1337 exaustivo | vitest `interior vertex rule` ✓ | `tests/unit/interiors.test.ts:132-133` (9.9 → −1, 10.1 → ≥0), `:135-136` (lote), `:138-139` (água), `:147` (borda 7.9/8.1), `:161-166` (as 4 condições em cada vértice interior do seed), `:169` `checked > 1000` | PASS |
| C2 | zonas por vizinhança de 4, mínimo 25 | vitest `zones are 4-connected groups of at least 25` ✓ | `tests/unit/interiors.test.ts:189-190` (L de 30 → 1 zona, `cells` 30), `:202-203` (diagonal → 2 zonas `[30, 30]`), `:211`, `:214` (24 → nenhuma zona, `zoneOf` −1), `:224-225`, `:248` (seed 1337: contagem, ≥ 25, BFS alcança exatamente `cells`) | PASS |
| C3 | kind pelo centroide; centroid, areaM2, bbox | vitest `zone kind and measures` ✓ | `tests/unit/interiors.test.ts:265` (500 → downtown, 500.1 → outer; o sintético usa z = 0.1 no caso outer, e a regra continua decidida por x), `:288-295` (centroide ± 1e-6, kind, `areaM2 = cells*16`, bbox) | PASS |
| C4 | `facadeDist` exata, teto 60 | vitest `facade distance` ✓ | `tests/unit/interiors.test.ts:323` (12 ± 0.01 no lote girado 30°), `:332` (80 m → 60), `:346` (200 sorteados do seed 1337 ± 0.01) | PASS |
| C5 | determinismo; 1338 difere em ≥ 1000 | vitest `interiors and props are deterministic` ✓ | `tests/unit/interiors.test.ts:356-359` (`zoneOf`, `facadeDist`, `zones`, `InteriorProps` com `toEqual`), `:364` `differ >= 1000` | PASS |
| C6 | 1337 tem downtown e outer | vitest `seed 1337 has both zone kinds` ✓ | `tests/unit/interiors.test.ts:370-371` | PASS |
| C7 | módulos novos puros | vitest `pure modules do not import three or rapier` ✓ | `tests/unit/purity.test.ts:46` `toBe(28)` (união com yaw-assist no merge ff0934a), `:49` `FORBIDDEN.test(source)` false para `BlockInteriors.ts`, `InteriorProps.ts` e `interiorMotion.ts` (lista em `:35-38`) | PASS |
| C8 | `terrainColor`, 6 casos; ruído em [−1, 1] | vitest `terrain color` ✓ | `tests/unit/interiorMotion.test.ts:54-60` (os 6 casos + `none`, ± 1e-6), `:72-73` (10 000 pontos em [−1, 1]), `:75` (varia > 0.5). Nenhuma asserção cobre "escala de 8 m" nem "do seed" (ver Coverage) | PASS |
| C9 | cor do chunk = `terrainColor` (± 1/255) | pw `ground uses the new terrain color` ✓ | `tests/e2e/interiors.spec.ts:104-107` (pátio downtown e vértice fora do miolo com slope < 0.05). O esperado é calculado no browser pelo módulo puro servido pelo Vite (`:74`, `:91`) | PASS |
| C10 | `bounceWeight` 5 casos; atributo por vértice = função | vitest `bounce weight` ✓ · pw `ground bounce weight per vertex` ✓ | `tests/unit/interiorMotion.test.ts:80-84`; `tests/e2e/interiors.spec.ts:138-140` (50 vértices do chunk do spawn, ≥ 1 no miolo com peso > 0, ± 1e-4) | PASS |
| C11 | on ≥ 2 × off e ≤ 0.35, downtown a ≤ 8 m | pw `ground bounce lights the block interior` ✓ | `tests/e2e/interiors.spec.ts:152-154`; log: 0.2541 vs 0.0468 | PASS |
| C12 | longe (> 40 m): variação ≤ 5 % | pw `ground far from buildings is unchanged` ✓ | `tests/e2e/interiors.spec.ts:183`, `:195-197`; log: 0.0468 / 0.0468 | PASS |
| C13 | `zoneLight`: [0.5, 1], patamares 20-60 s, rampa 3 s linear, determinista | vitest `zone light holds and ramps` ✓ | `tests/unit/interiorMotion.test.ts:94` (mesmo id/t), `:99` (intervalo), `:107-108` (patamar), `:118-119` (rampa 3 s ± 1/60, entre níveis diferentes), `:121` (segunda diferença ≤ 1e-9), `:126` | PASS |
| C14 | ≤ 0.1 por 0.5 s; toda zona troca até 180 s; browser troca em 60 s | vitest `zone light is calm and always changes` ✓ · pw `ground light changes over time` ✓ | `tests/unit/interiorMotion.test.ts:141`, `:148` (as 39 zonas do seed); `tests/e2e/interiors.spec.ts:225-226`. `zoneLevel` lê `scene.zoneLevels`, o array da `DataTexture` do shader (`src/core/Game.ts:900`, `src/world/interiors/InteriorScene.ts:118`, `:550`) | PASS |
| C15 | quintal ⇔ lote outer com 8 m interiores atrás | vitest `yard for every outer lot with 8 m behind` ✓ | `tests/unit/interiorProps.test.ts:65` (iff por lote, predicado recalculado em `:59-63`), `:67` | PASS |
| C16 | poste 4-8 m, 2.5 m, 6 lâmpadas ≤ 0.5 m do segmento; browser conta e emissivo | vitest `yard lamp and six bulbs` ✓ · pw `yards are built` ✓ | `tests/unit/interiorProps.test.ts:78-79`, `:84-85`, `:87`, `:90`; `tests/e2e/interiors.spec.ts:241-243` | PASS |
| C17 | `bulbOffset` ≤ 0.15, f em [0.2, 0.4], periódico; lâmpada se move em 0.5 s | vitest `string lights sway` ✓ (sem carga; timeout de 5 s sob carga, ver resumo) · pw `yard bulbs sway` ✓ | `tests/unit/interiorMotion.test.ts:159-160`, `:165`, `:169`; `tests/e2e/interiors.spec.ts:255` | PASS |
| C18 | fração de piscina em [0.2, 0.4]; 4 × 8; cantos na mesma zona; y + 0.05 | vitest `pools fit in the yard` ✓ | `tests/unit/interiorProps.test.ts:97-98` (69/231 = 0.299), `:100-101`, `:108`, `:112`, `:114` | PASS |
| C19 | normal map anda; emissivo ciano > 0 | pw `pool water is animated` ✓ | `tests/e2e/interiors.spec.ts:265-270` | PASS |
| C20 | árvore: outer, facadeDist ≥ 6, slope ≤ 0.35, ≥ 7 m, ≤ área/120, ≥ 1 | vitest `trees on outer interior ground` ✓ | `tests/unit/interiorProps.test.ts:121`, `:134-137`, `:140`, `:143`, `:160` | PASS |
| C21 | altura em [5, 10], < 6 e > 9 presentes | vitest `tree heights between 5 and 10` ✓ | `tests/unit/interiorProps.test.ts:166-170` | PASS |
| C22 | copa ≤ 0.3 m a 0.2-0.4 Hz; uTime anda e troncos parados | vitest `tree crowns sway` ✓ · pw `tree crowns sway and trunks stay` ✓ | `tests/unit/interiorMotion.test.ts:193`, `:196-197`; `tests/e2e/interiors.spec.ts:287-288`. Prova fraca para "o tronco fica parado" (ver Ranked gaps) | PASS |
| C23 | um collider por tronco, centrado, tocando o chão | vitest `one collider per tree trunk` ✓ | `tests/physics/interiors.test.ts:34` (2977), `:38-39`, `:43-45` | PASS |
| C24 | 40 km/h no tronco → < 5 km/h em ≤ 1 s | pw `car stops at a tree trunk` ✓ | `tests/e2e/interiors.spec.ts:336`, `:340` | PASS |
| C25 | vagalumes ≤ 600/300 e > 0; ≤ 0.5 m/s; pulso 0.3-0.6 Hz | vitest `fireflies drift and pulse slowly` ✓ · pw `fireflies within budget` ✓ | `tests/unit/interiorMotion.test.ts:216-220`; `tests/e2e/interiors.spec.ts:347-348`, `:352-353` | PASS |
| C26 | canteiros = downtown ≥ 1500 m² por área, corte em 6, centroide ou vértice mais próximo | vitest `construction sites in the largest downtown zones` ✓ | `tests/unit/interiorProps.test.ts:179`, `:184-185`, `:188-199`, `:202`, `:225` (sintético 8 → 6) | PASS |
| C27 | torre 40-60, lança 30, período 90-150, contínuo; lança gira no browser | vitest `crane jib turns slowly` ✓ · pw `construction crane turns` ✓ | `tests/unit/interiorMotion.test.ts:228-230`, `:232-234`, `:237`; `tests/e2e/interiors.spec.ts:367` (yaw lido da matriz da instância, `InteriorScene.ts:396-401`) | PASS |
| C28 | `beaconOn` 6 casos; emissivo > 0 aceso e 0 apagado no browser | vitest `crane beacon blinks at 1 Hz` ✓ · pw `crane beacon blinks` ✓ (teste extra, não listado no Proof) | `tests/unit/interiorMotion.test.ts:243-248`; `tests/e2e/interiors.spec.ts:382`, `:385`, `:389-390` | PASS |
| C29 | 2 holofotes; ±30°, período 20 s; facho > 1.5 × fora | vitest `floodlights sweep 30 degrees in 20 s` ✓ · pw `construction floodlight lights the ground` ✓ | `tests/unit/interiorMotion.test.ts:253`, `:263`, `:265-267`; `tests/e2e/interiors.spec.ts:399-400` (0.3976 vs 0.0123) | PASS |
| C30 | um collider por torre, centrado | vitest `one collider per crane tower` ✓ | `tests/physics/interiors.test.ts:54`, `:57-58` | PASS |
| C31 | `walkerBudget` 4 casos; browser ≤ 300 m, 0 < ativos ≤ 400 | vitest `walker budget` ✓ · pw `walkers near the car` ✓ | `tests/unit/interiorMotion.test.ts:273-278`; `tests/e2e/interiors.spec.ts:414-417` | PASS |
| C32 | trechos entre vértices da zona, amostra de 1 m, 1.2-1.6 m/s | vitest `walkers stay inside their zone` ✓ | `tests/unit/interiorMotion.test.ts:301`, `:308-310`, `:315`, `:320` | PASS |
| C33 | bob em ±0.03, período 0.5 s | vitest `walker bob` ✓ | `tests/unit/interiorMotion.test.ts:332`, `:334-336` | PASS |
| C34 | foge a 3 m/s até 15 m, volta a andar, sempre na zona; browser ≥ 12 m em 4 s | vitest `walker flees the car` ✓ · pw `walkers step away from the car` ✓ | `tests/unit/interiorMotion.test.ts:360`, `:363-364`, `:369`, `:374-376`; `tests/e2e/interiors.spec.ts:458`, `:470` (16.11 m) | PASS |
| C35 | total de colliders = soma esperada, estável 5 s | pw `walkers have no colliders` ✓ | `tests/e2e/interiors.spec.ts:485-491` (`total` vem do Rapier, `world.colliders.len()`, `src/core/Game.ts:948`), `:495` | PASS |
| C36 | draw calls ≤ 220; ready ≤ 30 s | pw `draw calls at most 220 across the world` ✓ · pw `ready within 30 s at high quality` ✓ | `tests/e2e/render.spec.ts:52-53`; `tests/e2e/visual.spec.ts:451`. Os dois arquivos não mudaram no range da feature | PASS |
| C37 | `summary()` = recálculo do seed 1337 | pw `game builds the interiors from the world seed` ✓ | `tests/e2e/interiors.spec.ts:506-508` (7 chaves); o esperado é calculado em `:44-65` com os módulos puros servidos pelo Vite | PASS |
| C38 | C7/C8 da city-terrain, janelas estáveis, 3 de facade-glint seguem verdes | pw `world.spec` (2) ✓ · pw `visual.spec` (4) ✓ | `tests/e2e/world.spec.ts:65-66`, `:102`; `tests/e2e/visual.spec.ts:360-361`, `:483`, `:498`, `:508`. As asserções não mudaram na feature (o diff de `visual.spec.ts` entre f5c3ade e ff0934a é da car-feel) | PASS |

## Coverage

Verified at ff0934a. As contagens do seed 1337 vêm de um script descartável que chama os geradores puros como o `Game` chama (arquivo temporário removido; porcelain vazio). O resultado: 39 zonas (9 downtown, 30 outer), 457 475 vértices interiores, 1224 lotes (934 fora do centro), 231 lotes que passam o predicado de 8 m, 231 quintais, 69 piscinas (0.2987), 2977 árvores (o teto por zona somaria 57 772), exatamente 6 zonas downtown ≥ 1500 m² (61 008 a 67 232 m²) e 6 canteiros, 21 942 pontos de pedestre, e 400/200 ativos em (0, 0) em high/low. A menor zona tem 26 vértices.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (35) | `plan.md` Criteria, cada AC quebrado em suas afirmações | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6 · 7 base, ±8 %, rocha e areia C8, C9 · 8 C8, C9 · 9 C10, C12 · 10 C11 · 11 C12 · 12 C13 · 13 C14 · 14 C15 · 15 C16 · 16 C17 · 17 C18 · 18 C19 · 19 C20 · 20 C21 · 21 C22 · 22 C23, C24 · 23 teto, velocidade e pulso C25 · 24 C26 · 25 C27 · 26 C28 · 27 C29 · 28 C30 · 29 C31 · 30 C32 · 31 C33 · 32 C34 · 33 C35 · 34, 35 C36 | AC 23 "perto das árvores": nenhuma asserção sobre a posição dos vagalumes (a âncora é `InteriorScene.ts:457-474`). AC 7 "ruído do seed em escala de 8 m": `interiorMotion.ts:46` usa `GROUND_NOISE_SCALE`, mas nada afirma a escala nem que outro seed muda o ruído |
| landing doors (2) | `plan.md` Landing (com o alargamento de bbf232d) e os `export` de `BlockInteriors.ts:37-58` e `InteriorProps.ts:21-91` | door 1: `spacing`/`origin`/`size` vêm do `Heightmap` (`BlockInteriors.ts:186`; o jogo usa `HM_SIZE` 769 e `HM_SPACING` 4, `TerrainGenerator.ts:28-29`), `zoneOf` C1-C3, `facadeDist` C4, `zones` C2, C3 · door 2: `yards` C15, C16 · `pools` C18 · `trees` C20, C21, C23 · `sites` C26, C27, C30 · `walkers` C32, C31; assinatura com `carved` usada em todas as provas de props e em `Game.ts:155` | - |
| interior conditions (4) | AC 1 | estrada `interiors.test.ts:132-133` · lote `:135-136` · água `:138-139` · borda `:147` (F1 morre) | - |
| zone kinds (2) | AC 3 | downtown, outer `interiors.test.ts:265`, `:290`, `:370-371` | - |
| terrain color cases (6) | C8 / AC 7-8 | `interiorMotion.test.ts:54-60` (7 linhas, incluindo `none`) | - |
| bounce weight cases (5) | AC 9 | `interiorMotion.test.ts:80-84` (F3 morre em `:82`) | - |
| prop kinds (5) | door 2 | yards C15, C16 · pools C18 · trees C20, C21 · sites C26, C27 · walkers C31, C32 | - |
| moving things (9) | plan Observable "o que se move" | luz da zona C13, C14 · lâmpadas C17 · água C19 · copas C22 · vagalumes C25 · lança C27 · farol C28 (unit + pw extra) · holofotes C29 · pedestres C32-C34 (F4 morre) | - |
| static colliders added (2) | plan Flow 7 (sem piscina, corrigido em ff0934a) e `WorldPhysics.ts:81-99` | troncos C23 (F5 morre), C24 · torres C30 | - |
| quality levels (2) | AC 23, AC 29 | high C25 pw, C31 pw · low C25 pw (`?quality=low`, `interiors.spec.ts:352-353`), C31 só na unidade (`interiorMotion.test.ts:276`), com o nível ligado em `InteriorScene.ts:278` | - |
| beacon cases (6) | C28 | `interiorMotion.test.ts:243-248` | - |
| walker budget cases (4) | C31 | `interiorMotion.test.ts:273-278` | - |
| seed-1337 counts (7) | geradores puros do seed 1337 (script acima) | zones 39 · downtown 9 · outer 30 · yards 231 · pools 69 · trees 2977 · sites 6, todos iguais a `summary()` em C37 `interiors.spec.ts:508`; yards também em C16 `:241` | - |
| DEV probes, Surface (`summary` 9 campos, `groundProbe`, `beamProbe`) | `plan.md` Surface e `checks.md` "Sondas DEV"; `src/core/Game.ts:878-961` | zones/downtown/outer/yards/pools/trees/sites C37 · fireflies C25 · walkersActive C31, C35 · `groundProbe` C11, C12 · `beamProbe` C29 | - |
| startup config: interiors assembly (1) | `src/core/Game.ts:154-157` (leitura direta; a linha do `checks.md` ainda diz "via `CityGenerator`", o que está desatualizado, porque o Flow 1 foi corrigido no merge) e `src/world/CityScene.ts:119-120`, `:160` | C37 (contagens do `Game` = recálculo independente no browser); física com os mesmos `props` C35 `:488-489` | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/world/interiors/BlockInteriors.ts` | própria C1-C6 · fronteira C37 | yes. Uma asserção por condição e por caso sintético; C37 prova que o `Game` monta do mesmo seed |
| Decides, reached across a boundary | `src/world/interiors/InteriorProps.ts` | própria C15, C16, C18, C20, C21, C26 · fronteira C16 pw, C37 | yes |
| Decides, reached across a boundary | `src/world/interiors/interiorMotion.ts` (inclui `terrainColor`, `bounceWeight`, `zoneLight`, movimento) | própria C8, C10, C13, C14, C17, C22, C25, C27-C29, C31-C34 · fronteira C9, C10, C14, C17, C22, C25, C27-C29, C31, C34 pw | yes, por arquivo. `walkerBob` (C33) e o trajeto de C32 só têm prova na unidade. Os shaders de copa e vagalume repetem as contas (`InteriorScene.ts:689`, `:706-713`) sem prova de fronteira dos valores |
| Instrumentation, pass-throughs | `src/world/WorldPhysics.ts` | Rapier real C23, C30 · browser C24, C35 | yes (F5 morre em C23) |
| Instrumentation, pass-throughs | `src/world/ChunkManager.ts`, `src/world/CityScene.ts`, `src/world/interiors/InteriorScene.ts`, `src/core/Game.ts` | provas Playwright C9-C12, C14, C16, C17, C19, C22, C24, C25, C27-C29, C31, C34-C37 | yes, com a ressalva de que `InteriorScene.ts` também decide coisas (a âncora dos vagalumes perto das árvores, a máscara do tronco) e ficou sem prova delas. Isso já está contado em Coverage e em Ranked gaps |

## Faults injected

Verified at ff0934a, num worktree de rascunho separado (`git worktree add --detach <scratchpad>/fault-wt HEAD` + junction), nunca com `git stash`.
- A porcelain do worktree do Verifier era vazia antes, e continuou vazia depois de tudo.
- Cada falta foi revertida com `git checkout -- <arquivo>` no rascunho antes da próxima.
- No fim apaguei a junction (`.Delete()`) e rodei `git worktree remove`. O `node_modules` compartilhado continuou intacto.
- Todas as faltas são de unidade ou física, então nenhum servidor na 5202 serviu código mutado.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 margem da estrada `ROAD_MARGIN` 2 → 1 | `src/world/interiors/BlockInteriors.ts:23` | yes. C1 `interiors.test.ts:132` "expected 1 to be -1" |
| F2 menor zona `MIN_ZONE_CELLS` 25 → 20 | `src/world/interiors/BlockInteriors.ts:31` | yes. C2 `interiors.test.ts:211` "expected 1 to be +0" (o grupo sintético de 24 vira zona). Só o caso sintético pega: a menor zona do seed tem 26 vértices |
| F3 alcance da luz rebatida `BOUNCE_RANGE` 25 → 40 | `src/world/interiors/interiorMotion.ts:76` | yes. C10 `interiorMotion.test.ts:82` "expected 0.6875 to be close to 0.5" |
| F4 fuga desligada (`if (false && …) w.fleeing = true`) | `src/world/interiors/interiorMotion.ts:398` | yes. C34 `interiorMotion.test.ts:363` "step 0: expected 1.667… ≤ 0.01" |
| F5 sem collider de tronco (laço sobre lista vazia) | `src/world/WorldPhysics.ts:82` | yes. C23 `tests/physics/interiors.test.ts:34` "expected +0 to be 2977" |

## Swept existing

- **failure modes**: o erro de geração no boot cai no overlay. Confere em `src/main.ts:36-38` (`catch` → `showError`). `findBlockInteriors` e `placeInteriorProps` rodam dentro desse boot (`src/core/Game.ts:154-155`).
- **data lifecycle**: as malhas de terreno seguem o descarte dos chunks. Confere em `src/world/ChunkManager.ts:69-75` (`geometry.dispose()`). `aBounce` e `aZone` são atributos dessa mesma geometria (`:329-330`), então são descartados junto. Os objetos do `InteriorScene` são globais e vivem a sessão inteira.
- **dependency failure**: o miolo não carrega textura externa. O normal map da piscina é o procedural `waveNormalMap` (`src/world/Water.ts:38`, agora exportado), e o resto é geometria procedural. Confere.

## Deviations judged

1. **Alargamento dos literais do Landing** (bbf232d, antes do código).
   - Door 1: `spacing: 4; origin: -1536; size: 769` viraram `number /* 4 */` etc., vindos do `Heightmap` recebido. A borda de 8 m passou a ser contada de `WORLD_HALF`.
   - Door 2: `placeInteriorProps` ganhou `carved: Heightmap`.
   - No jogo os valores continuam 4 / -1536 / 769 (`TerrainGenerator.ts:28-29`, `BlockInteriors.ts:186`). O parâmetro novo é aditivo e necessário, porque é ele que dá as alturas de poste, piscina e árvore. A AD-012 não fixa esses literais.
   - Aceito tecnicamente. Mas é uma mudança de one-way door feita pelo builder: o usuário deve ficar sabendo e confirmar.
2. **Piscina por embaralhamento, 30 % exatos** (`InteriorProps.ts:192-220`). Primeiro filtra os quintais onde a piscina cabe inteira, depois embaralha pelo seed e fica com `round(0.3 × quintais)` = 69/231.
   - Atende "30 % dos quintais (sorteio pelo seed)": o seed escolhe quais.
   - Se menos de 30 % coubessem, sairiam menos piscinas. C18, com [0.2, 0.4], pegaria. Aceito.
3. **Árvores muito abaixo do teto**: 2977 contra o teto de 57 772 (chance de 6 % perto das casas e 0.3 % longe, `InteriorProps.ts:243`). O AC 19 é um limite máximo, então é cumprido. A densidade é ajuste pelo plano. Aceito.
4. **Mudanças do builder nas provas C10 e C14** (2456366). São só de harness, sem enfraquecer nada.
   - C10: `rand() * (cells + 1)` → `rand() * cells`. O índice 128 é o primeiro vértice do chunk vizinho, então a amostra agora fica dentro do chunk do spawn, como o check diz.
   - C14: antes eram leituras a cada 0.5 s com `max - min > 0`. Agora é leitura por quadro (rAF) com `changed || last !== first`, mais `t1 - t0 >= 60`. Isso detecta pelo menos tudo o que a versão antiga detectava. O timeout de 600 s cobre os 7.2 min medidos no SwiftShader.
5. **21 942 pontos de pedestre contra o teto de 400**. Os pontos são dados; o que fica ativo é limitado por `activeWalkerSpawns` (`interiorMotion.ts:261-283`: zonas a ≤ 300 m, `walkerBudget`, os mais perto primeiro). A malha é alocada com `cap` instâncias (`InteriorScene.ts:255-257`), e quem passa de 300 m sai (`:284`). O recálculo deu 400 (high) e 200 (low) em (0, 0). Aceito.
6. **Teste extra "crane beacon blinks"**. Ele prova a metade de browser que a C28 promete ("No browser, o emissiveIntensity…"), e que o `checks.md` não lista como Proof. Conta como evidência de C28. O `checks.md` deveria ganhar essa linha de Proof.
7. **Sem collider de piscina**. Nenhum AC pede, e o Flow 7 e o Impact já foram corrigidos no merge ff0934a. `WorldPhysics.ts:81-99` só cria troncos e torres, o que bate com C35. Aceito.
8. **Não previstos no plano, e neutros para as provas**:
   - `PATIO_LIFT` 0.03 m e os triângulos do pátio desenhados sob o espelho da rua (`ChunkManager.ts:305`, `:315-319`). O C38 (terreno e janelas) continuou verde.
   - Quintal omitido quando nenhum vértice serve para o poste (`InteriorProps.ts:174`). Isso não acontece no seed 1337: 231 = 231.
   - "Lote outer" lido como `!l.downtown`.
   - O cache de agenda de `zoneLight` cresce com o tempo (`interiorMotion.ts:98-117`), cerca de 1 entrada a cada 40 s por zona, o que é desprezível.

## Gate

`npx vitest run` - 142 passed, 0 failed · `E2E_PORT=5202 npx playwright test` - 95 passed, 0 failed (43.6 min) · `npx vitest run tests/unit/interiorMotion.test.ts -t "string lights sway"` - 1 failed sob carga (timeout de 5 s, 2 vezes), 1 passed sem carga (3 de 3)

## Ranked gaps

1. **AC 23 sem prova de "perto das árvores"** - C25 - no evidence.
   - `InteriorScene.ts:457-474` põe os vagalumes em volta das árvores mais próximas, mas nenhum teste lê essas posições.
   - Uma âncora em (0, 0) ou no carro passaria em tudo.
   - Correção: acrescentar ao C25 uma asserção de browser, por exemplo "todo vagalume a ≤ N m de alguma árvore", lendo o atributo `position` exposto no `__game`.
2. **AC 7 sem prova de "do seed, escala de 8 m"** - C8 - `tests/unit/interiorMotion.test.ts:72-75` só cobre o intervalo.
   - Uma mutação de `GROUND_NOISE_SCALE` ou de `seed ^ 0x6a55` passa.
   - Correção: afirmar que o ruído muda com outro seed, e fixar a escala (correlação alta a 1 m e baixa a ≥ 16 m, ou valor conhecido em pontos da grade de 8 m).
3. **Prova de C17 sem folga de tempo** - C17 - `tests/unit/interiorMotion.test.ts:153`.
   - O teste faz cerca de 1.4 M `expect` (1386 lâmpadas × 515 instantes × 2) sem timeout próprio, contra 5 s de padrão.
   - Levou de 2.6 a 4.5 s sem carga e deu timeout 2 vezes com o Playwright em paralelo.
   - Correção: `{ timeout: 60_000 }` como os vizinhos, ou trocar o `expect` por passo por um acumulador de pior caso.
4. **"O tronco fica parado" (AC 21) com prova fraca** - C22 - `tests/e2e/interiors.spec.ts:288`.
   - As matrizes de instância nunca mudam por construção, e o balanço é por vértice no shader, com a máscara `aCrown` = 0 no tronco (`InteriorScene.ts:663`, `:689`).
   - Uma máscara 1 no tronco sobreviveria. Não injetei essa falta (o teto era 5), então é uma sobrevivente provável, não uma confirmada.
   - Correção: afirmar `aCrown` = 0 nos vértices do tronco, lido da geometria.
5. **Documentação do checks.md**: a C28 não lista a prova de browser que existe ("crane beacon blinks"), e a linha "startup config" do Coverage ainda diz "via `CityGenerator`" (hoje é `Game.ts:154-155`).
6. **Door alterada pelo builder** (bbf232d): tecnicamente aceitável (ver Deviations 1), mas pede o de acordo do usuário.
