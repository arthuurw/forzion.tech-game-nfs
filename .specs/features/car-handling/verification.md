# Car handling verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: e8f99fb..a46591b (main, merge de 254a9aa..822fe2d do branch `car-handling`; os commits de city-terrain-fix que o merge também traz ficam fora)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Resumo: as 35 provas nomeadas existem e passam em `HEAD` (99/99 vitest, 12/12 Playwright nomeados, mais 2
Playwright extras que o Coverage cita). Cada um dos 35 checks tem asserção localizada e está provado como
escrito, e os 5 mutantes injetados morreram. O FAIL vem de uma linha de `Test policy` não cumprida: a tabela de
decisão real de `src/vehicle/drivetrain.ts` tem duas linhas sem caso afirmado, e as duas são regras que o build
acrescentou sem que o plano as pedisse:
- o freio de mão zera a força do motor (`drivetrain.ts:192`);
- em ré, o carro andando contra o comando usa o freio de serviço (`drivetrain.ts:176-177`).

O mesmo buraco aparece no recálculo do Coverage, na linha dos regimes de entrada.

## Binding sources

O plano não marca nenhuma fonte como binding. As `Sources` são o pedido do usuário, a `.specs/STATE.md` e o
`.d.ts` do Rapier, lidos só como contexto. Com profile `standard`, este passo não roda.

## Checks

Provas rodadas no worktree do Verifier em a46591b (junction de `node_modules`):
- `npx vitest run --reporter=verbose`: 27 arquivos, 99 passaram. Cada teste nomeado aparece com ✓ na saída
  verbose, inclusive os 17 de `tests/physics`.
- `E2E_PORT=5185 npx playwright test tests/e2e/drive.spec.ts tests/e2e/hud.spec.ts tests/e2e/audio.spec.ts tests/e2e/visual.spec.ts -g "<os 12 nomes>"`:
  bateu exatamente 12 testes e os 12 passaram (5.2 min), sem timeout de boot.
- Extra, para a linha de Coverage "superseded visual checks": `two skid quads per fixed step` e `handbrake key reaches the car` passaram (2/2).

