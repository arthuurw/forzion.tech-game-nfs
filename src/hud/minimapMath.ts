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

/**
 * Segmentos de estrada do minimapa (city-terrain AC 34): cada par de pontos
 * consecutivos com pelo menos uma ponta dentro da janela de 320 m, já em
 * coordenadas de minimapa `[x1, y1, x2, y2]`. Pontos a cada 2 m: 1 px no mapa.
 */
export function minimapSegments(
  network: { roads: ReadonlyArray<{ closed: boolean; points: Float32Array }> },
  car: { x: number; z: number },
): number[][] {
  const half = MINIMAP_WINDOW_M / 2;
  const inside = (x: number, z: number) => Math.abs(x - car.x) <= half && Math.abs(z - car.z) <= half;
  const out: number[][] = [];
  for (const road of network.roads) {
    const p = road.points;
    const n = p.length / 3;
    const last = road.closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % n;
      const ax = p[i * 3]!;
      const az = p[i * 3 + 2]!;
      const bx = p[j * 3]!;
      const bz = p[j * 3 + 2]!;
      if (!inside(ax, az) && !inside(bx, bz)) continue;
      const a = worldToMinimap(ax, az, car);
      const b = worldToMinimap(bx, bz, car);
      out.push([a.x, a.y, b.x, b.y]);
    }
  }
  return out;
}
