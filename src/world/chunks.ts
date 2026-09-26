/**
 * Regras de streaming das malhas da city-terrain (door 7), sem three: o mundo
 * é uma grade de 6 × 6 chunks de 512 m. Um chunk é construído quando seu
 * centro fica a até 900 m do carro e descartado quando passa de 1200 m; entre
 * as duas distâncias nada muda. No máximo 1 construção por chamada (a do
 * chunk mais próximo); descartes não têm limite.
 */
import { WORLD_HALF } from './worldMath';

export const CHUNK_SIZE = 512;
export const CHUNKS_PER_SIDE = 6;
export const CHUNK_BUILD_M = 900;
export const CHUNK_DISPOSE_M = 1200;

export function chunkCenter(id: number): [number, number] {
  const cx = id % CHUNKS_PER_SIDE;
  const cz = Math.floor(id / CHUNKS_PER_SIDE);
  return [-WORLD_HALF + CHUNK_SIZE / 2 + cx * CHUNK_SIZE, -WORLD_HALF + CHUNK_SIZE / 2 + cz * CHUNK_SIZE];
}

export function chunkOf(x: number, z: number): number {
  const clampIdx = (v: number) => Math.min(CHUNKS_PER_SIDE - 1, Math.max(0, Math.floor((v + WORLD_HALF) / CHUNK_SIZE)));
  return clampIdx(z) * CHUNKS_PER_SIDE + clampIdx(x);
}

export function planChunks(carX: number, carZ: number, loaded: ReadonlySet<number>): { build: number[]; dispose: number[] } {
  let nearest = -1;
  let nearestD = Infinity;
  const dispose: number[] = [];
  for (let id = 0; id < CHUNKS_PER_SIDE * CHUNKS_PER_SIDE; id++) {
    const [x, z] = chunkCenter(id);
    const d = Math.hypot(x - carX, z - carZ);
    if (loaded.has(id)) {
      if (d > CHUNK_DISPOSE_M) dispose.push(id);
    } else if (d <= CHUNK_BUILD_M && d < nearestD) {
      nearest = id;
      nearestD = d;
    }
  }
  return { build: nearest >= 0 ? [nearest] : [], dispose };
}
