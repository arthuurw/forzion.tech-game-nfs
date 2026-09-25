# Engine sound verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 1e53a1c..1832b5d (fix: be11029..1832b5d)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Rodada 2, escopo = diff do fix (`git diff be11029..1832b5d`: `src/audio/audioMap.ts`, `src/audio/AudioEngine.ts`, `src/core/Game.ts`, `tests/unit/audioMap.test.ts`, `tests/e2e/audio.spec.ts`, os dois `checks.md`) + todo veredito que não era PASS na rodada 1. Provas re-executadas por inteiro em `HEAD` = `1832b5d`. Unitário: `npx vitest run tests/unit --reporter=verbose` - 10 arquivos, 28 testes, 28 passed, exit 0; os 7 testes de `tests/unit/audioMap.test.ts` aparecem individualmente com `✓` (incluindo o novo `ramp time constants`). Integração: `npx playwright test tests/e2e/audio.spec.ts --reporter=line` (servidor Vite próprio na 5173, confirmada livre antes; 5174 do usuário ignorada) - 8 passed (29.1 s), exit 0; os 8 testes aparecem individualmente `[1/8]`..`[8/8]` (incluindo o novo `idle tremolo depth is applied` em `[7/8]`). Todos os nomes citados em `checks.md` existem na árvore (7 `it(` em `audioMap.test.ts:21,28,38,44,52,62,75`; 8 `test(` em `audio.spec.ts:16,26,38,59,87,96,121,130`). Todas as citações abaixo foram refeitas em `1832b5d` (os dois arquivos de teste e `AudioEngine.ts` mudaram de linha).

Estado dos 5 gaps da rodada 1: (1) mutante sobrevivente da escrita de `engineGain.gain` - **resolvido**, re-injetado e morto por C6; (2) `subOsc.frequency`, `lowpass.frequency`, `tremoloDepthGain.gain` sem prova - **resolvido**, os três lidos do `AudioParam` real via `params()` (`src/audio/AudioEngine.ts:171-180`, `src/core/Game.ts:269-271`) e mortos por C8/C15; (3) constantes de rampa - **resolvido** por C14 (valor das constantes); (4) clamp de `rpmFraction` - **resolvido** por C1 `:33,:34`; (5) nota de supersede - **resolvido**, `.specs/features/free-roam-city/checks.md:241` agora cita a revisão 2 (C36 → C10 `rpm / 30`; C37 → C5 0.05 / 0.048 / 0.12; C46 → C4; C38 → C9). Achado novo ao re-julgar a linha de Test policy não atendida: o clamp inferior de `tremoloDepth` (rpm < 1000, `src/audio/audioMap.ts:54` `Math.max(0, t)`) é a mesma classe do gap 4 da rodada 1 e não tem caso asserido - ver Coverage e Test policy rows.

## Binding sources

carried from be11029 - nenhuma fonte vinculante (escape checks-only, sem `plan.md`); o fix não tocou interface.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none - checks-only escape, no plan.md and no source marked binding (`## Intent` is the plan) | n/a | none | - |

## Checks

