/**
 * Reflexo da rua molhada (night-city S2), sem three: as constantes e as contas que o shader
 * do espelho usa, interpoladas no GLSL de `CityScene.ts`.
 *
 * A luz refletida vira uma faixa vertical: 13 amostras em tenda ao longo do eixo vertical da
 * tela, com meia-faixa de `streakTexels(d)` texels do alvo de meia resolução, que cresce com a
 * distância `d` da câmera ao ponto do asfalto. O reflexo nunca soma luz: o alvo é multiplicado
 * pelo tom `MIRROR_TINT` (≤ 1 por canal) e pelo Fresnel (`mirrorFresnel`, em [0, 1]).
 */
/** meia-faixa vertical perto da câmera (texels do alvo de meia resolução) */
export const MIRROR_STREAK_TEXELS = 10;
/** quanto a meia-faixa cresce por metro de distância (fração) */
export const MIRROR_STREAK_GROW = 0.06;
/** tom do reflexo, frio e abaixo de 1: o asfalto absorve parte da luz */
export const MIRROR_TINT: readonly [number, number, number] = [0.88, 0.92, 1.0];
/** refletância olhando de cima (Schlick F0) */
export const MIRROR_F0 = 0.65;

/** Meia-faixa (texels) a `d` m da câmera, com base `base` (0 = amostra única). */
export function streakTexels(base: number, d: number): number {
  return base * (1 + d * MIRROR_STREAK_GROW);
}

/** Fresnel de Schlick para o cosseno entre a vista e a normal do chão: 0.65 de cima, 1 rasante. */
export function mirrorFresnel(cos: number): number {
  const c = Math.min(1, Math.max(0, cos));
  return MIRROR_F0 + (1 - MIRROR_F0) * (1 - c) ** 5;
}
