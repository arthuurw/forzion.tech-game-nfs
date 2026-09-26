# Facade glint verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: db836b8..0de0614 (commits da branch: df8ec5e, 72b5385, f62bb8f, 485580d, 95d3011; merge em main 0de0614)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Resumo: as 5 checks têm prova rodada em 0de0614 e asserção localizada. `tests/e2e/visual.spec.ts` inteiro passou
(30/30, porta 5190), e `npx vitest run` passou (103/103). Os 5 mutantes morreram, um por superfície de asserção
(C1 duas vezes, em causas diferentes; C2; C3; C5). Os valores da sonda em HEAD batem com os "Valores finais" do
`## Handoff`. O tipo 2 (tijolo) é o de menor margem no C1: 0.00074 contra o limite 0.0010, repetido 4 vezes com
variação de ±0.00001. O merge 0de0614 manteve os dois lados do conflito em `src/core/Game.ts`:
`this.spawn = spawn` (`:158`) e `new Car(..., DEFAULT_CAR)` (`:159`). `git diff 376766b 0de0614 --stat` é
idêntico ao diff da branch (4 arquivos, +296/−11), então o merge não trouxe mudança própria.

## Binding sources

O plano (`## Intent` de `checks.md`, sem `plan.md`) não marca nenhuma fonte como binding. Com o profile `standard`,
este passo não roda.

## Checks

Rodadas no worktree do Verifier em 0de0614 (junction de `node_modules`):
- `E2E_PORT=5190 npx playwright test tests/e2e/visual.spec.ts --reporter=list` resultou em **30 passed**, exit 0, em
  8.2 min. O vite subiu pelo próprio run (`vite --port 5190 --strictPort`), e o `netstat` não mostrava nada na 5190 antes.
  Os nomes aparecem um a um com ✓:
  `:81 four facade meshes with per-instance repeat`, `:304 lit windows stay stable while the camera moves`,
  `:426 headlight adds no facade glint`, `:437 probe detects glint without specular antialiasing`,
  `:451 headlight still lights the facade` e `:462 specular antialiasing on by default`.
- `npx vitest run` resultou em 27 arquivos e **103 passed**, 0 failed. Não há teste vitest nesta feature, que não tem
  lógica pura nova. Esta rodada é regressão.

Valores medidos em HEAD. Usei uma spec só de log no worktree de rascunho, com a mesma sonda e as mesmas opções dos
testes, e ela foi apagada no fim:

| Tipo | C1 spec − flat (AA) | C2 spec − flat (sem AA, materiais antigos) | C3 litMean on / off |
| --- | --- | --- | --- |
| 0 Concrete034 | 0.000050 | 0.000328 | 1.437 |
| 1 MetalPlates006 | 0.000359 | 0.022278 | 2.109 |
| 2 Bricks059 | 0.000743 | 0.006851 | 1.503 |
| 3 PaintedPlaster017 | 0.000296 | 0.000259 | 1.284 |

