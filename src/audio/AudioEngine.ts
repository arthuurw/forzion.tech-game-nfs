import {
  AMBIENT_CUTOFF_HZ,
  AMBIENT_GAIN,
  OSC_RAMP_TAU_S,
  RAMP_TAU_S,
  TREMOLO_RATE_HZ,
  brownNoise,
  engineCutoff,
  engineGainFor,
  engineHarmonics,
  firingFrequency,
  tremoloDepth,
} from './audioMap';

export type AudioState = 'idle' | 'running';

/**
 * Som sintetizado com Web Audio (door 8 da free-roam-city): nenhum arquivo.
 *
 * Motor: onda periódica de "explosões" (24 harmônicos decaindo) na frequência
 * de disparo de um 4 cilindros + sub senoidal uma oitava abaixo → lowpass
 * cujo cutoff abre com o RPM → ganho de tremolo (marcha lenta irregular) →
 * ganho do motor (segue o acelerador) → master.
 * Ambiente: ruído marrom → lowpass 180 Hz → ganho baixo → master (rumor).
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
  private engineOsc: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private muted = false;
  private throttle = false;
  private engineTarget = engineGainFor(false);
  private cutoffTarget = engineCutoff(1000);
  /** papel de cada nó (master, engine...); o tipo e os parâmetros são lidos do nó real em graph() */
  private readonly roles = new Map<AudioNode | AudioParam, string>();
  private readonly sourceNodes: AudioNode[] = [];
  private readonly edgeNodes: Array<[AudioNode, AudioNode | AudioParam]> = [];

  start(): void {
    if (this.state === 'running') return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.roles.set(ctx.destination, 'out');

    // master: ganho (mute) -> compressor -> saída
    this.master = this.label(ctx.createGain(), 'master');
    this.master.gain.value = this.muted ? 0 : 1;
    this.compressor = this.label(ctx.createDynamicsCompressor(), 'master');
    this.compressor.threshold.value = -18;
    this.compressor.ratio.value = 4;
    this.compressor.knee.value = 12;
    this.link(this.master, this.compressor);
    this.link(this.compressor, ctx.destination);

    // motor: onda de explosões + sub
    const f0 = firingFrequency(1000);
    const { real, imag } = engineHarmonics();
    const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    this.engineOsc = this.label(ctx.createOscillator(), 'engine');
    this.engineOsc.setPeriodicWave(wave);
    this.engineOsc.frequency.value = f0;
    this.subOsc = this.label(ctx.createOscillator(), 'sub');
    this.subOsc.type = 'sine';
    this.subOsc.frequency.value = f0 / 2;
    this.sourceNodes.push(this.engineOsc, this.subOsc);

    this.lowpass = this.label(ctx.createBiquadFilter(), 'engine');
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = this.cutoffTarget;
    this.lowpass.Q.value = 1.2;

    this.tremoloGain = this.label(ctx.createGain(), 'tremolo');
    this.tremoloGain.gain.value = 1;
    this.engineGain = this.label(ctx.createGain(), 'engine');
    this.engineGain.gain.value = this.engineTarget;

    this.link(this.engineOsc, this.lowpass);
    this.link(this.subOsc, this.lowpass);
    this.link(this.lowpass, this.tremoloGain);
    this.link(this.tremoloGain, this.engineGain);
    this.link(this.engineGain, this.master);

    // tremolo: LFO -> ganho de profundidade -> soma no gain do tremolo (1 ± depth)
    const lfo = this.label(ctx.createOscillator(), 'lfo');
    lfo.type = 'sine';
    lfo.frequency.value = TREMOLO_RATE_HZ;
    this.tremoloDepthGain = this.label(ctx.createGain(), 'tremoloDepth');
    this.tremoloDepthGain.gain.value = tremoloDepth(1000);
    this.roles.set(this.tremoloGain.gain, 'tremolo.gain');
    this.link(lfo, this.tremoloDepthGain);
    this.link(this.tremoloDepthGain, this.tremoloGain.gain);

    // ambiente: ruído marrom -> lowpass -> ganho -> master
    const noise = this.label(ctx.createBufferSource(), 'ambient');
    noise.buffer = makeBrownBuffer(ctx);
    noise.loop = true;
    this.sourceNodes.push(noise);
    const ambientFilter = this.label(ctx.createBiquadFilter(), 'ambient');
    ambientFilter.type = 'lowpass';
    ambientFilter.frequency.value = AMBIENT_CUTOFF_HZ;
    this.ambientGain = this.label(ctx.createGain(), 'ambient');
    this.ambientGain.gain.value = AMBIENT_GAIN;
    this.link(noise, ambientFilter);
    this.link(ambientFilter, this.ambientGain);
    this.link(this.ambientGain, this.master);

    this.engineOsc.start();
    this.subOsc.start();
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
    const f = firingFrequency(rpm);
    this.engineOsc?.frequency.setTargetAtTime(f, now, OSC_RAMP_TAU_S);
    this.subOsc?.frequency.setTargetAtTime(f / 2, now, OSC_RAMP_TAU_S);
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

  /** Valores reais (lidos dos AudioParams agora) de tudo que `update()` escreve por frame. */
  params(): { engineGain: number; lowpassHz: number; engineHz: number; subHz: number; tremoloDepth: number } | null {
    if (!this.engineGain || !this.lowpass || !this.engineOsc || !this.subOsc || !this.tremoloDepthGain) return null;
    return {
      engineGain: this.engineGain.gain.value,
      lowpassHz: this.lowpass.frequency.value,
      engineHz: this.engineOsc.frequency.value,
      subHz: this.subOsc.frequency.value,
      tremoloDepth: this.tremoloDepthGain.gain.value,
    };
  }

  /** Frequência-alvo atual do oscilador principal (Hz). */
  currentFiringHz(): number {
    return this.engineOsc?.frequency.value ?? 0;
  }

  isThrottling(): boolean {
    return this.throttle;
  }

  contextState(): string {
    return this.ctx?.state ?? 'none';
  }

  /**
   * Topologia real: fontes e arestas na ordem em que `connect` foi chamado.
   * Cada nó é descrito pelas suas propriedades reais no momento da leitura
   * (`type`, `frequency`, `loop`, `gain`...), mais o papel que recebeu.
   */
  graph(): { sources: string[]; edges: string[] } {
    return {
      sources: this.sourceNodes.map((n) => this.describe(n)),
      edges: this.edgeNodes.map(([from, to]) => `${this.describe(from)} -> ${this.describe(to)}`),
    };
  }

  private describe(n: AudioNode | AudioParam): string {
    const role = this.roles.get(n) ?? '?';
    if (n instanceof OscillatorNode) {
      return `OscillatorNode(${n.type},${n.frequency.value.toFixed(2)}Hz,${role})`;
    }
    if (n instanceof BiquadFilterNode) {
      return `BiquadFilterNode(${n.type},${n.frequency.value.toFixed(0)}Hz,${role})`;
    }
    if (n instanceof AudioBufferSourceNode) {
      return `AudioBufferSourceNode(loop=${n.loop},${role})`;
    }
    if (n instanceof GainNode) {
      return `GainNode(${n.gain.value.toFixed(3)},${role})`;
    }
    if (n instanceof DynamicsCompressorNode) {
      return `DynamicsCompressorNode(${n.threshold.value}dB,${n.ratio.value}:1,${role})`;
    }
    if (n instanceof AudioDestinationNode) return 'AudioDestinationNode';
    if (n instanceof AudioParam) return `AudioParam(${role})`;
    return `${(n as object).constructor.name}(${role})`;
  }

  private label<T extends AudioNode>(node: T, role: string): T {
    this.roles.set(node, role);
    return node;
  }

  private link(from: AudioNode, to: AudioNode | AudioParam): void {
    if (to instanceof AudioNode) from.connect(to);
    else from.connect(to);
    this.edgeNodes.push([from, to]);
  }
}

function makeBrownBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 4;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  buffer.getChannelData(0).set(brownNoise(ctx.sampleRate * seconds));
  return buffer;
}
