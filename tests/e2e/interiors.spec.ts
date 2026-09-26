import { expect, test, type Page } from '@playwright/test';
import { advanceSim, gotoGame, simTime } from './helpers';

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
        const ix = ix0 + Math.floor(rand() * (cells + 1));
        const iz = iz0 + Math.floor(rand() * (cells + 1));
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
    test.setTimeout(300_000);
    await gotoGame(page);
    const v = await downtownProbeVertex(page);
    const t0 = await simTime(page);
    const levels: number[] = [];
    let t = t0;
    while (t < t0 + 60.5) {
      levels.push(await page.evaluate((id) => (window as any).__game.world.interiors.zoneLevel(id) as number, v.zone));
      await advanceSim(page, 0.5);
      t = await simTime(page);
    }
    levels.push(await page.evaluate((id) => (window as any).__game.world.interiors.zoneLevel(id) as number, v.zone));
    expect(levels.length).toBeGreaterThan(10);
    expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(0);
  });
});
