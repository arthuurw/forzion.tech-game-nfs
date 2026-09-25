# Engine sound - checks

Profile: standard
Plan: none - escape checks-only (2 arquivos de fonte, nenhuma porta de mão única)

## Intent

O som do motor é um sawtooth cru a ganho 0.5 com filtro fixo em 900 Hz: alto, constante e
irritante, e o ambiente a 0.3 soa como chiado. Quando isto for entregue, o motor fica mais
baixo (ganho máximo 0.15, marcha lenta a 40 % disso), com corpo (três osciladores: saw, square
desafinado, sub uma oitava abaixo), o filtro abre com o RPM, a marcha lenta tem tremolo suave,
o master passa por um compressor, e o ambiente vira chuva filtrada a 0.12.

Supersede da feature `free-roam-city`: C37 (ganhos 0.3/0.5 → 0.12/0.06-0.15) e C46 (grafo com
um oscilador → três + tremolo + compressor). O mapeamento de frequência de C36 (60..200 Hz)
permanece e é reutilizado. Os testes desses checks passam a afirmar os valores daqui.

9 checks in 1 slice · 0 one-way doors · 0 open

Comandos de prova: unitário `npx vitest run <arquivo> -t "<nome>"`; integração
`npx playwright test <arquivo> -g "<nome>"` (lendo `window.__game.audio`).

## Checks

### S1 - Motor menos alto e mais vivo · 4 files · 22 KB · ~6k

**C1** - `engineCutoff(rpm)` mapeia RPM 1000..7000 linearmente para 250..1400 Hz: 1000→250, 4000→825, 7000→1400
Proof: `npx vitest run tests/unit/audioMap.test.ts -t "lowpass cutoff follows rpm"`

**C2** - `tremoloDepth(rpm)` é 0.25 a 1000 RPM, 0.125 a 1750, 0 a 2500 e 0 a 5000 (linear até 2500, zero acima)
Proof: `npx vitest run tests/unit/audioMap.test.ts -t "tremolo depth fades out by 2500 rpm"`

**C3** - `engineGainFor(false)` é 0.06 e `engineGainFor(true)` é 0.15 (`ENGINE_GAIN_MAX` 0.15 × `IDLE_FACTOR` 0.4); `AMBIENT_GAIN` é 0.12
Proof: `npx vitest run tests/unit/audioMap.test.ts -t "engine gain by throttle and ambient gain"`

**C4** - Grafo observado por conexões registradas: motor = três `OscillatorNode` (`sawtooth`, `square` com `detune` 8 cents, `sine` a metade da frequência) → `BiquadFilterNode(lowpass)` → `GainNode` (tremolo) → `GainNode` (motor) → master; ambiente = `AudioBufferSourceNode(loop)` → `BiquadFilterNode(bandpass)` → `GainNode` → master; master = `GainNode` → `DynamicsCompressorNode` → `AudioDestinationNode`; a lista vem de um registro de cada `connect` (`from → to`), não da ordem de campos
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "synthesized audio graph"`

**C5** - Com o áudio ativo e sem acelerador, `__game.audio.gains` reporta `ambient` 0.12, `engineTarget` 0.06 e `master` 1; após 1 s de simulação `engine` (valor real do `AudioParam`) está a menos de 0.01 de 0.06
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "gains are 0.12 ambient and 0.06 idle engine"`

**C6** - Segurar `W` leva `engineTarget` a 0.15; soltar `W` leva de volta a 0.06 (rampa `setTargetAtTime` com constante 0.15 s)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "throttle raises engine gain"`

**C7** - O compressor do master tem `threshold` -18 dB, `ratio` 4 e `knee` 12
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "master compressor"`

**C8** - Após 2 s segurando `W`, `__game.audio.cutoffTarget` está a menos de 60 Hz de `engineCutoff(__game.car.rpm)` lido no mesmo `evaluate` (tolerância: o RPM pode avançar ~400 entre o frame que escreveu o alvo e a leitura), e é maior que 300 Hz
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "lowpass cutoff follows rpm"`

**C9** - `M` continua alternando o ganho master entre 0 e 1 com o grafo novo (regressão de C38)
Proof: `npx playwright test tests/e2e/audio.spec.ts -g "M toggles master gain"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| engine chain nodes (6) | saw C4 · square C4 · sub C4 · lowpass C4 · tremolo gain C4 · engine gain C4 | - |
| ambient chain nodes (3) | source C4 · bandpass C4 · ambient gain C4 | - |
| master chain nodes (3) | master gain C4 · compressor C4, C7 · destination C4 | - |
| engine gain states (2) | idle C3, C5 · throttle C3, C6 | - |
| tremolo samples (4) | 1000 C2 · 1750 C2 · 2500 C2 · 5000 C2 | - |
| cutoff samples (3) | 1000 C1 · 4000 C1 · 7000 C1 | - |
| compressor params (3) | threshold C7 · ratio C7 · knee C7 | - |
| mute transitions (2) | 1→0 C9 · 0→1 C9 | - |
| superseded checks (2) | free-roam-city ex-37 → C5 · free-roam-city ex-46 → C4 | - |

- Claims cruzando a fronteira browser (Playwright): C4-C9
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

- `src/audio/audioMap.ts`: 3 mapeamentos lineares com clamp + 1 ramo (throttle) → decides, not reached across a boundary; C1-C3
- `src/audio/AudioEngine.ts`: monta o grafo e encaminha valores para `AudioParam` sem decidir → instrumentation; coberto por C4-C9
- `src/core/Game.ts`: expõe `audio.graph`, `gains`, `cutoffTarget` no debug handle → instrumentation; coberto por C4-C8

Cost: 3 provas unitárias em 1 arquivo e 6 Playwright em 1 arquivo.

## Swept

- validation: C1, C2 - clamps dos mapeamentos nos extremos de RPM
- failure modes: n/a - `AudioContext` indisponível já é tratado pelo estado `idle` existente (free-roam-city ex-35); nada novo falha
- idempotency: C6 - segurar/soltar `W` repetidas vezes converge sempre para 0.15/0.06 (`setTargetAtTime` é idempotente no alvo)
- authorization: n/a - jogo local
- concurrency: n/a - todo o áudio roda na thread de áudio via `AudioParam`; o jogo só escreve alvos
- data lifecycle: n/a - nada persistido
- dependency failure: n/a - Web Audio nativo, sem rede
- state transitions: C6, C9 - idle↔throttle, mute↔unmute
- observability: C4, C5, C8 - grafo, ganhos e cutoff expostos em `__game.audio` (DEV)

## Handoff

- S1 = 6k (`AudioEngine.ts` 5 KB, `audioMap.ts` 1 KB, `Game.ts` 8 KB, `audio.spec.ts` 3 KB, `audioMap.test.ts` 1 KB), abaixo do budget de 150k - one builder
