# residuals checks

Profile: standard
Plan: `.specs/features/residuals/plan.md`

11 checks in 5 slices · 0 one-way doors · 0 open, of which 0 block

## Checks

### S1 - reflexo da rua estável · 3 files · 100 KB · ~25k

**C1** - Com o espelho da rua ligado, câmera andando 0.05 m por quadro em 10 quadros a 640×360, `__game.render.shimmer(0.05, { mirror: true })` < 0.010. Parada (passo 0), = 0 (AC 1)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "street reflection stays stable while the camera moves"`

**C2** - Sensibilidade da sonda: com o blur do espelho desligado (`mirrorBlur: false`, o shader de uma amostra de antes), a mesma medida da C1 dá > 0.010. Sem isso, a C1 passaria com uma sonda cega (AC 1)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "probe detects reflection shimmer without blur"`

**C3** - O alvo do espelho continua `floor(innerWidth × 0.5) × floor(innerHeight × 0.5)`: 320 × 180 a 640×360 (AC 2, visual-upgrade C4)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "reflector present only in high quality"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "reflection blur keeps the half-resolution target"`

**C4** - Brilho que o espelho soma à rua: luminância média da metade de baixo do quadro com o espelho, menos a mesma área com o chão escuro no lugar do espelho, é ≥ 0.6 × o mesmo ganho medido com `mirrorBlur: false`, na mesma página e na mesma pose de câmera (AC 3)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "blurred reflection keeps most of its brightness"`

### S2 - folga do tijolo na facade-glint · 2 files · 44 KB · ~11k

**C5** - Tijolo (tipo 2), farol ligado, AA ligado: `headlightShimmer(2, specular: true).flicker − headlightShimmer(2, specular: false).flicker` ≤ 0.0006 (AC 4)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "brick facade glint has margin"`

**C6** - Os tipos 0-3 continuam na C1 da facade-glint (≤ 0.0010) e na C3 (`litMean` com farol ≥ 1.2 × sem farol) (AC 4, AC 5)
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "headlight adds no facade glint"`
Proof: `npx playwright test tests/e2e/visual.spec.ts -g "headlight still lights the facade"`

### S3 - "R" da ré no HUD · 1 file · 9 KB · ~2k

**C7** - Segurando S por 5 s de simulação a partir do carro parado, com o carro já de ré (≤ -5 km/h): `#gear` mostra exatamente `R` e `__game.car.gear` = -1 (AC 6)
Proof: `npx playwright test tests/e2e/drive.spec.ts -g "reverse drives backward up to 30 kmh"`

### S4 - sondas do miolo com uma só fonte · 3 files · 60 KB · ~15k

**C8** - O movimento do vagalume tem as 6 constantes (amplitudes x/y/z 1.0, 0.4 e 1.0; frequências x/y/z 0.05, 0.06 e 0.045 Hz) exportadas uma vez de `src/world/interiors/InteriorScene.ts`. O texto do vertex shader do vagalume contém cada uma formatada, e os literais numéricos da expressão de deslocamento são exatamente essas 6 e mais 2π (6.28318530718). Nenhum outro literal (AC 7)
Proof: `npx vitest run tests/unit/shaderConstants.test.ts -t "firefly shader reads the shared constants"`

**C9** - A sonda `fireflyPositions` usa as mesmas constantes exportadas. Com uma constante trocada no teste, a posição devolvida pela função pura da sonda muda pelo valor esperado (AC 7, AC 8)
Proof: `npx vitest run tests/unit/shaderConstants.test.ts -t "firefly probe follows the shared constants"`

**C10** - O balanço de árvore e de lâmpada tem frequência e amplitude só nos atributos `aSway` gerados em TS e em `BULB_AMPLITUDE`, interpolado. As expressões de balanço no GLSL não têm literal numérico além de 2π, e as sondas C22 e C25 da block-fill continuam verdes (AC 7, AC 8)
Proof: `npx vitest run tests/unit/shaderConstants.test.ts -t "sway shaders carry no numeric literal besides two pi"`
Proof: `npx playwright test tests/e2e/interiors.spec.ts -g "C22|C25"`

