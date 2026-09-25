# Engine sound verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 1e53a1c..be535dc (fix: 1832b5d..be535dc)
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

Rodada 3, escopo = diff do fix (`git diff 1832b5d..be535dc`: `tests/unit/audioMap.test.ts` +2 linhas - `expect(tremoloDepth(500)).toBeCloseTo(0.25, 6)`; `.specs/features/engine-sound/checks.md` - claim de C2, linha de Coverage `tremolo samples (5)`, evidência de Test policy; `.specs/lessons.json`, `.specs/LESSONS.md`; e o `verification.md` da rodada 2 commitado) + todo veredito que não era PASS na rodada 2 (a linha de Test policy "Decides, not reached across a boundary" e o membro sem prova `tremoloDepth abaixo de 1000 RPM`). Nenhum arquivo de `src/` nem `tests/e2e/` mudou (`git diff 1832b5d..be535dc -- src/ tests/e2e/` vazio), então as citações de código e de `audio.spec.ts` seguem válidas em `be535dc`. Provas re-executadas por inteiro em `HEAD` = `be535dc`. Unitário: `npx vitest run tests/unit --reporter=verbose` - 10 arquivos, 28 testes, 28 passed, exit 0; os 7 testes de `tests/unit/audioMap.test.ts` aparecem individualmente com `✓`. Integração: `npx playwright test tests/e2e/audio.spec.ts --reporter=line` (servidor Vite próprio na 5173, confirmada sem LISTENER antes; 5174 do usuário ignorada) - 8 passed (31.3 s), exit 0; os 8 testes aparecem individualmente `[1/8]`..`[8/8]`. Todos os nomes citados em `checks.md` existem na árvore (7 `it(` em `audioMap.test.ts:21,28,38,44,54,64,77`; 8 `test(` em `audio.spec.ts:16,26,38,59,87,96,121,130`). Citações de `audioMap.test.ts` refeitas em `be535dc` (C3, C11, C12 deslocaram +2 linhas).

Estado do gap da rodada 2: clamp inferior de `tremoloDepth` sem caso asserido - **resolvido**: `tests/unit/audioMap.test.ts:50` `expect(tremoloDepth(500)).toBeCloseTo(0.25, 6)`, e a falha que remove `Math.max(0, t)` em `src/audio/audioMap.ts:54` foi injetada e morta (`expected 0.3333333333333333 to be close to 0.25`).

## Binding sources

carried from be11029 - nenhuma fonte vinculante (escape checks-only, sem `plan.md`); o fix não tocou interface.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none - checks-only escape, no plan.md and no source marked binding (`## Intent` is the plan) | n/a | none | - |

## Checks

