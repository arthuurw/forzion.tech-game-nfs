import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BULB_SWAY_GLSL, CROWN_SWAY_GLSL, FIREFLY_DRIFT_GLSL } from '../../src/world/interiors/InteriorScene';
import { FIREFLY_DRIFT, fireflyDrift } from '../../src/world/interiors/interiorMotion';
import { CAR_PAINT_GLSL, CAR_PAINT_GLSL_LITERALS, LUMA, PAINT_HUE_TOLERANCE, PAINT_MIN_SATURATION, PAINT_SWATCH } from '../../src/vehicle/carPaint';

// residuals C8-C10: o balanço do miolo tem uma fonte só, lida pelo shader e pelas sondas DEV
const TWO_PI = 6.28318530718;

/** Literais numéricos de um trecho de GLSL (ignora os dígitos colados a identificador, como `vec3`). */
function numericLiterals(glsl: string): number[] {
  return [...glsl.matchAll(/(?<![A-Za-z_\d.])\d+\.\d+|(?<![A-Za-z_\d.])\d+(?![\d.])/g)].map((m) => Number(m[0]));
}

/**
 * Texto-fonte do template `export const <name> = `...`;` em `InteriorScene.ts`, sem as
 * interpolações `${...}`: um número escrito à mão no shader aparece aqui mesmo quando
 * tem o mesmo valor da constante.
 */
function templateSourceLiterals(name: string): number[] {
  const src = readFileSync('src/world/interiors/InteriorScene.ts', 'utf-8');
  const m = src.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`));
  if (!m) throw new Error(`template ${name} não encontrado`);
  return numericLiterals(m[1]!.replace(/\$\{[^}]*\}/g, ' '));
}

describe('shared interior motion constants', () => {
  // C8
  it('firefly shader reads the shared constants', () => {
    expect(FIREFLY_DRIFT).toEqual({
      x: { amp: 1.0, freq: 0.05 },
      y: { amp: 0.4, freq: 0.06 },
      z: { amp: 1.0, freq: 0.045 },
    });
    const found = numericLiterals(FIREFLY_DRIFT_GLSL).sort((a, b) => a - b);
    const expected = [
      FIREFLY_DRIFT.x.amp,
      FIREFLY_DRIFT.x.freq,
      FIREFLY_DRIFT.y.amp,
      FIREFLY_DRIFT.y.freq,
      FIREFLY_DRIFT.z.amp,
      FIREFLY_DRIFT.z.freq,
      TWO_PI,
      TWO_PI,
      TWO_PI,
    ].sort((a, b) => a - b);
    expect(found).toEqual(expected);
    // no fonte, fora das interpolações, só sobra 2π
    expect(templateSourceLiterals('FIREFLY_DRIFT_GLSL')).toEqual([TWO_PI, TWO_PI, TWO_PI]);
  });

  // C9
  it('firefly probe follows the shared constants', () => {
    const t = 3.7;
    const [px, py, pz] = [0.4, 1.1, 2.5];
    const base = fireflyDrift(t, px, py, pz);
    expect(base.dx).toBeCloseTo(1.0 * Math.sin(2 * Math.PI * 0.05 * t + px), 12);
    expect(base.dy).toBeCloseTo(0.4 * Math.sin(2 * Math.PI * 0.06 * t + py), 12);
    expect(base.dz).toBeCloseTo(1.0 * Math.sin(2 * Math.PI * 0.045 * t + pz), 12);
    const changed = fireflyDrift(t, px, py, pz, {
      x: { amp: 2.0, freq: 0.05 },
      y: { amp: 0.4, freq: 0.12 },
      z: { amp: 1.0, freq: 0.045 },
    });
    expect(changed.dx).toBeCloseTo(2 * base.dx, 12);
    expect(changed.dy).toBeCloseTo(0.4 * Math.sin(2 * Math.PI * 0.12 * t + py), 12);
    expect(changed.dz).toBeCloseTo(base.dz, 12);
  });

  // C10
  it('sway shaders carry no numeric literal besides two pi', () => {
    expect(numericLiterals(CROWN_SWAY_GLSL)).toEqual([TWO_PI]);
    // a amplitude da lâmpada chega interpolada de BULB_AMPLITUDE (0.12)
    expect(numericLiterals(BULB_SWAY_GLSL)).toEqual([0.12, TWO_PI]);
    expect(templateSourceLiterals('BULB_SWAY_GLSL')).toEqual([TWO_PI]);
    expect(templateSourceLiterals('CROWN_SWAY_GLSL')).toEqual([TWO_PI]);
  });

  // block-life-extras C2: a repintura lê as constantes de carPaint.ts
  it('car paint shader reads the shared constants', () => {
    const n = parseInt(PAINT_SWATCH.slice(1), 16);
    for (const v of [(n >> 16) & 255, (n >> 8) & 255, n & 255]) expect(CAR_PAINT_GLSL).toContain((v / 255).toFixed(4));
    expect(CAR_PAINT_GLSL).toContain(Math.cos((PAINT_HUE_TOLERANCE * Math.PI) / 180).toFixed(4));
    expect(CAR_PAINT_GLSL).toContain(`sat >= ${PAINT_MIN_SATURATION}`);
    for (const w of LUMA) expect(CAR_PAINT_GLSL).toContain(String(w));
    // nenhum outro literal com ponto decimal
    const dotted = [...CAR_PAINT_GLSL.matchAll(/(?<![A-Za-z_\d.])\d+\.\d+/g)].map((m) => Number(m[0]));
    expect(dotted.length).toBeGreaterThan(0);
    for (const v of dotted) expect(CAR_PAINT_GLSL_LITERALS, `literal ${v}`).toContain(v);
    const src = readFileSync('src/vehicle/carPaint.ts', 'utf-8');
    const tpl = src.match(/export const CAR_PAINT_GLSL = `([\s\S]*?)`;/)![1]!.replace(/\$\{[^}]*\}/g, ' ');
    expect(tpl.match(/(?<![A-Za-z_\d.])\d+\.\d+/g)).toBeNull();
  });
});
