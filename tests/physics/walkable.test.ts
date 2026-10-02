import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/world/CityGenerator';
import { generateLots } from '../../src/world/lots/LotGenerator';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateTerrain, heightAt } from '../../src/world/terrain/TerrainGenerator';
import { WorldPhysics } from '../../src/world/WorldPhysics';

// smooth-world S3 e S5 no mundo do seed 1337: chão caminhável e uma altura de chão só (AD-011)
const raw = generateTerrain(1337);
const network = generateRoads(1337, raw);
const carved = carveRoads(raw, network);
const { lots } = generateLots(1337, network, carved);

let world: RAPIER.World;

beforeAll(async () => {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  new WorldPhysics(world, carved, raw, network, lots);
  // o heightfield só existe depois de o mundo montar a estrutura de busca
  world.step();
}, 120_000);

/** altura do heightfield do Rapier sob (x, z): raio vertical de y = 400, só contra o heightfield */
function groundRay(x: number, z: number): number | null {
  const ray = new RAPIER.Ray({ x, y: 400, z }, { x: 0, y: -1, z: 0 });
  const hit = world.castRay(ray, 1000, true, undefined, undefined, undefined, undefined, (c) => c.shapeType() === RAPIER.ShapeType.HeightField);
  return hit ? 400 - hit.timeOfImpact : null;
}

describe('one ground height', () => {
  // C18 (AC 14)
  it('heightAt matches the physics heightfield', () => {
    const rng = mulberry32(0x5eed18);
    let worst = 0;
    let hits = 0;
    for (let i = 0; i < 20_000; i++) {
      const x = -1530 + rng() * 3060;
      const z = -1530 + rng() * 3060;
      const g = groundRay(x, z);
      expect(g, `raio em (${x}, ${z})`).not.toBeNull();
      const d = Math.abs(heightAt(carved, x, z) - g!);
      if (d > worst) worst = d;
      hits++;
    }
    expect(hits).toBe(20_000);
    expect(worst).toBeLessThanOrEqual(0.005);
  });
});
