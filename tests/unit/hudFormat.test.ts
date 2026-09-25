import { describe, expect, it } from 'vitest';
import { formatSpeed, gearLabel, rpmBarWidth } from '../../src/hud/format';

describe('hud format', () => {
  // C25 (AC 20) - also door 9 (m/s internally, km/h displayed)
  it('speed in kmh as integer', () => {
    expect(formatSpeed(13.9)).toBe('50');
    expect(formatSpeed(-2.0)).toBe('7');
    expect(formatSpeed(0.27)).toBe('1');
    expect(formatSpeed(0)).toBe('0');
  });

  // C29 (AC 21, AC 22)
  it('gear label and rpm bar width', () => {
    expect(gearLabel(-1)).toBe('R');
    expect(gearLabel(1)).toBe('1');
    expect(gearLabel(6)).toBe('6');
    expect(rpmBarWidth(1000)).toBeCloseTo(0, 6);
    expect(rpmBarWidth(4000)).toBeCloseTo(50, 6);
    expect(rpmBarWidth(7000)).toBeCloseTo(100, 6);
  });
});
