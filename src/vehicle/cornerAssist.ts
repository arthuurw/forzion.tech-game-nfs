import type { CarSpec } from './carSpec';

/**
 * Força de curva arcade (door 1 da corner-assist, AD-014). Pura: sem three nem rapier.
 * O volante pede uma aceleração lateral como numa bicicleta (`v² · tan(steer) / entre-eixos`);
 * o pneu faz sozinho até `cornerAssistStartG` e esta força completa o resto, até
 * `cornerAssistMaxG`. O `Car` aplica no centro de massa, então ela não tomba o carro.
 */
const GRAVITY = 9.81;
/** abaixo desta velocidade (m/s) a força não age: carro parado ou manobrando */
const MIN_SPEED_MS = 5;
/** com menos rodas no chão (no ar ou capotando) a força não age */
const MIN_WHEELS_IN_CONTACT = 2;

/**
 * Força lateral (N), positiva = para a esquerda do carro.
 * `steerRad` é o ângulo das rodas dianteiras e `forwardSpeedMs` a velocidade ao longo da
 * frente (negativa em ré; de ré o centro da curva continua do lado do volante).
 */
export function cornerAssistForce(
  spec: CarSpec,
  steerRad: number,
  forwardSpeedMs: number,
  wheelsInContact: number,
  handbrake: boolean,
): number {
  if (handbrake || Math.abs(forwardSpeedMs) < MIN_SPEED_MS || wheelsInContact < MIN_WHEELS_IN_CONTACT) return 0;
  const requested = (forwardSpeedMs * forwardSpeedMs * Math.tan(steerRad)) / spec.wheelbaseM;
  const extra = Math.abs(requested) - spec.cornerAssistStartG * GRAVITY;
  const cap = (spec.cornerAssistMaxG - spec.cornerAssistStartG) * GRAVITY;
  const fill = Math.max(0, Math.min(extra, cap));
  if (fill === 0) return 0;
  return Math.sign(requested) * spec.massKg * fill;
}
