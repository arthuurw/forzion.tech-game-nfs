import { DEFAULT_CAR, type CarSpec } from './carSpec';

/**
 * Trem de força puro e com estado (door 2 da car-handling). A cada passo fixo,
 * `stepDrivetrain` recebe a ficha, o estado anterior, o input e a velocidade
 * das rodas, e devolve o novo estado (marcha engatada, giro, troca em curso,
 * volante) e o comando que `Car` aplica no controlador do Rapier. Aqui não
 * existe three nem rapier, então tudo é testável no vitest.
 *
 * Unidades (AD-007): velocidade em m/s (km/h só nas regras de ré), forças em
 * newtons, ângulos em radianos.
 */
export interface DriveInput {
  throttle: boolean;
  brake: boolean;
  /** +1 esquerda, -1 direita, 0 reto */
  steer: number;
  handbrake: boolean;
}

export interface DriveCommand {
  /** força motriz total nas rodas traseiras (N); negativa em ré */
  engineForce: number;
  /** força de freio total no eixo dianteiro (N) */
  brakeFront: number;
  /** força de freio total no eixo traseiro (N) */
  brakeRear: number;
  /** ângulo das rodas dianteiras (rad); positivo = esquerda */
  steer: number;
  /** multiplica a aderência das rodas traseiras (1 = normal, handbrakeRearGrip = freio de mão) */
  rearFrictionFactor: number;
}

export interface DrivetrainState {
  /** -1 = ré, 1..6 = marchas */
  gear: number;
  rpm: number;
  /** tempo restante sem força motriz depois de uma troca para cima (s) */
  shiftTimer: number;
  /** tempo desde a última troca (s) */
  lastShiftAgo: number;
  /** ângulo atual das rodas dianteiras (rad) */
  steer: number;
}

export const RPM_MIN = DEFAULT_CAR.idleRpm;
export const RPM_MAX = DEFAULT_CAR.redlineRpm;

export const MAX_REVERSE_KMH = 30;
/** a força é cortada meio km/h antes do limite: um passo de física pode ultrapassar ~0.4 km/h */
export const REVERSE_CUTOFF_KMH = MAX_REVERSE_KMH - 0.5;
/** nenhuma troca a menos disso da anterior (AC 17) */
export const SHIFT_HOLD_S = 0.6;
/** piso de giro com a embreagem patinando na saída, em 1ª e ré (AC 15) */
export const CLUTCH_RPM = 2500;
/** torque de freio-motor no corte; cai linearmente até 0 na marcha lenta */
export const ENGINE_BRAKE_NM = 35;
export const HANDBRAKE_FORCE_N = 6000;
export const GRAVITY = 9.81;
export const AIR_DENSITY = 1.2;

const RPM_PER_RAD_S = 60 / (2 * Math.PI);
const EPS = 1e-9;

export function initialDrivetrain(spec: CarSpec): DrivetrainState {
  return { gear: 1, rpm: spec.idleRpm, shiftTimer: 0, lastShiftAgo: SHIFT_HOLD_S, steer: 0 };
}

/** Torque (N·m) interpolado linearmente na curva; fora dela, o ponto da ponta. */
export function torqueAt(spec: CarSpec, rpm: number): number {
  const curve = spec.torqueCurve;
  if (rpm <= curve[0]![0]) return curve[0]![1];
  for (let i = 1; i < curve.length; i++) {
    const [r1, t1] = curve[i]!;
    if (rpm <= r1) {
      const [r0, t0] = curve[i - 1]!;
      return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
    }
  }
  return curve[curve.length - 1]![1];
}

/** Alvo do volante: `min(steerMaxRad, atan(steerLateralG × g × wheelbase / v²))`; `steerMaxRad` abaixo de 1 m/s. */
export function steerTarget(spec: CarSpec, speedMs: number): number {
  const v = Math.abs(speedMs);
  if (v < 1) return spec.steerMaxRad;
  return Math.min(spec.steerMaxRad, Math.atan((spec.steerLateralG * GRAVITY * spec.wheelbaseM) / (v * v)));
}

/** Arrasto aerodinâmico (N), sempre ≥ 0: `0.5 × ρ × cdA × v²`. */
export function airDragN(spec: CarSpec, speedMs: number): number {
  return 0.5 * AIR_DENSITY * spec.cdA * speedMs * speedMs;
}

/** Resistência de rolagem (N) contra o movimento; some suavemente abaixo de 1 m/s. */
export function rollingResistanceN(spec: CarSpec, forwardSpeedMs: number): number {
  const s = Math.max(-1, Math.min(1, forwardSpeedMs));
  return spec.rollingResistance * spec.massKg * GRAVITY * s;
}

function ratioOf(spec: CarSpec, gear: number): number {
  return gear === -1 ? spec.reverseRatio : spec.gearRatios[gear - 1]!;
}

/** Giro que a roda impõe ao motor na marcha, sem piso nem teto. */
function wheelRpm(spec: CarSpec, gear: number, speedMs: number): number {
  return (Math.abs(speedMs) / spec.wheelRadiusM) * RPM_PER_RAD_S * ratioOf(spec, gear) * spec.finalDrive;
}

