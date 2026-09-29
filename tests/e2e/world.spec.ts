import { expect, test, type Page } from '@playwright/test';
import { advanceSim, gotoGame, holdKeySim, position, simTime } from './helpers';

type Pt = { x: number; z: number };

/** Pontos candidatos livres: fora de estrada (width/2 + 8), fora de prédio (4 m) e em terra ou água sem ponte por cima. */
async function freePoints(page: Page, candidates: Pt[]): Promise<Pt[]> {
  return page.evaluate((cands) => {
    const w = (window as any).__game.world;
    const lots = w.lots as Array<{ x: number; z: number; width: number; depth: number; rotation: number }>;
    const lotDist = (l: (typeof lots)[number], x: number, z: number) => {
      const dx = x - l.x;
      const dz = z - l.z;
      const u = dx * Math.sin(l.rotation) + dz * Math.cos(l.rotation);
      const v = dx * Math.cos(l.rotation) - dz * Math.sin(l.rotation);
      return Math.hypot(Math.max(0, Math.abs(u) - l.width / 2), Math.max(0, Math.abs(v) - l.depth / 2));
    };
    return cands.filter((p) => {
      const near = w.nearestRoad(p.x, p.z);
      if (near.distance < near.width / 2 + 8) return false;
      return lots.every((l) => lotDist(l, p.x, p.z) > 4);
    });
  }, candidates);
}

const angleDiff = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

