import { describe, expect, it } from 'vitest';
import { RAIN_BOX, RAIN_SPEED_MS, rainY } from '../../src/world/rainMath';

describe('rain math', () => {
  // visual-upgrade C10 (AC 10)
  it('rain drop wraps inside the box', () => {
    expect(RAIN_BOX).toEqual({ x: 60, y: 40, z: 60 });
    expect(RAIN_SPEED_MS).toBe(12);
    expect(rainY(30, 0)).toBeCloseTo(30, 6);
    expect(rainY(30, 1)).toBeCloseTo(18, 6);
    expect(rainY(5, 1)).toBeCloseTo(33, 6);
    expect(rainY(5, 10)).toBeCloseTo(5, 6);
    for (let t = 0; t < 100; t += 0.37) {
      const y = rainY(17, t);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(40);
    }
  });
});
