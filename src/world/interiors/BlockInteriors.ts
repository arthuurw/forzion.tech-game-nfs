/**
 * Miolo das quadras (door 1 da block-fill, AD-012), função pura
 * `findBlockInteriors(carved, network, lots)` sobre a mesma grade de 4 m do
 * heightmap (AD-010).
 *
 * Um vértice é interior quando está a pelo menos `w/2 + 2 m` do eixo de toda
 * estrada, a pelo menos 1 m do footprint de todo lote, com a altura aplainada
 * em `WATER_Y + 0.5` ou mais e a pelo menos 8 m da borda do mundo (as paredes
 * em ±1536). Os vértices interiores se juntam em zonas por vizinhança de 4;
 * grupos com menos de 25 vértices (400 m²) ficam de fora. A zona é `downtown`
 * quando o centroide cai no quadrado do centro. `facadeDist` guarda a
 * distância horizontal ao footprint de lote mais próximo, limitada a 60 m.
 *
 * `zoneOf[iz * size + ix]` e `facadeDist[iz * size + ix]` seguem o layout do
 * `Heightmap` (linha = z, coluna = x).
 */
import { distanceToLot, type Lot } from '../lots/LotGenerator';
import type { RoadNetwork } from '../roads/RoadGenerator';
import type { Heightmap } from '../terrain/TerrainGenerator';
import { DOWNTOWN_HALF, WATER_Y, WORLD_HALF } from '../worldMath';

/** folga além da meia largura da estrada (m) */
export const ROAD_MARGIN = 2;
/** folga além do footprint do lote (m) */
export const LOT_MARGIN = 1;
/** altura mínima acima da água (m) */
export const WATER_MARGIN = 0.5;
/** distância mínima da borda do mundo (m) */
export const EDGE_MARGIN = 8;
/** menor zona, em vértices (25 × 16 m² = 400 m²) */
export const MIN_ZONE_CELLS = 25;
/** teto de `facadeDist` (m) */
export const FACADE_DIST_MAX = 60;
/** folga de quem anda no miolo além de `LOT_MARGIN` (m): ≥ o raio do corpo do pedestre, 0.22 (smooth-world door 2) */
export const WALK_CLEARANCE = 0.25;

export type ZoneKind = 'downtown' | 'outer';

export interface InteriorZone {
  id: number;
  kind: ZoneKind;
  cells: number;
  areaM2: number;
  centroid: { x: number; z: number };
  bbox: { minX: number; minZ: number; maxX: number; maxZ: number };
}

export interface BlockInteriors {
  /** 4 no jogo (a grade do heightmap) */
  spacing: number;
  /** -1536 no jogo */
  origin: number;
  /** 769 no jogo */
  size: number;
  /** por vértice da grade, −1 = não é interior */
  zoneOf: Int32Array;
  /** m até o footprint de lote mais próximo, limitado a 60 */
  facadeDist: Float32Array;
  zones: InteriorZone[];
}

