/**
 * Projeção do mundo para o minimapa: janela de 320 m × 320 m centrada no
 * carro dentro de um canvas de 160 px. +x do mundo vai para a direita e +z
 * do mundo vai para baixo na tela (o eixo y do canvas cresce para baixo).
 */
export const MINIMAP_SIZE_PX = 160;
export const MINIMAP_WINDOW_M = 320;
export const MINIMAP_SCALE = MINIMAP_SIZE_PX / MINIMAP_WINDOW_M; // 0.5 px por metro

export function worldToMinimap(
  worldX: number,
  worldZ: number,
  car: { x: number; z: number },
): { x: number; y: number } {
  const half = MINIMAP_SIZE_PX / 2;
  return {
    x: half + (worldX - car.x) * MINIMAP_SCALE,
    y: half + (worldZ - car.z) * MINIMAP_SCALE,
  };
}