verified at be535dc - todas as 15 provas re-executadas em `be535dc`. Citações de C1, C2, C3, C10, C11, C12, C14 (arquivo tocado `tests/unit/audioMap.test.ts`) refeitas em `be535dc`; citações de C4-C9, C13, C15 (`tests/e2e/audio.spec.ts` e `src/`, não tocados) carried from 1832b5d, ainda exatas.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `engineCutoff` 1000→250, 4000→825, 7000→1400; clamp 500→250, 8000→1400 | vitest batch, `lowpass cutoff follows rpm` ✓ | `tests/unit/audioMap.test.ts:29` `expect(engineCutoff(1000)).toBeCloseTo(250, 6)`; `:30` `expect(engineCutoff(4000)).toBeCloseTo(825, 6)`; `:31` `expect(engineCutoff(7000)).toBeCloseTo(1400, 6)`; `:33` `expect(engineCutoff(500)).toBeCloseTo(250, 6)`; `:34` `expect(engineCutoff(8000)).toBeCloseTo(1400, 6)`; código `src/audio/audioMap.ts:36-39,47-49` | PASS |
| C2 | `tremoloDepth` 0.25 a 1000, 0.125 a 1750, 0 a 2500 e 5000; clamp 500→0.25 | vitest batch, `tremolo depth fades out by 2500 rpm` ✓ | `tests/unit/audioMap.test.ts:45` `expect(tremoloDepth(1000)).toBeCloseTo(0.25, 6)`; `:46` `expect(tremoloDepth(1750)).toBeCloseTo(0.125, 6)`; `:47` `expect(tremoloDepth(2500)).toBeCloseTo(0, 6)`; `:48` `expect(tremoloDepth(5000)).toBeCloseTo(0, 6)`; `:50` `expect(tremoloDepth(500)).toBeCloseTo(0.25, 6)`; código `src/audio/audioMap.ts:52-55`. Falha (f) morta em `:50` | PASS |
| C3 | `engineGainFor(false)` 0.048, `(true)` 0.12, `ENGINE_GAIN_MAX` 0.12, `IDLE_FACTOR` 0.4, `AMBIENT_GAIN` 0.05, `AMBIENT_CUTOFF_HZ` 180 | vitest batch, `engine gain by throttle and ambient gain` ✓ | `tests/unit/audioMap.test.ts:55` `expect(ENGINE_GAIN_MAX).toBeCloseTo(0.12, 6)`; `:56` `expect(IDLE_FACTOR).toBeCloseTo(0.4, 6)`; `:57` `expect(engineGainFor(false)).toBeCloseTo(0.048, 6)`; `:58` `expect(engineGainFor(true)).toBeCloseTo(0.12, 6)`; `:59` `expect(AMBIENT_GAIN).toBeCloseTo(0.05, 6)`; `:60` `expect(AMBIENT_CUTOFF_HZ).toBe(180)`; código `src/audio/audioMap.ts:16-20,58-60` | PASS |
| C4 | grafo pelas propriedades reais: 3 fontes, 12 arestas na ordem dos `connect`, sem `<audio>` | Playwright batch, `synthesized audio graph` [4/8] passed | carried from 1832b5d (arquivo não tocado): `tests/e2e/audio.spec.ts:63-67` `expect(graph.sources).toEqual([...])` com `OscillatorNode(custom,33.33Hz,engine)`, `OscillatorNode(sine,16.67Hz,sub)`, `AudioBufferSourceNode(loop=true,ambient)`; `:69-82` `expect(graph.edges).toEqual([...])` com as 12 arestas; `:83` `expect(await page.locator('audio').count()).toBe(0)`. Descrição lida do nó em `src/audio/AudioEngine.ts:207-227`; 12 chamadas `link()` em `:64,65,89,90,91,92,93,102,103,115,116,117` | PASS |
| C5 | sem acelerador `gains` = ambient 0.05, engineTarget 0.048, master 1; após 1 s `engine` real a menos de 0.01 de 0.048 | Playwright batch, `gains are 0.05 ambient and 0.048 idle engine` [2/8] passed | carried from 1832b5d: `tests/e2e/audio.spec.ts:29` `expect(gains.ambient).toBeCloseTo(0.05, 6)`; `:30` `expect(gains.engineTarget).toBeCloseTo(0.048, 6)`; `:31` `expect(gains.master).toBeCloseTo(1, 6)`; `:34` `expect(Math.abs(settled.engine - 0.048)).toBeLessThan(0.01)`; `engine` lê `this.engineGain?.gain.value` (`src/audio/AudioEngine.ts:151`). Ressalva: o `AudioParam` nasce em 0.048 (`AudioEngine.ts:87`), então `:34` sozinho não distingue rampa de ausência de rampa; a escrita é provada por C6 | PASS |
| C6 | `W` 1 s: `engineTarget` 0.12 e `params.engineGain` real > 0.10; soltar 1 s: 0.048 e real < 0.06 | Playwright batch, `throttle raises engine gain` [3/8] passed | carried from 1832b5d: `tests/e2e/audio.spec.ts:46` `expect(up.target).toBeCloseTo(0.12, 6)`; `:47` `expect(up.real).toBeGreaterThan(0.1)`; `:54` `expect(down.target).toBeCloseTo(0.048, 6)`; `:55` `expect(down.real).toBeLessThan(0.06)`; `real` = `a.params.engineGain` → `this.engineGain.gain.value` (`src/audio/AudioEngine.ts:174`) via `get params()` (`src/core/Game.ts:269-271`). Falha (a) morta aqui | PASS |
| C7 | compressor threshold -18, ratio 4, knee 12 | Playwright batch, `master compressor` [5/8] passed | carried from 1832b5d: `tests/e2e/audio.spec.ts:90` `expect(c.threshold).toBeCloseTo(-18, 6)`; `:91` `expect(c.ratio).toBeCloseTo(4, 6)`; `:92` `expect(c.knee).toBeCloseTo(12, 6)`; lidos em `src/audio/AudioEngine.ts:160-162`, definidos em `:61-63` | PASS |
| C8 | após 2 s com `W`: `cutoffTarget` a menos de 60 Hz de `engineCutoff(rpm)` e > 300; `params.lowpassHz` real > 300 e a menos de 150 Hz do esperado | Playwright batch, `lowpass cutoff follows rpm` [6/8] passed | carried from 1832b5d: `tests/e2e/audio.spec.ts:105` `expected = 250 + ((sample.rpm - 1000) / 6000) * (1400 - 250)`; `:106` `expect(sample.cutoff).toBeGreaterThan(300)`; `:107` `expect(Math.abs(sample.cutoff - expected)).toBeLessThan(60)`; `:109` `expect(sample.params.lowpassHz).toBeGreaterThan(300)`; `:110` `expect(Math.abs(sample.params.lowpassHz - expected)).toBeLessThan(150)`; `lowpassHz` = `this.lowpass.frequency.value` (`src/audio/AudioEngine.ts:175`). Falha (b) morta aqui | PASS |
| C9 | `M` alterna master 1→0→1 | Playwright batch, `M toggles master gain` [8/8] passed | carried from 1832b5d: `tests/e2e/audio.spec.ts:133` `expect((...gains).master).toBeCloseTo(0, 6)`; `:135` `expect((...gains).master).toBeCloseTo(1, 6)`; `master` lê `this.master?.gain.value` (`src/audio/AudioEngine.ts:150`) | PASS |
| C10 | `firingFrequency` = rpm/30: 33.333, 133.333, 233.333 | vitest batch, `firing frequency is rpm over 30` ✓ | `tests/unit/audioMap.test.ts:22` `expect(firingFrequency(1000)).toBeCloseTo(33.333, 3)`; `:23` `expect(firingFrequency(4000)).toBeCloseTo(133.333, 3)`; `:24` `expect(firingFrequency(7000)).toBeCloseTo(233.333, 3)`; código `src/audio/audioMap.ts:42-44` | PASS |
| C11 | `engineHarmonics()` 25 coeficientes, `real` zero, `imag[0]` 0, `imag[n]` = 1/n^1.5 em n = 1, 2, 24 | vitest batch, `engine wave harmonics fall off as 1 over n to the 1.5` ✓ | `tests/unit/audioMap.test.ts:67` `expect(real.length).toBe(25)`; `:68` `expect(imag.length).toBe(25)`; `:69` `expect(imag[0]).toBe(0)`; `:70` `expect(real.every((v) => v === 0)).toBe(true)`; `:71` `expect(imag[1]).toBeCloseTo(1, 6)`; `:72` `expect(imag[2]).toBeCloseTo(1 / Math.pow(2, 1.5), 6)`; `:73` `expect(imag[24]).toBeCloseTo(1 / Math.pow(24, 1.5), 6)`; código `src/audio/audioMap.ts:63-69` | PASS |
| C12 | `brownNoise(8192, rng)` em [-1, 1], razão diff/abs < 0.3, amplitude média > 0.02 | vitest batch, `brown noise is low-frequency dominated and bounded` ✓ | `tests/unit/audioMap.test.ts:78-79` `n = 8192`, `brownNoise(n, mulberry32(7))`; `:81` `for (const v of x) expect(Math.abs(v)).toBeLessThanOrEqual(1)`; `:89` `expect(sumDiff / sumAbs).toBeLessThan(0.3)`; `:90` `expect(sumAbs / n).toBeGreaterThan(0.02)`; código `src/audio/audioMap.ts:75-84` | PASS |
| C13 | após 2 s com `W`, `firingHz` real a menos de 20 Hz de `car.rpm / 30` no mesmo `evaluate` | Playwright batch, `lowpass cutoff follows rpm` [6/8] passed (mesmo teste de C8, asserção distinta) | carried from 1832b5d: `tests/e2e/audio.spec.ts:102` `firingHz: g.audio.firingHz` no mesmo `evaluate` que `rpm`; `:117` `expect(Math.abs(sample.firingHz - sample.rpm / 30)).toBeLessThan(20)`; `firingHz` lê `this.engineOsc?.frequency.value` (`src/audio/AudioEngine.ts:184`) | PASS |
| C14 | `RAMP_TAU_S` 0.15 s e `OSC_RAMP_TAU_S` 0.05 s | vitest batch, `ramp time constants` ✓ | `tests/unit/audioMap.test.ts:39` `expect(RAMP_TAU_S).toBeCloseTo(0.15, 9)`; `:40` `expect(OSC_RAMP_TAU_S).toBeCloseTo(0.05, 9)`; constantes em `src/audio/audioMap.ts:32,34`; uso lido no código (não asserido) em `src/audio/AudioEngine.ts:136-140`. Falha (d) morta aqui | PASS |
| C15 | marcha lenta 0.5 s: `params.tremoloDepth` a menos de 0.005 de 0.25 e `params.subHz` a menos de 0.5 de `engineHz / 2`; `W` 2 s (rpm > 3000): `tremoloDepth` < 0.05 e `subHz` a menos de 3 de `engineHz / 2` | Playwright batch, `idle tremolo depth is applied` [7/8] passed + `lowpass cutoff follows rpm` [6/8] passed | carried from 1832b5d: idle `tests/e2e/audio.spec.ts:125` `expect(Math.abs(p.tremoloDepth - 0.25)).toBeLessThan(0.005)`; `:126` `expect(Math.abs(p.subHz - p.engineHz / 2)).toBeLessThan(0.5)`; acelerando `:112` `expect(sample.rpm).toBeGreaterThan(3000)`; `:113` `expect(Math.abs(sample.params.subHz - sample.params.engineHz / 2)).toBeLessThan(3)`; `:114` `expect(sample.params.tremoloDepth).toBeLessThan(0.05)`; lidos de `src/audio/AudioEngine.ts:177-178`. Falha (c) morta por `:114`; a metade idle não distingue do valor inicial (nota) | PASS |

