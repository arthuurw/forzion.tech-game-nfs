import {
  AMBIENT_GAIN,
  RAMP_TAU_S,
  TREMOLO_RATE_HZ,
  engineCutoff,
  engineFrequency,
  engineGainFor,
  tremoloDepth,
} from './audioMap';

export type AudioState = 'idle' | 'running';

/**
 * Som sintetizado com Web Audio (door 8 da free-roam-city): nenhum arquivo.
 *
 * Motor: três osciladores (saw + square desafinado + sub uma oitava abaixo)
 * → lowpass cujo cutoff abre com o RPM → ganho de tremolo (marcha lenta
 * irregular) → ganho do motor (segue o acelerador) → master.
 * Ambiente: ruído branco → bandpass (chuva) → ganho → master.
 * Master: ganho (mute) → compressor → saída.
 *
 * Cada `connect` passa por `link()`, que registra a aresta; `graph()` devolve
 * essa lista, então os testes veem a topologia real e não a ordem de campos.
 */
export class AudioEngine {
  state: AudioState = 'idle';
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private engineGain: GainNode | null = null;
  private tremoloGain: GainNode | null = null;
  private tremoloDepthGain: GainNode | null = null;
  private lowpass: BiquadFilterNode | null = null;
  private ambientGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private muted = false;
  private throttle = false;
  private engineTarget = engineGainFor(false);
  private cutoffTarget = engineCutoff(1000);
  private readonly labels = new Map<AudioNode | AudioParam, string>();
  private readonly sources: string[] = [];
  private readonly edges: string[] = [];

  start(): void {
    if (this.state === 'running') return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.labels.set(ctx.destination, 'AudioDestinationNode');

    // master: ganho (mute) -> compressor -> saída
    this.master = this.label(ctx.createGain(), 'GainNode(master)');
    this.master.gain.value = this.muted ? 0 : 1;
    this.compressor = this.label(ctx.createDynamicsCompressor(), 'DynamicsCompressorNode');
    this.compressor.threshold.value = -18;
    this.compressor.ratio.value = 4;
    this.compressor.knee.value = 12;
    this.link(this.master, this.compressor);
    this.link(this.compressor, ctx.destination);

    // motor
    const f0 = engineFrequency(1000);
    const saw = this.label(ctx.createOscillator(), 'OscillatorNode(sawtooth)');
    saw.type = 'sawtooth';
    saw.frequency.value = f0;
    const square = this.label(ctx.createOscillator(), 'OscillatorNode(square,detune=8)');
    square.type = 'square';
    square.frequency.value = f0;
    square.detune.value = 8;
    const sub = this.label(ctx.createOscillator(), 'OscillatorNode(sine,sub)');
    sub.type = 'sine';
    sub.frequency.value = f0 / 2;
    this.oscillators = [saw, square, sub];
    this.sources.push(...this.oscillators.map((o) => this.labels.get(o)!));

    this.lowpass = this.label(ctx.createBiquadFilter(), 'BiquadFilterNode(lowpass)');
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = this.cutoffTarget;
    this.lowpass.Q.value = 1.5;

    this.tremoloGain = this.label(ctx.createGain(), 'GainNode(tremolo)');
    this.tremoloGain.gain.value = 1;
    this.engineGain = this.label(ctx.createGain(), 'GainNode(engine)');
    this.engineGain.gain.value = this.engineTarget;

    for (const osc of this.oscillators) this.link(osc, this.lowpass);
    this.link(this.lowpass, this.tremoloGain);
    this.link(this.tremoloGain, this.engineGain);
    this.link(this.engineGain, this.master);

    // tremolo: LFO -> ganho de profundidade -> soma no gain do tremolo (1 ± depth)
    const lfo = this.label(ctx.createOscillator(), 'OscillatorNode(lfo)');
    lfo.type = 'sine';
    lfo.frequency.value = TREMOLO_RATE_HZ;
    this.tremoloDepthGain = this.label(ctx.createGain(), 'GainNode(tremoloDepth)');
    this.tremoloDepthGain.gain.value = tremoloDepth(1000);
    this.labels.set(this.tremoloGain.gain, 'AudioParam(tremolo.gain)');
    this.link(lfo, this.tremoloDepthGain);
    this.link(this.tremoloDepthGain, this.tremoloGain.gain);

    // ambiente: ruído -> bandpass (chuva) -> ganho -> master
    const noise = this.label(ctx.createBufferSource(), 'AudioBufferSourceNode(loop)');
    noise.buffer = makeNoiseBuffer(ctx);
    noise.loop = true;
    this.sources.push(this.labels.get(noise)!);
    const bandpass = this.label(ctx.createBiquadFilter(), 'BiquadFilterNode(bandpass)');
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 600;
    bandpass.Q.value = 0.7;
    this.ambientGain = this.label(ctx.createGain(), 'GainNode(ambient)');
    this.ambientGain.gain.value = AMBIENT_GAIN;
    this.link(noise, bandpass);
    this.link(bandpass, this.ambientGain);
    this.link(this.ambientGain, this.master);

    for (const osc of this.oscillators) osc.start();
    lfo.start();
    noise.start();

    void ctx.resume();
    this.state = 'running';
  }