verified at 1832b5d - todas as 15 provas re-executadas; todas as citações refeitas.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `engineCutoff` 1000→250, 4000→825, 7000→1400; clamp 500→250, 8000→1400 | vitest batch, `lowpass cutoff follows rpm` ✓ | `tests/unit/audioMap.test.ts:29` `expect(engineCutoff(1000)).toBeCloseTo(250, 6)`; `:30` `expect(engineCutoff(4000)).toBeCloseTo(825, 6)`; `:31` `expect(engineCutoff(7000)).toBeCloseTo(1400, 6)`; `:33` `expect(engineCutoff(500)).toBeCloseTo(250, 6)`; `:34` `expect(engineCutoff(8000)).toBeCloseTo(1400, 6)`; código `src/audio/audioMap.ts:36-39,47-49` | PASS |
| C2 | `tremoloDepth` 0.25 a 1000, 0.125 a 1750, 0 a 2500 e 5000 | vitest batch, `tremolo depth fades out by 2500 rpm` ✓ | `tests/unit/audioMap.test.ts:45` `expect(tremoloDepth(1000)).toBeCloseTo(0.25, 6)`; `:46` `tremoloDepth(1750)` `toBeCloseTo(0.125, 6)`; `:47` `tremoloDepth(2500)` `toBeCloseTo(0, 6)`; `:48` `tremoloDepth(5000)` `toBeCloseTo(0, 6)`; código `src/audio/audioMap.ts:52-55` (os 4 pontos da claim estão asseridos; o clamp abaixo de 1000, que a claim não nomeia mas Swept "validation: C2" cobre, fica em Coverage) | PASS |
| C3 | `engineGainFor(false)` 0.048, `(true)` 0.12, `ENGINE_GAIN_MAX` 0.12, `IDLE_FACTOR` 0.4, `AMBIENT_GAIN` 0.05, `AMBIENT_CUTOFF_HZ` 180 | vitest batch, `engine gain by throttle and ambient gain` ✓ | `tests/unit/audioMap.test.ts:53` `expect(ENGINE_GAIN_MAX).toBeCloseTo(0.12, 6)`; `:54` `expect(IDLE_FACTOR).toBeCloseTo(0.4, 6)`; `:55` `expect(engineGainFor(false)).toBeCloseTo(0.048, 6)`; `:56` `expect(engineGainFor(true)).toBeCloseTo(0.12, 6)`; `:57` `expect(AMBIENT_GAIN).toBeCloseTo(0.05, 6)`; `:58` `expect(AMBIENT_CUTOFF_HZ).toBe(180)`; código `src/audio/audioMap.ts:16-20,58-60` | PASS |
| C4 | grafo pelas propriedades reais: 3 fontes, 12 arestas na ordem dos `connect`, sem `<audio>` | Playwright batch, `synthesized audio graph` [4/8] passed | `tests/e2e/audio.spec.ts:63-67` `expect(graph.sources).toEqual([...])` com `OscillatorNode(custom,33.33Hz,engine)`, `OscillatorNode(sine,16.67Hz,sub)`, `AudioBufferSourceNode(loop=true,ambient)`; `:69-82` `expect(graph.edges).toEqual([...])` com as 12 arestas; `:83` `expect(await page.locator('audio').count()).toBe(0)`. Descrição lida do nó em `src/audio/AudioEngine.ts:207-227`; as 12 chamadas `link()` em `:64,65,89,90,91,92,93,102,103,115,116,117` batem uma a uma com `audio.spec.ts:70-81` | PASS |
| C5 | sem acelerador `gains` = ambient 0.05, engineTarget 0.048, master 1; após 1 s `engine` real a menos de 0.01 de 0.048 | Playwright batch, `gains are 0.05 ambient and 0.048 idle engine` [2/8] passed | `tests/e2e/audio.spec.ts:29` `expect(gains.ambient).toBeCloseTo(0.05, 6)`; `:30` `expect(gains.engineTarget).toBeCloseTo(0.048, 6)`; `:31` `expect(gains.master).toBeCloseTo(1, 6)`; `:34` `expect(Math.abs(settled.engine - 0.048)).toBeLessThan(0.01)`; `engine` lê `this.engineGain?.gain.value` (`src/audio/AudioEngine.ts:151`). Ressalva carried from be11029: o `AudioParam` nasce em 0.048 (`AudioEngine.ts:87`), então `:34` sozinho não distingue rampa de ausência de rampa; a escrita agora é provada por C6 | PASS |
| C6 | `W` 1 s: `engineTarget` 0.12 e `params.engineGain` real > 0.10; soltar 1 s: 0.048 e real < 0.06 | Playwright batch, `throttle raises engine gain` [3/8] passed | `tests/e2e/audio.spec.ts:46` `expect(up.target).toBeCloseTo(0.12, 6)`; `:47` `expect(up.real).toBeGreaterThan(0.1)`; `:54` `expect(down.target).toBeCloseTo(0.048, 6)`; `:55` `expect(down.real).toBeLessThan(0.06)`; `real` = `a.params.engineGain` (`:44,:52`) → `this.engineGain.gain.value` (`src/audio/AudioEngine.ts:174`) via `get params()` (`src/core/Game.ts:269-271`). Falha (a) morta aqui com `Received: 0.04800000041723251` | PASS |
| C7 | compressor threshold -18, ratio 4, knee 12 | Playwright batch, `master compressor` [5/8] passed | `tests/e2e/audio.spec.ts:90` `expect(c.threshold).toBeCloseTo(-18, 6)`; `:91` `expect(c.ratio).toBeCloseTo(4, 6)`; `:92` `expect(c.knee).toBeCloseTo(12, 6)`; lidos do nó em `src/audio/AudioEngine.ts:160-162`, definidos em `:61-63` | PASS |
| C8 | após 2 s com `W`: `cutoffTarget` a menos de 60 Hz de `engineCutoff(rpm)` e > 300; `params.lowpassHz` real > 300 e a menos de 150 Hz do esperado | Playwright batch, `lowpass cutoff follows rpm` [6/8] passed | `tests/e2e/audio.spec.ts:105` `expected = 250 + ((sample.rpm - 1000) / 6000) * (1400 - 250)`; `:106` `expect(sample.cutoff).toBeGreaterThan(300)`; `:107` `expect(Math.abs(sample.cutoff - expected)).toBeLessThan(60)`; `:109` `expect(sample.params.lowpassHz).toBeGreaterThan(300)`; `:110` `expect(Math.abs(sample.params.lowpassHz - expected)).toBeLessThan(150)`; `lowpassHz` = `this.lowpass.frequency.value` (`src/audio/AudioEngine.ts:175`), lido no mesmo `evaluate` que `rpm` (`audio.spec.ts:100-103`). Falha (b) morta aqui com `Received: 250` | PASS |
| C9 | `M` alterna master 1→0→1 | Playwright batch, `M toggles master gain` [8/8] passed | `tests/e2e/audio.spec.ts:133` `expect((...gains).master).toBeCloseTo(0, 6)`; `:135` `expect((...gains).master).toBeCloseTo(1, 6)`; `master` lê `this.master?.gain.value` (`src/audio/AudioEngine.ts:150`) | PASS |
| C10 | `firingFrequency` = rpm/30: 33.333, 133.333, 233.333 | vitest batch, `firing frequency is rpm over 30` ✓ | `tests/unit/audioMap.test.ts:22` `expect(firingFrequency(1000)).toBeCloseTo(33.333, 3)`; `:23` `(4000)` `toBeCloseTo(133.333, 3)`; `:24` `(7000)` `toBeCloseTo(233.333, 3)`; código `src/audio/audioMap.ts:42-44` | PASS |
| C11 | `engineHarmonics()` 25 coeficientes, `real` zero, `imag[0]` 0, `imag[n]` = 1/n^1.5 em n = 1, 2, 24 | vitest batch, `engine wave harmonics fall off as 1 over n to the 1.5` ✓ | `tests/unit/audioMap.test.ts:65-66` `expect(real.length).toBe(25)`, `expect(imag.length).toBe(25)`; `:67` `expect(imag[0]).toBe(0)`; `:68` `expect(real.every((v) => v === 0)).toBe(true)`; `:69` `expect(imag[1]).toBeCloseTo(1, 6)`; `:70` `expect(imag[2]).toBeCloseTo(1 / Math.pow(2, 1.5), 6)`; `:71` `expect(imag[24]).toBeCloseTo(1 / Math.pow(24, 1.5), 6)`; código `src/audio/audioMap.ts:63-69` | PASS |
| C12 | `brownNoise(8192, rng)` em [-1, 1], razão diff/abs < 0.3, amplitude média > 0.02 | vitest batch, `brown noise is low-frequency dominated and bounded` ✓ | `tests/unit/audioMap.test.ts:77` `brownNoise(n, mulberry32(7))` com `n = 8192` (`:76`); `:79` `for (const v of x) expect(Math.abs(v)).toBeLessThanOrEqual(1)`; `:87` `expect(sumDiff / sumAbs).toBeLessThan(0.3)`; `:88` `expect(sumAbs / n).toBeGreaterThan(0.02)`; código `src/audio/audioMap.ts:75-84` | PASS |
| C13 | após 2 s com `W`, `firingHz` real a menos de 20 Hz de `car.rpm / 30` no mesmo `evaluate` | Playwright batch, `lowpass cutoff follows rpm` [6/8] passed (mesmo teste de C8, asserção distinta) | `tests/e2e/audio.spec.ts:102` `firingHz: g.audio.firingHz` no mesmo `evaluate` que `rpm`; `:117` `expect(Math.abs(sample.firingHz - sample.rpm / 30)).toBeLessThan(20)`; `firingHz` lê `this.engineOsc?.frequency.value` (`src/audio/AudioEngine.ts:184`); escrita por `setTargetAtTime(f, now, OSC_RAMP_TAU_S)` em `:136` | PASS |
| C14 | `RAMP_TAU_S` 0.15 s e `OSC_RAMP_TAU_S` 0.05 s | vitest batch, `ramp time constants` ✓ | `tests/unit/audioMap.test.ts:39` `expect(RAMP_TAU_S).toBeCloseTo(0.15, 9)`; `:40` `expect(OSC_RAMP_TAU_S).toBeCloseTo(0.05, 9)`; constantes em `src/audio/audioMap.ts:32,34`; uso lido no código (não asserido): `OSC_RAMP_TAU_S` em `src/audio/AudioEngine.ts:136-137`, `RAMP_TAU_S` em `:138-140` (rg: únicos usos). Falha (d) morta aqui | PASS |
| C15 | marcha lenta 0.5 s: `params.tremoloDepth` a menos de 0.005 de 0.25 e `params.subHz` a menos de 0.5 de `engineHz / 2`; `W` 2 s (rpm > 3000): `tremoloDepth` < 0.05 e `subHz` a menos de 3 de `engineHz / 2` | Playwright batch, `idle tremolo depth is applied` [7/8] passed + `lowpass cutoff follows rpm` [6/8] passed | idle: `tests/e2e/audio.spec.ts:125` `expect(Math.abs(p.tremoloDepth - 0.25)).toBeLessThan(0.005)`; `:126` `expect(Math.abs(p.subHz - p.engineHz / 2)).toBeLessThan(0.5)`; acelerando: `:112` `expect(sample.rpm).toBeGreaterThan(3000)`; `:113` `expect(Math.abs(sample.params.subHz - sample.params.engineHz / 2)).toBeLessThan(3)`; `:114` `expect(sample.params.tremoloDepth).toBeLessThan(0.05)`; lidos de `src/audio/AudioEngine.ts:177-178`. Falha (c) morta por `:114` (`Received: 0.25`); a metade idle passou sob a falha porque os valores iniciais já são 0.25 (`AudioEngine.ts:100`) e f0/2 (`:76`) - nota, não mutante sobrevivente | PASS |

