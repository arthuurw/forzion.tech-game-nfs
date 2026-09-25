import { describe, expect, it } from 'vitest';
import { chaseTarget, smoothingFactor } from '../../src/camera/chaseMath';

describe('chase camera math', () => {
  // C13 (AC 11)
  it('target is 6 m behind and 2.5 m above along heading', () => {
    const t0 = chaseTarget({ x: 0, y: 0, z: 0 }, 0);
    expect(t0.position.x).toBeCloseTo(0, 5);
    expect(t0.position.y).toBeCloseTo(2.5, 5);
    expect(t0.position.z).toBeCloseTo(-6, 5);
    expect(t0.lookAt).toEqual({ x: 0, y: 1, z: 0 });

    const t1 = chaseTarget({ x: 0, y: 0, z: 0 }, Math.PI / 2);
    expect(t1.position.x).toBeCloseTo(-6, 5);
    expect(t1.position.y).toBeCloseTo(2.5, 5);
    expect(t1.position.z).toBeCloseTo(0, 5);
  });

  // C14 (AC 11)
  it('smoothing follows 1 - exp(-5 dt)', () => {
    expect(smoothingFactor(0.1)).toBeCloseTo(1 - Math.exp(-0.5), 6);
    expect(smoothingFactor(0)).toBe(0);
    expect(smoothingFactor(10)).toBeCloseTo(1, 6);
  });
});
