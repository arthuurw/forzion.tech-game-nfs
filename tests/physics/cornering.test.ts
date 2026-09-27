import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CAR, type CarSpec } from '../../src/vehicle/carSpec';
import { LateralGWindow, NO_INPUT, createHarness, initRapier, kmh, rollDeg } from './harness';

beforeAll(async () => {
  await initRapier();
});

const DEG = Math.PI / 180;

/**
 * `steer +1` por `steps` passos a partir de `v` km/h, acelerando sempre que abaixo de `v`.
 * Devolve o harness, a janela de g lateral e, por passo (índice 0 = passo 1): giro (|angvel.y|, rad/s),
 * g lateral, rolagem (graus) e a força de curva aplicada (N).
 */
function hold(v: number, steps: number, spec: CarSpec = DEFAULT_CAR) {
  const h = createHarness({ spec });
  h.settle();
  h.setForwardKmh(v);
  const w = new LateralGWindow();
  const yaw: number[] = [];
  const g: number[] = [];
  const roll: number[] = [];
  const force: number[] = [];
  for (let i = 0; i < steps; i++) {
    h.step({ ...NO_INPUT, steer: 1, throttle: kmh(h.car) < v });
    yaw.push(Math.abs(h.car.body.angvel().y));
    g.push(w.push(h.car));
    roll.push(rollDeg(h.car));
    force.push(h.car.cornerAssistN);
  }
  return { h, w, yaw, g, roll, force };
}

/** Giro em regime: média do giro nos passos 120 a 180 (1-based). */
function steadyYaw(yaw: number[]): number {
  const slice = yaw.slice(119, 180);
  expect(slice.length).toBe(61);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** Média dos passos 90 a 180 (1-based). */
function meanSteps90to180(values: number[]): number {
  const slice = values.slice(89, 180);
  expect(slice.length).toBe(91);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

describe('corner assist - cornering', () => {
  // C1 (AC 1)
  it('radius at most 50 m at 100 kmh', () => {
    expect(steadyYaw(hold(100, 180).yaw)).toBeGreaterThanOrEqual(0.555);
  });

  // C2 (AC 2)
  it('radius at most 100 m at 140 kmh', () => {
    expect(steadyYaw(hold(140, 180).yaw)).toBeGreaterThanOrEqual(0.3892);
  });

  // C3 (AC 3)
  it('still turns at least 35 degrees per second at 60 kmh', () => {
    expect(steadyYaw(hold(60, 180).yaw)).toBeGreaterThanOrEqual(35 * DEG);
  });

  // C4 (AC 4) - substitui yaw-assist C5; table-driven over the 5 speeds
  it('lateral acceleration never exceeds 1.7 g', () => {
    const speeds = [60, 90, 120, 150, 180];
    for (const v of speeds) {
      const { g } = hold(v, 180);
      expect(g.length).toBe(180);
      g.forEach((x, i) => expect(x, `${v} km/h step ${i + 1}`).toBeLessThanOrEqual(1.7));
    }
  });

  // C5 (AC 5)
  it('path straightens within 1 s after release', () => {
    const { h, w } = hold(100, 180);
    const after: number[] = [];
    for (let i = 0; i < 60; i++) {
      h.step({ ...NO_INPUT, throttle: kmh(h.car) < 100 });
      after.push(w.push(h.car));
    }
    expect(after.length).toBe(60);
    expect(after.some((x) => x < 0.15)).toBe(true);
  });
});
