/**
 * Prédios e letreiros ao longo das ruas da city-terrain (door 3), função pura
 * `generateLots(seed, roads, heightmap)` sobre o terreno já aplainado.
 *
 * Anda por avenidas, ruas e estradas de morro (a rodovia fica livre), dos dois
 * lados, e tenta um lote a cada passo: torres de 30-90 m no quadrado do centro,
 * casas de 6-18 m fora dele. O lote fica virado para a rua (rotação = heading
 * da estrada), recuado 3 m da borda, e é descartado se chegar a menos de 2 m
 * de qualquer estrada ou ponte, se encostar em outro lote, ou se ficar perto
 * do rio ou da baía. A base fica na menor altura entre os 4 cantos e o
 * centro, então o prédio entra no chão do lado mais alto.
 */
import { NEON_PALETTE, mulberry32, type NeonColor } from '../CityGenerator';
import { heightAt, riverCenterX, type Heightmap } from '../terrain/TerrainGenerator';
import { ROAD_STEP, type RoadNetwork } from '../roads/RoadGenerator';
import { DOWNTOWN_HALF } from '../worldMath';

export const LOT_SETBACK = 3;
export const LOT_CLEARANCE = 2;
/** margem extra da checagem de folga (os pontos de estrada estão a cada 2 m) */
const CLEARANCE_MARGIN = 0.5;
const RIVER_KEEP_OUT = 95;
const BAY_KEEP_OUT_Z = 1080;
const WORLD_KEEP = 1480;

export interface Lot {
  x: number;
  z: number;
  /** base (m): menor altura do terreno sob o prédio */
  y: number;
  /** ao longo da rua */
  width: number;
  /** para dentro do lote */
  depth: number;
  height: number;
  /** rotação em Y (rad): o heading da estrada no ponto do lote */
  rotation: number;
  facadeType: number;
  downtown: boolean;
  roadId: number;
  side: 1 | -1;
}

export interface LotSign {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotationY: number;
  color: NeonColor;
  lot: number;
}

export function isDowntown(x: number, z: number): boolean {
  return Math.max(Math.abs(x), Math.abs(z)) <= DOWNTOWN_HALF;
}

/** Cantos (x, z) do retângulo orientado de um lote. */
export function lotCorners(l: Pick<Lot, 'x' | 'z' | 'width' | 'depth' | 'rotation'>): Array<[number, number]> {
  const fx = Math.sin(l.rotation);
  const fz = Math.cos(l.rotation);
  const lx = Math.cos(l.rotation);
  const lz = -Math.sin(l.rotation);
  const out: Array<[number, number]> = [];
  for (const [a, b] of [[1, 1], [1, -1], [-1, -1], [-1, 1]] as const) {
    out.push([l.x + fx * (a * l.width) / 2 + lx * (b * l.depth) / 2, l.z + fz * (a * l.width) / 2 + lz * (b * l.depth) / 2]);
  }
  return out;
}

/** Distância horizontal de (x, z) ao retângulo orientado do lote (0 dentro). */
export function distanceToLot(l: Pick<Lot, 'x' | 'z' | 'width' | 'depth' | 'rotation'>, x: number, z: number): number {
  const dx = x - l.x;
  const dz = z - l.z;
  // eixo ao longo da rua (frente) e eixo lateral (esquerda)
  const u = dx * Math.sin(l.rotation) + dz * Math.cos(l.rotation);
  const v = dx * Math.cos(l.rotation) - dz * Math.sin(l.rotation);
  const ou = Math.max(0, Math.abs(u) - l.width / 2);
  const ov = Math.max(0, Math.abs(v) - l.depth / 2);
  return Math.hypot(ou, ov);
}

function overlaps(a: Lot, b: Lot): boolean {
  // eixos separadores dos dois retângulos
  const ca = lotCorners(a);
  const cb = lotCorners(b);
  for (const r of [a.rotation, b.rotation]) {
    for (const [ax, az] of [
      [Math.sin(r), Math.cos(r)],
      [Math.cos(r), -Math.sin(r)],
    ] as const) {
      let minA = Infinity;
      let maxA = -Infinity;
      let minB = Infinity;
      let maxB = -Infinity;
      for (const [x, z] of ca) {
        const d = x * ax + z * az;
        minA = Math.min(minA, d);
        maxA = Math.max(maxA, d);
      }
      for (const [x, z] of cb) {
        const d = x * ax + z * az;
        minB = Math.min(minB, d);
        maxB = Math.max(maxB, d);
      }
      if (maxA + 1 < minB || maxB + 1 < minA) return false;
    }
  }
  return true;
}

