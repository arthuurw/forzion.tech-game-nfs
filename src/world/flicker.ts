/**
 * "Respiração" dos letreiros neon: intensidade emissiva por grupo de cor,
 * sempre dentro de [FLICKER_MIN, FLICKER_MAX] do plano. Versão calma
 * (pedido do usuário em 2026-09-25: "low-cortisol"): um único seno lento por
 * grupo a 0.22 Hz (um ciclo a cada ~4.5 s), sem tremor rápido, amplitude
 * pequena. As fases ficam escalonadas de 45°: nunca os 4 param no pico ao
 * mesmo tempo (a AC 11 exige algum movimento a cada 0.5 s), e a variação
 * máxima em 0.5 s é 0.5·sin(π·0.22·0.5) ≈ 0.17, abaixo de 0.2 (AC 26).
 */
export const FLICKER_MIN = 2.0;
export const FLICKER_MAX = 3.2;
export const BREATH_CENTER = 2.3;
export const BREATH_AMP = 0.25;
export const BREATH_HZ = [0.22, 0.22, 0.22, 0.22] as const;
const PHASE = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];

export function flickerIntensity(t: number, group: number): number {
  const g = ((group % 4) + 4) % 4;
  return BREATH_CENTER + BREATH_AMP * Math.sin(2 * Math.PI * BREATH_HZ[g]! * t + PHASE[g]!);
}
