import { expect, test, type Page } from '@playwright/test';
import { advanceSim, gotoGame, waitFrames } from './helpers';

/**
 * block-life-extras: estacionados, vapor, gatos, holofotes e trem no browser,
 * lendo `__game.world.extras` (C14, C17, C18, C21, C22, C26, C31, C32, C35, C37).
 */

type Extras = {
  parking: { count: number; meshName: string; instanceCount: number; placeholder: boolean };
  steam: { name: string; points: number; uTime: number; perVent: number };
  cats: { name: string; vertices: number; active: number; cap: number };
  searchlights: { name: string; count: number; additive: boolean; headings: number[]; list: Array<{ x: number; y: number; z: number; period: number }> };
  train: { lineMesh: string; lineInstanced: boolean; name: string; count: number; windowEmissive: number; length: number; frames: number; s: number[] } | null;
};

/** cópia dos campos (os getters são lidos no browser) */
function extras(page: Page): Promise<Extras> {
  return page.evaluate(() => {
    const e = (window as any).__game.world.extras;
    return {
      parking: { count: e.parking.count, meshName: e.parking.meshName, instanceCount: e.parking.instanceCount, placeholder: e.parking.placeholder },
      steam: { name: e.steam.name, points: e.steam.points, uTime: e.steam.uTime, perVent: e.steam.perVent },
      cats: { name: e.cats.name, vertices: e.cats.vertices, active: e.cats.active, cap: e.cats.cap },
      searchlights: { name: e.searchlights.name, count: e.searchlights.count, additive: e.searchlights.additive, headings: e.searchlights.headings, list: e.searchlights.list },
      train: e.train ? { ...e.train, s: e.train.s } : null,
    };
  });
}

