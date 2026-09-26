# Car handling verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: db836b8..83c78fa (commits só de car-handling). O round 2 foi em 202999a. O fix é f80e5dc, com merge em ecbd070. Entre 202999a e 83c78fa o código só mudou em dois arquivos: `src/vehicle/drivetrain.ts` (+4 linhas) e `tests/unit/drivetrain.test.ts` (+17). O resto é `.specs/` (plan, checks, relatórios, lessons), e a parte de city-terrain em 83c78fa só mexe em `.specs/features/city-terrain/verification.md`
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

Resumo: a lacuna do round 2 fechou pela metade. A regra de R sem entrada agora é uma decisão registrada
(`plan.md:162`: "de ré sem input, freio-motor contra o sentido em que o carro rola"), e o código a implementa em
`src/vehicle/drivetrain.ts:178-181`. C38 prova o caso **rolando para trás**. As 38 provas nomeadas passam em
83c78fa (103/103 vitest, 12/12 Playwright na porta 5188), e 4 dos 5 mutantes no fix morreram.

O FAIL vem de um mutante que **sobreviveu à suíte inteira**. A regra decide o sentido da força com
`-Math.sign(wheelSpeedMs)` (`src/vehicle/drivetrain.ts:181`). Quando o carro **rola para frente com a ré engatada**
e sem entrada, o código dá força negativa, contra o movimento, como a decisão pede. Mas nenhum teste afirma isso.
Tirando o `-Math.sign(wheelSpeedMs) *`, a força fica sempre positiva: o motor empurra para frente o carro que já
desce para frente. Os 103 testes continuam verdes. O caso é alcançável: a R engata com S a ≤ 1 km/h (`:135`), só
sai com W (`:140`), e o câmbio automático não mexe na R (`:145`). Numa descida, o carro parado em R e sem entrada
rola para frente e passa de ~8.7 km/h, onde o giro de roda na R passa de `idleRpm` (1000) e `t` deixa de ser 0.
O próprio C37 já trata "R andando para frente" como caso real (`tests/unit/drivetrain.test.ts:312`).

É pequeno: um caso a +20 km/h em R, ao lado de `tests/unit/drivetrain.test.ts:319`, fecha. Também há uma lacuna de
precisão em C38: a "mesma lei" (`engineForce` na ré = −(`engineForce` na 1ª) × `reverseRatio` / `gearRatios[0]`) não
tem sinal de sentido, e o mutante que sobreviveu a satisfaz em qualquer velocidade.

## Binding sources

Carried from a46591b. O plano não marca nenhuma fonte como binding, e o fix não tocou a interface. Com profile
`standard`, este passo não roda.

## Checks

Verified at 83c78fa. Todas as provas rodaram de novo, completas, no worktree do Verifier (junction de `node_modules`):
- `npx vitest run --reporter=verbose`: 27 arquivos, **103 passaram**, 0 falharam. São os 102 do round 2 mais C38.
  Conferi os 37 nomes de `vitest` do `checks.md` um por um na saída verbose, e cada um aparece uma vez com ✓,
  inclusive `engine braking in reverse with no input`.
- `E2E_PORT=5188 npx playwright test tests/e2e/drive.spec.ts tests/e2e/hud.spec.ts tests/e2e/audio.spec.ts tests/e2e/visual.spec.ts -g "<os 12 nomes de C32-C35>"`:
  bateu exatamente 12 testes, e os 12 passaram. Isso inclui `reverse drives backward up to 30 kmh`
  (`tests/e2e/drive.spec.ts:39`), que o brief pediu porque o comportamento da ré mudou. Antes, o `netstat` mostrou a
  porta 5188 livre, e o log mostra `vite --port 5188 --strictPort` subindo pelo próprio run. Não houve timeout de boot.

