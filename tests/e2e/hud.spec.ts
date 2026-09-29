import { expect, test } from '@playwright/test';
import { advanceSim, gotoGame, holdKeySim, pageFrames, teleport, waitFrames, waitSimUntil } from './helpers';

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
  test('webgl2 missing shows error overlay', { tag: '@smoke' }, async ({ page }) => {
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
    await pageFrames(page, 30);
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
    await pageFrames(page, 30);
    expect(await page.evaluate(() => (window as any).__game !== undefined)).toBe(false);
    await expect(page.locator('#loading')).toBeHidden();
  });

  // C42 (AC 23) - o canvas real do minimapa tem as estradas e o carro desenhados (city-terrain C41)
  test('minimap draws roads and car', { tag: '@smoke' }, async ({ page }) => {
    await gotoGame(page);
    await waitFrames(page, 2);
    const result = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#minimap')!;
      const ctx = canvas.getContext('2d')!;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let car = 0;
      let roads = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
          const nearCenter = Math.abs(x - 80) <= 10 && Math.abs(y - 80) <= 10;
          if (nearCenter && r === 255 && g === 122 && b === 26) car++;
          if (r === 0x4a && g === 0x50 && b === 0x68) roads++;
        }
      }
      return { width: canvas.width, height: canvas.height, car, roads };
    });
    expect(result.width).toBe(160);
    expect(result.height).toBe(160);
    expect(result.car).toBeGreaterThanOrEqual(10);
    expect(result.roads).toBeGreaterThanOrEqual(200);

    // rotação pelo heading: frente = +x do mundo => ponta do triângulo à direita do centro
    const here = await page.evaluate(() => (window as any).__game.car.position);
    await teleport(page, here.x, here.y + 0.2, here.z, Math.PI / 2);
    await advanceSim(page, 0.1);
    await waitFrames(page, 2);
    const tip = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#minimap')!;
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      let minX = Infinity;
      let maxX = -Infinity;
      for (let y = 70; y <= 90; y++) {
        for (let x = 60; x <= 100; x++) {
          const i = (y * canvas.width + x) * 4;
          if (data[i] === 255 && data[i + 1] === 122 && data[i + 2] === 26) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
          }
        }
      }
      return { minX, maxX };
    });
    expect(tip.maxX).toBeGreaterThanOrEqual(84); // vértice em 87, antialiased
    expect(tip.minX).toBeGreaterThanOrEqual(74);
  });

  // car-handling C32 (AC 24, AC 25) - troca automática com queda de giro, e o HUD mostra a marcha engatada
  test('automatic upshift drops rpm on the hud', async ({ page }) => {
    await gotoGame(page);
    await page.keyboard.down('KeyW');
    const samples = await page.evaluate(
      () =>
        new Promise<Array<{ t: number; gear: number; rpm: number; label: string | null }>>((resolve) => {
          const g = (window as any).__game;
          const start = g.simTime as number;
          const out: Array<{ t: number; gear: number; rpm: number; label: string | null }> = [];
          const tick = (): void => {
            out.push({
              t: g.simTime,
              gear: g.car.gear,
              rpm: g.car.rpm,
              label: document.querySelector('#gear')!.textContent,
            });
            if (g.simTime >= start + 4) resolve(out);
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
    await page.keyboard.up('KeyW');

    for (const s of samples) expect(s.label, `t ${s.t.toFixed(2)}`).toBe(String(s.gear));
    const up = samples.findIndex((s, i) => i > 0 && s.gear > samples[i - 1]!.gear);
    expect(up).toBeGreaterThan(0);
    const before = samples[up - 1]!;
    const after = samples.filter((s) => s.t > before.t && s.t <= before.t + 0.3);
    expect(after.length).toBeGreaterThan(0);
    const lowest = Math.min(...after.map((s) => s.rpm));
    expect(before.rpm - lowest).toBeGreaterThanOrEqual(1500);
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
    expect(sample.gear).toBeGreaterThanOrEqual(2);
    expect(sample.gearLabel).toBe(String(sample.gear));
    const expectedWidth = ((sample.rpm - 1000) / 6000) * 100;
    expect(sample.rpmWidth).toBeGreaterThanOrEqual(0);
    expect(sample.rpmWidth).toBeLessThanOrEqual(100);
    expect(Math.abs(sample.rpmWidth - expectedWidth)).toBeLessThan(15);
  });
});

test.describe('hud - erro e carregamento', () => {
  // play-fixes C11 (AC 7)
  test('a frame error shows the error overlay', async ({ page }) => {
    await gotoGame(page);
    await page.evaluate(() => (window as any).__game.failNextStep('boom'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#error')!).display !== 'none', null, { timeout: 5_000 });
    expect(await page.textContent('#error')).toBe('Erro no jogo: boom');
    const t0 = await page.evaluate(() => (window as any).__game.simTime as number);
    // 0.5 s de relógio e pelo menos 10 quadros do navegador, sem o loop do jogo
    const since = await page.evaluate(() => performance.now());
    await pageFrames(page, 10);
    await page.waitForFunction((since) => performance.now() - since >= 500, since);
    expect(await page.evaluate(() => (window as any).__game.simTime as number)).toBe(t0);
  });

  // play-fixes C12 (AC 8): um quadro roda com o texto novo antes de o mundo existir
  test('loading paints city generation before building the world', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as any;
      w.__sawCityText = false;
      const tick = () => {
        const el = document.querySelector('#loading-text');
        if (!w.__game && el?.textContent === 'Gerando cidade...') w.__sawCityText = true;
        if (!w.__game) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await gotoGame(page);
    expect(await page.evaluate(() => (window as any).__sawCityText)).toBe(true);
  });
});