Repeti a medida de C1 3 vezes por tipo, na mesma página. Tipo 0: 0.000054 / 0.000045 / 0.000038. Tipo 1:
0.000345 / 0.000365 / 0.000363. Tipo 2: 0.000743 / 0.000743 / 0.000749. Tipo 3: 0.000296 nas três. A sonda com AA é
estável na casa de 1e-5, e o tipo 2 ficou 4 vezes entre 0.000743 e 0.000749. Não vi nenhum valor perto do limite.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 4 tipos, farol + AA: `flicker(specular on) − flicker(specular off)` ≤ 0.0010 | pw `headlight adds no facade glint` ✓ (48.4 s) | `tests/e2e/visual.spec.ts:432` `expect(spec.flicker - flat.flicker, \`facade type ${type}\`).toBeLessThanOrEqual(0.001)`, dentro do laço sobre `FACADE_TYPES` = `[0, 1, 2, 3]` (`:416`). O caso sem especular é `:431` `{ headlight: true, specularAA: true, specular: false }` | PASS. Valores: 0.00005 · 0.00036 · 0.00074 · 0.00030 |
| C2 | sem AA e com a aparência de `db836b8`, algum tipo passa de 0.0010 na mesma diferença | pw `probe detects glint without specular antialiasing` ✓ (52.8 s) | `tests/e2e/visual.spec.ts:447` `expect(Math.max(...diffs)).toBeGreaterThan(0.001)`. As opções são `:442` `{ headlight: true, specularAA: false, legacyMaterials: true }` e `:444` `specular: false` | PASS. O tipo 1 dá 0.0223 e o tipo 2 dá 0.0069 |
| C3 | 4 tipos, com AA: `litMean(on)` ≥ 1.2 × `litMean(off)` | pw `headlight still lights the facade` ✓ (50.0 s) | `tests/e2e/visual.spec.ts:457` `expect(on.litMean, \`facade type ${type}\`).toBeGreaterThanOrEqual(1.2 * off.litMean)`, e `:456` `{ headlight: false, specularAA: true }` | PASS. Razões: 1.44 · 2.11 · 1.50 · 1.28 |
| C4 | C41 e "four facade meshes" verdes, sem mudar asserções | pw `lit windows stay stable while the camera moves` ✓; pw `four facade meshes with per-instance repeat` ✓ | `tests/e2e/visual.spec.ts:309` `expect(still).toBe(0)`, `:310` `expect(moving).toBeLessThan(0.01)`; `:84` `expect(meshes.length).toBe(4)`, `:94` `toContain(\`/textures/${expectedSets[i]}/\`)`. `git diff db836b8 HEAD -- tests/e2e/visual.spec.ts` só tem linhas `+` (53, todas depois de `:413`) | PASS |
| C5 | AA ligado por padrão; `__game.materials.facadeSpecularAA` é `true` logo depois de `ready` | pw `specular antialiasing on by default` ✓ (4.0 s) | `tests/e2e/visual.spec.ts:464` `expect(await page.evaluate(() => (window as any).__game.materials.facadeSpecularAA)).toBe(true)`. O getter `src/core/Game.ts:674` exige `value === 1` nos 4 materiais | PASS |

**`specular: false` zera só o especular da fachada, e C1 não passa por vazio.** O uniform `uFacadeSpecular` só
existe no shader das fachadas (`src/world/CityScene.ts:390`). Ele multiplica `specularColor`,
`specularColorBlended` e `specularF90` depois de `lights_physical_fragment` (`:481-483`). No three 0.186.1,
`BRDF_GGX` usa `f0 = material.specularColorBlended` e `f90 = material.specularF90`
(`node_modules/three/src/renderers/shaders/ShaderChunk/lights_physical_pars_fragment.glsl.js:160-161`). Então o
especular direto do farol fica exatamente 0. O "flat" de C1 é a mesma fachada sem o lóbulo do farol, e não um
render vazio.

C1 também não pode passar por um "specular on" que já estivesse zerado. A sonda põe 1 quando `specular !== false`
(`src/core/Game.ts:891`). E o mutante F3, que faz a sonda nunca zerar (a diferença vai a ~0 e C1 passaria por vazio),
morre em C2.

Há dois efeitos colaterais pequenos, que não anulam a separação. A frase "difuso igual" do passo 4 da sonda é um
pouco otimista por causa deles:
- O difuso direto ganha a parcela `(1 − F)`, com `F` = 0 (`:546`).
- O especular indireto do ambiente, na parte metálica, continua. Ele vem de `computeMultiscattering(...,
  material.diffuseColor, ...)` (`:614`), pesado por `metalness`: 0.05 hoje e 0.5 no metal antigo.

Nenhum dos dois se move com o farol.

