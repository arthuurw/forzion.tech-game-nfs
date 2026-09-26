# Car handling verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: db836b8..e69acb3 (commits só de car-handling). O round 3 foi em 83c78fa. O fix é a7d15be, com merge em cfd5e51, e e69acb3 só grava a lição do round 3. Entre 83c78fa e e69acb3 nada mudou em `src/`: o único arquivo de teste tocado é `tests/unit/drivetrain.test.ts` (+5 linhas, nenhuma removida). O resto é `.specs/` (`checks.md` +1 linha em C38, o relatório do round 3, `LESSONS.md` e `lessons.json`)
**Round**: 4 - scoped
**Verifier**: independent sub-agent (author != verifier)

Resumo: a lacuna do round 3 fechou. O teste de C38 agora tem um passo com a ré engatada, sem entrada e rolando
para frente a +20 km/h (`tests/unit/drivetrain.test.ts:331`). Ele afirma que a marcha continua −1 (`:332`), que
`engineForce` < 0 (`:333`) e que a força é o oposto exato do caso a −20 km/h (`:334`). O texto de C38 no
`checks.md:326` diz o mesmo e fecha a lacuna de precisão sobre o sentido. O mutante F5, que sobreviveu à suíte
inteira no round 3, agora morre em `:333`. Os outros três mutantes novos nesta superfície também morreram. As 38
provas nomeadas passam em e69acb3: 103/103 no vitest e 12/12 no Playwright, na porta 5189.

## Binding sources

Carried from 83c78fa (que já herdava de a46591b). O plano não marca nenhuma fonte como binding, e o fix não tocou
a interface. Com profile `standard`, este passo não roda.

## Checks

Verified at e69acb3. Todas as provas rodaram de novo, completas, no worktree do Verifier (junction de `node_modules`):
- `npx vitest run --reporter=verbose`: 27 arquivos, **103 passaram**, 0 falharam. O número é o mesmo do round 3,
  porque o fix acrescentou asserções ao teste de C38, não um teste novo. Tirei os nomes de `-t "..."` do
  `checks.md` e conferi cada um na saída verbose: são 37 nomes, e cada um aparece exatamente uma vez com ✓.
- `E2E_PORT=5189 npx playwright test tests/e2e/drive.spec.ts tests/e2e/hud.spec.ts tests/e2e/audio.spec.ts tests/e2e/visual.spec.ts -g "<os 12 nomes de C32-C35>"`:
  bateu exatamente 12 testes, e os 12 passaram. Antes, o `netstat` não mostrou nada na porta 5189, e o log mostra
  `vite --port 5189 --strictPort` subindo pelo próprio run. Não houve timeout de boot (5.3 min, exit 0), então não precisei rodar de novo.

Citações: `tests/unit/drivetrain.test.ts` é o único arquivo de teste que o fix tocou, e as citações dele foram
refeitas em e69acb3. O fix só acrescentou linhas (`git show a7d15be -- tests` não tem nenhuma linha `-`), todas
depois de `:329`. Então as linhas até `:329` continuam iguais, e C26 andou +5. As citações dos outros arquivos de
teste vêm de arquivos que não mudaram desde 83c78fa (`git diff --stat 83c78fa..HEAD` só lista
`tests/unit/drivetrain.test.ts` fora de `.specs/`). Elas estão carried from 83c78fa, com a origem que o round 3
já registrava.

