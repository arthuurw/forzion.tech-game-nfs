import { expect, test } from '@playwright/test';
import { advanceSim, buildingScenario, gotoGame, heading, holdKeySim, insideLot, position, speedKmh, teleport, waitSimUntil } from './helpers';

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
    // diferença normalizada em (−π, π]: o spawn da city-terrain não é em heading 0
    const d = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0));
    expect(d).toBeGreaterThan(0.15);
  });

  // yaw-assist C8: o campo DEV `__game.car.yawAssistNm` é o torque aplicado (positivo = esquerda)
  test('car debug exposes the yaw assist torque', async ({ page }) => {
    expect(await page.evaluate(() => (window as any).__game.car.yawAssistNm)).toBe(0);
    await page.keyboard.down('KeyW');
    await advanceSim(page, 1);
    await page.keyboard.down('KeyA');
    await advanceSim(page, 0.3);
    const nm = await page.evaluate(() => (window as any).__game.car.yawAssistNm);
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyW');
    expect(nm).toBeGreaterThan(0);
  });

  // C9 (AC 7); city-terrain C44: o prédio agora vem de `__game.world.lots`
  test('building blocks the chassis', async ({ page }) => {
    const s = await buildingScenario(page);
    await teleport(page, s.x, s.y, s.z, s.heading);
    await holdKeySim(page, 'KeyW', 3);
    const p = await position(page);
    expect(insideLot(s.lot, p.x, p.z)).toBe(false);
    // e o carro chegou perto o bastante para ter encostado na fachada
    const dx = p.x - s.lot.x;
    const dz = p.z - s.lot.z;
    const v = Math.abs(dx * Math.cos(s.lot.rotation) - dz * Math.sin(s.lot.rotation));
    expect(v - s.lot.depth / 2).toBeLessThan(6);
  });

  // city-terrain C42 (AC 35), supersede free-roam C10: paredes em ±1536
  test('invisible walls at 1536', async ({ page }) => {
    const walls = await page.evaluate(() => (window as any).__game.world.walls as Array<{ x: number; z: number; hx: number; hz: number }>);
    expect(walls.length).toBe(4);
    const faces = walls.map((w) => (w.hx < w.hz ? `x${Math.sign(w.x)}:${Math.abs(w.x) - w.hx}` : `z${Math.sign(w.z)}:${Math.abs(w.z) - w.hz}`)).sort();
    expect(faces).toEqual(['x-1:1536', 'x1:1536', 'z-1:1536', 'z1:1536']);
    // +x, -x e -z: 12 m da borda, de frente para ela (a borda +z é a baía: o carro volta pela água antes, C10)
    for (const edge of ['+x', '-x', '-z'] as const) {
      const start = await page.evaluate((edge) => {
        const w = (window as any).__game.world;
        const lots = w.lots as Array<{ x: number; z: number; width: number; depth: number }>;
        for (let t = -1000; t <= 1000; t += 40) {
          const [x, z, h] =
            edge === '+x' ? [1524, t, Math.PI / 2] : edge === '-x' ? [-1524, t, -Math.PI / 2] : [t, -1524, Math.PI];
          const ground = w.heightAt(x, z);
          if (ground < 0) continue;
          const near = w.nearestRoad(x, z);
          if (near.distance < near.width / 2 + 8) continue;
          if (lots.some((l) => Math.hypot(l.x - x, l.z - z) < Math.hypot(l.width, l.depth) / 2 + 20)) continue;
          return { x, z, y: ground + 1.5, h };
        }
        return null;
      }, edge);
      expect(start, edge).not.toBeNull();
      await teleport(page, start!.x, start!.y, start!.z, start!.h);
      await holdKeySim(page, 'KeyW', 3);
      const p = await position(page);
      expect(Math.abs(p.x), edge).toBeLessThanOrEqual(1536);
      expect(Math.abs(p.z), edge).toBeLessThanOrEqual(1536);
    }
  });

  // car-handling C33 (Surface, AC 6)
  test('car debug exposes handling state', async ({ page }) => {
    const info = await page.evaluate(() => {
      const car = (window as any).__game.car;
      return {
        massKg: car.spec.massKg,
        steerInput: car.steerInput,
        bodyRoll: car.bodyRoll,
        bodyPitch: car.bodyPitch,
        sideslip: car.sideslip,
        lateralG: car.lateralG,
      };
    });
    expect(info.massKg).toBe(1250);
    expect(info.steerInput).toBeGreaterThanOrEqual(-0.55);
    expect(info.steerInput).toBeLessThanOrEqual(0.55);
    for (const key of ['bodyRoll', 'bodyPitch', 'sideslip', 'lateralG'] as const) {
      expect(typeof info[key], key).toBe('number');
      expect(Number.isFinite(info[key]), key).toBe(true);
    }
    expect(Math.abs(await speedKmh(page))).toBeLessThan(1);
    await page.keyboard.down('KeyA');
    await advanceSim(page, 0.5);
    const steer = await page.evaluate(() => (window as any).__game.car.steerInput as number);
    await page.keyboard.up('KeyA');
    expect(steer).toBeGreaterThan(0.5);
  });

  // car-handling C35 (door 1, startup config)
  test('game builds the car from the default spec', async ({ page }) => {
    const [live, expected] = await page.evaluate(async () => {
      const mod = await import('/src/vehicle/carSpec.ts' as string);
      return [(window as any).__game.car.spec, mod.DEFAULT_CAR];
    });
    expect(Object.keys(expected).length).toBe(34);
    expect(live).toEqual(expected);
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