**`legacyMaterials` restaura mesmo os valores de `db836b8`, e depois volta aos atuais.** Em `db836b8`:
- `metalness: type === 1 ? 0.5 : 0.05` (`git show db836b8:src/world/CityScene.ts:353`);
- `normalScale` era o padrão (1, 1), porque não havia `normalScale.set`;
- a rugosidade era `mix(roughnessFactor, 0.08, glass)` (`:436`).

A sonda põe `normalScale.set(1, 1)`, `metalness = i === 1 ? 0.5 : 0.05` e piso 0 (`src/core/Game.ts:899-904`). Com
piso 0, `max(roughnessFactor, 0)` é a identidade (`src/world/CityScene.ts:466`). Com `uSpecularAA` 0, `mix(r, aa,
0)` = r (`:480`), e `uFacadeSpecular` 1 multiplica por 1. Então o shader fica equivalente ao de `db836b8`.

A volta vem de uma cópia salva antes (`src/core/Game.ts:894-898`) e é aplicada em `:931-935`. Medi isso: C1 de novo
depois de uma sonda legacy deu 0.006147 contra 0.006151 no tipo 0, e o mesmo padrão nos outros. Depois de todas as
sondas, `facadeSpecularAA` continua `true`.

**C2 não é vazio.** Os tipos 1 e 2 passam do limite com folga (22× e 7×), e o F3 mostra que a asserção de C2 cai
quando a separação da sonda some.

Uma observação: o tipo 0 legacy agora dá 0.00033, contra 0.00122-0.0023 no Handoff. A geometria dos lotes mudou em
main (`facadeTransform`, de city-terrain), depois da base da branch. C2 continua de pé pelos tipos 1 e 2.

**C3 continua mostrando o farol na fachada.** Com AA, a razão fica entre 1.28 e 2.11. O F5 (a sonda ignora
`headlight: false`) derruba C3 no tipo 0 (0.232 contra o mínimo de 0.278). A asserção separa farol ligado de desligado.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| facade types (4) | `src/world/CityScene.ts:119-121` (laço `type < FACADE_TYPES`, `FACADE_SETS`), e o set de cada tipo afirmado em `tests/e2e/visual.spec.ts:93-94` | 0 Concrete034 C1 `:432`, C3 `:457` · 1 MetalPlates006 C1, C3 · 2 Bricks059 C1, C3 · 3 PaintedPlaster017 C1, C3. O laço dos testes usa `[0, 1, 2, 3]` (`:416`), e os valores de cada tipo estão acima | - |
| probe states (5) | as chaves que a sonda realmente lê: `src/core/Game.ts:887` (farol), `:889` (AA), `:891` (especular), `:899` (legacy) | especular + AA + farol: C1 `:430`, C3 `:455` · sem especular + AA + farol: C1 `:431` · especular sem AA legacy: C2 `:443` · sem especular sem AA legacy: C2 `:444` · farol desligado + AA: C3 `:456` | - |
| valores finais de aparência do Handoff (6) | `checks.md` "Valores finais" contra o código | σ² 2 `src/world/CityScene.ts:477` · κ 1 `:478` · metal `metalness` 0.05 `:371` · `normalScale` [1, 0.2, 0.25, 1] `:28` · piso [0, 0, 0.6, 0] `:30` · piso aplicado antes do vidro `:466`. Todos iguais ao registrado e provados em conjunto por C1 (F2 e F4 mostram que o AA e o piso sustentam a prova) | - |
| startup config: facade material (1 assembly) | li a montagem direto: `makeFacadeMaterial` (`src/world/CityScene.ts:360`) só é chamada em `:121`, e o `grep` de `makeFacadeMaterial(` em `src/` dá só essas 2 linhas | o uniform nasce `{ value: 1 }` (`:60`), vai para os 4 materiais (`:121`), é ligado ao shader (`:389`) e sai em `userData` (`:487`). C5 lê esse valor no browser | - |
| alcance das chaves DEV em produção (3 caminhos) | `grep` de `facadeSpecularAA.value`, `facadeSpecular.value` e `probeHeadlightShimmer` em `src/` | os únicos que escrevem são `src/core/Game.ts:889`, `:891` e `:929-930` (a restauração), todos dentro de `probeHeadlightShimmer` (`:851`). O único chamador é `render.headlightShimmer` (`:643`), dentro do objeto de `debugHandle()` (`:358`). Esse objeto só vira `window.__game` via `exposeDebug(import.meta.env, ...)` (`src/main.ts:42`), que retorna se `!env.DEV` (`src/core/exposeDebug.ts:11`, com prova unitária em `tests/unit/exposeDebug.test.ts:10`). Em produção o uniform fica 1 e o piso fica nos valores das constantes | - |

