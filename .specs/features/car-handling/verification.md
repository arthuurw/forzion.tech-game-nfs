# Car handling verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: db836b8..202999a (commits só de car-handling; o round 1 foi em a46591b; o fix é f7adc7a, merge em 02b484b). Os commits de city-terrain que o `main` também traz ficam fora: entre a46591b e 202999a eles só mexem em `src/world/WorldPhysics.ts` (guarda as referências dos colliders de pilar, sem mudar comportamento) e `tests/unit/bridges.test.ts`, e nenhuma prova de car-handling passa por eles (o harness não importa `WorldPhysics`, `tests/physics/harness.ts:1-6`)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Resumo: as duas lacunas do round 1 estão fechadas. O freio de mão com acelerador agora é uma decisão registrada
(linha "freio de mão com acelerador" em Assumptions do `plan.md`), o código segue a decisão
(`src/vehicle/drivetrain.ts:193`) e C36 a prova nas duas camadas. O freio de serviço em R tem caso próprio (C37). As
37 provas nomeadas passam em 202999a (102/102 vitest, 12/12 Playwright), e os 5 mutantes no fix morreram.

O FAIL vem de uma linha nova no recálculo da tabela de decisão, que o round 1 não contou: **R engatada sem
nenhuma entrada** (`src/vehicle/drivetrain.ts:172-178`, o `else` vazio do ramo da ré). Em marcha para frente, soltar
tudo dá freio-motor (`:183-187`, C15, C21). Em R, soltar tudo dá força 0 e freio 0: o carro desce livre, sem
freio-motor. Nenhum teste afirma isso. É o mesmo tipo de lacuna do round 1: uma saída da tabela sem caso afirmado e
sem registro no plano. É pequena, e um caso em `tests/unit/drivetrain.test.ts` ao lado de C37 fecha.

## Binding sources

Carried from a46591b. O plano não marca nenhuma fonte como binding, e o fix não tocou a interface. Com profile
`standard`, este passo não roda.

## Checks

Verified at 202999a. Todas as provas rodaram de novo, completas, no worktree do Verifier (junction de `node_modules`):
- `npx vitest run --reporter=verbose`: 27 arquivos, **102 passaram**, 0 falharam. São 99 do round 1 mais os 3 novos. Cada
  teste nomeado aparece com ✓ na saída verbose, inclusive `handbrake with throttle keeps engine force`,
  `service brake while in reverse gear` e `throttle keeps pushing with the handbrake pulled`.
- `E2E_PORT=5187 npx playwright test tests/e2e/drive.spec.ts tests/e2e/hud.spec.ts tests/e2e/audio.spec.ts tests/e2e/visual.spec.ts -g "<os 12 nomes de C32-C35>"`:
  bateu exatamente 12 testes, e os 12 passaram. A porta 5187 estava livre antes (`netstat`), então o
  `reuseExistingServer` não reaproveitou o servidor de outro worktree. Não houve timeout de boot.

