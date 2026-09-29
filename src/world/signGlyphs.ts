/**
 * Letreiros de neon da night-city (S4), sem three: 8 padrões de "letras" abstratas feitas de
 * tubos, numa máscara de 64 × 32 texels por padrão. Não é texto legível: são 3 a 5 caixas de
 * letra com segmentos retos (como um mostrador de 7 segmentos), tubo de 2 texels, margem de
 * 3. O shader do letreiro lê as 8 máscaras empilhadas numa textura de 64 × 256.
 */
import { mulberry32 } from './CityGenerator';

export const GLYPH_W = 64;
export const GLYPH_H = 32;
export const GLYPH_PATTERNS = 8;
const MARGIN = 3;
const TUBE = 2;

/** Máscara do padrão `pattern` (0-7): 1 onde há tubo, linha `y` de baixo para cima. */
export function glyphMask(pattern: number): Uint8Array {
  const mask = new Uint8Array(GLYPH_W * GLYPH_H);
  const rng = mulberry32(9100 + pattern);
  const letters = 3 + Math.floor(rng() * 3);
  const box = (GLYPH_W - 2 * MARGIN) / letters;
  const fill = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = Math.max(0, y0); y < Math.min(GLYPH_H, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(GLYPH_W, x1); x++) mask[y * GLYPH_W + x] = 1;
    }
  };
  for (let i = 0; i < letters; i++) {
    const x0 = Math.round(MARGIN + i * box + 1);
    const x1 = Math.round(MARGIN + (i + 1) * box - 1);
    const y0 = MARGIN;
    const y1 = GLYPH_H - MARGIN;
    const ym = Math.round((y0 + y1) / 2);
    // segmentos: esquerda, direita, cima, meio, baixo, centro; pelo menos 2 por letra
    const on = [0, 1, 2, 3, 4, 5].map(() => rng() < 0.5);
    if (on.filter(Boolean).length < 2) {
      on[0] = true;
      on[2] = true;
    }
    if (on[0]) fill(x0, y0, x0 + TUBE, y1);
    if (on[1]) fill(x1 - TUBE, y0, x1, y1);
    if (on[2]) fill(x0, y1 - TUBE, x1, y1);
    if (on[3]) fill(x0, ym - 1, x1, ym + 1);
    if (on[4]) fill(x0, y0, x1, y0 + TUBE);
    if (on[5]) fill(Math.round((x0 + x1) / 2) - 1, y0, Math.round((x0 + x1) / 2) + 1, y1);
  }
  return mask;
}

/** Fração da face coberta por tubo. */
export function glyphCoverage(mask: Uint8Array): number {
  let n = 0;
  for (const v of mask) n += v;
  return n / mask.length;
}

/** Padrão do letreiro em (x, z), sorteado com `mulberry32` a partir da posição arredondada ao centímetro. */
export function signPattern(x: number, z: number): number {
  const seed = (Math.round(x * 100) * 73856093) ^ (Math.round(z * 100) * 19349663);
  return Math.floor(mulberry32(seed >>> 0)() * GLYPH_PATTERNS);
}