Não achei nenhum set sem linha. Os dois lados do conflito do merge não são enumeração da feature. Conferi os dois
acima (`src/core/Game.ts:158-159`).

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/world/CityScene.ts`: o trecho GLSL de AA, o zerador de especular, o piso e as constantes por tipo | na fronteira: C1, C2, C3 nos 4 tipos. Camada própria: não existe fora do render (GLSL sem ramo, uma fórmula contínua, como diz a Evidence de `checks.md`) | yes. A única "decisão" é o uniform de AA ligado ou desligado, e os dois lados estão afirmados: ligado em C1 `:432`, desligado em C2 `:447`. O valor padrão está em C5 `:464`. Uma pure layer testável não faz sentido para um trecho de shader, e o artefato aprovou a prova só na fronteira |
| Decides, not reached across a boundary | nenhum arquivo do diff | um caso por linha | n/a |
| Entry point that decides nothing | nenhum arquivo do diff | accepted / rejected / error | n/a |
| Instrumentation, pass-throughs | `src/core/Game.ts`: `probeHeadlightShimmer`, `render.headlightShimmer`, `materials.facadeSpecularAA` | coberto pela prova de quem consome | yes. C1, C2 e C3 consomem a sonda; C5 consome o getter. F3 e F5 mostram que as provas dependem do comportamento da sonda |

## Faults injected

As faltas rodaram num worktree separado (`git worktree add --detach <scratchpad>/fg-faults HEAD`, com junction de
`node_modules`), nunca com `git stash`. Cada mutação trocou uma linha. Conferi o `git diff` antes de cada rodada e
voltei com `git checkout --` antes da próxima. A prova mais estreita rodou com `E2E_PORT=5190`, com o vite do próprio
rascunho, depois que a suíte do worktree do Verifier terminou. Assim, o `reuseExistingServer` não reaproveitou
o servidor errado.

O `git status --porcelain` do worktree do Verifier estava vazio antes. Antes deste relatório ser escrito, ele era
igual (`diff` vazio). A junction do rascunho saiu com `.Delete()`, e o `node_modules` real continua intacto. O
`git worktree remove --force` tirou o rascunho, e `git worktree list` confirma.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 uniform de AA nasce desligado: `readonly facadeSpecularAA = { value: 1 }` → `{ value: 0 }` | `src/world/CityScene.ts:60` | yes - C5 `tests/e2e/visual.spec.ts:464` "Expected: true, Received: false" |
| F2 fórmula de AA desligada: `mix(material.roughness, aaRoughness, uSpecularAA)` → `mix(..., 0.0)` | `src/world/CityScene.ts:480` | yes - C1 `tests/e2e/visual.spec.ts:432` "facade type 2, Expected: <= 0.001, Received: 0.0013572". C5 não pega (o uniform continua 1). Só o tipo 2 cai: sem AA, com os materiais novos, os tipos 0, 1 e 3 dão 0.00031, 0.00058 e 0.00026 |
| F3 a sonda não zera o especular: `opts.specular === false ? 0 : 1` → `1` | `src/core/Game.ts:891` | yes - C2 `tests/e2e/visual.spec.ts:447` "Expected: > 0.001, Received: 0.000309". Com essa falta, a diferença de C1 iria a ~0 e C1 passaria por vazio; é C2 que guarda isso |
| F4 piso de rugosidade do tijolo removido: `[0, 0, 0.6, 0]` → `[0, 0, 0, 0]` | `src/world/CityScene.ts:30` | yes - C1 `tests/e2e/visual.spec.ts:432` "facade type 2, Expected: <= 0.001, Received: 0.0014245" |
| F5 a sonda ignora o farol desligado: `opts.headlight ? intensity : 0` → `intensity` | `src/core/Game.ts:887` | yes - C3 `tests/e2e/visual.spec.ts:457` "facade type 0, Expected: >= 0.27838, Received: 0.23199" |

Não injetei a volta do `metalness` do metal para 0.5, uma das ideias do brief, por causa do teto de 5. A superfície dela
(C1 no tipo 1) é a mesma asserção `:432` de F2 e F4. O efeito aparece nos valores de C2: 0.0223 no tipo 1 com os
materiais antigos.

## Swept existing

- **dependency failure** (existing): sem o set de textura, a fachada fica em cor chapada. Vale `color: set ? tint :
  '#2a2c36'` (`src/world/CityScene.ts:368`), e o normal map, o roughness map e o `normalScale` só entram dentro de
  `if (set)` (`:375-382`). A prova que já existia, `missing texture set falls back to flat color`
  (`tests/e2e/visual.spec.ts:29`), passou nesta rodada. Na fachada chapada, o AA não faz nada, porque a derivada da
  normal da caixa plana é 0. O piso 0.6 do tipo 2 também não muda nada, porque a rugosidade base é 0.85. A restrição
  citada está no código.
- As outras linhas do Swept são `n/a` ou apontam para C2, C3 e C5, que estão verificadas acima.

## Deviations judged

- As checks C1 e C2 foram renegociadas, e o usuário autorizou as mudanças de aparência (`checks.md` `## Handoff`,
  duas decisões de 2026-09-26). O código segue os "Valores finais" registrados, um por um (tabela de Coverage). Não há
  desvio.