Citações: as de `tests/unit/drivetrain.test.ts` e `tests/physics/grip.test.ts`, os arquivos que o fix tocou, foram
refeitas em 202999a. O fix só acrescentou linhas nesses dois arquivos (`git show f7adc7a -- tests` não tem linha
`-`), então as asserções de C11, C12, C25 e C2 continuam idênticas. As demais citações vêm de arquivos que não
mudaram desde a46591b e estão carried from a46591b.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | massa [1249, 1251], `worldCom().y` ≤ 0.50, track/(2h) ≥ 1.6 | vitest `mass and low center of mass` ✓ | `tests/physics/stability.test.ts:61-62`, `:65`, `:66` (carried from a46591b) | PASS |
| C2 | 54 casos, inclinação ≤ 15° em todo passo | vitest `no rollover across the maneuver matrix` ✓ | `tests/physics/stability.test.ts:72` `results.length` 54; `:74` `maxTilt <= 15` (carried from a46591b). A manobra "+ freio de mão" não usa acelerador, então o fix não muda o caminho dela | PASS |
| C3 | 54 casos, 4 rodas no chão em ≤ 60 passos após soltar | vitest `all four wheels back on the ground after release` ✓ | `tests/physics/stability.test.ts:83-84` (carried from a46591b) | PASS |
| C4 | média de rolagem 90-180: `steer +1` em [+1, +6], `steer −1` em [−6, −1] | vitest `body roll leans out of the turn` ✓ | `tests/physics/stability.test.ts:107-108`, `:110-111` (carried from a46591b) | PASS |
| C5 | menor arfagem em 30 passos de freio em [−4, −0.5] | vitest `nose dives under braking` ✓ | `tests/physics/stability.test.ts:124-125` (carried from a46591b) | PASS |
| C6 | rampa do volante, volta, troca de lado, espelho | vitest `steering ramps toward the target` ✓ | `tests/unit/drivetrain.test.ts:46`, `:49-51`, `:60`, `:65`, `:71`, `:75`, `:84` (linhas antes do trecho acrescentado, sem mudança) | PASS |
| C7 | alvo `min(0.55, atan(33.1578/v²))`, 7 casos | vitest `steering target shrinks with speed` ✓ | `tests/unit/drivetrain.test.ts:100` (tabela `:90-97`), `:103`, `:107` | PASS |
| C8 | 5 velocidades, ≤ 1.15 g em todo passo | vitest `lateral grip never exceeds 1.15 g` ✓ | `tests/physics/grip.test.ts:35-36` | PASS |
| C9 | 60 km/h: ≥ 0.80 g | vitest `reaches at least 0.8 g at 60 kmh` ✓ | `tests/physics/grip.test.ts:43` | PASS |
| C10 | 10 casos, sideslip ≤ 12° | vitest `understeers instead of spinning` ✓ | `tests/physics/grip.test.ts:60` `slip <= 12`; `:66` 10 casos (laço 5 × 2 em `:49-50`) | PASS |
| C11 | freio de mão: sideslip > 20° em 90 passos | vitest `handbrake kicks the rear out` ✓ | `tests/physics/grip.test.ts:79` `expect(max).toBeGreaterThan(20)` (sem mudança; o teste não usa acelerador) | PASS |
| C12 | soltando no 1º passo > 20°: < 8° em 150 passos, velocidade dianteira > 0 | vitest `car recovers after the handbrake is released` ✓ | `tests/physics/grip.test.ts:104` `kicked`; `:109` `forwardSpeed > 0`; `:113` `recovered` (andaram +12 linhas) | PASS |
| C13 | 100 km/h, freio + `steer +1`: heading ≥ +0.20 rad | vitest `steers while braking hard` ✓ | `tests/physics/grip.test.ts:145` `turned >= 0.2` (normalizado em `:144`) | PASS |
| C14 | freio a 60 km/h: motor 0, soma = `brakeForceN`, 0.65 | vitest `brake split front biased` ✓ | `tests/unit/drivetrain.test.ts:114`, `:115`, `:117`, `:118-119` | PASS |
| C15 | força pela curva, interpolação, limitador, freio-motor ≤ 0 | vitest `engine force follows the torque curve` ✓ | `tests/unit/drivetrain.test.ts:148`, `:153`, `:156`, `:163-164`, `:174` | PASS (a nota do round 1 sobre o limitador em 7000.01 continua valendo, carried from a46591b) |
| C16 | 5 casos de rpm; varredura em [1000, 7000] | vitest `rpm from wheel speed and gear` ✓ | `tests/unit/drivetrain.test.ts:184-188`, `:195-196` | PASS |
| C17 | 2ª → 3ª com corte de 0.25 s; 6ª fica | vitest `upshift at 6500 rpm with power cut` ✓ | `tests/unit/drivetrain.test.ts:207-208`, `:211`, `:215`, `:218` | PASS |
| C18 | 4ª → 3ª com hold; sobregiro; 1ª fica | vitest `downshift with hysteresis and hold time` ✓ | `tests/unit/drivetrain.test.ts:226-227`, `:235`, `:245`, `:247`, `:251` | PASS |
| C19 | 0-100 em [5.5, 7.5] s | vitest `zero to 100 kmh between 5.5 and 7.5 s` ✓ | `tests/physics/powertrain.test.ts:20-21` (carried from a46591b) | PASS |
| C20 | 60 s: [215, 240] km/h; força > 0 a 230 km/h na 6ª | vitest `top speed limited by drag` ✓; vitest `no speed cut below redline` ✓ | `tests/physics/powertrain.test.ts:38-40` (carried from a46591b); `tests/unit/drivetrain.test.ts:258-260` | PASS |
| C21 | 100 → 60 km/h sem entradas em [4, 12] s | vitest `coasting from 100 to 60 kmh` ✓ | `tests/physics/powertrain.test.ts:53-54` (carried from a46591b) | PASS |
| C22 | parada de 100 km/h em [34, 45] m | vitest `braking from 100 kmh stops in 34 to 45 m` ✓ | `tests/physics/powertrain.test.ts:71-72` (carried from a46591b) | PASS |
| C23 | rampa de 9 %: 60 km/h em ≤ 10 s | vitest `climbs a 9 percent grade` ✓ | `tests/physics/powertrain.test.ts:84` (carried from a46591b) | PASS |
| C24 | entra em R, força < 0 a −29, = 0 a −30/−31, sai com acelerador a ≥ −1 | vitest `reverse gear capped at 30 kmh` ✓ | `tests/unit/drivetrain.test.ts:268-269`, `:271-273`, `:276` | PASS |
| C25 | freio de mão: frente 0, traseira > 0, fator 0.4; sem ele 1 | vitest `handbrake locks rear and cuts rear grip` ✓ | `tests/unit/drivetrain.test.ts:283-287` (sem mudança; o caso não usa acelerador) | PASS |
| C26 | pura, estado congelado, sem as funções antigas | vitest `drivetrain step is pure` ✓ | `tests/unit/drivetrain.test.ts:330-331` `toEqual(b)`, `toEqual(copy)`; `:333-335` (andaram +27 linhas) | PASS |
| C27 | `carSpec.ts` e `drivetrain.ts` sem three/rapier | vitest `pure modules do not import three or rapier` ✓ | `tests/unit/purity.test.ts:40`, `:43` (carried from a46591b) | PASS |
| C28 | valores de `DEFAULT_CAR`; `massKg: 1500` vira `body.mass()` 1500 | vitest `default car spec values` ✓; vitest `car reads mass from its spec` ✓ | `tests/unit/carSpec.test.ts:38-54`, `:64`, `:71`; `tests/physics/harness.test.ts:174-178` (carried from a46591b) | PASS |
| C29 | harness com 4 rodas em repouso | vitest `harness builds the real car at rest` ✓ | `tests/physics/harness.test.ts:184-185`, `:192-193`, `:196-197`, `:200` (carried from a46591b) | PASS |
| C30 | tabela de 6 casos de `isSkidding` | vitest `skidding from lateral slip or handbrake` ✓ | `tests/unit/effectsMath.test.ts:80-85` (carried from a46591b) | PASS |
| C31 | derrapagem real: verdadeiro no 1º passo; reta falso em 60 passos | vitest `skidding from real lateral slip` ✓ | `tests/physics/grip.test.ts:125` `toBe(true)`; `:132` `toBe(false)` (andaram +12 linhas) | PASS |
| C32 | troca para cima no browser, queda de rpm ≥ 1500, `#gear` | pw `automatic upshift drops rpm on the hud` ✓ | `tests/e2e/hud.spec.ts:174`, `:176`, `:181` (carried from a46591b) | PASS |
| C33 | `__game.car` expõe o estado de dirigibilidade | pw `car debug exposes handling state` ✓ | `tests/e2e/drive.spec.ts:122-124`, `:126-127`, `:129`, `:134` (carried from a46591b) | PASS |
| C34 | 9 provas antigas verdes sem mudança | pw os 9 nomes ✓ | `tests/e2e/drive.spec.ts:25`, `:35`, `:44-45`, `:60`; `tests/e2e/hud.spec.ts:199-204`; `tests/e2e/audio.spec.ts:106-117`; `tests/e2e/visual.spec.ts:175-177`, `:215`, `:291-300` (carried from a46591b; `tests/e2e` não mudou desde a46591b) | PASS |
| C35 | `__game.car.spec` igual a `DEFAULT_CAR` | pw `game builds the car from the default spec` ✓ | `tests/e2e/drive.spec.ts:143`, `:144` `expect(live).toEqual(expected)` (carried from a46591b) | PASS |
| C36 (novo) | acelerador + freio de mão na 3ª a 4500 rpm: força igual à do acelerador sozinho (> 0), frente 0, traseira > 0, fator 0.4; freio de mão sem acelerador: força 0; harness a 60 km/h: com acelerador termina > 2 km/h acima de sem | vitest `handbrake with throttle keeps engine force` ✓; vitest `throttle keeps pushing with the handbrake pulled` ✓ | `tests/unit/drivetrain.test.ts:295` `drive.engineForce > 0`; `:296` `expect(slide.engineForce).toBe(drive.engineForce)`; `:297` `brakeFront` 0; `:298` `brakeRear > 0`; `:299` `toBe(spec.handbrakeRearGrip)` (o 0.4 está em `:285`); `:301` sem acelerador `toBe(0)`; `tests/physics/grip.test.ts:91` `expect(run(true)).toBeGreaterThan(run(false) + 2)`, com 60 km/h em `:87` e 60 passos em `:88` | PASS. Bate com a linha de Assumptions: "o motor continua empurrando; sem acelerador, nem motor nem freio-motor". A 4500 rpm na 3ª o freio-motor seria −447.7 N (F5), então o `toBe(0)` de `:301` separa "sem motor" de "sem freio-motor" |
| C37 (novo) | R, acelerador, −10 km/h: fica em R, força 0, soma = `brakeForceN`, frente/total = 0.65; R, S, +5 km/h: força 0, soma = `brakeForceN` | vitest `service brake while in reverse gear` ✓ | `tests/unit/drivetrain.test.ts:308` `gear` −1; `:309` força 0; `:310` `toBeCloseTo(both, 9)`; `:311` `toBeCloseTo(spec.brakeBiasFront, 9)`; `:313`; `:314` | PASS. Bate com a segunda frase da linha de Assumptions |

