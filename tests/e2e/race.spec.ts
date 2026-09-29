import { expect, test, type Page } from '@playwright/test';
import { formatRaceTime } from '../../src/race/raceProgress';
import { advanceSim, gotoGame, holdKeySim, position, speedKmh, waitSimUntil } from './helpers';

// races: provas no browser (checks C9-C14, C16-C19, C21, C24, C25, C27-C32, C34, C36)

type Pose = { x: number; y: number; z: number; heading: number };

/** pose parada a `back` m antes do marcador da corrida `id`, ao longo do heading do grid, na altura da estrada */
async function nearMarker(page: Page, id: string, back = 0, side = 0): Promise<Pose> {
  return page.evaluate(
    ([id, back, side]) => {
      const g = (window as any).__game;
      const r = g.race.races.find((x: any) => x.id === id);
      const h = r.grid[3].heading;
      const x = r.marker.x - Math.sin(h) * back + Math.cos(h) * side;
      const z = r.marker.z - Math.cos(h) * back - Math.sin(h) * side;
      const road = g.world.nearestRoad(x, z);
      return { x, y: road.y + 1.2, z, heading: h };
    },
    [id, back, side] as const,
  );
}

async function place(page: Page, p: Pose): Promise<void> {
  await page.evaluate((p) => (window as any).__game.car.teleport(p.x, p.y, p.z, p.heading), p);
  await advanceSim(page, 0.1);
}

const race = (page: Page) => page.evaluate(() => (window as any).__game.race);
const state = (page: Page) => page.evaluate(() => (window as any).__game.race.state as string);
const counts = (page: Page) =>
  page.evaluate(() => ({ bodies: (window as any).__game.race.bodies as number, cars: (window as any).__game.race.carsInScene as number }));
const shown = (page: Page, sel: string) =>
  page.evaluate((sel) => getComputedStyle(document.querySelector(sel)!).display !== 'none', sel);

/** para no marcador da corrida e aperta Enter; `racing` espera o GO */
async function startRace(page: Page, id: string, racing = true): Promise<void> {
  await place(page, await nearMarker(page, id, 3));
  await page.keyboard.press('Enter');
  expect(await state(page)).toBe('countdown');
  if (racing) expect(await waitSimUntil(page, "g.race.state === 'racing'", 5)).toBe(true);
}

/** cor do pixel (x, y) do canvas do minimapa */
function minimapPixel(page: Page, x: number, y: number): Promise<number[]> {
  return page.evaluate(
    ([x, y]) => {
      const c = document.querySelector<HTMLCanvasElement>('#minimap')!;
      return [...c.getContext('2d')!.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3);
    },
    [x, y] as const,
  );
}

function hex(c: string): number[] {
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
}

function close(a: number[], b: number[], tol = 12): boolean {
  return a.every((v, i) => Math.abs(v - b[i]!) <= tol);
}

