/**
 * Céu da night-city (door 3), sem three: as cores e a silhueta de prédios distantes que o
 * shader da cúpula usa. A silhueta é uma volta de 96 degraus de altura sorteada uma vez
 * (`mulberry32`), fixa no mundo: gira com a câmera, nunca com o tempo.
 */
import { mulberry32 } from './CityGenerator';

export const SKY_ZENITH = '#03040c';
export const SKY_HORIZON = '#2a1a3e';
export const SKY_GLOW = '#5a2a1c';
export const SKY_SILHOUETTE = '#06050c';
/** raio da cúpula (m): dentro do `far` de 600 m da câmera de perseguição */
export const SKY_RADIUS_M = 500;
export const SKYLINE_STEPS = 96;
export const SKYLINE_MIN = 0.02;
export const SKYLINE_MAX = 0.08;

/** alturas dos 96 degraus (fração do raio, ≈ seno da elevação) */
export const SKYLINE_TABLE: readonly number[] = (() => {
  const rng = mulberry32(4242);
  return Array.from({ length: SKYLINE_STEPS }, () => SKYLINE_MIN + (SKYLINE_MAX - SKYLINE_MIN) * rng());
})();

/** Altura da silhueta no azimute `az` (rad, 0 = +Z, como `atan2(x, z)`); periódica em 2π. */
export function skylineHeight(az: number): number {
  const turn = (((az + Math.PI) / (2 * Math.PI)) % 1 + 1) % 1;
  return SKYLINE_TABLE[Math.min(SKYLINE_STEPS - 1, Math.floor(turn * SKYLINE_STEPS))]!;
}