## Coverage

Linhas tocadas pelo fix: verified at 1832b5d, recomputadas do código. Linhas não tocadas: carried from be11029, com citações refeitas para as linhas em `1832b5d`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| per-frame AudioParam writes in update() (5) - verified at 1832b5d | `src/audio/AudioEngine.ts:136-140` | engineOsc.frequency `:136` → C13 `audio.spec.ts:117` · subOsc.frequency `:137` → C15 `:113` (acelerando; idle `:126` não distingue do valor inicial) · lowpass.frequency `:138` → C8 `:109-110` (falha b morta) · engineGain.gain `:139` → C6 `:47,:55` (falha a morta) · tremoloDepthGain.gain `:140` → C15 `:114` (falha c morta; idle `:125` não distingue do valor inicial) | - |
| cutoff samples (5) - verified at 1832b5d | claim C1 + `src/audio/audioMap.ts:47-49` | 500 C1 `audioMap.test.ts:33` · 1000 `:29` · 4000 `:30` · 7000 `:31` · 8000 `:34` | - |
| rpmFraction clamp rows (3) - verified at 1832b5d | `Math.min(1, Math.max(0, t))` em `src/audio/audioMap.ts:38` | abaixo de 1000 C1 `audioMap.test.ts:33` (falha e morta, `expected 154.1666 to be close to 250`) · dentro da faixa `:29-31` · acima de 7000 `:34` | - |
| ramp constants (2) - verified at 1832b5d | `src/audio/audioMap.ts:32,34`; usos em `AudioEngine.ts:136-140` | gain/filter 0.15 C14 `audioMap.test.ts:39` · oscillator 0.05 C14 `:40` (falha d morta) | - |
| engine gain states (2) - verified at 1832b5d | ramo `throttle ?` em `src/audio/audioMap.ts:59` | idle 0.048 C3 `audioMap.test.ts:55` + C5 `audio.spec.ts:30,34` · throttle 0.12 C3 `:56` + C6 `audio.spec.ts:46,47` (valor real) | - |
| superseded checks (3) - verified at 1832b5d | `.specs/features/free-roam-city/checks.md:241` (nota corrigida) e `:130,:133,:164` | ex-36 (60..200 Hz) → C10 `audioMap.test.ts:21-25`, teste antigo `rpm maps linearly to 60..200 Hz` ausente (grep sem hits em `src`, `tests`) · ex-37 (0.3/0.5) → C5 `audio.spec.ts:26-35`, teste antigo `gains are 0.3 ambient 0.5 engine` ausente · ex-46 (sawtooth) → C4 `audio.spec.ts:59-84` | - |
| tremoloDepth clamp rows (3) - verified at 1832b5d, conjunto sem linha na tabela do autor (Swept "validation: C1, C2, C12 - clamps dos mapeamentos") | `Math.min(1, Math.max(0, t))` em `src/audio/audioMap.ts:54` | abaixo de 1000 (`Math.max(0, t)`, profundidade fixa em 0.25) → nenhuma amostra: C2 amostra t = 0, 0.5, 1, 2.67 (`audioMap.test.ts:45-48`), todas com t ≥ 0, logo remover `Math.max(0, ...)` não muda nenhum valor asserido (não injetado - limite de 5 falhas) · dentro da faixa 1000, 1750 C2 `:45-46` · acima de 2500 (`Math.min(1, ...)`) 2500, 5000 C2 `:47-48` | tremoloDepth abaixo de 1000 RPM (`src/audio/audioMap.ts:54`) |
| audio graph edges (12) - carried from be11029 | 12 chamadas `link()` em `src/audio/AudioEngine.ts:64,65,89,90,91,92,93,102,103,115,116,117` | cada aresta → C4 `tests/e2e/audio.spec.ts:70-81`, uma linha por aresta na mesma ordem | - |
| audio graph sources (3) - carried from be11029 | `sourceNodes.push` em `src/audio/AudioEngine.ts:77,109` | engineOsc C4 `audio.spec.ts:64` · subOsc `:65` · brown noise `:66` | - |
| engine chain nodes (5) - carried from be11029 | `AudioEngine.ts:71-93` | engine osc C4 `:64,:72` · sub osc `:65,:73` · lowpass 250 Hz `:72-74` · tremolo gain 1.000 `:74-75` · engine gain 0.048 `:75-76` | - |
| tremolo modulation nodes (3) - carried from be11029 | `AudioEngine.ts:96-103` | lfo sine 6.00 Hz C4 `:77` · depth gain 0.250 `:77-78` · `AudioParam(tremolo.gain)` `:78` | - |
| ambient chain nodes (3) - carried from be11029 | `AudioEngine.ts:106-117` | brown source loop=true C4 `:66,:79` · lowpass 180 Hz `:79-80` · ambient gain 0.050 `:80-81` | - |
| master chain nodes (3) - carried from be11029 | `AudioEngine.ts:58-65` | master gain 1.000 C4 `:70` · compressor C4 `:70-71` + C7 `:90-92` · destination C4 `:71` | - |
| tremolo samples (4) - carried from be11029 | claim C2 | 1000 C2 `audioMap.test.ts:45` · 1750 `:46` · 2500 `:47` · 5000 `:48` | - |
| firing frequency samples (3) - carried from be11029 | claim C10 | 1000 C10 `audioMap.test.ts:22` · 4000 `:23` · 7000 `:24` | - |
| harmonic samples (4) - carried from be11029 | claim C11 + `audioMap.ts:67` | dc C11 `audioMap.test.ts:67` · n=1 `:69` · n=2 `:70` · n=24 `:71` | - |
| compressor params (3) - carried from be11029 | `AudioEngine.ts:61-63` | threshold C7 `audio.spec.ts:90` · ratio `:91` · knee `:92` | - |
| mute transitions (2) - carried from be11029 | `toggleMute()` `AudioEngine.ts:143-146` | 1→0 C9 `audio.spec.ts:133` · 0→1 `:135` | - |