test.describe('races', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGame(page);
  });

  // C9 (AC 7)
  test('markers visible in free roam and on the minimap', async ({ page }) => {
    const r = await race(page);
    expect(r.markers).toHaveLength(4);
    for (const [i, m] of r.markers.entries()) {
      expect(m.visible).toBe(true);
      expect(m.radius).toBe(10);
      expect({ x: m.x, z: m.z }).toEqual({ x: r.races[i].marker.x, z: r.races[i].marker.z });
    }
    // a 50 m do marcador do circuito do centro, o ícone aparece no minimapa na cor dele
    const pose = await nearMarker(page, 'circuito-centro', 50);
    await place(page, pose);
    const px = await page.evaluate(() => {
      const g = (window as any).__game;
      const m = g.race.races.find((x: any) => x.id === 'circuito-centro').marker;
      const c = g.car.position;
      return { x: 80 + (m.x - c.x) * 0.5, y: 80 + (m.z - c.z) * 0.5 };
    });
    expect(close(await minimapPixel(page, px.x, px.y), hex('#35e0ff'))).toBe(true);
  });

  // C10 (AC 8)
  test('prompt appears at the marker', { tag: '@smoke' }, async ({ page }) => {
    await place(page, await nearMarker(page, 'circuito-centro', 5));
    expect(await shown(page, '#race-prompt')).toBe(true);
    expect(await page.textContent('#race-prompt')).toBe('ENTER · Circuito Centro');
    await place(page, await nearMarker(page, 'circuito-centro', 15));
    expect(await shown(page, '#race-prompt')).toBe(false);
  });

  // C11 (AC 9)
  test('enter at the marker starts the countdown on the grid', async ({ page }) => {
    const before = await counts(page);
    await startRace(page, 'circuito-centro', false);
    await advanceSim(page, 0.2);
    const r = await race(page);
    const grid = r.races.find((x: any) => x.id === 'circuito-centro').grid;
    const p = await position(page);
    expect(Math.hypot(p.x - grid[3].x, p.z - grid[3].z)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(await speedKmh(page))).toBeLessThan(1);
    expect(r.opponents).toHaveLength(3);
    for (const o of r.opponents) {
      expect(Math.hypot(o.position.x - grid[o.index].x, o.position.z - grid[o.index].z), `opponent ${o.index}`).toBeLessThanOrEqual(0.5);
    }
    expect((await counts(page)).bodies).toBe(before.bodies + 3);
  });

  // C12 (AC 10)
  test('enter away from markers does nothing', async ({ page }) => {
    const before = await counts(page);
    const p0 = await position(page);
    await page.keyboard.press('Enter');
    await advanceSim(page, 0.3);
    expect(await state(page)).toBe('free');
    expect((await counts(page)).bodies).toBe(before.bodies);
    const p1 = await position(page);
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeLessThanOrEqual(0.5);
  });

  // C13 (AC 11)
  test('countdown holds every car', async ({ page }) => {
    await startRace(page, 'circuito-centro', false);
    await page.waitForFunction(() => document.querySelector('#race-countdown')!.textContent !== '');
    expect(await page.textContent('#race-countdown')).toBe('3');
    await page.keyboard.down('KeyW');
    let maxKmh = 0;
    for (;;) {
      const s = await page.evaluate(() => {
        const g = (window as any).__game;
        return {
          state: g.race.state as string,
          speeds: [Math.abs(g.car.speedKmh), ...g.race.opponents.map((o: any) => Math.abs(o.speedKmh))] as number[],
        };
      });
      if (s.state !== 'countdown') break;
      maxKmh = Math.max(maxKmh, ...s.speeds);
    }
    await page.keyboard.up('KeyW');
    expect(maxKmh).toBeLessThan(1);
    expect(await state(page)).toBe('racing');
  });

  // C14 (AC 12)
  test('only the next gate is shown', async ({ page }) => {
    await startRace(page, 'circuito-centro');
    await advanceSim(page, 0.1);
    const r = await race(page);
    expect(r.visibleGates).toBe(1);
    const next = r.races.find((x: any) => x.id === 'circuito-centro').gates[r.player.nextGate];
    expect(Math.hypot(r.gate.x - next.x, r.gate.z - next.z)).toBeLessThanOrEqual(0.5);
    expect(r.gate.height).toBe(4);
  });

  // C16, C17, C19 (AC 14, 15, 17)
  test('hud shows time lap and position', async ({ page }) => {
    await startRace(page, 'circuito-centro');
    await advanceSim(page, 1.5);
    const s = await page.evaluate(() => {
      const g = (window as any).__game;
      return {
        time: g.race.time as number,
        pos: g.race.player.position as number,
        timeText: document.querySelector('#race-time')!.textContent,
        lapText: document.querySelector('#race-lap')!.textContent,
        posText: document.querySelector('#race-pos')!.textContent,
      };
    });
    expect(s.time).toBeGreaterThan(0);
    expect(s.timeText).toBe(formatRaceTime(s.time));
    expect(s.lapText).toBe('VOLTA 1/2');
    expect(s.posText).toBe(`POS ${s.pos}/4`);
    expect(s.pos).toBeGreaterThanOrEqual(1);
    expect(s.pos).toBeLessThanOrEqual(4);
  });

  // C18, C27 (AC 16, 25)
  test('finishing a sprint shows the results', async ({ page }) => {
    await startRace(page, 'sprint-cruzada');
    const n = await page.evaluate(() => (window as any).__game.race.races.find((x: any) => x.id === 'sprint-cruzada').gates.length as number);
    for (let k = 0; k < n; k++) {
      await page.evaluate(() => (window as any).__game.race.crossNextGate());
      await advanceSim(page, 0.05);
    }
    expect(await waitSimUntil(page, "g.race.state === 'finished'", 1)).toBe(true);
    await advanceSim(page, 0.1);
    expect(await shown(page, '#race-results')).toBe(true);
    const rows = await page.$$eval('#race-results .race-row', (els) => els.map((e) => [...e.children].map((c) => c.textContent)));
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r[0])).toEqual(['1', '2', '3', '4']);
    const me = rows.find((r) => r[1] === 'VOCÊ');
    expect(me).toBeDefined();
    expect(me![2]).toMatch(/^\d+:\d\d\.\d\d$/);
    for (const r of rows) expect(r[2]).toMatch(/^(\d+:\d\d\.\d\d|--:--\.--)$/);
  });

  // C21 (AC 19)
  test('opponents wear their own paint', async ({ page }) => {
    await startRace(page, 'circuito-centro', false);
    const ops = (await race(page)).opponents as Array<{ paint: string; bodyColor: string }>;
    expect(ops).toHaveLength(3);
    for (const o of ops) expect(o.bodyColor).toBe(o.paint.toLowerCase());
    expect(new Set(ops.map((o) => o.paint)).size).toBe(3);
    expect(ops.map((o) => o.paint.toLowerCase())).not.toContain('#ff4d1a');
  });

  // C24 (AC 22)
  test('opponents on the minimap', async ({ page }) => {
    await startRace(page, 'circuito-centro');
    // cada oponente a 40-60 m do jogador, em lados diferentes
    await page.evaluate(() => {
      const g = (window as any).__game;
      const c = g.car.position;
      const spots = [
        [45, 0],
        [-45, 0],
        [0, 55],
      ];
      spots.forEach(([dx, dz], i) => g.race.placeOpponent(i, c.x + dx, c.y + 30, c.z + dz, 0));
    });
    await advanceSim(page, 0.05);
    const marks = await page.evaluate(() => {
      const g = (window as any).__game;
      const c = g.car.position;
      return g.race.opponents.map((o: any) => ({ x: 80 + (o.position.x - c.x) * 0.5, y: 80 + (o.position.z - c.z) * 0.5, paint: o.paint }));
    });
    for (const m of marks) expect(close(await minimapPixel(page, m.x, m.y), hex(m.paint)), m.paint).toBe(true);
  });

  // C25, C31 (AC 23, 29)
  test('abort with escape returns to free roam', async ({ page }) => {
    const before = await counts(page);
    for (const racing of [false, true]) {
      await startRace(page, 'circuito-centro', racing);
      await page.keyboard.press('Escape');
      await advanceSim(page, 0.1);
      expect(await state(page)).toBe('free');
      expect(await shown(page, '#race-panel')).toBe(false);
      expect(await shown(page, '#race-results')).toBe(false);
      expect(await counts(page)).toEqual(before);
    }
  });

  // C25, C28 (AC 23, 26)
  test('enter on the results returns to free roam', async ({ page }) => {
    const before = await counts(page);
    await startRace(page, 'sprint-cruzada');
    const n = await page.evaluate(() => (window as any).__game.race.races.find((x: any) => x.id === 'sprint-cruzada').gates.length as number);
    for (let k = 0; k < n; k++) {
      await page.evaluate(() => (window as any).__game.race.crossNextGate());
      await advanceSim(page, 0.05);
    }
    expect(await waitSimUntil(page, "g.race.state === 'finished'", 1)).toBe(true);
    await advanceSim(page, 0.5);
    const p0 = await position(page);
    await page.keyboard.press('Enter');
    await advanceSim(page, 0.1);
    expect(await state(page)).toBe('free');
    const p1 = await position(page);
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeLessThanOrEqual(0.5);
    expect(await shown(page, '#race-panel')).toBe(false);
    expect(await shown(page, '#race-results')).toBe(false);
    expect(await counts(page)).toEqual(before);
  });

  // C29 (AC 27)
  test('r returns to the last gate during a race', async ({ page }) => {
    await startRace(page, 'circuito-centro');
    const r0 = await race(page);
    const def = r0.races.find((x: any) => x.id === 'circuito-centro');
    await page.keyboard.press('KeyR');
    await advanceSim(page, 0.05);
    let p = await position(page);
    expect(Math.hypot(p.x - def.grid[3].x, p.z - def.grid[3].z)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(await speedKmh(page))).toBeLessThan(1);
    await page.evaluate(() => (window as any).__game.race.crossNextGate());
    await advanceSim(page, 0.05);
    const t0 = (await race(page)).time as number;
    await page.evaluate(() => {
      const g = (window as any).__game;
      const c = g.car.position;
      g.car.teleport(c.x + 30, c.y + 2, c.z, 0);
    });
    await advanceSim(page, 0.1);
    await page.keyboard.press('KeyR');
    await advanceSim(page, 0.05);
    p = await position(page);
    const gate = def.gates[0];
    expect(Math.hypot(p.x - gate.x, p.z - gate.z)).toBeLessThanOrEqual(0.5);
    const h = await page.evaluate(() => (window as any).__game.car.heading as number);
    expect(Math.abs(Math.atan2(Math.sin(h - gate.heading), Math.cos(h - gate.heading)))).toBeLessThanOrEqual((5 * Math.PI) / 180);
    expect((await race(page)).time).toBeGreaterThanOrEqual(t0);
  });

  // C30 (AC 28)
  test('water during a race returns to the last gate', async ({ page }) => {
    await startRace(page, 'circuito-centro');
    await page.evaluate(() => (window as any).__game.race.crossNextGate());
    await advanceSim(page, 0.05);
    const before = await page.evaluate(() => (window as any).__game.world.waterResets as number);
    const gate = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.race.races.find((x: any) => x.id === 'circuito-centro').gates[0];
    });
    await page.evaluate((g) => (window as any).__game.car.teleport(g.x + 30, -5, g.z, 0), gate);
    await advanceSim(page, 0.1);
    const p = await position(page);
    expect(Math.hypot(p.x - gate.x, p.z - gate.z)).toBeLessThanOrEqual(0.5);
    expect(await page.evaluate(() => (window as any).__game.world.waterResets as number)).toBe(before);
  });

  // C32 (AC 30)
  test('markers hidden during a race', async ({ page }) => {
    await startRace(page, 'circuito-centro', false);
    await advanceSim(page, 0.1);
    let r = await race(page);
    expect(r.markers.every((m: any) => !m.visible)).toBe(true);
    expect(await shown(page, '#race-prompt')).toBe(false);
    expect(await waitSimUntil(page, "g.race.state === 'racing'", 5)).toBe(true);
    await advanceSim(page, 0.1);
    r = await race(page);
    expect(r.markers.every((m: any) => !m.visible)).toBe(true);
    expect(await shown(page, '#race-prompt')).toBe(false);
  });

  // C34 (AC 32)
  test('draw calls within budget while racing', async ({ page }) => {
    await startRace(page, 'circuito-centro');
    await advanceSim(page, 0.2);
    await page.screenshot({ path: 'test-results/race-grid.png' });
    expect(await page.evaluate(() => (window as any).__game.render.calls as number)).toBeLessThanOrEqual(220);
  });

  // C36 (AC 11, 18)
  test('player drives after go', async ({ page }) => {
    await startRace(page, 'circuito-centro');
    await holdKeySim(page, 'KeyW', 2);
    expect(await speedKmh(page)).toBeGreaterThan(20);
  });
});