Citações: as de `tests/unit/drivetrain.test.ts`, o único arquivo de teste que o fix tocou, foram refeitas em 83c78fa.
O fix só acrescentou linhas (`git show f80e5dc -- tests` não tem nenhuma linha `-`), então as linhas até `:316`
continuam iguais, e C26 andou +17. As citações dos outros arquivos de teste vêm de arquivos que não mudaram desde
202999a (`git diff --stat 202999a..HEAD` só lista `drivetrain.ts` e `drivetrain.test.ts` fora de `.specs/`). Elas
estão carried from 202999a ou, quando o round 2 já as herdava, carried from a46591b.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | massa [1249, 1251], `worldCom().y` ≤ 0.50, track/(2h) ≥ 1.6 | vitest `mass and low center of mass` ✓ | `tests/physics/stability.test.ts:61-62`, `:65`, `:66` (carried from a46591b) | PASS |
| C2 | 54 casos, inclinação ≤ 15° em todo passo | vitest `no rollover across the maneuver matrix` ✓ | `tests/physics/stability.test.ts:72` `results.length` 54; `:74` `maxTilt <= 15` (carried from a46591b) | PASS |
| C3 | 54 casos, 4 rodas no chão em ≤ 60 passos após soltar | vitest `all four wheels back on the ground after release` ✓ | `tests/physics/stability.test.ts:83-84` (carried from a46591b) | PASS |
| C4 | média de rolagem 90-180: `steer +1` em [+1, +6], `steer −1` em [−6, −1] | vitest `body roll leans out of the turn` ✓ | `tests/physics/stability.test.ts:107-108`, `:110-111` (carried from a46591b) | PASS |
| C5 | menor arfagem em 30 passos de freio em [−4, −0.5] | vitest `nose dives under braking` ✓ | `tests/physics/stability.test.ts:124-125` (carried from a46591b) | PASS |
| C6 | rampa do volante, volta, troca de lado, espelho | vitest `steering ramps toward the target` ✓ | `tests/unit/drivetrain.test.ts:46`, `:49-51`, `:60`, `:65`, `:71`, `:75`, `:84` (verified at 83c78fa; antes do trecho acrescentado) | PASS |
| C7 | alvo `min(0.55, atan(33.1578/v²))`, 7 casos | vitest `steering target shrinks with speed` ✓ | `tests/unit/drivetrain.test.ts:100` (tabela `:90-97`), `:103`, `:107` | PASS |
| C8 | 5 velocidades, ≤ 1.15 g em todo passo | vitest `lateral grip never exceeds 1.15 g` ✓ | `tests/physics/grip.test.ts:35-36` (carried from 202999a) | PASS |
| C9 | 60 km/h: ≥ 0.80 g | vitest `reaches at least 0.8 g at 60 kmh` ✓ | `tests/physics/grip.test.ts:43` (carried from 202999a) | PASS |
| C10 | 10 casos, sideslip ≤ 12° | vitest `understeers instead of spinning` ✓ | `tests/physics/grip.test.ts:60` `slip <= 12`; `:66` 10 casos (carried from 202999a) | PASS |
| C11 | freio de mão: sideslip > 20° em 90 passos | vitest `handbrake kicks the rear out` ✓ | `tests/physics/grip.test.ts:79` `expect(max).toBeGreaterThan(20)` (carried from 202999a) | PASS |
| C12 | soltando no 1º passo > 20°: < 8° em 150 passos, velocidade dianteira > 0 | vitest `car recovers after the handbrake is released` ✓ | `tests/physics/grip.test.ts:104`, `:109`, `:113` (carried from 202999a) | PASS |
| C13 | 100 km/h, freio + `steer +1`: heading ≥ +0.20 rad | vitest `steers while braking hard` ✓ | `tests/physics/grip.test.ts:145` `turned >= 0.2` (carried from 202999a) | PASS |
| C14 | freio a 60 km/h: motor 0, soma = `brakeForceN`, 0.65 | vitest `brake split front biased` ✓ | `tests/unit/drivetrain.test.ts:114`, `:115`, `:117`, `:118-119` | PASS |
| C15 | força pela curva, interpolação, limitador, freio-motor ≤ 0 | vitest `engine force follows the torque curve` ✓ | `tests/unit/drivetrain.test.ts:148`, `:153`, `:156`, `:163-164`, `:174` | PASS |
| C16 | 5 casos de rpm; varredura em [1000, 7000] | vitest `rpm from wheel speed and gear` ✓ | `tests/unit/drivetrain.test.ts:184-188`, `:195-196` | PASS |
| C17 | 2ª → 3ª com corte de 0.25 s; 6ª fica | vitest `upshift at 6500 rpm with power cut` ✓ | `tests/unit/drivetrain.test.ts:207-208`, `:211`, `:215`, `:218` | PASS |
| C18 | 4ª → 3ª com hold; sobregiro; 1ª fica | vitest `downshift with hysteresis and hold time` ✓ | `tests/unit/drivetrain.test.ts:226-227`, `:235`, `:245`, `:247`, `:251` | PASS |
| C19 | 0-100 em [5.5, 7.5] s | vitest `zero to 100 kmh between 5.5 and 7.5 s` ✓ | `tests/physics/powertrain.test.ts:20-21` (carried from a46591b) | PASS |
| C20 | 60 s: [215, 240] km/h; força > 0 a 230 km/h na 6ª | vitest `top speed limited by drag` ✓; vitest `no speed cut below redline` ✓ | `tests/physics/powertrain.test.ts:38-40` (carried from a46591b); `tests/unit/drivetrain.test.ts:258-260` | PASS |
| C21 | 100 → 60 km/h sem entradas em [4, 12] s | vitest `coasting from 100 to 60 kmh` ✓ | `tests/physics/powertrain.test.ts:53-54` (carried from a46591b) | PASS |
| C22 | parada de 100 km/h em [34, 45] m | vitest `braking from 100 kmh stops in 34 to 45 m` ✓ | `tests/physics/powertrain.test.ts:71-72` (carried from a46591b) | PASS |
| C23 | rampa de 9 %: 60 km/h em ≤ 10 s | vitest `climbs a 9 percent grade` ✓ | `tests/physics/powertrain.test.ts:84` (carried from a46591b) | PASS |
| C24 | entra em R, força < 0 a −29, = 0 a −30/−31, sai com acelerador a ≥ −1 | vitest `reverse gear capped at 30 kmh` ✓ | `tests/unit/drivetrain.test.ts:268-269`, `:271-273`, `:276`. Todos os casos usam S ou W, então o ramo novo `else` não entra neles | PASS |
| C25 | freio de mão: frente 0, traseira > 0, fator 0.4; sem ele 1 | vitest `handbrake locks rear and cuts rear grip` ✓ | `tests/unit/drivetrain.test.ts:283-287` | PASS |
| C26 | pura, estado congelado, sem as funções antigas | vitest `drivetrain step is pure` ✓ | `tests/unit/drivetrain.test.ts:347` `toEqual(b)`, `:348` `toEqual(copy)`, `:350-352` (andaram +17 linhas) | PASS |
| C27 | `carSpec.ts` e `drivetrain.ts` sem three/rapier | vitest `pure modules do not import three or rapier` ✓ | `tests/unit/purity.test.ts:40`, `:43` (carried from a46591b). O fix não acrescentou import em `drivetrain.ts` | PASS |
| C28 | valores de `DEFAULT_CAR`; `massKg: 1500` vira `body.mass()` 1500 | vitest `default car spec values` ✓; vitest `car reads mass from its spec` ✓ | `tests/unit/carSpec.test.ts:38-54`, `:64`, `:71`; `tests/physics/harness.test.ts:174-178` (carried from a46591b) | PASS |
| C29 | harness com 4 rodas em repouso | vitest `harness builds the real car at rest` ✓ | `tests/physics/harness.test.ts:184-185`, `:192-193`, `:196-197`, `:200` (carried from a46591b) | PASS |
| C30 | tabela de 6 casos de `isSkidding` | vitest `skidding from lateral slip or handbrake` ✓ | `tests/unit/effectsMath.test.ts:80-85` (carried from a46591b) | PASS |
| C31 | derrapagem real: verdadeiro no 1º passo; reta falso em 60 passos | vitest `skidding from real lateral slip` ✓ | `tests/physics/grip.test.ts:125` `toBe(true)`; `:132` `toBe(false)` (carried from 202999a) | PASS |
| C32 | troca para cima no browser, queda de rpm ≥ 1500, `#gear` | pw `automatic upshift drops rpm on the hud` ✓ | `tests/e2e/hud.spec.ts:174`, `:176`, `:181` (carried from a46591b) | PASS |
| C33 | `__game.car` expõe o estado de dirigibilidade | pw `car debug exposes handling state` ✓ | `tests/e2e/drive.spec.ts:122-124`, `:126-127`, `:129`, `:134` (carried from a46591b) | PASS |
| C34 | 9 provas antigas verdes sem mudança | pw os 9 nomes ✓ | `tests/e2e/drive.spec.ts:25`, `:35`, `:44-45`, `:60`; `tests/e2e/hud.spec.ts:199-204`; `tests/e2e/audio.spec.ts:106-117`; `tests/e2e/visual.spec.ts:175-177`, `:215`, `:291-300` (carried from a46591b; `tests/e2e` não mudou) | PASS |
| C35 | `__game.car.spec` igual a `DEFAULT_CAR` | pw `game builds the car from the default spec` ✓ | `tests/e2e/drive.spec.ts:143`, `:144` `expect(live).toEqual(expected)` (carried from a46591b) | PASS |
| C36 | acelerador + freio de mão na 3ª: força igual à do acelerador sozinho, frente 0, traseira > 0, fator 0.4; sem acelerador força 0; harness: com acelerador > 2 km/h acima | vitest `handbrake with throttle keeps engine force` ✓; vitest `throttle keeps pushing with the handbrake pulled` ✓ | `tests/unit/drivetrain.test.ts:295`, `:296`, `:297`, `:298`, `:299`, `:301`; `tests/physics/grip.test.ts:91` (carried from 202999a) | PASS |
| C37 | R, acelerador, −10 km/h: fica em R, força 0, soma = `brakeForceN`, 0.65; R, S, +5 km/h: força 0, soma = `brakeForceN` | vitest `service brake while in reverse gear` ✓ | `tests/unit/drivetrain.test.ts:308`, `:309` `toBe(0)`, `:310`, `:311`, `:313`, `:314` | PASS. `:309` agora também separa "freio de serviço" de "freio de serviço + freio-motor" (F3 abaixo) |
| C38 (novo) | R sem entrada a −20 km/h: fica em R, `rpm` > `idleRpm`, `engineForce` > 0, sem freio de serviço; mesma lei do freio-motor da 1ª × `reverseRatio` / `gearRatios[0]`; parado, força 0 | vitest `engine braking in reverse with no input` ✓ | `tests/unit/drivetrain.test.ts:320` `gear` −1; `:321` `rpm > idleRpm`; `:322` `engineForce > 0`; `:323` freio `toBe(0)`; `:328` `toBeCloseTo(-fwd * ratio, 6)`, com `fwd` no mesmo giro em `:326`; `:331` parado `toBe(0)` | PASS no que o check afirma. Lacuna de precisão: o check não fala do carro **rolando para frente** em R, que a decisão (`plan.md:162`, "contra o sentido em que o carro rola") cobre. A "mesma lei" também não tem sinal de sentido. O caso parado (`:331`) não separa nada, porque a 0 km/h o giro é `idleRpm` e `t` = 0 com ou sem o `Math.sign`. Ver Coverage e F5 |

