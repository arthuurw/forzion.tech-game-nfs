/**
 * Pintura dos carros (block-life-extras door 3), puro. A textura do `car.glb`
 * é uma paleta: a carroceria aponta para o quadrado laranja `#ff7e44`, o vidro
 * e as rodas para cinzas. A pintura troca só os texels laranja pela cor do
 * carro, escalada pela luminância relativa do texel (o gradiente fica), e
 * deixa o resto como está. A mesma conta existe em GLSL (`CAR_PAINT_GLSL`,
 * injetado depois de `map_fragment`, com a pintura em `carPaint`) e em JS
 * (`recolorTexel`), com as constantes numa fonte só. Tudo em sRGB: o shader
 * converte o texel decodificado para sRGB, troca, e volta para linear.
 */
export type Rgb = [number, number, number];

/** quadrado da paleta para onde a carroceria aponta */
export const PAINT_SWATCH = '#ff7e44';
/** matiz (graus) e saturação mínima que decidem se um texel é carroceria */
export const PAINT_HUE_TOLERANCE = 25;
export const PAINT_MIN_SATURATION = 0.5;
/** pesos da luminância (Rec. 709) */
export const LUMA: Rgb = [0.2126, 0.7152, 0.0722];

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(c: Rgb): string {
  return '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
}

export function luminance(c: Rgb): number {
  return LUMA[0] * c[0] + LUMA[1] * c[1] + LUMA[2] * c[2];
}

/** saturação HSV: (máx − mín) / máx */
export function saturation(c: Rgb): number {
  const mx = Math.max(c[0], c[1], c[2]);
  const mn = Math.min(c[0], c[1], c[2]);
  return mx > mn ? (mx - mn) / mx : 0;
}

/** parte do texel fora do cinza: o vetor menos a média dos canais */
function chroma(c: Rgb): Rgb {
  const m = (c[0] + c[1] + c[2]) / 3;
  return [c[0] - m, c[1] - m, c[2] - m];
}

/** matiz circular: ângulo (graus) entre os cromas de `a` e `b`; 180 quando um deles é cinza */
export function hueDistanceDeg(a: Rgb, b: Rgb): number {
  const ca = chroma(a);
  const cb = chroma(b);
  const la = Math.hypot(...ca);
  const lb = Math.hypot(...cb);
  if (la === 0 || lb === 0) return 180;
  const cos = (ca[0] * cb[0] + ca[1] * cb[1] + ca[2] * cb[2]) / (la * lb);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

const SWATCH_RGB = hexToRgb(PAINT_SWATCH);

export function isPaintTexel(texel: Rgb): boolean {
  return saturation(texel) >= PAINT_MIN_SATURATION && hueDistanceDeg(texel, SWATCH_RGB) <= PAINT_HUE_TOLERANCE;
}

/** Texel da carroceria vira `paint` × (luminância do texel / luminância do quadrado), canais limitados a 1; o resto fica. */
export function recolorTexel(texel: Rgb, paint: Rgb): Rgb {
  if (!isPaintTexel(texel)) return texel;
  const k = luminance(texel) / luminance(SWATCH_RGB);
  return [Math.min(1, paint[0] * k), Math.min(1, paint[1] * k), Math.min(1, paint[2] * k)];
}

const f4 = (v: number) => v.toFixed(4);

/**
 * A mesma conta em GLSL, para depois de `#include <map_fragment>`, com a pintura
 * (sRGB) já em `vec3 carPaint`. Só as constantes deste arquivo aparecem como
 * literais com ponto; `vec3( 1 )` e `float( 0 )` são inteiros convertidos.
 */
export const CAR_PAINT_GLSL = `
{
  vec3 srgb = sRGBTransferOETF( vec4( diffuseColor.rgb, 1 ) ).rgb;
  vec3 swatch = vec3( ${f4(SWATCH_RGB[0])}, ${f4(SWATCH_RGB[1])}, ${f4(SWATCH_RGB[2])} );
  vec3 luma = vec3( ${LUMA[0]}, ${LUMA[1]}, ${LUMA[2]} );
  vec3 one = vec3( 1 );
  vec3 ct = srgb - dot( srgb, one ) / dot( one, one );
  vec3 cs = swatch - dot( swatch, one ) / dot( one, one );
  float mx = max( srgb.r, max( srgb.g, srgb.b ) );
  float mn = min( srgb.r, min( srgb.g, srgb.b ) );
  float sat = mx > mn ? ( mx - mn ) / mx : float( 0 );
  float lct = length( ct );
  float cosHue = lct > float( 0 ) ? dot( ct, cs ) / ( lct * length( cs ) ) : float( 0 );
  if ( sat >= ${PAINT_MIN_SATURATION} && cosHue >= ${f4(Math.cos((PAINT_HUE_TOLERANCE * Math.PI) / 180))} ) {
    vec3 painted = min( one, carPaint * ( dot( srgb, luma ) / dot( swatch, luma ) ) );
    diffuseColor.rgb = sRGBTransferEOTF( vec4( painted, 1 ) ).rgb;
  }
}
`;

/** Literais com ponto que o GLSL pode carregar (para a prova de fonte única). */
export const CAR_PAINT_GLSL_LITERALS: number[] = [
  ...SWATCH_RGB.map((v) => Number(f4(v))),
  ...LUMA,
  PAINT_MIN_SATURATION,
  Number(f4(Math.cos((PAINT_HUE_TOLERANCE * Math.PI) / 180))),
];
