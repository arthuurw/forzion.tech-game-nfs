import { beforeAll, describe, expect, it } from 'vitest';
import type { Car } from '../../src/vehicle/Car';
import { LateralGWindow, NO_INPUT, axis, createHarness, forwardSpeed, initRapier, kmh, sideslipDeg } from './harness';

beforeAll(async () => {
  await initRapier();
});

const SPEEDS = [60, 90, 120, 150, 180];

function heading(car: Car): number {
  const f = axis(car, 0, 0, 1);
  return Math.atan2(f.x, f.z);
}

/** `steer +1` por `steps` passos a partir de `v` km/h, acelerando sempre que abaixo de `v`; devolve a janela de g lateral por passo. */
function holdCorner(v: number, steps: number): number[] {
  const h = createHarness();
  h.settle();
  h.setForwardKmh(v);
  const w = new LateralGWindow();
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    h.step({ ...NO_INPUT, steer: 1, throttle: kmh(h.car) < v });
    out.push(w.push(h.car));
  }
  return out;
}

describe('grip', () => {
  // C8 (AC 8) - table-driven over the 5 speeds
  it('lateral grip never exceeds 1.15 g', () => {
    for (const v of SPEEDS) {
      const g = holdCorner(v, 180);
      expect(g.length).toBe(180);
      g.forEach((x, i) => expect(x, `${v} km/h step ${i + 1}`).toBeLessThanOrEqual(1.15));
    }
  });

  // C9 (AC 9)
  it('reaches at least 0.8 g at 60 kmh', () => {
    const g = holdCorner(60, 120);
    expect(Math.max(...g)).toBeGreaterThanOrEqual(0.8);
  });

  // C10 (AC 10) - table-driven over the 10 cases
  it('understeers instead of spinning', () => {
    let cases = 0;
    for (const v of SPEEDS) {
      for (const throttle of [true, false]) {
        const h = createHarness();
        h.settle();
        h.setForwardKmh(v);
        let measured = 0;
        for (let i = 0; i < 180; i++) {
          h.step({ ...NO_INPUT, steer: 1, throttle });
          const slip = sideslipDeg(h.car);
          if (slip === null) continue;
          measured++;
          expect(slip, `${v} km/h throttle ${throttle} step ${i + 1}`).toBeLessThanOrEqual(12);
        }
        expect(measured).toBeGreaterThan(0);
        cases++;
      }
    }
    expect(cases).toBe(10);
  });

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