## Coverage

Verified at 83c78fa nas linhas cuja autoridade o fix tocou: drive input regimes (`src/vehicle/drivetrain.ts`) e a
decisão do usuário (`plan.md:162`). As outras linhas vêm de autoridades que o fix não tocou e estão carried from
202999a.

Recálculo da tabela de decisão de `stepDrivetrain` (`src/vehicle/drivetrain.ts:119-206`), ramo por ramo, em 83c78fa:

- **volante** (`:110-117`, `:127`): ida C6 · volta C6 · troca de lado C6 · parado no alvo C6 · guarda `v` < 1 C7.
- **câmbio** (`:135-156`, sem mudança): entra em R C24 · sai da R C24 · sobe C17 · não sobe da 6ª C17 · desce C18 ·
  bloqueio por sobregiro C18 · hold C18 · não desce da 1ª C18. Com R e sem entrada, nenhum dos três ramos dispara
  (`:135` pede S, `:140` pede W, `:145` pede `gear >= 1`): a R fica engatada em qualquer sentido de rolagem.
- **corte e giro** (`:132`, `:158-161`): corte na troca C17 · embreagem na 1ª e na R C16 · limitador C15, C16. Em R sem
  entrada, `driving` é falso (`:158`), então não há piso de embreagem: o giro é `max(idleRpm, giro de roda)`.
