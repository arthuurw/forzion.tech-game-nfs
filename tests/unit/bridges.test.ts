import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { WorldPhysics } from '../../src/world/WorldPhysics';
import { generateTerrain, heightAt, riverCenterX, type Heightmap } from '../../src/world/terrain/TerrainGenerator';
import { generateRoads, markBridges, type Road } from '../../src/world/roads/RoadGenerator';
import { bridgeMeshes, bridgeParts, bridgeRuns, pillarBox, PILLAR_SIZE, RAIL_HEIGHT, RAIL_WIDTH, type TriMesh } from '../../src/world/roads/bridges';
import { pointHeading } from '../../src/world/roads/roadMesh';

const hm = generateTerrain(1337);
const net = generateRoads(1337, hm);

/**
 * Canto `c` (0 topo esquerdo, 1 topo direito, 2 fundo direito, 3 fundo esquerdo) da seção `k` de
 * uma extrusão de `m` seções. Cada face de cada segmento tem 4 vértices próprios (smooth-world
 * AC 16): o quad da face f do segmento s começa no vértice (s·4 + f)·4, com os cantos u e v da
 * face na seção s e depois na s + 1; o topo é a face 0 (cantos 0, 1) e o fundo a face 2 (2, 3).
 */
function corner(positions: Float32Array, m: number, k: number, c: number): [number, number, number] {
  const seg = Math.min(k, m - 2);
  const face = c < 2 ? 0 : 2;
  const v = (seg * 4 + face) * 4 + (k > seg ? 2 : 0) + (c % 2);
  return [positions[v * 3]!, positions[v * 3 + 1]!, positions[v * 3 + 2]!];
}

/** algum triângulo de `mesh` contém (x, z) no plano e passa a até 0.05 m de `y` ali? */
function covers(mesh: TriMesh, x: number, y: number, z: number): boolean {
  const P = mesh.positions;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [i, j, k] = [mesh.indices[t]! * 3, mesh.indices[t + 1]! * 3, mesh.indices[t + 2]! * 3];
    const det = (P[j]! - P[i]!) * (P[k + 2]! - P[i + 2]!) - (P[k]! - P[i]!) * (P[j + 2]! - P[i + 2]!);
    if (Math.abs(det) < 1e-9) continue;
    const u = ((x - P[i]!) * (P[k + 2]! - P[i + 2]!) - (P[k]! - P[i]!) * (z - P[i + 2]!)) / det;
    const v = ((P[j]! - P[i]!) * (z - P[i + 2]!) - (x - P[i]!) * (P[j + 2]! - P[i + 2]!)) / det;
    if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
    if (Math.abs(P[i + 1]! + (P[j + 1]! - P[i + 1]!) * u + (P[k + 1]! - P[i + 1]!) * v - y) <= 0.05) return true;
  }
  return false;
}

