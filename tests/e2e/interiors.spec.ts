import { expect, test, type Page } from '@playwright/test';
import { advanceSim, gotoGame, simTime, speedKmh, waitSimUntil } from './helpers';

/**
 * block-fill: o miolo das quadras no browser, lendo `__game.world.interiors`.
 * As funções puras são importadas do servidor Vite dentro do `page.evaluate`,
 * então o esperado é calculado pelo mesmo código que o teste unitário prova.
 */

/** Vértice interior do centro, perto do spawn, a 4-8 m do prédio e com os 8 vizinhos no miolo (C11, C14). */
async function downtownProbeVertex(page: Page): Promise<{ ix: number; iz: number; x: number; z: number; zone: number; facadeDist: number }> {
  return page.evaluate(() => {
    const g = (window as any).__game;
    const it = g.world.interiors;
    const pos = g.car.position;
    const cx = Math.round((pos.x - it.origin) / it.spacing);
    const cz = Math.round((pos.z - it.origin) / it.spacing);
    for (let r = 0; r < 200; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const ix = cx + dx;
          const iz = cz + dz;
          const c = it.cell(ix, iz);
          if (c.zoneOf < 0 || it.zones[c.zoneOf].kind !== 'downtown') continue;
          if (c.facadeDist < 4 || c.facadeDist > 8) continue;
          let ok = true;
          for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1 && ok; b++) if (it.cell(ix + a, iz + b).zoneOf !== c.zoneOf) ok = false;
          if (!ok) continue;
          return { ix, iz, x: it.origin + ix * it.spacing, z: it.origin + iz * it.spacing, zone: c.zoneOf, facadeDist: c.facadeDist };
        }
      }
    }
    throw new Error('no downtown interior vertex near the spawn');
  });
}

/**
 * Conta o miolo do seed 1337 no próprio browser, com os módulos puros servidos
 * pelo Vite (terreno, estradas, lotes, `findBlockInteriors`, `placeInteriorProps`),
 * sem ler nada do `Game`.
 */
async function seedCounts(page: Page): Promise<{ zones: number; downtown: number; outer: number; yards: number; pools: number; trees: number; sites: number }> {
  return page.evaluate(async () => {
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
    const bi = B.findBlockInteriors(carved, network, lots);
    const props = P.placeInteriorProps(1337, bi, lots, carved);
    return {
      zones: bi.zones.length,
      downtown: bi.zones.filter((z: any) => z.kind === 'downtown').length,
      outer: bi.zones.filter((z: any) => z.kind === 'outer').length,
      yards: props.yards.length,
      pools: props.pools.length,
      trees: props.trees.length,
      sites: props.sites.length,
    };
  });
}

