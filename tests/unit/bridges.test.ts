import { describe, expect, it } from 'vitest';
import { generateTerrain, heightAt, riverCenterX } from '../../src/world/terrain/TerrainGenerator';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { bridgeMeshes, bridgeParts } from '../../src/world/roads/bridges';
import { pointHeading } from '../../src/world/roads/roadMesh';

const hm = generateTerrain(1337);
const net = generateRoads(1337, hm);

describe('bridges', () => {
  // C26 (AC 20, door 6)
  it('bridge stretches where the road is high or over water', () => {
    let total = 0;
    for (const r of net.roads) {
      const n = r.points.length / 3;
      const cond = (i: number) => {
        const h = heightAt(hm, r.points[i * 3]!, r.points[i * 3 + 2]!);
        return h < -2 || r.points[i * 3 + 1]! - h > 4;
      };
      const inRange = (i: number) => r.bridges.some((b) => i >= b.from && i <= b.to);
      for (let i = 0; i < n; i++) {
        if (cond(i) && !inRange(i)) throw new Error(`road ${r.id} point ${i} needs a bridge`);
      }
      for (const b of r.bridges) {
        let any = false;
        for (let i = b.from; i <= b.to; i++) if (cond(i)) any = true;
        expect(any, `road ${r.id} bridge ${b.from}-${b.to}`).toBe(true);
        total++;
      }
    }
    expect(total).toBeGreaterThan(0);
    const ring = net.roads.find((r) => r.kind === 'highway')!;
    const overRiver = ring.bridges.some((b) => {
      for (let i = b.from; i <= b.to; i++) {
        if (Math.abs(ring.points[i * 3]! - riverCenterX(ring.points[i * 3 + 2]!)) < 20) return true;
      }
      return false;
    });
    expect(overRiver).toBe(true);
  });

  // C27 (AC 21, door 6)
  it('deck rails and pillars', () => {
    let checked = 0;
    for (const r of net.roads) {
      for (const range of r.bridges) {
        const parts = bridgeParts(r, range, hm);
        const { deck, rails } = bridgeMeshes(r, parts);
        // tabuleiro: por ponto, topo na altura da estrada e fundo 0.8 abaixo, bordas a ±width/2
        parts.indices.forEach((i, k) => {
          const y = r.points[i * 3 + 1]!;
          const x = r.points[i * 3]!;
          const z = r.points[i * 3 + 2]!;
          const ys = [1, 4, 7, 10].map((o) => deck.positions[k * 12 + o]!);
          expect(ys[0]).toBeCloseTo(y, 4);
          expect(ys[1]).toBeCloseTo(y, 4);
          expect(ys[2]).toBeCloseTo(y - 0.8, 4);
          expect(ys[3]).toBeCloseTo(y - 0.8, 4);
          for (const v of [0, 1]) {
            const vx = deck.positions[k * 12 + v * 3]!;
            const vz = deck.positions[k * 12 + v * 3 + 2]!;
            expect(Math.hypot(vx - x, vz - z)).toBeCloseTo(r.width / 2, 3);
          }
          // guarda-corpos: 1 m de altura acima do tabuleiro, face externa em ±width/2, um de cada lado
          const h = pointHeading(r, i);
          const sides = rails.map((rail) => {
            const topY = rail.positions[k * 12 + 1]!;
            const botY = rail.positions[k * 12 + 7]!;
            expect(topY - botY).toBeCloseTo(1, 4);
            expect(botY).toBeCloseTo(y, 4);
            const lat = [0, 1].map((v) => {
              const vx = rail.positions[k * 12 + v * 3]! - x;
              const vz = rail.positions[k * 12 + v * 3 + 2]! - z;
              return vx * Math.cos(h) - vz * Math.sin(h);
            });
            const outer = Math.max(...lat.map(Math.abs));
            expect(outer).toBeCloseTo(r.width / 2, 3);
            return Math.sign(lat[0]! + lat[1]!);
          });
          expect(sides.sort()).toEqual([-1, 1]);
        });
        // pilares a cada 24 m, do fundo do tabuleiro até o chão
        parts.pillars.forEach((pl, k) => {
          if (k > 0) expect(Math.abs(pl.along - parts.pillars[k - 1]!.along - 24)).toBeLessThanOrEqual(0.5);
          const f = pl.along / 2;
          const a = parts.indices[Math.floor(f)]!;
          const b = parts.indices[Math.min(parts.indices.length - 1, Math.floor(f) + 1)]!;
          const t = f - Math.floor(f);
          const deckY = r.points[a * 3 + 1]! + (r.points[b * 3 + 1]! - r.points[a * 3 + 1]!) * t;
          expect(pl.top).toBeCloseTo(deckY - 0.8, 4);
          expect(pl.bottom).toBeLessThanOrEqual(heightAt(hm, pl.x, pl.z) + 0.01);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});
