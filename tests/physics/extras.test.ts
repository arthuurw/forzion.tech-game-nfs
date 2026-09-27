import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Assets } from '../../src/core/Loader';
import { Car } from '../../src/vehicle/Car';
import { DEFAULT_CAR } from '../../src/vehicle/carSpec';

// block-life-extras: provas com o Rapier real (AD-011)
const DT = 1 / 60;
const ASSETS: Assets = { carModel: null, placeholder: true, textures: {}, loadedSets: [], failedSets: [] };

beforeAll(async () => {
  await RAPIER.init();
}, 120_000);

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
