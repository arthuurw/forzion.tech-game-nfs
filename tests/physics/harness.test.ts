import RAPIER from '@dimforge/rapier3d-compat';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CAR } from '../../src/vehicle/carSpec';
import { allWheelsInContact, createHarness, forwardSpeed, horizontalSpeed, initRapier, tiltDeg } from './harness';

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

  // C29 (door 3)
  it('harness builds the real car at rest', () => {
    const h = createHarness();
    expect(h.car.controller).toBeInstanceOf(RAPIER.DynamicRayCastVehicleController);
    expect(h.car.controller.numWheels()).toBe(4);
    h.settle();
    for (let i = 0; i < 60; i++) h.step();
    expect(allWheelsInContact(h.car)).toBe(true);
    // a velocidade do carro (a da frente, a do jogo) e a horizontal; o linvel.y lido entre passos
    // guarda o resíduo gravidade × dt que o controlador desfaz no passo seguinte (y fica parado)
    expect(Math.abs(forwardSpeed(h.car)) * 3.6).toBeLessThan(0.1);
    expect(horizontalSpeed(h.car) * 3.6).toBeLessThan(0.1);
    expect(tiltDeg(h.car)).toBeLessThan(1);

    const config = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(config).toContain("'tests/physics/**/*.test.ts'");
  });
});
