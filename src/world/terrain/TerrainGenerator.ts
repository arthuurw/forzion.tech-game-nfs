/**
 * Terreno da city-terrain (doors 1 e 3): função pura `generateTerrain(seed)`
 * que devolve um `Heightmap` de 769 × 769 alturas a cada 4 m cobrindo
 * x, z em [-1536, 1536].
 *
 * Camadas, na ordem: morros por fbm (zero no quadrado do centro, mais altos
 * ao norte e a leste), corredores suaves sob o traçado da rodovia e das
 * avenidas (o terreno já nasce com rampas de estrada), a escala que leva o
 * pico a 95 m, e por fim o vale do rio (de norte a sul, a leste do centro)
 * e a baía na borda sul. Os morros são largos (rampa de ~900 m até o
 * nordeste) para as estradas de morro acharem encostas de até ~15 % de lado.
 *
 * `heights[iz * size + ix]` é a altura em (origin + ix·spacing, origin + iz·spacing).
 */
import { mulberry32 } from '../CityGenerator';
import { fbm } from './noise';
import {
  DOWNTOWN_HALF,
  WORLD_HALF,
  avenueEnd,
  avenueLines,
  avenuePoint,
  clamp01,
  ringRadius,
  smoothstep,
} from '../worldMath';

export const HM_SIZE = 769;
export const HM_SPACING = 4;
export const HM_ORIGIN = -WORLD_HALF;
export const PEAK_HEIGHT = 95;
export const RIVER_BED_Y = -6;
export const BAY_Y = -8;
export const BAY_START_Z = 1100;
export const BAY_FULL_Z = 1300;
/** meia largura do leito e fim da margem do rio (m) */
const RIVER_BED_HALF = 28;
const RIVER_BANK = 90;
/** corredor sob rodovia e avenidas: largura plena e fim da mistura (m) */
const CORRIDOR_FULL = 24;
const CORRIDOR_END = 140;
const CORRIDOR_STEP = 8;
const CORRIDOR_WINDOW = 300;
const CORRIDOR_GRADE = 0.06;

export interface Heightmap {
  size: number;
  spacing: number;
  origin: number;
  heights: Float32Array;
}

export function sampleXZ(hm: Heightmap, ix: number, iz: number): [number, number] {
  return [hm.origin + ix * hm.spacing, hm.origin + iz * hm.spacing];
}

/** Altura bilinear em (x, z), com as coordenadas presas às bordas do mapa. */
export function heightAt(hm: Heightmap, x: number, z: number): number {
  const max = hm.size - 1;
  const fx = Math.min(max, Math.max(0, (x - hm.origin) / hm.spacing));
  const fz = Math.min(max, Math.max(0, (z - hm.origin) / hm.spacing));
  const ix = Math.min(max - 1, Math.floor(fx));
  const iz = Math.min(max - 1, Math.floor(fz));
  const tx = fx - ix;
  const tz = fz - iz;
  const h = hm.heights;
  const a = h[iz * hm.size + ix]!;
  const b = h[iz * hm.size + ix + 1]!;
  const c = h[(iz + 1) * hm.size + ix]!;
  const d = h[(iz + 1) * hm.size + ix + 1]!;
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}

/** Centro do rio em x para cada z: sempre entre 630 e 870 (a leste do centro). */
export function riverCenterX(z: number, seed = 1337): number {
  const r = mulberry32(seed ^ 0x7e1a);
  const p = r() * Math.PI * 2;
  const q = r() * Math.PI * 2;
  return 750 + 80 * Math.sin(z / 380 + p) + 40 * Math.sin(z / 150 + q);
}

/** Polilinhas dos corredores (rodovia fechada + trechos de avenida fora do centro), pontos a cada ~8 m. */
function corridorPolylines(seed: number): { pts: number[]; closed: boolean }[] {
  const lines: { pts: number[]; closed: boolean }[] = [];
  const ring: number[] = [];
  const steps = Math.round((2 * Math.PI * 1000) / CORRIDOR_STEP);
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = ringRadius(t, seed);
    ring.push(Math.cos(t) * r, Math.sin(t) * r);
  }
  lines.push({ pts: ring, closed: true });
  for (const line of avenueLines(seed)) {
    for (const dir of [1, -1] as const) {
      const end = avenueEnd(line, dir, seed);
      const pts: number[] = [];
      // da borda do quadrado do centro até o anel
      for (let s = dir * (DOWNTOWN_HALF - 40); dir * s <= dir * end; s += dir * CORRIDOR_STEP) {
        pts.push(...avenuePoint(line, s));
      }
      lines.push({ pts, closed: false });
    }
  }
  return lines;
}

export function movingAverage(values: ArrayLike<number>, half: number, closed: boolean): number[] {
  const n = values.length;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let k = -half; k <= half; k++) {
      let j = i + k;
      if (closed) j = (((j % n) + n) % n);
      else if (j < 0 || j >= n) continue;
      sum += values[j]!;
      count++;
    }
    out[i] = sum / count;
  }
  return out;
}