Nada enfraqueceu. `git show a7d15be -- tests` tem só as 5 linhas `+` que ficam entre `:330` e `:334`: um comentário e
quatro linhas novas, sem nenhuma troca de matcher nem de tolerância. `git show a7d15be -- .specs` só acrescenta um
item ao texto de C38 (`checks.md:326`) e não tira nada.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | massa [1249, 1251], `worldCom().y` ≤ 0.50, track/(2h) ≥ 1.6 | vitest `mass and low center of mass` ✓ | `tests/physics/stability.test.ts:61-62`, `:65`, `:66` (carried from 83c78fa) | PASS |
| C2 | 54 casos, inclinação ≤ 15° em todo passo | vitest `no rollover across the maneuver matrix` ✓ | `tests/physics/stability.test.ts:72` `results.length` 54; `:74` `maxTilt <= 15` (carried from 83c78fa) | PASS |
| C3 | 54 casos, 4 rodas no chão em ≤ 60 passos após soltar | vitest `all four wheels back on the ground after release` ✓ | `tests/physics/stability.test.ts:83-84` (carried from 83c78fa) | PASS |
| C4 | média de rolagem 90-180: `steer +1` em [+1, +6], `steer −1` em [−6, −1] | vitest `body roll leans out of the turn` ✓ | `tests/physics/stability.test.ts:107-108`, `:110-111` (carried from 83c78fa) | PASS |
| C5 | menor arfagem em 30 passos de freio em [−4, −0.5] | vitest `nose dives under braking` ✓ | `tests/physics/stability.test.ts:124-125` (carried from 83c78fa) | PASS |
| C6 | rampa do volante, volta, troca de lado, espelho | vitest `steering ramps toward the target` ✓ | `tests/unit/drivetrain.test.ts:46`, `:49-51`, `:60`, `:65`, `:71`, `:75`, `:84` (verified at e69acb3; antes do trecho acrescentado) | PASS |
| C7 | alvo `min(0.55, atan(33.1578/v²))`, 7 casos | vitest `steering target shrinks with speed` ✓ | `tests/unit/drivetrain.test.ts:100` (tabela `:90-97`), `:103`, `:107` | PASS |
| C8 | 5 velocidades, ≤ 1.15 g em todo passo | vitest `lateral grip never exceeds 1.15 g` ✓ | `tests/physics/grip.test.ts:35-36` (carried from 83c78fa) | PASS |
| C9 | 60 km/h: ≥ 0.80 g | vitest `reaches at least 0.8 g at 60 kmh` ✓ | `tests/physics/grip.test.ts:43` (carried from 83c78fa) | PASS |
| C10 | 10 casos, sideslip ≤ 12° | vitest `understeers instead of spinning` ✓ | `tests/physics/grip.test.ts:60` `slip <= 12`; `:66` 10 casos (carried from 83c78fa) | PASS |
| C11 | freio de mão: sideslip > 20° em 90 passos | vitest `handbrake kicks the rear out` ✓ | `tests/physics/grip.test.ts:79` `expect(max).toBeGreaterThan(20)` (carried from 83c78fa) | PASS |
| C12 | soltando no 1º passo > 20°: < 8° em 150 passos, velocidade dianteira > 0 | vitest `car recovers after the handbrake is released` ✓ | `tests/physics/grip.test.ts:104`, `:109`, `:113` (carried from 83c78fa) | PASS |
| C13 | 100 km/h, freio + `steer +1`: heading ≥ +0.20 rad | vitest `steers while braking hard` ✓ | `tests/physics/grip.test.ts:145` `turned >= 0.2` (carried from 83c78fa) | PASS |
| C14 | freio a 60 km/h: motor 0, soma = `brakeForceN`, 0.65 | vitest `brake split front biased` ✓ | `tests/unit/drivetrain.test.ts:114`, `:115`, `:117`, `:118-119` | PASS |
| C15 | força pela curva, interpolação, limitador, freio-motor ≤ 0 | vitest `engine force follows the torque curve` ✓ | `tests/unit/drivetrain.test.ts:148`, `:153`, `:156`, `:163-164`, `:174` | PASS |
| C16 | 5 casos de rpm; varredura em [1000, 7000] | vitest `rpm from wheel speed and gear` ✓ | `tests/unit/drivetrain.test.ts:184-188`, `:195-196` | PASS |
| C17 | 2ª → 3ª com corte de 0.25 s; 6ª fica | vitest `upshift at 6500 rpm with power cut` ✓ | `tests/unit/drivetrain.test.ts:207-208`, `:211`, `:215`, `:218` | PASS |
| C18 | 4ª → 3ª com hold; sobregiro; 1ª fica | vitest `downshift with hysteresis and hold time` ✓ | `tests/unit/drivetrain.test.ts:226-227`, `:235`, `:245`, `:247`, `:251` | PASS |
| C19 | 0-100 em [5.5, 7.5] s | vitest `zero to 100 kmh between 5.5 and 7.5 s` ✓ | `tests/physics/powertrain.test.ts:20-21` (carried from 83c78fa) | PASS |
| C20 | 60 s: [215, 240] km/h; força > 0 a 230 km/h na 6ª | vitest `top speed limited by drag` ✓; vitest `no speed cut below redline` ✓ | `tests/physics/powertrain.test.ts:38-40` (carried from 83c78fa); `tests/unit/drivetrain.test.ts:258-260` | PASS |
| C21 | 100 → 60 km/h sem entradas em [4, 12] s | vitest `coasting from 100 to 60 kmh` ✓ | `tests/physics/powertrain.test.ts:53-54` (carried from 83c78fa) | PASS |
| C22 | parada de 100 km/h em [34, 45] m | vitest `braking from 100 kmh stops in 34 to 45 m` ✓ | `tests/physics/powertrain.test.ts:71-72` (carried from 83c78fa) | PASS |
| C23 | rampa de 9 %: 60 km/h em ≤ 10 s | vitest `climbs a 9 percent grade` ✓ | `tests/physics/powertrain.test.ts:84` (carried from 83c78fa) | PASS |
| C24 | entra em R, força < 0 a −29, = 0 a −30/−31, sai com acelerador a ≥ −1 | vitest `reverse gear capped at 30 kmh` ✓ | `tests/unit/drivetrain.test.ts:268-269`, `:271-273`, `:276` | PASS |
| C25 | freio de mão: frente 0, traseira > 0, fator 0.4; sem ele 1 | vitest `handbrake locks rear and cuts rear grip` ✓ | `tests/unit/drivetrain.test.ts:283-287` | PASS |
| C26 | pura, estado congelado, sem as funções antigas | vitest `drivetrain step is pure` ✓ | `tests/unit/drivetrain.test.ts:352` `expect(a).toEqual(b)`, `:353` `expect(frozen).toEqual(copy)`, `:355-357` (andaram +5 linhas) | PASS |
| C27 | `carSpec.ts` e `drivetrain.ts` sem three/rapier | vitest `pure modules do not import three or rapier` ✓ | `tests/unit/purity.test.ts:40`, `:43` (carried from 83c78fa). O fix não tocou `src/` | PASS |
| C28 | valores de `DEFAULT_CAR`; `massKg: 1500` vira `body.mass()` 1500 | vitest `default car spec values` ✓; vitest `car reads mass from its spec` ✓ | `tests/unit/carSpec.test.ts:38-54`, `:64`, `:71`; `tests/physics/harness.test.ts:174-178` (carried from 83c78fa) | PASS |
| C29 | harness com 4 rodas em repouso | vitest `harness builds the real car at rest` ✓ | `tests/physics/harness.test.ts:184-185`, `:192-193`, `:196-197`, `:200` (carried from 83c78fa) | PASS |
| C30 | tabela de 6 casos de `isSkidding` | vitest `skidding from lateral slip or handbrake` ✓ | `tests/unit/effectsMath.test.ts:80-85` (carried from 83c78fa) | PASS |
| C31 | derrapagem real: verdadeiro no 1º passo; reta falso em 60 passos | vitest `skidding from real lateral slip` ✓ | `tests/physics/grip.test.ts:125` `toBe(true)`; `:132` `toBe(false)` (carried from 83c78fa) | PASS |
| C32 | troca para cima no browser, queda de rpm ≥ 1500, `#gear` | pw `automatic upshift drops rpm on the hud` ✓ | `tests/e2e/hud.spec.ts:174`, `:176`, `:181` (carried from 83c78fa) | PASS |
| C33 | `__game.car` expõe o estado de dirigibilidade | pw `car debug exposes handling state` ✓ | `tests/e2e/drive.spec.ts:122-124`, `:126-127`, `:129`, `:134` (carried from 83c78fa) | PASS |
| C34 | 9 provas antigas verdes sem mudança | pw os 9 nomes ✓ | `tests/e2e/drive.spec.ts:25`, `:35`, `:44-45`, `:60`; `tests/e2e/hud.spec.ts:199-204`; `tests/e2e/audio.spec.ts:106-117`; `tests/e2e/visual.spec.ts:175-177`, `:215`, `:291-300` (carried from 83c78fa; `tests/e2e` não mudou) | PASS |
| C35 | `__game.car.spec` igual a `DEFAULT_CAR` | pw `game builds the car from the default spec` ✓ | `tests/e2e/drive.spec.ts:143`, `:144` `expect(live).toEqual(expected)` (carried from 83c78fa) | PASS |
| C36 | acelerador + freio de mão na 3ª: força igual à do acelerador sozinho, frente 0, traseira > 0, fator 0.4; sem acelerador força 0; harness: com acelerador > 2 km/h acima | vitest `handbrake with throttle keeps engine force` ✓; vitest `throttle keeps pushing with the handbrake pulled` ✓ | `tests/unit/drivetrain.test.ts:295`, `:296`, `:297`, `:298`, `:299`, `:301`; `tests/physics/grip.test.ts:91` (carried from 83c78fa) | PASS |
| C37 | R, acelerador, −10 km/h: fica em R, força 0, soma = `brakeForceN`, 0.65; R, S, +5 km/h: força 0, soma = `brakeForceN` | vitest `service brake while in reverse gear` ✓ | `tests/unit/drivetrain.test.ts:308`, `:309` `toBe(0)`, `:310`, `:311`, `:313`, `:314` | PASS |
| C38 | R sem entrada a −20 km/h: fica em R, `rpm` > `idleRpm`, `engineForce` > 0, sem freio de serviço; mesma lei do freio-motor da 1ª × `reverseRatio` / `gearRatios[0]`; a +20 km/h (rolando para frente): `engineForce` < 0, mesma magnitude; parado, força 0 | vitest `engine braking in reverse with no input` ✓ | `tests/unit/drivetrain.test.ts:320` `gear` −1; `:321` `rpm > idleRpm`; `:322` `engineForce > 0`; `:323` freio `toBe(0)`; `:328` `toBeCloseTo(-fwd * ratio, 6)`; `:332` `expect(ahead.state.gear).toBe(-1)`; `:333` `expect(ahead.cmd.engineForce).toBeLessThan(0)`; `:334` `expect(ahead.cmd.engineForce).toBeCloseTo(-back.cmd.engineForce, 9)`; `:336` parado `toBe(0)` | PASS. A lacuna de precisão do round 3 fechou: `checks.md:326` agora fixa o sinal nos dois sentidos ("sempre contra o sentido em que o carro rola") e a magnitude igual. F5 morre em `:333` |

