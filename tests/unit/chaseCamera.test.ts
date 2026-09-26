import { describe, expect, it } from 'vitest';
import {
  blurFor,
  chaseTarget,
  fovFor,
  lateralOffset,
  shakeAmplitude,
  shakeAt,
  smoothingFactor,
} from '../../src/camera/chaseMath';

describe('chase camera math', () => {
  // free-roam-city C13 (AC 11)
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

  // free-roam-city C14 (AC 11)
  it('smoothing follows 1 - exp(-5 dt)', () => {
    expect(smoothingFactor(0.1)).toBeCloseTo(1 - Math.exp(-0.5), 6);
    expect(smoothingFactor(0)).toBe(0);
    expect(smoothingFactor(10)).toBeCloseTo(1, 6);
  });

  // visual-upgrade C17 (AC 17)
  it('fov opens with speed', () => {
    expect(fovFor(0)).toBeCloseTo(62, 6);
    expect(fovFor(110)).toBeCloseTo(70, 6);
    expect(fovFor(220)).toBeCloseTo(78, 6);
    expect(fovFor(300)).toBeCloseTo(78, 6);
  });

  // visual-upgrade C18 (AC 18)
  it('radial blur above 120 kmh', () => {
    expect(blurFor(50)).toBeCloseTo(0, 6);
    expect(blurFor(120)).toBeCloseTo(0, 6);
    expect(blurFor(170)).toBeCloseTo(0.3, 6);
    expect(blurFor(220)).toBeCloseTo(0.6, 6);
    expect(blurFor(300)).toBeCloseTo(0.6, 6);
  });

  // visual-upgrade C19 (AC 19)
  it('collision shake amplitude and decay', () => {
    expect(shakeAmplitude(4000)).toBeCloseTo(0.2, 6);
    expect(shakeAmplitude(20000)).toBeCloseTo(0.4, 6);
    expect(shakeAmplitude(100000)).toBeCloseTo(0.4, 6);
    expect(shakeAt(0, 0.4)).toBeCloseTo(0.4, 6);
    expect(shakeAt(0.15, 0.4)).toBeCloseTo(0.4 / Math.E, 6);
  });

  // visual-upgrade C20 (AC 20)
  it('lateral offset by yaw rate', () => {
    expect(lateralOffset(0)).toBeCloseTo(0, 6);
    expect(lateralOffset(1)).toBeCloseTo(0.8, 6);
    expect(lateralOffset(2)).toBeCloseTo(1.2, 6);
    expect(lateralOffset(-3)).toBeCloseTo(-1.2, 6);
  });
});
