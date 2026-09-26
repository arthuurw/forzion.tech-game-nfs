import { describe, expect, it } from 'vitest';
import { cameraRoll, smoothingFactor, stepRoll } from '../../src/camera/chaseMath';

const DEG = Math.PI / 180;

describe('chase camera roll', () => {
  // car-feel C14 (AC 13)
  it('camera roll follows body roll', () => {
    const table: Array<[number, number]> = [
      [0, 0],
      [0.05, 0.03],
      [-0.05, -0.03],
      [0.1, 0.06],
      [0.2, 4 * DEG],
      [-0.2, -4 * DEG],
    ];
    for (const [bodyRoll, expected] of table) {
      expect(Math.abs(cameraRoll(bodyRoll) - expected), `bodyRoll ${bodyRoll}`).toBeLessThanOrEqual(1e-9);
    }
  });

  // car-feel C15 (AC 14)
  it('camera roll smoothing', () => {
    expect(Math.abs(stepRoll(0, 0.06, 1 / 60) - 0.06 * (1 - Math.exp(-5 / 60)))).toBeLessThanOrEqual(1e-12);
    // mesma suavização da posição
    expect(Math.abs(stepRoll(0, 0.06, 1 / 60) - 0.06 * smoothingFactor(1 / 60))).toBeLessThanOrEqual(1e-12);

    let r = 0;
    for (let i = 0; i < 60; i++) r = stepRoll(r, 0.06, 1 / 60);
    expect(Math.abs(r - 0.06 * (1 - Math.exp(-5)))).toBeLessThanOrEqual(1e-9);

    for (const [x, dt] of [
      [0, 1 / 60],
      [0.03, 1 / 60],
      [-0.05, 0.1],
      [0.0698, 0.25],
    ] as const) {
      expect(stepRoll(x, x, dt), `x ${x} dt ${dt}`).toBe(x);
    }
  });
});