## Coverage

Verified at 202999a na linha que o fix tocou (drive input regimes, autoridade `src/vehicle/drivetrain.ts`). As outras
linhas vêm de autoridades que o fix não tocou e estão carried from a46591b.

Recálculo da tabela de decisão de `stepDrivetrain` (`src/vehicle/drivetrain.ts:119-202`), ramo por ramo, em 202999a:

- **volante** (`:110-117`, `:127`): ida C6 · volta C6 · troca de lado C6 · parado no alvo C6 · guarda `v` < 1 C7.
- **câmbio** (`:135-156`): entra em R C24 · sai da R C24 · sobe C17 · não sobe da 6ª C17 · desce C18 · bloqueio por
  sobregiro C18 · hold C18 · não desce da 1ª C18.
- **corte e giro** (`:132`, `:158-161`): corte na troca C17 · embreagem na 1ª e na R C16 · limitador C15, C16.
- **força, marcha ≥ 1** (`:179-187`): S freia com divisão 65/35 C14, C22 · W empurra C15, C19 · W no corte da troca
  C17 · W no limitador C15 · sem entrada, freio-motor C15 (`:174`), C21.
- **força, R** (`:172-178`):
  - S a ≤ 1 km/h empurra para trás: C24.
  - corte a −29.5 km/h: C24.
  - S a > +1 km/h aciona o freio de serviço: C37 (novo).
  - W a < −1 km/h aciona o freio de serviço: C37 (novo).
  - **sem entrada: força 0, freio 0, sem freio-motor: sem caso.**
  - O `rawRpm < redlineRpm` de `:175` é inalcançável com `DEFAULT_CAR`: a 29.5 km/h em R dá ~3380 rpm
    (8.2 m/s / 0.45 m × 9.549 × 3.6 × 5.4). Não é linha.
