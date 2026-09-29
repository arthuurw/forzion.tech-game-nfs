/**
 * Cor da janela acesa (night-city AC 18), sem three: três cores fixas escolhidas por um hash da
 * janela, separado do hash que decide se ela está acesa. O shader de fachada interpola estes
 * limites e cores; nada depende do tempo.
 */
export const WINDOW_WARM = '#ffd9a0';
export const WINDOW_COOL = '#cfe0ff';
export const WINDOW_TV = '#7fa8ff';
/** h < 0.70: quente; < 0.90: fria; resto: azul de TV */
export const WINDOW_WARM_BELOW = 0.7;
export const WINDOW_COOL_BELOW = 0.9;

export function windowTint(h: number): string {
  if (h < WINDOW_WARM_BELOW) return WINDOW_WARM;
  if (h < WINDOW_COOL_BELOW) return WINDOW_COOL;
  return WINDOW_TV;
}