Notas (não são membros sem prova):

- `rpm` nunca sai de 1000..7000 no produto: `src/vehicle/drivetrain.ts:72` limita com `Math.min(RPM_MAX, Math.max(RPM_MIN, rpm))`. O clamp inferior de `tremoloDepth` é defensivo e inalcançável pelo jogo; continua sendo uma linha da tabela de decisão da função pura que o Swept declara coberta por C2, exatamente como o clamp de `rpmFraction` que a rodada 1 cobrou e o fix fechou.
- C14 afirma o valor das constantes, não que `update()` as usa; o uso foi lido no código (`AudioEngine.ts:136-140`). Um literal na chamada passaria em C14; as tolerâncias de C8 (150 Hz) e C13 (20 Hz) não isolam o τ. A claim de C14 é sobre as constantes, então está provada como escrita.
- `.specs/features/engine-sound/checks.md:120-121` (evidência de Test policy) ainda lista a cobertura de `AudioEngine.ts` como C4-C9, C13 e os getters de `Game.ts` sem `params`/C15; documentação desatualizada, sem efeito nas provas.
- carried from be11029: `lowpass.Q = 1.2` (`AudioEngine.ts:82`) e os coeficientes internos de `brownNoise` (`audioMap.ts:80-81`) não são nomeados por nenhum check.

