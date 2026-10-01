import { expect, test, type Page } from '@playwright/test';
import { SKYLINE_STEPS, skylineHeight } from '../../src/world/skyMath';
import { signPattern } from '../../src/world/signGlyphs';
import { advanceSim, gotoGame } from './helpers';

// night-city: provas no browser (checks C6, C8-C11, C14, C15, C17, C18, C20, C27, C29-C32)

const open = gotoGame;

type Pose = { x: number; y: number; z: number; tx: number; ty: number; tz: number };
type P3 = { x: number; y: number; z: number };

/** `render.isolatedLum`: só os objetos `names`, câmera em `pose`, maior luminância em volta de cada ponto */
function isolatedLum(page: Page, names: string[], pose: Pose, points: P3[], win = 0): Promise<Array<number | null>> {
  return page.evaluate(([n, p, pts, w]) => (window as any).__game.render.isolatedLum(n, p, pts, w), [names, pose, points, win] as const);
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
    await advanceSim(page, 1.5, { realtime: true });
    const [under, between] = await page.evaluate((pts) => (window as any).__game.render.lumAt(pts), setup!.points);
    expect(under).not.toBeNull();
    expect(between).not.toBeNull();
    expect(under!).toBeGreaterThanOrEqual(1.3 * between!);
  });

  // C31 (AC 1): só a lente brilha; haste e braço ficam escuros
  test('only the lamp lens glows', async ({ page }) => {
    await open(page);
    const l = await page.evaluate(() => {
      const w = (window as any).__game.world;
      for (let i = 0; i < w.lampCount; i++) {
        const l = w.lampAt(i);
        if (l.kind === 'avenue' && Math.abs(l.x) < 400 && Math.abs(l.z) < 400) return l;
      }
      return null;
    });
    expect(l).not.toBeNull();
    // braço para a estrada: (−side·cos h, 0, side·sin h); câmera 8 m para a estrada, 1.5 m do chão
    const ax = -l.side * Math.cos(l.heading);
    const az = l.side * Math.sin(l.heading);
    const pose = { x: l.x + ax * 8, y: l.y + 1.5, z: l.z + az * 8, tx: l.head.x, ty: l.head.y - 1, tz: l.head.z };
    const [lens, post, arm] = await isolatedLum(
      page,
      ['street-lamps'],
      pose,
      [
        { x: l.head.x, y: l.y + 5.81, z: l.head.z },
        { x: l.x, y: l.y + 3, z: l.z },
        { x: l.x + ax * 0.8, y: l.y + 5.95, z: l.z + az * 0.8 },
      ],
      1,
    );
    expect(lens!).toBeGreaterThanOrEqual(0.5);
    expect(post!).toBeLessThanOrEqual(0.05);
    expect(arm!).toBeLessThanOrEqual(0.05);
  });

  // C8 (AC 2)
  test('lamp colors in the browser', { tag: '@smoke' }, async ({ page }) => {
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

  // C26 (AC 22): a grade de luz é montada uma vez e não muda com o tempo
  test('lamp light map is built once', async ({ page }) => {
    await open(page);
    const a = await page.evaluate(() => (window as any).__game.world.lampLight);
    await advanceSim(page, 1);
    const b = await page.evaluate(() => (window as any).__game.world.lampLight);
    expect(b.uuid).toBe(a.uuid);
    expect(b.version).toBe(a.version);
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
  test('fog takes the horizon color', { tag: '@smoke' }, async ({ page }) => {
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

  // C30 (AC 13, door 3): a cúpula desenha a silhueta de `skylineHeight`
  test('dome draws the skyline silhouette', async ({ page }) => {
    await open(page);
    const cam = await page.evaluate(() => (window as any).__game.world.sky.camera as P3);
    const dir = (az: number, e: number) => ({
      x: cam.x + Math.sin(az) * Math.cos(e) * 400,
      y: cam.y + Math.sin(e) * 400,
      z: cam.z + Math.cos(az) * Math.cos(e) * 400,
    });
    let dark = 0;
    for (let k = 0; k < SKYLINE_STEPS; k += 8) {
      // meio do degrau k: azimute como atan2(x, z) em [−π, π)
      const az = -Math.PI + ((k + 0.5) * 2 * Math.PI) / SKYLINE_STEPS;
      const h = skylineHeight(az);
      const look = dir(az, 0.03);
      const [below, above] = await isolatedLum(page, ['sky'], { ...cam, tx: look.x, ty: look.y, tz: look.z }, [dir(az, h - 0.006), dir(az, h + 0.01)]);
      expect(below, `degrau ${k}`).not.toBeNull();
      expect(above, `degrau ${k}`).not.toBeNull();
      expect(below!, `degrau ${k}`).toBeLessThanOrEqual(0.5 * above!);
      dark++;
    }
    expect(dark).toBe(12);
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
  // C32 (AC 16): tubos na face da frente e na de trás; as laterais da caixa ficam escuras
  test('sign tubes glow on both faces and the frame stays dark', async ({ page }) => {
    await open(page);
    const sg = await page.evaluate(() => {
      const all = ((window as any).__game.world.signs as Array<{ signs: any[] }>).flatMap((c) => c.signs);
      return all.find((s) => s.width >= 2 && s.height >= 1) ?? null;
    });
    expect(sg).not.toBeNull();
    // eixos locais da caixa girada por `rotationY`: +x (largura), +z (normal da face)
    const r = sg.rotationY as number;
    const ux = { x: Math.cos(r), z: -Math.sin(r) };
    const nz = { x: Math.sin(r), z: Math.cos(r) };
    const at = (u: number, v: number, w: number): P3 => ({
      x: sg.x + ux.x * u * sg.width + nz.x * w,
      y: sg.y + v * sg.height,
      z: sg.z + ux.z * u * sg.width + nz.z * w,
    });
    const grid = (w: number) => {
      const pts: P3[] = [];
      for (let i = -4; i <= 4; i++) for (let j = -2; j <= 2; j++) pts.push(at(i / 10, j / 6, w));
      return pts;
    };
    const face = async (sideSign: number) => {
      const eye = at(0, 0, sideSign * 5);
      const lum = await isolatedLum(page, ['neon-signs'], { ...eye, tx: sg.x, ty: sg.y, tz: sg.z }, grid(sideSign * 0.061), 2);
      return Math.max(...lum.map((v) => v ?? 0));
    };
    expect(await face(1)).toBeGreaterThanOrEqual(0.5);
    expect(await face(-1)).toBeGreaterThanOrEqual(0.5);
    // de lado: a face lateral (0.12 m de fundo) em x = +largura/2
    const eye = { x: sg.x + ux.x * (sg.width / 2 + 3), y: sg.y, z: sg.z + ux.z * (sg.width / 2 + 3) };
    const sidePts: P3[] = [];
    for (let j = -2; j <= 2; j++) for (const w of [-0.04, 0, 0.04]) sidePts.push({ ...at(0.5, j / 6, w), x: at(0.5, j / 6, w).x + ux.x * 0.001, z: at(0.5, j / 6, w).z + ux.z * 0.001 });
    const side = await isolatedLum(page, ['neon-signs'], { ...eye, tx: sg.x, ty: sg.y, tz: sg.z }, sidePts);
    expect(side.every((v) => v !== null)).toBe(true);
    expect(Math.max(...side.map((v) => v!))).toBeLessThanOrEqual(0.05);
  });

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

test.describe('night-city - qualidade baixa', () => {
  // C27 (AC 23)
  test('low quality keeps the night city', async ({ page }) => {
    await open(page, '?quality=low');
    const r = await page.evaluate(() => {
      const g = (window as any).__game;
      return {
        lamps: g.world.lamps,
        sky: g.world.sky,
        light: g.world.lampLight,
        signs: g.world.signs.map((s: any) => s.depth),
        reflector: g.scene.reflector,
      };
    });
    expect(r.lamps).toHaveLength(1);
    expect(r.sky.inScene).toBe(true);
    for (const [name, uuid] of Object.entries(r.light.materials)) expect(uuid, name).toBe(r.light.uuid);
    for (const d of r.signs) expect(d).toBeCloseTo(0.12, 6);
    expect(r.reflector.present).toBe(false);
  });
});
