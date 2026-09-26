/**
 * Matemática pura da chuva. Cada gota tem uma altura-semente; a altura atual
 * é a semente menos a queda, enrolada dentro da caixa. O shader faz a mesma
 * conta na GPU; esta versão existe para ser testada.
 */
export const RAIN_BOX = { x: 60, y: 40, z: 60 } as const;
export const RAIN_SPEED_MS = 12;
export const RAIN_STREAK_M = 0.4;

/** Altura da gota no tempo t, enrolada em [0, RAIN_BOX.y). */
export function rainY(seedY: number, t: number, height: number = RAIN_BOX.y, speed: number = RAIN_SPEED_MS): number {
  const raw = (seedY - speed * t) % height;
  return (raw + height) % height;
}
