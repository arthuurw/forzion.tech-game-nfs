import { describe, expect, it } from 'vitest';
import { DEFAULT_CAR, type CarSpec } from '../../src/vehicle/carSpec';
import { cornerAssistForce } from '../../src/vehicle/cornerAssist';

// ficha de teste da C6: massa 1000, entre-eixos 2.6, início 0.9 g, teto 1.7 g
const SPEC: CarSpec = {
  ...DEFAULT_CAR,
  massKg: 1000,
  wheelbaseM: 2.6,
  cornerAssistStartG: 0.9,
  cornerAssistMaxG: 1.7,
};
const TOL = 1e-3;

describe('corner assist', () => {
  // C6 (AC 6, door 1) - table-driven over the 10 rows
  it('corner assist force fills lateral acceleration above the start', () => {
    // os valores da tabela da C6
    expect((100 * Math.tan(0.05)) / 2.6).toBeCloseTo(1.9247, 4);
    expect(0.9 * 9.81).toBeCloseTo(8.829, 6);

    const rows: Array<[string, number, number, number, boolean, number]> = [
      ['below the start', 0.05, 10, 4, false, 0],
      ['free', 0.1, 20, 4, false, 6607.103],
      ['limited', 0.2, 20, 4, false, 7848],
      ['opposite side', -0.2, 20, 4, false, -7848],
      ['reverse', 0.2, -20, 4, false, 7848],
      ['below 5 m/s', 0.2, 4.9, 4, false, 0],
      ['one wheel on the ground', 0.2, 20, 1, false, 0],
      ['two wheels on the ground', 0.2, 20, 2, false, 7848],
      ['handbrake', 0.2, 20, 4, true, 0],
      // exatamente 5 m/s já tem força: pede 25·tan(0.55)/2.6 ≈ 5.9 m/s², abaixo do início, então usa steer maior
      ['exactly 5 m/s', 1.2, 5, 4, false, 1000 * Math.min((25 * Math.tan(1.2)) / 2.6 - 8.829, 7.848)],
    ];
    expect(rows.length).toBe(10);
    expect(rows[9]![5]).toBeGreaterThan(0);
    // a linha livre é exatamente a fórmula da door 1
    expect(Math.abs(1000 * ((400 * Math.tan(0.1)) / 2.6 - 8.829) - 6607.103)).toBeLessThanOrEqual(TOL);
    for (const [name, steer, v, wheels, handbrake, expected] of rows) {
      const f = cornerAssistForce(SPEC, steer, v, wheels, handbrake);
      expect(Math.abs(f - expected), `${name}: got ${f}, expected ${expected}`).toBeLessThanOrEqual(TOL);
    }
  });
});
