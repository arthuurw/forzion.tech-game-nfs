# Engine sound - checks

Profile: standard
Plan: none - escape checks-only (2 arquivos de fonte, nenhuma porta de mão única)

## Intent

O som do motor era um sawtooth cru a ganho 0.5 com filtro fixo em 900 Hz: alto, constante e
irritante, e o ambiente a 0.3 soava como chiado.

**Revisão 2 (2026-09-25, após o usuário testar a revisão 1: "chiado danado no fundo, continua
ruim").** A revisão 1 trocou o sawtooth por saw + square e o ambiente por ruído branco com
bandpass: ruído branco filtrado continua chiado, e saw/square a 60 Hz soa como baixo de
sintetizador. A revisão 2 muda o modelo: o motor é uma onda periódica de "explosões" (24
harmônicos decaindo como 1/n^1.5) na **frequência de disparo** de um 4 cilindros 4 tempos
(`rpm / 30` Hz: 33 Hz em marcha lenta, 233 Hz a 7000) mais um sub uma oitava abaixo; o
ambiente vira **ruído marrom** (integrado, grave) por lowpass 180 Hz a ganho 0.05 - rumor de
cidade, sem chiado. Ganho máximo do motor 0.12 (marcha lenta 0.048), filtro que abre com o
RPM, tremolo em marcha lenta e compressor no master permanecem.

O Verifier da revisão 1 (interrompido ao ser superado) apontou que o grafo era provado por
rótulos escritos pelo autor, não pelas propriedades reais dos nós; a revisão 2 descreve cada nó
por `type`, `frequency`, `loop`, `gain`, `threshold`/`ratio` lidos do nó no momento da leitura.

Supersede da feature `free-roam-city`: ex-36 (frequência 60..200 Hz → `rpm / 30`), ex-37
(ganhos → 0.05 / 0.048-0.12) e ex-46 (grafo). Os testes desses checks passam a afirmar os
valores daqui. O usuário aprovou a revisão 2 com "siga com todas as frentes".

15 checks in 1 slice · 0 one-way doors · 0 open (rodada 2 da verificação: C14-C15 adicionados; C1, C6, C8 endurecidos para afirmar valores reais)

Comandos de prova: unitário `npx vitest run <arquivo> -t "<nome>"`; integração
`npx playwright test <arquivo> -g "<nome>"` (lendo `window.__game.audio`).

## Checks

### S1 - Motor menos alto e mais vivo · 4 files · 24 KB · ~6k

**C1** - `engineCutoff(rpm)` mapeia RPM 1000..7000 linearmente para 250..1400 Hz: 1000→250, 4000→825, 7000→1400; fora da faixa é limitado: 500→250, 8000→1400
Proof: `npx vitest run tests/unit/audioMap.test.ts -t "lowpass cutoff follows rpm"`

**C2** - `tremoloDepth(rpm)` é 0.25 a 1000 RPM, 0.125 a 1750, 0 a 2500 e 0 a 5000 (linear até 2500, zero acima)
Proof: `npx vitest run tests/unit/audioMap.test.ts -t "tremolo depth fades out by 2500 rpm"`

**C3** - `engineGainFor(false)` é 0.048 e `engineGainFor(true)` é 0.12 (`ENGINE_GAIN_MAX` 0.12 × `IDLE_FACTOR` 0.4); `AMBIENT_GAIN` é 0.05 e `AMBIENT_CUTOFF_HZ` é 180
Proof: `npx vitest run tests/unit/audioMap.test.ts -t "engine gain by throttle and ambient gain"`

**C4** - Grafo descrito pelas propriedades reais dos nós (lidas em `graph()`, não rótulos): fontes = `OscillatorNode(custom, 33.33 Hz)` do motor, `OscillatorNode(sine, 16.67 Hz)` do sub, `AudioBufferSourceNode(loop=true)` do ambiente; arestas na ordem dos `connect`: master `GainNode(1.000)` → `DynamicsCompressorNode(-18 dB, 4:1)` → `AudioDestinationNode`; motor e sub → `BiquadFilterNode(lowpass, 250 Hz)` → `GainNode(1.000, tremolo)` → `GainNode(0.048, engine)` → master; `OscillatorNode(sine, 6 Hz, lfo)` → `GainNode(0.250, tremoloDepth)` → `AudioParam(tremolo.gain)`; ambiente → `BiquadFilterNode(lowpass, 180 Hz)` → `GainNode(0.050)` → master; sem elementos `<audio>`
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "synthesized audio graph"`

**C5** - Com o áudio ativo e sem acelerador, `__game.audio.gains` reporta `ambient` 0.05, `engineTarget` 0.048 e `master` 1; após 1 s de simulação `engine` (valor real do `AudioParam`) está a menos de 0.01 de 0.048
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "gains are 0.05 ambient and 0.048 idle engine"`

**C6** - Segurar `W` por 1 s (sim) leva `engineTarget` a 0.12 e o valor **real** do `AudioParam` de ganho do motor (`__game.audio.params.engineGain`) acima de 0.10; soltar `W` por 1 s leva `engineTarget` a 0.048 e o valor real abaixo de 0.06 (rampa `setTargetAtTime` com constante 0.15 s)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "throttle raises engine gain"`

**C7** - O compressor do master tem `threshold` -18 dB, `ratio` 4 e `knee` 12
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "master compressor"`

**C8** - Após 2 s segurando `W`, `__game.audio.cutoffTarget` está a menos de 60 Hz de `engineCutoff(__game.car.rpm)` lido no mesmo `evaluate` (tolerância: o RPM pode avançar ~400 entre o frame que escreveu o alvo e a leitura), e é maior que 300 Hz; o valor **real** do filtro (`params.lowpassHz`) é maior que 300 Hz e está a menos de 150 Hz do mesmo esperado (o valor real atrasa o alvo pela rampa: τ 0.15 s × taxa do cutoff de até ~770 Hz/s ≈ 115 Hz; sem a escrita por frame o filtro ficaria em 250 Hz, > 500 Hz longe)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "lowpass cutoff follows rpm"`

**C9** - `M` continua alternando o ganho master entre 0 e 1 com o grafo novo (regressão de free-roam-city ex-38)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "M toggles master gain"`

**C10** - `firingFrequency(rpm)` é `rpm / 30`: 1000→33.333, 4000→133.333, 7000→233.333 Hz (4 cilindros, 4 tempos)
Proof: `npx vitest run tests/unit/audioMap.test.ts -t "firing frequency is rpm over 30"`

**C11** - `engineHarmonics()` devolve 25 coeficientes (DC + 24 harmônicos) com `real` todo zero, `imag[0]` = 0 e `imag[n]` = `1 / n^1.5` (n = 1, 2, 24 amostrados)
Proof: `npx vitest run tests/unit/audioMap.test.ts -t "engine wave harmonics fall off"`

**C12** - `brownNoise(8192, rng)` devolve amostras em `[-1, 1]`, com razão `Σ|x[i]−x[i−1]| / Σ|x[i]|` menor que 0.3 (sinal suave, grave) e amplitude média maior que 0.02
Proof: `npx vitest run tests/unit/audioMap.test.ts -t "brown noise is low-frequency dominated"`

**C14** - `RAMP_TAU_S` é 0.15 s e `OSC_RAMP_TAU_S` é 0.05 s (constantes das rampas de ganho/filtro e de frequência)
Proof: `npx vitest run tests/unit/audioMap.test.ts -t "ramp time constants"`

**C15** - Valores reais por frame dos demais parâmetros: em marcha lenta (0.5 s sim) `params.tremoloDepth` a menos de 0.005 de 0.25 e `params.subHz` a menos de 0.5 Hz de `params.engineHz / 2`; após 2 s segurando `W` (RPM > 3000) `params.tremoloDepth` < 0.05 e `params.subHz` a menos de 3 Hz de `params.engineHz / 2`
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "idle tremolo depth is applied"`
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "lowpass cutoff follows rpm"`

**C13** - Após 2 s segurando `W`, a frequência real do oscilador do motor (`__game.audio.firingHz`, lida do `AudioParam`) está a menos de 20 Hz de `__game.car.rpm / 30` lido no mesmo `evaluate` (rampa de 50 ms + até 5 passos de física entre a escrita do alvo e a leitura em headless ≈ 600 RPM = 20 Hz)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "lowpass cutoff follows rpm"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| engine chain nodes (5) | engine osc C4 · sub osc C4 · lowpass C4 · tremolo gain C4 · engine gain C4 | - |
| tremolo modulation nodes (3) | lfo C4 · depth gain C4 · tremolo.gain param C4 | - |
| ambient chain nodes (3) | brown source C4 · lowpass 180 C4 · ambient gain C4 | - |
| master chain nodes (3) | master gain C4 · compressor C4, C7 · destination C4 | - |
| engine gain states (2) | idle C3, C5 · throttle C3, C6 | - |
| tremolo samples (4) | 1000 C2 · 1750 C2 · 2500 C2 · 5000 C2 | - |
| cutoff samples (5) | 500 C1 · 1000 C1 · 4000 C1 · 7000 C1 · 8000 C1 | - |
| per-frame AudioParam writes in update() (5) | engine osc freq C13 · sub osc freq C15 · lowpass freq C8 · engine gain C6 · tremolo depth C15 | - |
| ramp constants (2) | gain/filter 0.15 C14 · oscillator 0.05 C14 | - |
| firing frequency samples (3) | 1000 C10 · 4000 C10 · 7000 C10 | - |
| harmonic samples (4) | dc C11 · n=1 C11 · n=2 C11 · n=24 C11 | - |
| compressor params (3) | threshold C7 · ratio C7 · knee C7 | - |
| mute transitions (2) | 1→0 C9 · 0→1 C9 | - |
| superseded checks (3) | free-roam-city ex-36 → C10 · ex-37 → C5 · ex-46 → C4 | - |

- Claims cruzando a fronteira browser (Playwright): C4-C9, C13, C15
- Nenhum outro check afirma mais do que o caso único que sua prova exercita

## Test policy

Mesmas linhas de `free-roam-city` (o repositório ainda não as tem em diretrizes).

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation, pass-throughs | none of its own | covered by its consumer's proof |

Evidence:

- `src/audio/audioMap.ts`: 4 mapeamentos lineares com clamp, 1 ramo (throttle), 1 gerador de harmônicos, 1 gerador de ruído → decides, not reached across a boundary; C1-C3, C10-C12
- `src/audio/AudioEngine.ts`: monta o grafo e encaminha valores para `AudioParam` sem decidir → instrumentation; coberto por C4-C9, C13
- `src/core/Game.ts`: expõe `audio.graph`, `gains`, `compressor`, `cutoffTarget`, `firingHz` no debug handle → instrumentation; coberto por C4-C8, C13

Cost: 7 provas unitárias em 1 arquivo e 8 Playwright em 1 arquivo.

## Swept

- validation: C1, C2, C12 - clamps dos mapeamentos e limites do ruído
- failure modes: n/a - `AudioContext` indisponível já é tratado pelo estado `idle` existente (free-roam-city ex-35); nada novo falha
- idempotency: C6 - segurar/soltar `W` repetidas vezes converge sempre para 0.12/0.048 (`setTargetAtTime` é idempotente no alvo)
- authorization: n/a - jogo local
- concurrency: n/a - todo o áudio roda na thread de áudio via `AudioParam`; o jogo só escreve alvos
- data lifecycle: n/a - nada persistido
- dependency failure: n/a - Web Audio nativo, sem rede
- state transitions: C6, C9 - idle↔throttle, mute↔unmute
- observability: C4, C5, C8, C13 - grafo, ganhos, cutoff e frequência expostos em `__game.audio` (DEV)

## Handoff

- S1 = 6k (`AudioEngine.ts` 6 KB, `audioMap.ts` 2 KB, `Game.ts` 9 KB, `audio.spec.ts` 4 KB, `audioMap.test.ts` 2 KB), abaixo do budget de 150k - one builder
- **Rodada 2 (após FAIL do Verifier):** as escritas por frame de `update()` em `AudioParam` passaram a ser observadas pelos valores reais (`__game.audio.params`): C6 e C8 endurecidos, C15 novo para sub e tremolo; C1 ganhou amostras fora da faixa; C14 novo fixa as constantes de rampa. Nota de supersede em `free-roam-city/checks.md` corrigida para os valores da revisão 2.
- **Settled mid-build:** revisão 2 aprovada pelo usuário após teste da revisão 1 (chiado + timbre sintético); checks C3/C4/C5 reescritos com os valores novos, C10-C13 adicionados; nenhuma prova enfraquecida - C4 ficou mais forte (propriedades reais em vez de rótulos)