test.describe('city-terrain - mundo', () => {
  // C7 (AC 7, door 4)
  test('car rests on the terrain heightfield', async ({ page }) => {
    await gotoGame(page);
    // pico, encosta a 60 %, margem do rio 10 m acima da água, centro entre prédios, 1400 m ao norte
    const grid = await page.evaluate(() => {
      const w = (window as any).__game.world;
      const out: Array<{ x: number; z: number; h: number }> = [];
      for (let z = -1472; z <= 1472; z += 32) for (let x = -1472; x <= 1472; x += 32) out.push({ x, z, h: w.heightAt(x, z) });
      return out;
    });
    const free = new Set((await freePoints(page, grid)).map((p) => `${p.x},${p.z}`));
    const ok = grid.filter((p) => free.has(`${p.x},${p.z}`));
    const peak = ok.reduce((a, b) => (b.h > a.h ? b : a));
    const slope = ok.reduce((a, b) => (Math.abs(b.h - 0.6 * peak.h) < Math.abs(a.h - 0.6 * peak.h) ? b : a));
    const riverX = await page.evaluate((zs) => zs.map((z) => (window as any).__game.world.riverCenterX(z)), ok.map((p) => p.z));
    const bank = ok
      .filter((p, i) => Math.abs(p.x - riverX[i]!) < 150)
      .reduce((a, b) => (Math.abs(b.h - 8) < Math.abs(a.h - 8) ? b : a));
    const downtown = ok.find((p) => Math.abs(p.x) < 400 && Math.abs(p.z) < 400)!;
    const north = ok.find((p) => Math.abs(p.z + 1400) <= 16)!;
    const points = { peak, slope, bank, downtown, north };
    expect(Math.abs(bank.h - 8)).toBeLessThan(2);
    for (const [name, p] of Object.entries(points)) {
      await page.evaluate(({ x, z, h }) => (window as any).__game.car.teleport(x, h + 3, z, 0), p);
      let min = Infinity;
      const start = await simTime(page);
      while ((await simTime(page)) < start + 2) {
        await advanceSim(page, 0.1);
        min = Math.min(min, (await position(page)).y);
      }
      const end = await position(page);
      expect(min, `${name} dipped below the terrain`).toBeGreaterThanOrEqual(p.h - 1.2);
      expect(Math.abs(end.y - p.h), `${name} rest height`).toBeLessThanOrEqual(1.2);
    }
  });

  // C8 (AC 7, door 4)
  test('heightfield orientation matches the heightmap', async ({ page }) => {
    await gotoGame(page);
    // perto de cada canto, pontos com x ≠ z, mais 4 no interior; fora dos vértices da grade:
    // um raio exatamente vertical sobre um vértice do heightfield atravessa o Parry (caso de borda)
    const cands: Pt[] = [];
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        for (const [a, b] of [[1400, 1312], [1312, 1400], [1200, 1452], [1452, 1152], [1376, 1248], [1248, 1376], [1100, 1420], [1420, 1100]]) {
          cands.push({ x: sx * a! + 1.3, z: sz * b! + 0.7 });
        }
      }
    }
    const interior: Pt[] = [{ x: 301.3, z: -699.3 }, { x: -650.7, z: 421.3 }, { x: 821.3, z: -250.7 }, { x: -898.7, z: -1098.7 }, { x: 1001.3, z: 621.3 }, { x: -1198.7, z: 301.3 }];
    const freeCorners = await freePoints(page, cands);
    const picked: Pt[] = [];
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        const mine = freeCorners.filter((p) => Math.sign(p.x) === sx && Math.sign(p.z) === sz).slice(0, 4);
        expect(mine.length, `corner ${sx},${sz}`).toBe(4);
        picked.push(...mine);
      }
    }
    picked.push(...(await freePoints(page, interior)).slice(0, 4));
    expect(picked.length).toBe(20);
    const hits = await page.evaluate(
      (pts) => pts.map((p) => ({ ...p, h: (window as any).__game.world.heightAt(p.x, p.z), ray: (window as any).__game.world.raycastDown(p.x, p.z) })),
      picked,
    );
    for (const p of hits) {
      expect(p.x).not.toBe(p.z);
      expect(p.ray, `(${p.x}, ${p.z})`).not.toBeNull();
      expect(Math.abs(p.ray - p.h), `(${p.x}, ${p.z}) ray ${p.ray} vs ${p.h}`).toBeLessThanOrEqual(0.05);
    }
    // 10 pontos de eixo de estrada fora de ponte: o trimesh está entre y e y + 0.1
    const roadHits = await page.evaluate(() => {
      const w = (window as any).__game.world;
      const out: Array<{ y: number; ray: number | null }> = [];
      for (const r of w.roads) {
        for (let i = 40; i < r.count && out.length < 10; i += 377) {
          if (r.bridges.some((b: any) => i >= b.from - 20 && i <= b.to + 20)) continue;
          const p = w.roadPoint(r.id, i);
          out.push({ y: p.y, ray: w.raycastDown(p.x, p.z) });
        }
      }
      return out;
    });
    expect(roadHits.length).toBe(10);
    for (const h of roadHits) {
      expect(h.ray).not.toBeNull();
      expect(h.ray!).toBeGreaterThanOrEqual(h.y);
      expect(h.ray!).toBeLessThanOrEqual(h.y + 0.1);
    }
  });

  // C10 (AC 8, door 9)
  test('falling in the water respawns on the nearest road', { tag: '@smoke' }, async ({ page }) => {
    await gotoGame(page);
    const before = await page.evaluate(() => (window as any).__game.world.waterResets as number);
    // um z onde o rio passa longe de qualquer estrada
    const spot = await page.evaluate(() => {
      const w = (window as any).__game.world;
      for (let z = -700; z <= -400; z += 10) {
        const x = w.riverCenterX(z);
        if (w.nearestRoad(x, z).distance > 60) return { x, z };
      }
      return null;
    });
    expect(spot).not.toBeNull();
    await page.evaluate(({ x, z }) => {
      const g = (window as any).__game;
      g.car.teleport(x, -1.6, z, 0);
      g.car.setForwardSpeed(10);
    }, spot!);
    await advanceSim(page, 0.5);
    const r = await page.evaluate(() => ({ count: (window as any).__game.world.waterResets, last: (window as any).__game.world.lastWaterReset }));
    expect(r.count).toBe(before + 1);
    const { position: p, rotation: q, linvel: v, target: t } = r.last;
    expect(Math.hypot(p.x - t.x, p.y - (t.y + 1), p.z - t.z)).toBeLessThan(0.1);
    expect(Math.hypot(v.x, v.y, v.z)).toBeLessThan(0.1);
    // vetor para cima do chassi: y = 1 − 2(x² + z²)
    expect(1 - 2 * (q.x * q.x + q.z * q.z)).toBeGreaterThan(0.99);
    const carHeading = 2 * Math.atan2(q.y, q.w);
    expect(Math.abs(angleDiff(carHeading, t.heading))).toBeLessThan((5 * Math.PI) / 180);
    // o alvo é mesmo o ponto de estrada mais próximo da queda
    const nearest = await page.evaluate(({ x, z }) => (window as any).__game.world.nearestRoad(x, z), spot!);
    expect(Math.hypot(nearest.x - t.x, nearest.z - t.z)).toBeLessThan(15);
  });

  // C11 (AC 9, door 8)
  test('animated water plane at -2', async ({ page }) => {
    await gotoGame(page);
    const a = await page.evaluate(() => ({ water: (window as any).__game.world.water, frames: (window as any).__game.frames }));
    expect(a.water.y).toBe(-2);
    expect(a.water.size).toEqual([3072, 3072]);
    expect(a.water.roughness).toBeCloseTo(0.08, 6);
    expect(a.water.metalness).toBeCloseTo(0.2, 6);
    expect(a.water.hasNormalMap).toBe(true);
    expect(a.water.hasEnvMap).toBe(true);
    await page.waitForFunction((f) => (window as any).__game.frames > f + 1, a.frames);
    const b = await page.evaluate(() => (window as any).__game.world.water.offset);
    expect(b).not.toEqual(a.water.offset);
  });

  // C22 (AC 18)
  test('road materials use the asphalt set', async ({ page }) => {
    await gotoGame(page);
    const m = await page.evaluate(() => (window as any).__game.materials);
    expect(m.road.hasMap && m.road.hasNormalMap && m.road.hasRoughnessMap).toBe(true);
    expect(m.road.transparent).toBe(true);
    expect(m.road.opacity).toBeCloseTo(0.65, 6);
    expect(m.road.mapSrc).toContain('/textures/Asphalt012/');
    expect(m.roadOuter.hasMap && m.roadOuter.hasNormalMap && m.roadOuter.hasRoughnessMap).toBe(true);
    expect(m.roadOuter.mapSrc).toContain('/textures/Asphalt012/');
    expect(m.roadOuter.transparent).toBe(false);
  });

  // C23 (AC 18)
  test('lane marks drawn in the road shader', async ({ page }) => {
    await gotoGame(page);
    // uma avenida do centro, longe dos cruzamentos (|x| entre 100 e 250 numa avenida ao longo de x)
    const target = await page.evaluate(() => {
      const w = (window as any).__game.world;
      for (const r of w.roads.filter((x: any) => x.kind === 'avenue')) {
        for (let i = 0; i < r.count; i++) {
          const p = w.roadPoint(r.id, i);
          const q = w.roadPoint(r.id, Math.min(r.count - 1, i + 1));
          if (Math.abs(q.x - p.x) < 1.5) break; // avenida ao longo de z
          if (p.x > 150 && p.x < 200 && Math.abs(p.z) < 400) return { roadId: r.id, index: i };
        }
      }
      return null;
    });
    expect(target).not.toBeNull();
    // o chunk do ponto precisa estar carregado
    await page.waitForFunction(() => (window as any).__game.world.chunks.loaded.length >= 4);
    const r = await page.evaluate(({ roadId, index }) => (window as any).__game.render.probeRoadMarks(roadId, index), target!);
    expect(r.dash).toBeGreaterThanOrEqual(1.5 * r.gap);
    expect(r.edge).toBeGreaterThanOrEqual(1.5 * r.lane);
    expect(r.spacing.length).toBeGreaterThanOrEqual(2);
    for (const s of r.spacing) expect(Math.abs(s - 6)).toBeLessThanOrEqual(0.25);
  });

  // C25 (AC 19), substituído por night-city C7 (AC 1, AC 5): haste, braço e luminária numa malha só
  test('lamp posts are one instanced mesh', { tag: '@smoke' }, async ({ page }) => {
    await gotoGame(page);
    const l = await page.evaluate(() => ({ meshes: (window as any).__game.world.lamps, count: (window as any).__game.world.lampCount }));
    expect(l.meshes.length).toBe(1);
    expect(l.meshes[0].instanced).toBe(true);
    expect(l.meshes[0].count).toBe(l.count);
    expect(l.meshes[0].width).toBeGreaterThanOrEqual(1.6);
    expect(l.count).toBeGreaterThan(0);
  });

  // C28 (AC 22)
  test('car crosses the highway bridge on the deck', async ({ page }) => {
    await gotoGame(page);
    const setup = await page.evaluate(() => {
      const w = (window as any).__game.world;
      const ring = w.roads[0];
      const pts: number[] = w.roadPoints(0);
      const b = ring.bridges.find((br: any) => {
        for (let i = br.from; i <= br.to; i++) if (Math.abs(pts[i * 3]! - w.riverCenterX(pts[i * 3 + 2]!)) < 20) return true;
        return false;
      });
      return { from: b.from, to: b.to, pts, n: ring.count };
    });
    const { from, to, pts, n } = setup;
    const P = (i: number) => ({ x: pts[i * 3]!, y: pts[i * 3 + 1]!, z: pts[i * 3 + 2]! });
    const headingAt = (i: number) => Math.atan2(P((i + 1) % n).x - P(i).x, P((i + 1) % n).z - P(i).z);
    const nearestIdx = (x: number, z: number) => {
      let best = Infinity;
      let bi = 0;
      for (let i = Math.max(0, from - 60); i <= Math.min(n - 1, to + 60); i++) {
        const d = Math.hypot(P(i).x - x, P(i).z - z);
        if (d < best) {
          best = d;
          bi = i;
        }
      }
      return bi;
    };
    const s = P(from);
    await page.evaluate(({ x, y, z, h }) => {
      const g = (window as any).__game;
      g.car.teleport(x, y + 1.2, z, h);
      g.car.setForwardSpeed(15);
    }, { ...s, h: headingAt(from) });
    await page.keyboard.down('KeyW');
    const start = await simTime(page);
    const limit = ((to - from) * 2) / 15 + 4;
    let reached = false;
    let held: string | null = null;
    while ((await simTime(page)) < start + limit) {
      await advanceSim(page, 0.1);
      const st = await page.evaluate(() => ({ p: (window as any).__game.car.position, h: (window as any).__game.car.heading }));
      const i = nearestIdx(st.p.x, st.p.z);
      if (i >= from && i <= to) expect(st.p.y, `index ${i}`).toBeGreaterThanOrEqual(P(i).y - 1.2);
      if (i >= to) {
        reached = true;
        break;
      }
      // o motorista do teste segue a estrada: vira para o heading da estrada (A = esquerda = heading maior)
      const left = { x: Math.cos(headingAt(i)), z: -Math.sin(headingAt(i)) };
      const lateral = (st.p.x - P(i).x) * left.x + (st.p.z - P(i).z) * left.z;
      const err = angleDiff(headingAt(i), st.h) - lateral * 0.05;
      const want = err > 0.03 ? 'KeyA' : err < -0.03 ? 'KeyD' : null;
      if (want !== held) {
        if (held) await page.keyboard.up(held);
        if (want) await page.keyboard.down(want);
        held = want;
      }
    }
    if (held) await page.keyboard.up(held);
    await page.keyboard.up('KeyW');
    expect(reached).toBe(true);
  });

  // C29 (AC 23)
  test('guard rail keeps the car on the deck', async ({ page }) => {
    await gotoGame(page);
    const s = await page.evaluate(() => {
      const w = (window as any).__game.world;
      const ring = w.roads[0];
      const pts: number[] = w.roadPoints(0);
      const b = ring.bridges.find((br: any) => {
        for (let i = br.from; i <= br.to; i++) if (Math.abs(pts[i * 3]! - w.riverCenterX(pts[i * 3 + 2]!)) < 20) return true;
        return false;
      });
      const i = Math.floor((b.from + b.to) / 2);
      const p = w.roadPoint(0, i);
      const q = w.roadPoint(0, i + 1);
      return { p, h: Math.atan2(q.x - p.x, q.z - p.z), width: ring.width };
    });
    await page.evaluate(({ p, h }) => (window as any).__game.car.teleport(p.x, p.y + 1.2, p.z, h + Math.PI / 2), s);
    await holdKeySim(page, 'KeyW', 3);
    const end = await position(page);
    const left = { x: Math.cos(s.h), z: -Math.sin(s.h) };
    const lateral = Math.abs((end.x - s.p.x) * left.x + (end.z - s.p.z) * left.z);
    expect(lateral).toBeLessThanOrEqual(s.width / 2);
    expect(end.y).toBeGreaterThanOrEqual(s.p.y - 1.2);
  });

  // C35 (AC 29)
  test('buildings are four instanced facade meshes', async ({ page }) => {
    await gotoGame(page);
    const r = await page.evaluate(() => ({
      meshes: (window as any).__game.city.facadeMeshes.map((m: any) => m.count),
      lots: (window as any).__game.world.lots.length,
    }));
    expect(r.meshes.length).toBe(4);
    expect(r.meshes.reduce((a: number, b: number) => a + b, 0)).toBe(r.lots);
    for (const c of r.meshes) expect(c).toBeGreaterThan(0);

    // C33 (AC 27): a instância de cada prédio começa na base `y` do lote e sobe `height`
    // (instância i da malha do tipo T = i-ésimo lote com `facadeType` T, conferido pelo centro x, z)
    const spans = await page.evaluate(() => ({
      spans: (window as any).__game.city.facadeSpans() as number[][][],
      lots: (window as any).__game.world.lots as Array<{ x: number; y: number; z: number; height: number; facadeType: number }>,
    }));
    let checked = 0;
    spans.spans.forEach((mesh, type) => {
      const lots = spans.lots.filter((l) => l.facadeType === type);
      expect(mesh.length, `facade ${type}`).toBe(lots.length);
      mesh.forEach(([lo, hi, x, z], i) => {
        const l = lots[i]!;
        const where = `facade ${type} instance ${i} at ${l.x.toFixed(1)},${l.z.toFixed(1)}`;
        expect(Math.hypot(x! - l.x, z! - l.z), where).toBeLessThan(0.01);
        expect(Math.abs(lo! - l.y), `${where} base`).toBeLessThanOrEqual(0.01);
        expect(Math.abs(hi! - (l.y + l.height)), `${where} top`).toBeLessThanOrEqual(0.01);
        checked++;
      });
    });
    expect(checked).toBe(r.lots);
  });

  // C37 (AC 30, door 7)
  test('chunks stream around the car', async ({ page }) => {
    await gotoGame(page);
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.car.teleport(0, g.world.heightAt(0, -1300) + 1.5, -1300, 0);
    });
    await advanceSim(page, 3);
    const r = await page.evaluate(() => ({ chunks: (window as any).__game.world.chunks, p: (window as any).__game.car.position }));
    const dist = (id: number) =>
      Math.hypot(-1536 + 256 + (id % 6) * 512 - r.p.x, -1536 + 256 + Math.floor(id / 6) * 512 - r.p.z);
    // todo chunk a ≤ 900 m carregado; nenhum carregado a > 1200 m (entre os dois, a histerese da door 7 decide)
    for (let id = 0; id < 36; id++) if (dist(id) <= 900) expect(r.chunks.loaded, `chunk ${id}`).toContain(id);
    for (const id of r.chunks.loaded) expect(dist(id), `chunk ${id}`).toBeLessThanOrEqual(1200);
    expect(r.chunks.maxBuildsInOneFrame).toBe(1);
    // door 7: o teleporte deixa chunks do spawn a > 1200 m; cada um saiu de `loaded` com todas as geometrias descartadas
    const dropped = r.chunks.dropped as Array<{ id: number; geometries: number; disposed: number }>;
    expect(dropped.length).toBeGreaterThan(0);
    for (const d of dropped) {
      expect(dist(d.id), `dropped chunk ${d.id}`).toBeGreaterThan(1200);
      expect(r.chunks.loaded, `dropped chunk ${d.id}`).not.toContain(d.id);
      expect(d.geometries, `dropped chunk ${d.id}`).toBeGreaterThan(0);
      expect(d.disposed, `dropped chunk ${d.id} geometries disposed`).toBe(d.geometries);
    }
  });

  // C40 (AC 33)
  test('spawn on a downtown avenue', async ({ page }) => {
    await gotoGame(page);
    await advanceSim(page, 1);
    const r = await page.evaluate(() => {
      const g = (window as any).__game;
      const p = g.car.position;
      return { speed: Math.abs(g.car.speedKmh) / 3.6, near: g.world.nearestRoad(p.x, p.z), heading: g.car.heading, p };
    });
    expect(r.speed).toBeLessThan(0.5);
    expect(r.near.kind).toBe('avenue');
    expect(Math.abs(r.p.x) <= 500 && Math.abs(r.p.z) <= 500).toBe(true);
    expect(r.near.distance).toBeLessThanOrEqual(r.near.width / 2);
    let d = angleDiff(r.heading, r.near.heading) % Math.PI;
    if (d > Math.PI / 2) d -= Math.PI;
    if (d < -Math.PI / 2) d += Math.PI;
    expect(Math.abs(d)).toBeLessThan((5 * Math.PI) / 180);
  });
});