## Coverage

Verified at e69acb3 nas linhas cuja autoridade o fix tocou: drive input regimes (`src/vehicle/drivetrain.ts`), a
decisão do usuário (`plan.md:162`) e os testes do diff. `src/` não mudou desde 83c78fa, então o fix não acrescentou
nenhum ramo. Ele só acrescentou prova a um ramo que já existia. As outras linhas vêm de autoridades que o fix não
tocou e estão carried from 83c78fa.

Recálculo da tabela de decisão de `stepDrivetrain` (`src/vehicle/drivetrain.ts:119-206`), ramo por ramo, em e69acb3:

- **volante** (`:110-117`, `:127`): ida C6 · volta C6 · troca de lado C6 · parado no alvo C6 · guarda `v` < 1 C7.
- **câmbio** (`:135-156`): entra em R C24 · sai da R C24 · sobe C17 · não sobe da 6ª C17 · desce C18 · bloqueio por
  sobregiro C18 · hold C18 · não desce da 1ª C18. Com R e sem entrada, nenhum dos três ramos dispara (`:135` pede S,
  `:140` pede W, `:145` pede `gear >= 1`). A R fica engatada nos dois sentidos de rolagem, e agora isso está afirmado
  nos dois: C38 `:320` (para trás) e `:332` (para frente).
