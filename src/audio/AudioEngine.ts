import { AMBIENT_GAIN, ENGINE_GAIN, engineFrequency } from './audioMap';

export type AudioState = 'idle' | 'running';

/**
 * Som sintetizado com Web Audio (door 8): motor = dente de serra passando por
 * um filtro passa-baixa; ambiente = ruído branco filtrado. Nenhum arquivo.
 * `start()` só pode acontecer depois de um gesto do usuário (política de
 * autoplay dos browsers), por isso o InputManager chama no primeiro keydown.
 */
export class AudioEngine {
  state: AudioState = 'idle';
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private muted = false;

  start(): void {
    if (this.state === 'running') return;
    const ctx = new AudioContext();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);

    // motor
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = engineFrequency(1000);
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 900;
    engineFilter.Q.value = 2;
    this.engineFilter = engineFilter;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = ENGINE_GAIN;
    this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();

    // ambiente: chuva/cidade como ruído filtrado
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx);
    noise.loop = true;
    this.ambientSource = noise;
    const ambientFilter = ctx.createBiquadFilter();
    ambientFilter.type = 'lowpass';
    ambientFilter.frequency.value = 420;
    this.ambientFilter = ambientFilter;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = AMBIENT_GAIN;
    noise.connect(ambientFilter).connect(this.ambientGain).connect(this.master);
    noise.start();

    void ctx.resume();
    this.state = 'running';
  }

  setRpm(rpm: number): void {
    if (!this.engineOsc || !this.ctx) return;
    this.engineOsc.frequency.setTargetAtTime(engineFrequency(rpm), this.ctx.currentTime, 0.05);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
  }

  gains(): { master: number; engine: number; ambient: number } {
    return {
      master: this.master?.gain.value ?? (this.muted ? 0 : 1),
      engine: this.engineGain?.gain.value ?? 0,
      ambient: this.ambientGain?.gain.value ?? 0,
    };
  }

  contextState(): string {
    return this.ctx?.state ?? 'none';
  }

  /** Descrição do grafo para debug/testes: tipo de cada nó na ordem de conexão. */
  graph(): { engine: string[]; ambient: string[]; masterConnected: boolean } {
    const node = (n: AudioNode | null, detail = ''): string =>
      n ? `${n.constructor.name}${detail ? `(${detail})` : ''}` : 'none';
    return {
      engine: [
        node(this.engineOsc, this.engineOsc?.type ?? ''),
        node(this.engineFilter, this.engineFilter?.type ?? ''),
        node(this.engineGain),
      ],
      ambient: [
        node(this.ambientSource, this.ambientSource?.loop ? 'loop' : ''),
        node(this.ambientFilter, this.ambientFilter?.type ?? ''),
        node(this.ambientGain),
      ],
      masterConnected: this.master !== null && this.ctx !== null && this.master.numberOfOutputs > 0,
    };
  }
}

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 2;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