- **freio de mão** (`:189-196`): com W mantém a força C36 (novo) · sem W zera a força C36 `:301` (novo; C25 não afirma
  a força) · traseira = max(traseira, 6000) C25, C36 · fator 0.4 C25, C36 · sem freio de mão, fator 1 C25.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (25) | `plan.md` Criteria (carried from a46591b; o fix não mexe nos ACs) | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6, C33 · 7 C7 · 8 C8 · 9 C9 · 10 C10 · 11 C11 · 12 C12 · 13 C13, C14 · 14 C15 · 15 C16 · 16 C17 · 17 C18 · 18 C19 · 19 C20 · 20 C21 · 21 C22 · 22 C23 · 23 C30, C31 · 24 C32, C34 · 25 C32 | - |
| plan Assumptions com decisão do usuário (1 nova) | `plan.md:162` "freio de mão com acelerador" (verified at 202999a) | power slide com W C36 unit e física · sem W, nem motor nem freio-motor C36 `:301` · R com W andando para trás C37 · R com S andando para frente C37 | - |
| landing doors (3) | `plan.md` Landing (carried from a46591b) | 1 C1, C27, C35, `tests/unit/carSpec.test.ts:64` · 2 C6, C17, C18, C24, C26 · 3 C29, `vite.config.ts:6` | - |
| rollover matrix (54) | C2 (carried from a46591b) | `tests/physics/stability.test.ts:10-19`, `:72`, `:81` | - |
| maneuvers (6) | AC 2 (carried from a46591b) | `tests/physics/stability.test.ts:13-18` | - |
| understeer cases (10) | AC 10 | 5 velocidades × 2 em `tests/physics/grip.test.ts:49-50`, `:66`. A citação `:176-177` do round 1 estava errada: o arquivo tinha 135 linhas em a46591b | - |
| gearbox transitions (8) | `drivetrain.ts:135-156` (verified at 202999a; o fix não tocou este trecho) | 2→3 C17 · sem subir da 6ª C17 · corte C17 · 4→3 C18 · sobregiro C18 · hold C18 · sem descer da 1ª C18 · entrar e sair da R C24 | - |
| rpm regimes (5) | AC 15 (carried from a46591b) | C16, C15 | - |
| drive input regimes (recalculado: 12) | ramos de `src/vehicle/drivetrain.ts:158-196` em 202999a (lista acima) | acelerador C15, C19 · freio para frente C14, C22 · freio-motor C15, C21 · volante C6, C7 · ré acionada e cortada C24 · R + S andando para frente C37 · R + W andando para trás C37 · freio de mão: frente 0, traseira, fator C25, C11 · freio de mão + W mantém o motor C36 · freio de mão sem W zera o motor C36 · **R sem entrada (força 0, sem freio-motor): sem caso** | R engatada sem entrada: força 0, freio 0 e nenhum freio-motor (`src/vehicle/drivetrain.ts:172-178`, o `else` que falta depois de `:176`). Nenhum teste chama `stepDrivetrain` com `gear: -1` e `idle` afirmando força ou freio. `rg -n "gear: -1" tests` só acha `tests/unit/drivetrain.test.ts:187`, `:271-273`, `:275`, `:307`, `:312`, `:322`, todos com S ou W, e a varredura de C16 (`:190-196`) passa por `idle` em R mas só afirma rpm |
| steering target cases (7) | C7 (carried from a46591b) | `tests/unit/drivetrain.test.ts:90-97` | - |
| skidding table (6) | AC 23 (carried from a46591b) | `tests/unit/effectsMath.test.ts:80-85` | - |
| superseded free-roam checks (7) | carried from a46591b | C2 → C14 · C4 → C24 · C6 → C6, C7 · C7 → C25 · C8 → C20 · C27 → C17, C18 · C28 → C16 | - |
| superseded visual checks (1) | carried from a46591b | a unidade de visual C36 → C30; browser `tests/e2e/visual.spec.ts:198` | - |
| tests in the fix diff | `git show f7adc7a -- tests` e `git diff a46591b..202999a -- tests` | `drivetrain.test.ts` +27 e `grip.test.ts` +12, sem nenhuma linha removida. A única remoção no intervalo é em `tests/unit/bridges.test.ts` (city-terrain, fora desta feature) | - |
| startup config (2 assemblies) | carried from a46591b | `src/core/Game.ts:146` → C35 · `tests/physics/harness.ts:72` → C29, C28 | - |

