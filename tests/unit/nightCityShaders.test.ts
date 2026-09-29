import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeFacadeMaterial, makeSignMaterial, streakReflectorShader } from '../../src/world/CityScene';
import { createSky } from '../../src/world/Environment';
import { addLampLight, makeStreetLampMaterial } from '../../src/world/StreetLamps';
import { MIRROR_F0, MIRROR_STREAK_GROW, MIRROR_TINT, mirrorFresnel, streakTexels } from '../../src/world/mirrorMath';
import { skylineHeight } from '../../src/world/skyMath';
import { GLYPH_H, GLYPH_PATTERNS, GLYPH_W, glyphCoverage, glyphMask } from '../../src/world/signGlyphs';
import { WINDOW_COOL, WINDOW_TV, WINDOW_WARM, windowTint } from '../../src/world/windowTint';

// night-city: shaders e regras puras (checks C12, C16, C19, C22, C26)
/** vertex + fragment de um material padrão depois do `onBeforeCompile` dele */
function compiled(m: THREE.Material): { vertexShader: string; fragmentShader: string; uniforms: Record<string, unknown> } {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  m.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, undefined as unknown as THREE.WebGLRenderer);
  return shader;
}

/** texto do fragment shader de fachada depois do `onBeforeCompile`, sobre o shader padrão do three */
function facadeFragment(): string {
  return compiled(makeFacadeMaterial(undefined, 0, { value: 1 }, { value: 1 })).fragmentShader;
}

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

  // C19 (AC 16)
  it('sign glyphs cover part of the face', () => {
    expect(GLYPH_PATTERNS).toBe(8);
    for (let p = 0; p < GLYPH_PATTERNS; p++) {
      const mask = glyphMask(p);
      expect(mask.length, `pattern ${p}`).toBe(GLYPH_W * GLYPH_H);
      const c = glyphCoverage(mask);
      expect(c, `pattern ${p}`).toBeGreaterThanOrEqual(0.15);
      expect(c, `pattern ${p}`).toBeLessThanOrEqual(0.45);
      expect(glyphMask(p)).toEqual(mask);
    }
  });

  // C22 (AC 18)
  it('window tints come in three fixed colors', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 10_000; i++) {
      const c = windowTint((i + 0.5) / 10_000);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([WINDOW_TV, WINDOW_COOL, WINDOW_WARM].sort());
    expect(Math.abs(counts.get(WINDOW_WARM)! / 10_000 - 0.7)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(counts.get(WINDOW_COOL)! / 10_000 - 0.2)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(counts.get(WINDOW_TV)! / 10_000 - 0.1)).toBeLessThanOrEqual(0.01);
    expect([WINDOW_WARM, WINDOW_COOL, WINDOW_TV]).toEqual(['#ffd9a0', '#cfe0ff', '#7fa8ff']);
    // o shader de fachada usa os mesmos limites, as três cores e um hash próprio (não o de janela acesa)
    const frag = facadeFragment();
    expect(frag).toContain('float tintHash = windowHash(cellId + 7.7, vSeedF);');
    expect(frag).toContain('tintHash < 0.70 ?');
    expect(frag).toContain('tintHash < 0.90 ?');
    expect(frag).toContain('step(windowHash(cellId, vSeedF)');
    expect(frag).not.toContain('windowHash(cellId + 7.7, vSeedF), ');
    const warm = new THREE.Color(WINDOW_WARM);
    for (const hex of [WINDOW_WARM, WINDOW_COOL, WINDOW_TV]) {
      const c = new THREE.Color(hex);
      expect(frag, hex).toContain(`vec3(${(c.r / warm.r).toFixed(4)}, ${(c.g / warm.g).toFixed(4)}, ${(c.b / warm.b).toFixed(4)})`);
    }
  });

  // C26 (AC 22)
  it('nothing new reads the clock', () => {
    const ground = new THREE.MeshStandardMaterial();
    addLampLight(ground, new THREE.Texture(), 3, 0.1, 'test');
    const sky = createSky().material as THREE.ShaderMaterial;
    const texts: Array<[string, string, Record<string, unknown>]> = [
      ['sky', sky.vertexShader + sky.fragmentShader, sky.uniforms],
      ['street lamp', ...(({ vertexShader, fragmentShader, uniforms }) => [vertexShader + fragmentShader, uniforms] as const)(compiled(makeStreetLampMaterial()))],
      ['ground light', ...(({ vertexShader, fragmentShader, uniforms }) => [vertexShader + fragmentShader, uniforms] as const)(compiled(ground))],
      ['mirror streak', streakReflectorShader(320, 180).vertexShader + streakReflectorShader(320, 180).fragmentShader, streakReflectorShader(320, 180).uniforms],
      ['facade tint', facadeFragment(), {}],
      ['neon sign', ...(({ vertexShader, fragmentShader, uniforms }) => [vertexShader + fragmentShader, uniforms] as const)(compiled(makeSignMaterial('#ff2d95', new THREE.Texture())))],
    ];
    for (const [name, text, uniforms] of texts) {
      expect(text, name).not.toMatch(/\buTime\b|uniform\s+float\s+time\b/);
      expect(Object.keys(uniforms).filter((k) => /time/i.test(k)), name).toEqual([]);
    }
  });
});