## Coverage

Linhas cuja autoridade o fix tocou (`tremolo samples`, `tremoloDepth clamp rows`) e linhas com citações em `audioMap.test.ts`: verified at be535dc, recomputadas do código. Demais linhas: carried from 1832b5d (código e `audio.spec.ts` inalterados).

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| tremolo samples (5) - verified at be535dc | claim C2 (`checks.md:41`) + `src/audio/audioMap.ts:52-55` | 500 C2 `audioMap.test.ts:50` (falha f morta) · 1000 `:45` · 1750 `:46` · 2500 `:47` · 5000 `:48` | - |
| tremoloDepth clamp rows (3) - verified at be535dc | `Math.min(1, Math.max(0, t))` em `src/audio/audioMap.ts:54` | abaixo de 1000 (`Math.max(0, t)`) 500 C2 `audioMap.test.ts:50`, falha f morta · dentro da faixa 1000, 1750 C2 `:45-46` · acima de 2500 (`Math.min(1, ...)`) 2500, 5000 C2 `:47-48` | - |
| cutoff samples (5) - verified at be535dc | claim C1 + `src/audio/audioMap.ts:47-49` | 500 C1 `audioMap.test.ts:33` · 1000 `:29` · 4000 `:30` · 7000 `:31` · 8000 `:34` | - |
| rpmFraction clamp rows (3) - verified at be535dc | `Math.min(1, Math.max(0, t))` em `src/audio/audioMap.ts:38` | abaixo de 1000 C1 `audioMap.test.ts:33` (falha e morta na rodada 2) · dentro da faixa `:29-31` · acima de 7000 `:34` | - |
| ramp constants (2) - verified at be535dc | `src/audio/audioMap.ts:32,34`; usos em `AudioEngine.ts:136-140` | gain/filter 0.15 C14 `audioMap.test.ts:39` · oscillator 0.05 C14 `:40` (falha d morta) | - |
| engine gain states (2) - verified at be535dc | ramo `throttle ?` em `src/audio/audioMap.ts:59` | idle 0.048 C3 `audioMap.test.ts:57` + C5 `audio.spec.ts:30,34` · throttle 0.12 C3 `:58` + C6 `audio.spec.ts:46,47` | - |
| firing frequency samples (3) - verified at be535dc | claim C10 | 1000 C10 `audioMap.test.ts:22` · 4000 `:23` · 7000 `:24` | - |
| harmonic samples (4) - verified at be535dc | claim C11 + `audioMap.ts:67` | dc C11 `audioMap.test.ts:69` · n=1 `:71` · n=2 `:72` · n=24 `:73` | - |
| per-frame AudioParam writes in update() (5) - carried from 1832b5d | `src/audio/AudioEngine.ts:136-140` | engineOsc.frequency `:136` → C13 `audio.spec.ts:117` · subOsc.frequency `:137` → C15 `:113` · lowpass.frequency `:138` → C8 `:109-110` (falha b morta) · engineGain.gain `:139` → C6 `:47,:55` (falha a morta) · tremoloDepthGain.gain `:140` → C15 `:114` (falha c morta) | - |
| superseded checks (3) - carried from 1832b5d | `.specs/features/free-roam-city/checks.md:241` e `:130,:133,:164` | ex-36 → C10 `audioMap.test.ts:21-25` · ex-37 → C5 `audio.spec.ts:26-35` · ex-46 → C4 `audio.spec.ts:59-84` | - |
| audio graph edges (12) - carried from 1832b5d | 12 chamadas `link()` em `src/audio/AudioEngine.ts:64,65,89,90,91,92,93,102,103,115,116,117` | cada aresta → C4 `tests/e2e/audio.spec.ts:70-81`, uma linha por aresta na mesma ordem | - |
| audio graph sources (3) - carried from 1832b5d | `sourceNodes.push` em `src/audio/AudioEngine.ts:77,109` | engineOsc C4 `audio.spec.ts:64` · subOsc `:65` · brown noise `:66` | - |
| engine chain nodes (5) - carried from 1832b5d | `AudioEngine.ts:71-93` | engine osc C4 `:64,:72` · sub osc `:65,:73` · lowpass 250 Hz `:72-74` · tremolo gain 1.000 `:74-75` · engine gain 0.048 `:75-76` | - |
| tremolo modulation nodes (3) - carried from 1832b5d | `AudioEngine.ts:96-103` | lfo sine 6.00 Hz C4 `:77` · depth gain 0.250 `:77-78` · `AudioParam(tremolo.gain)` `:78` | - |
| ambient chain nodes (3) - carried from 1832b5d | `AudioEngine.ts:106-117` | brown source loop=true C4 `:66,:79` · lowpass 180 Hz `:79-80` · ambient gain 0.050 `:80-81` | - |
| master chain nodes (3) - carried from 1832b5d | `AudioEngine.ts:58-65` | master gain 1.000 C4 `:70` · compressor C4 `:70-71` + C7 `:90-92` · destination C4 `:71` | - |
| compressor params (3) - carried from 1832b5d | `AudioEngine.ts:61-63` | threshold C7 `audio.spec.ts:90` · ratio `:91` · knee `:92` | - |
| mute transitions (2) - carried from 1832b5d | `toggleMute()` `AudioEngine.ts:143-146` | 1→0 C9 `audio.spec.ts:133` · 0→1 `:135` | - |