test.describe('block-fill - chão', () => {
  // C9 (AC 7, AC 8)
  test('ground uses the new terrain color', async ({ page }) => {
    await gotoGame(page);
    const r = await page.evaluate(async () => {
      const m = await import('/src/world/interiors/interiorMotion.ts' as string);
      const g = (window as any).__game;
      const w = g.world;
      const it = w.interiors;
      const seed = g.city.seed;
      const pos = g.car.position;
      const cells = 128;
      const ix0 = Math.floor((pos.x + 1536) / 512) * cells;
      const iz0 = Math.floor((pos.z + 1536) / 512) * cells;
      const at = (ix: number, iz: number) => w.heightAt(it.origin + ix * it.spacing, it.origin + iz * it.spacing);
      const expected = (ix: number, iz: number) => {
        const c = it.cell(ix, iz);
        const kind = c.zoneOf >= 0 ? it.zones[c.zoneOf].kind : 'none';
        const dx = (at(ix + 1, iz) - at(ix - 1, iz)) / (2 * it.spacing);
        const dz = (at(ix, iz + 1) - at(ix, iz - 1)) / (2 * it.spacing);
        const x = it.origin + ix * it.spacing;
        const z = it.origin + iz * it.spacing;
        return { kind, slope: Math.hypot(dx, dz), color: m.terrainColor(at(ix, iz), Math.hypot(dx, dz), m.terrainNoise(seed, x, z), kind) };
      };
      let patio: any = null;
      let outside: any = null;
      for (let iz = iz0 + 1; iz < iz0 + cells && !(patio && outside); iz++) {
        for (let ix = ix0 + 1; ix < ix0 + cells && !(patio && outside); ix++) {
          const e = expected(ix, iz);
          if (!patio && e.kind === 'downtown') patio = { ix, iz, expected: e.color, actual: it.terrainVertex(ix, iz).color };
          if (!outside && e.kind === 'none' && e.slope < 0.05) outside = { ix, iz, expected: e.color, actual: it.terrainVertex(ix, iz).color };
        }
      }
      return { patio, outside };
    });
    expect(r.patio).not.toBeNull();
    expect(r.outside).not.toBeNull();
    for (const v of [r.patio, r.outside]) {
      for (let i = 0; i < 3; i++) expect(Math.abs(v.actual[i] - v.expected[i]), `(${v.ix}, ${v.iz}) channel ${i}`).toBeLessThanOrEqual(1 / 255);
    }
  });

  // C10 (AC 9) - parte browser
  test('ground bounce weight per vertex', async ({ page }) => {
    await gotoGame(page);
    const r = await page.evaluate(async () => {
      const m = await import('/src/world/interiors/interiorMotion.ts' as string);
      const g = (window as any).__game;
      const it = g.world.interiors;
      const pos = g.car.position;
      const cells = 128;
      const ix0 = Math.floor((pos.x + 1536) / 512) * cells;
      const iz0 = Math.floor((pos.z + 1536) / 512) * cells;
      let s = 99;
      const rand = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
      const out: Array<{ actual: number; expected: number; zone: number }> = [];
      let interior = 0;
      let tries = 0;
      // 50 sorteados no chunk do spawn, 25 deles no miolo
      while (out.length < 50 && tries++ < 100000) {
        const ix = ix0 + Math.floor(rand() * cells);
        const iz = iz0 + Math.floor(rand() * cells);
        const c = it.cell(ix, iz);
        if (c.zoneOf >= 0 ? interior >= 25 : out.length - interior >= 25) continue;
        if (c.zoneOf >= 0) interior++;
        out.push({ actual: it.terrainVertex(ix, iz).bounce, expected: m.bounceWeight(c.zoneOf, c.facadeDist), zone: c.zoneOf });
      }
      return out;
    });
    expect(r.length).toBe(50);
    expect(r.filter((v) => v.zone >= 0 && v.expected > 0).length).toBeGreaterThan(0);
    for (const v of r) expect(Math.abs(v.actual - v.expected)).toBeLessThanOrEqual(1e-4);
  });

  // C11 (AC 10)
  test('ground bounce lights the block interior', async ({ page }) => {
    await gotoGame(page);
    const v = await downtownProbeVertex(page);
    const lum = await page.evaluate(({ x, z }) => {
      const it = (window as any).__game.world.interiors;
      return { on: it.groundProbe(x, z, { bounce: true }), off: it.groundProbe(x, z, { bounce: false }) };
    }, v);
    console.log(`C11 vertex (${v.x}, ${v.z}) facadeDist ${v.facadeDist.toFixed(2)} on ${lum.on.toFixed(4)} off ${lum.off.toFixed(4)}`);
    expect(v.facadeDist).toBeLessThanOrEqual(8);
    expect(lum.on).toBeGreaterThanOrEqual(2 * lum.off);
    expect(lum.on).toBeLessThanOrEqual(0.35);
  });

  // C12 (AC 11)
  test('ground far from buildings is unchanged', async ({ page }) => {
    await gotoGame(page);
    // vértice do miolo com facadeDist no teto (60 > 40), o mais perto do spawn, com os 8 vizinhos no miolo
    const v = await page.evaluate(() => {
      const g = (window as any).__game;
      const it = g.world.interiors;
      const pos = g.car.position;
      const cx = Math.round((pos.x - it.origin) / it.spacing);
      const cz = Math.round((pos.z - it.origin) / it.spacing);
      for (let r = 0; r < 400; r++) {
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const ix = cx + dx;
            const iz = cz + dz;
            const c = it.cell(ix, iz);
            if (c.zoneOf < 0 || c.facadeDist <= 40) continue;
            let ok = true;
            for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1 && ok; b++) if (it.cell(ix + a, iz + b).zoneOf !== c.zoneOf) ok = false;
            if (ok) return { ix, iz, x: it.origin + ix * it.spacing, z: it.origin + iz * it.spacing, facadeDist: c.facadeDist };
          }
        }
      }
      throw new Error('no far interior vertex');
    });
    expect(v.facadeDist).toBeGreaterThan(40);
    // o chunk do ponto precisa estar carregado: o carro vai para lá
    await page.evaluate(({ x, z }) => {
      const w = (window as any).__game.world;
      (window as any).__game.car.teleport(x, w.heightAt(x, z) + 1.2, z, 0);
    }, v);
    await advanceSim(page, 2);
    const lum = await page.evaluate(({ ix, iz, x, z }) => {
      const it = (window as any).__game.world.interiors;
      return { loaded: it.terrainVertex(ix, iz) !== null, on: it.groundProbe(x, z, { bounce: true }), off: it.groundProbe(x, z, { bounce: false }) };
    }, v);
    console.log(`C12 vertex (${v.x}, ${v.z}) on ${lum.on.toFixed(4)} off ${lum.off.toFixed(4)}`);
    expect(lum.loaded).toBe(true);
    expect(lum.off).toBeGreaterThan(0);
    expect(Math.abs(lum.on - lum.off)).toBeLessThanOrEqual(0.05 * lum.off);
  });

  // C14 (AC 13) - parte browser
  test('ground light changes over time', async ({ page }) => {
    // 60 s simulados no SwiftShader levam minutos de relógio
    test.setTimeout(600_000);
    await gotoGame(page);
    const v = await downtownProbeVertex(page);
    // o browser acompanha o nível que o shader recebe a cada quadro, de t0 até t0 + 60 s
    const r = await page.evaluate(
      (zone) =>
        new Promise<{ first: number; last: number; changed: boolean; t0: number; t1: number }>((resolve) => {
          const g = (window as any).__game;
          const it = g.world.interiors;
          const t0 = g.simTime;
          const first = it.zoneLevel(zone);
          let changed = false;
          const tick = () => {
            const level = it.zoneLevel(zone);
            if (level !== first) changed = true;
            if (g.simTime >= t0 + 60) resolve({ first, last: level, changed, t0, t1: g.simTime });
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      v.zone,
    );
    expect(r.t1 - r.t0).toBeGreaterThanOrEqual(60);
    expect(r.changed || r.last !== r.first).toBe(true);
  });
});

test.describe('block-fill - quintais', () => {
  // C16 (AC 15) - parte browser
  test('yards are built', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoGame(page);
    const expected = await seedCounts(page);
    const r = await page.evaluate(() => {
      const it = (window as any).__game.world.interiors;
      return { summary: it.summary(), materials: it.materials };
    });
    expect(expected.yards).toBeGreaterThan(0);
    expect(r.summary.yards).toBe(expected.yards);
    expect(r.materials.yardLampEmissive).toBeGreaterThan(0);
    expect(r.materials.bulbEmissive).toBeGreaterThan(0);
  });

  // C17 (AC 16) - parte browser
  test('yard bulbs sway', async ({ page }) => {
    await gotoGame(page);
    const count = await page.evaluate(() => (window as any).__game.world.interiors.bulbCount as number);
    expect(count).toBeGreaterThan(0);
    const read = () => page.evaluate(() => (window as any).__game.world.interiors.bulbPosition(0) as { x: number; y: number; z: number });
    const a = await read();
    await advanceSim(page, 0.5);
    const b = await read();
    expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeGreaterThan(0);
  });

  // C19 (AC 18)
  test('pool water is animated', async ({ page }) => {
    await gotoGame(page);
    const read = () => page.evaluate(() => (window as any).__game.world.interiors.materials.pool);
    const a = await read();
    await advanceSim(page, 1);
    const b = await read();
    expect(a.hasNormalMap).toBe(true);
    expect(a.offset[0] !== b.offset[0] || a.offset[1] !== b.offset[1]).toBe(true);
    const [r, g, bl] = a.emissive;
    expect(bl).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(r);
    expect(a.emissiveIntensity).toBeGreaterThan(0);
  });
});

