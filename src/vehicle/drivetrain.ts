/**
 * Trem de força puro: dado o input e a velocidade atual (km/h, negativa em
 * ré), decide força de motor, freio por eixo, ângulo de direção e fator de
 * aderência traseira. `Car` aplica esses números no controlador de veículo do
 * Rapier. Aqui não existe three nem rapier, então tudo é testável no vitest.
 *
 * Unidades (door 9): velocidade em km/h só nesta camada de decisão; forças em
 * newtons; ângulos em radianos.
 */
export interface DriveInput {
  throttle: boolean;
  brake: boolean;
  /** +1 esquerda, -1 direita, 0 reto */
  steer: number;
  handbrake: boolean;
}

export interface DriveCommand {
  /** força aplicada nas rodas traseiras (N); negativa em ré */
  engineForce: number;
  brakeFront: number;
  brakeRear: number;
  /** ângulo das rodas dianteiras (rad); positivo = esquerda */
  steer: number;
  /** multiplica o frictionSlip das rodas traseiras (1 = normal, 0.4 = freio de mão) */
  rearFrictionFactor: number;
}

export const MAX_SPEED_KMH = 220;
export const MAX_REVERSE_KMH = 30;
export const ENGINE_FORCE = 9000;
export const REVERSE_FORCE = 4000;
export const BRAKE_FORCE = 6000;
export const HANDBRAKE_FORCE = 9000;
export const HANDBRAKE_REAR_FRICTION = 0.4;

export const STEER_MAX_RAD = 0.5;
export const STEER_MIN_RAD = 0.15;
export const STEER_FALLOFF_KMH = 150;

/** Faixas de marcha [min, max) em km/h. A 6ª vai até o limite de velocidade. */
export const GEAR_BANDS: ReadonlyArray<readonly [number, number]> = [
  [0, 30],
  [30, 60],
  [60, 95],
  [95, 130],
  [130, 170],
  [170, MAX_SPEED_KMH],
];

export const RPM_MIN = 1000;
export const RPM_MAX = 7000;

/** -1 = ré, 1..6 = marchas. Velocidade 0 é 1ª. */
export function gearFor(speedKmh: number): number {
  if (speedKmh < 0) return -1;
  for (let i = GEAR_BANDS.length - 1; i >= 0; i--) {
    if (speedKmh >= GEAR_BANDS[i]![0]) return i + 1;
  }
  return 1;
}

/** RPM = 1000 + fração dentro da faixa × 6000, limitado a [1000, 7000]. */
export function rpmFor(speedKmh: number): number {
  const abs = Math.abs(speedKmh);
  const gear = speedKmh < 0 ? 1 : gearFor(speedKmh);
  const band = GEAR_BANDS[gear - 1]!;
  const fraction = (abs - band[0]) / (band[1] - band[0]);
  const rpm = RPM_MIN + fraction * (RPM_MAX - RPM_MIN);
  return Math.min(RPM_MAX, Math.max(RPM_MIN, rpm));
}

/** 0.5 rad parado, decaindo linearmente até 0.15 rad a 150 km/h ou mais. */
export function steeringAngleFor(speedKmh: number): number {
  const t = Math.min(1, Math.max(0, Math.abs(speedKmh) / STEER_FALLOFF_KMH));
  return STEER_MAX_RAD + (STEER_MIN_RAD - STEER_MAX_RAD) * t;
}

export function computeDrive(input: DriveInput, speedKmh: number): DriveCommand {
  let engineForce = 0;
  let brakeFront = 0;
  let brakeRear = 0;

  if (input.throttle && speedKmh < MAX_SPEED_KMH) {
    engineForce = ENGINE_FORCE;
  }

  if (input.brake) {
    if (speedKmh > 1) {
      // andando pra frente: S é freio
      engineForce = 0;
      brakeFront = BRAKE_FORCE;
      brakeRear = BRAKE_FORCE;
    } else if (speedKmh > -MAX_REVERSE_KMH) {
      // parado ou em ré: S é ré, cortada acima de 30 km/h
      engineForce = -REVERSE_FORCE;
    }
  }

  let rearFrictionFactor = 1;
  if (input.handbrake) {
    brakeRear = HANDBRAKE_FORCE;
    rearFrictionFactor = HANDBRAKE_REAR_FRICTION;
  }

  const steer = Math.sign(input.steer) * steeringAngleFor(speedKmh);

  return { engineForce, brakeFront, brakeRear, steer, rearFrictionFactor };
}
