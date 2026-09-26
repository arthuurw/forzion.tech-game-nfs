import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/world/CityGenerator';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { nearestRoadPoint, needsWaterReset } from '../../src/world/worldMath';

const net = generateRoads(1337, generateTerrain(1337));

describe('world math', () => {
  // C9 (AC 8, door 9)
  it('water reset threshold and nearest road point', () => {
    expect(needsWaterReset(-1.49)).toBe(false);
    expect(needsWaterReset(-1.5)).toBe(false);
    expect(needsWaterReset(-1.51)).toBe(true);

    const rng = mulberry32(99);
    for (let k = 0; k < 200; k++) {
      const x = (rng() * 2 - 1) * 1536;
      const z = (rng() * 2 - 1) * 1536;
      const got = nearestRoadPoint(net, x, z);
      // busca exaustiva
      let best = Infinity;
      let bestRoad = -1;
      let bestIndex = -1;
      for (const r of net.roads) {
        for (let i = 0; i < r.points.length / 3; i++) {
          const d = Math.hypot(r.points[i * 3]! - x, r.points[i * 3 + 2]! - z);
          if (d < best) {
            best = d;
            bestRoad = r.id;
            bestIndex = i;
          }
        }
      }
      expect(got.distance).toBeCloseTo(best, 6);
      expect([got.road.id, got.index]).toEqual([bestRoad, bestIndex]);
      const r = got.road;
      const n = r.points.length / 3;
      const i = got.index;
      const [a, b] = i + 1 < n ? [i, i + 1] : r.closed ? [i, 0] : [i - 1, i];
      const heading = Math.atan2(r.points[b * 3]! - r.points[a * 3]!, r.points[b * 3 + 2]! - r.points[a * 3 + 2]!);
      expect(got.heading).toBeCloseTo(heading, 9);
      expect(got.y).toBe(r.points[i * 3 + 1]);
    }
  });
});
