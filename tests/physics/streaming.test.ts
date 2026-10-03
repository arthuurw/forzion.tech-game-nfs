import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ChunkManager, TERRAIN_BAND_ROWS } from '../../src/world/ChunkManager';
import { chunkCenter } from '../../src/world/chunks';
import { findBlockInteriors } from '../../src/world/interiors/BlockInteriors';
import { generateLots } from '../../src/world/lots/LotGenerator';
import { bridgeParts } from '../../src/world/roads/bridges';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';

// smooth-world S4: build de chunk em fatias (door 3) com o ChunkManager real do seed 1337, em node.
// Mesma montagem do jogo (CityScene): pontes da rede, miolo das quadras e o seed.
const raw = generateTerrain(1337);
const network = generateRoads(1337, raw);
const carved = carveRoads(raw, network);
const { lots } = generateLots(1337, network, carved);
const interiors = findBlockInteriors(carved, network, lots);
const bridges = network.roads.flatMap((road) => road.bridges.map((range) => ({ road, parts: bridgeParts(road, range, raw) })));
const m = new THREE.MeshBasicMaterial();
const materials = { terrain: m, roadDowntown: m, roadOuter: m, sidewalk: m, bridge: m };
const manager = () => new ChunkManager(new THREE.Scene(), carved, network, bridges, materials, interiors, 1337);

/** as 3 partes do build: terreno; estradas e calçadas; pontes e pilares */
const PARTS: Record<string, string[]> = {
  terreno: ['terrain'],
  'estradas e calçadas': ['road-downtown', 'road-outer', 'sidewalk'],
  'pontes e pilares': ['bridge'],
};

describe('chunk streaming', () => {
  // C17 (AC 13, door 3)
  it('sliced build equals the one-shot build', { timeout: 300_000 }, () => {
    expect(TERRAIN_BAND_ROWS).toBeLessThanOrEqual(33);
    const vertices: Record<string, number> = {};
    for (let id = 0; id < 36; id++) {
      // em fatias: o `update` com o carro no centro do chunk, até ele entrar na cena
      const sliced = manager();
      const [x, z] = chunkCenter(id);
      while (!sliced.loaded.has(id) && sliced.slices < 100) sliced.update(x, z);
      // o terreno em 4 faixas (129 linhas, até 33 por faixa), estradas e calçadas, pontes e pilares
      expect(sliced.slices, `chunk ${id}`).toBe(Math.ceil(129 / TERRAIN_BAND_ROWS) + 2);
      const a = sliced.loaded.get(id)!;
      const b = manager().buildNow(id);
      for (const [part, names] of Object.entries(PARTS)) {
        for (const name of names) {
          const ma = a.getObjectByName(name) as THREE.Mesh | undefined;
          const mb = b.getObjectByName(name) as THREE.Mesh | undefined;
          expect(Boolean(ma), `chunk ${id} ${part} ${name}`).toBe(Boolean(mb));
          if (!ma || !mb) continue;
          const pa = ma.geometry.getAttribute('position');
          const pb = mb.geometry.getAttribute('position');
          expect(pa.count, `chunk ${id} ${name} vértices`).toBe(pb.count);
          expect(ma.geometry.index!.count, `chunk ${id} ${name} índices`).toBe(mb.geometry.index!.count);
          let worst = 0;
          for (let k = 0; k < pa.count; k++) {
            worst = Math.max(worst, Math.abs(pa.getX(k) - pb.getX(k)), Math.abs(pa.getY(k) - pb.getY(k)), Math.abs(pa.getZ(k) - pb.getZ(k)));
          }
          expect(worst, `chunk ${id} ${name} posições`).toBeLessThanOrEqual(1e-6);
          vertices[part] = (vertices[part] ?? 0) + pa.count;
        }
      }
    }
    // as 3 partes existem no seed 1337
    for (const part of Object.keys(PARTS)) expect(vertices[part], part).toBeGreaterThan(1000);
  });

  // C16 (AC 12): nenhuma chamada a `update` passa de 8 ms com o carro dando a volta no anel
  it('chunk update stays under 8 ms around the ring', { timeout: 300_000 }, () => {
    const ring = network.roads.find((r) => r.kind === 'highway')!;
    const n = ring.points.length / 3;
    /** uma volta no anel a passos de 2 m (os pontos do anel), boot no ponto 0; ms de cada `update` */
    const lap = (): { ms: number[]; slices: number } => {
      const cm = manager();
      cm.prebuild(ring.points[0]!, ring.points[2]!);
      const ms: number[] = [];
      for (let i = 0; i <= n; i++) {
        const k = i % n;
        const t0 = performance.now();
        cm.update(ring.points[k * 3]!, ring.points[k * 3 + 2]!);
        ms.push(performance.now() - t0);
        cm.endFrame();
      }
      return { ms, slices: cm.slices };
    };
    // JIT aquecido: uma volta antes de medir
    lap();
    // a mesma volta 5 vezes (o trabalho de cada chamada é o mesmo em toda volta); de cada chamada fica a
    // menor das 5, que tira a pausa do coletor e a disputa com outros testes rodando ao lado
    const laps = [lap(), lap(), lap(), lap(), lap()];
    expect(laps[0]!.slices).toBeGreaterThan(60);
    const best = laps[0]!.ms.map((_, i) => Math.min(...laps.map((l) => l.ms[i]!)));
    const worst = Math.max(...best);
    const at = best.indexOf(worst);
    expect(worst, `chamada ${at} (ponto ${at % n} do anel)`).toBeLessThanOrEqual(8);
  });
});
