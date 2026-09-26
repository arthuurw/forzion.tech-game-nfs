import RAPIER from '@dimforge/rapier3d-compat';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CAR } from '../../src/vehicle/carSpec';
import { allWheelsInContact, createHarness, horizontalSpeed, initRapier, tiltDeg } from './harness';

beforeAll(async () => {
  await initRapier();
});

describe('physics harness', () => {
  // C28, segunda prova (door 1): a ficha é lida, não copiada
  it('car reads mass from its spec', () => {
    const h = createHarness({ spec: { ...DEFAULT_CAR, massKg: 1500 } });
    expect(h.car.body.mass()).toBeGreaterThanOrEqual(1499);
    expect(h.car.body.mass()).toBeLessThanOrEqual(1501);
    h.settle();
    expect(h.car.body.mass()).toBeGreaterThanOrEqual(1499);
    expect(h.car.body.mass()).toBeLessThanOrEqual(1501);
  });

  // car-feel C13, segunda prova (door 1): a suspensão vem da ficha
  it('car reads suspension from its spec', () => {
    const h = createHarness({
      spec: { ...DEFAULT_CAR, suspensionStiffness: 23, suspensionCompression: 1.7, suspensionRelaxation: 2.1 },
    });
    const c = h.car.controller;
    expect(c.numWheels()).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(Math.abs(c.wheelSuspensionStiffness(i)! - 23), `wheel ${i} stiffness`).toBeLessThanOrEqual(1e-6);
      expect(Math.abs(c.wheelSuspensionCompression(i)! - 1.7), `wheel ${i} compression`).toBeLessThanOrEqual(1e-6);
      expect(Math.abs(c.wheelSuspensionRelaxation(i)! - 2.1), `wheel ${i} relaxation`).toBeLessThanOrEqual(1e-6);
    }
  });

  // C29 (door 3)
  it('harness builds the real car at rest', () => {
    const h = createHarness();
    expect(h.car.controller).toBeInstanceOf(RAPIER.DynamicRayCastVehicleController);
    expect(h.car.controller.numWheels()).toBe(4);
    h.settle();
    const heights: number[] = [];
    for (let i = 0; i < 60; i++) {
      h.step();
      heights.push(h.car.body.translation().y);
    }
    expect(allWheelsInContact(h.car)).toBe(true);
    expect(horizontalSpeed(h.car) * 3.6).toBeLessThan(0.1);
    // o linvel.y lido entre passos guarda o resíduo gravidade × dt; a altura é que prova o repouso
    const last10 = heights.slice(-10);
    expect(Math.max(...last10) - Math.min(...last10)).toBeLessThan(0.001);
    expect(tiltDeg(h.car)).toBeLessThan(1);

    const config = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(config).toContain("'tests/physics/**/*.test.ts'");
  });
});