## Test policy rows

Linha não atendida na rodada 1 re-julgada; linha que classifica arquivos tocados (`AudioEngine.ts`, `Game.ts`) re-julgada; linhas sem arquivo classificado carried from be11029.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | none classified (carried from be11029) | n/a | n/a - none classified |
| Decides, not reached across a boundary | `src/audio/audioMap.ts` (engineCutoff, rpmFraction, tremoloDepth, firingFrequency, engineGainFor, engineHarmonics, brownNoise) - verified at 1832b5d | one at its own layer, one asserted case per decision row | no - atendidos: engineCutoff/rpmFraction nos 3 ramos (C1 `audioMap.test.ts:29-34`, gap 4 da rodada 1 fechado), firingFrequency C10, engineGainFor nos 2 ramos C3, engineHarmonics C11, brownNoise C12, tremoloDepth faixa linear e clamp superior C2 `:45-48`; não atendido: ramo de clamp inferior de `tremoloDepth` (rpm < 1000, `src/audio/audioMap.ts:54`) sem caso asserido, embora Swept "validation" cite C2 para os clamps |
| Entry point that decides nothing | none classified (carried from be11029) | n/a | n/a - none classified |
| Instrumentation, pass-throughs | `src/audio/AudioEngine.ts`, `src/core/Game.ts` (getters `gains`, `graph`, `compressor`, `cutoffTarget`, `firingHz`, `params`, `throttling` em `Game.ts:254-274`) - verified at 1832b5d | covered by consumer's proof (C4-C9, C13, C15 via `window.__game.audio`) | yes - as 5 escritas de `update()` (`AudioEngine.ts:136-140`) agora são observadas pelo valor real (C13, C15, C8, C6, C15) e as três falhas nessa superfície foram mortas; `start()` e os getters seguem cobertos por C4, C5, C7, C9; `params()` (`AudioEngine.ts:171-180`) e `get params()` (`Game.ts:269-271`) exercitados por C6, C8, C15 |

