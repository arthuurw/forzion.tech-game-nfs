import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Effects } from '../../src/vehicle/Effects';
import {
  CollisionTracker,
  ParticlePool,
  SkidBuffer,
  isSkidding,
  sparkBurstFor,
} from '../../src/vehicle/effectsMath';

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

  // visual-upgrade C38 - os números dos efeitos (AC 13, 14, 15), provados pelo `Effects` real
  // (test-hardening C21: comportamento no lugar de `expect(CONST).toBe(literal)`)
  it('effect constants', () => {
    // `Effects` desenha a textura da partícula num canvas; em node basta um canvas falso
    const ctx = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, fillStyle: '' };
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
    try {
      const dt = 1 / 60;
      const wheels = [
        { x: 0, z: 0 },
        { x: 1.5, z: 0 },
      ];
      // um passo derrapando: 4 de fumaça e 2 marcas (uma por roda traseira)
      const fx = new Effects(new THREE.Scene(), () => 0.5);
      fx.step(dt, true, wheels, 0);
      expect(fx.smoke.alive).toBe(4);
      expect(fx.skidCount).toBe(2);
      fx.step(dt, false, wheels, 0);
      expect(fx.smoke.alive).toBe(4);
      expect(fx.skidCount).toBe(2);

      // vida da fumaça: viva a 0.79 s, morta a 0.81 s
      const life = new Effects(new THREE.Scene(), () => 0.5);
      life.smoke.spawn(1);
      life.smoke.step(0.79);
      expect(life.smoke.alive).toBe(1);
      life.smoke.step(0.02);
      expect(life.smoke.alive).toBe(0);
      // vida da faísca: viva a 0.39 s, morta a 0.41 s
      life.collide({ impulse: 5000, x: 0, y: 0, z: 0 });
      life.sparks.step(0.39);
      expect(life.sparks.alive).toBeGreaterThan(0);
      life.sparks.step(0.02);
      expect(life.sparks.alive).toBe(0);

      // faíscas: 40 a partir de 3000 N·s, nada logo abaixo
      const hit = (impulse: number) => {
        const e = new Effects(new THREE.Scene(), () => 0.5);
        e.collide({ impulse, x: 0, y: 0, z: 0 });
        return e.sparks.alive;
      };
      expect(hit(2999)).toBe(0);
      expect(hit(3000)).toBe(40);
      expect(hit(3001)).toBe(40);

      // tetos: 256 de fumaça, 128 faíscas, 400 marcas
      const full = new Effects(new THREE.Scene(), () => 0.5);
      for (let i = 0; i < 100; i++) full.step(0.001, true, wheels, 0);
      expect(full.smoke.alive).toBe(256);
      for (let i = 0; i < 250; i++) full.step(0.001, true, wheels, 0);
      expect(full.skidCount).toBe(400);
      for (let i = 0; i < 4; i++) full.collide({ impulse: 3001, x: 0, y: 0, z: 0 });
      expect(full.sparks.alive).toBe(128);

      // freio de mão só marca acima de 20 km/h
      expect(isSkidding(true, 20, 0)).toBe(false);
      expect(isSkidding(true, 20.1, 0)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // car-handling C30 (AC 23) - substitui a parte unitária de visual-upgrade C36
  it('skidding from lateral slip or handbrake', () => {
    expect(isSkidding(false, 100, 2.6)).toBe(true);
    expect(isSkidding(false, 100, 2.5)).toBe(false);
    expect(isSkidding(false, 5, 3)).toBe(true);
    expect(isSkidding(true, 21, 0)).toBe(true);
    expect(isSkidding(true, 20, 0)).toBe(false);
    expect(isSkidding(false, 100, 0)).toBe(false);
  });

  // visual-upgrade C35 (AC 15, AC 16) - colisão abaixo do limiar não muda lastCollision
  it('collision tracker ignores impacts below 3000', () => {
    const t = new CollisionTracker();
    expect(t.record({ impulse: 2999, x: 0, y: 0, z: 0 })).toBe(0);
    expect(t.last).toBeNull();
    expect(t.record({ impulse: 5000, x: 1, y: 2, z: 3 })).toBe(40);
    expect(t.last).toEqual({ impulse: 5000, x: 1, y: 2, z: 3 });
    expect(t.record({ impulse: 100, x: 9, y: 9, z: 9 })).toBe(0);
    expect(t.last).toEqual({ impulse: 5000, x: 1, y: 2, z: 3 });
    expect(t.record({ impulse: 3000, x: 4, y: 5, z: 6 })).toBe(40);
    expect(t.last?.impulse).toBe(3000);
  });

  // visual-upgrade C15 (AC 15, AC 16)
  it('spark burst threshold at 3000', () => {
    expect(sparkBurstFor(0)).toBe(0);
    expect(sparkBurstFor(2999)).toBe(0);
    expect(sparkBurstFor(3000)).toBe(40);
    expect(sparkBurstFor(50000)).toBe(40);
  });
});