  /** Chamado a cada frame com o RPM atual e se o acelerador está pressionado. */
  update(rpm: number, throttle: boolean): void {
    this.throttle = throttle;
    this.engineTarget = engineGainFor(throttle);
    this.cutoffTarget = engineCutoff(rpm);
    if (!this.ctx || !this.lowpass || !this.engineGain || !this.tremoloDepthGain) return;
    const now = this.ctx.currentTime;
    const f = engineFrequency(rpm);
    this.oscillators[0]?.frequency.setTargetAtTime(f, now, 0.05);
    this.oscillators[1]?.frequency.setTargetAtTime(f, now, 0.05);
    this.oscillators[2]?.frequency.setTargetAtTime(f / 2, now, 0.05);
    this.lowpass.frequency.setTargetAtTime(this.cutoffTarget, now, RAMP_TAU_S);
    this.engineGain.gain.setTargetAtTime(this.engineTarget, now, RAMP_TAU_S);
    this.tremoloDepthGain.gain.setTargetAtTime(tremoloDepth(rpm), now, RAMP_TAU_S);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
  }

  gains(): { master: number; engine: number; engineTarget: number; ambient: number } {
    return {
      master: this.master?.gain.value ?? (this.muted ? 0 : 1),
      engine: this.engineGain?.gain.value ?? 0,
      engineTarget: this.engineTarget,
      ambient: this.ambientGain?.gain.value ?? 0,
    };
  }

  compressorParams(): { threshold: number; ratio: number; knee: number } | null {
    if (!this.compressor) return null;
    return {
      threshold: this.compressor.threshold.value,
      ratio: this.compressor.ratio.value,
      knee: this.compressor.knee.value,
    };
  }

  currentCutoffTarget(): number {
    return this.cutoffTarget;
  }

  isThrottling(): boolean {
    return this.throttle;
  }

  contextState(): string {
    return this.ctx?.state ?? 'none';
  }

  /** Topologia real: fontes e arestas na ordem em que `connect` foi chamado. */
  graph(): { sources: string[]; edges: string[] } {
    return { sources: [...this.sources], edges: [...this.edges] };
  }

  private label<T extends AudioNode>(node: T, name: string): T {
    this.labels.set(node, name);
    return node;
  }

  private link(from: AudioNode, to: AudioNode | AudioParam): void {
    if (to instanceof AudioNode) from.connect(to);
    else from.connect(to);
    this.edges.push(`${this.labels.get(from) ?? from.constructor.name} -> ${this.labels.get(to) ?? to.constructor.name}`);
  }
}

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 2;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
