import { RPM_MAX, RPM_MIN } from '../vehicle/drivetrain';

/**
 * Mapeamentos puros do som do motor. Nenhum nó de áudio aqui: `AudioEngine`
 * lê estes números e escreve nos `AudioParam`s.
 *
 * Modelo: motor 4 cilindros, 4 tempos. A cada volta do virabrequim há 2
 * explosões, então a frequência fundamental do som é rpm / 60 × 2 = rpm / 30.
 */
export const CYLINDERS = 4;

export const ENGINE_CUTOFF_MIN_HZ = 250;
export const ENGINE_CUTOFF_MAX_HZ = 1400;

/** ganho máximo do motor (pé embaixo); a marcha lenta usa IDLE_FACTOR disso */
export const ENGINE_GAIN_MAX = 0.12;
export const IDLE_FACTOR = 0.4;
/** rumor de cidade: ruído marrom por lowpass, bem baixo */
export const AMBIENT_GAIN = 0.05;
export const AMBIENT_CUTOFF_HZ = 180;

/** tremolo de marcha lenta: profundidade 0.25 a 1000 RPM, some a partir de 2500 */
export const TREMOLO_DEPTH_MAX = 0.25;
export const TREMOLO_FADE_RPM = 2500;
export const TREMOLO_RATE_HZ = 6;

/** harmônicos da onda do motor: amplitude 1/n^1.5, 24 harmônicos */
export const ENGINE_HARMONICS = 24;
export const ENGINE_HARMONIC_FALLOFF = 1.5;

/** rampa dos ganhos/cutoff (constante de tempo do setTargetAtTime), em segundos */
export const RAMP_TAU_S = 0.15;

function rpmFraction(rpm: number): number {
  const t = (rpm - RPM_MIN) / (RPM_MAX - RPM_MIN);
  return Math.min(1, Math.max(0, t));
}

/** Frequência de disparo (Hz) de um 4 cilindros 4 tempos: rpm / 30. */
export function firingFrequency(rpm: number): number {
  return (rpm / 60) * (CYLINDERS / 2);
}

/** RPM 1000..7000 -> 250..1400 Hz de cutoff do lowpass, linear. */
export function engineCutoff(rpm: number): number {
  return ENGINE_CUTOFF_MIN_HZ + rpmFraction(rpm) * (ENGINE_CUTOFF_MAX_HZ - ENGINE_CUTOFF_MIN_HZ);
}

/** 0.25 a 1000 RPM caindo linearmente até 0 em 2500 RPM. */
export function tremoloDepth(rpm: number): number {
  const t = (rpm - RPM_MIN) / (TREMOLO_FADE_RPM - RPM_MIN);
  return TREMOLO_DEPTH_MAX * (1 - Math.min(1, Math.max(0, t)));
}

/** ganho alvo do motor: 0.048 em marcha lenta, 0.12 com acelerador */
export function engineGainFor(throttle: boolean): number {
  return throttle ? ENGINE_GAIN_MAX : ENGINE_GAIN_MAX * IDLE_FACTOR;
}

/** Amplitudes dos harmônicos da onda do motor (índice 0 = DC, sempre 0). */
export function engineHarmonics(): { real: Float32Array; imag: Float32Array } {
  const n = ENGINE_HARMONICS + 1;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) imag[k] = 1 / Math.pow(k, ENGINE_HARMONIC_FALLOFF);
  return { real, imag };
}

/**
 * Ruído marrom: integração vazada do ruído branco. Soa como rumor grave, não
 * como chiado. Determinístico por `rng` para ser testável.
 */
export function brownNoise(length: number, rng: () => number = Math.random): Float32Array {
  const out = new Float32Array(length);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = rng() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    out[i] = last * 3.5;
  }
  return out;
}