- **força, R** (`:172-182`):
  - S a ≤ 1 km/h empurra para trás: C24.
  - corte a −29.5 km/h: C24.
  - S a > +1 km/h aciona o freio de serviço: C37 (`:313-314`).
  - W a < −1 km/h aciona o freio de serviço: C37 (`:309-311`).
  - sem entrada, rolando para trás: freio-motor para frente (`:181`, `-Math.sign(v)` = +1). C38 `:322`, `:328`.
  - sem entrada, parado: força 0. C38 `:331`.
  - **sem entrada, rolando para frente: freio-motor para trás (`:181`, `-Math.sign(v)` = −1). Sem caso.** F5 sobreviveu.
- **força, marcha ≥ 1** (`:183-191`, só andou +4 linhas): S freia com divisão 65/35 C14, C22 · W empurra C15, C19 ·
  W no corte da troca C17 · W no limitador C15 · sem entrada, freio-motor C15 (`tests/unit/drivetrain.test.ts:174`), C21.
- **freio de mão** (`:193-200`): com W mantém a força C36 · sem W zera a força C36 `:301` · traseira =
  max(traseira, 6000) C25, C36 · fator 0.4 C25, C36 · sem freio de mão, fator 1 C25. Com R e sem W, o freio de mão
  também zera o freio-motor novo da ré, pela mesma linha `:197` que C36 `:301` já prova na 3ª. Não é ramo novo.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (25) | `plan.md` Criteria (carried from 202999a; o fix não mexe nos ACs) | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6, C33 · 7 C7 · 8 C8 · 9 C9 · 10 C10 · 11 C11 · 12 C12 · 13 C13, C14 · 14 C15 · 15 C16 · 16 C17 · 17 C18 · 18 C19 · 19 C20 · 20 C21 · 21 C22 · 22 C23 · 23 C30, C31 · 24 C32, C34 · 25 C32 | - |
