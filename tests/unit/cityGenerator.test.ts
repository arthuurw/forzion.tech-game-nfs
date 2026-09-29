import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/world/CityGenerator';

// o gerador da grade 8×8 antiga saiu (test-hardening C26); sobra o PRNG que todo o mundo usa (AD-008)
describe('CityGenerator', () => {
  it('mulberry32 is deterministic', () => {
    const take = (seed: number) => {
      const rng = mulberry32(seed);
      return Array.from({ length: 1000 }, () => rng());
    };
    const a = take(1337);
    expect(take(1337)).toEqual(a);
    expect(take(1338)).not.toEqual(a);
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
