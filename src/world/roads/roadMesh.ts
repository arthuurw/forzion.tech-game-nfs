/**
 * Geometria de estrada sem three (city-terrain): a fita do asfalto e os
 * postes ao longo das estradas. `ChunkManager` e `CityScene` só copiam estes
 * arrays para `BufferGeometry` / `InstancedMesh`.
 *
 * Fita: por ponto, 2 vértices a ±width/2 do eixo, perpendiculares ao heading
 * do ponto (diferença central), 5 cm acima da estrada; com `bank`, a borda
 * esquerda sobe e a direita desce esse tanto (ponta da avenida no anel). `u` vai de 0 a
 * width/4 de borda a borda e `v` cresce 0.5 por ponto: 1 tile a cada 4 m nos
 * dois sentidos. O atributo `width` por vértice deixa o shader desenhar as
 * faixas em metros (u·4 atravessando, v·4 ao longo).
 */
import { DOWNTOWN_HALF } from '../worldMath';
import { ROAD_STEP, type Road, type RoadNetwork } from './RoadGenerator';

export const ROAD_LIFT = 0.05;
export const TILE_M = 4;
export const LAMP_SPACING = 40;
export const LAMP_SIDE_OFFSET = 1.5;
/** um poste a até width/2 + 1 m do eixo de outra estrada fica no meio da pista: pulado */
export const LAMP_CLEARANCE = 1;
/** altura da haste do poste (m) */
export const LAMP_POST_HEIGHT = 6;
/** braço horizontal do poste, da haste até a luminária sobre a rua (night-city AC 1) */
export const LAMP_ARM_M = 1.6;
/** luz de LED: centro, avenidas e anel (night-city door 1) */
export const LAMP_LED = '#dce6ff';
/** luz de sódio: bairros e morros fora do centro (night-city door 1) */
export const LAMP_SODIUM = '#ff9d4a';

/** Heading no ponto i por diferença central (nas pontas de estrada aberta, a diferença de um lado). */
export function pointHeading(road: Road, i: number): number {
  const p = road.points;
  const n = p.length / 3;
  let a = i - 1;
  let b = i + 1;
  if (road.closed) {
    a = (a + n) % n;
    b = b % n;
  } else {
    a = Math.max(0, a);
    b = Math.min(n - 1, b);
  }
  return Math.atan2(p[b * 3]! - p[a * 3]!, p[b * 3 + 2]! - p[a * 3 + 2]!);
}

export interface StripGeometry {
  positions: Float32Array;
  uvs: Float32Array;
  widths: Float32Array;
  indices: Uint32Array;
}

/**
 * Fita dos pontos `from..to` (inclusivos). Numa estrada fechada, `to` pode ser
 * n (o primeiro ponto repetido, com `v` contínuo) para fechar o laço.
 */
export function roadStripGeometry(road: Road, from = 0, to = road.points.length / 3 - 1): StripGeometry {
  const p = road.points;
  const n = p.length / 3;
  const count = to - from + 1;
  const positions = new Float32Array(count * 6);
  const uvs = new Float32Array(count * 4);
  const widths = new Float32Array(count * 2).fill(road.width);
  const w2 = road.width / 2;
  for (let k = 0; k < count; k++) {
    const i = (from + k) % n;
    const h = pointHeading(road, i);
    // esquerda do heading (sin h, cos h) no plano xz: (cos h, −sin h)
    const lx = Math.cos(h);
    const lz = -Math.sin(h);
    const x = p[i * 3]!;
    const y = p[i * 3 + 1]! + ROAD_LIFT;
    const z = p[i * 3 + 2]!;
    const b = road.bank?.[i] ?? 0;
    positions.set([x + lx * w2, y + b, z + lz * w2, x - lx * w2, y - b, z - lz * w2], k * 6);
    const v = ((from + k) * ROAD_STEP) / TILE_M;
    uvs.set([0, v, road.width / TILE_M, v], k * 4);
  }
  const indices = new Uint32Array(Math.max(0, count - 1) * 6);
  // anti-horário visto de cima: a normal aponta para +y (a esquerda é o vértice par)
  for (let k = 0; k < count - 1; k++) {
    const a = k * 2;
    indices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], k * 6);
  }
  return { positions, uvs, widths, indices };
}

export interface Lamp {
  x: number;
  y: number;
  z: number;
  roadId: number;
  /** +1 à esquerda do heading, −1 à direita */
  side: 1 | -1;
  /** trecho contínuo fora de ponte (índice na ordem da estrada) */
  stretch: number;
  /** distância ao longo do trecho (m) */
  along: number;
  /** heading da estrada no ponto do poste (rad, 0 = +Z, AD-007) */
  heading: number;
}

