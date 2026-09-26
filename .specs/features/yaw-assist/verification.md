# Yaw assist verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: bcd092c..8fce50a (2bdc005 feat, da63391 test, merge 8fce50a)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Resumo: as 13 provas rodaram e passaram em 8fce50a. A implementação segue a fórmula literal da door 1, a inércia
de giro é a real do Rapier e o torque é a única física nova do diff. As 5 faltas injetadas morreram. O veredito é
FAIL por duas lacunas de prova, não por defeito no código:
1. **A linha "alvo limitado" da C7 não distingue o limite de `yawAssistLateralG`.** Nessa linha o torque satura
   em `yawAssistMaxNm` com ou sem o limite. Tirar o limite passa na C7 e só morre na fronteira (C5, C1, C4). Com
   isso, a linha `Test policy` de `yawAssist.ts` ("um caso por linha da tabela na própria camada") não é cumprida
   para esse ramo.
2. **O campo DEV `__game.car.yawAssistNm` (`src/core/Game.ts:566-567`) não é lido por nenhuma prova.** O `Swept`
   diz que a C8 cobre esse campo, mas a C8 lê `car.yawAssistNm` no harness, não pelo `__game`.

As duas correções são pequenas: trocar ou acrescentar uma linha na tabela da C7 e ler o campo numa prova Playwright
que já dirige o carro.

## Binding sources

O plano não marca nenhuma fonte como binding. `Sources` só traz a fala do usuário e as medições do harness.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| nenhuma fonte binding | n/a | - | - |

## Checks

Verified at 8fce50a, no worktree do Verifier. Antes de rodar, criei a junction de `node_modules`. O
`git status --porcelain` estava vazio.
- `npx vitest run --reporter=verbose`: 31 arquivos, **114 passaram**, 0 falharam, exit 0 (11.4 s). Os testes de
  geração de mundo não deram timeout, então não precisei rodar de novo.
  - Cada nome das provas vitest de C1-C13 aparece com ✓. São os 7 de `agility.test.ts`, `yaw assist torque
    follows the target yaw rate`, `pure modules do not import three or rapier`, os 2 de `stability`, os 4 de
    `grip`, os 5 de `powertrain` e os 5 de `feel` citados.
- `E2E_PORT=5198 npx playwright test tests/e2e/drive.spec.ts tests/e2e/visual.spec.ts -g "A turns left|game builds
  the car from the default spec|camera swings left while turning left|camera leans with the body"`: **4
  passaram** (1.5 min, exit 0). O log mostra `[WebServer] vite --port 5198 --strictPort` do próprio run. Não houve
  timeout de boot.
  - `drive.spec.ts:49` "A turns left", `:138` "game builds the car from the default spec".
  - `visual.spec.ts:272` "camera swings left while turning left", `:304` "camera leans with the body".