// block-life-extras: pintura dos oponentes e as provas que faltaram na races
test.describe('block-life-extras - pintura e provas da races', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGame(page);
  });

  /** matiz HSV (graus) de uma cor em [0, 1] */
  const hue = (r: number, g: number, b: number): number => {
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    if (mx === mn) return 0;
    const d = mx - mn;
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    return h;
  };

  // C3 (AC 3)
  test('opponent body reads its paint', async ({ page }) => {
    await startRace(page, 'circuito-centro');
    await advanceSim(page, 0.2);
    const probe = (i: number) => page.evaluate((i) => (window as any).__game.race.bodyProbe(i), i);
    const me = await probe(-1);
    expect(me.onScreen).toBe(true);
    const ops = [await probe(0), await probe(1), await probe(2)];
    for (const [i, o] of ops.entries()) {
      expect(o.onScreen, `oponente ${i}`).toBe(true);
      expect(o.luminance, `oponente ${i}`).toBeGreaterThanOrEqual(0.6 * me.luminance);
    }
    // oponente 0 é azul #2f8cff (matiz 213°)
    const h = hue(ops[0]!.r, ops[0]!.g, ops[0]!.b);
    expect(Math.abs(h - 210)).toBeLessThanOrEqual(30);
  });

  // C4 (AC 4)
  test('opponent material is white and body color is the paint', { tag: '@smoke' }, async ({ page }) => {
    await startRace(page, 'circuito-centro', false);
    const ops = (await race(page)).opponents as Array<{ index: number; paint: string; bodyColor: string; materialColor: string }>;
    expect(ops).toHaveLength(3);
    for (const o of ops) {
      expect(o.bodyColor).toBe(o.paint.toLowerCase());
      expect(o.materialColor).toBe('#ffffff');
    }
  });

  // C6 (AC 6, races AC 27)
  test('reset during countdown returns to the grid slot', async ({ page }) => {
    await startRace(page, 'circuito-centro', false);
    const slot = await page.evaluate(() => {
      const g = (window as any).__game;
      return { ...g.race.races.find((x: any) => x.id === 'circuito-centro').grid[3] };
    });
    // 20 m para trás ao longo do heading do lugar, na altura da estrada
    const away = await page.evaluate((s) => {
      const g = (window as any).__game;
      const x = s.x - Math.sin(s.heading) * 20;
      const z = s.z - Math.cos(s.heading) * 20;
      return { x, y: g.world.nearestRoad(x, z).y + 1.2, z };
    }, slot);
    await place(page, { ...away, heading: slot.heading });
    expect(await state(page)).toBe('countdown');
    await page.keyboard.press('KeyR');
    await advanceSim(page, 0.5);
    const p = await position(page);
    expect(Math.hypot(p.x - slot.x, p.z - slot.z)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(await speedKmh(page))).toBeLessThan(1);
    const h = await page.evaluate(() => (window as any).__game.car.heading as number);
    expect(Math.abs(Math.atan2(Math.sin(h - slot.heading), Math.cos(h - slot.heading)))).toBeLessThanOrEqual((5 * Math.PI) / 180);
    expect((await race(page)).time).toBe(0);
    expect(await state(page)).toBe('countdown');
  });

  // C7 (AC 7, races AC 10)
  test('enter at 100 m from the marker does nothing', async ({ page }) => {
    const pose = await nearMarker(page, 'circuito-centro', 100);
    await place(page, pose);
    const markers = (await race(page)).markers as Array<{ x: number; z: number }>;
    const dists = markers.map((m) => Math.hypot(m.x - pose.x, m.z - pose.z)).sort((a, b) => a - b);
    expect(Math.abs(dists[0]! - 100)).toBeLessThanOrEqual(0.5);
    expect(dists[1]!).toBeGreaterThan(100);
    const before = await counts(page);
    const p0 = await position(page);
    await page.keyboard.press('Enter');
    await advanceSim(page, 0.5);
    expect(await state(page)).toBe('free');
    expect((await counts(page)).bodies).toBe(before.bodies);
    const p1 = await position(page);
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeLessThanOrEqual(0.5);
  });
});
