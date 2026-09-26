import { describe, expect, it } from 'vitest';
import { findBlockInteriors, type BlockInteriors } from '../../src/world/interiors/BlockInteriors';
import { placeInteriorProps } from '../../src/world/interiors/InteriorProps';
import { generateLots, type Lot } from '../../src/world/lots/LotGenerator';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateTerrain, heightAt } from '../../src/world/terrain/TerrainGenerator';

const raw = generateTerrain(1337);
const network = generateRoads(1337, raw);
const carved = carveRoads(raw, network);
const { lots } = generateLots(1337, network, carved);
const bi = findBlockInteriors(carved, network, lots);
const props = placeInteriorProps(1337, bi, lots, carved);

/** Zona do vértice da grade mais próximo de (x, z). */
function zoneAt(b: BlockInteriors, x: number, z: number): number {
  const ix = Math.round((x - b.origin) / b.spacing);
  const iz = Math.round((z - b.origin) / b.spacing);
  if (ix < 0 || iz < 0 || ix >= b.size || iz >= b.size) return -1;
  return b.zoneOf[iz * b.size + ix]!;
}

/**
 * Fachada de fundo: a rua fica do lado −side·esquerda do centro do lote
 * (esquerda do heading r = (cos r, −sin r)), então o fundo fica em +side·esquerda.
 */
function back(l: Lot) {
  const bx = Math.cos(l.rotation) * l.side;
  const bz = -Math.sin(l.rotation) * l.side;
  const ax = Math.sin(l.rotation);
  const az = Math.cos(l.rotation);
  const cx = l.x + (bx * l.depth) / 2;
  const cz = l.z + (bz * l.depth) / 2;
  return { cx, cz, bx, bz, a: [cx - (ax * l.width) / 2, cz - (az * l.width) / 2] as const, b: [cx + (ax * l.width) / 2, cz + (az * l.width) / 2] as const };
}

function segDist3(p: { x: number; y: number; z: number }, a: number[], b: number[]): number {
  const d = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
  const len2 = d[0]! ** 2 + d[1]! ** 2 + d[2]! ** 2;
  const t = Math.max(0, Math.min(1, ((p.x - a[0]!) * d[0]! + (p.y - a[1]!) * d[1]! + (p.z - a[2]!) * d[2]!) / len2));
  return Math.hypot(p.x - (a[0]! + d[0]! * t), p.y - (a[1]! + d[1]! * t), p.z - (a[2]! + d[2]! * t));
}