Medi os valores reais num teste de rascunho fora do repo (mesmo harness, mesmo `hold`). Os resultados abaixo
aparecem nas linhas da tabela.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 40 km/h, primeiro passo com giro ≥ 0.9 × regime ≤ 15 | vitest `points into the turn within 0.25 s at 40 kmh` ✓ | `tests/physics/agility.test.ts:43` `findIndex(r => r >= 0.9 * steady) + 1`; `:45` `toBeLessThanOrEqual(15)`; `:33` fatia 120-180 com 61 passos. Medido: passo 12, regime 52.2°/s | PASS |
| C2 | regime a 60 km/h ≥ 32°/s | vitest `turns at least 32 degrees per second at 60 kmh` ✓ | `tests/physics/agility.test.ts:50` `toBeGreaterThanOrEqual(32 * DEG)`. Medido: 34.7°/s | PASS |
| C3 | regime a 100 km/h ≥ 20°/s | vitest `turns at least 20 degrees per second at 100 kmh` ✓ | `tests/physics/agility.test.ts:55` `toBeGreaterThanOrEqual(20 * DEG)`. Medido: 20.53°/s (margem de 2.6 %) | PASS |
| C4 | depois de soltar, < 3°/s em ≤ 48 passos e fica abaixo até o passo 60 | vitest `stops turning within 0.8 s after release` ✓ | `tests/physics/agility.test.ts:69` `first <= 48`; `:71` `after[i] < limit` de `first` até 60; `limit = 3 * DEG` em `:66`. Medido: passo 3 | PASS |
| C5 | 60/90/120/150/180 km/h, janela ≤ 1.05 g em todo passo | vitest `lateral grip never exceeds 1.05 g` ✓ | `tests/physics/agility.test.ts:77` as 5 velocidades; `:80` 180 passos; `:81` `toBeLessThanOrEqual(1.05)` por passo. Medido: pico 1.032 g (60 km/h) | PASS |
| C6 | 60 km/h, ≥ 0.85 g nos primeiros 120 | vitest `reaches at least 0.85 g at 60 kmh` ✓ | `tests/physics/agility.test.ts:88` 120 passos; `:89` `Math.max(...g) >= 0.85`. Medido: 1.032 g | PASS |
| C7 | fórmula da door 1, tabela de 8 linhas, tol 1e-6 | vitest `yaw assist torque follows the target yaw rate` ✓ | `tests/unit/yawAssist.test.ts:6-13` ficha 4/5000/1.1/2.6, inércia 2000; linhas `:28-35`; `:40` `abs(t − expected) <= 1e-6`; `:44` 2 rodas `not.toBe(0)`. Os 8 valores da tabela da C7 batem exatos. Mas a linha "alvo limitado" dá 5000 com ou sem o limite (ver Coverage e gap 1) | PASS |
| C8 | 3 campos finitos > 0; sem ajuda o regime a 60 km/h é ≥ 15 % menor; `yawAssistNm` > 0 andando e 0 parado | vitest `car applies the yaw assist from its spec` ✓ | `tests/physics/agility.test.ts:96-98`; `:103` `without <= 0.85 * withAssist`, que é exatamente "≥ 15 % menor". Medido: 28.79 / 34.72 = **0.829**, ou seja 17.1 % menor (2.1 pp de folga); `:109` `> 0` (medido 7903 N·m no passo 1); `:114` `toBe(0)` parado | PASS |
| C9 | `yawAssist.ts` na lista de módulos puros | vitest `pure modules do not import three or rapier` ✓ | `tests/unit/purity.test.ts:34` o módulo na lista; `:42` `toBe(25)`; `:45` `FORBIDDEN.test(source)` é `false` | PASS |
| C10 | car-handling C2 e C3 verdes, sem mudança | vitest `no rollover across the maneuver matrix` ✓, `all four wheels back on the ground after release` ✓ | `tests/physics/stability.test.ts:72` 54 casos; `:74` `maxTilt <= 15`; `:83-84` volta em 1..60 passos. `stability.test.ts` não mudou no diff | PASS |
| C11 | car-feel C10, 10 casos, sideslip ≤ 12° | vitest `understeers without throttle or at speed` ✓ | `tests/physics/feel.test.ts:117` `slip <= 12` por passo; `:119` `measured > 0`; `:122` `run` = 10. O diff de `feel.test.ts` não toca esse `it` | PASS |
| C12 | freio de mão e power slide sem mudança (ch C11, C12, C13, C36) | vitest os 4 nomes ✓ | `tests/physics/grip.test.ts:25` `max > 20`; `:50`, `:59` chuta e recupera; `:91` `turned >= 0.2`; `:37` `run(true) > run(false) + 2`. `grip.test.ts` não mudou | PASS |
| C13 | motor, freios, balanço da carroceria e browser sem mudança | vitest 5 de `powertrain` ✓, 4 de `feel` ✓; pw 4 ✓ | `tests/physics/powertrain.test.ts:20-21`, `:38-40`, `:53-54`, `:71-72`, `:84`; `tests/physics/feel.test.ts:36-40`, `:53-57`, `:71-72`, `:84-85`; `tests/e2e/drive.spec.ts:60` `d > 0.15`, `:143` `toBe(32)`, `:144` `live toEqual expected`; `tests/e2e/visual.spec.ts:291-293`, `:299-300`, `:349`, `:351`. Só `drive.spec.ts:143` mudou (29 → 32 campos, a ficha cresceu 3) | PASS |

### Julgamento da implementação

- **Fórmula literal.** `src/vehicle/yawAssist.ts:28-34` bate com a door 1, termo a termo:
  - zero com `|v| < 2` ou `wheelsInContact < 2` (`:29`);
  - `kinematic = v · tan(steer) / wheelbaseM` (`:30`), com o sinal de `v`, então a ré inverte o alvo;
  - limite `yawAssistLateralG · 9.81 / |v|` (`:31`);
  - `sign(kinematic) · min(|kinematic|, limite)` (`:32`);
  - `gain · inertia · (alvo − yawRate)` (`:33`), com clamp em ±`yawAssistMaxNm` (`:34`).

  O plano escreve só "sign". Ler como o sinal de `v · tan(steer)` é o que a linha "ré" da C7 exige.
