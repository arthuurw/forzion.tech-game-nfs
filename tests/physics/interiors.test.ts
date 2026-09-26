import RAPIER from '@dimforge/rapier3d-compat';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findBlockInteriors } from '../../src/world/interiors/BlockInteriors';
import { placeInteriorProps } from '../../src/world/interiors/InteriorProps';
import { generateLots } from '../../src/world/lots/LotGenerator';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateTerrain, heightAt } from '../../src/world/terrain/TerrainGenerator';
import { WorldPhysics } from '../../src/world/WorldPhysics';

// block-fill: colliders estáticos do miolo com o Rapier real e o WorldPhysics do seed 1337 (AD-011)
const raw = generateTerrain(1337);
const network = generateRoads(1337, raw);
const carved = carveRoads(raw, network);
const { lots } = generateLots(1337, network, carved);
const interiors = findBlockInteriors(carved, network, lots);
const props = placeInteriorProps(1337, interiors, lots, carved);

let world: RAPIER.World;
let physics: WorldPhysics;

beforeAll(async () => {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  physics = new WorldPhysics(world, carved, raw, network, lots, props);
}, 120_000);

afterAll(() => world?.free());

describe('interior colliders', () => {
  // C23 (AC 22)
  it('one collider per tree trunk', () => {
    expect(props.trees.length).toBeGreaterThan(0);
    expect(physics.trees.length).toBe(props.trees.length);
    props.trees.forEach((t, i) => {
      const c = physics.trees[i]!;
      const p = c.translation();
      expect(Math.abs(p.x - t.x)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(p.z - t.z)).toBeLessThanOrEqual(0.01);
      // tocando o chão: a base do collider fica no chão ou abaixo dele e o topo acima
      const half = c.halfHeight();
      const ground = heightAt(carved, t.x, t.z);
      expect(c.shapeType()).toBe(RAPIER.ShapeType.Cylinder);
      expect(p.y - half).toBeLessThanOrEqual(ground);
      expect(p.y + half).toBeGreaterThan(ground + 1);
    });
  });
});
