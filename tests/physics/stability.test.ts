import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CAR } from '../../src/vehicle/carSpec';
import type { DriveInput } from '../../src/vehicle/drivetrain';
import { NO_INPUT, allWheelsInContact, createHarness, initRapier, tiltDeg } from './harness';

beforeAll(async () => {
  await initRapier();
});

const SPEEDS = [40, 60, 80, 100, 120, 140, 160, 180, 200];
const zigzag = (i: number): number => (Math.floor(i / 30) % 2 === 0 ? 1 : -1);
const MANEUVERS: Array<[string, (step: number) => DriveInput]> = [
  ['steer +1', () => ({ ...NO_INPUT, steer: 1 })],
  ['steer -1', () => ({ ...NO_INPUT, steer: -1 })],
  ['zigzag every 30 steps', (i) => ({ ...NO_INPUT, steer: zigzag(i) })],
  ['steer +1 with throttle', () => ({ ...NO_INPUT, steer: 1, throttle: true })],
  ['steer +1 with brake', () => ({ ...NO_INPUT, steer: 1, brake: true })],
  ['steer +1 with handbrake', () => ({ ...NO_INPUT, steer: 1, handbrake: true })],
];

interface MatrixResult {
  maneuver: string;
  kmh: number;
  maxTilt: number;
  /** passo (1..60) depois de soltar em que as 4 rodas estão no chão; -1 se nunca */
  backOnGround: number;
}

let matrix: MatrixResult[] | null = null;
/** Os 54 casos (6 manobras × 9 velocidades): 3 s de manobra e depois até 60 passos soltos. */
function runMatrix(): MatrixResult[] {
  if (matrix) return matrix;
  matrix = [];
  for (const [maneuver, input] of MANEUVERS) {
    for (const v of SPEEDS) {
      const h = createHarness();
      h.settle();
      h.setForwardKmh(v);
      let maxTilt = 0;
      for (let i = 0; i < 180; i++) {
        h.step(input(i));
        maxTilt = Math.max(maxTilt, tiltDeg(h.car));
      }
      let backOnGround = -1;
      for (let i = 1; i <= 60 && backOnGround < 0; i++) {
        h.step(NO_INPUT);
        if (allWheelsInContact(h.car)) backOnGround = i;
      }
      matrix.push({ maneuver, kmh: v, maxTilt, backOnGround });
    }
  }
  return matrix;
}

describe('stability', () => {
  // C1 (AC 1, door 1)
  it('mass and low center of mass', () => {
    const h = createHarness();
    h.settle();
    const mass = h.car.body.mass();
    expect(mass).toBeGreaterThanOrEqual(1249);
    expect(mass).toBeLessThanOrEqual(1251);
    const comHeight = h.car.body.worldCom().y;
    expect(comHeight).toBeGreaterThan(0);
    expect(comHeight).toBeLessThanOrEqual(0.5);
    expect(DEFAULT_CAR.trackM / (2 * comHeight)).toBeGreaterThanOrEqual(1.6);
  });

  // C2 (AC 2) - table-driven over the 54 cases
  it('no rollover across the maneuver matrix', () => {
    const results = runMatrix();
    expect(results.length).toBe(54);
    for (const r of results) {
      expect(r.maxTilt, `${r.maneuver} from ${r.kmh} km/h`).toBeLessThanOrEqual(15);
    }
  });

  // C3 (AC 3) - the same 54 cases, released
  it('all four wheels back on the ground after release', () => {
    const results = runMatrix();
    expect(results.length).toBe(54);
    for (const r of results) {
      expect(r.backOnGround, `${r.maneuver} from ${r.kmh} km/h`).toBeGreaterThanOrEqual(1);
      expect(r.backOnGround, `${r.maneuver} from ${r.kmh} km/h`).toBeLessThanOrEqual(60);
    }
  });
});
