import { describe, expect, it } from 'vitest';
import { parseQuality, qualityPreset } from '../../src/core/quality';

describe('quality', () => {
  // visual-upgrade C24 (door 5)
  it('quality parsing with default high', () => {
    expect(parseQuality('?quality=low')).toBe('low');
    expect(parseQuality('?quality=high')).toBe('high');
    expect(parseQuality('')).toBe('high');
    expect(parseQuality('?quality=ultra')).toBe('high');
    expect(parseQuality('?foo=1&quality=low')).toBe('low');

    expect(qualityPreset('low')).toEqual({ level: 'low', gtao: false, reflector: false, rainCount: 1000 });
    expect(qualityPreset('high')).toEqual({ level: 'high', gtao: true, reflector: true, rainCount: 4000 });
  });
});
