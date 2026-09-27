import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CAR, type CarSpec } from '../../src/vehicle/carSpec';
import { LateralGWindow, NO_INPUT, createHarness, initRapier, kmh } from './harness';

beforeAll(async () => {
  await initRapier();
});

const DEG = Math.PI / 180;

/**
 * `steer +1` por `steps` passos a partir de `v` km/h, acelerando sempre que abaixo de `v`.
 * Devolve o harness, o giro (|angvel.y|, rad/s) e a janela de g lateral de cada passo, índice 0 = passo 1.
 */
function hold(v: number, steps: number, spec: CarSpec = DEFAULT_CAR) {
  const h = createHarness({ spec });
  h.settle();
  h.setForwardKmh(v);
  const w = new LateralGWindow();
  const yaw: number[] = [];
  const g: number[] = [];
  for (let i = 0; i < steps; i++) {
    h.step({ ...NO_INPUT, steer: 1, throttle: kmh(h.car) < v });
    yaw.push(Math.abs(h.car.body.angvel().y));
    g.push(w.push(h.car));
  }
  return { h, yaw, g };
}

/** Giro em regime: média do giro nos passos 120 a 180 (1-based). */
function steadyYaw(yaw: number[]): number {
  const slice = yaw.slice(119, 180);
  expect(slice.length).toBe(61);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

describe('yaw assist - agility', () => {
  // C1 (AC 1)
  it('points into the turn within 0.25 s at 40 kmh', () => {
    const { yaw } = hold(40, 180);
    const steady = steadyYaw(yaw);
    expect(steady).toBeGreaterThan(0);
    const first = yaw.findIndex((r) => r >= 0.9 * steady) + 1;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThanOrEqual(15);
  });

  // C2 (AC 2)
  it('turns at least 32 degrees per second at 60 kmh', () => {
    expect(steadyYaw(hold(60, 180).yaw)).toBeGreaterThanOrEqual(32 * DEG);
  });

  // C3 (AC 3)
  it('turns at least 20 degrees per second at 100 kmh', () => {
    expect(steadyYaw(hold(100, 180).yaw)).toBeGreaterThanOrEqual(20 * DEG);
  });

  // C4 (AC 4)
  it('stops turning within 0.8 s after release', () => {
    const { h } = hold(100, 180);
    const after: number[] = [];
    for (let i = 0; i < 60; i++) {
      h.step({ ...NO_INPUT, throttle: kmh(h.car) < 100 });
      after.push(Math.abs(h.car.body.angvel().y));
    }
    const limit = 3 * DEG;
    const first = after.findIndex((r) => r < limit) + 1;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThanOrEqual(48);
    for (let i = first - 1; i < 60; i++) {
      expect(after[i]!, `step ${i + 1} after release`).toBeLessThan(limit);
    }
  });

  // C5 foi substituído pela C4 da corner-assist (tests/physics/cornering.test.ts)

  // C6 (AC 6) - substitui car-feel C9
  it('reaches at least 0.85 g at 60 kmh', () => {
    const { g } = hold(60, 120);
    expect(g.length).toBe(120);
    expect(Math.max(...g)).toBeGreaterThanOrEqual(0.85);
  });
});

describe('yaw assist - spec', () => {
  // C8 (AC 7, door 1)
  it('car applies the yaw assist from its spec', () => {
    for (const field of ['yawAssistGain', 'yawAssistMaxNm', 'yawAssistLateralG'] as const) {
      expect(Number.isFinite(DEFAULT_CAR[field]), field).toBe(true);
      expect(DEFAULT_CAR[field], field).toBeGreaterThan(0);
    }

    const withAssist = steadyYaw(hold(60, 180).yaw);
    const without = steadyYaw(hold(60, 180, { ...DEFAULT_CAR, yawAssistMaxNm: 0 }).yaw);
    expect(without).toBeLessThanOrEqual(0.85 * withAssist);

    const moving = createHarness();
    moving.settle();
    moving.setForwardKmh(60);
    moving.step({ ...NO_INPUT, steer: 1 });
    expect(moving.car.yawAssistNm).toBeGreaterThan(0);

    const parked = createHarness();
    parked.settle();
    parked.step({ ...NO_INPUT, steer: 1 });
    expect(parked.car.yawAssistNm).toBe(0);
  });
});
