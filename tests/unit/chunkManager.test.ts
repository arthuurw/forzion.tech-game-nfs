import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ChunkManager } from '../../src/world/ChunkManager';
import { CHUNK_BUILD_M, chunkCenter, chunkOf } from '../../src/world/chunks';
import { bridgeMeshes, bridgeParts, bridgeRuns } from '../../src/world/roads/bridges';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';

// test-hardening C19 (AC 15): o contador por quadro conta o trabalho entre dois quadros, não o tamanho do plano.
// smooth-world door 3 troca builds por fatias de build (Impact: world.spec "chunks stream around the car")
const raw = generateTerrain(1337);
const network = generateRoads(1337, raw);
const carved = carveRoads(raw, network);
const m = new THREE.MeshBasicMaterial();
const materials = { terrain: m, roadDowntown: m, roadOuter: m, sidewalk: m, bridge: m };
const bridges = network.roads.flatMap((road) => road.bridges.map((range) => ({ road, parts: bridgeParts(road, range, raw) })));

describe('ChunkManager', () => {
  it('max slices counts slices between frames', () => {
    // dois `update` no mesmo quadro, com chunks faltando perto de (0, 0): 2 fatias num quadro
    const twice = new ChunkManager(new THREE.Scene(), carved, network, [], materials);
    twice.update(0, 0);
    twice.update(0, 0);
    twice.endFrame();
    expect(twice.slices).toBe(2);
    expect(twice.maxSlicesInOneFrame).toBe(2);

    // um `update` por quadro: nunca mais que 1
    const once = new ChunkManager(new THREE.Scene(), carved, network, [], materials);
    once.update(0, 0);
    once.endFrame();
    once.update(0, 0);
    once.endFrame();
    expect(once.slices).toBe(2);
    expect(once.maxSlicesInOneFrame).toBe(1);
  });

  // smooth-world C15 (AC 11, door 3)
  it('one build slice per update', () => {
    const cm = new ChunkManager(new THREE.Scene(), carved, network, [], materials);
    const near = Array.from({ length: 36 }, (_, id) => id).filter((id) => Math.hypot(...chunkCenter(id)) <= CHUNK_BUILD_M);
    const pending = () => near.filter((id) => !cm.loaded.has(id)).length;
    expect(near.length).toBeGreaterThanOrEqual(5);
    // até sobrarem 5 chunks pendentes
    for (let k = 0; pending() > 5 && k < 1000; k++) cm.update(0, 0);
    expect(pending()).toBe(5);
    // daí em diante, cada `update` roda exatamente 1 fatia enquanto falta chunk, e um chunk são 6 fatias
    // (4 faixas de terreno de até 33 das 129 linhas, estradas e calçadas, pontes e pilares)
    const startSlices = cm.slices;
    const startBuilds = cm.builds;
    let calls = 0;
    while (pending() > 0 && calls < 1000) {
      const before = cm.slices;
      cm.update(0, 0);
      calls++;
      expect(cm.slices - before).toBe(1);
    }
    expect(pending()).toBe(0);
    expect(cm.builds - startBuilds).toBe(5);
    expect(cm.slices - startSlices).toBe(calls);
    expect(calls).toBeLessThanOrEqual(5 * 6);
    expect(calls).toBeGreaterThan(4 * 6);
    // sem nada pendente: nenhuma fatia
    const idle = cm.slices;
    cm.update(0, 0);
    expect(cm.slices).toBe(idle);
  });

  // smooth-world C21 (AC 16): calçada, tabuleiro, guarda-corpo e pilar com a normal da própria face
  it('extrusions have flat face normals', () => {
    const cm = new ChunkManager(new THREE.Scene(), carved, network, bridges, materials);
    const counts = { sidewalk: 0, bridge: 0 };
    let worst = 0;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const face = new THREE.Vector3();
    const vn = new THREE.Vector3();
    for (let id = 0; id < 36; id++) {
      const group = cm.buildNow(id);
      // o tabuleiro, os guarda-corpos e os pilares deste chunk, montados direto: a malha `bridge` é a soma deles
      let expectedBridgeTris = 0;
      for (const { road, parts } of bridges) {
        const inChunk = (i: number) => chunkOf(road.points[i * 3]!, road.points[i * 3 + 2]!) === id;
        for (const run of bridgeRuns(parts.indices, inChunk)) {
          const { deck, rails } = bridgeMeshes(road, { indices: run, pillars: [] });
          expectedBridgeTris += (deck.indices.length + rails[0]!.indices.length + rails[1]!.indices.length) / 3;
        }
        expectedBridgeTris += parts.pillars.filter((p) => chunkOf(p.x, p.z) === id).length * 12;
      }
      const bridgeMesh = group.getObjectByName('bridge') as THREE.Mesh | undefined;
      expect(bridgeMesh ? bridgeMesh.geometry.index!.count / 3 : 0, `chunk ${id} bridge`).toBe(expectedBridgeTris);
      for (const name of ['sidewalk', 'bridge'] as const) {
        const mesh = group.getObjectByName(name) as THREE.Mesh | undefined;
        if (!mesh) continue;
        const pos = mesh.geometry.getAttribute('position');
        const nor = mesh.geometry.getAttribute('normal');
        const idx = mesh.geometry.index!;
        for (let t = 0; t < idx.count; t += 3) {
          const v = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
          a.fromBufferAttribute(pos, v[0]!);
          b.fromBufferAttribute(pos, v[1]!);
          c.fromBufferAttribute(pos, v[2]!);
          face.subVectors(c, b).cross(a.sub(b)).normalize();
          for (const k of v) {
            const deg = (vn.fromBufferAttribute(nor, k).angleTo(face) * 180) / Math.PI;
            if (deg > worst) worst = deg;
            if (deg > 1) expect.fail(`chunk ${id} ${name} triângulo ${t / 3}: normal do vértice a ${deg.toFixed(2)}° da face`);
          }
          counts[name]++;
        }
      }
    }
    expect(counts.sidewalk).toBeGreaterThan(1000);
    expect(counts.bridge).toBeGreaterThan(1000);
    expect(worst).toBeLessThanOrEqual(1);
  });
});
