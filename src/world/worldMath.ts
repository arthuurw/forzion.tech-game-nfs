/**
 * Geometria compartilhada do mundo da city-terrain (módulo puro): traçado da
 * rodovia em anel e das avenidas (o gerador de terreno aplaina um corredor ao
 * longo deles e o gerador de estradas desenha as estradas em cima), e as
 * regras de reset na água (door 9).
 *
 * Heading segue o `Car`: frente = (sin h, cos h) no plano xz.
 */
import { mulberry32 } from './CityGenerator';
import type { Road, RoadNetwork } from './roads/RoadGenerator';

export const WORLD_HALF = 1536;
export const DOWNTOWN_HALF = 500;
export const WATER_Y = -2;
export const WATER_RESET_Y = -1.5;

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Raio da rodovia em anel no ângulo `theta` (rad, atan2(z, x)): entre 920 e 1080 m. */
export function ringRadius(theta: number, seed: number): number {
  const r = mulberry32(seed ^ 0x51ed27);
  const p1 = r() * Math.PI * 2;
  const p2 = r() * Math.PI * 2;
  const p3 = r() * Math.PI * 2;
  return 1000 + 40 * Math.sin(2 * theta + p1) + 25 * Math.sin(3 * theta + p2) + 15 * Math.sin(5 * theta + p3);
}

/** Avenidas: 3 ao longo de x e 3 ao longo de z, levemente sinuosas. */
export interface AvenueLine {
  /** eixo ao longo do qual a avenida corre */
  axis: 'x' | 'z';
  /** coordenada lateral base (z para avenidas ao longo de x) */
  at: number;
  amp: number;
  wavelength: number;
  phase: number;
}

export function avenueLines(seed: number): AvenueLine[] {
  const r = mulberry32(seed ^ 0xa5e11e);
  const lines: AvenueLine[] = [];
  for (const axis of ['x', 'z'] as const) {
    for (const at of [-300, 0, 300]) {
      lines.push({ axis, at, amp: 14 + r() * 8, wavelength: 900 + r() * 400, phase: r() * Math.PI * 2 });
    }
  }
  return lines;
}

/** Ponto (x, z) da avenida na coordenada `s` ao longo do eixo. */
export function avenuePoint(line: AvenueLine, s: number): [number, number] {
  const lateral = line.at + line.amp * Math.sin((2 * Math.PI * s) / line.wavelength + line.phase);
  return line.axis === 'x' ? [s, lateral] : [lateral, s];
}

/** `s` onde a avenida encontra o anel, indo do centro para `dir` (+1 ou -1). */
export function avenueEnd(line: AvenueLine, dir: 1 | -1, seed: number): number {
  let s = 0;
  for (;;) {
    const [x, z] = avenuePoint(line, s + dir);
    if (Math.hypot(x, z) >= ringRadius(Math.atan2(z, x), seed)) return s;
    s += dir;
  }
}

/** Reset na água (door 9): o centro do chassi abaixo de -1.5 m. */
export function needsWaterReset(y: number): boolean {
  return y < WATER_RESET_Y;
}

/** Heading da estrada no ponto `i` (do ponto i para o seguinte; no fim de uma estrada aberta, do anterior para ele). */
export function roadHeading(road: Road, i: number): number {
  const n = road.points.length / 3;
  let a = i;
  let b = i + 1;
  if (b >= n) {
    if (road.closed) b = 0;
    else {
      a = i - 1;
      b = i;
    }
  }
  const p = road.points;
  return Math.atan2(p[b * 3]! - p[a * 3]!, p[b * 3 + 2]! - p[a * 3 + 2]!);
}

export interface RoadPointRef {
  road: Road;
  index: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  distance: number;
}

/** Ponto de estrada de menor distância horizontal a (x, z). */
export function nearestRoadPoint(network: RoadNetwork, x: number, z: number): RoadPointRef {
  let best: RoadPointRef | null = null;
  let bestD2 = Infinity;
  for (const road of network.roads) {
    const p = road.points;
    for (let i = 0; i < p.length; i += 3) {
      const dx = p[i]! - x;
      const dz = p[i + 2]! - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = { road, index: i / 3, x: p[i]!, y: p[i + 1]!, z: p[i + 2]!, heading: 0, distance: 0 };
      }
    }
  }
  if (!best) throw new Error('road network is empty');
  best.heading = roadHeading(best.road, best.index);
  best.distance = Math.sqrt(bestD2);
  return best;
}
