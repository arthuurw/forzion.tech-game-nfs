import { describe, expect, it } from 'vitest';
import {
  AMBIENT_GAIN,
  ENGINE_GAIN_MAX,
  IDLE_FACTOR,
  engineCutoff,
  engineFrequency,
  engineGainFor,
  tremoloDepth,
} from '../../src/audio/audioMap';

describe('audio map', () => {
  // free-roam-city C36 (AC 28)
  it('rpm maps linearly to 60..200 Hz', () => {
    expect(engineFrequency(1000)).toBeCloseTo(60, 6);
    expect(engineFrequency(4000)).toBeCloseTo(130, 6);
    expect(engineFrequency(7000)).toBeCloseTo(200, 6);
  });

  // engine-sound C1
  it('lowpass cutoff follows rpm', () => {
    expect(engineCutoff(1000)).toBeCloseTo(250, 6);
    expect(engineCutoff(4000)).toBeCloseTo(825, 6);
    expect(engineCutoff(7000)).toBeCloseTo(1400, 6);
  });

  // engine-sound C2
  it('tremolo depth fades out by 2500 rpm', () => {
    expect(tremoloDepth(1000)).toBeCloseTo(0.25, 6);
    expect(tremoloDepth(1750)).toBeCloseTo(0.125, 6);
    expect(tremoloDepth(2500)).toBeCloseTo(0, 6);
    expect(tremoloDepth(5000)).toBeCloseTo(0, 6);
  });

  // engine-sound C3
  it('engine gain by throttle and ambient gain', () => {
    expect(ENGINE_GAIN_MAX).toBeCloseTo(0.15, 6);
    expect(IDLE_FACTOR).toBeCloseTo(0.4, 6);
    expect(engineGainFor(false)).toBeCloseTo(0.06, 6);
    expect(engineGainFor(true)).toBeCloseTo(0.15, 6);
    expect(AMBIENT_GAIN).toBeCloseTo(0.12, 6);
  });
});
