import { describe, expect, it } from 'vitest';
import {
  AMBIENT_CUTOFF_HZ,
  AMBIENT_GAIN,
  ENGINE_GAIN_MAX,
  OSC_RAMP_TAU_S,
  RAMP_TAU_S,
  ENGINE_HARMONICS,
  IDLE_FACTOR,
  brownNoise,
  engineCutoff,
  engineGainFor,
  engineHarmonics,
  firingFrequency,
  tremoloDepth,
} from '../../src/audio/audioMap';
import { mulberry32 } from '../../src/world/CityGenerator';

describe('audio map', () => {
  // engine-sound C10 (supersede free-roam-city C36): 4 cilindros, 4 tempos → rpm / 30
  it('firing frequency is rpm over 30', () => {
    expect(firingFrequency(1000)).toBeCloseTo(33.333, 3);
    expect(firingFrequency(4000)).toBeCloseTo(133.333, 3);
    expect(firingFrequency(7000)).toBeCloseTo(233.333, 3);
  });

  // engine-sound C1
  it('lowpass cutoff follows rpm', () => {
    expect(engineCutoff(1000)).toBeCloseTo(250, 6);
    expect(engineCutoff(4000)).toBeCloseTo(825, 6);
    expect(engineCutoff(7000)).toBeCloseTo(1400, 6);
    // clamp fora da faixa
    expect(engineCutoff(500)).toBeCloseTo(250, 6);
    expect(engineCutoff(8000)).toBeCloseTo(1400, 6);
  });

  // engine-sound C14
  it('ramp time constants', () => {
    expect(RAMP_TAU_S).toBeCloseTo(0.15, 9);
    expect(OSC_RAMP_TAU_S).toBeCloseTo(0.05, 9);
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
    expect(ENGINE_GAIN_MAX).toBeCloseTo(0.12, 6);
    expect(IDLE_FACTOR).toBeCloseTo(0.4, 6);
    expect(engineGainFor(false)).toBeCloseTo(0.048, 6);
    expect(engineGainFor(true)).toBeCloseTo(0.12, 6);
    expect(AMBIENT_GAIN).toBeCloseTo(0.05, 6);
    expect(AMBIENT_CUTOFF_HZ).toBe(180);
  });

  // engine-sound C11: 24 harmônicos com amplitude 1/n^1.5, DC zero
  it('engine wave harmonics fall off as 1 over n to the 1.5', () => {
    const { real, imag } = engineHarmonics();
    expect(ENGINE_HARMONICS).toBe(24);
    expect(real.length).toBe(25);
    expect(imag.length).toBe(25);
    expect(imag[0]).toBe(0);
    expect(real.every((v) => v === 0)).toBe(true);
    expect(imag[1]).toBeCloseTo(1, 6);
    expect(imag[2]).toBeCloseTo(1 / Math.pow(2, 1.5), 6);
    expect(imag[24]).toBeCloseTo(1 / Math.pow(24, 1.5), 6);
  });

  // engine-sound C12: ruído marrom - energia concentrada nos graves (sem chiado)
  it('brown noise is low-frequency dominated and bounded', () => {
    const n = 8192;
    const x = brownNoise(n, mulberry32(7));
    expect(x.length).toBe(n);
    for (const v of x) expect(Math.abs(v)).toBeLessThanOrEqual(1);
    // diferença entre amostras vizinhas muito menor que a amplitude: sinal suave, não branco
    let sumAbs = 0;
    let sumDiff = 0;
    for (let i = 1; i < n; i++) {
      sumAbs += Math.abs(x[i]!);
      sumDiff += Math.abs(x[i]! - x[i - 1]!);
    }
    expect(sumDiff / sumAbs).toBeLessThan(0.3);
    expect(sumAbs / n).toBeGreaterThan(0.02);
  });
});
