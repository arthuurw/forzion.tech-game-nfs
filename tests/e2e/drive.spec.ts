import { expect, test } from '@playwright/test';
import { advanceSim, buildingScenario, gotoGame, heading, holdKeySim, insideLot, position, speedKmh, teleport, waitFrames, waitSimUntil } from './helpers';

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
    // residuals C7: o HUD mostra "R" com o carro de ré
    const gear = await page.evaluate(() => ({
      label: document.querySelector('#gear')!.textContent,
      value: (window as any).__game.car.gear as number,
    }));
    await page.keyboard.up('KeyS');
    expect(speed).toBeLessThanOrEqual(-5);
    expect(speed).toBeGreaterThanOrEqual(-30);
    expect(gear).toEqual({ label: 'R', value: -1 });
  });

  // play-fixes C3 (AC 1): o keyup de W iria para outra janela
  test('window blur releases the throttle', async ({ page }) => {
    await page.keyboard.down('KeyW');
    await advanceSim(page, 1);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await advanceSim(page, 0.5);
    const a = await speedKmh(page);
    await advanceSim(page, 1);
    const b = await speedKmh(page);
    await page.keyboard.up('KeyW');
    expect(a).toBeGreaterThan(5);
    expect(b - a).toBeLessThanOrEqual(0.5);
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

  // corner-assist C7: o campo DEV `__game.car.cornerAssistN` é a força de curva aplicada (positivo = esquerda)
  test('car debug exposes the corner assist force', async ({ page }) => {
    expect(await page.evaluate(() => (window as any).__game.car.cornerAssistN)).toBe(0);
    await page.keyboard.down('KeyW');
    await advanceSim(page, 2);
    await page.keyboard.down('KeyA');
    await advanceSim(page, 0.5);
    const n = await page.evaluate(() => (window as any).__game.car.cornerAssistN);
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyW');
    expect(n).toBeGreaterThan(0);
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
  test('car debug exposes handling state', { tag: '@smoke' }, async ({ page }) => {
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

  // C11 (AC 9); play-fixes C22 (AC 16): em pé e com o heading de antes, não mais a rotação identidade
  test('reset puts car upright and keeps the heading', { tag: '@smoke' }, async ({ page }) => {
    const h0 = await heading(page);
    // de cabeça para baixo (rolagem de 180°) com o heading do spawn: yaw(h0) · roll(π)
    await page.evaluate((h) => (window as any).__game.car.setRotation({ x: Math.sin(h / 2), y: 0, z: Math.cos(h / 2), w: 0 }), h0);
    // assenta de cabeça para baixo; posição e heading lidos juntos, logo antes do R
    await advanceSim(page, 1);
    const { before, hBefore } = await page.evaluate(() => {
      const c = (window as any).__game.car;
      return { before: c.position as { x: number; y: number; z: number }, hBefore: c.heading as number };
    });
    await page.keyboard.press('KeyR');
    await page.waitForFunction(() => (window as any).__game.car.lastReset !== null);
    const snap = await page.evaluate(() => (window as any).__game.car.lastReset);
    const { x, y, z, w } = snap.rotation;
    // +Y do chassi no mundo e +Z (frente) no plano
    const upY = 1 - 2 * (x * x + z * z);
    const hAfter = Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y));
    expect(upY).toBeGreaterThanOrEqual(0.999);
    expect(Math.abs(Math.atan2(Math.sin(hAfter - hBefore), Math.cos(hAfter - hBefore)))).toBeLessThanOrEqual(0.01);
    expect(snap.position.y).toBeCloseTo(before.y + 1, 1);
    expect(Math.hypot(snap.linvel.x, snap.linvel.y, snap.linvel.z)).toBeLessThan(0.01);
    expect(Math.hypot(snap.angvel.x, snap.angvel.y, snap.angvel.z)).toBeLessThan(0.01);

    // e o corpo vivo continua em pé logo depois
    const live = await page.evaluate(() => (window as any).__game.car.rotation);
    expect(1 - 2 * (live.x * live.x + live.z * live.z)).toBeGreaterThan(0.95);
  });


  // smooth-world C6 (AC 4) e C24 (Impact, sondas DEV), num boot só: a câmera segue a pose desenhada
  // (`car.drawn`); `position` segue a física e o desenho é o campo novo `drawn`, no carro e nos oponentes
  test('chase camera follows the drawn pose; probes keep the physics pose and add the drawn one', async ({ page }) => {
    /** alvo da câmera menos a pose desenhada, no referencial do carro desenhado: para trás, para cima, para o lado − lateral */
    const sample = () =>
      page.evaluate(() => {
        const g = (window as any).__game;
        const d = g.car.drawn;
        const t = g.camera.target;
        const q = d.rotation;
        const h = Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y));
        const ox = t.x - d.x;
        const oz = t.z - d.z;
        const p = g.car.position;
        return {
          along: ox * Math.sin(h) + oz * Math.cos(h),
          up: t.y - d.y,
          side: ox * Math.cos(h) - oz * Math.sin(h) - g.camera.lateral,
          gap: Math.hypot(p.x - d.x, p.y - d.y, p.z - d.z),
        };
      });
    // parado no spawn
    await advanceSim(page, 1);
    await waitFrames(page, 1);
    const parked = await sample();
    expect(parked.gap).toBeLessThan(1e-3);
    // andando a ~100 km/h em linha reta: alvo − pose desenhada igual ao caso parado, em todo quadro
    await page.evaluate(() => (window as any).__game.car.setForwardSpeed(27.8));
    await page.keyboard.down('KeyW');
    let maxGap = 0;
    for (let i = 0; i < 4; i++) {
      await waitFrames(page, 1);
      const m = await sample();
      expect(Math.abs(m.along - parked.along), `quadro ${i} along`).toBeLessThanOrEqual(1e-4);
      expect(Math.abs(m.up - parked.up), `quadro ${i} up`).toBeLessThanOrEqual(1e-4);
      expect(Math.abs(m.side - parked.side), `quadro ${i} side`).toBeLessThanOrEqual(1e-4);
      maxGap = Math.max(maxGap, m.gap);
    }
    // e a pose desenhada não é a física: a prova acima distingue as duas
    expect(maxGap).toBeGreaterThan(1e-3);

    // C24: um passo sem quadro muda `position` (física) e não muda `drawn` (o desenho só anda no quadro)
    const car = await page.evaluate(() => {
      const g = (window as any).__game;
      const before = { p: g.car.position, d: g.car.drawn };
      g.stepSim(1 / 60);
      return { before, after: { p: g.car.position, d: g.car.drawn }, kmh: g.car.speedKmh as number };
    });
    await page.keyboard.up('KeyW');
    const moved = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    expect(car.kmh).toBeGreaterThan(60);
    expect(moved(car.after.p, car.before.p)).toBeGreaterThan(car.kmh / 3.6 / 60 / 2);
    expect(car.after.d).toEqual(car.before.d);
    const drawnBefore = car.after.d;
    await waitFrames(page, 1);
    expect(moved(await page.evaluate(() => (window as any).__game.car.drawn), drawnBefore)).toBeGreaterThan(0.1);

    // oponentes: uma corrida no circuito do centro, já andando
    await page.evaluate(() => {
      const g = (window as any).__game;
      const r = g.race.races.find((x: any) => x.id === 'circuito-centro');
      const h = r.grid[3].heading;
      const x = r.marker.x - Math.sin(h) * 3;
      const z = r.marker.z - Math.cos(h) * 3;
      g.car.teleport(x, g.world.nearestRoad(x, z).y + 1.2, z, h);
    });
    await advanceSim(page, 0.1);
    await page.keyboard.press('Enter');
    expect(await waitSimUntil(page, "g.race.state === 'racing'", 5)).toBe(true);
    await advanceSim(page, 2);
    const ops = await page.evaluate(() => {
      const g = (window as any).__game;
      const pick = () => g.race.opponents.map((o: any) => ({ p: o.position, d: o.drawn }));
      const before = pick();
      g.stepSim(1 / 60);
      return { before, after: pick() };
    });
    expect(ops.before).toHaveLength(3);
    ops.before.forEach((b: any, i: number) => {
      const a = ops.after[i];
      expect(moved(a.p, b.p), `oponente ${i}`).toBeGreaterThan(0.01);
      expect(a.d, `oponente ${i}`).toEqual(b.d);
    });
  });
});
