import { describe, expect, it } from 'vitest';
import { NEON_PALETTE } from '../../src/world/CityGenerator';
import { generateTerrain, heightAt } from '../../src/world/terrain/TerrainGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { facadeTransform, generateLots, type Lot } from '../../src/world/lots/LotGenerator';

const raw = generateTerrain(1337);
const net = generateRoads(1337, raw);
const carved = carveRoads(raw, net);
const { lots, signs } = generateLots(1337, net, carved);

const inDowntown = (x: number, z: number) => Math.abs(x) <= 500 && Math.abs(z) <= 500;
const corners = (l: Lot): Array<[number, number]> => {
  // eixo "frente" = heading (sin r, cos r); "esquerda" = (cos r, −sin r)
  const out: Array<[number, number]> = [];
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      out.push([
        l.x + Math.sin(l.rotation) * (a * l.width) / 2 + Math.cos(l.rotation) * (b * l.depth) / 2,
        l.z + Math.cos(l.rotation) * (a * l.width) / 2 - Math.sin(l.rotation) * (b * l.depth) / 2,
      ]);
    }
  }
  return out;
};
const rectDistance = (l: Lot, x: number, z: number) => {
  const dx = x - l.x;
  const dz = z - l.z;
  const u = dx * Math.sin(l.rotation) + dz * Math.cos(l.rotation);
  const v = dx * Math.cos(l.rotation) - dz * Math.sin(l.rotation);
  return Math.hypot(Math.max(0, Math.abs(u) - l.width / 2), Math.max(0, Math.abs(v) - l.depth / 2));
};

describe('lots', () => {
  // C30 (AC 24, door 3)
  it('lots are deterministic', () => {
    const again = generateLots(1337, net, carved);
    expect(again.lots).toEqual(lots);
    expect(again.signs).toEqual(signs);
    expect(lots.length).toBeGreaterThan(100);
  });

  // C31 (AC 25)
  it('towers downtown and houses on the hills', () => {
    for (const l of lots) {
      if (inDowntown(l.x, l.z)) {
        expect(l.height).toBeGreaterThanOrEqual(30);
        expect(l.height).toBeLessThanOrEqual(90);
      } else {
        expect(l.height).toBeGreaterThanOrEqual(6);
        expect(l.height).toBeLessThanOrEqual(18);
      }
    }
    for (const r of net.roads.filter((x) => x.kind === 'avenue' || x.kind === 'street' || x.kind === 'hill')) {
      const sides = new Set<number>();
      for (const l of lots) {
        let best = Infinity;
        let bi = 0;
        for (let i = 0; i < r.points.length / 3; i++) {
          const d = Math.hypot(r.points[i * 3]! - l.x, r.points[i * 3 + 2]! - l.z);
          if (d < best) {
            best = d;
            bi = i;
          }
        }
        if (best > 30) continue;
        const n = r.points.length / 3;
        const a = Math.max(0, bi - 1);
        const b = Math.min(n - 1, bi + 1);
        const hx = r.points[b * 3]! - r.points[a * 3]!;
        const hz = r.points[b * 3 + 2]! - r.points[a * 3 + 2]!;
        const cross = hz * (l.x - r.points[bi * 3]!) - hx * (l.z - r.points[bi * 3 + 2]!);
        sides.add(Math.sign(cross));
      }
      expect(sides.has(1) && sides.has(-1), `${r.kind} ${r.id}`).toBe(true);
    }
  });

  // C32 (AC 26)
  it('buildings keep off roads and water', () => {
    for (const l of lots) {
      for (const r of net.roads) {
        for (let i = 0; i < r.points.length / 3; i++) {
          const d = rectDistance(l, r.points[i * 3]!, r.points[i * 3 + 2]!);
          if (d < r.width / 2 + 2) throw new Error(`lot at ${l.x.toFixed(1)},${l.z.toFixed(1)} is ${d.toFixed(2)} m from road ${r.id}`);
        }
      }
      for (const [x, z] of [...corners(l), [l.x, l.z] as [number, number]]) {
        expect(heightAt(raw, x, z)).toBeGreaterThan(-2);
      }
    }
  });

  // C33 (AC 27)
  it('buildings face their road and sit on the lowest corner', () => {
    for (const l of lots) {
      let best = Infinity;
      let road = net.roads[0]!;
      let bi = 0;
      for (const r of net.roads) {
        for (let i = 0; i < r.points.length / 3; i++) {
          const d = Math.hypot(r.points[i * 3]! - l.x, r.points[i * 3 + 2]! - l.z);
          if (d < best) {
            best = d;
            road = r;
            bi = i;
          }
        }
      }
      const n = road.points.length / 3;
      const a = road.closed ? (bi - 1 + n) % n : Math.max(0, bi - 1);
      const b = road.closed ? (bi + 1) % n : Math.min(n - 1, bi + 1);
      const heading = Math.atan2(road.points[b * 3]! - road.points[a * 3]!, road.points[b * 3 + 2]! - road.points[a * 3 + 2]!);
      let diff = (l.rotation - heading) % Math.PI;
      if (diff > Math.PI / 2) diff -= Math.PI;
      if (diff < -Math.PI / 2) diff += Math.PI;
      expect(Math.abs(diff), `lot at ${l.x.toFixed(1)},${l.z.toFixed(1)}`).toBeLessThanOrEqual((1 * Math.PI) / 180);
      let low = heightAt(carved, l.x, l.z);
      for (const [x, z] of corners(l)) low = Math.min(low, heightAt(carved, x, z));
      expect(Math.abs(l.y - low)).toBeLessThanOrEqual(0.01);
      // a malha (caixa unitária da fachada) começa na base e sobe `height`
      const t = facadeTransform(l);
      expect(t.position[1] - t.scale[1] / 2, `lot at ${l.x.toFixed(1)},${l.z.toFixed(1)} mesh base`).toBeCloseTo(l.y, 4);
      expect(t.position[1] + t.scale[1] / 2, `lot at ${l.x.toFixed(1)},${l.z.toFixed(1)} mesh top`).toBeCloseTo(l.y + l.height, 4);
      expect([t.position[0], t.position[2]]).toEqual([l.x, l.z]);
    }
  });

  // C34 (AC 28)
  it('neon signs only downtown with the 4-color palette', () => {
    expect(signs.length).toBeGreaterThan(0);
    const colors = new Set<string>();
    for (const s of signs) {
      const l = lots[s.lot]!;
      expect(inDowntown(l.x, l.z)).toBe(true);
      expect(NEON_PALETTE).toContain(s.color);
      colors.add(s.color);
    }
    expect(colors.size).toBe(4);
  });
});