/**
 * Ponta do braço, onde fica a lente (night-city AC 1): 6 m acima da base e 1.6 m na
 * direção do eixo da estrada. O poste do lado `side` fica a `(cos h, −sin h)·side` do eixo,
 * então o braço aponta para `−side·(cos h, −sin h)`.
 */
export function lampHeadPosition(lamp: Lamp): { x: number; y: number; z: number } {
  return {
    x: lamp.x - lamp.side * Math.cos(lamp.heading) * LAMP_ARM_M,
    y: lamp.y + LAMP_POST_HEIGHT,
    z: lamp.z + lamp.side * Math.sin(lamp.heading) * LAMP_ARM_M,
  };
}

/** Cor da luz do poste por bairro (night-city door 1): LED no centro, nas avenidas e no anel; sódio no resto. */
export function lampColor(lamp: Pick<Lamp, 'x' | 'z'>, road: Pick<Road, 'kind'>): string {
  const downtown = Math.abs(lamp.x) <= DOWNTOWN_HALF && Math.abs(lamp.z) <= DOWNTOWN_HALF;
  return downtown || road.kind === 'avenue' || road.kind === 'highway' ? LAMP_LED : LAMP_SODIUM;
}

/** Trechos contínuos fora de ponte, como listas de índices de ponto na ordem da estrada. */
export function nonBridgeStretches(road: Road): number[][] {
  const n = road.points.length / 3;
  const bridge = new Uint8Array(n);
  for (const b of road.bridges) for (let i = b.from; i <= b.to; i++) bridge[i % n] = 1;
  if (road.closed && road.bridges.length === 0) {
    // laço inteiro: repete o primeiro ponto no fim para contar o último segmento
    return [[...Array.from({ length: n }, (_, i) => i), 0]];
  }
  // numa estrada fechada, começa logo depois de uma ponte para nenhum trecho cruzar a costura
  const start = road.closed ? (road.bridges[0]!.to + 1) % n : 0;
  const stretches: number[][] = [];
  let cur: number[] = [];
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (bridge[i]) {
      if (cur.length) stretches.push(cur);
      cur = [];
    } else cur.push(i);
  }
  if (cur.length) stretches.push(cur);
  return stretches;
}

function nearOtherRoad(network: RoadNetwork, self: Road, x: number, z: number): boolean {
  for (const other of network.roads) {
    if (other === self) continue;
    const r = other.width / 2 + LAMP_CLEARANCE;
    const p = other.points;
    for (let i = 0; i < p.length; i += 3) {
      const dx = p[i]! - x;
      const dz = p[i + 2]! - z;
      if (dx * dx + dz * dz <= r * r) return true;
    }
  }
  return false;
}

/** Postes nos dois lados de toda estrada, a cada 40 m, fora das pontes (door 5, AC 19). */
export function generateLamps(network: RoadNetwork): { lamps: Lamp[]; skipped: Lamp[] } {
  const lamps: Lamp[] = [];
  const skipped: Lamp[] = [];
  for (const road of network.roads) {
    const p = road.points;
    nonBridgeStretches(road).forEach((idx, stretch) => {
      const length = (idx.length - 1) * ROAD_STEP;
      const count = Math.floor(length / LAMP_SPACING);
      for (let k = 0; k < count; k++) {
        const along = LAMP_SPACING / 2 + k * LAMP_SPACING;
        const f = along / ROAD_STEP;
        const j = Math.min(idx.length - 2, Math.floor(f));
        const t = f - j;
        const a = idx[j]!;
        const b = idx[j + 1]!;
        const x = p[a * 3]! + (p[b * 3]! - p[a * 3]!) * t;
        const y = p[a * 3 + 1]! + (p[b * 3 + 1]! - p[a * 3 + 1]!) * t;
        const z = p[a * 3 + 2]! + (p[b * 3 + 2]! - p[a * 3 + 2]!) * t;
        const h = Math.atan2(p[b * 3]! - p[a * 3]!, p[b * 3 + 2]! - p[a * 3 + 2]!);
        const off = road.width / 2 + LAMP_SIDE_OFFSET;
        for (const side of [1, -1] as const) {
          const lamp: Lamp = {
            x: x + Math.cos(h) * off * side,
            y,
            z: z - Math.sin(h) * off * side,
            roadId: road.id,
            side,
            stretch,
            along,
            heading: h,
          };
          (nearOtherRoad(network, road, lamp.x, lamp.z) ? skipped : lamps).push(lamp);
        }
      }
    });
  }
  return { lamps, skipped };
}
