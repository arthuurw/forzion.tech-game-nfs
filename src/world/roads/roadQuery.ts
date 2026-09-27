/**
 * Perguntas puras sobre a `RoadNetwork` que mais de uma feature faz (as
 * corridas e a linha do trem): ponto de uma estrada, avenida por eixo e
 * lateral, cruzamento de duas estradas.
 */
import type { Road, RoadNetwork } from './RoadGenerator';

export type Pt = [number, number, number];

export function pointOf(road: Road, i: number): Pt {
  const p = road.points;
  return [p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!];
}

export function count(road: Road): number {
  return road.points.length / 3;
}

/** Eixo e coordenada lateral média de uma avenida (ao longo de x: lateral = z médio). */
export function avenueAxis(road: Road): { axis: 'x' | 'z'; lateral: number } {
  const n = count(road);
  const [x0, , z0] = pointOf(road, 0);
  const [x1, , z1] = pointOf(road, n - 1);
  const axis = Math.abs(x1 - x0) >= Math.abs(z1 - z0) ? 'x' : 'z';
  let sum = 0;
  for (let i = 0; i < n; i++) sum += road.points[i * 3 + (axis === 'x' ? 2 : 0)]!;
  return { axis, lateral: sum / n };
}

/** A avenida ao longo de `axis` com lateral média mais perto de `lateral`, a no máximo 60 m. */
export function findAvenue(network: RoadNetwork, axis: 'x' | 'z', lateral: number): Road | null {
  let best: Road | null = null;
  let bestD = 60;
  for (const road of network.roads) {
    if (road.kind !== 'avenue') continue;
    const a = avenueAxis(road);
    if (a.axis !== axis) continue;
    const d = Math.abs(a.lateral - lateral);
    if (d < bestD) {
      bestD = d;
      best = road;
    }
  }
  return best;
}

/** Par de índices (i em a, j em b) de menor distância horizontal: o cruzamento das duas estradas. */
export function crossing(a: Road, b: Road): { i: number; j: number; d: number } {
  let best = { i: 0, j: 0, d: Infinity };
  const na = count(a);
  const nb = count(b);
  for (let i = 0; i < na; i++) {
    const ax = a.points[i * 3]!;
    const az = a.points[i * 3 + 2]!;
    for (let j = 0; j < nb; j++) {
      const d = (b.points[j * 3]! - ax) ** 2 + (b.points[j * 3 + 2]! - az) ** 2;
      if (d < best.d) best = { i, j, d };
    }
  }
  return { ...best, d: Math.sqrt(best.d) };
}