Combinações que não são linhas próprias, só registro: W + S juntos (a ordem dos `if` dá precedência ao S nos dois
sentidos); S + freio de mão (a traseira fica em 6000 porque 11500 × 0.35 = 4025 < 6000); S + freio de mão em R a
≤ 1 km/h (a força de ré é zerada pela regra "sem W, sem motor", já provada em C36 na 3ª). Nenhuma delas é um ramo
novo do código.

## Test policy rows

Verified at 202999a na linha não cumprida no round 1 e nas linhas que classificam arquivos tocados
(`drivetrain.ts`). As outras estão carried from a46591b.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/vehicle/drivetrain.ts`; `src/vehicle/effectsMath.ts` `isSkidding` | own layer C6, C7, C14-C18, C20, C24-C26, C30, C36, C37 · boundary C8-C13, C19-C23, C31, C32, C36 (harness) | not met - as duas linhas do round 1 agora têm caso. O freio de mão com acelerador tem C36 nas duas camadas (`tests/unit/drivetrain.test.ts:296`, `tests/physics/grip.test.ts:91`) e virou decisão registrada (`plan.md:162`). O freio de serviço em R tem C37 (`tests/unit/drivetrain.test.ts:310`, `:314`). Falta uma linha que o recálculo achou agora: R sem entrada dá força 0 e nenhum freio-motor (`src/vehicle/drivetrain.ts:172-178`), sem caso afirmado. `effectsMath` cumpre (carried from a46591b) |
| Decides, not reached across a boundary | nenhum arquivo do diff | um caso por linha | n/a - nenhum arquivo nesta forma (carried from a46591b) |
| Entry point that decides nothing | nenhum arquivo do diff | accepted / rejected / error paths | n/a - nenhum arquivo nesta forma (carried from a46591b) |
| Instrumentation, pass-throughs | `src/core/Game.ts`, `src/hud/Hud.ts`, `src/audio/AudioEngine.ts`, `src/vehicle/Car.ts` | coberto pela prova do consumidor | yes - carried from a46591b. O fix não tocou esses arquivos |

A seção `Test policy` do `checks.md` ainda lista como "Próprias" de `drivetrain.ts` só C6, C7, C14-C18, C20, C24-C26,
sem C36 e C37. É deriva de texto, não muda a verificação.

## Faults injected

Verified at 202999a, só nas superfícies do fix. As faltas rodaram num worktree isolado
(`git worktree add --detach <scratchpad>/faults HEAD`, com junction de `node_modules`). Cada mutação partiu de uma cópia
do `drivetrain.ts` original, e o `diff` de cada uma foi conferido antes de rodar. O `git status --porcelain` do
worktree do Verifier estava vazio antes (baseline de 0 bytes) e depois. O worktree de rascunho voltou limpo antes de
ser removido: a junction foi apagada sozinha primeiro, e depois veio o `git worktree remove`.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 volta ao corte sempre: `if (!input.throttle) engineForce = 0;` → `engineForce = 0;` | `src/vehicle/drivetrain.ts:193` | yes - unit `tests/unit/drivetrain.test.ts:296` "expected +0 to be 5409.4" e física `tests/physics/grip.test.ts:91` "expected 44.30 to be greater than 46.30" (as duas provas de C36 falharam na mesma rodada) |
| F2 freio de mão com W sem travar a traseira: `brakeRear = Math.max(...)` → `if (!input.throttle) brakeRear = Math.max(...)` | `src/vehicle/drivetrain.ts:194` | yes - `tests/unit/drivetrain.test.ts:298` "expected 0 to be greater than 0" |
| F3 R + W andando para trás sem frear: `input.brake \|\| (input.throttle && kmh < -1)` → `input.brake` | `src/vehicle/drivetrain.ts:176` | yes - `tests/unit/drivetrain.test.ts:310` "expected +0 to be close to 11500" |
| F4 R + S andando para frente sem frear: `input.brake \|\| (input.throttle && kmh < -1)` → `input.throttle && kmh < -1` | `src/vehicle/drivetrain.ts:176` | yes - `tests/unit/drivetrain.test.ts:314` "expected +0 to be close to 11500" |
| F5 freio de mão sem W mantém o freio-motor: linha `if (!input.throttle) engineForce = 0;` removida | `src/vehicle/drivetrain.ts:193` | yes - `tests/unit/drivetrain.test.ts:301` "expected -447.74 to be +0" |

O teto de 5 foi atingido, e cada prova nova (C36 unit, C36 física, C37 nos dois casos) falhou pelo menos uma vez. Não
houve falta na linha sem caso (R sem entrada). A ausência foi mostrada por busca na linha de Coverage.

## Swept existing

Carried from a46591b. O fix não tocou `Car.ts`, `input.ts` nem `harness.ts`. A citação do Observable foi corrigida
no `plan.md` para `src/core/input.ts:52`, como o round 1 apontou.

## Deviations judged

- A decisão "freio de mão com acelerador" está registrada em `plan.md:162`, com a marca de decisão do usuário
  (`y`) e a data. O comentário do código (`src/vehicle/drivetrain.ts:191-192`) diz a mesma coisa. O round 1 pedia
  exatamente isso.
- As outras decisões são carried from a46591b: `restoreRollMoment`, C18 com ficha variante, limitador em 7000.01 e
  R ignorando o hold.

## Gate

`npx vitest run` - 102 passed, 0 failed · `E2E_PORT=5187 npx playwright test` (12 nomeados, C32-C35) - 12 passed, 0 failed (6.3 min, sem timeout de boot)

## Ranked gaps

1. **R engatada sem entrada não tem caso.** Test policy, linha "Decides, reached across a boundary", e Coverage,
   linha "drive input regimes". `src/vehicle/drivetrain.ts:172-178`: com `gear` −1 e nem S nem W, a força e o freio
   ficam em 0. O carro desce livre em ré, sem o freio-motor que a marcha para frente tem (`:183-187`). Nem o plano
   nem os checks registram essa escolha. Um mutante plausível, como freio-motor ou freio de serviço em R sem
   entrada, passaria por toda a suíte. Isso pede duas coisas: confirmar a regra (roda livre ou freio-motor em R) e
   pôr um caso afirmado em `tests/unit/drivetrain.test.ts`, perto de C37 (`:305-315`).

Resíduos que não mudam o veredito:
- Round 1, carried from a46591b: o "R na ré" do AC 24 só tem a cadeia de unidade, sem browser. A parte browser de
  visual C36 é `tests/e2e/visual.spec.ts:198`, e não visual C13 como diz o checks.md.
- Novo: a evidência da `Test policy` no `checks.md` não lista C36 e C37 entre as provas próprias de `drivetrain.ts`.
- Novo: a citação de Coverage do round 1 `grip.test.ts:176-177` estava errada; o certo é `:49-50`.
