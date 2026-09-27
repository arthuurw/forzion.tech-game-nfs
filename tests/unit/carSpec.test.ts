import { describe, expect, it } from 'vitest';
import { DEFAULT_CAR } from '../../src/vehicle/carSpec';

// os 26 campos literais da door 1 da car-handling, os 3 da door 1 da car-feel, os 3 da door 1 da yaw-assist e os 2 da door 1 da corner-assist (plan.md, Landing)
const FIELDS = [
  'massKg',
  'comHeightM',
  'wheelbaseM',
  'trackM',
  'wheelRadiusM',
  'torqueCurve',
  'idleRpm',
  'redlineRpm',
  'gearRatios',
  'reverseRatio',
  'finalDrive',
  'drivetrainEfficiency',
  'shiftUpRpm',
  'shiftDownRpm',
  'shiftTimeS',
  'cdA',
  'rollingResistance',
  'brakeForceN',
  'brakeBiasFront',
  'tireGrip',
  'rearGripFactor',
  'handbrakeRearGrip',
  'steerMaxRad',
  'steerLateralG',
  'steerRateRadS',
  'steerReturnRadS',
  'suspensionStiffness',
  'suspensionCompression',
  'suspensionRelaxation',
  'yawAssistGain',
  'yawAssistMaxNm',
  'yawAssistLateralG',
  'cornerAssistStartG',
  'cornerAssistMaxG',
];

describe('car spec', () => {
  // car-handling C28 (door 1) + car-feel C13
  it('default car spec values', () => {
    const c = DEFAULT_CAR;
    expect(c.massKg).toBe(1250);
    expect(c.wheelbaseM).toBe(2.6);
    expect(c.trackM).toBe(1.7);
    expect(c.wheelRadiusM).toBe(0.45);
    expect(c.idleRpm).toBe(1000);
    expect(c.redlineRpm).toBe(7000);
    expect(c.gearRatios.length).toBe(6);
    for (let i = 1; i < 6; i++) expect(c.gearRatios[i]!, `gear ${i + 1}`).toBeLessThan(c.gearRatios[i - 1]!);
    expect(c.shiftUpRpm).toBe(6500);
    expect(c.shiftDownRpm).toBe(2800);
    expect(c.shiftTimeS).toBe(0.25);
    expect(c.brakeBiasFront).toBe(0.65);
    expect(c.handbrakeRearGrip).toBe(0.4);
    expect(c.steerMaxRad).toBe(0.55);
    // car-feel C13: valores de direção substituem os da car-handling C28
    expect(c.steerLateralG).toBe(1.7);
    expect(c.steerRateRadS).toBe(4.0);
    expect(c.steerReturnRadS).toBe(5.0);
    // car-feel C13 (door 1): suspensão na ficha, finita e > 0
    for (const field of ['suspensionStiffness', 'suspensionCompression', 'suspensionRelaxation'] as const) {
      expect(Number.isFinite(c[field]), field).toBe(true);
      expect(c[field], field).toBeGreaterThan(0);
    }

    expect(c.torqueCurve.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < c.torqueCurve.length; i++) {
      expect(c.torqueCurve[i]![0]).toBeGreaterThan(c.torqueCurve[i - 1]![0]);
    }
    expect(c.torqueCurve[0]![0]).toBeLessThanOrEqual(c.idleRpm);
    expect(c.torqueCurve[c.torqueCurve.length - 1]![0]).toBeGreaterThanOrEqual(c.redlineRpm);

    expect(FIELDS.length).toBe(34);
    expect(Object.keys(c).sort()).toEqual([...FIELDS].sort());
    for (const field of FIELDS) {
      const value = (c as unknown as Record<string, unknown>)[field];
      const numbers = Array.isArray(value) ? (value as unknown[]).flat() : [value];
      expect(numbers.length, field).toBeGreaterThan(0);
      for (const n of numbers) {
        expect(typeof n, field).toBe('number');
        expect(Number.isFinite(n), field).toBe(true);
      }
    }
  });
});
