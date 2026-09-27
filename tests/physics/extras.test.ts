import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Assets } from '../../src/core/Loader';
import { qualityPreset } from '../../src/core/quality';
import { Car } from '../../src/vehicle/Car';
import { DEFAULT_CAR } from '../../src/vehicle/carSpec';
import type { DriveInput } from '../../src/vehicle/drivetrain';
import { findBlockInteriors } from '../../src/world/interiors/BlockInteriors';
import { placeInteriorProps, type InteriorProps } from '../../src/world/interiors/InteriorProps';
import { InteriorScene } from '../../src/world/interiors/InteriorScene';
import { generateLots } from '../../src/world/lots/LotGenerator';
import { buildTrainLine, frameColumns, DECK_HEIGHT, type TrainLine } from '../../src/world/rail/trainLine';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateTerrain, heightAt } from '../../src/world/terrain/TerrainGenerator';
import { WorldPhysics } from '../../src/world/WorldPhysics';

// block-life-extras: provas com o Rapier real no mundo do seed 1337 (AD-011)
const DT = 1 / 60;
const ASSETS: Assets = { carModel: null, placeholder: true, textures: {}, loadedSets: [], failedSets: [] };
const raw = generateTerrain(1337);
const network = generateRoads(1337, raw);
const carved = carveRoads(raw, network);
const { lots } = generateLots(1337, network, carved);
const interiors = findBlockInteriors(carved, network, lots);
const props = placeInteriorProps(1337, interiors, lots, carved);
const train = buildTrainLine(network)!;
const GAS: DriveInput = { throttle: true, brake: false, steer: 0, handbrake: false };

beforeAll(async () => {
  await RAPIER.init();
}, 120_000);

function makeWorld(p: InteriorProps | null = props, t: TrainLine | null = train): { world: RAPIER.World; physics: WorldPhysics } {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  const physics = new WorldPhysics(world, carved, raw, network, lots, p, t);
  return { world, physics };
}

/** ângulo (rad) entre o eixo z local do quaternion e (sin h, 0, cos h) */
function zAxisError(q: { x: number; y: number; z: number; w: number }, heading: number): number {
  const z = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
  return z.angleTo(new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)));
}

describe('car paint without the glb', () => {
  // C5
  it('placeholder body takes the paint', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = DT;
    const car = new Car(world, new THREE.Scene(), ASSETS, { x: 0, y: 2, z: 0 }, DEFAULT_CAR, '#2f8cff');
    expect(car.paintMaterial?.color.getHexString()).toBe('2f8cff');
    expect(car.bodyColor()).toBe('#2f8cff');
    car.dispose();
  });
});

describe('parked cars in the real world', () => {
  // C12
  it('parked cars get one fixed cuboid each', () => {
    const without = makeWorld({ ...props, parking: [] }, null);
    const withCars = makeWorld(props, null);
    expect(withCars.world.colliders.len() - without.world.colliders.len()).toBe(props.parking.length);
    expect(withCars.physics.parked.length).toBe(props.parking.length);
    for (const i of [0, Math.floor(props.parking.length / 2), props.parking.length - 1]) {
      const p = props.parking[i]!;
      const c = withCars.physics.parked[i]!;
      const he = c.halfExtents()!;
      expect(Math.abs(he.x - 0.9), `car ${i}`).toBeLessThanOrEqual(0.001);
      expect(Math.abs(he.y - 0.6), `car ${i}`).toBeLessThanOrEqual(0.001);
      expect(Math.abs(he.z - 2.1), `car ${i}`).toBeLessThanOrEqual(0.001);
      const t = c.translation();
      expect(Math.abs(t.y - (heightAt(carved, p.x, p.z) + 0.6)), `car ${i} y`).toBeLessThanOrEqual(0.05);
      expect(Math.hypot(t.x - p.x, t.z - p.z), `car ${i} xz`).toBeLessThanOrEqual(0.01);
      expect(zAxisError(c.rotation(), p.heading), `car ${i} heading`).toBeLessThanOrEqual(Math.PI / 180);
    }
  });

  // C13
  it('driving into a parked car stops the car', () => {
    const { world, physics } = makeWorld(props, null);
    // uma vaga com 25 m livres atrás (na própria zona) para o carro chegar com velocidade
    const zoneAt = (x: number, z: number) =>
      interiors.zoneOf[Math.round((z - interiors.origin) / interiors.spacing) * interiors.size + Math.round((x - interiors.origin) / interiors.spacing)]!;
    const target = props.parking.find((p) => {
      for (let d = 2; d <= 27; d += 1) if (zoneAt(p.x - Math.sin(p.heading) * d, p.z - Math.cos(p.heading) * d) !== p.zoneId) return false;
      return true;
    })!;
    expect(target).toBeDefined();
    const idx = props.parking.indexOf(target);
    const h = target.heading;
    const sx = target.x - Math.sin(h) * 25;
    const sz = target.z - Math.cos(h) * 25;
    const car = new Car(world, new THREE.Scene(), ASSETS, { x: sx, y: heightAt(carved, sx, sz) + 1.2, z: sz }, DEFAULT_CAR);
    car.teleport(sx, heightAt(carved, sx, sz) + 1.2, sz, h);
    const before = physics.parked[idx]!.translation();
    const along = () => {
      const t = car.body.translation();
      return (t.x - target.x) * Math.sin(h) + (t.z - target.z) * Math.cos(h);
    };
    let peak = 0;
    let contactAt = -1;
    let prevSpeed = 0;
    let after1s = Infinity;
    for (let k = 0; k < 60 * 12; k++) {
      car.fixedUpdate(GAS, DT);
      world.step();
      const speed = Math.abs(car.speedKmh());
      if (contactAt < 0) {
        peak = Math.max(peak, speed);
        if (prevSpeed - speed > 10) contactAt = k;
      } else if (k - contactAt <= 60) {
        after1s = Math.min(after1s, speed);
      } else break;
      prevSpeed = speed;
      expect(along(), `step ${k} past the parked car`).toBeLessThanOrEqual(-1.5);
    }
    expect(contactAt).toBeGreaterThan(0);
    expect(peak).toBeGreaterThanOrEqual(35);
    expect(after1s).toBeLessThan(5);
    const afterT = physics.parked[idx]!.translation();
    expect(Math.hypot(afterT.x - before.x, afterT.y - before.y, afterT.z - before.z)).toBeLessThanOrEqual(1e-6);
    car.dispose();
  });

  // C14 (sem o glb)
  it('parked cars fall back to boxes without the glb', () => {
    const scene = new InteriorScene(interiors, props, 1337, qualityPreset('high'), carved, { carModel: null, placeholder: true });
    expect(scene.parkedMesh.name).toBe('parked-cars');
    expect(scene.parkedPlaceholder).toBe(true);
    expect(scene.parkedMesh.count).toBe(props.parking.length);
    expect(scene.parkedMesh.geometry.getAttribute('position').count).toBeLessThanOrEqual(200);
  });
});

