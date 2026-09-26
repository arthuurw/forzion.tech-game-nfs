import { describe, expect, it } from 'vitest';
import { FLICKER_MAX, FLICKER_MIN, flickerIntensity } from '../../src/world/flicker';

describe('neon flicker', () => {
  // visual-upgrade C11 (AC 11) - table-driven over the 4 groups
  it('neon flicker stays in range and moves', () => {
    expect(FLICKER_MIN).toBe(2.0);
    expect(FLICKER_MAX).toBe(3.2);
    const groups = [0, 1, 2, 3];
    for (let i = 0; i < 200; i++) {
      const t = (i / 200) * 20;
      let moved = false;
      for (const g of groups) {
        const v = flickerIntensity(t, g);
        expect(v, `group ${g} at ${t}`).toBeGreaterThanOrEqual(2.0);
        expect(v, `group ${g} at ${t}`).toBeLessThanOrEqual(3.2);
        if (Math.abs(flickerIntensity(t + 0.5, g) - v) > 0.05) moved = true;
      }
      expect(moved, `no group moved between ${t} and ${t + 0.5}`).toBe(true);
    }
  });
});
