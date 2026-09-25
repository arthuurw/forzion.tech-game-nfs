import { describe, expect, it } from 'vitest';
import { FixedStepper } from '../../src/core/FixedStepper';

describe('FixedStepper', () => {
  // C12 (AC 10)
  it('steps at 1/60 with a cap of 5', () => {
    const a = new FixedStepper();
    expect(a.advance(0.05)).toBe(3);
    expect(a.accumulator).toBeCloseTo(0, 6);

    const b = new FixedStepper();
    expect(b.advance(0.2)).toBe(5);
    expect(b.accumulator).toBeCloseTo(0, 6);

    const c = new FixedStepper();
    expect(c.advance(0.01)).toBe(0);
    expect(c.accumulator).toBeCloseTo(0.01, 6);

    expect(a.step).toBeCloseTo(1 / 60, 9);
  });
});
