import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/world/CityGenerator';
import { findBlockInteriors } from '../../src/world/interiors/BlockInteriors';
import { placeInteriorProps } from '../../src/world/interiors/InteriorProps';
import { createCat, createWalker, stepCat, stepWalker, type CarPose } from '../../src/world/interiors/interiorMotion';
import { generateLots, type Lot } from '../../src/world/lots/LotGenerator';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateTerrain, heightAt } from '../../src/world/terrain/TerrainGenerator';
import { WorldPhysics } from '../../src/world/WorldPhysics';

// smooth-world S3 e S5 no mundo do seed 1337: chão caminhável e uma altura de chão só (AD-011)
const raw = generateTerrain(1337);
const network = generateRoads(1337, raw);
const carved = carveRoads(raw, network);
const { lots } = generateLots(1337, network, carved);
const interiors = findBlockInteriors(carved, network, lots);
const props = placeInteriorProps(1337, interiors, lots, carved);
const DT = 1 / 60;
/** folga mínima do centro do corpo ao footprint de todo lote (AC 7, AC 8) */
const CLEAR = 0.25;

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

/** distância com sinal de (x, z) ao retângulo girado do lote: negativa dentro */
function signedLotDistance(l: Lot, x: number, z: number): number {
  const dx = x - l.x;
  const dz = z - l.z;
  // `width` ao longo de (sin r, cos r), `depth` ao longo de (cos r, −sin r)
  const u = Math.abs(dx * Math.sin(l.rotation) + dz * Math.cos(l.rotation)) - l.width / 2;
  const v = Math.abs(dx * Math.cos(l.rotation) - dz * Math.sin(l.rotation)) - l.depth / 2;
  return u <= 0 && v <= 0 ? Math.max(u, v) : Math.hypot(Math.max(u, 0), Math.max(v, 0));
}

/** menor distância com sinal de (x, z) a todo lote: grade de 32 m com os lotes que chegam a 2 m de cada célula */
const nearLots = (() => {
  const cell = 32;
  const grid = new Map<string, Lot[]>();
  for (const l of lots) {
    const r = Math.hypot(l.width, l.depth) / 2 + 2;
    for (let cx = Math.floor((l.x - r) / cell); cx <= Math.floor((l.x + r) / cell); cx++) {
      for (let cz = Math.floor((l.z - r) / cell); cz <= Math.floor((l.z + r) / cell); cz++) {
        const k = `${cx},${cz}`;
        const c = grid.get(k);
        if (c) c.push(l);
        else grid.set(k, [l]);
      }
    }
  }
  return (x: number, z: number): number => {
    let d = Infinity;
    for (const l of grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []) d = Math.min(d, signedLotDistance(l, x, z));
    return d;
  };
})();

/** `count` itens espalhados pela lista inteira (a lista vai zona a zona) */
function spread<T>(list: T[], count: number): T[] {
  return Array.from({ length: count }, (_, i) => list[Math.floor((i * list.length) / count)]!);
}

describe('walkable ground', () => {
  // C11 (AC 7)
  it('walkers never enter a lot', { timeout: 300_000 }, () => {
    expect(props.walkers.length).toBeGreaterThanOrEqual(400);
    const spawns = spread(props.walkers, 400);
    let samples = 0;
    let near = 0;
    let fled = 0;
    let worst = Infinity;
    for (const how of ['longe', 'parado a 5 m', 'passando a 8 m/s'] as const) {
      spawns.forEach((spawn, i) => {
        const w = createWalker(spawn, i);
        const heading = (i * 2.399) % (2 * Math.PI);
        const f = { x: Math.sin(heading), z: Math.cos(heading) };
        const car: CarPose =
          how === 'longe'
            ? { x: 99_999, z: 99_999, heading: 0 }
            : how === 'parado a 5 m'
              ? { x: w.x + Math.cos(heading) * 5, z: w.z - Math.sin(heading) * 5, heading }
              : { x: w.x - f.x * 20, z: w.z - f.z * 20, heading };
        for (let step = 0; step < 40 * 60; step++) {
          if (how === 'passando a 8 m/s') {
            car.x += f.x * 8 * DT;
            car.z += f.z * 8 * DT;
          }
          stepWalker(w, DT, car, interiors);
          if (w.fleeing) fled++;
          const d = nearLots(w.x, w.z);
          samples++;
          if (d < 5) near++;
          if (d < worst) worst = d;
          if (d < CLEAR) expect.fail(`pedestre ${i} (${how}), passo ${step}: (${w.x.toFixed(2)}, ${w.z.toFixed(2)}) a ${d.toFixed(3)} m de um lote`);
        }
      });
    }
    expect(samples).toBe(3 * 400 * 40 * 60);
    // a prova passa perto de prédios e com fuga
    expect(near).toBeGreaterThan(1000);
    expect(fled).toBeGreaterThan(1000);
    expect(worst).toBeGreaterThanOrEqual(CLEAR);
  });

  // C12 (AC 8)
  it('cats never enter a lot', { timeout: 300_000 }, () => {
    expect(props.cats.length).toBeGreaterThanOrEqual(200);
    const spawns = spread(props.cats, 200);
    let samples = 0;
    let near = 0;
    let fled = 0;
    let worst = Infinity;
    for (const speed of [8, 20]) {
      spawns.forEach((spawn, i) => {
        const c = createCat(spawn, i);
        const heading = (i * 2.399) % (2 * Math.PI);
        const f = { x: Math.sin(heading), z: Math.cos(heading) };
        const car: CarPose = { x: c.x - f.x * 20, z: c.z - f.z * 20, heading };
        for (let step = 0; step < 40 * 60; step++) {
          car.x += f.x * speed * DT;
          car.z += f.z * speed * DT;
          stepCat(c, DT, car, interiors);
          if (c.state === 'gone') continue;
          if (c.state === 'flee') fled++;
          const d = nearLots(c.x, c.z);
          samples++;
          if (d < 5) near++;
          if (d < worst) worst = d;
          if (d < CLEAR) expect.fail(`gato ${i} a ${speed} m/s, passo ${step}: (${c.x.toFixed(2)}, ${c.z.toFixed(2)}) a ${d.toFixed(3)} m de um lote`);
        }
      });
    }
    expect(samples).toBeGreaterThan(200 * 40 * 60);
    expect(near).toBeGreaterThan(1000);
    expect(fled).toBeGreaterThan(100);
    expect(worst).toBeGreaterThanOrEqual(CLEAR);
  });
});

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