| decisão do usuário "freio de mão com acelerador" (6 regras) | `plan.md:162` (verified at 83c78fa) | power slide com W C36 unit e física · sem W, nem motor nem freio-motor C36 `:301` · R com W andando para trás C37 · R com S andando para frente C37 · R sem entrada rolando para trás, freio-motor contra C38 `:322` · **R sem entrada rolando para frente, freio-motor contra: sem caso** | R sem entrada rolando para frente: a decisão diz "contra o sentido em que o carro rola", mas nenhum teste chama `stepDrivetrain` com `gear: -1`, `idle` e velocidade positiva. `rg -n "gear: -1" tests` acha `tests/unit/drivetrain.test.ts:187`, `:271-273`, `:275`, `:307`, `:312`, `:319`, `:331`, `:339`. Só `:319` (−20 km/h) e `:331` (0) são `idle`, e `:187` e `:339` usam S. A varredura de C16 (`:189-196`) passa por R + `idle` a velocidades positivas, mas só afirma `rpm`. F5 sobreviveu às 103 provas |
| landing doors (3) | `plan.md` Landing (carried from a46591b) | 1 C1, C27, C35, `tests/unit/carSpec.test.ts:64` · 2 C6, C17, C18, C24, C26 · 3 C29, `vite.config.ts:6` | - |
| rollover matrix (54) | C2 (carried from a46591b) | `tests/physics/stability.test.ts:10-19`, `:72`, `:81` | - |
| maneuvers (6) | AC 2 (carried from a46591b) | `tests/physics/stability.test.ts:13-18` | - |
| understeer cases (10) | AC 10 (carried from 202999a) | 5 velocidades × 2 em `tests/physics/grip.test.ts:49-50`, `:66` | - |
| gearbox transitions (8) | `drivetrain.ts:135-156` (verified at 83c78fa; o fix não tocou este trecho) | 2→3 C17 · sem subir da 6ª C17 · corte C17 · 4→3 C18 · sobregiro C18 · hold C18 · sem descer da 1ª C18 · entrar e sair da R C24 | - |
| rpm regimes (5) | AC 15 (carried from a46591b) | C16, C15 | - |
| drive input regimes (recalculado: 13) | ramos de `src/vehicle/drivetrain.ts:158-200` em 83c78fa (lista acima) | acelerador C15, C19 · freio para frente C14, C22 · freio-motor para frente C15, C21 · volante C6, C7 · ré acionada e cortada C24 · R + S andando para frente C37 · R + W andando para trás C37 · R sem entrada rolando para trás C38 · R sem entrada parado C38 · freio de mão: frente 0, traseira, fator C25, C11 · freio de mão + W mantém o motor C36 · freio de mão sem W zera o motor C36 · **R sem entrada rolando para frente: sem caso** | R sem entrada rolando para frente (`src/vehicle/drivetrain.ts:181`, o lado −1 do `Math.sign`). O mutante F5, que tira o sentido e empurra sempre para frente, passa pelas 103 provas. O `checks.md` diz que "coast in reverse C38" cobre a linha, mas C38 só afirma o lado de trás |
| steering target cases (7) | C7 (carried from a46591b) | `tests/unit/drivetrain.test.ts:90-97` | - |
| skidding table (6) | AC 23 (carried from a46591b) | `tests/unit/effectsMath.test.ts:80-85` | - |
| superseded free-roam checks (7) | carried from a46591b | C2 → C14 · C4 → C24 · C6 → C6, C7 · C7 → C25 · C8 → C20 · C27 → C17, C18 · C28 → C16 | - |
| superseded visual checks (1) | carried from a46591b | a unidade de visual C36 → C30; browser `tests/e2e/visual.spec.ts:198` | - |
| tests in the fix diff | `git show f80e5dc -- tests` e `git diff 202999a..83c78fa -- tests` (verified at 83c78fa) | `tests/unit/drivetrain.test.ts` +17, sem nenhuma linha removida (`grep -c '^-[^-]'` = 0). Nenhum outro arquivo de teste mudou | - |
| startup config (2 assemblies) | carried from a46591b | `src/core/Game.ts:146` → C35 · `tests/physics/harness.ts:72` → C29, C28 | - |

