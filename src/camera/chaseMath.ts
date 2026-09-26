/**
 * Matemática pura da câmera de perseguição. Heading 0 = carro apontando +Z
 * (door 9); a câmera fica 6 m atrás e 2.5 m acima, olhando 1 m acima do carro.
 * O visual-upgrade adiciona FOV por velocidade, blur radial, shake de colisão
 * e atraso lateral na curva.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const CHASE_DISTANCE = 6;
export const CHASE_HEIGHT = 2.5;
export const CHASE_LOOK_HEIGHT = 1;
export const CHASE_SMOOTHING = 5; // por segundo

export const FOV_MIN = 62;
export const FOV_MAX = 78;
export const FOV_SPEED_KMH = 220;

export const BLUR_START_KMH = 120;
export const BLUR_RANGE_KMH = 100;
export const BLUR_MAX = 0.6;

export const SHAKE_MAX_M = 0.4;
export const SHAKE_IMPULSE_SCALE = 20000;
export const SHAKE_TAU_S = 0.15;

export const LATERAL_GAIN = 0.8;
export const LATERAL_MAX_M = 1.2;

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

export function chaseTarget(carPos: Vec3, heading: number): { position: Vec3; lookAt: Vec3 } {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  return {
    position: {
      x: carPos.x - fx * CHASE_DISTANCE,
      y: carPos.y + CHASE_HEIGHT,
      z: carPos.z - fz * CHASE_DISTANCE,
    },
    lookAt: { x: carPos.x, y: carPos.y + CHASE_LOOK_HEIGHT, z: carPos.z },
  };
}

/** Fração do caminho até o alvo percorrida neste frame: 1 - e^(-5·dt). */
export function smoothingFactor(dt: number): number {
  return 1 - Math.exp(-CHASE_SMOOTHING * dt);
}

/** 62° parado abrindo linearmente até 78° a 220 km/h. */
export function fovFor(kmh: number): number {
  return FOV_MIN + (FOV_MAX - FOV_MIN) * clamp01(Math.abs(kmh) / FOV_SPEED_KMH);
}

/** Blur radial: 0 até 120 km/h, 0.6 a partir de 220. */
export function blurFor(kmh: number): number {
  return BLUR_MAX * clamp01((Math.abs(kmh) - BLUR_START_KMH) / BLUR_RANGE_KMH);
}

/** Amplitude do shake (m) a partir do impulso da colisão (N·s). */
export function shakeAmplitude(impulse: number): number {
  return Math.min(SHAKE_MAX_M, Math.max(0, impulse) / SHAKE_IMPULSE_SCALE);
}

/** Amplitude restante t segundos após o impacto. */
export function shakeAt(t: number, amplitude: number): number {
  return amplitude * Math.exp(-t / SHAKE_TAU_S);
}

/** Deslocamento lateral (m) da câmera pela velocidade angular em Y; positivo = esquerda do carro. */
export function lateralOffset(angularVelocityY: number): number {
  return Math.min(LATERAL_MAX_M, Math.max(-LATERAL_MAX_M, angularVelocityY * LATERAL_GAIN));
}
