import { describe, expect, it } from 'vitest';
import { hexToRgb } from '../../src/vehicle/carPaint';
import {
  LAMP_LIGHT_RADIUS_M,
  LAMP_LIGHT_SIZE,
  buildLampLight,
  lampLightCellCenter,
} from '../../src/world/lampLight';
import { generateRoads, type Road } from '../../src/world/roads/RoadGenerator';
import { LAMP_LED, LAMP_SODIUM, generateLamps, lampColor, lampHeadPosition } from '../../src/world/roads/roadMesh';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';

// night-city S1: poste com braço, cor por bairro e luz no chão (seed 1337)
const net = generateRoads(1337, generateTerrain(1337));
const { lamps } = generateLamps(net);
const heads = lamps.map((l) => ({ ...lampHeadPosition(l), color: lampColor(l, net.roads[l.roadId]!) }));
const grid = buildLampLight(heads);

/** distância horizontal de (x, z) à polilinha da estrada */
function toRoad(road: Road, x: number, z: number): number {
  const p = road.points;
  let best = Infinity;
  for (let i = 0; i + 3 < p.length; i += 3) {
    const ax = p[i]!, az = p[i + 2]!, bx = p[i + 3]!, bz = p[i + 5]!;
    const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2)) : 0;
    best = Math.min(best, Math.hypot(ax + (bx - ax) * t - x, az + (bz - az) * t - z));
  }
  return best;
}

const cellOf = (v: number) => Math.floor((v + 1536) / 2);
const at = (ix: number, iz: number) => {
  const k = (iz * LAMP_LIGHT_SIZE + ix) * 4;
  return [grid.data[k]!, grid.data[k + 1]!, grid.data[k + 2]!];
};

describe('night-city lamps', () => {
  // C1 (AC 1)
  it('lamp head hangs over the road', () => {
    const bad: string[] = [];
    lamps.forEach((l, i) => {
      const h = lampHeadPosition(l);
      const road = net.roads[l.roadId]!;
      if (Math.abs(h.y - (l.y + 6)) > 1e-9) bad.push(`lamp ${i} y`);
      const closer = toRoad(road, l.x, l.z) - toRoad(road, h.x, h.z);
      if (Math.abs(closer - 1.6) > 0.05) bad.push(`lamp ${i} arm ${closer.toFixed(3)}`);
    });
    expect(lamps.length).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  });

  // C3 (AC 2, door 1)
  it('lamp color by district', () => {
    const rows: Array<[string, number, number, Road['kind'], string]> = [
      ['downtown, any road', 100, -200, 'street', LAMP_LED],
      ['avenue outside downtown', 800, 0, 'avenue', LAMP_LED],
      ['highway (ring) outside downtown', -900, 900, 'highway', LAMP_LED],
      ['hill outside downtown', 700, 1200, 'hill', LAMP_SODIUM],
      ['street outside downtown', -600, 700, 'street', LAMP_SODIUM],
    ];
    for (const [name, x, z, kind, color] of rows) expect(lampColor({ x, z }, { kind }), name).toBe(color);
    expect(LAMP_LED).toBe('#dce6ff');
    expect(LAMP_SODIUM).toBe('#ff9d4a');
  });

  // C4 (AC 3, door 2)
  it('lamp light grid falls off from each head', () => {
    // sob cada lente: ≥ 0.9 × a cor do poste em cada canal
    const dim: string[] = [];
    heads.forEach((h, i) => {
      const c = at(cellOf(h.x), cellOf(h.z));
      hexToRgb(h.color).forEach((v, ch) => {
        if (c[ch]! < 0.9 * v * 255 - 0.5) dim.push(`head ${i} ch ${ch} ${c[ch]}`);
      });
    });
    expect(dim).toEqual([]);

    // a ≥ 9 m de toda lente: 0
    const near = new Uint8Array(LAMP_LIGHT_SIZE * LAMP_LIGHT_SIZE);
    for (const h of heads) {
      for (let iz = cellOf(h.z) - 6; iz <= cellOf(h.z) + 6; iz++) {
        for (let ix = cellOf(h.x) - 6; ix <= cellOf(h.x) + 6; ix++) {
          if (ix < 0 || iz < 0 || ix >= LAMP_LIGHT_SIZE || iz >= LAMP_LIGHT_SIZE) continue;
          if (Math.hypot(lampLightCellCenter(ix) - h.x, lampLightCellCenter(iz) - h.z) < LAMP_LIGHT_RADIUS_M) near[iz * LAMP_LIGHT_SIZE + ix] = 1;
        }
      }
    }
    let lit = 0;
    for (let c = 0; c < near.length; c++) {
      if (near[c]) continue;
      if (grid.data[c * 4]! + grid.data[c * 4 + 1]! + grid.data[c * 4 + 2]! !== 0) lit++;
    }
    expect(lit).toBe(0);

    // de uma lente isolada para fora, a luz nunca sobe
    const lone = heads.find((h) => heads.every((o) => o === h || Math.hypot(o.x - h.x, o.z - h.z) > 30))!;
    expect(lone).toBeDefined();
    const ix0 = cellOf(lone.x);
    const iz0 = cellOf(lone.z);
    const sum = (c: number[]) => c[0]! + c[1]! + c[2]!;
    let prev = sum(at(ix0, iz0));
    for (let k = 1; k <= 6; k++) {
      const cur = sum(at(ix0 + k, iz0));
      expect(cur, `step ${k}`).toBeLessThanOrEqual(prev);
      prev = cur;
    }
    expect(prev).toBe(0);
  });

  // C5 (AC 3, door 2)
  it('lamp light grid covers the world', () => {
    expect(grid.size).toBe(1536);
    expect(grid.cell).toBe(2);
    expect(grid.data.length).toBe(1536 * 1536 * 4);
    expect(lampLightCellCenter(0)).toBe(-1535);
    expect(lampLightCellCenter(1535)).toBe(1535);
    expect(grid.origin).toBe(-1536);
  });
});
