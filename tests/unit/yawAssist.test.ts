import { describe, expect, it } from 'vitest';
import { DEFAULT_CAR, type CarSpec } from '../../src/vehicle/carSpec';
import { yawAssistTorque } from '../../src/vehicle/yawAssist';

// ficha de teste da C7: gain 4, maxNm 5000, lateralG 1.1, entre-eixos 2.6; inércia 2000
const SPEC: CarSpec = {
  ...DEFAULT_CAR,
  yawAssistGain: 4,
  yawAssistMaxNm: 5000,
  yawAssistLateralG: 1.1,
  wheelbaseM: 2.6,
};
const INERTIA = 2000;
const TOL = 1e-6;

describe('yaw assist', () => {
  // C7 (AC 7, door 1) - table-driven over the 10 rows (the tenth, two wheels, came with test-hardening C18)
  it('yaw assist torque follows the target yaw rate', () => {
    const freeTarget = Math.min((10 * Math.tan(0.1)) / 2.6, (1.1 * 9.81) / 10);
    const reverseTarget = (-5 * Math.tan(0.1)) / 2.6;
    // os valores arredondados da tabela da C7
    expect(freeTarget).toBeCloseTo(0.3859, 4);
    expect(reverseTarget).toBeCloseTo(-0.19295, 5);

    const rows: Array<[string, number, number, number, number, number]> = [
      ['free target', 0.1, 10, 0, 4, 4 * 2000 * freeTarget],
      ['limited target', 0.3, 10, 0, 4, 5000],
      ['opposite side', -0.3, 10, 0, 4, -5000],
      ['release brakes the yaw', 0, 20, 0.2, 4, -1600],
      ['reverse', 0.1, -5, 0, 4, 4 * 2000 * reverseTarget],
      ['below 2 m/s', 0.3, 1.9, 0, 4, 0],
      ['one wheel on the ground', 0.3, 10, 0, 1, 0],
      // o teto de lateralG age sem saturar em maxNm: sem o teto daria 5000
      ['lateral g cap below max torque', 0.3, 10, 0.5, 4, 4 * 2000 * ((1.1 * 9.81) / 10 - 0.5)],
      // exatamente 2 m/s já tem ajuda
      ['exactly 2 m/s', 0.3, 2, 0, 4, 4 * 2000 * ((2 * Math.tan(0.3)) / 2.6)],
      // test-hardening C18 (AC 14): com 2 rodas no chão o torque é o mesmo do caso limitado, sem escala por roda
      ['two wheels on the ground', 0.3, 10, 0, 2, 5000],
    ];
    expect(rows[0]![5]).toBeCloseTo(3087.2, 1);
    expect(rows[4]![5]).toBeCloseTo(-1543.6, 1);
    expect(rows[7]![5]).toBeCloseTo(4632.8, 1);
    expect(rows[8]![5]).toBeCloseTo(1903.6, 1);
    for (const [name, steer, v, yawRate, wheels, expected] of rows) {
      const t = yawAssistTorque(SPEC, steer, v, yawRate, wheels, INERTIA);
      expect(Math.abs(t - expected), `${name}: got ${t}, expected ${expected}`).toBeLessThanOrEqual(TOL);
    }

  });
});
