import { describe, expect, it } from 'vitest';
import { MINIMAP_SIZE_PX, MINIMAP_WINDOW_M, minimapSegments, worldToMinimap } from '../../src/hud/minimapMath';

describe('minimap math', () => {
  // C30 (AC 23)
  it('320 m window into 160 px', () => {
    expect(MINIMAP_SIZE_PX).toBe(160);
    expect(MINIMAP_WINDOW_M).toBe(320);
    const car = { x: 10, z: -40 };
    expect(worldToMinimap(10, -40, car)).toEqual({ x: 80, y: 80 });
    expect(worldToMinimap(170, -40, car)).toEqual({ x: 160, y: 80 });
    expect(worldToMinimap(10, -200, car)).toEqual({ x: 80, y: 0 });
  });

  // city-terrain C41 (AC 34)
  it('road segments inside the 320 m window', () => {
    const road = (pts: number[], closed = false) => ({ closed, points: new Float32Array(pts) });
    const network = {
      roads: [
        // dentro da janela: 2 segmentos
        road([0, 0, 0, 2, 0, 0, 4, 0, 0]),
        // cruzando a borda: só o segmento com uma ponta dentro conta
        road([150, 0, 0, 170, 0, 0, 190, 0, 0]),
        // fora da janela
        road([500, 0, 500, 502, 0, 500]),
      ],
    };
    const car = { x: 0, z: 0 };
    const segs = minimapSegments(network, car);
    expect(segs).toEqual([
      [80, 80, 81, 80],
      [81, 80, 82, 80],
      [155, 80, 165, 80],
    ]);
    // carro a mais de 400 m de qualquer estrada: nada
    expect(minimapSegments(network, { x: -1000, z: -1000 })).toEqual([]);
  });
});
