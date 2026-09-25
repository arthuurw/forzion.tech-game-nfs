import { describe, expect, it } from 'vitest';
import { engineFrequency } from '../../src/audio/audioMap';

describe('audio map', () => {
  // C36 (AC 28)
  it('rpm maps linearly to 60..200 Hz', () => {
    expect(engineFrequency(1000)).toBeCloseTo(60, 6);
    expect(engineFrequency(4000)).toBeCloseTo(130, 6);
    expect(engineFrequency(7000)).toBeCloseTo(200, 6);
  });
});
