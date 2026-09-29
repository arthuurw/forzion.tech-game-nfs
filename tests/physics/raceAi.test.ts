import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Assets } from '../../src/core/Loader';
import { AI_PAINTS, AI_SKILLS, prepareRoute } from '../../src/race/aiDriver';
import { Opponent, PLACE_HEIGHT } from '../../src/race/Opponent';
import { generateRaces, type RaceDef } from '../../src/race/raceRoutes';
import { resetTarget } from '../../src/race/raceSession';
import { Car } from '../../src/vehicle/Car';
import { DEFAULT_CAR } from '../../src/vehicle/carSpec';
import type { DriveInput } from '../../src/vehicle/drivetrain';
import { findBlockInteriors } from '../../src/world/interiors/BlockInteriors';
import { placeInteriorProps } from '../../src/world/interiors/InteriorProps';
import { generateLots } from '../../src/world/lots/LotGenerator';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';
import { WorldPhysics } from '../../src/world/WorldPhysics';

// races C20, C22, C23, C25: oponentes com o Rapier real no mundo físico do seed 1337 (AD-011)
const DT = 1 / 60;
const ASSETS: Assets = { carModel: null, placeholder: true, textures: {}, loadedSets: [], failedSets: [] };
const raw = generateTerrain(1337);
const network = generateRoads(1337, raw);
const carved = carveRoads(raw, network);
const { lots } = generateLots(1337, network, carved);
const props = placeInteriorProps(1337, findBlockInteriors(carved, network, lots), lots, carved);
const races = generateRaces(network);
const byId = (id: string): RaceDef => races.find((r) => r.id === id)!;

beforeAll(async () => {
  await RAPIER.init();
}, 120_000);

function makeWorld(): RAPIER.World {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  new WorldPhysics(world, carved, raw, network, lots, props);
  return world;
}

/** Corre um oponente sozinho até chegar ou `maxS` segundos; devolve tempo e resets. */
function runAlone(world: RAPIER.World, race: RaceDef, index: number, maxS: number): { time: number; finished: boolean; resets: number } {
  const op = new Opponent(world, new THREE.Scene(), ASSETS, race, prepareRoute(race.route), index);
  op.startClock(0);
  let steps = 0;
  while (!op.progress.finished && steps < maxS * 60) {
    op.drive(DT, false);
    world.step();
    steps++;
    op.track(steps * DT, true);
  }
  const out = { time: op.progress.finishTime ?? steps * DT, finished: op.progress.finished, resets: op.resets };
  op.dispose();
  return out;
}