describe('bridges', () => {
  // smooth-world C20 (AC 15): estrada fechada com ponte sobre o índice 0
  it('bridge across the closed road seam', () => {
    // anel de raio 100 em volta da origem, um ponto a cada ~2 m, pista a 5 m; o índice 0 fica em (100, 0)
    const n = 314;
    const points = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      points.set([100 * Math.cos(a), 5, 100 * Math.sin(a)], i * 3);
    }
    // terreno a 5 m, com água (−5) numa faixa |z| < 14 do lado x > 0: o anel cruza a água em volta do índice 0
    const heights = new Float32Array(101 * 101);
    for (let iz = 0; iz < 101; iz++) {
      for (let ix = 0; ix < 101; ix++) heights[iz * 101 + ix] = -200 + ix * 4 > 0 && Math.abs(-200 + iz * 4) < 14 ? -5 : 5;
    }
    const hm: Heightmap = { size: 101, spacing: 4, origin: -200, heights };
    const ranges = markBridges(points, hm, true);
    // 1 trecho só, que começa antes da costura e termina depois dela
    expect(ranges).toHaveLength(1);
    const range = ranges[0]!;
    expect(range.from).toBeGreaterThan(n / 2);
    expect(range.from).toBeLessThan(n);
    expect(range.to).toBeGreaterThanOrEqual(n);
    expect(range.to - n).toBeLessThan(n / 2);
    // e aberto, o mesmo traçado corta o trecho em dois na costura
    expect(markBridges(points, hm)).toHaveLength(2);

    const road: Road = { id: 0, kind: 'highway', lanes: 6, width: 24, closed: true, points, bridges: ranges };
    const parts = bridgeParts(road, range, hm);
    const at = parts.indices.indexOf(n - 1);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(parts.indices[at + 1]).toBe(0);
    expect(parts.indices).toHaveLength(range.to - range.from + 1);
    const { deck, rails } = bridgeMeshes(road, parts);
    // tabuleiro e guarda-corpos com quad em todo segmento do trecho, inclusive n−1 → 0
    const w2 = road.width / 2;
    let segments = 0;
    for (let k = 0; k + 1 < parts.indices.length; k++) {
      const a = parts.indices[k]!;
      const b = parts.indices[k + 1]!;
      const mx = (points[a * 3]! + points[b * 3]!) / 2;
      const mz = (points[a * 3 + 2]! + points[b * 3 + 2]!) / 2;
      const h = Math.atan2(points[b * 3]! - points[a * 3]!, points[b * 3 + 2]! - points[a * 3 + 2]!);
      expect(covers(deck, mx, 5, mz), `tabuleiro ${a} → ${b}`).toBe(true);
      rails.forEach((rail, r) => {
        const off = (r === 0 ? 1 : -1) * (w2 - RAIL_WIDTH / 2);
        expect(covers(rail, mx + Math.cos(h) * off, 5 + RAIL_HEIGHT, mz - Math.sin(h) * off), `guarda-corpo ${r} ${a} → ${b}`).toBe(true);
      });
      segments++;
    }
    expect(segments).toBe(range.to - range.from);

    // por chunk: um chunk que acaba na costura ainda leva o segmento n−1 → 0, e os dois juntos levam todos uma vez
    expect(bridgeRuns(parts.indices, () => true)).toEqual([parts.indices]);
    const before = bridgeRuns(parts.indices, (i) => i >= n / 2);
    const after = bridgeRuns(parts.indices, (i) => i < n / 2);
    expect(before).toHaveLength(1);
    expect(before[0]!.slice(-2)).toEqual([n - 1, 0]);
    const segs = [...before, ...after].flatMap((run) => run.slice(1).map((b, k) => `${run[k]}-${b}`));
    expect(segs.sort()).toEqual(parts.indices.slice(1).map((b, k) => `${parts.indices[k]}-${b}`).sort());
  });

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

    // o seed 1337 não tem viaduto sobre vale seco (as 5 pontes cruzam o rio), então cada linha da
    // decisão de `markBridges` ganha um caso sintético: estrada reta em z = 0, pontos a cada 2 m de
    // x = -200 a 200 (índice i ↔ x = -200 + 2i), terreno que só varia em x (amostras a cada 4 m)
    const line = (y: number) => {
      const p = new Float32Array(201 * 3);
      for (let i = 0; i < 201; i++) {
        p[i * 3] = -200 + 2 * i;
        p[i * 3 + 1] = y;
      }
      return p;
    };
    const terrain = (h: (x: number) => number): Heightmap => {
      const heights = new Float32Array(101 * 101);
      for (let iz = 0; iz < 101; iz++) for (let ix = 0; ix < 101; ix++) heights[iz * 101 + ix] = h(-200 + ix * 4);
      return { size: 101, spacing: 4, origin: -200, heights };
    };
    // viaduto sobre vale SECO (door 6, "mais de 4 m acima do terreno original"): pista em 20, vale até 2 (acima da água)
    const valley = terrain((x) => 20 - 18 * Math.max(0, 1 - Math.abs(x) / 60));
    // mais de 4 m acima: |x| ≤ 46 (i 77..123); a ponte se estende enquanto a pista está a mais de 1.5 m do
    // terreno, |x| ≤ 54 (i 73..127), mais 3 pontos de folga de cada lado
    expect(markBridges(line(20), valley)).toEqual([{ from: 70, to: 130 }]);
    // só água (pista a 3.5 m do leito, abaixo do limite de 4 m): leito a -3 em |x| ≤ 8, margem a 0 em |x| ≥ 12;
    // água (< -2) em |x| ≤ 8 (i 96..104), pista a mais de 1.5 m do terreno em |x| ≤ 10 (i 95..105), mais a folga
    const river = terrain((x) => -3 * Math.min(1, Math.max(0, (12 - Math.abs(x)) / 4)));
    expect(markBridges(line(0.5), river)).toEqual([{ from: 92, to: 108 }]);
    // nem água nem alto: pista 1 m acima de terreno plano, sem ponte
    expect(markBridges(line(1), terrain(() => 0))).toEqual([]);
  });

  // C27 (AC 21, door 6)
  it('deck rails and pillars', async () => {
    let checked = 0;
    for (const r of net.roads) {
      for (const range of r.bridges) {
        const parts = bridgeParts(r, range, hm);
        const { deck, rails } = bridgeMeshes(r, parts);
        // tabuleiro: por ponto, topo na altura da estrada e fundo 0.8 abaixo, bordas a ±width/2
        const m = parts.indices.length;
        parts.indices.forEach((i, k) => {
          const y = r.points[i * 3 + 1]!;
          const x = r.points[i * 3]!;
          const z = r.points[i * 3 + 2]!;
          const ys = [0, 1, 2, 3].map((c) => corner(deck.positions, m, k, c)[1]);
          expect(ys[0]).toBeCloseTo(y, 4);
          expect(ys[1]).toBeCloseTo(y, 4);
          expect(ys[2]).toBeCloseTo(y - 0.8, 4);
          expect(ys[3]).toBeCloseTo(y - 0.8, 4);
          for (const v of [0, 1]) {
            const [vx, , vz] = corner(deck.positions, m, k, v);
            expect(Math.hypot(vx - x, vz - z)).toBeCloseTo(r.width / 2, 3);
          }
          // guarda-corpos: 1 m de altura acima do tabuleiro, face externa em ±width/2, um de cada lado
          const h = pointHeading(r, i);
          const sides = rails.map((rail) => {
            const topY = corner(rail.positions, m, k, 0)[1];
            const botY = corner(rail.positions, m, k, 2)[1];
            expect(topY - botY).toBeCloseTo(1, 4);
            expect(botY).toBeCloseTo(y, 4);
            const lat = [0, 1].map((v) => {
              const vx = corner(rail.positions, m, k, v)[0] - x;
              const vz = corner(rail.positions, m, k, v)[2] - z;
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
          // seção de 1.5 × 1.5 m centrada no pilar, de `bottom` a `top` (a malha do render)
          const box = pillarBox(pl.x, pl.z, pl.bottom, pl.top, pl.heading).positions;
          const c = (v: number) => [box[v * 3]!, box[v * 3 + 1]!, box[v * 3 + 2]!] as const;
          for (const [base, y] of [[0, pl.bottom], [4, pl.top]] as const) {
            const q = [0, 1, 2, 3].map((v) => c(base + v));
            for (const v of q) expect(v[1]).toBeCloseTo(y, 4);
            for (let e = 0; e < 4; e++) {
              const [a, b] = [q[e]!, q[(e + 1) % 4]!];
              expect(Math.hypot(a[0] - b[0], a[2] - b[2])).toBeCloseTo(1.5, 3);
            }
            expect(Math.hypot(q[0]![0] - q[2]![0], q[0]![2] - q[2]![2])).toBeCloseTo(1.5 * Math.SQRT2, 3);
            expect(q.reduce((s, v) => s + v[0], 0) / 4).toBeCloseTo(pl.x, 3);
            expect(q.reduce((s, v) => s + v[2], 0) / 4).toBeCloseTo(pl.z, 3);
          }
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(10);
    expect(PILLAR_SIZE).toBe(1.5);

    // o collider de física de cada pilar, lido do Rapier: cuboide 1.5 × 1.5 de `bottom` a `top`, girado pelo heading
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const physics = new WorldPhysics(world, hm, hm, net, []);
    const expected = net.roads.flatMap((r) => r.bridges.flatMap((range) => bridgeParts(r, range, hm).pillars));
    expect(physics.pillars.length).toBe(expected.length);
    expected.forEach((pl, k) => {
      const c = physics.pillars[k]!;
      const he = c.halfExtents()!;
      expect(he.x).toBeCloseTo(0.75, 4);
      expect(he.z).toBeCloseTo(0.75, 4);
      expect(he.y).toBeCloseTo((pl.top - pl.bottom) / 2, 4);
      const t = c.translation();
      expect(t.x).toBeCloseTo(pl.x, 3);
      expect(t.y).toBeCloseTo((pl.top + pl.bottom) / 2, 3);
      expect(t.z).toBeCloseTo(pl.z, 3);
      const q = c.rotation();
      expect(Math.abs(q.x) + Math.abs(q.z)).toBeLessThan(1e-6);
      const yawErr = Math.atan2(Math.sin(2 * Math.atan2(q.y, q.w) - pl.heading), Math.cos(2 * Math.atan2(q.y, q.w) - pl.heading));
      expect(Math.abs(yawErr)).toBeLessThan(1e-4);
    });
    world.free();
  });
});