Os testes que o diff substituiu ou acrescentou são os citados abaixo. Nenhuma prova se apoia só num teste que a
feature não tocou, exceto C34, que por definição exige testes antigos sem mudança. `git diff e8f99fb..a46591b -- tests/e2e`
confirma que as linhas desses testes não mudaram: só entram C32, C33 e C35.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | massa [1249, 1251], `worldCom().y` ≤ 0.50, track/(2h) ≥ 1.6 | vitest `mass and low center of mass` ✓ | `tests/physics/stability.test.ts:61-62` massa; `:65` `toBeLessThanOrEqual(0.5)`; `:66` `trackM / (2 * comHeight) >= 1.6` | PASS |
| C2 | 54 casos, inclinação ≤ 15° em todo passo | vitest `no rollover across the maneuver matrix` ✓ | `tests/physics/stability.test.ts:72` `results.length` 54; `:74` `maxTilt <= 15` (máximo por passo, `:42`) | PASS |
| C3 | 54 casos, 4 rodas no chão em ≤ 60 passos após soltar | vitest `all four wheels back on the ground after release` ✓ | `tests/physics/stability.test.ts:83-84` `backOnGround` em [1, 60] | PASS |
| C4 (emendado em 2b2910f) | média de rolagem nos passos 90-180: `steer +1` em [+1, +6], `steer −1` em [−6, −1] | vitest `body roll leans out of the turn` ✓ | `tests/physics/stability.test.ts:107-108` left em [1.0, 6.0]; `:110-111` right em [-6.0, -1.0] | PASS. O sinal emendado confere: +X do chassi é a esquerda (`src/vehicle/Car.ts:388`, roda frente-esq em `x: +wheelX`), então lado esquerdo para cima numa curva à esquerda = inclinar para fora (AC 4) |
| C5 | menor arfagem em 30 passos de freio em [−4, −0.5] | vitest `nose dives under braking` ✓ | `tests/physics/stability.test.ts:124-125` | PASS |
| C6 | rampa 2.5/60 até 0.55 no passo 14; volta 3.5/60; troca de lado ≤ 3.5/60; espelho | vitest `steering ramps toward the target` ✓ | `tests/unit/drivetrain.test.ts:46` passo exato; `:49-51` chega no passo 14 e fica; `:60`, `:65` volta; `:71`, `:75` troca de lado; `:84` `neg[i] === -x` | PASS |
| C7 | alvo `min(0.55, atan(33.1578/v²))`, 7 casos ± 1e-6 | vitest `steering target shrinks with speed` ✓ | `tests/unit/drivetrain.test.ts:100` tabela de 7 casos (`:90-97`); `:103` ré = frente; `:107` a rampa converge ao alvo | PASS |
| C8 | 5 velocidades, janela de 0.5 s ≤ 1.15 g em todo passo | vitest `lateral grip never exceeds 1.15 g` ✓ | `tests/physics/grip.test.ts:35-36` | PASS |
| C9 | 60 km/h: ≥ 0.80 g em algum dos 120 passos | vitest `reaches at least 0.8 g at 60 kmh` ✓ | `tests/physics/grip.test.ts:43` `Math.max(...g) >= 0.8` | PASS |
| C10 | 10 casos, sideslip ≤ 12° | vitest `understeers instead of spinning` ✓ | `tests/physics/grip.test.ts:60` `slip <= 12`; `:62` medido; `:66` `cases` 10 | PASS |
| C11 | freio de mão: sideslip > 20° em 90 passos | vitest `handbrake kicks the rear out` ✓ | `tests/physics/grip.test.ts:79` `max > 20` | PASS |
| C12 | soltando no 1º passo > 20°: < 8° em 150 passos, velocidade dianteira > 0 | vitest `car recovers after the handbrake is released` ✓ | `tests/physics/grip.test.ts:92` `kicked`; `:97` `forwardSpeed > 0`; `:101` `recovered` | PASS |
| C13 | 100 km/h, freio + `steer +1` 60 passos: heading ≥ +0.20 rad | vitest `steers while braking hard` ✓ | `tests/physics/grip.test.ts:133` `turned >= 0.2` (normalizado com `atan2`, `:132`) | PASS |
| C14 | freio a 60 km/h: motor 0, soma = `brakeForceN`, 0.65 ± 1e-9, os dois > 0 | vitest `brake split front biased` ✓ | `tests/unit/drivetrain.test.ts:114`, `:115`, `:117` `abs(front/(front+rear) - 0.65) <= 1e-9`, `:118-119` | PASS |
| C15 | força = torque × relação × diferencial × eficiência / raio ± 1e-6; interpolação linear; limitador; freio-motor ≤ 0 | vitest `engine force follows the torque curve` ✓ | `tests/unit/drivetrain.test.ts:148` fórmula (esperado escrito no teste, `:129-137`); `:153` pontos; `:156` pontos médios; `:163-164` limitador; `:174` sem acelerador ≤ 0 | PASS. Nota: o limitador é provado em 7000.01 e 7500 (`:161`), então `rawRpm < redline` → `<=` em `src/vehicle/drivetrain.ts:182` seria invisível. A diferença só existe em exatamente 7000.0, e o comentário de `:160` explica por quê |
| C16 | tabela de 5 casos de rpm; varredura −10..80 m/s em [1000, 7000] | vitest `rpm from wheel speed and gear` ✓ | `tests/unit/drivetrain.test.ts:184-188` os 5 casos; `:195-196` varredura em 7 marchas × 3 entradas | PASS |
| C17 | 2ª → 3ª com `shiftTimer` 0.25; 15 passos com força 0, 16º > 0; 6ª fica | vitest `upshift at 6500 rpm with power cut` ✓ | `tests/unit/drivetrain.test.ts:207-208`; `:211` 15 passos `toBe(0)`; `:215` 16º `> 0`; `:218` 6ª | PASS |
| C18 | 4ª → 3ª com hold ≥ 0.6; bloqueio por sobregiro; hold 0.5 bloqueia os dois sentidos; 1ª fica | vitest `downshift with hysteresis and hold time` ✓ | `tests/unit/drivetrain.test.ts:226-227`; `:235` bloqueio; `:245`, `:247` hold; `:251` 1ª | PASS. O caso de sobregiro usa a ficha variante `wide` (`:231`). Julgado correto: com `DEFAULT_CAR`, 2800 × 2.15/1.51 = 3987 rpm < 6500, então o ramo é inalcançável na ficha padrão, e o check não exige `DEFAULT_CAR`. `:233` prova que a variante cai no ramo |
| C19 | 0-100 em [5.5, 7.5] s | vitest `zero to 100 kmh between 5.5 and 7.5 s` ✓ | `tests/physics/powertrain.test.ts:20-21` | PASS |
| C20 | 60 s: [215, 240] km/h, variação < 3 entre 50-60 s; 230 km/h na 6ª com força > 0 | vitest `top speed limited by drag` ✓; vitest `no speed cut below redline` ✓ | `tests/physics/powertrain.test.ts:38-40`; `tests/unit/drivetrain.test.ts:258-260` | PASS |
| C21 | 100 → 60 km/h sem entradas em [4, 12] s | vitest `coasting from 100 to 60 kmh` ✓ | `tests/physics/powertrain.test.ts:53-54` | PASS |
| C22 | parada de 100 km/h em [34, 45] m horizontais | vitest `braking from 100 kmh stops in 34 to 45 m` ✓ | `tests/physics/powertrain.test.ts:71-72` (distância horizontal `hypot(dx, dz)`, `:68`) | PASS |
| C23 | rampa de 9 %: 60 km/h em ≤ 10 s | vitest `climbs a 9 percent grade` ✓ | `tests/physics/powertrain.test.ts:84` (laço de 600 passos, `:80`) | PASS |
| C24 | entra em R com freio a ≤ 1 km/h; força < 0 a −29, = 0 a −30/−31; sai com acelerador a ≥ −1 | vitest `reverse gear capped at 30 kmh` ✓ | `tests/unit/drivetrain.test.ts:268-269`, `:271-273`, `:276` | PASS |
| C25 | freio de mão: frente 0, traseira > 0, fator 0.4; sem ele 1 | vitest `handbrake locks rear and cuts rear grip` ✓ | `tests/unit/drivetrain.test.ts:283-287` | PASS (o corte de motor com freio de mão não é afirmado aqui; ver Test policy) |
| C26 | pura: resultados iguais, estado congelado igual, sem `computeDrive`/`gearFor`/`rpmFor` | vitest `drivetrain step is pure` ✓ | `tests/unit/drivetrain.test.ts:303-304`, `:306-308` | PASS |
| C27 | `carSpec.ts` e `drivetrain.ts` sem three/rapier | vitest `pure modules do not import three or rapier` ✓ | `tests/unit/purity.test.ts:40` `toBe(24)`; `:43` `FORBIDDEN.test` falso por módulo | PASS |
| C28 | valores de `DEFAULT_CAR`, 26 campos finitos; `massKg: 1500` vira `body.mass()` 1500 | vitest `default car spec values` ✓; vitest `car reads mass from its spec` ✓ | `tests/unit/carSpec.test.ts:38-54`, `:56-61`, `:64` chaves = os 26 da door 1, `:71`; `tests/physics/harness.test.ts:174-175`, `:177-178` | PASS |
| C29 (emendado em 2b2910f) | controlador com 4 rodas; após 60 passos: 4 no chão, velocidade **horizontal** < 0.1 km/h, altura varia < 1 mm, inclinação < 1°; `test.include` com `tests/physics` | vitest `harness builds the real car at rest` ✓ | `tests/physics/harness.test.ts:184-185`, `:192`, `:193` `horizontalSpeed * 3.6 < 0.1`, `:196`, `:197`, `:200` | PASS |
| C30 | tabela de 6 casos de `isSkidding` | vitest `skidding from lateral slip or handbrake` ✓ | `tests/unit/effectsMath.test.ts:80-85` | PASS |
| C31 | 60 km/h + 5 m/s de lado: `skidding` no 1º passo; reta a 100 km/h: falso em 60 passos | vitest `skidding from real lateral slip` ✓ | `tests/physics/grip.test.ts:113`, `:120` | PASS |
| C32 | aceleração no browser: há troca para cima, queda de rpm ≥ 1500 em 0.3 s, `#gear` = `String(gear)` | pw `automatic upshift drops rpm on the hud` ✓ | `tests/e2e/hud.spec.ts:174` rótulo em toda amostra; `:176` troca existe; `:181` `before.rpm - lowest >= 1500` | PASS |
| C33 | `spec.massKg` 1250, `steerInput` em ±0.55, 4 campos finitos, `A` 0.5 s → `steerInput` > 0.5 | pw `car debug exposes handling state` ✓ | `tests/e2e/drive.spec.ts:122`, `:123-124`, `:126-127`, `:129` parado, `:134` | PASS |
| C34 | 9 provas antigas continuam verdes sem mudança | pw os 9 nomes ✓ | `tests/e2e/drive.spec.ts:25`, `:35`, `:44-45`, `:60`; `tests/e2e/hud.spec.ts:199-204`; `tests/e2e/audio.spec.ts:106-117`; `tests/e2e/visual.spec.ts:175-177`, `:215`, `:291-300`. O diff dos 4 arquivos só acrescenta testes | PASS |
| C35 | `__game.car.spec` igual campo a campo a `DEFAULT_CAR` servido pelo Vite | pw `game builds the car from the default spec` ✓ | `tests/e2e/drive.spec.ts:143` 26 chaves; `:144` `expect(live).toEqual(expected)`; montagem em `src/core/Game.ts:146` | PASS |

