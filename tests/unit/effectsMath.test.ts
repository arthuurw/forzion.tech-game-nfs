import { describe, expect, it } from 'vitest';
import { ParticlePool, SkidBuffer, sparkBurstFor } from '../../src/vehicle/effectsMath';

describe('effects math', () => {
  // visual-upgrade C13 (AC 13)
  it('skid ring buffer overwrites oldest', () => {
    const buf = new SkidBuffer(400);
    for (let i = 0; i < 450; i++) buf.push({ x: i, z: 0, heading: 0 });
    expect(buf.count).toBe(400);
    expect(buf.head).toBe(50);
    // o slot 0 foi sobrescrito pelo item 400
    expect(buf.items[0]?.x).toBe(400);
    expect(buf.items[49]?.x).toBe(449);
    expect(buf.items[50]?.x).toBe(50);

    const small = new SkidBuffer(400);
    for (let i = 0; i < 10; i++) small.push({ x: i, z: 0, heading: 0 });
    expect(small.count).toBe(10);
    expect(small.head).toBe(10);
  });

  // visual-upgrade C14 (AC 14)
  it('smoke pool caps at 256 and expires after 0.8 s', () => {
    const dt = 1 / 60;
    // 4 por passo: regime de 4 × 48 passos de vida, abaixo do teto
    const pool = new ParticlePool(256, 0.8);
    for (let i = 0; i < 360; i++) {
      pool.spawn(4);
      pool.step(dt);
      expect(pool.alive).toBeLessThanOrEqual(256);
    }
    expect(pool.alive).toBeGreaterThanOrEqual(184);
    expect(pool.alive).toBeLessThanOrEqual(192);
    // 8 por passo: o teto de 256 limita
    const busy = new ParticlePool(256, 0.8);
    let peak = 0;
    for (let i = 0; i < 360; i++) {
      busy.spawn(8);
      peak = Math.max(peak, busy.alive);
      busy.step(dt);
    }
    expect(peak).toBe(256);
    // sem spawn, tudo expira em 49 passos (0.8 s + arredondamento)
    for (let i = 0; i < 49; i++) pool.step(dt);
    expect(pool.alive).toBe(0);
  });

  // visual-upgrade C15 (AC 15, AC 16)
  it('spark burst threshold at 3000', () => {
    expect(sparkBurstFor(0)).toBe(0);
    expect(sparkBurstFor(2999)).toBe(0);
    expect(sparkBurstFor(3000)).toBe(40);
    expect(sparkBurstFor(50000)).toBe(40);
  });
});
