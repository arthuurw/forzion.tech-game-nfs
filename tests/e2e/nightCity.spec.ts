import { expect, test, type Page } from '@playwright/test';
import { signPattern } from '../../src/world/signGlyphs';
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

test.describe('night-city - céu', () => {
  // C14 (AC 11)
  test('horizon glows above the skyline', async ({ page }) => {
    await open(page);
    await advanceSim(page, 1);
    const p = await page.evaluate(() => (window as any).__game.render.skyProfile() as { top: number; band: number });
    expect(p.band).toBeGreaterThanOrEqual(1.5 * p.top);
  });

  // C15 (AC 12, door 3)
  test('fog takes the horizon color', async ({ page }) => {
    await open(page);
    const s = await page.evaluate(() => (window as any).__game.world.sky);
    expect(s.fog).toBe('#2a1a3e');
    expect(s.horizon).toBe(s.fog);
    expect(s.background).toBe('#03040c');
  });

  // C17 (AC 14, door 3)
  test('sky dome follows the camera outside the mirror', async ({ page }) => {
    await open(page);
    await advanceSim(page, 0.5);
    const s = await page.evaluate(() => (window as any).__game.world.sky);
    expect(s.inScene).toBe(true);
    for (const k of ['x', 'y', 'z'] as const) expect(Math.abs(s.position[k] - s.camera[k]), k).toBeLessThanOrEqual(0.001);
    const skipped = await page.evaluate(() => (window as any).__game.render.reflectorSkipped as string[]);
    expect(skipped).toContain('sky');
  });

  // C18 (AC 15)
  test('sky is still', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => (window as any).__game.render.skyStill() as number)).toBe(-1);
    await advanceSim(page, 1);
    expect(await page.evaluate(() => (window as any).__game.render.skyStill() as number)).toBe(0);
  });
});

test.describe('night-city - letreiros', () => {
  // C20 (AC 16): o padrão de cada letreiro é o da regra pura, sorteado da posição dele
  test('signs are framed boxes with a glyph pattern', async ({ page }) => {
    await open(page);
    const groups = await page.evaluate(() => (window as any).__game.world.signs as Array<{ depth: number; signs: Array<{ x: number; z: number; pattern: number }> }>);
    expect(groups).toHaveLength(4);
    let total = 0;
    for (const g of groups) {
      expect(g.depth).toBeCloseTo(0.12, 6);
      for (const sg of g.signs) {
        expect(sg.pattern).toBe(signPattern(sg.x, sg.z));
        expect(sg.pattern).toBeGreaterThanOrEqual(0);
        expect(sg.pattern).toBeLessThanOrEqual(7);
        total++;
      }
    }
    expect(total).toBeGreaterThan(0);
  });
});