test.describe('block-fill - árvores', () => {
  // C22 (AC 21) - parte browser
  test('tree crowns sway and trunks stay', async ({ page }) => {
    await gotoGame(page);
    const read = () =>
      page.evaluate(() => {
        const it = (window as any).__game.world.interiors;
        return { time: it.crownTime as number, matrices: it.treeMatrices(50) as number[][] };
      });
    const a = await read();
    await advanceSim(page, 0.2);
    const b = await read();
    expect(a.matrices.length).toBeGreaterThan(0);
    expect(b.time).toBeGreaterThan(a.time);
    expect(b.matrices).toEqual(a.matrices);
  });

  // C24 (AC 22)
  test('car stops at a tree trunk', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoGame(page);
    // árvore com 15 m de chão do miolo livre e quase plano à frente, sem outra árvore no caminho
    const s = await page.evaluate(() => {
      const w = (window as any).__game.world;
      const it = w.interiors;
      const zoneAt = (x: number, z: number) => it.cell(Math.round((x - it.origin) / it.spacing), Math.round((z - it.origin) / it.spacing)).zoneOf;
      const trees = it.trees as Array<{ x: number; y: number; z: number }>;
      for (const t of trees) {
        for (let k = 0; k < 16; k++) {
          const h = (k * Math.PI) / 8;
          // o carro sai de 15 m e anda na direção h até a árvore
          const sx = t.x - Math.sin(h) * 15;
          const sz = t.z - Math.cos(h) * 15;
          let ok = true;
          let lo = Infinity;
          let hi = -Infinity;
          for (let d = -4; d <= 15 && ok; d += 0.5) {
            const x = sx + Math.sin(h) * d;
            const z = sz + Math.cos(h) * d;
            for (const side of [-1.5, 0, 1.5]) {
              if (zoneAt(x + Math.cos(h) * side, z - Math.sin(h) * side) < 0) ok = false;
            }
            const y = w.heightAt(x, z);
            lo = Math.min(lo, y);
            hi = Math.max(hi, y);
          }
          if (!ok || hi - lo > 0.6) continue;
          const blocked = trees.some((o) => o !== t && Math.hypot(o.x - (sx + t.x) / 2, o.z - (sz + t.z) / 2) < 12);
          if (blocked) continue;
          return { tree: t, x: sx, z: sz, y: w.heightAt(sx, sz), heading: h };
        }
      }
      throw new Error('no clear tree approach');
    });
    await page.evaluate((s) => {
      const car = (window as any).__game.car;
      car.teleport(s.x, s.y + 1.2, s.z, s.heading);
      car.setForwardSpeed(40 / 3.6);
    }, s);
    await page.keyboard.down('KeyW');
    const near = `Math.hypot(g.car.position.x - ${s.tree.x}, g.car.position.z - ${s.tree.z}) <= 3`;
    const touched = await waitSimUntil(page, near, 5);
    expect(touched, 'car reached the trunk').toBe(true);
    const stopped = await waitSimUntil(page, 'g.car.speedKmh < 5', 1);
    const kmh = await speedKmh(page);
    await page.keyboard.up('KeyW');
    expect(stopped, `speed ${kmh.toFixed(1)} km/h`).toBe(true);
  });

  // C25 (AC 23) - parte browser
  test('fireflies within budget', async ({ page }) => {
    await gotoGame(page);
    const high = await page.evaluate(() => (window as any).__game.world.interiors.summary().fireflies as number);
    expect(high).toBeGreaterThan(0);
    expect(high).toBeLessThanOrEqual(600);
    await page.goto('/?quality=low');
    await page.waitForFunction(() => (window as any).__game?.ready === true, null, { timeout: 30_000 });
    const low = await page.evaluate(() => (window as any).__game.world.interiors.summary().fireflies as number);
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThanOrEqual(300);
  });
});

