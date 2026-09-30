import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { generateRaces, routeAt, SPRINT_RUNOFF, type RaceDef } from '../../src/race/raceRoutes';
import { generateRoads, type Road, type RoadNetwork } from '../../src/world/roads/RoadGenerator';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';

// races C1-C8: as 4 corridas do seed 1337 (door 1)
const SEED = 1337;
const network = generateRoads(SEED, generateTerrain(SEED));
const races = generateRaces(network);
const byId = (id: string) => races.find((r) => r.id === id)!;

const pts = (r: RaceDef) => {
  const out: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; i < r.route.points.length; i += 3) out.push({ x: r.route.points[i]!, y: r.route.points[i + 1]!, z: r.route.points[i + 2]! });
  return out;
};

/** ponto de estrada mais perto de (x, z): distância horizontal e largura da estrada dele */
function nearestRoad(net: RoadNetwork, x: number, z: number): { d: number; width: number; road: Road } {
  let best = { d: Infinity, width: 0, road: net.roads[0]! };
  for (const road of net.roads) {
    const p = road.points;
    for (let i = 0; i < p.length; i += 3) {
      const d = Math.hypot(p[i]! - x, p[i + 2]! - z);
      if (d < best.d) best = { d, width: road.width, road };
    }
  }
  return best;
}

/** comprimento acumulado de cada ponto do traçado */
function arcs(r: RaceDef): number[] {
  const p = pts(r);
  const a = [0];
  for (let i = 1; i < p.length; i++) a.push(a[i - 1]! + Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.z - p[i - 1]!.z));
  return a;
}

function nearestIndex(r: RaceDef, x: number, z: number): number {
  const p = pts(r);
  let best = 0;
  for (let i = 1; i < p.length; i++) if (Math.hypot(p[i]!.x - x, p[i]!.z - z) < Math.hypot(p[best]!.x - x, p[best]!.z - z)) best = i;
  return best;
}