## Faults injected

Isolamento: `git worktree add <scratchpad>/verify-snd3 1832b5d` + junction de `node_modules`; porta 5173 confirmada sem LISTENER antes de cada rodada Playwright (config `reuseExistingServer: true`; cada falha e2e mostra o valor mutado, provando que o servidor era o do worktree). Linha de base `git status --porcelain` = `?? .specs/features/engine-sound/verification.md`, `?? .specs/features/visual-upgrade/checks.md`; `git checkout -- <arquivo>` entre falhas; ao final `rmdir` da junction (node_modules real intacto), `git worktree remove --force`; porcelain da árvore real idêntico à linha de base (`diff` vazio; a única mudança é o conteúdo deste `verification.md`, já não rastreado). Worktree `Jogo-visual` não tocado; sem `git worktree prune`.

| Mutation | Location | Killed |
| --- | --- | --- |
| carried from be11029: `firingFrequency` retorna `rpm / 60` | `src/audio/audioMap.ts:41` em be11029 (`:43` em 1832b5d) | yes - C10 `-t "firing frequency is rpm over 30"` exit 1: `expected 16.666666666666668 to be close to 33.333` |
| carried from be11029: `ENGINE_HARMONIC_FALLOFF` 1.5 -> 1.0 | `src/audio/audioMap.ts:29` | yes - C11 exit 1: `expected 0.5 to be close to 0.35355339059327373` |
| carried from be11029: `subOsc.type` `'sine'` -> `'triangle'` | `src/audio/AudioEngine.ts:74` em be11029 (`:75` em 1832b5d) | yes - C4 1 failed: `+ "OscillatorNode(triangle,16.67Hz,sub)"` |
| carried from be11029: `compressor.ratio.value` 4 -> 3 | `src/audio/AudioEngine.ts:61` em be11029 (`:62` em 1832b5d) | yes - C7 1 failed: `Expected: 4 Received: 3` |
| (a) re-injeção do mutante sobrevivente da rodada 1 (rodada 1: no em be11029): remoção de `this.engineGain.gain.setTargetAtTime(this.engineTarget, now, RAMP_TAU_S)` em `update()` | `src/audio/AudioEngine.ts:139` | yes - C6 `npx playwright test tests/e2e/audio.spec.ts -g "throttle raises engine gain"` 1 failed, exit 1: `Expected: > 0.1 Received: 0.04800000041723251` em `audio.spec.ts:47` |
| (b) remoção de `this.lowpass.frequency.setTargetAtTime(this.cutoffTarget, now, RAMP_TAU_S)` | `src/audio/AudioEngine.ts:138` | yes - C8 `-g "lowpass cutoff follows rpm"` 1 failed, exit 1: `Expected: > 300 Received: 250` em `audio.spec.ts:109` |
| (c) remoção de `this.tremoloDepthGain.gain.setTargetAtTime(tremoloDepth(rpm), now, RAMP_TAU_S)` | `src/audio/AudioEngine.ts:140` | yes - C15, `-g` com a alternação dos dois testes de C15: `lowpass cutoff follows rpm` failed `Expected: < 0.05 Received: 0.25` em `audio.spec.ts:114`, exit 1; `idle tremolo depth is applied` passou (valor inicial já é 0.25) |
| (d) `OSC_RAMP_TAU_S` 0.05 -> 0.1 | `src/audio/audioMap.ts:34` | yes - C14 `npx vitest run tests/unit/audioMap.test.ts -t "ramp time constants"` exit 1: `expected 0.1 to be close to 0.05` em `audioMap.test.ts:40` |
| (e) clamp de `rpmFraction` removido (`return t;`) | `src/audio/audioMap.ts:38` | yes - C1 `-t "lowpass cutoff follows rpm"` exit 1: `expected 154.16666666666669 to be close to 250` em `audioMap.test.ts:33` |