test.describe('block-fill - obras', () => {
  // C27 (AC 25) - parte browser
  test('construction crane turns', async ({ page }) => {
    await gotoGame(page);
    const sites = await page.evaluate(() => (window as any).__game.world.interiors.summary().sites as number);
    expect(sites).toBeGreaterThanOrEqual(1);
    const yaw = () => page.evaluate(() => (window as any).__game.world.interiors.jibYaw(0) as number);
    const a = await yaw();
    await advanceSim(page, 1);
    const b = await yaw();
    expect(Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)))).toBeGreaterThan(0);
  });

  // C28 (AC 26) - parte browser
  test('crane beacon blinks', async ({ page }) => {
    await gotoGame(page);
    const seen = { on: 0, off: 0 };
    const start = await simTime(page);
    while ((seen.on === 0 || seen.off === 0) && (await simTime(page)) < start + 10) {
      const r = await page.evaluate(async () => {
        const m = await import('/src/world/interiors/interiorMotion.ts' as string);
        const b = (window as any).__game.world.interiors.beacon;
        return { intensity: b.intensity as number, on: m.beaconOn(b.time) as boolean };
      });
      if (r.on) {
        expect(r.intensity).toBeGreaterThan(0);
        seen.on++;
      } else {
        expect(r.intensity).toBe(0);
        seen.off++;
      }
    }
    expect(seen.on).toBeGreaterThan(0);
    expect(seen.off).toBeGreaterThan(0);
  });

  // C29 (AC 27) - parte browser
  test('construction floodlight lights the ground', async ({ page }) => {
    await gotoGame(page);
    await advanceSim(page, 1);
    const r = await page.evaluate(() => (window as any).__game.world.interiors.beamProbe(0));
    console.log(`C29 beam ${r.beam.toFixed(4)} outside ${r.outside.toFixed(4)}`);
    expect(r.outside).toBeGreaterThan(0);
    expect(r.beam).toBeGreaterThan(1.5 * r.outside);
  });
});

