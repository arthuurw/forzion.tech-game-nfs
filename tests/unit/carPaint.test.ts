import { describe, expect, it } from 'vitest';
import { hexToRgb, luminance, recolorTexel, rgbToHex, type Rgb } from '../../src/vehicle/carPaint';

// block-life-extras C1: os texels que o car.glb usa (medidos em 2026-09-27 no colormap.png)
const PAINT = '#2f8cff';
const SWATCH = '#ff7e44';

function scaled(paintHex: string, texelHex: string): Rgb {
  const p = hexToRgb(paintHex);
  const k = luminance(hexToRgb(texelHex)) / luminance(hexToRgb(SWATCH));
  return [Math.min(1, p[0] * k), Math.min(1, p[1] * k), Math.min(1, p[2] * k)];
}

function expectClose(actual: Rgb, expected: Rgb, label: string): void {
  for (let i = 0; i < 3; i++) expect(Math.abs(actual[i]! - expected[i]!), `${label} canal ${i}`).toBeLessThanOrEqual(1 / 255);
}

describe('car paint recolor', () => {
  // C1
  it('recolors the orange swatch and keeps glass wheel and trim', () => {
    const paint = hexToRgb(PAINT);
    const rows: Array<[string, Rgb]> = [
      ['#ff7e44', hexToRgb(PAINT)],
      ['#ee6445', scaled(PAINT, '#ee6445')],
      ['#fa6b41', scaled(PAINT, '#fa6b41')],
      ['#6d6e83', hexToRgb('#6d6e83')],
      ['#36363a', hexToRgb('#36363a')],
      ['#3d3d44', hexToRgb('#3d3d44')],
    ];
    for (const [texel, expected] of rows) expectClose(recolorTexel(hexToRgb(texel), paint), expected, texel);
    // o gradiente escurece com o texel: os dois ficam abaixo do quadrado
    expect(luminance(recolorTexel(hexToRgb('#ee6445'), paint))).toBeLessThan(luminance(recolorTexel(hexToRgb('#ff7e44'), paint)));
    expect(rgbToHex(recolorTexel(hexToRgb('#ff7e44'), paint))).toBe(PAINT);
  });
});
