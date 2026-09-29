import { expect, test, type Page } from '@playwright/test';
import { advanceSim } from './helpers';

// night-city: provas no browser (checks C6, C8-C11, C14, C15, C17, C18, C20, C27, C29)

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => (window as any).__game?.ready === true, null, { timeout: 30_000 });
}

test.describe('night-city - postes', () => {
  // C6 (AC 4): em `low` (sem espelho) só a luz do chão soma no asfalto
  test('street light pools on the asphalt', async ({ page }) => {
    await open(page, '?quality=low');
    const setup = await page.evaluate(() => {
      const w = (window as any).__game.world;
      for (let i = 0; i < w.lampCount; i++) {
        const l = w.lampAt(i);
        if (l.kind !== 'avenue' || Math.abs(l.x) > 400 || Math.abs(l.z) > 400) continue;
        const f = { x: Math.sin(l.heading), z: Math.cos(l.heading) };
        const back = w.nearestRoad(l.head.x - f.x * 30, l.head.z - f.z * 30);
        const ahead = w.nearestRoad(l.head.x + f.x * 20, l.head.z + f.z * 20);
        const under = w.nearestRoad(l.head.x, l.head.z);
        if (back.roadId !== under.roadId || ahead.roadId !== under.roadId) continue;
        return {
          car: { x: back.x, y: back.y + 1.2, z: back.z, heading: l.heading },
          points: [
            { x: l.head.x, y: under.y + 0.06, z: l.head.z },
            { x: l.head.x + f.x * 20, y: ahead.y + 0.06, z: l.head.z + f.z * 20 },
          ],
        };
      }
      return null;
    });
    expect(setup).not.toBeNull();
    await page.evaluate((c) => (window as any).__game.car.teleport(c.x, c.y, c.z, c.heading), setup!.car);
    await advanceSim(page, 1.5);
    const [under, between] = await page.evaluate((pts) => (window as any).__game.render.lumAt(pts), setup!.points);
    expect(under).not.toBeNull();
    expect(between).not.toBeNull();
    expect(under!).toBeGreaterThanOrEqual(1.3 * between!);
  });

  // C8 (AC 2)
  test('lamp colors in the browser', async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => {
      const w = (window as any).__game.world;
      let downtown: string | null = null;
      let hill: string | null = null;
      for (let i = 0; i < w.lampCount && (!downtown || !hill); i++) {
        const l = w.lampAt(i);
        if (!downtown && Math.abs(l.x) <= 500 && Math.abs(l.z) <= 500) downtown = l.color;
        if (!hill && l.kind === 'hill' && (Math.abs(l.x) > 500 || Math.abs(l.z) > 500)) hill = l.color;
      }
      return { downtown, hill };
    });
    expect(r.downtown).toBe('#dce6ff');
    expect(r.hill).toBe('#ff9d4a');
  });

  // C29 (door 2)
  test('ground materials share the lamp light map', async ({ page }) => {
    await open(page);
    const l = await page.evaluate(() => (window as any).__game.world.lampLight);
    expect(l.width).toBe(1536);
    expect(l.height).toBe(1536);
    expect(l.linear).toBe(true);
    expect(l.mipmaps).toBe(false);
    for (const [name, uuid] of Object.entries(l.materials)) expect(uuid, name).toBe(l.uuid);
  });
});


test.describe('night-city - asfalto molhado', () => {
  const streak = (page: Page, d: number, opts: { mirrorBlur?: boolean } = {}) =>
    page.evaluate(([d, opts]) => (window as any).__game.render.mirrorStreak(d, opts) as { w: number; h: number; srcH: number }, [d, opts] as const);

  // C9 (AC 6)
  test('reflections are vertical streaks', async ({ page }) => {
    await open(page);
    await advanceSim(page, 1);
    const s = await streak(page, 20);
    expect(s.w).toBeGreaterThan(0);
    expect(s.h).toBeGreaterThanOrEqual(3 * s.w);
  });

  // C10 (AC 7): a sonda enxerga o reflexo nítido
  test('probe sees a sharp reflection without streaks', async ({ page }) => {
    await open(page);
    await advanceSim(page, 1);
    const s = await streak(page, 20, { mirrorBlur: false });
    expect(s.w).toBeGreaterThan(0);
    expect(s.h).toBeLessThanOrEqual(1.5 * s.w);
  });

  // C11 (AC 8)
  test('streaks grow with distance', async ({ page }) => {
    await open(page);
    await advanceSim(page, 1);
    const near = await streak(page, 20);
    const far = await streak(page, 60);
    expect(near.srcH).toBeGreaterThan(0);
    expect(far.srcH).toBeGreaterThan(0);
    expect(far.h / far.srcH).toBeGreaterThan(near.h / near.srcH);
  });
});