- **Inércia real.** `src/vehicle/Car.ts:355` usa `this.body.effectiveAngularInertia().m22`. No `rapier3d-compat`
  0.21.0 isso é "the effective world-space angular inertia" (`dist/dynamics/rigid_body.d.ts:377-383`), e `m22` é o
  elemento linha 2, coluna 2 (`dist/math.d.ts:78-80`), o `Iyy` no mundo. Medido no harness: `m22` = 2172 kg·m²
  (`m11` = 1689), com massa de 1250 kg. É um valor plausível, não uma constante.
- **Entradas certas.** `this.drive.steer` (`Car.ts:358`) é o ângulo depois da rampa, o mesmo que vai para
  `setWheelSteering` (`:176`). `this.speedMs()` (`:258-262`) é a velocidade ao longo da frente, negativa em ré.
  `angvel().y` é o giro no eixo Y do mundo, o mesmo eixo do torque, como a door pede.
- **Ordem e dt.** A ajuda roda em `Car.ts:180`, depois de `updateVehicle` (`:178`) e `restoreRollMoment` (`:179`)
  e antes de `applyResistance` (`:181`). O `world.step` vem depois (`tests/physics/harness.ts:80-81`). O impulso é
  `yawAssistNm * dt` (`Car.ts:364`), ou seja torque × passo. A falta F4 mostra que tirar o `dt` quebra C4 e C5.
- **Só uma física nova (AD-013).** No diff de `src/`, a única física nova é `applyYawAssist` (`Car.ts:354-365`).
  Fora isso há a mudança de ajuste `tireGrip` 0.86 → 0.97 (`carSpec.ts:88`), os 3 campos (`carSpec.ts:54-58`,
  `:98-100`) e o getter DEV (`Game.ts:566-567`). Nada mais em `Car.ts` mudou.
  - Observação sobre o texto da AD-013: "Nenhuma outra física própria" não é literalmente verdade na árvore.
    `restoreRollMoment` (`Car.ts:328-351`, car-feel) e `applyResistance` (`Car.ts:305-318`, car-handling) já
    existiam e também são física própria. Não é defeito desta feature, mas o texto deveria dizer "nenhuma outra
    ajuda arcade".