function segDist2(x: number, z: number, a: readonly number[], b: readonly number[]): number {
  const dx = b[0]! - a[0]!;
  const dz = b[1]! - a[1]!;
  const t = Math.max(0, Math.min(1, ((x - a[0]!) * dx + (z - a[1]!) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (a[0]! + dx * t), z - (a[1]! + dz * t));
}

describe('interior props', () => {
  // C15 (AC 14, door 2)
  it('yard for every outer lot with 8 m behind', () => {
    const byLot = new Map(props.yards.map((y) => [y.lotIndex, y]));
    expect(byLot.size).toBe(props.yards.length);
    let expected = 0;
    lots.forEach((l, i) => {
      let has = !l.downtown;
      if (has) {
        const f = back(l);
        for (let t = 0; t <= 8; t++) if (zoneAt(bi, f.cx + f.bx * t, f.cz + f.bz * t) < 0) has = false;
      }
      if (has) expected++;
      expect(byLot.has(i), `lot ${i}`).toBe(has);
    });
    expect(expected).toBeGreaterThan(0);
  });

  // C16 (AC 15, door 2) - parte pura
  it('yard lamp and six bulbs', () => {
    expect(props.yards.length).toBeGreaterThan(0);
    for (const y of props.yards) {
      const l = lots[y.lotIndex]!;
      const f = back(l);
      // poste a 4-8 m da fachada de fundo, num vértice interior, 2.5 m acima do terreno
      const d = segDist2(y.lamp.x, y.lamp.z, f.a, f.b);
      expect(d).toBeGreaterThanOrEqual(4);
      expect(d).toBeLessThanOrEqual(8);
      const ix = (y.lamp.x - bi.origin) / bi.spacing;
      const iz = (y.lamp.z - bi.origin) / bi.spacing;
      expect(Math.abs(ix - Math.round(ix))).toBeLessThan(1e-6);
      expect(Math.abs(iz - Math.round(iz))).toBeLessThan(1e-6);
      expect(bi.zoneOf[Math.round(iz) * bi.size + Math.round(ix)]).toBeGreaterThanOrEqual(0);
      expect(Math.abs(y.lamp.y - (heightAt(carved, y.lamp.x, y.lamp.z) + 2.5))).toBeLessThanOrEqual(0.01);
      // 6 lâmpadas a no máximo 0.5 m do segmento fachada (a 2.2 m) → topo do poste
      expect(y.bulbs.length).toBe(6);
      const start = [f.cx, heightAt(carved, f.cx, f.cz) + 2.2, f.cz];
      const end = [y.lamp.x, y.lamp.y, y.lamp.z];
      for (const b of y.bulbs) expect(segDist3(b, start, end)).toBeLessThanOrEqual(0.5);
    }
  });

  // C18 (AC 17, door 2)
  it('pools fit in the yard', () => {
    const fraction = props.pools.length / props.yards.length;
    expect(fraction).toBeGreaterThanOrEqual(0.2);
    expect(fraction).toBeLessThanOrEqual(0.4);
    for (const p of props.pools) {
      expect(p.w).toBe(4);
      expect(p.d).toBe(8);
      // w ao longo de (sin r, cos r), d ao longo de (cos r, −sin r)
      const fx = Math.sin(p.rotation);
      const fz = Math.cos(p.rotation);
      const lx = Math.cos(p.rotation);
      const lz = -Math.sin(p.rotation);
      const zone = zoneAt(bi, p.x, p.z);
      expect(zone).toBeGreaterThanOrEqual(0);
      for (const [a, b] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
        const cx = p.x + (fx * a! * p.w) / 2 + (lx * b! * p.d) / 2;
        const cz = p.z + (fz * a! * p.w) / 2 + (lz * b! * p.d) / 2;
        expect(zoneAt(bi, cx, cz)).toBe(zone);
      }
      expect(Math.abs(p.y - (heightAt(carved, p.x, p.z) + 0.05))).toBeLessThanOrEqual(0.01);
    }
  });

  // C20 (AC 19, door 2)
  it('trees on outer interior ground', () => {
    const trees = props.trees;
    expect(trees.length).toBeGreaterThanOrEqual(1);
    const n = bi.size;
    const H = (ix: number, iz: number) => carved.heights[Math.min(n - 1, Math.max(0, iz)) * n + Math.min(n - 1, Math.max(0, ix))]!;
    const perZone = new Map<number, number>();
    for (const t of trees) {
      const fx = (t.x - bi.origin) / bi.spacing;
      const fz = (t.z - bi.origin) / bi.spacing;
      expect(Math.abs(fx - Math.round(fx))).toBeLessThan(1e-6);
      expect(Math.abs(fz - Math.round(fz))).toBeLessThan(1e-6);
      const ix = Math.round(fx);
      const iz = Math.round(fz);
      const k = iz * n + ix;
      const zone = bi.zoneOf[k]!;
      expect(zone).toBeGreaterThanOrEqual(0);
      expect(t.zoneId).toBe(zone);
      expect(bi.zones[zone]!.kind).toBe('outer');
      expect(bi.facadeDist[k]).toBeGreaterThanOrEqual(6);
      const dx = (H(ix + 1, iz) - H(ix - 1, iz)) / (2 * bi.spacing);
      const dz = (H(ix, iz + 1) - H(ix, iz - 1)) / (2 * bi.spacing);
      expect(Math.hypot(dx, dz)).toBeLessThanOrEqual(0.35);
      perZone.set(zone, (perZone.get(zone) ?? 0) + 1);
    }
    for (const [zone, count] of perZone) expect(count).toBeLessThanOrEqual(bi.zones[zone]!.areaM2 / 120);
    // menor distância entre duas árvores, todas as duplas por grade de 8 m
    const grid = new Map<string, number[]>();
    trees.forEach((t, i) => {
      const key = `${Math.floor(t.x / 8)},${Math.floor(t.z / 8)}`;
      grid.set(key, [...(grid.get(key) ?? []), i]);
    });
    let closest = Infinity;
    trees.forEach((t, i) => {
      const gx = Math.floor(t.x / 8);
      const gz = Math.floor(t.z / 8);
      for (let a = gx - 1; a <= gx + 1; a++) {
        for (let b = gz - 1; b <= gz + 1; b++) {
          for (const j of grid.get(`${a},${b}`) ?? []) if (j !== i) closest = Math.min(closest, Math.hypot(trees[j]!.x - t.x, trees[j]!.z - t.z));
        }
      }
    });
    expect(closest).toBeGreaterThanOrEqual(7);
  });

  // C21 (AC 20, door 2)
  it('tree heights between 5 and 10', () => {
    for (const t of props.trees) {
      expect(t.height).toBeGreaterThanOrEqual(5);
      expect(t.height).toBeLessThanOrEqual(10);
    }
    expect(props.trees.some((t) => t.height < 6)).toBe(true);
    expect(props.trees.some((t) => t.height > 9)).toBe(true);
  });

  // C26 (AC 24, door 2)
  it('construction sites in the largest downtown zones', () => {
    const big = bi.zones
      .filter((z) => z.kind === 'downtown' && z.areaM2 >= 1500)
      .sort((a, b) => b.areaM2 - a.areaM2)
      .slice(0, 6);
    expect(props.sites.length).toBe(big.length);
    expect(props.sites.length).toBeGreaterThan(0);
    props.sites.forEach((s, i) => {
      const zone = big[i]!;
      // mesma zona, na ordem de área decrescente (empates podem trocar de lugar)
      expect(bi.zones[s.zoneId]!.areaM2).toBe(zone.areaM2);
      expect(bi.zones[s.zoneId]!.kind).toBe('downtown');
      const z = bi.zones[s.zoneId]!;
      if (zoneAt(bi, z.centroid.x, z.centroid.z) === z.id) {
        expect(s.x).toBeCloseTo(z.centroid.x, 9);
        expect(s.z).toBeCloseTo(z.centroid.z, 9);
      } else {
        let best = Infinity;
        for (let k = 0; k < bi.zoneOf.length; k++) {
          if (bi.zoneOf[k] !== z.id) continue;
          const x = bi.origin + (k % bi.size) * bi.spacing;
          const zz = bi.origin + Math.floor(k / bi.size) * bi.spacing;
          best = Math.min(best, Math.hypot(x - z.centroid.x, zz - z.centroid.z));
        }
        expect(zoneAt(bi, s.x, s.z)).toBe(z.id);
        expect(Math.hypot(s.x - z.centroid.x, s.z - z.centroid.z)).toBeCloseTo(best, 9);
      }
    });
    expect(new Set(props.sites.map((s) => s.zoneId)).size).toBe(props.sites.length);

    // mapa sintético: 8 zonas do centro de 1600 m² (10 × 10 vértices), o resto é água → 6 canteiros
    const size = 101;
    const origin = -200;
    const islands: Array<[number, number]> = [];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 2; b++) islands.push([-180 + a * 90, -120 + b * 150]);
    const heights = new Float32Array(size * size);
    for (let iz = 0; iz < size; iz++) {
      for (let ix = 0; ix < size; ix++) {
        const x = origin + ix * 4;
        const z = origin + iz * 4;
        const dry = islands.some(([ax, az]) => x >= ax && x < ax + 40 && z >= az && z < az + 40);
        heights[iz * size + ix] = dry ? 0 : -5;
      }
    }
    const hm = { size, spacing: 4, origin, heights };
    const synth = findBlockInteriors(hm, { roads: [] }, []);
    expect(synth.zones.length).toBe(8);
    for (const z of synth.zones) {
      expect(z.areaM2).toBe(1600);
      expect(z.kind).toBe('downtown');
    }
    expect(placeInteriorProps(1337, synth, [], hm).sites.length).toBe(6);
  });
});