function angleDiff(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function avenue(axis: 'x' | 'z', lateral: number): Road {
  const avenues = network.roads.filter((r) => r.kind === 'avenue');
  const info = avenues.map((road) => {
    const n = road.points.length / 3;
    const dx = Math.abs(road.points[(n - 1) * 3]! - road.points[0]!);
    const dz = Math.abs(road.points[(n - 1) * 3 + 2]! - road.points[2]!);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += road.points[i * 3 + (dx >= dz ? 2 : 0)]!;
    return { road, axis: dx >= dz ? 'x' : 'z', lateral: sum / n };
  });
  return info
    .filter((a) => a.axis === axis)
    .sort((a, b) => Math.abs(a.lateral - lateral) - Math.abs(b.lateral - lateral))[0]!.road;
}

afterEach(() => vi.restoreAllMocks());

describe('races of seed 1337', () => {
  // C1
  it('generates the four races of seed 1337', () => {
    expect(races.map((r) => [r.id, r.kind, r.laps])).toEqual([
      ['circuito-centro', 'circuit', 2],
      ['circuito-anel', 'circuit', 1],
      ['sprint-cruzada', 'sprint', 1],
      ['sprint-morro', 'sprint', 1],
    ]);
    for (const r of races) {
      expect(r.name.length, r.id).toBeGreaterThan(0);
      expect(r.route.points.length % 3, r.id).toBe(0);
      expect(r.gates.length, r.id).toBeGreaterThan(0);
      expect(r.grid.length, r.id).toBe(4);
      expect(r.marker.radius, r.id).toBe(10);
    }
  });

  // C2
  it('each route follows its rule', () => {
    const centro = pts(byId('circuito-centro'));
    for (const p of centro) {
      const toLine = Math.min(Math.abs(p.x - 300), Math.abs(p.x + 300), Math.abs(p.z - 300), Math.abs(p.z + 300));
      expect(toLine).toBeLessThanOrEqual(40);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(340);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(340);
    }
    for (const [cx, cz] of [[300, 300], [300, -300], [-300, 300], [-300, -300]] as const) {
      expect(Math.min(...centro.map((p) => Math.hypot(p.x - cx, p.z - cz))), `corner ${cx},${cz}`).toBeLessThanOrEqual(40);
    }

    const ring = network.roads.find((r) => r.kind === 'highway')!;
    const ringNet: RoadNetwork = { roads: [ring] };
    for (const p of pts(byId('circuito-anel'))) expect(nearestRoad(ringNet, p.x, p.z).d).toBeLessThanOrEqual(1);

    const cruzada = pts(byId('sprint-cruzada'));
    const across = avenue('x', 0);
    const up = avenue('z', 0);
    const an = across.points.length / 3;
    const un = up.points.length / 3;
    const westEnd = across.points[0]! < across.points[(an - 1) * 3]! ? 0 : an - 1;
    const northEnd = up.points[2]! > up.points[(un - 1) * 3 + 2]! ? 0 : un - 1;
    const first = cruzada[0]!;
    const last = cruzada[cruzada.length - 1]!;
    expect(Math.hypot(first.x - across.points[westEnd * 3]!, first.z - across.points[westEnd * 3 + 2]!)).toBeLessThanOrEqual(20);
    expect(up.points[northEnd * 3 + 2]!).toBeGreaterThan(0);
    expect(Math.hypot(last.x - up.points[northEnd * 3]!, last.z - up.points[northEnd * 3 + 2]!)).toBeLessThanOrEqual(20);
    expect(Math.min(...cruzada.map((p) => Math.hypot(p.x, p.z)))).toBeLessThanOrEqual(30);

    const hills = network.roads.filter((r) => r.kind === 'hill');
    const longest = hills.reduce((a, b) => (b.points.length > a.points.length ? b : a));
    const morro = pts(byId('sprint-morro'));
    const hn = longest.points.length / 3;
    expect(Math.hypot(morro[0]!.x - longest.points[0]!, morro[0]!.z - longest.points[2]!)).toBeLessThanOrEqual(2);
    const m = morro[morro.length - 1]!;
    expect(Math.hypot(m.x - longest.points[(hn - 1) * 3]!, m.z - longest.points[(hn - 1) * 3 + 2]!)).toBeLessThanOrEqual(2);
  });

  // C3
  // a segunda geração fica no hook: o teste só compara (test-hardening AC 2)
  let again: RaceDef[];
  beforeAll(() => {
    again = generateRaces(generateRoads(SEED, generateTerrain(SEED)));
  });

  it('same seed same races', () => {
    expect(again).toEqual(races);
  });

  // C4
  it('routes are continuous and on the asphalt', () => {
    for (const r of races) {
      const p = pts(r);
      for (let i = 1; i < p.length; i++) {
        expect(Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.z - p[i - 1]!.z), `${r.id} step ${i}`).toBeLessThanOrEqual(4);
      }
      for (let i = 0; i < p.length; i++) {
        const n = nearestRoad(network, p[i]!.x, p[i]!.z);
        expect(n.d, `${r.id} point ${i}`).toBeLessThanOrEqual(n.width / 2);
      }
      if (r.kind === 'circuit') {
        expect(Math.hypot(p[0]!.x - p[p.length - 1]!.x, p[0]!.z - p[p.length - 1]!.z), r.id).toBeLessThanOrEqual(4);
      }
    }
  });

  // C5
  it('route lengths within bands', () => {
    const bands: Record<string, [number, number]> = {
      'circuito-centro': [2200, 2700],
      'circuito-anel': [6200, 6400],
      'sprint-cruzada': [1800, 2300],
      'sprint-morro': [2800, 3000],
    };
    for (const r of races) {
      const [lo, hi] = bands[r.id]!;
      // ±0.01 m nos limites: erro de float32 dos pontos das estradas
      expect(r.route.length, r.id).toBeGreaterThanOrEqual(lo - 0.01);
      expect(r.route.length, r.id).toBeLessThanOrEqual(hi + 0.01);
      const p = pts(r);
      let sum = 0;
      for (let i = 1; i < p.length; i++) sum += Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.z - p[i - 1]!.z);
      if (r.kind === 'circuit') sum += Math.hypot(p[0]!.x - p[p.length - 1]!.x, p[0]!.z - p[p.length - 1]!.z);
      expect(Math.abs(r.route.length - sum), r.id).toBeLessThanOrEqual(1);
    }
  });

  // C6
  it('gates spaced and sized', () => {
    for (const r of races) {
      let prev = 0;
      for (const g of r.gates) {
        expect(g.s, r.id).toBeGreaterThan(prev);
        expect(g.s - prev, r.id).toBeLessThanOrEqual(250);
        prev = g.s;
        const n = nearestRoad(network, g.x, g.z);
        expect(Math.abs(g.halfWidth - (n.width / 2 + 4)), `${r.id} gate at ${g.s}`).toBeLessThanOrEqual(0.01);
      }
      const p = pts(r);
      const last = r.gates[r.gates.length - 1]!;
      // play-fixes AC 10 (renegocia a races AC 4): a chegada do sprint fica 200 m antes do fim do traçado
      const target = r.kind === 'sprint' ? routeAt(r.route, r.route.length - 200) : p[0]!;
      expect(SPRINT_RUNOFF).toBe(200);
      expect(Math.hypot(last.x - target.x, last.z - target.z), r.id).toBeLessThanOrEqual(4);
    }
  });

  // C7
  it('grid slots on the asphalt behind the start line', () => {
    for (const r of races) {
      expect(r.grid.length).toBe(4);
      const a = arcs(r);
      // linha de largada: o ponto do traçado sob o marcador de largada
      const line = a[nearestIndex(r, r.marker.x, r.marker.z)]!;
      for (const [k, slot] of r.grid.entries()) {
        const n = nearestRoad(network, slot.x, slot.z);
        expect(n.d, `${r.id} slot ${k}`).toBeLessThanOrEqual(n.width / 2 - 1);
        const i = nearestIndex(r, slot.x, slot.z);
        let before = line - a[i]!;
        if (r.kind === 'circuit' && before < 0) before += r.route.length;
        expect(before, `${r.id} slot ${k}`).toBeGreaterThanOrEqual(6);
        expect(before, `${r.id} slot ${k}`).toBeLessThanOrEqual(24);
        const p = pts(r);
        const j = Math.min(i + 1, p.length - 1);
        const i0 = j === i ? i - 1 : i;
        const routeHeading = Math.atan2(p[j]!.x - p[i0]!.x, p[j]!.z - p[i0]!.z);
        expect(angleDiff(slot.heading, routeHeading), `${r.id} slot ${k}`).toBeLessThanOrEqual((5 * Math.PI) / 180);
      }
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          const d = Math.hypot(r.grid[i]!.x - r.grid[j]!.x, r.grid[i]!.z - r.grid[j]!.z);
          expect(d, `${r.id} slots ${i}-${j}`).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });

  // C8
  it('missing road skips only that race', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const noHills: RoadNetwork = { roads: network.roads.filter((r) => r.kind !== 'hill') };
    const partial = generateRaces(noHills);
    expect(partial.map((r) => r.id)).toEqual(['circuito-centro', 'circuito-anel', 'sprint-cruzada']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0]).startsWith('race sprint-morro skipped:')).toBe(true);
  });
});