test.describe('block-fill - pedestres', () => {
  // C31 (AC 29) - parte browser
  test('walkers near the car', async ({ page }) => {
    await gotoGame(page);
    await advanceSim(page, 2);
    const r = await page.evaluate(() => {
      const g = (window as any).__game;
      const it = g.world.interiors;
      return { car: g.car.position, walkers: it.walkers() as Array<{ x: number; z: number }>, active: it.summary().walkersActive as number };
    });
    expect(r.active).toBeGreaterThan(0);
    expect(r.active).toBeLessThanOrEqual(400);
    expect(r.walkers.length).toBe(r.active);
    for (const w of r.walkers) expect(Math.hypot(w.x - r.car.x, w.z - r.car.z)).toBeLessThanOrEqual(300);
  });

  // C34 (AC 32) - parte browser
  test('walkers step away from the car', async ({ page }) => {
    await gotoGame(page);
    await advanceSim(page, 1);
    // pedestre ativo com 15 m de chão da zona atrás dele, do lado oposto ao carro
    const pick = await page.evaluate(() => {
      const g = (window as any).__game;
      const w = g.world;
      const it = w.interiors;
      const zoneAt = (x: number, z: number) => it.cell(Math.round((x - it.origin) / it.spacing), Math.round((z - it.origin) / it.spacing)).zoneOf;
      const walkers = it.walkers() as Array<{ x: number; z: number; zoneId: number; fleeing: boolean }>;
      for (let i = 0; i < walkers.length; i++) {
        const p = walkers[i]!;
        if (p.fleeing) continue;
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          const dx = Math.sin(a);
          const dz = Math.cos(a);
          let ok = true;
          for (let d = 0; d <= 20 && ok; d += 1) if (zoneAt(p.x - dx * d, p.z - dz * d) !== p.zoneId) ok = false;
          if (!ok) continue;
          const cx = p.x + dx * 5;
          const cz = p.z + dz * 5;
          return { i, walker: p, car: { x: cx, y: w.heightAt(cx, cz) + 1.2, z: cz, heading: a } };
        }
      }
      throw new Error('no walker with room to step away');
    });
    await page.evaluate(({ car }) => (window as any).__game.car.teleport(car.x, car.y, car.z, car.heading), pick);
    const before = await page.evaluate(() => {
      const g = (window as any).__game;
      return { car: g.car.position, walkers: g.world.interiors.walkers() };
    });
    // o mesmo pedestre: o mais perto da posição lida antes do teleporte
    const nearest = (list: Array<{ x: number; z: number }>, x: number, z: number) =>
      list.reduce((a, b) => (Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a));
    const w0 = nearest(before.walkers, pick.walker.x, pick.walker.z);
    const d0 = Math.hypot(w0.x - before.car.x, w0.z - before.car.z);
    expect(d0).toBeLessThanOrEqual(5.5);
    let last = { x: w0.x, z: w0.z };
    const start = await simTime(page);
    // segue o pedestre de 0.25 s em 0.25 s (anda no máximo 0.75 m por leitura)
    while ((await simTime(page)) < start + 4) {
      await advanceSim(page, 0.25);
      const list = await page.evaluate(() => (window as any).__game.world.interiors.walkers());
      last = nearest(list, last.x, last.z);
    }
    const car = await page.evaluate(() => (window as any).__game.car.position);
    const dist = Math.hypot(last.x - car.x, last.z - car.z);
    console.log(`C34 start ${d0.toFixed(2)} m, after 4 s ${dist.toFixed(2)} m`);
    expect(dist).toBeGreaterThanOrEqual(12);
  });

  // C35 (AC 33)
  test('walkers have no colliders', async ({ page }) => {
    await gotoGame(page);
    await advanceSim(page, 1);
    const read = () =>
      page.evaluate(() => {
        const it = (window as any).__game.world.interiors;
        return { c: it.colliders(), s: it.summary(), roads: (window as any).__game.world.roads.length, lots: (window as any).__game.world.lots.length };
      });
    const a = await read();
    expect(a.s.walkersActive).toBeGreaterThan(0);
    // terreno, estradas, guarda-corpos, pilares, prédios, paredes, troncos, torres (+ o carro)
    expect(a.c.roads).toBe(a.roads);
    expect(a.c.lots).toBe(a.lots);
    expect(a.c.walls).toBe(4);
    expect(a.c.trees).toBe(a.s.trees);
    expect(a.c.cranes).toBe(a.s.sites);
    const expected = a.c.terrain + a.c.roads + a.c.rails + a.c.pillars + a.c.lots + a.c.walls + a.c.trees + a.c.cranes + a.c.car;
    expect(a.c.total).toBe(expected);
    await advanceSim(page, 5);
    const b = await read();
    expect(b.s.walkersActive).toBeGreaterThan(0);
    expect(b.c.total).toBe(a.c.total);
  });
});

test.describe('block-fill - montagem', () => {
  // C37 (doors 1 e 2, startup config)
  test('game builds the interiors from the world seed', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoGame(page);
    const expected = await seedCounts(page);
    const summary = await page.evaluate(() => (window as any).__game.world.interiors.summary());
    expect(expected.zones).toBeGreaterThan(0);
    for (const key of ['zones', 'downtown', 'outer', 'yards', 'pools', 'trees', 'sites'] as const) {
      expect(summary[key], key).toBe(expected[key]);
    }
  });
});
