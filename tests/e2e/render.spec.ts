import { expect, test } from '@playwright/test';
import { advanceSim, gotoGame } from './helpers';

test.describe('render', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGame(page);
    await page.waitForTimeout(500);
  });

  // C21 (AC 17)
  test('draw calls at most 60', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__game.render.calls as number);
    expect(calls).toBeGreaterThan(0);
    expect(calls).toBeLessThanOrEqual(60);
  });

  // C22 (AC 17)
  test('neon emissive intensity at least 2', async ({ page }) => {
    const m = await page.evaluate(() => (window as any).__game.materials);
    expect(m.windowEmissiveIntensity).toBeGreaterThanOrEqual(2);
    expect(m.lampEmissiveIntensity).toBeGreaterThanOrEqual(2);
    expect(m.signEmissiveIntensities.length).toBe(4);
    for (const v of m.signEmissiveIntensities) expect(v).toBeGreaterThanOrEqual(2);
  });

  // C23 (AC 18)
  test('wet road material and environment map', async ({ page }) => {
    const roughness = await page.evaluate(() => (window as any).__game.materials.roadRoughness as number);
    const hasEnv = await page.evaluate(() => (window as any).__game.scene.hasEnvironment as boolean);
    expect(roughness).toBeLessThanOrEqual(0.25);
    expect(hasEnv).toBe(true);
  });

  // C24 (AC 19)
  test('bloom pass and ACES tone mapping', async ({ page }) => {
    const info = await page.evaluate(() => {
      const g = (window as any).__game;
      return { passes: g.composer.passes, bloomEnabled: g.composer.bloomEnabled, aces: g.toneMappingIsACES };
    });
    expect(info.passes).toContain('UnrealBloomPass');
    expect(info.bloomEnabled).toBe(true);
    expect(info.aces).toBe(true);
  });

  // C43 (AC 11) - consumidor de ChaseCamera
  test('camera sits 6 m behind and 2.5 m above', async ({ page }) => {
    await advanceSim(page, 2);
    const { car, cam } = await page.evaluate(() => {
      const g = (window as any).__game;
      return { car: { ...g.car.position, heading: g.car.heading }, cam: g.camera.position };
    });
    const expected = {
      x: car.x - 6 * Math.sin(car.heading),
      y: car.y + 2.5,
      z: car.z - 6 * Math.cos(car.heading),
    };
    const dist = Math.hypot(cam.x - expected.x, cam.y - expected.y, cam.z - expected.z);
    expect(dist).toBeLessThan(0.1);
  });

  // C45 (doors 2, 3, 5, 6) - literais das portas
  test('landing door literals', async ({ page }) => {
    const info = await page.evaluate(() => {
      const g = (window as any).__game;
      return {
        passes: g.composer.passes,
        bloom: g.composer.bloomParams,
        timestep: g.physics.timestep,
        seed: g.city.seed,
      };
    });
    expect(info.passes).toEqual(['RenderPass', 'UnrealBloomPass', 'OutputPass']);
    expect(info.bloom.strength).toBeCloseTo(0.8, 6);
    expect(info.bloom.radius).toBeCloseTo(0.4, 6);
    expect(info.bloom.threshold).toBeCloseTo(0.7, 6);
    // o Rapier guarda o timestep em float32: 1/60 vira 0.01666667 (diferença ~9e-10)
    expect(info.timestep).toBeCloseTo(1 / 60, 6);
    expect(info.seed).toBe(1337);

    await page.keyboard.down('KeyW');
    await advanceSim(page, 0.5);
    const forces = await page.evaluate(() => (window as any).__game.car.wheelEngineForce as number[]);
    await page.keyboard.up('KeyW');
    expect(forces[0]).toBe(0);
    expect(forces[1]).toBe(0);
    expect(forces[2]).toBeGreaterThan(0);
    expect(forces[3]).toBeGreaterThan(0);
  });
});
