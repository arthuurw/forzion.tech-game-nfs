import { expect, test } from '@playwright/test';
import { advanceSim, gotoGame, heading, holdKeySim, position, speedKmh, teleport, waitSimUntil } from './helpers';

test.describe('drive', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGame(page);
  });

  // C40 (door 2)
  test('rapier vehicle controller with 4 wheels', async ({ page }) => {
    const info = await page.evaluate(() => {
      const car = (window as any).__game.car;
      return { wheelCount: car.wheelCount, controllerKind: car.controllerKind };
    });
    expect(info.wheelCount).toBe(4);
    expect(info.controllerKind).toBe('DynamicRayCastVehicleController');
  });

  // C1 (AC 1) - 5 s de simulação a partir do repouso
  test('throttle reaches 50 kmh within 5s', async ({ page }) => {
    expect(await speedKmh(page)).toBeLessThan(1);
    await page.keyboard.down('KeyW');
    const reached = await waitSimUntil(page, 'g.car.speedKmh >= 50', 5);
    await page.keyboard.up('KeyW');
    expect(reached).toBe(true);
  });

  // C3 (AC 2)
  test('brake reduces speed', async ({ page }) => {
    await holdKeySim(page, 'KeyW', 3);
    const before = await speedKmh(page);
    await holdKeySim(page, 'KeyS', 1);
    const after = await speedKmh(page);
    expect(before).toBeGreaterThan(20);
    expect(after).toBeLessThan(before);
  });

  // C5 (AC 3)
  test('reverse drives backward up to 30 kmh', async ({ page }) => {
    await page.keyboard.down('KeyS');
    await advanceSim(page, 5);
    const speed = await speedKmh(page);
    await page.keyboard.up('KeyS');
    expect(speed).toBeLessThanOrEqual(-5);
    expect(speed).toBeGreaterThanOrEqual(-30);
  });

  // extra: sinal da direção (A vira à esquerda = heading cresce)
  test('A turns left', async ({ page }) => {
    const h0 = await heading(page);
    await page.keyboard.down('KeyW');
    await advanceSim(page, 1);
    await page.keyboard.down('KeyA');
    await advanceSim(page, 1.5);
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyW');
    const h1 = await heading(page);
    expect(h1 - h0).toBeGreaterThan(0.15);
  });

  // C9 (AC 7)
  test('building blocks the chassis', async ({ page }) => {
    // quarteirão da 2ª fileira (z = -130): o carro parte da rua ao sul (z = -156)
    const target = await page.evaluate(() => {
      const city = (window as any).__game.city;
      const block = city.blocks.find((b: any) => Math.abs(b.z - -130) < 1e-6 && Math.abs(b.x - -26) < 1e-6);
      const b = block.buildings.reduce((best: any, cur: any) =>
        cur.z - cur.depth / 2 < best.z - best.depth / 2 ? cur : best,
      );
      return { x: b.x, zMin: b.z - b.depth / 2, zMax: b.z + b.depth / 2, xMin: b.x - b.width / 2, xMax: b.x + b.width / 2 };
    });
    await teleport(page, target.x, 1.2, -156, 0);
    await holdKeySim(page, 'KeyW', 3);
    const p = await position(page);
    const insideX = p.x > target.xMin && p.x < target.xMax;
    const insideZ = p.z > target.zMin && p.z < target.zMax;
    expect(insideX && insideZ).toBe(false);
    // e o carro chegou perto o bastante para ter encostado
    expect(target.zMin - p.z).toBeLessThan(6);
  });

  // C10 (AC 8)
  test('invisible wall keeps chassis inside city', async ({ page }) => {
    await teleport(page, 192, 1.2, 0, Math.PI / 2);
    await holdKeySim(page, 'KeyW', 3);
    const p = await position(page);
    expect(Math.abs(p.x)).toBeLessThanOrEqual(202);
    expect(Math.abs(p.z)).toBeLessThanOrEqual(202);
    expect(p.x).toBeGreaterThan(195);
  });

  // C11 (AC 9)
  test('reset puts car upright', async ({ page }) => {
    await page.evaluate(() => (window as any).__game.car.setRotation({ x: 0, y: 0, z: 1, w: 0 }));
    await advanceSim(page, 0.2);
    const before = await position(page);
    await page.keyboard.press('KeyR');
    await page.waitForFunction(() => (window as any).__game.car.lastReset !== null);
    const snap = await page.evaluate(() => (window as any).__game.car.lastReset);
    expect(Math.abs(snap.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(snap.rotation.y)).toBeLessThan(0.01);
    expect(Math.abs(snap.rotation.z)).toBeLessThan(0.01);
    expect(snap.rotation.w).toBeGreaterThan(0.99);
    expect(snap.position.y).toBeCloseTo(before.y + 1, 1);
    expect(Math.hypot(snap.linvel.x, snap.linvel.y, snap.linvel.z)).toBeLessThan(0.01);
    expect(Math.hypot(snap.angvel.x, snap.angvel.y, snap.angvel.z)).toBeLessThan(0.01);

    // e o corpo vivo continua em pé logo depois
    const live = await page.evaluate(() => (window as any).__game.car.rotation);
    expect(Math.abs(live.z)).toBeLessThan(0.1);
    expect(live.w).toBeGreaterThan(0.95);
  });
});
