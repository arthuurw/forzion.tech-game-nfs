import { afterEach, describe, expect, it, vi } from 'vitest';
import { DECK_THICKNESS, buildTrainLine, frameColumns, lineCumulative, type TrainLine } from '../../src/world/rail/trainLine';
import { generateRoads, type Road, type RoadNetwork } from '../../src/world/roads/RoadGenerator';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';

// block-life-extras C27, C28, C29, C33: a linha do trem do seed 1337 (door 2)
const network = generateRoads(1337, generateTerrain(1337));
const line = buildTrainLine(network)!;

const pts = (l: TrainLine) => {
  const out: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; i < l.points.length; i += 3) out.push({ x: l.points[i]!, y: l.points[i + 1]!, z: l.points[i + 2]! });
  return out;
};

/** avenida do quadrado (x ≈ ±300 ou z ≈ ±300) mais perto de (x, z): distância à linha central e ponto */
function nearestOn(roads: Road[], x: number, z: number): { d: number; y: number; road: Road } {
  let best = { d: Infinity, y: 0, road: roads[0]! };
  for (const road of roads) {
    const p = road.points;
    for (let i = 0; i < p.length; i += 3) {
      const d = Math.hypot(p[i]! - x, p[i + 2]! - z);
      if (d < best.d) best = { d, y: p[i + 1]!, road };
    }
  }
  return best;
}

function squareAvenues(net: RoadNetwork): Road[] {
  return net.roads.filter((r) => {
    if (r.kind !== 'avenue') return false;
    const n = r.points.length / 3;
    const dx = Math.abs(r.points[(n - 1) * 3]! - r.points[0]!);
    const dz = Math.abs(r.points[(n - 1) * 3 + 2]! - r.points[2]!);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += r.points[i * 3 + (dx >= dz ? 2 : 0)]!;
    return Math.abs(Math.abs(sum / n) - 300) < 60;
  });
}

afterEach(() => vi.restoreAllMocks());

describe('train line of seed 1337', () => {
  // C27
  it('the line loops over the four downtown avenues', () => {
    const p = pts(line);
    const avenues = squareAvenues(network);
    expect(avenues.length).toBe(4);
    expect(Math.hypot(p[0]!.x - p[p.length - 1]!.x, p[0]!.z - p[p.length - 1]!.z)).toBeLessThanOrEqual(2);
    expect(line.length).toBeGreaterThanOrEqual(2300);
    expect(line.length).toBeLessThanOrEqual(2500);
    let sum = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i]!;
      const b = p[(i + 1) % p.length]!;
      const step = Math.hypot(b.x - a.x, b.z - a.z);
      expect(step, `step ${i}`).toBeLessThanOrEqual(2.5);
      sum += step;
      const n = nearestOn(avenues, a.x, a.z);
      expect(n.d, `point ${i} off the avenue`).toBeLessThanOrEqual(n.road.width / 2 - 2);
      expect(Math.abs(a.y - n.y - 8), `point ${i} deck height`).toBeLessThanOrEqual(0.5);
      const c = p[(i + 2) % p.length]!;
      const h1 = Math.atan2(b.x - a.x, b.z - a.z);
      const h2 = Math.atan2(c.x - b.x, c.z - b.z);
      const turn = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
      expect(turn, `turn at ${i}`).toBeLessThanOrEqual((6 * Math.PI) / 180);
    }
    expect(Math.abs(sum - line.length)).toBeLessThanOrEqual(1);
  });

  // C28
  it('a missing avenue skips the line with a warning', () => {
    const avenues = squareAvenues(network);
    for (const missing of avenues) {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const partial: RoadNetwork = { roads: network.roads.filter((r) => r !== missing) };
      expect(buildTrainLine(partial), `without road ${missing.id}`).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]![0]).startsWith('train line skipped:')).toBe(true);
      warn.mockRestore();
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(buildTrainLine(network)).not.toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  // C29
  it('portals every 24 m on the sidewalks away from crossings', () => {
    const cum = lineCumulative(line);
    const avenues = squareAvenues(network);
    expect(line.frames.length).toBeGreaterThan(40);
    // posição de cada portal ao longo da linha
    const along = (x: number, z: number): number => {
      let best = { d: Infinity, s: 0 };
      const n = line.points.length / 3;
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(line.points[i * 3]! - x, line.points[i * 3 + 2]! - z);
        if (d < best.d) best = { d, s: cum[i]! };
      }
      return best.s;
    };
    const ss = line.frames.map((f) => along(f.x, f.z));
    for (let i = 1; i < ss.length; i++) {
      const gap = ss[i]! - ss[i - 1]!;
      // 24 m, ou um múltiplo (portais pulados num cruzamento)
      const k = Math.round(gap / 24);
      expect(k, `frame ${i}`).toBeGreaterThanOrEqual(1);
      expect(Math.abs(gap - k * 24), `frame ${i} gap ${gap}`).toBeLessThanOrEqual(2);
    }
    for (const [i, f] of line.frames.entries()) {
      const under = nearestOn(avenues, f.x, f.z);
      expect(under.d, `frame ${i} on the avenue`).toBeLessThanOrEqual(2);
      const cols = frameColumns(f);
      expect(cols.length).toBe(2);
      for (const c of cols) {
        // de través à linha: nada ao longo do heading, tudo ao longo da direita (cos h, −sin h)
        const along = (c.x - f.x) * Math.sin(f.heading) + (c.z - f.z) * Math.cos(f.heading);
        const lateral = (c.x - f.x) * Math.cos(f.heading) - (c.z - f.z) * Math.sin(f.heading);
        expect(Math.abs(along), `frame ${i} column along`).toBeLessThanOrEqual(0.01);
        expect(Math.abs(Math.abs(lateral) - (under.road.width / 2 + 2.6)), `frame ${i} column`).toBeLessThanOrEqual(0.1);
      }
      expect(Math.sign(cols[0]!.x - f.x || cols[0]!.z - f.z)).not.toBe(Math.sign(cols[1]!.x - f.x || cols[1]!.z - f.z));
      for (const road of network.roads) {
        if (road === under.road) continue;
        expect(nearestOn([road], f.x, f.z).d, `frame ${i} near road ${road.id}`).toBeGreaterThanOrEqual(12);
      }
      const deck = pts(line)[Math.max(0, Math.min(pts(line).length - 1, Math.round(along(f.x, f.z) / 2)))]!;
      expect(f.y, `frame ${i} below deck`).toBeLessThan(deck.y);
    }
  });

  // C33 (unitário)
  it('the deck clears the road by 6.5 m', () => {
    const avenues = squareAvenues(network);
    for (const [i, p] of pts(line).entries()) {
      const n = nearestOn(avenues, p.x, p.z);
      expect(p.y - DECK_THICKNESS / 2 - n.y, `point ${i}`).toBeGreaterThanOrEqual(6.5);
    }
  });
});
