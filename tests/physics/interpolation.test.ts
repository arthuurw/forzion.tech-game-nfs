import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GameLoop } from '../../src/core/GameLoop';
import { NO_INPUT, createHarness, horizontalSpeed, initRapier, kmh, type Harness } from './harness';

// smooth-world S1: o render desenha o carro entre o passo anterior e o atual (door 1, AD-020), com o Car real (AD-011)
beforeAll(async () => {
  await initRapier();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const THROTTLE = { ...NO_INPUT, throttle: true };
const ALPHAS = [0, 0.25, 0.5, 0.75, 0.99];

type V3 = { x: number; y: number; z: number };
type Q4 = { x: number; y: number; z: number; w: number };

/** pose do corpo no Rapier agora (cópia) */
function bodyPose(h: Harness): { p: V3; q: Q4 } {
  return { p: { ...h.car.body.translation() }, q: { ...h.car.body.rotation() } };
}

/** maior diferença entre componentes de dois quaternions, com o mesmo sinal (q e −q são a mesma rotação) */
function quatError(a: Q4, b: Q4): number {
  const s = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w < 0 ? -1 : 1;
  return Math.max(Math.abs(a.x - s * b.x), Math.abs(a.y - s * b.y), Math.abs(a.z - s * b.z), Math.abs(a.w - s * b.w));
}

function dist(a: V3, b: V3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

describe('render interpolation', () => {
  // C2 (AC 1, door 1)
  it('car draws the interpolated pose', () => {
    const h = createHarness();
    h.settle();
    for (let i = 0; i < 120; i++) h.step(THROTTLE);
    let checked = 0;
    for (let i = 0; i < 60; i++) {
      const before = bodyPose(h);
      h.step({ throttle: true, brake: false, steer: 0.6, handbrake: false });
      const after = bodyPose(h);
      if (i % 10 !== 9) continue;
      // andando e virando: o passo mexeu a posição e a rotação
      expect(dist(before.p, after.p)).toBeGreaterThan(0.05);
      expect(quatError(before.q, after.q)).toBeGreaterThan(1e-4);
      for (const alpha of ALPHAS) {
        h.car.drawPose(alpha);
        const want = {
          x: before.p.x + (after.p.x - before.p.x) * alpha,
          y: before.p.y + (after.p.y - before.p.y) * alpha,
          z: before.p.z + (after.p.z - before.p.z) * alpha,
        };
        const q = new THREE.Quaternion().slerpQuaternions(
          new THREE.Quaternion(before.q.x, before.q.y, before.q.z, before.q.w),
          new THREE.Quaternion(after.q.x, after.q.y, after.q.z, after.q.w),
          alpha,
        );
        expect(dist(h.car.mesh.position, want), `alpha ${alpha}`).toBeLessThanOrEqual(1e-6);
        expect(quatError(h.car.mesh.quaternion, q), `alpha ${alpha}`).toBeLessThanOrEqual(1e-6);
        checked++;
      }
    }
    expect(checked).toBe(6 * ALPHAS.length);
  });

  // C4 (AC 2)
  it('car moves every frame at 144 hz', () => {
    const h = createHarness();
    h.settle();
    h.setForwardKmh(100);
    // já andando antes do primeiro quadro: o passo anterior de cada quadro é um passo em movimento
    for (let i = 0; i < 10; i++) h.step(THROTTLE);
    const queue: Array<(now: number) => void> = [];
    vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => queue.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    let clock = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const drawn: V3[] = [];
    const speeds: number[] = [];
    const loop = new GameLoop(
      () => h.step(THROTTLE),
      (_dt, alpha) => {
        h.car.drawPose(alpha);
        drawn.push({ ...h.car.mesh.position });
        speeds.push(horizontalSpeed(h.car));
      },
    );
    loop.start();
    for (let f = 0; f < 144 * 2; f++) {
      clock += 1000 / 144;
      queue.shift()!(clock);
    }
    expect(drawn).toHaveLength(288);
    // ainda a ~100 km/h em linha reta
    expect(kmh(h.car)).toBeGreaterThan(90);
    for (let f = 1; f < drawn.length; f++) {
      const moved = dist(drawn[f]!, drawn[f - 1]!);
      const expected = speeds[f]! / 144;
      if (moved < 0.5 * expected || moved > 1.5 * expected) {
        expect.fail(`quadro ${f}: andou ${moved.toFixed(4)} m, v/144 = ${expected.toFixed(4)} m`);
      }
    }
    // 2 s a 144 Hz são 120 passos de 1/60 s
    expect(h.steps - 40).toBeGreaterThanOrEqual(119);
    expect(h.steps - 40).toBeLessThanOrEqual(120);
  });

  // C5 (AC 3, door 1)
  it('teleport and reset leave no trail', () => {
    for (const how of ['teleport', 'reset'] as const) {
      const h = createHarness();
      h.settle();
      for (let i = 0; i < 120; i++) h.step({ throttle: true, brake: false, steer: 0.5, handbrake: false });
      expect(kmh(h.car)).toBeGreaterThan(20);
      if (how === 'teleport') h.car.teleport(40, 2, -25, 1.1);
      else h.car.reset();
      const now = bodyPose(h);
      if (how === 'teleport') expect(dist(now.p, { x: 40, y: 2, z: -25 })).toBeLessThan(1e-6);
      for (const alpha of [0, 0.5, 0.99]) {
        h.car.drawPose(alpha);
        expect(dist(h.car.mesh.position, now.p), `${how} alpha ${alpha}`).toBeLessThanOrEqual(1e-9);
        const q = h.car.mesh.quaternion;
        expect([q.x, q.y, q.z, q.w], `${how} alpha ${alpha}`).toEqual([now.q.x, now.q.y, now.q.z, now.q.w]);
      }
    }
  });
});
