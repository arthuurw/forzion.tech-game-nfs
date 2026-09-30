import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Rain } from '../../src/world/Rain';
import { RAIN_BELOW, RAIN_BOX, RAIN_SPEED_MS, rainY } from '../../src/world/rainMath';

describe('rain math', () => {
  // visual-upgrade C10 (AC 10)
  it('rain drop wraps inside the box', () => {
    expect(RAIN_BOX).toEqual({ x: 60, y: 40, z: 60 });
    expect(RAIN_SPEED_MS).toBe(12);
    expect(rainY(30, 0)).toBeCloseTo(30, 6);
    expect(rainY(30, 1)).toBeCloseTo(18, 6);
    expect(rainY(5, 1)).toBeCloseTo(33, 6);
    expect(rainY(5, 10)).toBeCloseTo(5, 6);
    for (let t = 0; t < 100; t += 0.37) {
      const y = rainY(17, t);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(40);
    }
  });

  // play-fixes C23 (AC 17)
  it('rain box follows the car height', () => {
    expect(RAIN_BELOW).toBe(12);
    for (const cy of [0, 2, 60, 94]) {
      for (const seed of [0.5, 17, 39.9]) {
        for (let t = 0; t <= 100; t += 0.37) {
          const y = rainY(seed, t, cy);
          expect(y, `cy ${cy} seed ${seed} t ${t}`).toBeGreaterThanOrEqual(cy - 12);
          expect(y, `cy ${cy} seed ${seed} t ${t}`).toBeLessThan(cy + 28);
        }
      }
    }
    // o shader faz a mesma conta, com as constantes de rainMath
    const rain = new Rain(new THREE.Scene(), 8);
    const vs = rain.material.vertexShader;
    expect(vs).toContain(`float bottom = uCenter.y - ${RAIN_BELOW.toFixed(1)};`);
    expect(vs).toContain('float y = bottom + mod(position.y - uSpeed * uTime - bottom, uBox.y);');
    expect((rain.material.uniforms.uBox!.value as THREE.Vector3).y).toBe(RAIN_BOX.y);
  });
});