## Coverage

Cada conjunto foi recalculado da sua autoridade: o plano (ACs, Landing, Impact), a matriz que o próprio check
enumera e, para as linhas de decisão, o código de `src/vehicle/drivetrain.ts:127-195`, que é onde a tabela de
decisão do câmbio e dos freios existe.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (25) | `plan.md` Criteria | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6, C33 · 7 C7 · 8 C8 · 9 C9 · 10 C10 · 11 C11 · 12 C12 · 13 C13, C14 · 14 C15 · 15 C16 · 16 C17 · 17 C18 · 18 C19 · 19 C20 · 20 C21 · 21 C22 · 22 C23 · 23 C30, C31 · 24 C32, C34 · 25 C32 | - (nota: o "R na ré" do AC 24 só tem a cadeia de unidade `tests/unit/hudFormat.test.ts:15` `gearLabel(-1)` + C24 `gear` −1; nenhum browser mostra `#gear` = R) |
| landing doors (3) | `plan.md` Landing | 1 os 26 campos literais `tests/unit/carSpec.test.ts:64`, C1, C27, C35 · 2 assinatura e `DrivetrainState` conferidos em `src/vehicle/drivetrain.ts:34-44`, `:119-125`; C6, C17, C18, C24, C26 · 3 `vite.config.ts:6`, C29; AD-011 registrada em `.specs/STATE.md` | - |
| rollover matrix (54) | C2/AC 2: 6 manobras × 9 velocidades | `tests/physics/stability.test.ts:10-19` enumera as 9 e as 6; `:72`, `:81` afirmam 54 | - |
| maneuvers (6) | AC 2 | `steer +1`, `steer −1`, zigue-zague a cada 30 passos, + acelerador, + freio, + freio de mão: `tests/physics/stability.test.ts:13-18` | - |
| understeer cases (10) | AC 10 | 5 velocidades × 2 em `tests/physics/grip.test.ts:176-177`, `:66` | - |
| gearbox transitions (8) | AC 16, AC 17, free-roam AC 3 e o código `drivetrain.ts:135-156` | 2→3 C17 · sem subir da 6ª C17 · corte na troca C17 (F2 morto) · 4→3 C18 · bloqueio por sobregiro C18 (ficha variante) · hold 0.6 s nos dois sentidos C18 · sem descer da 1ª C18 · entrar e sair da R C24 | - (nota: entrar e sair da R ignoram o hold de 0.6 s, `drivetrain.ts:135-144`, sem caso afirmado. Julgado aceitável: a troca de sentido é comando do motorista, e a frase "nenhuma troca" do AC 17 está dentro da regra do câmbio automático) |
| rpm regimes (5) | AC 15 | roda C16 · marcha lenta C16 · embreagem na 1ª C16 · embreagem na R C16 · teto 7000 C16, C15 | - |
| drive input regimes (recalculado: 8) | ramos de `drivetrain.ts:172-195` | acelerador C15, C19 · freio andando para frente C14, C22 (F1 morto) · ré acionada C24 · freio-motor C15, C21 · volante C6, C7 · freio de mão: frente 0, traseira > 0, fator 0.4 C25, C11 · **freio de mão zera o motor** (`:192`): sem caso · **R andando contra o comando usa freio de serviço** (`:176-177`, R + acelerador abaixo de −1 km/h, R + freio acima de +1 km/h): sem caso | freio de mão zera `engineForce` (`src/vehicle/drivetrain.ts:192`); freio de serviço em R (`src/vehicle/drivetrain.ts:176-177`) |
| steering target cases (7) | C7 | `tests/unit/drivetrain.test.ts:90-97` | - |
| skidding table (6) | AC 23 | `tests/unit/effectsMath.test.ts:80-85` (F4 morto na aresta 2.5) | - |
| superseded free-roam checks (7) | testes apagados em 254a9aa (`git diff e8f99fb..a46591b -- tests/unit/drivetrain.test.ts`) | C2 → C14, com a divisão igual trocada por 65/35 como os checks aprovaram · C4 → C24, mesmos valores (1, 0, −29, −30, −31) · C6 → C6, C7 · C7 → C25, mesmas asserções · C8 → C20 · C27 → C17, C18 · C28 → C16, com a varredura [1000, 7000] mantida e ampliada a todas as marchas | - |
| superseded visual checks (1) | `tests/unit/effectsMath.test.ts` antes/depois | a unidade de visual C36 → C30. O caso antigo `isSkidding(true, 5)` falso saiu, mas a aresta `(true, 20, 0)` falso em `:84` o cobre | - (nota: o checks.md diz que a parte browser "2 × passos" é provada por visual C13. Na verdade é `two skid quads per fixed step`, `tests/e2e/visual.spec.ts:198`, que o Verifier rodou: ✓) |
| other tests in the diff | `git diff --stat e8f99fb..a46591b -- tests` | só `drivetrain.test.ts` e `effectsMath.test.ts` perdem asserções, as listadas acima. `purity.test.ts` sobe de 23 para 24. `drive.spec.ts` e `hud.spec.ts` só ganham testes | - |
| startup config (2 assemblies) | quem constrói `Car` | `src/core/Game.ts:146` passa `DEFAULT_CAR` → C35 (F5 morto) · `tests/physics/harness.ts:72` → C29, C28 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/vehicle/drivetrain.ts`; `src/vehicle/effectsMath.ts` `isSkidding` | own layer C6, C7, C14-C18, C20, C24-C26 e C30 · boundary C8-C13, C19-C23, C31, C32 | not met - `effectsMath` cumpre (C30, C31). `drivetrain.ts` tem duas linhas da tabela de decisão sem caso afirmado. A primeira é o corte de motor com freio de mão, `:192`. O `computeDrive` antigo mantinha a força com freio de mão, então isto muda o comportamento: acelerador + freio de mão não empurra mais a traseira, e nem o plano nem os checks registram essa decisão. A segunda é o freio de serviço em R, `:176-177`. As outras 13 linhas (rampa, guarda, 3 regras de troca, hold, corte, embreagem, limitador, entrar/cortar/sair da R, divisão de freio, freio-motor) têm caso |
| Decides, not reached across a boundary | nenhum arquivo do diff | um caso por linha | n/a - nenhum arquivo nesta forma |
| Entry point that decides nothing | nenhum arquivo do diff | accepted / rejected / error paths | n/a - nenhum arquivo nesta forma |
| Instrumentation, pass-throughs | `src/core/Game.ts`, `src/hud/Hud.ts`, `src/audio/AudioEngine.ts`; `src/vehicle/Car.ts` (aplica e mede) | coberto pela prova do consumidor | yes - `Game` C33, C35 (F5 morto). `Hud` e `AudioEngine` C32 e C34 (sem diff nesta feature). `Car`: massa e CM C1, C28; `restoreRollMoment` C4 (F3 morto); `maxLateralSlip` C31; arrasto e rolagem C20, C21 |

## Faults injected

As faltas rodaram num worktree isolado em `<scratchpad>/faults` (a46591b, junction de `node_modules`), com o
Playwright em `E2E_PORT=5185`. Cada mutação foi revertida copiando o arquivo original antes da seguinte. O
`git status --porcelain` do worktree do Verifier estava vazio antes e depois, e o worktree de rascunho foi
removido.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 divisão de freio: `brakeForceN * brakeBiasFront` → `brakeForceN * 0.5` | `src/vehicle/drivetrain.ts:168` | yes - `tests/unit/drivetrain.test.ts:117` "expected 0.15 to be ≤ 1e-9" |
| F2 sem corte na troca: `let cut = s.shiftTimer > EPS` → `let cut = false` | `src/vehicle/drivetrain.ts:132` | yes - `tests/unit/drivetrain.test.ts:211` "step 1 after the shift: expected 5385.5 to be +0" |
| F3 momento de rolagem removido: `this.restoreRollMoment()` comentado | `src/vehicle/Car.ts:171` | yes - `tests/physics/stability.test.ts:107` rolagem média 0.28° < 1.0 |
| F4 limiar de derrapagem: `lateralSlipMs > 2.5` → `>=` | `src/vehicle/effectsMath.ts:98` | yes - `tests/unit/effectsMath.test.ts:81` `(false, 100, 2.5)` virou true |
| F5 Game com outra ficha: `DEFAULT_CAR` → `{ ...DEFAULT_CAR, tireGrip: 2 }` | `src/core/Game.ts:146` | yes - `tests/e2e/drive.spec.ts:144` diff `"tireGrip": 1.05` vs `2` |

O teto de 5 foi atingido. Não houve mutante nas duas linhas sem caso, e a ausência foi mostrada por busca:
`rg -n "handbrake" tests | rg throttle` só acha as definições de `NO_INPUT` e `idle`. Nenhum teste de R usa
acelerador abaixo de −1 km/h: os casos com acelerador são `[-1, 0, 0.5]`, em `tests/unit/drivetrain.test.ts:274-276`.
Não há caso de R com freio acima de +1 km/h. Ficaram sem falta própria a rampa do volante (C6), a aderência do
pneu (C8/C10) e o câmbio para baixo (C18).

## Swept existing

- failure modes, "capotar por batida é desfeito pelo reset existente": confirmado. `reset puts car upright` está
  em `tests/e2e/drive.spec.ts:148` e `Car.reset` em `src/vehicle/Car.ts:265-279`.
- dependency failure, "sem o GLB o placeholder usa a mesma física": confirmado. `buildVisual`
  (`src/vehicle/Car.ts:407-438`) só monta malhas, e corpo, rodas e ficha independem de `assets`
  (`:98-145`). O teste free-roam C33 está em `tests/e2e/hud.spec.ts:61-62`, e o harness roda sempre com o
  placeholder (`tests/physics/harness.ts:21-27`).
- Observable "existing - `steerAxis` devolve 0 (`src/core/input.ts:49`)": a regra existe, mas a linha
  andou para `src/core/input.ts:52`. É deriva de citação, sem efeito.

## Deviations judged

- `Car.restoreRollMoment` devolve ao corpo 90 % do momento de rolagem que o Rapier descarta
  (`src/vehicle/Car.ts:319-342`). Não precisa de linha em Landing: é um método privado, reversível num diff, e o
  plano diz "Nothing else in this change is hard to reverse". Também não é física de pneu própria (AD-002), porque
  reusa o `wheelSideImpulse` do próprio Rapier. C4 o prova (F3 morto). O builder acrescentou a linha
  correspondente no Flow do `plan.md` em 254a9aa, e o Flow continua fiel ao código. Não há registro de que o
  usuário confirmou essa edição do plano.
- C18 com ficha variante: correto (ver a linha C18).
- C15 com limitador em 7000.01: aceitável. A aresta `<` vs `<=` só existe em exatamente 7000.0.
- Regras extras do build:
  - R ignora o hold de 0.6 s: aceitável.
  - Freio de mão zera o motor e R usa freio de serviço: sem caso afirmado, e o primeiro muda o comportamento
    anterior sem decisão registrada. É o FAIL acima.
- Emendas C4 e C29 (2b2910f): o texto emendado confere com o AC 4 e com a definição de rolagem, e os testes
  (822fe2d) afirmam o texto emendado.

## Gate

`npx vitest run` - 99 passed, 0 failed · `E2E_PORT=5185 npx playwright test` (12 nomeados) - 12 passed, 0 failed (5.2 min) · extras `two skid quads per fixed step`, `handbrake key reaches the car` - 2 passed, 0 failed

## Ranked gaps

1. **Freio de mão zera o motor sem caso nem decisão.** Test policy, linha de C25 / AC 5 de free-roam.
   `src/vehicle/drivetrain.ts:192`: `engineForce = 0` com `handbrake`. É uma mudança de comportamento em relação
   ao `computeDrive` antigo: acelerador + freio de mão, a derrapagem com potência de jogo NFS, deixa de existir.
   O plano e os checks não registram isso, e nenhum teste combina `handbrake` com `throttle`. Pede uma decisão do
   usuário e um caso afirmado em `tests/unit/drivetrain.test.ts`, perto de `:283`.
2. **Freio de serviço em R sem caso.** Test policy e Coverage, regimes de entrada.
   `src/vehicle/drivetrain.ts:176-177`: R + acelerador abaixo de −1 km/h, e R + freio acima de +1 km/h. Falta um
   caso de cada, ao lado de C24 (`tests/unit/drivetrain.test.ts:264-277`).

Resíduos que não mudam o veredito:
- O "R na ré" do AC 24 não tem prova no browser, só a cadeia de unidade `hudFormat.test.ts:15` + C24.
- O checks.md atribui a parte browser de visual C36 a visual C13; a prova real é `tests/e2e/visual.spec.ts:198`,
  verde.
- A citação `src/core/input.ts:49` do Observable andou para `:52`.
- A rampa do volante, a aderência e a descida de marcha não receberam falta própria (teto de 5).