function rampSteer(spec: CarSpec, current: number, target: number, dt: number): number {
  const delta = target - current;
  if (delta === 0) return current;
  // afastando do centro no mesmo lado: rampa de ida; voltando (ou trocando de lado): rampa de volta
  const outward = current === 0 || Math.sign(delta) === Math.sign(current);
  const maxStep = (outward ? spec.steerRateRadS : spec.steerReturnRadS) * dt;
  return current + Math.max(-maxStep, Math.min(maxStep, delta));
}

export function stepDrivetrain(
  spec: CarSpec,
  s: DrivetrainState,
  input: DriveInput,
  wheelSpeedMs: number,
  dt: number,
): { state: DrivetrainState; cmd: DriveCommand } {
  const kmh = wheelSpeedMs * 3.6;
  const steer = rampSteer(spec, s.steer, Math.sign(input.steer) * steerTarget(spec, wheelSpeedMs), dt);

  let gear = s.gear;
  let shiftTimer = Math.max(0, s.shiftTimer - dt);
  let lastShiftAgo = s.lastShiftAgo + dt;
  let cut = s.shiftTimer > EPS;

  // sentido: S parado engata a ré; W parado (ou quase) na ré volta para a 1ª
  if (input.brake && kmh <= 1 && gear !== -1) {
    gear = -1;
    shiftTimer = 0;
    cut = false;
    lastShiftAgo = 0;
  } else if (input.throttle && !input.brake && gear === -1 && kmh >= -1) {
    gear = 1;
    shiftTimer = 0;
    cut = false;
    lastShiftAgo = 0;
  } else if (gear >= 1 && s.lastShiftAgo >= SHIFT_HOLD_S) {
    const rpmNow = Math.max(spec.idleRpm, wheelRpm(spec, gear, wheelSpeedMs));
    if (input.throttle && gear < spec.gearRatios.length && rpmNow >= spec.shiftUpRpm) {
      gear += 1;
      shiftTimer = spec.shiftTimeS;
      cut = true;
      lastShiftAgo = 0;
    } else if (gear > 1 && rpmNow <= spec.shiftDownRpm && wheelRpm(spec, gear - 1, wheelSpeedMs) < spec.shiftUpRpm) {
      gear -= 1;
      lastShiftAgo = 0;
    }
  }

  const driving = gear === -1 ? input.brake : input.throttle;
  const clutchSlip = (gear === 1 || gear === -1) && driving;
  const rawRpm = Math.max(spec.idleRpm, clutchSlip ? CLUTCH_RPM : 0, wheelRpm(spec, gear, wheelSpeedMs));
  const rpm = Math.min(spec.redlineRpm, rawRpm);
  const toWheel = (ratioOf(spec, gear) * spec.finalDrive * spec.drivetrainEfficiency) / spec.wheelRadiusM;

  let engineForce = 0;
  let brakeFront = 0;
  let brakeRear = 0;
  const brakeAll = (): void => {
    brakeFront = spec.brakeForceN * spec.brakeBiasFront;
    brakeRear = spec.brakeForceN - brakeFront;
  };

  if (gear === -1) {
    if (input.brake && kmh <= 1) {
      // ré: S acelera para trás, cortada antes de 30 km/h
      if (kmh > -REVERSE_CUTOFF_KMH && rawRpm < spec.redlineRpm) engineForce = -torqueAt(spec, rpm) * toWheel;
    } else if (input.brake || (input.throttle && kmh < -1)) {
      brakeAll();
    } else {
      // freio-motor na ré: segura o carro contra o sentido em que ele rola
      const t = (rpm - spec.idleRpm) / (spec.redlineRpm - spec.idleRpm);
      engineForce = -Math.sign(wheelSpeedMs) * ENGINE_BRAKE_NM * t * toWheel;
    }
  } else if (input.brake) {
    brakeAll();
  } else if (input.throttle) {
    if (!cut && rawRpm < spec.redlineRpm) engineForce = torqueAt(spec, rpm) * toWheel;
  } else {
    // freio-motor: proporcional ao giro acima da marcha lenta
    const t = (rpm - spec.idleRpm) / (spec.redlineRpm - spec.idleRpm);
    engineForce = -ENGINE_BRAKE_NM * t * toWheel;
  }

  let rearFrictionFactor = 1;
  if (input.handbrake) {
    // freio de mão: traseira travada e com menos aderência; com acelerador o motor segue empurrando
    // (power slide), sem acelerador não há freio-motor
    if (!input.throttle) engineForce = 0;
    brakeRear = Math.max(brakeRear, HANDBRAKE_FORCE_N);
    rearFrictionFactor = spec.handbrakeRearGrip;
  }

  return {
    state: { gear, rpm, shiftTimer, lastShiftAgo, steer },
    cmd: { engineForce, brakeFront, brakeRear, steer, rearFrictionFactor },
  };
}
