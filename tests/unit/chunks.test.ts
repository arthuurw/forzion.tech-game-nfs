import { describe, expect, it } from 'vitest';
import { chunkCenter, planChunks } from '../../src/world/chunks';

/** posição do carro a `d` m do centro do chunk `id`, na direção +x */
const at = (id: number, d: number): [number, number] => {
  const [x, z] = chunkCenter(id);
  return [x + d, z];
};

describe('chunks', () => {
  // C36 (AC 30, door 7)
  it('chunk build and dispose rules', () => {
    // grade 6 × 6 de 512 m
    expect(chunkCenter(0)).toEqual([-1280, -1280]);
    expect(chunkCenter(35)).toEqual([1280, 1280]);
    const others = (id: number) => new Set(Array.from({ length: 36 }, (_, i) => i).filter((i) => i !== id));

    // não carregado a 899 m → construir
    let [x, z] = at(0, -899);
    expect(planChunks(x, z, others(0)).build).toEqual([0]);
    // a 901 m → não
    [x, z] = at(0, -901);
    expect(planChunks(x, z, others(0)).build).toEqual([]);
    // carregado a 1199 m → manter; a 1201 m → descartar
    [x, z] = at(0, -1199);
    expect(planChunks(x, z, new Set([0])).dispose).toEqual([]);
    [x, z] = at(0, -1201);
    expect(planChunks(x, z, new Set([0])).dispose).toEqual([0]);

    // 3+ candidatos: só 1, o mais próximo; descartes sem limite
    const plan = planChunks(-1280 + 10, -1280, new Set([35, 34, 29]));
    expect(plan.build).toEqual([0]);
    expect(plan.dispose.sort()).toEqual([29, 34, 35]);
  });
});
