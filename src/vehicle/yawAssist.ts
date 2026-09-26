import type { CarSpec } from './carSpec';

/**
 * Ajuda de giro arcade (door 1 da yaw-assist, AD-013). Pura: sem three nem rapier.
 * O giro alvo sai do ângulo das rodas como numa bicicleta (`v · tan(steer) / entre-eixos`),
 * limitado a `yawAssistLateralG`; o torque empurra o giro atual para o alvo nos dois
 * sentidos (também freia o giro quando o volante volta ao centro).
 */
const GRAVITY = 9.81;
/** abaixo desta velocidade (m/s) a ajuda não age: carro parado ou manobrando */
const MIN_SPEED_MS = 2;
/** com menos rodas no chão (no ar ou capotando) a ajuda não age */
const MIN_WHEELS_IN_CONTACT = 2;

/**
 * Torque (N·m) no eixo Y do mundo, positivo = esquerda.
 * `steerRad` é o ângulo das rodas dianteiras, `forwardSpeedMs` a velocidade ao longo da
 * frente (negativa em ré), `yawRate` o giro atual (rad/s) e `yawInertia` a inércia em Y (kg·m²).
 */
export function yawAssistTorque(
  spec: CarSpec,
  steerRad: number,
  forwardSpeedMs: number,
  yawRate: number,
  wheelsInContact: number,
  yawInertia: number,
): number {
  const speed = Math.abs(forwardSpeedMs);
  if (speed < MIN_SPEED_MS || wheelsInContact < MIN_WHEELS_IN_CONTACT) return 0;
  const kinematic = (forwardSpeedMs * Math.tan(steerRad)) / spec.wheelbaseM;
  const limit = (spec.yawAssistLateralG * GRAVITY) / speed;
  const target = Math.sign(kinematic) * Math.min(Math.abs(kinematic), limit);
  const torque = spec.yawAssistGain * yawInertia * (target - yawRate);
  return Math.max(-spec.yawAssistMaxNm, Math.min(spec.yawAssistMaxNm, torque));
}
