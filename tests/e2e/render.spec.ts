import { expect, test } from '@playwright/test';
import { advanceSim, gotoGame } from './helpers';

test.describe('render', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGame(page);
    await page.waitForTimeout(500);
  });

  // visual-upgrade C8 (supersede free-roam-city C21: reflector + GTAO + pós somam passes)
  // city-terrain C38 (AC 31), supersede visual-upgrade C8: ≤ 220 em 5 lugares do mundo
  test('draw calls at most 220 across the world', async ({ page }) => {
    const places = await page.evaluate(() => {
      const w = (window as any).__game.world;
      const g = (window as any).__game;
      const along = (road: number, i: number) => {
        const p = w.roadPoint(road, i);
        const q = w.roadPoint(road, i + 1);
        return { x: p.x, y: p.y, z: p.z, h: Math.atan2(q.x - p.x, q.z - p.z) };
      };
      const ring = w.roads[0];
      const pts: number[] = w.roadPoints(0);
      const n = ring.count;
      const bridge = ring.bridges.find((b: any) => {
        for (let i = b.from; i <= b.to; i++) if (Math.abs(pts[i * 3]! - w.riverCenterX(pts[i * 3 + 2]!)) < 20) return true;
        return false;
      });
      let south = 0;
      let ne = 0;
      for (let i = 0; i < n; i++) {
        if (pts[i * 3 + 2]! > pts[south * 3 + 2]!) south = i;
        if (pts[i * 3]! - pts[i * 3 + 2]! > pts[ne * 3]! - pts[ne * 3 + 2]!) ne = i;
      }
      let peak = { road: 0, i: 0, y: -Infinity };
      for (const r of w.roads.filter((x: any) => x.kind === 'hill')) {
        const rp: number[] = w.roadPoints(r.id);
        for (let i = 0; i < r.count - 1; i++) if (rp[i * 3 + 1]! > peak.y) peak = { road: r.id, i, y: rp[i * 3 + 1]! };
      }
      const pos = g.car.position;
      return {
        spawn: { x: pos.x, y: pos.y - 1.2, z: pos.z, h: g.car.heading },
        hill: along(peak.road, peak.i),
        bridge: along(0, Math.floor((bridge.from + bridge.to) / 2)),
        bay: along(0, south),
        northeast: along(0, ne),
      };
    });
    for (const [name, p] of Object.entries(places)) {
      await page.evaluate((p) => (window as any).__game.car.teleport(p.x, p.y + 1.2, p.z, p.h), p);
      await advanceSim(page, 3);
      const calls = await page.evaluate(() => (window as any).__game.render.calls as number);
      expect(calls, name).toBeGreaterThan(0);
      expect(calls, name).toBeLessThanOrEqual(220);
    }
  });

  // C22 (AC 17)
  test('neon emissive intensity at least 2', { tag: '@smoke' }, async ({ page }) => {
    const m = await page.evaluate(() => (window as any).__game.materials);
    expect(m.windowEmissiveIntensity).toBeGreaterThanOrEqual(2);
    // visual-upgrade C29: com o flicker ativo os 4 letreiros continuam >= 2.0
    expect(m.lampEmissiveIntensity).toBeGreaterThanOrEqual(2);
    expect(m.signEmissiveIntensities.length).toBe(4);
    for (const v of m.signEmissiveIntensities) expect(v).toBeGreaterThanOrEqual(2);
  });

  // C23 (AC 18)
  test('wet road material and environment map', async ({ page }) => {
    const roughness = await page.evaluate(() => (window as any).__game.materials.roadRoughness as number);
    const hasEnv = await page.evaluate(() => (window as any).__game.scene.hasEnvironment as boolean);
    expect(roughness).toBeLessThanOrEqual(0.25);
    expect(hasEnv).toBe(true);
  });

  // C24 (AC 19)
  test('bloom pass and ACES tone mapping', { tag: '@smoke' }, async ({ page }) => {
    const info = await page.evaluate(() => {
      const g = (window as any).__game;
      return { passes: g.composer.passes, bloomEnabled: g.composer.bloomEnabled, aces: g.toneMappingIsACES };
    });
    expect(info.passes).toContain('UnrealBloomPass');
    expect(info.bloomEnabled).toBe(true);
    expect(info.aces).toBe(true);
  });

  // C43 (AC 11) - consumidor de ChaseCamera
  test('camera sits 6 m behind and 2.5 m above', async ({ page }) => {
    await advanceSim(page, 2);
    const { car, cam } = await page.evaluate(() => {
      const g = (window as any).__game;
      return { car: { ...g.car.position, heading: g.car.heading }, cam: g.camera.position };
    });
    const expected = {
      x: car.x - 6 * Math.sin(car.heading),
      y: car.y + 2.5,
      z: car.z - 6 * Math.cos(car.heading),
    };
    const dist = Math.hypot(cam.x - expected.x, cam.y - expected.y, cam.z - expected.z);
    expect(dist).toBeLessThan(0.1);
  });

  // C45 (doors 2, 3, 5, 6) - literais das portas
  test('landing door literals', async ({ page }) => {
    const info = await page.evaluate(() => {
      const g = (window as any).__game;
      return {
        passes: g.composer.passes,
        bloom: g.composer.bloomParams,
        timestep: g.physics.timestep,
        seed: g.city.seed,
      };
    });
    // visual-upgrade C21 amplia a pilha; a ordem relativa de Render, Bloom e Output continua
    expect(info.passes).toEqual(['RenderPass', 'GTAOPass', 'UnrealBloomPass', 'ShaderPass', 'SMAAPass', 'OutputPass']);
    expect(info.bloom.strength).toBeCloseTo(0.8, 6);
    expect(info.bloom.radius).toBeCloseTo(0.4, 6);
    expect(info.bloom.threshold).toBeCloseTo(0.7, 6);
    // o Rapier guarda o timestep em float32: 1/60 vira 0.01666667 (diferença ~9e-10)
    expect(info.timestep).toBeCloseTo(1 / 60, 6);
    expect(info.seed).toBe(1337);

    await page.keyboard.down('KeyW');
    await advanceSim(page, 0.5);
    const forces = await page.evaluate(() => (window as any).__game.car.wheelEngineForce as number[]);
    await page.keyboard.up('KeyW');
    expect(forces[0]).toBe(0);
    expect(forces[1]).toBe(0);
    expect(forces[2]).toBeGreaterThan(0);
    expect(forces[3]).toBeGreaterThan(0);
  });
});