export function generateLots(seed: number, network: RoadNetwork, hm: Heightmap): { lots: Lot[]; signs: LotSign[] } {
  const rng = mulberry32(seed ^ 0x10757);
  const facadeRng = mulberry32(seed ^ 0x5bd1e995);
  // grade dos pontos de todas as estradas (pontes incluídas) para a checagem de folga
  const cell = 32;
  const grid = new Map<number, number[]>();
  const key = (x: number, z: number) => Math.floor((x + 2048) / cell) * 1024 + Math.floor((z + 2048) / cell);
  for (const road of network.roads) {
    const p = road.points;
    for (let i = 0; i < p.length; i += 3) {
      const k = key(p[i]!, p[i + 2]!);
      let c = grid.get(k);
      if (!c) grid.set(k, (c = []));
      c.push(p[i]!, p[i + 2]!, road.width / 2, road.id);
    }
  }
  const clearOfRoads = (l: Lot): boolean => {
    const reach = Math.hypot(l.width, l.depth) / 2 + 12 + LOT_CLEARANCE + CLEARANCE_MARGIN;
    const c0x = Math.floor((l.x - reach + 2048) / cell);
    const c1x = Math.floor((l.x + reach + 2048) / cell);
    const c0z = Math.floor((l.z - reach + 2048) / cell);
    const c1z = Math.floor((l.z + reach + 2048) / cell);
    for (let a = c0x; a <= c1x; a++) {
      for (let b = c0z; b <= c1z; b++) {
        const c = grid.get(a * 1024 + b);
        if (!c) continue;
        for (let i = 0; i < c.length; i += 4) {
          if (distanceToLot(l, c[i]!, c[i + 1]!) < c[i + 2]! + LOT_CLEARANCE + CLEARANCE_MARGIN) return false;
        }
      }
    }
    return true;
  };
  /** o ponto de estrada mais próximo do centro do lote é da própria rua (lote de esquina fica de fora) */
  const facesOwnRoad = (l: Lot): boolean => {
    let best = Infinity;
    let owner = -1;
    const cx = Math.floor((l.x + 2048) / cell);
    const cz = Math.floor((l.z + 2048) / cell);
    for (let a = cx - 3; a <= cx + 3; a++) {
      for (let b = cz - 3; b <= cz + 3; b++) {
        const c = grid.get(a * 1024 + b);
        if (!c) continue;
        for (let i = 0; i < c.length; i += 4) {
          const d = (c[i]! - l.x) ** 2 + (c[i + 1]! - l.z) ** 2;
          if (d < best) {
            best = d;
            owner = c[i + 3]!;
          }
        }
      }
    }
    return owner === l.roadId;
  };
  const dry = (l: Lot): boolean => {
    for (const [x, z] of [...lotCorners(l), [l.x, l.z] as [number, number]]) {
      if (Math.abs(x) > WORLD_KEEP || Math.abs(z) > WORLD_KEEP) return false;
      if (z > BAY_KEEP_OUT_Z) return false;
      if (Math.abs(x - riverCenterX(z, seed)) < RIVER_KEEP_OUT) return false;
    }
    return true;
  };

  const lots: Lot[] = [];
  const lotGrid = new Map<number, number[]>();
  const signs: LotSign[] = [];
  for (const road of network.roads) {
    if (road.kind === 'highway') continue;
    const p = road.points;
    const n = p.length / 3;
    const bridge = new Uint8Array(n);
    for (const b of road.bridges) for (let i = Math.max(0, b.from - 10); i <= Math.min(n - 1, b.to + 10); i++) bridge[i] = 1;
    for (const side of [1, -1] as const) {
      let i = 2;
      while (i < n - 2) {
        const x0 = p[i * 3]!;
        const z0 = p[i * 3 + 2]!;
        const downtown = isDowntown(x0, z0);
        const step = downtown ? 34 : 20;
        if (bridge[i]) {
          i += 1;
          continue;
        }
        const heading = Math.atan2(p[(i + 1) * 3]! - p[(i - 1) * 3]!, p[(i + 1) * 3 + 2]! - p[(i - 1) * 3 + 2]!);
        const width = downtown ? 18 + rng() * 12 : 9 + rng() * 5;
        const depth = downtown ? 16 + rng() * 12 : 8 + rng() * 4;
        const off = road.width / 2 + LOT_SETBACK + depth / 2;
        const lx = Math.cos(heading) * side;
        const lz = -Math.sin(heading) * side;
        const lot: Lot = {
          x: x0 + lx * off,
          z: z0 + lz * off,
          y: 0,
          width,
          depth,
          height: 0,
          rotation: heading,
          facadeType: 0,
          downtown: false,
          roadId: road.id,
          side,
        };
        lot.downtown = isDowntown(lot.x, lot.z);
        lot.height = lot.downtown ? 30 + rng() * 60 : 6 + rng() * 12;
        i += Math.round(step / ROAD_STEP);
        if (!dry(lot) || !clearOfRoads(lot) || !facesOwnRoad(lot)) continue;
        const gk = key(lot.x, lot.z);
        let hit = false;
        for (let a = -2; a <= 2 && !hit; a++) {
          for (let b = -2; b <= 2 && !hit; b++) {
            for (const j of lotGrid.get(gk + a * 1024 + b) ?? []) if (overlaps(lots[j]!, lot)) hit = true;
          }
        }
        if (hit) continue;
        let base = heightAt(hm, lot.x, lot.z);
        for (const [cx, cz] of lotCorners(lot)) base = Math.min(base, heightAt(hm, cx, cz));
        lot.y = base;
        lot.facadeType = Math.floor(facadeRng() * 4);
        let bucket = lotGrid.get(gk);
        if (!bucket) lotGrid.set(gk, (bucket = []));
        bucket.push(lots.length);
        lots.push(lot);
        if (lot.downtown && rng() < 0.7) {
          // letreiro na fachada virada para a rua, a 40 % da altura (no máximo 14 m)
          const w = 4 + rng() * 5;
          const h = 1.2 + rng() * 1.6;
          const toRoad = lot.depth / 2 + 0.3;
          signs.push({
            x: lot.x - lx * toRoad,
            y: lot.y + Math.min(lot.height * 0.4, 14),
            z: lot.z - lz * toRoad,
            width: w,
            height: h,
            rotationY: heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2),
            color: NEON_PALETTE[Math.floor(rng() * NEON_PALETTE.length)]!,
            lot: lots.length - 1,
          });
        }
      }
    }
  }
  return { lots, signs };
}
