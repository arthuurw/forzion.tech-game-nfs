/**
 * Semente e sorteio do mundo (AD-008): o PRNG `mulberry32`, a semente padrão e a
 * paleta de neon que os geradores de terreno, ruas, lotes e miolo compartilham.
 * Só dados: nenhum objeto do three aqui. A cidade em si sai de `terrain/`,
 * `roads/`, `lots/` e `interiors/`; o gerador de quarteirões de antes da city-terrain saiu.
 */
export const DEFAULT_SEED = 1337;
export const FACADE_TYPES = 4;

export const NEON_PALETTE = ['#ff2d95', '#00e5ff', '#b026ff', '#ffd400'] as const;
export type NeonColor = (typeof NEON_PALETTE)[number];

/** PRNG pequeno e determinístico. Mesmo seed, mesma sequência. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
