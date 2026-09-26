import { beforeAll, describe, expect, it } from 'vitest';
import type { Car } from '../../src/vehicle/Car';
import { NO_INPUT, axis, createHarness, forwardSpeed, initRapier, kmh, sideslipDeg } from './harness';

beforeAll(async () => {
  await initRapier();
});

function heading(car: Car): number {
  const f = axis(car, 0, 0, 1);
  return Math.atan2(f.x, f.z);
}

describe('grip', () => {
  // C11 (AC 11)
  it('handbrake kicks the rear out', () => {
    const h = createHarness();
    h.settle();
    h.setForwardKmh(60);
    let max = 0;
    for (let i = 0; i < 90; i++) {
      h.step({ ...NO_INPUT, steer: 1, handbrake: true });
      max = Math.max(max, sideslipDeg(h.car) ?? 0);
    }
    expect(max).toBeGreaterThan(20);
  });

  // C36 - decisão do usuário (2026-09-26): com acelerador, o freio de mão vira power slide
  it('throttle keeps pushing with the handbrake pulled', () => {
    const run = (throttle: boolean): number => {
      const h = createHarness();
      h.settle();
      h.setForwardKmh(60);
      for (let i = 0; i < 60; i++) h.step({ ...NO_INPUT, handbrake: true, throttle });
      return kmh(h.car);
    };
    expect(run(true)).toBeGreaterThan(run(false) + 2);
  });

  // C12 (AC 12)
  it('car recovers after the handbrake is released', () => {
    const h = createHarness();
    h.settle();
    h.setForwardKmh(60);
    let kicked = false;
    for (let i = 0; i < 90 && !kicked; i++) {
      h.step({ ...NO_INPUT, steer: 1, handbrake: true });
      kicked = (sideslipDeg(h.car) ?? 0) > 20;
    }
    expect(kicked).toBe(true);
    // freio de mão e direção soltos a partir do passo seguinte
    let recovered = false;
    for (let i = 0; i < 150; i++) {
      h.step(NO_INPUT);
      expect(forwardSpeed(h.car), `step ${i + 1}`).toBeGreaterThan(0);
      const slip = sideslipDeg(h.car);
      if (slip !== null && slip < 8) recovered = true;
    }
    expect(recovered).toBe(true);
  });

  // C31 (AC 23)
  it('skidding from real lateral slip', () => {
    const slide = createHarness();
    slide.settle();
    const f = axis(slide.car, 0, 0, 1);
    const side = axis(slide.car, 1, 0, 0);
    const v = 60 / 3.6;
    slide.car.body.setLinvel({ x: f.x * v + side.x * 5, y: f.y * v + side.y * 5, z: f.z * v + side.z * 5 }, true);
    slide.step(NO_INPUT);
    expect(slide.car.skidding).toBe(true);

    const straight = createHarness();
    straight.settle();
    straight.setForwardKmh(100);
    for (let i = 0; i < 60; i++) {
      straight.step(NO_INPUT);
      expect(straight.car.skidding, `step ${i + 1}`).toBe(false);
    }
  });

  // C13 (AC 13)
  it('steers while braking hard', () => {
    const h = createHarness();
    h.settle();
    h.setForwardKmh(100);
    const h0 = heading(h.car);
    for (let i = 0; i < 60; i++) h.step({ ...NO_INPUT, brake: true, steer: 1 });
    const d = heading(h.car) - h0;
    const turned = Math.atan2(Math.sin(d), Math.cos(d));
    expect(turned).toBeGreaterThanOrEqual(0.2);
  });
});