- As medidas em HEAD batem com as do Handoff para C1 e C3: 0.00016/0.00038/0.00072/0.00030 no Handoff, contra
  0.00005/0.00036/0.00074/0.00030 aqui. C2 mudou no tipo 0 (ver acima), sem efeito no veredito.

## Gate

`E2E_PORT=5190 npx playwright test tests/e2e/visual.spec.ts` - 30 passed, 0 failed · `npx vitest run` - 103 passed, 0 failed

## Ranked gaps

Nenhuma lacuna que falhe a feature. Resíduos que não mudam o veredito:
1. A margem do tijolo em C1 é de 26 %: 0.00074 contra 0.0010, com variação medida de ±0.00001 na mesma página. A
   varredura de altura do Handoff dá no máximo 0.00072. Uma mudança sub-pixel na cena, como altura do carro ou
   geometria do lote, pode aproximar o valor do limite. C1 - `tests/e2e/visual.spec.ts:432`.
2. O AA sozinho só é necessário no tipo 2. Sem a fórmula (F2), os tipos 0, 1 e 3 passam pelos materiais novos. C1
   prova o conjunto AA + materiais, não o AA isolado, e isso bate com o que o usuário aprovou. C5 afirma o valor do
   uniform, e não a fórmula.
3. Precisão da descrição da sonda (`checks.md`, passo 4, "difuso igual"): com `specular: false`, o difuso direto
   ganha `(1 − F)`, e o especular indireto metálico do ambiente continua, pesado por `metalness`. O lóbulo direto do
   farol, que é o que C1 isola, fica exatamente 0.
4. Sem AA, duas sondas legacy com opções idênticas variaram até 0.00031 (é o valor que C2 recebeu sob F3). Com AA, a
   variação é de 1e-5. C2 tem folga de 7× a 22×, então isso não o ameaça.