/** Distância de (px, pz) ao segmento AB no plano xz. */
function segmentDistance(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export function findBlockInteriors(carved: Heightmap, network: RoadNetwork, lots: Lot[]): BlockInteriors {
  const n = carved.size;
  const sp = carved.spacing;
  const o = carved.origin;
  const free = new Uint8Array(n * n);

  // borda do mundo e água
  for (let iz = 0; iz < n; iz++) {
    const z = o + iz * sp;
    for (let ix = 0; ix < n; ix++) {
      const x = o + ix * sp;
      const k = iz * n + ix;
      const edge = WORLD_HALF - Math.max(Math.abs(x), Math.abs(z));
      free[k] = edge >= EDGE_MARGIN && carved.heights[k]! >= WATER_Y + WATER_MARGIN ? 1 : 0;
    }
  }

  const range = (lo: number, hi: number): [number, number] => [
    Math.max(0, Math.ceil((lo - o) / sp)),
    Math.min(n - 1, Math.floor((hi - o) / sp)),
  ];

  // estradas: todo segmento entre pontos consecutivos (fechada volta ao primeiro)
  for (const road of network.roads) {
    const p = road.points;
    const count = p.length / 3;
    const r = road.width / 2 + ROAD_MARGIN;
    const segs = road.closed ? count : count - 1;
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % count;
      const ax = p[i * 3]!;
      const az = p[i * 3 + 2]!;
      const bx = p[j * 3]!;
      const bz = p[j * 3 + 2]!;
      const [ix0, ix1] = range(Math.min(ax, bx) - r, Math.max(ax, bx) + r);
      const [iz0, iz1] = range(Math.min(az, bz) - r, Math.max(az, bz) + r);
      for (let iz = iz0; iz <= iz1; iz++) {
        const z = o + iz * sp;
        for (let ix = ix0; ix <= ix1; ix++) {
          const k = iz * n + ix;
          if (!free[k]) continue;
          if (segmentDistance(o + ix * sp, z, ax, az, bx, bz) < r) free[k] = 0;
        }
      }
    }
  }

  // lotes: footprint + 1 m bloqueia; distância à fachada mais próxima até 60 m
  const facadeDist = new Float32Array(n * n).fill(FACADE_DIST_MAX);
  for (const l of lots) {
    const reach = Math.hypot(l.width, l.depth) / 2 + FACADE_DIST_MAX;
    const [ix0, ix1] = range(l.x - reach, l.x + reach);
    const [iz0, iz1] = range(l.z - reach, l.z + reach);
    for (let iz = iz0; iz <= iz1; iz++) {
      const z = o + iz * sp;
      for (let ix = ix0; ix <= ix1; ix++) {
        const k = iz * n + ix;
        const d = distanceToLot(l, o + ix * sp, z);
        if (d < facadeDist[k]!) facadeDist[k] = d;
        if (d < LOT_MARGIN) free[k] = 0;
      }
    }
  }

  // zonas: busca em largura com vizinhança de 4, na ordem da grade
  const zoneOf = new Int32Array(n * n).fill(-1);
  const seen = new Uint8Array(n * n);
  const zones: InteriorZone[] = [];
  const queue = new Int32Array(n * n);
  for (let start = 0; start < n * n; start++) {
    if (!free[start] || seen[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const k = queue[head++]!;
      const ix = k % n;
      const iz = (k - ix) / n;
      if (ix > 0 && free[k - 1] && !seen[k - 1]) (seen[k - 1] = 1), (queue[tail++] = k - 1);
      if (ix < n - 1 && free[k + 1] && !seen[k + 1]) (seen[k + 1] = 1), (queue[tail++] = k + 1);
      if (iz > 0 && free[k - n] && !seen[k - n]) (seen[k - n] = 1), (queue[tail++] = k - n);
      if (iz < n - 1 && free[k + n] && !seen[k + n]) (seen[k + n] = 1), (queue[tail++] = k + n);
    }
    if (tail < MIN_ZONE_CELLS) continue;
    const id = zones.length;
    let sx = 0;
    let sz = 0;
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (let q = 0; q < tail; q++) {
      const k = queue[q]!;
      zoneOf[k] = id;
      const ix = k % n;
      const x = o + ix * sp;
      const z = o + ((k - ix) / n) * sp;
      sx += x;
      sz += z;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const centroid = { x: sx / tail, z: sz / tail };
    zones.push({
      id,
      kind: Math.abs(centroid.x) <= DOWNTOWN_HALF && Math.abs(centroid.z) <= DOWNTOWN_HALF ? 'downtown' : 'outer',
      cells: tail,
      areaM2: tail * sp * sp,
      centroid,
      bbox: { minX, minZ, maxX, maxZ },
    });
  }

  return { spacing: sp, origin: o, size: n, zoneOf, facadeDist, zones };
}

/** Índice do vértice da grade mais próximo de (x, z), preso à grade. */
export function nearestVertex(bi: Pick<BlockInteriors, 'spacing' | 'origin' | 'size'>, x: number, z: number): number {
  const max = bi.size - 1;
  const ix = Math.min(max, Math.max(0, Math.round((x - bi.origin) / bi.spacing)));
  const iz = Math.min(max, Math.max(0, Math.round((z - bi.origin) / bi.spacing)));
  return iz * bi.size + ix;
}

/** Zona do vértice mais próximo de (x, z), ou −1. */
export function zoneAt(bi: BlockInteriors, x: number, z: number): number {
  return bi.zoneOf[nearestVertex(bi, x, z)]!;
}

/**
 * Chão caminhável (smooth-world door 2, AD-021), para o que se move pelo miolo: verdadeiro só se
 * os 4 vértices da célula de 4 m que contém (x, z) (floor, não o vértice mais perto) são da zona
 * `zoneId` e a `facadeDist` interpolada (bilinear) no ponto é ≥ `LOT_MARGIN + WALK_CLEARANCE`.
 * Fora da grade é falso. O conteúdo parado continua com `zoneAt`.
 */
export function walkable(bi: BlockInteriors, zoneId: number, x: number, z: number): boolean {
  if (zoneId < 0) return false;
  const n = bi.size;
  const fx = (x - bi.origin) / bi.spacing;
  const fz = (z - bi.origin) / bi.spacing;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  if (!(ix >= 0 && iz >= 0 && ix < n - 1 && iz < n - 1)) return false;
  const k = iz * n + ix;
  const zo = bi.zoneOf;
  if (zo[k] !== zoneId || zo[k + 1] !== zoneId || zo[k + n] !== zoneId || zo[k + n + 1] !== zoneId) return false;
  const tx = fx - ix;
  const tz = fz - iz;
  const f = bi.facadeDist;
  const d = (f[k]! * (1 - tx) + f[k + 1]! * tx) * (1 - tz) + (f[k + n]! * (1 - tx) + f[k + n + 1]! * tx) * tz;
  return d >= LOT_MARGIN + WALK_CLEARANCE;
}
