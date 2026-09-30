/**
 * Matemática pura da chuva. Cada gota tem uma altura-semente; a altura atual
 * é a semente menos a queda, enrolada dentro da caixa, que acompanha a altura do carro. O shader faz a mesma
 * conta na GPU; esta versão existe para ser testada.
 */
export const RAIN_BOX = { x: 60, y: 40, z: 60 } as const;
export const RAIN_SPEED_MS = 12;
export const RAIN_STREAK_M = 0.4;

/**
 * Quanto da caixa fica abaixo do carro (m): 30 % dos 40 m. A câmera fica atrás e acima do
 * carro e as gotas caem de cima, então a caixa sobe e desce com ele (play-fixes AC 17).
 */
export const RAIN_BELOW = RAIN_BOX.y * 0.3;

/**
 * Altura da gota no tempo t com o carro na altura `cy`: a gota cai parada no mundo e é enrolada
 * dentro de `[cy − 12, cy + 28)`. Com `cy` = 12 (o padrão) a caixa é `[0, 40)`.
 */
export function rainY(seedY: number, t: number, cy: number = RAIN_BELOW, height: number = RAIN_BOX.y, speed: number = RAIN_SPEED_MS): number {
  const bottom = cy - RAIN_BELOW;
  const raw = (seedY - speed * t - bottom) % height;
  return bottom + ((raw + height) % height);
}