Ferramentas de teste mudadas, conferidas pelo diff (`git diff bcd092c 8fce50a -- tests`, 36 linhas removidas):
- `feel.test.ts`: removeu só os dois testes autorizados ("lateral grip never exceeds 0.95 g", "reaches at least
  0.75 g at 60 kmh"), o helper `holdCorner` (que só eles usavam) e o import de `LateralGWindow`, que ficou sem
  uso. As asserções equivalentes estão em `agility.test.ts:81` e `:89`, com os limites novos dos AC 5 e 6.
- `carSpec.test.ts`: 29 → 32 campos e 3 nomes na lista, o que é mais forte.
- `purity.test.ts`: 24 → 25 módulos, o que é mais forte.
- `drive.spec.ts:143`: 29 → 32. O `toEqual` de `:144` continua igual.
- `stability`, `grip`, `powertrain`, `harness.ts` e `visual.spec.ts` não mudaram.

Nenhuma outra asserção sumiu, nenhum matcher ficou mais frouxo e nenhuma tolerância cresceu. A nota de superado em
`.specs/features/car-feel/checks.md:75` e o comentário em `feel.test.ts:90` registram a troca.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (11) | `plan.md` Criteria, AC 1-11 | 1 C1 `:45` · 2 C2 `:50` · 3 C3 `:55` · 4 C4 `:69`, `:71` · 5 C5 `:81` · 6 C6 `:89` · 7 C7 `yawAssist.test.ts:40`, C8 `agility.test.ts:109`, `:114` · 8 C10 · 9 C11 · 10 C12 · 11 C13 | - |
| landing doors (1) | `plan.md` Landing | assinatura e fórmula C7; `CarSpec` com 3 campos C8 `:96-98` e `carSpec.test.ts:75-76`; pureza C9; aplicação pelo `Car` C8 `:103` | - |
| yaw assist cases (8) | a door 1 (alvo, limite, clamp, sinal, zeros) e a tabela da C7 | alvo livre `yawAssist.test.ts:28` · alvo limitado `:29`, **não distingue o limite** · lado oposto `:30` · soltar `:31` · ré `:32` · < 2 m/s `:33` · 1 roda `:34` · 2 rodas `:43-44` | alvo limitado: com `steer` 0.3, `v` 10 e `yawRate` 0, o torque é 8632.8 com o limite e 9518 sem ele, e o clamp de 5000 esconde os dois. Sem o limite a C7 passa (falta F2); só C5, C1 e C4 pegam, na fronteira |
| ramos da fórmula (5) | `src/vehicle/yawAssist.ts:29-34` | guarda de velocidade `:33` da tabela · guarda de rodas `:34` e `:43-44` (F1 morre) · sinal pelo `v` `:32` · limite lateralG só na fronteira (C5 `agility.test.ts:81`) · clamp `:29-30` (sem o clamp daria 8632.8) | limite lateralG na própria camada (mesmo membro de cima) |
| spec fields (3) | `plan.md` Landing, `src/vehicle/carSpec.ts:54-58` | gain, maxNm, lateralG: existem, são finitos e > 0 (`agility.test.ts:96-98`, `carSpec.test.ts:64-65`, `:75-76`). O `Car` lê a ficha: `maxNm` observado em `agility.test.ts:103` (F5 morre). `gain` e `lateralG` passam no mesmo objeto `this.spec` (`Car.ts:357`), o que só se vê lendo o código | - |
| DEV fields do plano, Surface (1) | `plan.md` Surface; `src/core/Game.ts:566-567` | `Car.yawAssistNm` C8 `agility.test.ts:109`, `:114` no harness | `__game.car.yawAssistNm`: nenhuma prova Playwright lê o getter. O `rg "yawAssistNm" tests/` só acha `agility.test.ts:109` e `:114`, que leem o `Car` direto |
| superseded car-feel checks (2) | diff de `tests/` e `car-feel/checks.md:75` | cf-8 → C5 `agility.test.ts:81` (≤ 1.05) · cf-9 → C6 `:89` (≥ 0.85). Só esses dois testes e o helper deles saíram | - |
| startup config: car construction (1 assembly) | `src/core/Game.ts:159` `new Car(..., DEFAULT_CAR)` | ch C35 `tests/e2e/drive.spec.ts:143-144`, rodado ✓ com 32 campos | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/vehicle/yawAssist.ts` | própria C7 · fronteira C1-C4, C8 | no - na fronteira está coberto (C1-C5 e C8; F2, F3 e F4 morrem lá). Na própria camada, o ramo do limite `yawAssistLateralG` (`yawAssist.ts:31-32`) não tem caso que o distinga: a linha "alvo limitado" (`yawAssist.test.ts:29`) satura no clamp. Os outros ramos têm caso |
| Car aplica o torque e lê a ficha ("fronteira pelo harness") | `src/vehicle/Car.ts` | C8 | yes. `agility.test.ts:103` separa "lê a ficha" de "usa constante" pelo `maxNm` (F5 morre). O sinal (F3) e o `dt` (F4) morrem em C8 e C5 |
| Dados | `src/vehicle/carSpec.ts` | C8 | yes. `agility.test.ts:96-98`; `carSpec.test.ts:75-76` com os 32 campos |
| Instrumentation, pass-throughs | `src/core/Game.ts` (getter DEV) | coberto pela prova do consumidor | no - nenhum consumidor lê `__game.car.yawAssistNm` (ver Coverage) |

## Faults injected

Rodei tudo num worktree de rascunho separado (`git worktree add --detach <scratchpad>/fault-wt HEAD`, com junction
de `node_modules`), nunca com `git stash`.
- Uma falta por vez. Desfiz cada uma com a edição inversa antes da seguinte.
- No fim apaguei a junction (`.Delete()`), removi o diretório e rodei `git worktree prune`. O `git worktree list`
  não mostra mais o rascunho.
- O `git status --porcelain` do worktree do Verifier estava vazio antes e depois (conferido com `diff` contra a
  linha de base salva).

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 sem a guarda de rodas: `if (speed < MIN_SPEED_MS) return 0` | `src/vehicle/yawAssist.ts:29` | yes. C7 `tests/unit/yawAssist.test.ts:40` "one wheel on the ground: got 5000, expected 0" |
| F2 sem o limite lateralG: alvo = `sign · |kinematic|` | `src/vehicle/yawAssist.ts:32` | yes, mas só na fronteira: C5 `agility.test.ts:81` "60 km/h step 18: 1.0601 ≤ 1.05", C1 `:45` "18 ≤ 15", C4 `:71` "step 20 after release", C11 `feel.test.ts:117` "12.11 ≤ 12" e car-feel C1/C2. **A C7 (`yawAssist.test.ts`) passou**, que é o gap 1 |
| F3 sinal trocado no chassi: impulso `y: -yawAssistNm * dt` | `src/vehicle/Car.ts:364` | yes. C8 `tests/physics/agility.test.ts:103` "0.5025 ≤ 0.1033" (o giro com ajuda caiu para abaixo do giro sem ela) |
| F4 sem `dt`: impulso `y: yawAssistNm` | `src/vehicle/Car.ts:364` | yes. C5 `tests/physics/agility.test.ts:81` "60 km/h step 1: 6.16 ≤ 1.05"; C4 `:68` também |
| F5 o `Car` ignora a ficha: passa `{ ...this.spec, yawAssistGain: 10, yawAssistMaxNm: 12000, yawAssistLateralG: 1.25 }` | `src/vehicle/Car.ts:357` | yes. C8 `tests/physics/agility.test.ts:103` "0.6060 ≤ 0.5151" (a ficha com `maxNm` 0 não desligou a ajuda) |

F5 morre só pelo `maxNm`. Uma variante que fixe só `gain` ou só `lateralG` nos valores padrão seria equivalente
para `DEFAULT_CAR` e passaria. Hoje o `Car` passa a ficha inteira (`Car.ts:357`), então isso é uma observação,
não um membro sem prova.

## Swept existing

- **dependency failure** (existing): "sem o GLB, o carro placeholder usa a mesma física (check 33 da
  free-roam-city)". Confere.
  - `free-roam-city/checks.md:119` é a C33.
  - No `Car`, os assets só entram em `placeholder` (`Car.ts:99`) e em `buildVisual` (`:155`, `:430`).
    `applyYawAssist` não lê assets.
  - O harness roda com `placeholder: true` (`tests/physics/harness.ts:23`), e todas as provas de física passaram
    assim.
- **observability** (C8): cita `__game.car.yawAssistNm` e o campo no `Car`. O campo no `Car` está provado. O
  getter DEV (`Game.ts:566-567`) existe, está no bloco DEV, mas nenhuma prova o lê. Ver Coverage.
- Os outros `Swept` são `n/a` (idempotência, autorização, concorrência, ciclo de vida) ou apontam para checks já
  julgados acima (validation e failure modes → C7 e C10, state transitions → C4).

## Deviations judged

1. **`tireGrip` 0.86 → 0.97** (`carSpec.ts:88`). O plano autoriza ("`tireGrip` sobe"; o Handoff chama de número
   de ajuste). As provas que continuam valendo (C10-C13) passaram com o valor novo. Aceito.
2. **Valores da ficha** `gain` 10, `maxNm` 12000, `lateralG` 1.25. O Assumptions falava em lateralG "~1.1", e o
   Handoff deixa esses números para o build até C1-C13 passarem. Aceito.
3. **Margens estreitas.** C3 está em 20.53°/s contra 20, C5 em 1.032 g contra 1.05 e C8 em 0.829 contra 0.85.
   Todas passam, mas um ajuste pequeno no sub-projeto 4 pode derrubar qualquer uma. Anotado, não muda o veredito.

## Gate

`npx vitest run` - 114 passed, 0 failed · `E2E_PORT=5198 npx playwright test tests/e2e/drive.spec.ts tests/e2e/visual.spec.ts -g "A turns left|game builds the car from the default spec|camera swings left while turning left|camera leans with the body"` - 4 passed, 0 failed

## Ranked gaps

1. **O limite `yawAssistLateralG` não é distinguido na própria camada** - C7 - `tests/unit/yawAssist.test.ts:29`.
   - Com `steer` 0.3, `v` 10 e `yawRate` 0, o torque saturaria em 5000 com ou sem o limite. F2 (sem o limite)
     passa na C7.
   - Correção: acrescentar uma linha em que o torque limitado fique abaixo do clamp. Por exemplo `steer` 0.3,
     `v` 10, `yawRate` 0.5, 4 rodas: esperado `4 · 2000 · (1.0791 − 0.5)` = 4632.8. Sem o limite seria
     `4 · 2000 · (1.1898 − 0.5)` = 5518 → 5000.
   - Atualizar a tabela da C7 em `checks.md` junto. É uma lacuna de precisão do próprio check: o valor esperado
     escolhido esconde o ramo que a linha nomeia.
2. **`__game.car.yawAssistNm` sem prova** - C8 / Swept observability - `src/core/Game.ts:566-567`, no evidence
   em `tests/e2e`.
   - Correção: ler o campo numa prova Playwright que já dirige (por exemplo, "A turns left": `> 0` com `A`
     segurado), ou tirar o campo do Surface e do Swept.
3. **Borda de 2 m/s não afirmada** (não reprovei por isso) - C7 - `yawAssist.test.ts:33` só testa 1.9.
   - Um `<=` no lugar de `<` em `yawAssist.ts:29` passaria. Uma linha com `v` = 2.0 → ≠ 0 fecha a borda.
4. **Texto da AD-013** - `.specs/STATE.md:41`. "Nenhuma outra física própria" contradiz `restoreRollMoment` e
   `applyResistance`, que já existiam. Sugestão: "nenhuma outra ajuda arcade".
