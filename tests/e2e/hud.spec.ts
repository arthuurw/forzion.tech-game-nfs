import { expect, test } from '@playwright/test';
import { advanceSim, gotoGame, holdKeySim, waitSimUntil } from './helpers';

test.describe('hud', () => {
  // C26 (AC 20)
  test('speed label matches car state', async ({ page }) => {
    await gotoGame(page);
    await page.keyboard.down('KeyW');
    await advanceSim(page, 2);
    const [label, kmh] = await page.evaluate(() => [
      document.querySelector('#speed')!.textContent,
      (window as any).__game.car.speedKmh as number,
    ]);
    await page.keyboard.up('KeyW');
    expect(Number(label)).toBeGreaterThan(10);
    // o DOM foi escrito no último frame; a física pode ter avançado alguns km/h desde então
    expect(Math.abs(Number(label) - Math.round(Math.abs(kmh as number)))).toBeLessThanOrEqual(3);
  });

  // C31 (AC 24)
  test('loading overlay shows then hides', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' });
    const loading = page.locator('#loading');
    await expect(loading).toBeVisible();
    await expect(loading).toContainText('Carregando...');
    await page.waitForFunction(() => (window as any).__game?.ready === true, null, { timeout: 30_000 });
    await expect(loading).toBeHidden();
    await expect(loading).toHaveCSS('display', 'none');
    await expect(page.locator('#hud')).toBeVisible();
  });

  // C32 (AC 25)
  test('webgl2 missing shows error overlay', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === 'webgl2') return null;
        return (original as any).call(this, type, ...rest);
      } as any;
    });
    await page.goto('/');
    const error = page.locator('#error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText('Seu navegador não suporta WebGL2');
    await page.waitForTimeout(1_000);
    const hasGame = await page.evaluate(() => (window as any).__game !== undefined);
    expect(hasGame).toBe(false);
    await expect(page.locator('#loading')).toBeHidden();
  });

  // C33 (AC 26)
  test('missing glb falls back to box chassis', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text());
    });
    await page.route('**/models/car.glb', (route) => route.abort());
    await gotoGame(page);

    expect(warnings.some((w) => w.includes('/models/car.glb'))).toBe(true);
    const placeholder = await page.evaluate(() => (window as any).__game.car.placeholder as boolean);
    expect(placeholder).toBe(true);

    await page.keyboard.down('KeyW');
    const reached = await waitSimUntil(page, 'g.car.speedKmh >= 50', 5);
    await page.keyboard.up('KeyW');
    expect(reached).toBe(true);
  });

  // extra: freio de mão chega ao carro
  test('handbrake key reaches the car', async ({ page }) => {
    await gotoGame(page);
    await holdKeySim(page, 'KeyW', 2);
    const before = await page.evaluate(() => (window as any).__game.car.speedKmh as number);
    await holdKeySim(page, 'Space', 1.5);
    const after = await page.evaluate(() => (window as any).__game.car.speedKmh as number);
    expect(after).toBeLessThan(before);
  });
});
