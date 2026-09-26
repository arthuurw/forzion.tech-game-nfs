import { beforeAll, describe, expect, it } from 'vitest';
import { NO_INPUT, createHarness, initRapier, kmh, pitchDeg, rollDeg } from './harness';

beforeAll(async () => {
  await initRapier();
});

/**
 * `steer` por 180 passos (3 s) a partir de 80 km/h, acelerando sempre que abaixo de 80 km/h.
 * Devolve o harness no fim da curva e a rolagem (graus) de cada passo, índice 0 = passo 1.
 */
function corner80(steer: number): { h: ReturnType<typeof createHarness>; roll: number[] } {
  const h = createHarness();
  h.settle();
  h.setForwardKmh(80);
  const roll: number[] = [];
  for (let i = 0; i < 180; i++) {
    h.step({ ...NO_INPUT, steer, throttle: kmh(h.car) < 80 });
    roll.push(rollDeg(h.car));
  }
  return { h, roll };
}

/** Média dos passos 90 a 180 (1-based). */
function meanSteps90to180(roll: number[]): number {
  const slice = roll.slice(89, 180);
  expect(slice.length).toBe(91);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

describe('car feel - body motion', () => {
  // C1 (AC 1) - substitui car-handling C4
  it('body roll between 3.5 and 6 degrees', () => {
    // positiva = lado esquerdo para cima: numa curva à esquerda o carro inclina para fora
    const left = meanSteps90to180(corner80(1).roll);
    expect(left).toBeGreaterThanOrEqual(3.5);
    expect(left).toBeLessThanOrEqual(6.0);
    const right = meanSteps90to180(corner80(-1).roll);
    expect(right).toBeGreaterThanOrEqual(-6.0);
    expect(right).toBeLessThanOrEqual(-3.5);
  });

  // C2 (AC 2)
  it('body roll swings back after the turn', () => {
    const { h } = corner80(1);
    // no passo 180 direção e acelerador são soltos
    const after: number[] = [];
    for (let i = 0; i < 240; i++) {
      h.step(NO_INPUT);
      after.push(rollDeg(h.car));
    }
    const minFirstSecond = Math.min(...after.slice(0, 60));
    expect(minFirstSecond).toBeGreaterThanOrEqual(-1.5);
    expect(minFirstSecond).toBeLessThanOrEqual(-0.3);
    // passos 150 a 240 depois de soltar (2.5 s a 4.0 s)
    for (let i = 149; i < 240; i++) {
      expect(Math.abs(after[i]!), `step ${i + 1} after release`).toBeLessThan(0.5);
    }
  });

  // C3 (AC 3) - substitui car-handling C5
  it('nose dives 2 to 5 degrees under braking', () => {
    const h = createHarness();
    h.settle();
    h.setForwardKmh(100);
    let minPitch = Infinity;
    for (let i = 0; i < 30; i++) {
      h.step({ ...NO_INPUT, brake: true });
      minPitch = Math.min(minPitch, pitchDeg(h.car));
    }
    expect(minPitch).toBeGreaterThanOrEqual(-5.0);
    expect(minPitch).toBeLessThanOrEqual(-2.0);
  });

  // C4 (AC 4)
  it('nose lifts under full throttle', () => {
    const h = createHarness();
    h.settle();
    let maxPitch = -Infinity;
    for (let i = 0; i < 60; i++) {
      h.step({ ...NO_INPUT, throttle: true });
      maxPitch = Math.max(maxPitch, pitchDeg(h.car));
    }
    expect(maxPitch).toBeGreaterThanOrEqual(1.0);
    expect(maxPitch).toBeLessThanOrEqual(4.0);
  });
});
