import { RPM_MAX, RPM_MIN } from '../vehicle/drivetrain';

/**
 * Mapeamentos puros do som do motor. Nenhum nó de áudio aqui: `AudioEngine`
 * lê estes números e escreve nos `AudioParam`s.
 */
export const ENGINE_FREQ_MIN_HZ = 60;
export const ENGINE_FREQ_MAX_HZ = 200;

export const ENGINE_CUTOFF_MIN_HZ = 250;
export const ENGINE_CUTOFF_MAX_HZ = 1400;

/** ganho máximo do motor (pé embaixo); a marcha lenta usa IDLE_FACTOR disso */
export const ENGINE_GAIN_MAX = 0.15;
export const IDLE_FACTOR = 0.4;
export const AMBIENT_GAIN = 0.12;

/** tremolo de marcha lenta: profundidade 0.25 a 1000 RPM, some a partir de 2500 */
export const TREMOLO_DEPTH_MAX = 0.25;
export const TREMOLO_FADE_RPM = 2500;
export const TREMOLO_RATE_HZ = 6;

/** rampa dos ganhos/cutoff (constante de tempo do setTargetAtTime), em segundos */
export const RAMP_TAU_S = 0.15;

function rpmFraction(rpm: number): number {
  const t = (rpm - RPM_MIN) / (RPM_MAX - RPM_MIN);
  return Math.min(1, Math.max(0, t));
}

/** RPM 1000..7000 -> 60..200 Hz, linear. */
export function engineFrequency(rpm: number): number {
  const t = (rpm - RPM_MIN) / (RPM_MAX - RPM_MIN);
  return ENGINE_FREQ_MIN_HZ + t * (ENGINE_FREQ_MAX_HZ - ENGINE_FREQ_MIN_HZ);
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

/** ganho alvo do motor: 0.06 em marcha lenta, 0.15 com acelerador */
export function engineGainFor(throttle: boolean): number {
  return throttle ? ENGINE_GAIN_MAX : ENGINE_GAIN_MAX * IDLE_FACTOR;
}