const hexChannels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test.describe('block-life-extras - extras do miolo e trem', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGame(page);
    await waitFrames(page, 20);
  });

  // C14 (AC 14)
  test('parked cars are one instanced mesh with their paints', async ({ page }) => {
    const e = await extras(page);
    expect(e.parking.meshName).toBe('parked-cars');
    expect(e.parking.placeholder).toBe(false);
    expect(e.parking.instanceCount).toBe(e.parking.count);
    // o número de vagas do seed 1337, contado no browser com os módulos puros
    const expected = await page.evaluate(async () => {
      const T = await import('/src/world/terrain/TerrainGenerator.ts' as string);
      const R = await import('/src/world/roads/RoadGenerator.ts' as string);
      const C = await import('/src/world/terrain/carveRoads.ts' as string);
      const L = await import('/src/world/lots/LotGenerator.ts' as string);
      const B = await import('/src/world/interiors/BlockInteriors.ts' as string);
      const P = await import('/src/world/interiors/InteriorProps.ts' as string);
      const raw = T.generateTerrain(1337);
      const network = R.generateRoads(1337, raw);
      const carved = C.carveRoads(raw, network);
      const { lots } = L.generateLots(1337, network, carved);
      const props = P.placeInteriorProps(1337, B.findBlockInteriors(carved, network, lots), lots, carved);
      return props.parking.length as number;
    });
    expect(e.parking.count).toBe(expected);
    const list = (await page.evaluate(() => (window as any).__game.world.extras.parking.list())) as Array<{ paint: string }>;
    for (const i of [0, Math.floor(list.length / 2), list.length - 1]) {
      const got = (await page.evaluate((i) => (window as any).__game.world.extras.parking.colorAt(i), i)) as string;
      const a = hexChannels(got);
      const b = hexChannels(list[i]!.paint);
      for (let c = 0; c < 3; c++) expect(Math.abs(a[c]! - b[c]!), `car ${i} channel ${c}`).toBeLessThanOrEqual(1);
    }
  });

  // C17 (AC 16, 17)
  test('steam is one points cloud driven by the sim clock', async ({ page }) => {
    const e = await extras(page);
    const vents = (await page.evaluate(() => (window as any).__game.world.extras.steam.vents().length)) as number;
    expect(e.steam.name).toBe('steam');
    expect(e.steam.perVent).toBe(24);
    expect(e.steam.points).toBe(24 * vents);
    // o relógio anda em tempo real entre as leituras: uTime e simTime lidos juntos
    const clock = () => page.evaluate(() => ({ u: (window as any).__game.world.extras.steam.uTime as number, t: (window as any).__game.simTime as number }));
    const a = await clock();
    await advanceSim(page, 1);
    const b = await clock();
    expect(b.t - a.t).toBeGreaterThanOrEqual(1);
    expect(Math.abs(b.u - a.u - (b.t - a.t))).toBeLessThanOrEqual(0.05);
  });

  // C18 (AC 18)
  test('steam brightens the air above the vent', async ({ page }) => {
    // a grade mais perto do carro; o carro para a 10 m dela, apontado para ela
    const target = await page.evaluate(() => {
      const g = (window as any).__game;
      const vents = g.world.extras.steam.vents() as Array<{ x: number; y: number; z: number }>;
      const c = g.car.position;
      let best = 0;
      for (let i = 1; i < vents.length; i++) {
        if (Math.hypot(vents[i]!.x - c.x, vents[i]!.z - c.z) < Math.hypot(vents[best]!.x - c.x, vents[best]!.z - c.z)) best = i;
      }
      const v = vents[best]!;
      const h = Math.atan2(v.x - c.x, v.z - c.z);
      return { i: best, x: v.x - Math.sin(h) * 10, y: v.y + 1.2, z: v.z - Math.cos(h) * 10, h };
    });
    await page.evaluate((t) => (window as any).__game.car.teleport(t.x, t.y, t.z, t.h), target);
    // a câmera de perseguição alcança o carro teleportado só ao longo dos quadros
    await advanceSim(page, 2, { realtime: true });
    const r = (await page.evaluate((i) => (window as any).__game.world.extras.steamProbe(i), target.i)) as { over: number; aside: number; onScreen: boolean };
    expect(r.onScreen).toBe(true);
    expect(r.over - r.aside).toBeGreaterThanOrEqual(0.01);
  });

  // C21 (AC 20, 21)
  test('four additive searchlight cones turn with the sim clock', async ({ page }) => {
    const e = await extras(page);
    expect(e.searchlights.name).toBe('searchlights');
    expect(e.searchlights.count).toBe(4);
    expect(e.searchlights.additive).toBe(true);
    // headings e simTime lidos juntos (o relógio anda em tempo real entre as leituras)
    const clock = () =>
      page.evaluate(() => {
        const g = (window as any).__game;
        return { h: g.world.extras.searchlights.headings as number[], t: g.simTime as number };
      });
    const a = await clock();
    await advanceSim(page, 2);
    const b = await clock();
    expect(b.t - a.t).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 4; i++) {
      const turned = b.h[i]! - a.h[i]!;
      const expected = (2 * Math.PI * (b.t - a.t)) / e.searchlights.list[i]!.period;
      expect(Math.abs(Math.atan2(Math.sin(turned - expected), Math.cos(turned - expected))), `light ${i}`).toBeLessThanOrEqual(0.01);
    }
  });

  // C22 (AC 22)
  test('a searchlight beam is brighter than the sky', async ({ page }) => {
    await advanceSim(page, 0.5);
    // o facho clareia o próprio ponto: com os fachos escondidos o mesmo ponto lê pelo menos 0.02 a menos
    let seen = 0;
    for (let i = 0; i < 4; i++) {
      const r = (await page.evaluate((i) => (window as any).__game.world.extras.beamProbe(i), i)) as { beam: number; sky: number; without: number } | null;
      if (!r) continue;
      seen++;
      expect(r.beam - r.without, `light ${i}`).toBeGreaterThanOrEqual(0.02);
    }
    expect(seen).toBeGreaterThanOrEqual(1);
  });

  // C26 (AC 23, 26)
  test('cats are one instanced mesh near the car', { tag: '@smoke' }, async ({ page }) => {
    const e = await extras(page);
    expect(e.cats.name).toBe('cats');
    expect(e.cats.vertices).toBeLessThanOrEqual(120);
    expect(e.cats.cap).toBe(60);
    // ponto de gato de quintal mais perto do spawn; o carro para atrás da casa
    const target = await page.evaluate(() => {
      const g = (window as any).__game;
      const spawns = g.world.extras.cats.spawns() as Array<{ x: number; z: number; yard: number | null }>;
      const c = g.car.position;
      let best = -1;
      for (let i = 0; i < spawns.length; i++) {
        if (spawns[i]!.yard === null) continue;
        if (best < 0 || Math.hypot(spawns[i]!.x - c.x, spawns[i]!.z - c.z) < Math.hypot(spawns[best]!.x - c.x, spawns[best]!.z - c.z)) best = i;
      }
      const s = spawns[best]!;
      const road = g.world.nearestRoad(s.x, s.z);
      return { x: road.x, y: road.y + 1.2, z: road.z };
    });
    await page.evaluate((t) => (window as any).__game.car.teleport(t.x, t.y, t.z, 0), target);
    await advanceSim(page, 1);
    expect((await extras(page)).cats.active).toBeGreaterThanOrEqual(1);
  });

  // C31 (AC 31)
  test('the train advances 36 m in 2 s', async ({ page }) => {
    // s do vagão 0 e simTime lidos juntos (o relógio anda em tempo real entre as leituras)
    const clock = () =>
      page.evaluate(() => {
        const g = (window as any).__game;
        return { s: g.world.extras.train.s[0] as number, t: g.simTime as number, L: g.world.extras.train.length as number };
      });
    const a = await clock();
    await advanceSim(page, 2);
    const b = await clock();
    expect(b.t - a.t).toBeGreaterThanOrEqual(2);
    const moved = (((b.s - a.s) % a.L) + a.L) % a.L;
    // 18 m/s: 36 m em 2 s de simulação, ± 1 m
    expect(Math.abs(moved - 18 * (b.t - a.t))).toBeLessThanOrEqual(1);
  });

  // C32 (AC 32)
  test('the viaduct is one mesh and the wagons one instanced mesh', async ({ page }) => {
    const e = await extras(page);
    expect(e.train!.lineMesh).toBe('train-line');
    expect(e.train!.lineInstanced).toBe(false);
    expect(e.train!.name).toBe('train');
    expect(e.train!.count).toBe(3);
    expect(e.train!.windowEmissive).toBeGreaterThanOrEqual(2);
  });

  // C35 (AC 35)
  test('the street mirror skips every extra', async ({ page }) => {
    const names = (await page.evaluate(() => (window as any).__game.render.reflectorSkipped)) as string[];
    for (const n of ['parked-cars', 'steam', 'cats', 'searchlights', 'train-line', 'train']) expect(names, n).toContain(n);
  });
});

test.describe('block-life-extras - qualidade low', () => {
  // C37 (AC 37)
  test('low quality halves cats and steam and keeps the rest', { tag: '@smoke' }, async ({ page }) => {
    await gotoGame(page, '?quality=low');
    const e = await extras(page);
    const vents = (await page.evaluate(() => (window as any).__game.world.extras.steam.vents().length)) as number;
    const parking = (await page.evaluate(() => (window as any).__game.world.extras.parking.list().length)) as number;
    expect(e.cats.cap).toBe(30);
    expect(e.steam.perVent).toBe(12);
    expect(e.steam.points).toBe(12 * vents);
    expect(e.train!.count).toBe(3);
    expect(e.parking.count).toBe(parking);
    expect(e.searchlights.count).toBe(4);
  });
});