- **corte e giro** (`:132`, `:158-161`): corte na troca C17 · embreagem na 1ª e na R C16 · limitador C15, C16. Em R sem
  entrada, `driving` é falso (`:158`), então o giro é `max(idleRpm, giro de roda)`. Como `wheelRpm` usa
  `Math.abs(speedMs)` (`:107`), o giro a +20 e a −20 km/h é o mesmo, e é isso que torna exata a igualdade de `:334`.
- **força, R** (`:172-182`):
  - S a ≤ 1 km/h empurra para trás: C24.
  - corte a −29.5 km/h: C24.
  - S a > +1 km/h aciona o freio de serviço: C37 (`:313-314`).
  - W a < −1 km/h aciona o freio de serviço: C37 (`:309-311`).
  - sem entrada, rolando para trás: freio-motor para frente (`:181`, `-Math.sign(v)` = +1). C38 `:322`, `:328`.
  - sem entrada, rolando para frente: freio-motor para trás (`:181`, `-Math.sign(v)` = −1). C38 `:333`, `:334`.
    **Novo neste round.** F5 e F6 morrem aqui.
  - sem entrada, parado: força 0. C38 `:336`.
- **força, marcha ≥ 1** (`:183-191`): S freia com divisão 65/35 C14, C22 · W empurra C15, C19 · W no corte da troca C17 ·
  W no limitador C15 · sem entrada, freio-motor C15 (`tests/unit/drivetrain.test.ts:174`), C21.