describe('race opponents in the real world', () => {
  // C20
  it('ai is driven only through DriveInput', () => {
    const race = byId('sprint-cruzada');
    const a = makeWorld();
    const op = new Opponent(a, new THREE.Scene(), ASSETS, race, prepareRoute(race.route), 0);
    op.startClock(0);
    const inputs: DriveInput[] = [];
    const trace: Array<{ p: RAPIER.Vector; q: RAPIER.Rotation }> = [];
    for (let k = 0; k < 20 * 60; k++) {
      inputs.push({ ...op.drive(DT, false) });
      a.step();
      op.track((k + 1) * DT, true);
      trace.push({ p: { ...op.car.body.translation() }, q: { ...op.car.body.rotation() } });
    }
    expect(op.resets).toBe(0);

    const b = makeWorld();
    const slot = race.grid[0]!;
    const car = new Car(b, new THREE.Scene(), ASSETS, { x: slot.x, y: slot.y + PLACE_HEIGHT, z: slot.z }, DEFAULT_CAR, AI_PAINTS[0]);
    car.teleport(slot.x, slot.y + PLACE_HEIGHT, slot.z, slot.heading);
    for (let k = 0; k < inputs.length; k++) {
      car.fixedUpdate(inputs[k]!, DT);
      b.step();
      const p = car.body.translation();
      const q = car.body.rotation();
      const e = trace[k]!;
      expect(Math.hypot(p.x - e.p.x, p.y - e.p.y, p.z - e.p.z), `step ${k}`).toBeLessThanOrEqual(1e-4);
      expect(Math.max(Math.abs(q.x - e.q.x), Math.abs(q.y - e.q.y), Math.abs(q.z - e.q.z), Math.abs(q.w - e.q.w)), `step ${k}`).toBeLessThanOrEqual(1e-4);
    }
  }, 300_000);

  // C22
  // tag `slow`: fora do `npm run test:quick` (test-hardening door 2a); o `npm test` roda
  it('each opponent finishes every race in time', { tags: ['slow'], timeout: 900_000 }, () => {
    const world = makeWorld();
    for (const race of races) {
      const times: number[] = [];
      for (let k = 0; k < AI_SKILLS.length; k++) {
        const r = runAlone(world, race, k, 420);
        expect(r.finished, `${race.id} skill ${AI_SKILLS[k]}`).toBe(true);
        expect(r.time, `${race.id} skill ${AI_SKILLS[k]}`).toBeLessThan(420);
        expect(r.resets, `${race.id} skill ${AI_SKILLS[k]}`).toBeLessThanOrEqual(1);
        times.push(r.time);
      }
      // 0.95 < 0.88 < 0.80
      expect(times[2], race.id).toBeLessThan(times[1]!);
      expect(times[1], race.id).toBeLessThan(times[0]!);
    }
  });

  // C23
  it('stuck opponent is reset to its last gate', () => {
    const race = byId('sprint-cruzada');
    const world = makeWorld();
    const op = new Opponent(world, new THREE.Scene(), ASSETS, race, prepareRoute(race.route), 1);
    op.startClock(0);
    let k = 0;
    const step = () => {
      op.drive(DT, false);
      world.step();
      k++;
      op.track(k * DT, true);
    };
    while (op.progress.lastGate < 0 && k < 60 * 60) step();
    expect(op.progress.lastGate).toBe(0);
    // parede fixa atravessando a pista 25 m à frente do carro
    const t = op.car.body.translation();
    const h = op.car.heading();
    const wx = t.x + Math.sin(h) * 25;
    const wz = t.z + Math.cos(h) * 25;
    const wall = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(wx, t.y, wz).setRotation({ x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) }));
    world.createCollider(RAPIER.ColliderDesc.cuboid(30, 6, 1), wall);
    let stoppedAt = -1;
    while (op.resets === 0 && k < 120 * 60) {
      step();
      if (stoppedAt < 0 && Math.abs(op.car.speedKmh()) < 1) stoppedAt = k * DT;
    }
    expect(stoppedAt).toBeGreaterThan(0);
    expect(op.resets).toBe(1);
    // test-hardening C17 (AC 13): nem antes da janela de 4 s, nem muito depois
    expect(k * DT - stoppedAt).toBeGreaterThanOrEqual(3.9);
    expect(k * DT - stoppedAt).toBeLessThanOrEqual(4.1);
    const target = resetTarget(race, op.progress.lastGate, 1);
    const p = op.car.body.translation();
    expect(Math.hypot(p.x - target.x, p.z - target.z)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(op.car.speedKmh())).toBeLessThan(1);
    const d = Math.atan2(Math.sin(op.car.heading() - target.heading), Math.cos(op.car.heading() - target.heading));
    expect(Math.abs(d)).toBeLessThanOrEqual((5 * Math.PI) / 180);
  }, 300_000);

  // C25
  it('car dispose removes body collider controller and mesh', () => {
    const world = makeWorld();
    const scene = new THREE.Scene();
    const before = { bodies: world.bodies.len(), colliders: world.colliders.len(), vehicles: world.vehicleControllers.size };
    const car = new Car(world, scene, ASSETS, { x: 0, y: 30, z: 0 }, DEFAULT_CAR, AI_PAINTS[1]);
    expect(world.bodies.len()).toBe(before.bodies + 1);
    expect(car.mesh.parent).toBe(scene);
    car.dispose();
    expect({ bodies: world.bodies.len(), colliders: world.colliders.len(), vehicles: world.vehicleControllers.size }).toEqual(before);
    expect(car.mesh.parent).toBeNull();
  }, 120_000);
});