### S5 - documento da block-fill · 2 files · 30 KB · ~1k

**C11** - A linha `Cost:` de `.specs/features/block-fill/checks.md` e o `.specs/STATE.md` citam as mesmas três contagens (unitárias, física real, Playwright), recontadas no build a partir dos testes que os checks da block-fill citam (AC 9)
Proof: `grep -n "Cost:" .specs/features/block-fill/checks.md` confrontado com `grep -c "^\s*\(it\|test\)(" ` sobre os arquivos que as linhas `Proof:` da block-fill citam; recontagem e comando escritos em `## Handoff`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| tipos de fachada na C1 da facade-glint (4) | 0 C6 · 1 C6 · 2 C5, C6 · 3 C6 | - |
| tipos de fachada na C3 da facade-glint (4) | 0 C6 · 1 C6 · 2 C6 · 3 C6 (um laço por tipo no mesmo teste) | - |
| modos do shader do espelho (2) | blur C1, C4 · uma amostra (`mirrorBlur: false`) C2, C4 | - |
| constantes do vagalume (6) | amp x C8 · amp y C8 · amp z C8 · freq x C8 · freq y C8 · freq z C8 | - |
| balanços com sonda em JS (3) | vagalume C8, C9 · árvore C10 · lâmpada C10 | - |
| contagens do custo da block-fill (3) | unitárias C11 · física C11 · Playwright C11 | - |

- Nenhum check afirma mais do que o caso que a própria prova exercita. C5 e C6 rodam no mesmo teste por tipo que a facade-glint já usa.

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Shader do espelho (GLSL, `CityScene.ts`) | uma no browser, com a sonda de pixels | um caso por modo (blur, uma amostra) |
| Constantes de shader compartilhadas (`InteriorScene.ts`) | uma unitária sobre o texto do shader e sobre a função da sonda | uma asserção por constante |
| Testes e documento | nenhuma própria | coberto pela própria execução |

Evidence:
- `CityScene.ts`: o reflexo decide (o blur troca o que aparece). Não há como testar GLSL fora do browser, então o nível é o Playwright, como na visual-upgrade (C41) e na facade-glint (C1-C3).
- `InteriorScene.ts`: as strings de shader são montadas por template, sem condicional. A prova é o texto montado e a função que a sonda usa.
- Precedente no repo: `tests/unit/interiorMotion.test.ts` prova em vitest as funções puras que as sondas espelham.

Cost: 5 provas Playwright novas em 2 arquivos, 3 unitárias num arquivo novo, 1 Playwright estendida.

## Swept

- validation: n/a - nenhuma entrada nova; os limites das sondas (C1, C5) são medidas, não validação
- failure modes: n/a - nenhum caminho de erro novo; o shader do espelho é compilado no boot como hoje, e uma falha cai no overlay de erro de `src/main.ts`
- idempotency: n/a - nada é gravado nem repetido
- authorization: n/a - jogo local, sem conta
- concurrency: n/a - render de uma thread; a sonda troca o shader e devolve o original no mesmo quadro síncrono (C2, C4)
- data lifecycle: n/a - nada persistido
- dependency failure: n/a - sem dependência externa nova; `Reflector` do three já é usado
- state transitions: C2 e C4 (a sonda troca para `mirrorBlur: false` e volta; a C1 roda depois no estado padrão)
- observability: C1, C4 (a sonda `render.shimmer` e a medida de ganho do espelho em `__game`, só DEV)

## Handoff

- S1 = 25k (CityScene 21 KB, Game 56 KB, visual.spec 23 KB). S2 soma 11k sobre arquivos já lidos. S3 soma 2k, S4 15k (InteriorScene 33 KB, teste novo) e S5 1k. Total ~54k, abaixo do budget de 150k: um builder só
- Mechanism: one builder (cabe no budget, sem pergunta)