- **freio de mão** (`:193-200`): com W mantém a força C36 · sem W zera a força C36 `:301` · traseira =
  max(traseira, 6000) C25, C36 · fator 0.4 C25, C36 · sem freio de mão, fator 1 C25.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| plan ACs (25) | `plan.md` Criteria (carried from 83c78fa; o fix não mexe nos ACs) | 1 C1 · 2 C2 · 3 C3 · 4 C4 · 5 C5 · 6 C6, C33 · 7 C7 · 8 C8 · 9 C9 · 10 C10 · 11 C11 · 12 C12 · 13 C13, C14 · 14 C15 · 15 C16 · 16 C17 · 17 C18 · 18 C19 · 19 C20 · 20 C21 · 21 C22 · 22 C23 · 23 C30, C31 · 24 C32, C34 · 25 C32 | - |
| decisão do usuário "freio de mão com acelerador" (6 regras) | `plan.md:162` (verified at e69acb3) | power slide com W C36 unit e física · sem W, nem motor nem freio-motor C36 `:301` · R com W andando para trás C37 · R com S andando para frente C37 · R sem entrada rolando para trás, freio-motor contra C38 `:322` · R sem entrada rolando para frente, freio-motor contra C38 `:333`, `:334` | - |
| landing doors (3) | `plan.md` Landing (carried from 83c78fa) | 1 C1, C27, C35, `tests/unit/carSpec.test.ts:64` · 2 C6, C17, C18, C24, C26 · 3 C29, `vite.config.ts:6` | - |
| rollover matrix (54) | C2 (carried from 83c78fa) | `tests/physics/stability.test.ts:10-19`, `:72`, `:81` | - |
| maneuvers (6) | AC 2 (carried from 83c78fa) | `tests/physics/stability.test.ts:13-18` | - |
| understeer cases (10) | AC 10 (carried from 83c78fa) | 5 velocidades × 2 em `tests/physics/grip.test.ts:49-50`, `:66` | - |
| gearbox transitions (8) | `drivetrain.ts:135-156` (verified at e69acb3; sem mudança em `src/`) | 2→3 C17 · sem subir da 6ª C17 · corte C17 · 4→3 C18 · sobregiro C18 · hold C18 · sem descer da 1ª C18 · entrar e sair da R C24 | - |
| rpm regimes (5) | AC 15 (carried from 83c78fa) | C16, C15 | - |
| drive input regimes (recalculado: 13) | ramos de `src/vehicle/drivetrain.ts:158-200` em e69acb3 (lista acima) | acelerador C15, C19 · freio para frente C14, C22 · freio-motor para frente C15, C21 · volante C6, C7 · ré acionada e cortada C24 · R + S andando para frente C37 · R + W andando para trás C37 · R sem entrada rolando para trás C38 `:322`, `:328` · R sem entrada rolando para frente C38 `:333`, `:334` · R sem entrada parado C38 `:336` · freio de mão: frente 0, traseira, fator C25, C11 · freio de mão + W mantém o motor C36 · freio de mão sem W zera o motor C36 | - |
| steering target cases (7) | C7 (carried from 83c78fa) | `tests/unit/drivetrain.test.ts:90-97` | - |
| skidding table (6) | AC 23 (carried from 83c78fa) | `tests/unit/effectsMath.test.ts:80-85` | - |
| superseded free-roam checks (7) | carried from 83c78fa | C2 → C14 · C4 → C24 · C6 → C6, C7 · C7 → C25 · C8 → C20 · C27 → C17, C18 · C28 → C16 | - |
| superseded visual checks (1) | carried from 83c78fa | a unidade de visual C36 → C30; browser `tests/e2e/visual.spec.ts:198` | - |
| tests in the fix diff | `git show a7d15be -- tests` e `git diff --stat 83c78fa..HEAD` (verified at e69acb3) | `tests/unit/drivetrain.test.ts` +5, sem nenhuma linha removida. As 4 linhas de código novas (`:331-334`) estão dentro do teste de C38 e cada asserção nova foi feita falhar por um mutante (F5/F7 `:333`, F6 `:334`, F8 `:332`). Nenhum outro arquivo de teste mudou | - |
| startup config (2 assemblies) | carried from 83c78fa | `src/core/Game.ts:146` → C35 · `tests/physics/harness.ts:72` → C29, C28 | - |

