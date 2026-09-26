import { describe, expect, it } from 'vitest';
import { BREATH_HZ, FLICKER_MAX, FLICKER_MIN, flickerIntensity } from '../../src/world/flicker';

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

  // visual-upgrade C40 (AC 26) - calmo: nenhum grupo muda mais que 0.2 em 0.5 s, nenhuma frequência acima de 0.5 Hz
  it('neon breathing is slow and never flashes', () => {
    for (const hz of BREATH_HZ) expect(hz).toBeLessThanOrEqual(0.5);
    for (let g = 0; g < 4; g++) {
      for (let i = 0; i < 400; i++) {
        const t = (i / 400) * 30;
        const d = Math.abs(flickerIntensity(t + 0.5, g) - flickerIntensity(t, g));
        expect(d, `group ${g} at ${t}`).toBeLessThanOrEqual(0.2);
      }
    }
  });
});