Notas (não são membros sem prova):

- `rpm` nunca sai de 1000..7000 no produto (`src/vehicle/drivetrain.ts:72`); os clamps inferiores de `rpmFraction` e `tremoloDepth` são defensivos, agora ambos com caso asserido.
- carried from 1832b5d: as metades idle de C5 (`audio.spec.ts:34`) e C15 (`:125-126`) não distinguem o valor escrito do valor inicial do nó (`AudioEngine.ts:87,100,76`); as escritas correspondentes são provadas pelos casos acelerando (C6, C15 `:113-114`).
- carried from 1832b5d: C14 afirma o valor das constantes, não que `update()` as usa; um literal na chamada passaria em C14. A claim é sobre as constantes, provada como escrita.
- Evidência de Test policy em `checks.md:120-121` atualizada pelo fix (C15 e `params` incluídos); a nota de documentação desatualizada da rodada 2 está fechada.
- carried from be11029: `lowpass.Q = 1.2` (`AudioEngine.ts:82`) e os coeficientes internos de `brownNoise` (`audioMap.ts:80-81`) não são nomeados por nenhum check.

## Test policy rows

Linha não atendida na rodada 2 re-julgada (verified at be535dc); o fix não tocou arquivo classificado por outra linha (nenhum `src/` mudou), então as demais são carried from 1832b5d.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary | none classified (carried from 1832b5d) | n/a | n/a - none classified |
| Decides, not reached across a boundary | `src/audio/audioMap.ts` (engineCutoff, rpmFraction, tremoloDepth, firingFrequency, engineGainFor, engineHarmonics, brownNoise) - verified at be535dc | one at its own layer, one asserted case per decision row | yes - engineCutoff/rpmFraction nos 3 ramos (C1 `audioMap.test.ts:29-34`); tremoloDepth nos 3 ramos: abaixo `:50`, faixa linear `:45-46`, acima `:47-48` (C2); firingFrequency C10 `:22-24`; engineGainFor nos 2 ramos C3 `:57-58`; engineHarmonics C11 `:67-73`; brownNoise C12 `:81,:89-90`; todos na camada própria (vitest) |
| Entry point that decides nothing | none classified (carried from 1832b5d) | n/a | n/a - none classified |
| Instrumentation, pass-throughs | `src/audio/AudioEngine.ts`, `src/core/Game.ts` (getters em `Game.ts:254-274`) - carried from 1832b5d | covered by consumer's proof (C4-C9, C13, C15 via `window.__game.audio`) | yes - as 5 escritas de `update()` (`AudioEngine.ts:136-140`) observadas pelo valor real (C13, C15, C8, C6, C15) e re-executadas verdes em be535dc; `start()` e getters cobertos por C4, C5, C7, C9 |

