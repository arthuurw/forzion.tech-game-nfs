import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ChunkManager } from '../../src/world/ChunkManager';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';

// test-hardening C19 (AC 15): `maxBuildsInOneFrame` conta builds entre dois quadros, não o tamanho do plano
const raw = generateTerrain(1337);
const network = generateRoads(1337, raw);
const carved = carveRoads(raw, network);
const m = new THREE.MeshBasicMaterial();
const materials = { terrain: m, roadDowntown: m, roadOuter: m, sidewalk: m, bridge: m };

describe('ChunkManager', () => {
  it('max builds counts builds between frames', () => {
    // dois `update` no mesmo quadro, com chunks faltando perto de (0, 0): 2 builds num quadro
    const twice = new ChunkManager(new THREE.Scene(), carved, network, [], materials);
    twice.update(0, 0);
    twice.update(0, 0);
    twice.endFrame();
    expect(twice.builds).toBe(2);
    expect(twice.maxBuildsInOneFrame).toBe(2);

    // um `update` por quadro: nunca mais que 1
    const once = new ChunkManager(new THREE.Scene(), carved, network, [], materials);
    once.update(0, 0);
    once.endFrame();
    once.update(0, 0);
    once.endFrame();
    expect(once.builds).toBe(2);
    expect(once.maxBuildsInOneFrame).toBe(1);
  });
});