describe('train portals in the real world', () => {
  // C30
  it('portal columns get one fixed cuboid each', () => {
    const without = makeWorld(props, null);
    const withTrain = makeWorld(props, train);
    expect(withTrain.world.colliders.len() - without.world.colliders.len()).toBe(2 * train.frames.length);
    expect(withTrain.physics.columns.length).toBe(2 * train.frames.length);
    for (const i of [0, Math.floor(train.frames.length / 2), train.frames.length - 1]) {
      const f = train.frames[i]!;
      const cols = frameColumns(f);
      for (const [j, col] of cols.entries()) {
        const c = withTrain.physics.columns[i * 2 + j]!;
        const ground = heightAt(carved, col.x, col.z);
        const h = f.y + DECK_HEIGHT - ground;
        const he = c.halfExtents()!;
        expect(Math.abs(he.x - 0.25), `frame ${i} col ${j}`).toBeLessThanOrEqual(0.001);
        expect(Math.abs(he.z - 0.25), `frame ${i} col ${j}`).toBeLessThanOrEqual(0.001);
        expect(Math.abs(he.y - h / 2), `frame ${i} col ${j} height`).toBeLessThanOrEqual(0.05);
        const t = c.translation();
        expect(Math.hypot(t.x - col.x, t.z - col.z), `frame ${i} col ${j} xz`).toBeLessThanOrEqual(0.05);
        expect(Math.abs(t.y - (ground + h / 2)), `frame ${i} col ${j} y`).toBeLessThanOrEqual(0.05);
      }
    }
  });

  // C33 (com o Rapier)
  it('the car passes under a portal without slowing', () => {
    const { world } = makeWorld(props, train);
    // um portal da avenida z ≈ 300 com 120 m de linha reta antes (heading ao longo de x)
    const frame = train.frames.find((f) => Math.abs(f.z - 300) < 40 && Math.abs(Math.sin(f.heading)) > 0.99)!;
    expect(frame).toBeDefined();
    const h = frame.heading;
    const sx = frame.x - Math.sin(h) * 120;
    const sz = frame.z - Math.cos(h) * 120;
    const car = new Car(world, new THREE.Scene(), ASSETS, { x: sx, y: frame.y + 1.2, z: sz }, DEFAULT_CAR);
    car.teleport(sx, frame.y + 1.2, sz, h);
    const along = () => {
      const t = car.body.translation();
      return (t.x - frame.x) * Math.sin(h) + (t.z - frame.z) * Math.cos(h);
    };
    let speedBefore = -1;
    let speedAfter = -1;
    for (let k = 0; k < 60 * 30; k++) {
      car.fixedUpdate(GAS, DT);
      world.step();
      const a = along();
      const speed = Math.abs(car.speedKmh());
      if (speedBefore < 0 && a >= -10) speedBefore = speed;
      if (a >= 10) {
        speedAfter = speed;
        break;
      }
    }
    expect(speedBefore).toBeGreaterThanOrEqual(55);
    expect(speedAfter).toBeGreaterThanOrEqual(0.9 * speedBefore);
    car.dispose();
  });
});