## Faults injected

Rodada 3, verified at be535dc: isolamento `git worktree add <scratchpad>/verify-snd4 be535dc` + junction de `node_modules` (`mklink /J`). Linha de base `git status --porcelain` da árvore real = `?? .specs/features/visual-upgrade/checks.md` (o `verification.md` passou a ser rastreado em be535dc). Falha (f) aplicada só no worktree; `npx vitest run tests/unit/audioMap.test.ts -t "tremolo depth"` a partir dele. Ao final `cmd //c rmdir` da junction (`node_modules` real intacto), `git worktree remove --force`; porcelain da árvore real idêntico à linha de base (`diff` vazio) antes de reescrever este arquivo - a única diferença posterior é ` M .specs/features/engine-sound/verification.md`. Worktree `Jogo-visual` e portas 5174/5175 não tocados; sem `git worktree prune`. Linhas (a)-(e) carried from 1832b5d; as 4 primeiras carried from be11029.

| Mutation | Location | Killed |
| --- | --- | --- |
| carried from be11029: `firingFrequency` retorna `rpm / 60` | `src/audio/audioMap.ts:43` | yes - C10 exit 1: `expected 16.666666666666668 to be close to 33.333` |
| carried from be11029: `ENGINE_HARMONIC_FALLOFF` 1.5 -> 1.0 | `src/audio/audioMap.ts:29` | yes - C11 exit 1: `expected 0.5 to be close to 0.35355339059327373` |
| carried from be11029: `subOsc.type` `'sine'` -> `'triangle'` | `src/audio/AudioEngine.ts:75` | yes - C4 1 failed: `+ "OscillatorNode(triangle,16.67Hz,sub)"` |
| carried from be11029: `compressor.ratio.value` 4 -> 3 | `src/audio/AudioEngine.ts:62` | yes - C7 1 failed: `Expected: 4 Received: 3` |
| carried from 1832b5d: (a) remoção de `this.engineGain.gain.setTargetAtTime(...)` em `update()` | `src/audio/AudioEngine.ts:139` | yes - C6 1 failed: `Expected: > 0.1 Received: 0.04800000041723251` em `audio.spec.ts:47` |
| carried from 1832b5d: (b) remoção de `this.lowpass.frequency.setTargetAtTime(...)` | `src/audio/AudioEngine.ts:138` | yes - C8 1 failed: `Expected: > 300 Received: 250` em `audio.spec.ts:109` |
| carried from 1832b5d: (c) remoção de `this.tremoloDepthGain.gain.setTargetAtTime(...)` | `src/audio/AudioEngine.ts:140` | yes - C15 `lowpass cutoff follows rpm` failed `Expected: < 0.05 Received: 0.25` em `audio.spec.ts:114` |
| carried from 1832b5d: (d) `OSC_RAMP_TAU_S` 0.05 -> 0.1 | `src/audio/audioMap.ts:34` | yes - C14 exit 1: `expected 0.1 to be close to 0.05` em `audioMap.test.ts:40` |
| carried from 1832b5d: (e) clamp de `rpmFraction` removido (`return t;`) | `src/audio/audioMap.ts:38` | yes - C1 exit 1: `expected 154.16666666666669 to be close to 250` em `audioMap.test.ts:33` |
| verified at be535dc: (f) clamp inferior de `tremoloDepth` removido (`Math.min(1, Math.max(0, t))` -> `Math.min(1, t)`) | `src/audio/audioMap.ts:54` | yes - C2 `npx vitest run tests/unit/audioMap.test.ts -t "tremolo depth"` 1 failed, exit 1: `expected 0.3333333333333333 to be close to 0.25` em `audioMap.test.ts:50` |

Provas nunca levadas a falhar (limite de 5 por rodada; nenhuma delas tocada pelo fix): C3, C5, C9, C12, C13.

## Gate

Provas em `HEAD` `be535dc`: `npx vitest run tests/unit --reporter=verbose` - 28 passed, 0 failed; `npx playwright test tests/e2e/audio.spec.ts --reporter=line` - 8 passed, 0 failed.

`cd C:/Users/arthu/.claude/skills/tlc-spec-lean/scripts && python validate_verification.py engine-sound --root C:/Users/arthu/source/repos/Jogo`

```
validate_verification: 0 error(s), 0 warning(s) across [engine-sound]
GATE_EXIT=0
```

## Walk with user

carried from 1832b5d: usuário testou o som e aprovou a revisão 2 de ouvido ("o som melhorou").