## Test policy rows

Verified at e69acb3 na linha não cumprida no round 3, que também é a que classifica o arquivo cuja prova o fix tocou
(`drivetrain.ts`). As outras estão carried from 83c78fa.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | `src/vehicle/drivetrain.ts`; `src/vehicle/effectsMath.ts` `isSkidding` | own layer C6, C7, C14-C18, C20, C24-C26, C30, C36-C38 · boundary C8-C13, C19-C23, C31, C32, C36 (harness) | yes - a tabela de decisão recalculada acima tem um caso afirmado em cada linha. A linha que faltava em 83c78fa (R sem entrada rolando para frente, o lado −1 do `Math.sign` em `src/vehicle/drivetrain.ts:181`) agora tem `tests/unit/drivetrain.test.ts:333-334`, e F5 morre ali. Na fronteira, o contrato de ré do browser segue coberto por C24/C34 (`tests/e2e/drive.spec.ts:39`). C38 continua só com unidade, como C37, e a linha aceita a fronteira em nível de arquivo (ver resíduos). `effectsMath` cumpre (carried from 83c78fa). `checks.md:378` lista C36-C38 entre as provas próprias |
| Decides, not reached across a boundary | nenhum arquivo do diff | um caso por linha | n/a - nenhum arquivo nesta forma (carried from 83c78fa) |
| Entry point that decides nothing | nenhum arquivo do diff | accepted / rejected / error paths | n/a - nenhum arquivo nesta forma (carried from 83c78fa) |
| Instrumentation, pass-throughs | `src/core/Game.ts`, `src/hud/Hud.ts`, `src/audio/AudioEngine.ts`, `src/vehicle/Car.ts` | coberto pela prova do consumidor | yes - carried from 83c78fa. O fix não tocou esses arquivos |

## Faults injected

Verified at e69acb3, na superfície do fix: as asserções novas de `tests/unit/drivetrain.test.ts:331-334`, que guardam o
ramo de R sem entrada em `src/vehicle/drivetrain.ts:176-181`, e a permanência em R de `:140`. As faltas rodaram num
worktree isolado (`git worktree add --detach <scratchpad>/faults4 HEAD`, com junction de `node_modules`), nunca com
`git stash`. Cada mutação partiu de uma cópia do `drivetrain.ts` original, e o `diff` de cada uma foi conferido antes
de rodar (uma linha trocada por mutante). A prova mais estreita foi `npx vitest run tests/unit/drivetrain.test.ts`.
No fim, o arquivo do rascunho era byte a byte igual ao original (`cmp`). O `git status --porcelain` do worktree do
Verifier estava vazio antes (baseline de 0 bytes). Depois, a única linha era ` M .specs/features/car-handling/verification.md`, que é este relatório. A junction de `node_modules` do rascunho foi apagada sozinha (`.Delete()`) antes do `git worktree remove`, e `git worktree list` confirma que o rascunho saiu.