## Test policy rows

Verified at 83c78fa na linha não cumprida no round 2, que também é a que classifica o arquivo tocado
(`drivetrain.ts`). As outras estão carried from 202999a.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/vehicle/drivetrain.ts`; `src/vehicle/effectsMath.ts` `isSkidding` | own layer C6, C7, C14-C18, C20, C24-C26, C30, C36-C38 · boundary C8-C13, C19-C23, C31, C32, C36 (harness) | not met - a linha do round 2 fechou pela metade. R sem entrada rolando para trás agora tem caso (C38, `tests/unit/drivetrain.test.ts:322`, `:328`) e virou decisão registrada (`plan.md:162`). Mas a expectativa é "um caso afirmado por linha da tabela de decisão", e o `Math.sign` de `src/vehicle/drivetrain.ts:181` abre uma linha que continua sem caso: R sem entrada rolando para frente. O mutante F5 prova que ela não é afirmada. Na fronteira, C38 só tem unidade; o contrato de ré no browser segue coberto por C24/C34 (`tests/e2e/drive.spec.ts:39`, que segura S). `effectsMath` cumpre (carried from a46591b) |
| Decides, not reached across a boundary | nenhum arquivo do diff | um caso por linha | n/a - nenhum arquivo nesta forma (carried from 202999a) |
| Entry point that decides nothing | nenhum arquivo do diff | accepted / rejected / error paths | n/a - nenhum arquivo nesta forma (carried from 202999a) |
| Instrumentation, pass-throughs | `src/core/Game.ts`, `src/hud/Hud.ts`, `src/audio/AudioEngine.ts`, `src/vehicle/Car.ts` | coberto pela prova do consumidor | yes - carried from 202999a. O fix não tocou esses arquivos |

A deriva de texto do round 2 foi corrigida: a `Test policy` do `checks.md` agora lista C36-C38 entre as provas
próprias de `drivetrain.ts` (`checks.md:377`).

## Faults injected

Verified at 83c78fa, só na superfície do fix (`src/vehicle/drivetrain.ts:176-181`). As faltas rodaram num worktree
isolado (`git worktree add --detach <scratchpad>/faults HEAD`, com junction de `node_modules`). Cada mutação partiu de
uma cópia do `drivetrain.ts` original, e o `diff` de cada uma foi conferido antes de rodar. No fim, o arquivo do
rascunho era byte a byte igual ao original (`cmp`). O `git status --porcelain` do worktree do Verifier estava vazio
antes (baseline de 0 bytes) e depois. A junction foi apagada sozinha (`.Delete()`) antes do `git worktree remove`.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 volta à roda livre: `engineForce = -Math.sign(...) * ... * toWheel;` → `engineForce = 0;` | `src/vehicle/drivetrain.ts:181` | yes - `tests/unit/drivetrain.test.ts:322` "expected 0 to be greater than 0" |
| F2 sinal trocado: `-Math.sign(wheelSpeedMs)` → `Math.sign(wheelSpeedMs)` | `src/vehicle/drivetrain.ts:181` | yes - `tests/unit/drivetrain.test.ts:322` "expected -276.71 to be greater than 0" |
| F3 freio-motor em R mesmo com freio de serviço: `brakeAll();` → `brakeAll(); engineForce = -Math.sign(v) * ENGINE_BRAKE_NM * t * toWheel;` | `src/vehicle/drivetrain.ts:177` | yes - C37 `tests/unit/drivetrain.test.ts:309` "expected 31.26 to be +0" |
| F4 intensidade errada (relação da 1ª em vez da R): `* toWheel` → `* toWheel * gearRatios[0] / reverseRatio` | `src/vehicle/drivetrain.ts:181` | yes - `tests/unit/drivetrain.test.ts:328` "expected 461.18 to be close to 276.71" |
| F5 sem sentido de rolagem: `engineForce = -Math.sign(wheelSpeedMs) * ENGINE_BRAKE_NM * t * toWheel` → `engineForce = ENGINE_BRAKE_NM * t * toWheel` (sempre para frente) | `src/vehicle/drivetrain.ts:181` | no - survived. A suíte vitest inteira (`npx vitest run`, 27 arquivos) deu 103/103 verdes. Com F5, em R, sem entrada e rolando para frente, o motor empurra o carro para frente, a favor da rolagem, em vez de segurar |

## Swept existing

Carried from a46591b. O fix não tocou `Car.ts`, `input.ts` nem `harness.ts`.

## Deviations judged

- A decisão sobre R sem entrada está registrada em `plan.md:162` ("de ré sem input, freio-motor contra o sentido em
  que o carro rola, como nas marchas para frente"), com a marca `y` e a data. O comentário do código
  (`src/vehicle/drivetrain.ts:179`) diz a mesma coisa, e o código segue a regra nos dois sentidos. O que falta é o caso
  afirmado de um dos sentidos. Não é desvio de comportamento.
- As outras decisões são carried from 202999a: power slide, freio de serviço em R, `restoreRollMoment`, C18 com
  ficha variante, limitador em 7000.01 e R ignorando o hold.

## Gate

`npx vitest run` - 103 passed, 0 failed · `E2E_PORT=5188 npx playwright test` (12 nomeados, C32-C35, incluindo `reverse drives backward up to 30 kmh`) - 12 passed, 0 failed (5.2 min, sem timeout de boot)

## Ranked gaps

1. **R sem entrada rolando para frente não tem caso (mutante F5 sobrevive).** Coverage (linhas "drive input regimes"
   e "decisão do usuário"), Test policy (linha "Decides, reached across a boundary") e Faults (F5).
   `src/vehicle/drivetrain.ts:181`: o `-Math.sign(wheelSpeedMs)` decide o sentido, e só o lado de trás é afirmado
   (`tests/unit/drivetrain.test.ts:322`, `:328`). Para fechar, basta acrescentar ao teste de C38
   (`tests/unit/drivetrain.test.ts:318-332`) um passo com `gear: -1`, `idle` e `+20 / 3.6`. Esse passo deve afirmar
   que a marcha continua −1, que `engineForce` < 0 e que ele é o oposto exato do caso a −20 km/h. Também é preciso
   ajustar o texto de C38 no `checks.md:323-329` para dizer "contra o sentido do movimento nos dois sentidos".
2. **Lacuna de precisão em C38** (`checks.md:325`): a "mesma lei" `engineForce` na ré = −(`engineForce` na 1ª) ×
   `reverseRatio` / `gearRatios[0]` não tem sinal de sentido. Lida ao pé da letra, F5 a satisfaz em qualquer
   velocidade. O caso "parado, força 0" (`tests/unit/drivetrain.test.ts:331`) também não separa a implementação
   certa de F5, porque a 0 km/h o giro é `idleRpm` e `t` = 0.

Resíduos que não mudam o veredito (carried from 202999a):
- O "R na ré" do AC 24 só tem a cadeia de unidade, sem browser. A parte browser de visual C36 é
  `tests/e2e/visual.spec.ts:198`, e não visual C13 como diz o checks.md.
- C38 é só unidade, sem prova no harness. A linha da Test policy aceita a fronteira no nível do arquivo, e o round 2
  aceitou C37 do mesmo jeito.
