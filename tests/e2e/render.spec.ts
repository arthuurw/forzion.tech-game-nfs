import { expect, test } from '@playwright/test';
import { gotoGame } from './helpers';

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
});