| Mutation | Location | Killed |
| --- | --- | --- |
| F5 (a sobrevivente do round 3) sem sentido de rolagem: `engineForce = -Math.sign(wheelSpeedMs) * ENGINE_BRAKE_NM * t * toWheel` → `engineForce = ENGINE_BRAKE_NM * t * toWheel` (sempre para frente) | `src/vehicle/drivetrain.ts:181` | yes - C38 `tests/unit/drivetrain.test.ts:333` "expected 276.71023886808945 to be less than 0". Rodei F5 também contra a suíte vitest inteira, sem carga: 1 teste falhou (esse) e 102 passaram. Em 83c78fa o resultado tinha sido 103/103. Uma primeira rodada da suíte inteira, com o Playwright rodando em paralelo, deu mais 5 timeouts de 5 s nos testes de física. Eles vieram da carga e não de asserção, e sumiram quando rodei de novo sozinho |
| F6 magnitude assimétrica: `... * toWheel` → `... * toWheel * (wheelSpeedMs > 0 ? 0.5 : 1)` (sinal certo, metade da força rolando para frente) | `src/vehicle/drivetrain.ts:181` | yes - C38 `tests/unit/drivetrain.test.ts:334` "expected -138.355… to be close to -276.710…" |
| F7 freio de serviço em vez de freio-motor rolando para frente: `input.brake \|\| (input.throttle && kmh < -1)` → `... \|\| kmh > 1` | `src/vehicle/drivetrain.ts:176` | yes - C38 `tests/unit/drivetrain.test.ts:333` "expected 0 to be less than 0" |
| F8 R sai sozinha para a 1ª rolando para frente: `input.throttle && !input.brake && gear === -1 && kmh >= -1` → `(input.throttle \|\| kmh > 1) && ...` | `src/vehicle/drivetrain.ts:140` | yes - C38 `tests/unit/drivetrain.test.ts:332` "expected 1 to be -1" |

## Swept existing

Carried from 83c78fa (que já herdava de a46591b). O fix não tocou `Car.ts`, `input.ts` nem `harness.ts`.

## Deviations judged

- A decisão sobre R sem entrada está em `plan.md:162` ("de ré sem input, freio-motor contra o sentido em que o carro
  rola, como nas marchas para frente"). O código a segue nos dois sentidos (`src/vehicle/drivetrain.ts:181`), e agora
  os dois sentidos estão afirmados (C38 `:322` e `:333`). Não há desvio.
- As outras decisões são carried from 83c78fa: power slide, freio de serviço em R, `restoreRollMoment`, C18 com ficha
  variante, limitador em 7000.01 e R ignorando o hold.

## Gate

`npx vitest run` - 103 passed, 0 failed · `E2E_PORT=5189 npx playwright test` (12 nomeados, C32-C35) - 12 passed, 0 failed (5.3 min, sem timeout de boot)

## Ranked gaps

Nenhuma. As duas lacunas do round 3 fecharam:
1. R sem entrada rolando para frente agora tem caso: `tests/unit/drivetrain.test.ts:331-334`, que guarda
   `src/vehicle/drivetrain.ts:181`. F5 morre.
2. A precisão de C38 sobre o sentido está em `checks.md:326`.

Resíduos que não mudam o veredito (carried from 83c78fa):
- O "R na ré" do AC 24 só tem a cadeia de unidade, sem browser. A parte browser de visual C36 é
  `tests/e2e/visual.spec.ts:198`, e não visual C13 como diz o checks.md.
- C38 é só unidade, sem prova no harness. A linha da Test policy aceita a fronteira no nível do arquivo, e os rounds 2
  e 3 aceitaram C37 do mesmo jeito.
- O caso "parado, força 0" de C38 (`tests/unit/drivetrain.test.ts:336`) não separa nada sozinho, porque a 0 km/h o giro
  é `idleRpm` e `t` = 0 com qualquer sinal. Ele não precisa separar: o sentido agora é guardado por `:322` e `:333`.