/** Limita |Δy| a `maxStep` entre vizinhos, com passes nos dois sentidos. */
export function limitGrade(values: number[], maxStep: number, closed: boolean): void {
  const n = values.length;
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 1; i < n + (closed ? 1 : 0); i++) {
      const prev = values[(i - 1) % n]!;
      const k = i % n;
      values[k] = Math.min(prev + maxStep, Math.max(prev - maxStep, values[k]!));
    }
    for (let i = n - 2; i >= (closed ? -1 : 0); i--) {
      const next = values[(i + 1 + n) % n]!;
      const k = (i + n) % n;
      values[k] = Math.min(next + maxStep, Math.max(next - maxStep, values[k]!));
    }
  }
}

export function generateTerrain(seed = 1337): Heightmap {
  const size = HM_SIZE;
  const heights = new Float32Array(size * size);
  const hm: Heightmap = { size, spacing: HM_SPACING, origin: HM_ORIGIN, heights };

  // 1. morros: zero no centro, rampa convexa até a borda (mais relevo fora do anel), mais altos a nordeste
  for (let iz = 0; iz < size; iz++) {
    for (let ix = 0; ix < size; ix++) {
      const [x, z] = sampleXZ(hm, ix, iz);
      const dc = Math.max(Math.abs(x), Math.abs(z));
      if (dc <= DOWNTOWN_HALF) continue;
      const m = Math.pow(smoothstep(DOWNTOWN_HALF, WORLD_HALF, dc), 1.6);
      const bias = 0.25 + 0.75 * clamp01(0.5 + (x - z) / 3000);
      const n = fbm(x / 1100, z / 1100, seed, 2);
      heights[iz * size + ix] = m * bias * (0.45 + 0.55 * n);
    }
  }

  // 2. corredores: perfil suave (média de 300 m, rampa ≤ 6 %) misturado até 140 m do traçado
  const cell = 64;
  const cells = Math.ceil((2 * WORLD_HALF) / cell) + 1;
  const buckets = new Map<number, number[]>(); // chave -> [x, z, h, ...]
  for (const line of corridorPolylines(seed)) {
    const n = line.pts.length / 2;
    const raw: number[] = [];
    for (let i = 0; i < n; i++) raw.push(heightAt(hm, line.pts[i * 2]!, line.pts[i * 2 + 1]!));
    const prof = movingAverage(raw, Math.round(CORRIDOR_WINDOW / 2 / CORRIDOR_STEP), line.closed);
    limitGrade(prof, CORRIDOR_GRADE * CORRIDOR_STEP, line.closed);
    for (let i = 0; i < n; i++) {
      const x = line.pts[i * 2]!;
      const z = line.pts[i * 2 + 1]!;
      const key = Math.floor((x + WORLD_HALF) / cell) * cells + Math.floor((z + WORLD_HALF) / cell);
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = []));
      b.push(x, z, prof[i]!);
    }
  }
  const reach = Math.ceil(CORRIDOR_END / cell);
  for (let iz = 0; iz < size; iz++) {
    for (let ix = 0; ix < size; ix++) {
      const [x, z] = sampleXZ(hm, ix, iz);
      if (Math.max(Math.abs(x), Math.abs(z)) <= DOWNTOWN_HALF) continue;
      const cx = Math.floor((x + WORLD_HALF) / cell);
      const cz = Math.floor((z + WORLD_HALF) / cell);
      // altura do corredor = média ponderada (gaussiana de 60 m) dos pontos por perto:
      // contínua mesmo onde dois corredores se encontram com alturas diferentes
      let best = Infinity;
      let sumW = 0;
      let sumH = 0;
      for (let a = cx - reach; a <= cx + reach; a++) {
        for (let c = cz - reach; c <= cz + reach; c++) {
          const b = buckets.get(a * cells + c);
          if (!b) continue;
          for (let k = 0; k < b.length; k += 3) {
            const d2 = (b[k]! - x) ** 2 + (b[k + 1]! - z) ** 2;
            if (d2 > CORRIDOR_END * CORRIDOR_END) continue;
            best = Math.min(best, d2);
            const wk = Math.exp(-d2 / (60 * 60));
            sumW += wk;
            sumH += wk * b[k + 2]!;
          }
        }
      }
      if (best === Infinity || sumW === 0) continue;
      const w = 1 - smoothstep(CORRIDOR_FULL, CORRIDOR_END, Math.sqrt(best));
      const i = iz * size + ix;
      heights[i] = heights[i]! + (sumH / sumW - heights[i]!) * w;
    }
  }

  // 3. escala: o pico vai a 95 m (o centro continua 0)
  let max = 0;
  for (let i = 0; i < heights.length; i++) max = Math.max(max, heights[i]!);
  const scale = max > 0 ? PEAK_HEIGHT / max : 0;
  for (let i = 0; i < heights.length; i++) heights[i] = heights[i]! * scale;

  // 4. rio e baía
  for (let iz = 0; iz < size; iz++) {
    const z = HM_ORIGIN + iz * HM_SPACING;
    const rx = riverCenterX(z, seed);
    const bay = smoothstep(BAY_START_Z, BAY_FULL_Z, z);
    for (let ix = 0; ix < size; ix++) {
      const x = HM_ORIGIN + ix * HM_SPACING;
      const i = iz * size + ix;
      let h = heights[i]!;
      const river = smoothstep(RIVER_BED_HALF, RIVER_BANK, Math.abs(x - rx));
      h = RIVER_BED_Y + (h - RIVER_BED_Y) * river;
      h = h + (BAY_Y - h) * bay;
      heights[i] = h;
    }
  }
  return hm;
}
