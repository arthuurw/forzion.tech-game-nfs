/**
 * Flicker dos letreiros neon: intensidade emissiva por grupo de cor, sempre
 * dentro de [FLICKER_MIN, FLICKER_MAX]. Dois senos de frequências diferentes
 * por grupo dão um "respirar" lento com um tremor rápido por cima.
 */
export const FLICKER_MIN = 2.0;
export const FLICKER_MAX = 3.2;
const CENTER = (FLICKER_MIN + FLICKER_MAX) / 2; // 2.6
const SLOW_AMP = 0.5;
const FAST_AMP = 0.1;

const SLOW_HZ = [0.7, 0.9, 1.1, 1.3];
const FAST_HZ = [11.3, 13.7, 9.1, 15.9];
const PHASE = [0, 1.3, 2.6, 3.9];

export function flickerIntensity(t: number, group: number): number {
  const g = ((group % 4) + 4) % 4;
  const slow = Math.sin(2 * Math.PI * SLOW_HZ[g]! * t + PHASE[g]!);
  const fast = Math.sin(2 * Math.PI * FAST_HZ[g]! * t);
  return CENTER + SLOW_AMP * slow + FAST_AMP * fast;
}
