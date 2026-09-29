/**
 * Luz dos postes no chão (night-city door 2), sem three: uma grade RGBA de 1536 × 1536
 * células de 2 m sobre o mundo de ±1536 m. Cada lente soma a cor do seu poste com a queda
 * `max(0, 1 − (d / 9 m)²)²` em volta da vertical dela. O asfalto, a calçada e o terreno
 * leem a grade como textura pela posição xz do mundo: a luz fica no chão sem nenhuma
 * luz real nem draw call por poste, e não muda com o tempo.
 */
import { hexToRgb } from '../vehicle/carPaint';
import { WORLD_HALF } from './worldMath';

export const LAMP_LIGHT_CELL_M = 2;
/** lado do mundo coberto pela grade (m) */
export const WORLD_EXTENT_M = WORLD_HALF * 2;
export const LAMP_LIGHT_SIZE = WORLD_EXTENT_M / LAMP_LIGHT_CELL_M; // 1536
/** raio da mancha de luz no chão (m) */
export const LAMP_LIGHT_RADIUS_M = 9;

export interface LampLightGrid {
  size: number;
  cell: number;
  /** x (e z) do canto da célula 0 */
  origin: number;
  /** RGBA, 0-255; linha `iz`, coluna `ix`; alfa sempre 255 */
  data: Uint8Array;
}

/** Queda da luz com a distância horizontal à lente: 1 embaixo, 0 a partir de 9 m, sempre decrescente. */
export function lampFalloff(d: number): number {
  const t = 1 - (d / LAMP_LIGHT_RADIUS_M) ** 2;
  return t > 0 ? t * t : 0;
}

/** Centro da célula `i` numa direção (m). */
export function lampLightCellCenter(i: number): number {
  return -WORLD_HALF + LAMP_LIGHT_CELL_M * (i + 0.5);
}

export function buildLampLight(heads: ReadonlyArray<{ x: number; z: number; color: string }>): LampLightGrid {
  const n = LAMP_LIGHT_SIZE;
  const acc = new Float32Array(n * n * 3);
  const reach = Math.ceil(LAMP_LIGHT_RADIUS_M / LAMP_LIGHT_CELL_M);
  for (const h of heads) {
    const [r, g, b] = hexToRgb(h.color);
    const cx = Math.floor((h.x + WORLD_HALF) / LAMP_LIGHT_CELL_M);
    const cz = Math.floor((h.z + WORLD_HALF) / LAMP_LIGHT_CELL_M);
    for (let iz = Math.max(0, cz - reach); iz <= Math.min(n - 1, cz + reach); iz++) {
      for (let ix = Math.max(0, cx - reach); ix <= Math.min(n - 1, cx + reach); ix++) {
        const w = lampFalloff(Math.hypot(lampLightCellCenter(ix) - h.x, lampLightCellCenter(iz) - h.z));
        if (w === 0) continue;
        const k = (iz * n + ix) * 3;
        acc[k] = acc[k]! + r * w;
        acc[k + 1] = acc[k + 1]! + g * w;
        acc[k + 2] = acc[k + 2]! + b * w;
      }
    }
  }
  const data = new Uint8Array(n * n * 4);
  for (let c = 0; c < n * n; c++) {
    data[c * 4] = Math.round(Math.min(1, acc[c * 3]!) * 255);
    data[c * 4 + 1] = Math.round(Math.min(1, acc[c * 3 + 1]!) * 255);
    data[c * 4 + 2] = Math.round(Math.min(1, acc[c * 3 + 2]!) * 255);
    data[c * 4 + 3] = 255;
  }
  return { size: n, cell: LAMP_LIGHT_CELL_M, origin: -WORLD_HALF, data };
}
