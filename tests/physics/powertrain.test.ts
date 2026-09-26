import { beforeAll, describe, expect, it } from 'vitest';
import { NO_INPUT, createHarness, initRapier, kmh } from './harness';

beforeAll(async () => {
  await initRapier();
});

const THROTTLE = { ...NO_INPUT, throttle: true };

describe('powertrain', () => {
  // C19 (AC 18)
  it('zero to 100 kmh between 5.5 and 7.5 s', () => {
    const h = createHarness();
    h.settle();
    let t = -1;
    for (let i = 1; i <= 600 && t < 0; i++) {
      h.step(THROTTLE);
      if (kmh(h.car) >= 100) t = i / 60;
    }
    expect(t).toBeGreaterThanOrEqual(5.5);
    expect(t).toBeLessThanOrEqual(7.5);
  });

  // C20 (AC 19) - substitui free-roam-city C8
  it('top speed limited by drag', () => {
    const h = createHarness();
    h.settle();
    let min = Infinity;
    let max = -Infinity;
    for (let i = 1; i <= 3600; i++) {
      h.step(THROTTLE);
      if (i >= 3000) {
        min = Math.min(min, kmh(h.car));
        max = Math.max(max, kmh(h.car));
      }
    }
    const v60 = kmh(h.car);
    expect(v60).toBeGreaterThanOrEqual(215);
    expect(v60).toBeLessThanOrEqual(240);
    expect(max - min).toBeLessThan(3);
  });

  // C21 (AC 20)
  it('coasting from 100 to 60 kmh', () => {
    const h = createHarness();
    h.settle();
    h.setForwardKmh(100);
    let t = -1;
    for (let i = 1; i <= 60 * 15 && t < 0; i++) {
      h.step(NO_INPUT);
      if (kmh(h.car) <= 60) t = i / 60;
    }
    expect(t).toBeGreaterThanOrEqual(4);
    expect(t).toBeLessThanOrEqual(12);
  });

  // C22 (AC 21)
  it('braking from 100 kmh stops in 34 to 45 m', () => {
    const h = createHarness();
    h.settle();
    h.setForwardKmh(100);
    const p0 = { ...h.car.body.translation() };
    let d = -1;
    for (let i = 1; i <= 600 && d < 0; i++) {
      h.step({ ...NO_INPUT, brake: true });
      if (kmh(h.car) <= 1) {
        const p = h.car.body.translation();
        d = Math.hypot(p.x - p0.x, p.z - p0.z);
      }
    }
    expect(d).toBeGreaterThanOrEqual(34);
    expect(d).toBeLessThanOrEqual(45);
  });

  // C23 (AC 22)
  it('climbs a 9 percent grade', () => {
    const h = createHarness({ ramp: true });
    h.settle();
    let reached = false;
    for (let i = 1; i <= 600 && !reached; i++) {
      h.step(THROTTLE);
      reached = kmh(h.car) >= 60;
    }
    expect(reached).toBe(true);
  });
});
