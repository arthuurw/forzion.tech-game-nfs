import { describe, expect, it } from 'vitest';
import { streakReflectorShader } from '../../src/world/CityScene';
import { MIRROR_F0, MIRROR_STREAK_GROW, MIRROR_TINT, mirrorFresnel, streakTexels } from '../../src/world/mirrorMath';
import { skylineHeight } from '../../src/world/skyMath';

// night-city: shaders e regras puras (checks C12, C16, C19, C22, C26)
const glsl = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

describe('night-city shaders', () => {
  // C12 (AC 9)
  it('mirror never adds light', () => {
    const frag = streakReflectorShader(320, 180).fragmentShader;
    expect(frag).not.toContain('blendOverlay(');
    for (const c of MIRROR_TINT) {
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThanOrEqual(1);
    }
    expect(frag).toContain(`vec3( ${MIRROR_TINT.map(glsl).join(', ')} )`);
    expect(frag).toContain(`dist * ${glsl(MIRROR_STREAK_GROW)}`);
    expect(frag).toContain(`${glsl(MIRROR_F0)} + ${glsl(1 - MIRROR_F0)} * pow( 1.0 - c, 5.0 )`);
    const cos = [0, 0.25, 0.5, 0.75, 1];
    const f = cos.map(mirrorFresnel);
    for (const v of f) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < f.length; i++) expect(f[i]!).toBeLessThanOrEqual(f[i - 1]!);
    expect(f[0]).toBe(1);
    expect(f[4]).toBe(MIRROR_F0);
    // a faixa cresce com a distância e some com a base 0 (a sonda `mirrorBlur: false`)
    expect(streakTexels(6, 60)).toBeGreaterThan(streakTexels(6, 20));
    expect(streakTexels(0, 60)).toBe(0);
  });

  // C16 (AC 13)
  it('skyline is a stepped silhouette', () => {
    const values = Array.from({ length: 3600 }, (_, i) => skylineHeight(-Math.PI + (i / 3600) * 2 * Math.PI));
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0.02);
      expect(v).toBeLessThanOrEqual(0.08);
    }
    expect(new Set(values).size).toBeGreaterThanOrEqual(60);
    for (const az of [-3, -1.2, 0, 0.7, 2.5]) {
      expect(skylineHeight(az + 2 * Math.PI)).toBe(skylineHeight(az));
      expect(skylineHeight(az)).toBe(skylineHeight(az));
    }
  });
});
