import { describe, expect, it } from 'vitest';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { pointHeading, roadStripGeometry } from '../../src/world/roads/roadMesh';

const net = generateRoads(1337, generateTerrain(1337));

describe('road mesh', () => {
  // C21 (AC 18)
  it('road strip vertices and uvs', () => {
    for (const road of [net.roads.find((r) => r.kind === 'highway')!, net.roads.find((r) => r.kind === 'hill')!]) {
      const n = road.points.length / 3;
      const g = roadStripGeometry(road);
      expect(g.positions.length).toBe(n * 6);
      expect(g.uvs.length).toBe(n * 4);
      for (let i = 0; i < n; i += 7) {
        const [x, y, z] = [road.points[i * 3]!, road.points[i * 3 + 1]!, road.points[i * 3 + 2]!];
        const h = pointHeading(road, i);
        // pointHeading é a diferença central
        const a = road.closed ? (i - 1 + n) % n : Math.max(0, i - 1);
        const b = road.closed ? (i + 1) % n : Math.min(n - 1, i + 1);
        expect(h).toBeCloseTo(Math.atan2(road.points[b * 3]! - road.points[a * 3]!, road.points[b * 3 + 2]! - road.points[a * 3 + 2]!), 9);
        for (const v of [0, 1]) {
          const vx = g.positions[i * 6 + v * 3]!;
          const vy = g.positions[i * 6 + v * 3 + 1]!;
          const vz = g.positions[i * 6 + v * 3 + 2]!;
          // a ±width/2 do eixo, perpendicular ao heading, 5 cm acima
          // posições em Float32Array: a ~1000 m o passo do float32 é ~6e-5, daí 3 casas
          expect(Math.hypot(vx - x, vz - z)).toBeCloseTo(road.width / 2, 3);
          expect((vx - x) * Math.sin(h) + (vz - z) * Math.cos(h)).toBeCloseTo(0, 3);
          expect(vy).toBeCloseTo(y + 0.05, 5);
        }
        // u: 0 numa borda e width/4 na outra; v: 0.5 por ponto
        expect(g.uvs[i * 4]).toBe(0);
        expect(g.uvs[i * 4 + 2]).toBeCloseTo(road.width / 4, 6);
        expect(g.uvs[i * 4 + 1]).toBeCloseTo(i * 0.5, 6);
        expect(g.uvs[i * 4 + 3]).toBeCloseTo(i * 0.5, 6);
      }
    }
  });
});