Provas nunca levadas a falhar (limite de 5 por rodada): C2, C3, C5, C9, C12, C13. O clamp inferior de `tremoloDepth` não foi injetado (limite atingido); a sobrevivência decorre de todas as amostras de C2 terem t ≥ 0 (Coverage).

## Gate

Provas em `HEAD` `1832b5d`: `npx vitest run tests/unit --reporter=verbose` - 28 passed, 0 failed; `npx playwright test tests/e2e/audio.spec.ts --reporter=line` - 8 passed, 0 failed.

`cd C:/Users/arthu/.claude/skills/tlc-spec-lean/scripts && python validate_verification.py engine-sound --root C:/Users/arthu/source/repos/Jogo`

```
  ERROR engine-sound: verdict is FAIL - route the ranked gaps back as fixes, then re-verify

validate_verification: 1 error(s), 0 warning(s) across [engine-sound]
GATE_EXIT=1
```

Único erro é o veredito FAIL (por desenho do script); nenhum erro de formato, nenhum aviso.

## Ranked gaps

1. Ramo de clamp inferior de `tremoloDepth` (rpm < 1000 → 0.25) sem caso asserido, embora Swept "validation: C1, C2, C12 - clamps dos mapeamentos" o declare coberto por C2 - Test policy "Decides, not reached across a boundary" não atendida - `src/audio/audioMap.ts:54`; C2 `tests/unit/audioMap.test.ts:45-48` (só t ≥ 0). Inalcançável no jogo (`src/vehicle/drivetrain.ts:72`), mesma classe do gap 4 da rodada 1.

## Walk with user

Usuário testou o som e aprovou a revisão 2 de ouvido ("o som melhorou").
