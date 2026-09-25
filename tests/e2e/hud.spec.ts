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

test.describe('hud - rodada 2', () => {
  // C41 - qualquer erro na montagem do jogo cai no overlay de erro do boot
  test('boot failure shows error overlay', async ({ page }) => {
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        document.querySelector('#minimap')?.remove();
      });
    });
    await page.goto('/');
    const error = page.locator('#error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/^Falha ao iniciar o jogo:/);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as any).__game !== undefined)).toBe(false);
    await expect(page.locator('#loading')).toBeHidden();
  });

  // C42 (AC 23) - o canvas real do minimapa tem quarteirões e o carro desenhados
  test('minimap draws blocks and car', async ({ page }) => {
    await gotoGame(page);
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#minimap')!;
      const ctx = canvas.getContext('2d')!;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let car = 0;
      let blocks = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
          const nearCenter = Math.abs(x - 80) <= 10 && Math.abs(y - 80) <= 10;
          if (nearCenter && r === 255 && g === 122 && b === 26) car++;
          if (r === 43 && g === 45 && b === 61) blocks++;
        }
      }
      return { width: canvas.width, height: canvas.height, car, blocks };
    });
    expect(result.width).toBe(160);
    expect(result.height).toBe(160);
    expect(result.car).toBeGreaterThanOrEqual(10);
    expect(result.blocks).toBeGreaterThanOrEqual(100);
  });

  // C44 (AC 21, AC 22) - marcha e barra de RPM no DOM batem com o estado do carro
  test('gear and rpm bar match car state', async ({ page }) => {
    await gotoGame(page);
    await page.keyboard.down('KeyW');
    await advanceSim(page, 1.5);
    const sample = await page.evaluate(() => {
      const g = (window as any).__game;
      return {
        gearLabel: document.querySelector('#gear')!.textContent,
        rpmWidth: parseFloat((document.querySelector('#rpm-fill') as HTMLElement).style.width),
        gear: g.car.gear as number,
        rpm: g.car.rpm as number,
      };
    });
    await page.keyboard.up('KeyW');
    expect(sample.gear).toBe(2);
    expect(sample.gearLabel).toBe('2');
    const expectedWidth = ((sample.rpm - 1000) / 6000) * 100;
    expect(sample.rpmWidth).toBeGreaterThanOrEqual(0);
    expect(sample.rpmWidth).toBeLessThanOrEqual(100);
    expect(Math.abs(sample.rpmWidth - expectedWidth)).toBeLessThan(15);
  });
});
