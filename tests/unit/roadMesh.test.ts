import { describe, expect, it } from 'vitest';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { pointHeading, roadStripGeometry } from '../../src/world/roads/roadMesh';
import { bridgeMeshes, bridgeParts } from '../../src/world/roads/bridges';

const hm = generateTerrain(1337);
const net = generateRoads(1337, hm);

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

// C46 (AC 18, AC 21): faces para fora (FrontSide) - a pista para cima, as caixas de ponte para fora
describe('road mesh winding', () => {
  const tri = (P: Float32Array, i: number, j: number, k: number) => {
    const a = [P[j * 3]! - P[i * 3]!, P[j * 3 + 1]! - P[i * 3 + 1]!, P[j * 3 + 2]! - P[i * 3 + 2]!];
    const b = [P[k * 3]! - P[i * 3]!, P[k * 3 + 1]! - P[i * 3 + 1]!, P[k * 3 + 2]! - P[i * 3 + 2]!];
    const n = [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
    const c = [0, 1, 2].map((o) => (P[i * 3 + o]! + P[j * 3 + o]! + P[k * 3 + o]!) / 3);
    return { n, c };
  };

  it('road strip faces up and bridge boxes face out', () => {
    for (const road of net.roads) {
      const g = roadStripGeometry(road);
      for (let t = 0; t < g.indices.length; t += 3) {
        const { n } = tri(g.positions, g.indices[t]!, g.indices[t + 1]!, g.indices[t + 2]!);
        if (!(n[1]! > 0)) throw new Error(`road ${road.id} triangle ${t / 3} faces down`);
      }
    }
    const road = net.roads.find((r) => r.bridges.length > 0)!;
    const parts = bridgeParts(road, road.bridges[0]!, hm);
    const { deck, rails } = bridgeMeshes(road, parts);
    for (const [name, mesh, offset] of [['deck', deck, 0], ...rails.map((r, i) => [`rail ${i}`, r, i === 0 ? 1 : -1] as const)] as const) {
      for (let t = 0; t < mesh.indices.length; t += 3) {
        const [i, j, k] = [mesh.indices[t]!, mesh.indices[t + 1]!, mesh.indices[t + 2]!];
        const { n, c } = tri(mesh.positions, i, j, k);
        // centro da seção do ponto de estrada da face: eixo deslocado para o lado do guarda-corpo
        // nas tampas (os 3 vértices na mesma seção) a referência é a seção vizinha, para dentro da caixa
        const m = parts.indices.length;
        let sec = Math.floor(i / 4);
        if (Math.floor(j / 4) === sec && Math.floor(k / 4) === sec) sec = sec === 0 ? 1 : m - 2;
        const idx = parts.indices[Math.min(m - 1, sec)]!;
        const h = Math.atan2(road.points[Math.min(road.points.length / 3 - 1, idx + 1) * 3]! - road.points[Math.max(0, idx - 1) * 3]!, road.points[Math.min(road.points.length / 3 - 1, idx + 1) * 3 + 2]! - road.points[Math.max(0, idx - 1) * 3 + 2]!);
        const lat = (road.width / 2 - 0.15) * offset;
        const center = [
          road.points[idx * 3]! + Math.cos(h) * lat,
          road.points[idx * 3 + 1]! + (name === 'deck' ? -0.4 : 0.5),
          road.points[idx * 3 + 2]! - Math.sin(h) * lat,
        ];
        const out = n[0]! * (c[0]! - center[0]!) + n[1]! * (c[1]! - center[1]!) + n[2]! * (c[2]! - center[2]!);
        if (!(out > 0)) throw new Error(`${name} triangle ${t / 3} faces in`);
      }
    }
  });
});
