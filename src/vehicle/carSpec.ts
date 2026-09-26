/**
 * Ficha técnica do carro (door 1 da car-handling). Pura: sem three nem rapier.
 * `drivetrain` lê motor, câmbio, freios e direção; `Car` lê massa, geometria,
 * arrasto e aderência. A garagem e o tuning (sub-projetos 3 e 4) vão trocar ou
 * alterar esta ficha.
 *
 * Unidades (AD-007): kg, m, s, N, N·m, rad, rpm.
 */
export interface CarSpec {
  massKg: number;
  /** altura do centro de massa acima do chão, com o carro em repouso */
  comHeightM: number;
  wheelbaseM: number;
  trackM: number;
  wheelRadiusM: number;
  /** pares [rpm, N·m] em rpm crescente, cobrindo [idleRpm, redlineRpm] */
  torqueCurve: ReadonlyArray<readonly [rpm: number, nm: number]>;
  idleRpm: number;
  redlineRpm: number;
  /** relações da 1ª à 6ª */
  gearRatios: readonly number[];
  reverseRatio: number;
  finalDrive: number;
  drivetrainEfficiency: number;
  shiftUpRpm: number;
  shiftDownRpm: number;
  shiftTimeS: number;
  /** área frontal × coeficiente de arrasto (m²) */
  cdA: number;
  /** coeficiente de resistência de rolagem (adimensional, × peso) */
  rollingResistance: number;
  /** força total de freio nas 4 rodas (N) */
  brakeForceN: number;
  /** fração da força de freio no eixo dianteiro */
  brakeBiasFront: number;
  /** coeficiente de aderência do pneu (frictionSlip do Rapier) */
  tireGrip: number;
  /** multiplica a aderência traseira (> 1: o carro sai de frente) */
  rearGripFactor: number;
  /** multiplica a aderência traseira com o freio de mão puxado */
  handbrakeRearGrip: number;
  steerMaxRad: number;
  /** aceleração lateral (g) que o alvo do volante pede em alta velocidade */
  steerLateralG: number;
  steerRateRadS: number;
  steerReturnRadS: number;
}

export const DEFAULT_CAR: CarSpec = {
  massKg: 1250,
  comHeightM: 0.45,
  wheelbaseM: 2.6,
  trackM: 1.7,
  wheelRadiusM: 0.45,
  torqueCurve: [
    [1000, 150],
    [2500, 210],
    [4000, 245],
    [5500, 250],
    [6500, 230],
    [7000, 140],
  ],
  idleRpm: 1000,
  redlineRpm: 7000,
  gearRatios: [6.0, 3.4, 2.15, 1.51, 1.13, 0.924],
  reverseRatio: 3.6,
  finalDrive: 5.4,
  drivetrainEfficiency: 0.85,
  shiftUpRpm: 6500,
  shiftDownRpm: 2800,
  shiftTimeS: 0.25,
  cdA: 0.8,
  rollingResistance: 0.013,
  brakeForceN: 11500,
  brakeBiasFront: 0.65,
  tireGrip: 1.05,
  rearGripFactor: 1.2,
  handbrakeRearGrip: 0.4,
  steerMaxRad: 0.55,
  steerLateralG: 1.3,
  steerRateRadS: 2.5,
  steerReturnRadS: 3.5,
};
