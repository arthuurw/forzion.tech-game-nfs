import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { NO_INPUT, axis, createHarness, initRapier, kmh, type Harness } from './harness';

// play-fixes S5: o carro volta inteiro de um teleporte ou de um reset (Car real, AD-011)
beforeAll(async () => {
  await initRapier();
});

const THROTTLE = { ...NO_INPUT, throttle: true };

/** acelera até `targetKmh`, depois freio de mão e volante cheio por 0.5 s: marcha alta, volante virado, derrapando */
function driveHard(h: Harness, targetKmh: number): void {
  h.settle();
  for (let i = 0; i < 60 * 30 && kmh(h.car) < targetKmh; i++) h.step(THROTTLE);
  for (let i = 0; i < 30; i++) h.step({ throttle: true, brake: false, steer: 1, handbrake: true });
}

function atRest(h: Harness) {
  return {
    gear: h.car.drive.gear,
    steer: [0, 1].map((i) => h.car.controller.wheelSteering(i) ?? 0),
    lateralG: h.car.lateralG,
    skidding: h.car.skidding,
  };
}

/** tempo (s) de 0 a 60 km/h com o acelerador no fundo */
function zeroTo60(h: Harness): number {
  for (let i = 1; i <= 600; i++) {
    h.step(THROTTLE);
    if (kmh(h.car) >= 60) return i / 60;
  }
  return Infinity;
}

describe('car reset', () => {
  // C19 (AC 14)
  it('teleport and reset return the drivetrain to rest', () => {
    for (const how of ['teleport', 'reset'] as const) {
      const h = createHarness();
      driveHard(h, 130);
      const before = atRest(h);
      expect(before.gear, how).toBeGreaterThanOrEqual(4);
      expect(Math.abs(before.steer[0]!), how).toBeGreaterThan(0.01);
      expect(before.lateralG, how).toBeGreaterThan(0.1);
      expect(before.skidding, how).toBe(true);
      if (how === 'teleport') h.car.teleport(0, 1.2, 0, 0);
      else h.car.reset();
      expect(atRest(h), how).toEqual({ gear: 1, steer: [0, 0], lateralG: 0, skidding: false });
    }
  });

  // C20 (AC 15)
  it('zero to 60 after a teleport matches a new car', () => {
    const fresh = createHarness();
    fresh.settle();
    const t0 = zeroTo60(fresh);

    const h = createHarness();
    h.settle();
    h.car.drive = { ...h.car.drive, gear: 5 };
    h.setForwardKmh(150);
    for (let i = 0; i < 10; i++) h.step(THROTTLE);
    expect(h.car.drive.gear).toBe(5);
    expect(kmh(h.car)).toBeGreaterThan(140);
    h.car.teleport(0, 1.2, 0, 0);
    h.settle();
    const t1 = zeroTo60(h);
    expect(Math.abs(t1 - t0)).toBeLessThanOrEqual(0.05);
  });

  // C21 (AC 16)
  it('reset stands the car up and keeps the heading', () => {
    for (const heading of [0, 1, -2.5]) {
      const h = createHarness();
      h.settle();
      // de lado: rolagem de 90° e o heading pedido
      const q = new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
      h.car.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      const y0 = h.car.body.translation().y;
      h.car.reset();
      const label = `heading ${heading}`;
      expect(h.car.lastReset!.position.y - y0, label).toBeCloseTo(1, 2);
      expect(axis(h.car, 0, 1, 0).y, label).toBeGreaterThanOrEqual(0.999);
      const d = Math.atan2(Math.sin(h.car.heading() - heading), Math.cos(h.car.heading() - heading));
      expect(Math.abs(d), label).toBeLessThanOrEqual(0.01);
    }
  });
});
