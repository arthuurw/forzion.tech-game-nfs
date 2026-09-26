import { expect, test, type Page } from '@playwright/test';
import { advanceSim, buildingScenario, holdKeySim, insideLot, position, teleport } from './helpers';

const SETS = ['Asphalt012', 'PavingStones070', 'Concrete034', 'MetalPlates006', 'Bricks059', 'PaintedPlaster017'];
const KINDS = ['Color', 'NormalGL', 'Roughness'];

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => (window as any).__game?.ready === true, null, { timeout: 30_000 });
}

const g = (page: Page) => page.evaluate(() => (window as any).__game);

test.describe('visual - S2 materiais', () => {
  // C1 (AC 1, door 1)
  test('texture sets are served and loaded', async ({ page }) => {
    for (const set of SETS) {
      for (const kind of KINDS) {
        const res = await page.request.get(`/textures/${set}/${set}_1K-JPG_${kind}.jpg`);
        expect(res.status(), `${set} ${kind}`).toBe(200);
      }
    }
    await open(page);
    const loaded = await page.evaluate(() => (window as any).__game.textures.loaded as string[]);
    expect([...loaded].sort()).toEqual([...SETS].sort());
  });

  // C2 (AC 2)
  test('missing texture set falls back to flat color', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text());
    });
    await page.route('**/textures/Concrete034/**', (route) => route.abort());
    await open(page);
    expect(warnings.some((w) => w.includes('Concrete034'))).toBe(true);
    const t = await page.evaluate(() => (window as any).__game.textures);
    expect(t.failed).toContain('Concrete034');
    expect(await page.evaluate(() => (window as any).__game.ready)).toBe(true);
  });

  // C3 (AC 3)
  test('wet pbr road material', async ({ page }) => {
    await open(page);
    const road = await page.evaluate(() => (window as any).__game.materials.road);
    expect(road.hasMap).toBe(true);
    expect(road.hasNormalMap).toBe(true);
    expect(road.hasRoughnessMap).toBe(true);
    expect(road.roughness).toBeLessThanOrEqual(0.25);
    expect(road.transparent).toBe(true);
    expect(road.opacity).toBeCloseTo(0.65, 6);
    // city-terrain supersede C3: o repeat 111 do plano de 444 m saiu (fitas com 1 tile a cada 4 m, C21/C22)
    // C37: a rua usa o set Asphalt012
    expect(road.mapSrc).toContain('/textures/Asphalt012/');
  });

  // C4 (AC 4, door 3)
  test('reflector present only in high quality', async ({ page }) => {
    await open(page);
    const high = await page.evaluate(() => ({
      r: (window as any).__game.scene.reflector,
      w: window.innerWidth,
      h: window.innerHeight,
    }));
    expect(high.r.present).toBe(true);
    expect(high.r.size).toEqual([Math.floor(high.w * 0.5), Math.floor(high.h * 0.5)]);
    // C39: plano do espelho em y = 0
    expect(high.r.y).toBe(0);
    // city-terrain C43 (AC 36): o espelho cobre só o quadrado do centro
    expect(high.r.planeSize).toEqual([1000, 1000]);
    expect(high.r.position[0]).toBe(0);
    expect(high.r.position[2]).toBe(0);
    expect(high.r.position[1]).toBeGreaterThanOrEqual(0);
    expect(high.r.position[1]).toBeLessThanOrEqual(0.05);
    await open(page, '?quality=low');
    const low = await page.evaluate(() => (window as any).__game.scene.reflector);
    expect(low.present).toBe(false);
  });

  // C6 (AC 6, door 2)
  test('four facade meshes with per-instance repeat', async ({ page }) => {
    await open(page);
    const meshes = await page.evaluate(() => (window as any).__game.city.facadeMeshes);
    expect(meshes.length).toBe(4);
    for (const m of meshes) {
      expect(m.aRepeatItemSize).toBe(2);
      expect(m.aSeedItemSize).toBe(1);
    }
    const first = meshes[0];
    expect(first.firstRepeat[0]).toBeCloseTo(first.firstBuilding.width / 4, 3);
    expect(first.firstRepeat[1]).toBeCloseTo(first.firstBuilding.height / 4, 3);
    // C37: cada tipo usa a textura do seu set
    const expectedSets = ['Concrete034', 'MetalPlates006', 'Bricks059', 'PaintedPlaster017'];
    meshes.forEach((m: any, i: number) => expect(m.mapSrc, `facade ${i}`).toContain(`/textures/${expectedSets[i]}/`));
  });

  // C7 (AC 7)
  test('sidewalk pbr and lane marks', async ({ page }) => {
    await open(page);
    const info = await page.evaluate(() => ({
      sidewalk: (window as any).__game.materials.sidewalk,
    }));
    expect(info.sidewalk.hasMap).toBe(true);
    expect(info.sidewalk.hasNormalMap).toBe(true);
    // C37: a calçada usa o set PavingStones070
    expect(info.sidewalk.mapSrc).toContain('/textures/PavingStones070/');
    // city-terrain supersede C7: as 938 faixas instanciadas viraram faixas no shader da fita (C23)
  });
});

test.describe('visual - S3 movimento', () => {
  // C9 (AC 9, door 4)
  test('rain point count by quality', async ({ page }) => {
    await open(page);
    const high = await page.evaluate(() => (window as any).__game.weather);
    expect(high.rainCount).toBe(4000);
    expect(high.rainObject).toBe('Points');
    await open(page, '?quality=low');
    expect(await page.evaluate(() => (window as any).__game.weather.rainCount)).toBe(1000);
  });

  // C10 (AC 10) - parte browser
  test('rain box follows the car', async ({ page }) => {
    await open(page);
    const t0 = await page.evaluate(() => (window as any).__game.weather.uTime as number);
    await advanceSim(page, 0.3);
    const s = await page.evaluate(() => {
      const g = (window as any).__game;
      return { t: g.weather.uTime as number, c: g.weather.center, p: g.car.position };
    });
    expect(s.t).toBeGreaterThan(t0);
    expect(Math.hypot(s.c.x - s.p.x, s.c.y - s.p.y, s.c.z - s.p.z)).toBeLessThan(1);
  });

  // C11 (AC 11) - parte browser
  test('neon signs flicker', async ({ page }) => {
    await open(page);
    const a = await page.evaluate(() => (window as any).__game.materials.signEmissiveIntensities as number[]);
    await advanceSim(page, 0.5);
    const b = await page.evaluate(() => (window as any).__game.materials.signEmissiveIntensities as number[]);
    expect(a.length).toBe(4);
    for (const v of [...a, ...b]) {
      expect(v).toBeGreaterThanOrEqual(2.0);
      expect(v).toBeLessThanOrEqual(3.2);
    }
    expect(a.some((v, i) => Math.abs(v - b[i]!) > 0.05)).toBe(true);
  });

  // C12 (AC 12)
  test('headlight cones', async ({ page }) => {
    await open(page);
    const cones = await page.evaluate(() => (window as any).__game.effects.headlightCones);
    expect(cones.length).toBe(2);
    for (const c of cones) {
      expect(c.transparent).toBe(true);
      expect(c.opacity).toBeCloseTo(0.12, 6);
      expect(c.additive).toBe(true);
      // C39: o feixe começa no farol e abre para +Z local
      expect(c.minZ).toBeCloseTo(0, 3);
      expect(c.maxZ).toBeGreaterThan(10);
    }
  });

  // C13 + C14 (AC 13, AC 14) - parte browser
  test('handbrake leaves skid marks', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => (window as any).__game.effects.skidCount)).toBe(0);
    await holdKeySim(page, 'KeyW', 2.5);
    await page.keyboard.down('Space');
    await advanceSim(page, 0.5);
    const mid = await page.evaluate(() => (window as any).__game.effects);
    await advanceSim(page, 0.5);
    await page.keyboard.up('Space');
    const fx = await page.evaluate(() => (window as any).__game.effects);
    expect(fx.skidCount).toBeGreaterThan(0);
    expect(fx.skidCount).toBeLessThanOrEqual(400);
    expect(mid.smokeAlive).toBeGreaterThan(0);
    expect(mid.smokeAlive).toBeLessThanOrEqual(256);
  });

  // C36 (AC 13) - um quad por roda traseira por passo
  test('two skid quads per fixed step', async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).__game.car.setForwardSpeed(20));
    await page.keyboard.down('Space');
    await advanceSim(page, 0.1);
    const a = await page.evaluate(() => ({ n: (window as any).__game.effects.skidCount, t: (window as any).__game.simTime }));
    await advanceSim(page, 0.2);
    const b = await page.evaluate(() => ({
      n: (window as any).__game.effects.skidCount,
      t: (window as any).__game.simTime,
      kmh: (window as any).__game.car.speedKmh,
    }));
    await page.keyboard.up('Space');
    expect(b.kmh).toBeGreaterThan(20);
    const steps = Math.round((b.t - a.t) * 60);
    expect(steps).toBeGreaterThan(0);
    expect(b.n - a.n).toBe(2 * steps);
  });

  // C38 - pools do browser com as constantes do módulo
  test('effect pools use the configured limits', async ({ page }) => {
    await open(page);
    const c = await page.evaluate(() => (window as any).__game.effects.config);
    expect(c).toEqual({ smokeCap: 256, smokeLifetime: 0.8, sparkCap: 128, sparkLifetime: 0.4, skidCap: 400 });
  });

  test('tire smoke while skidding', async ({ page }) => {
    await open(page);
    await holdKeySim(page, 'KeyW', 2.5);
    await page.keyboard.down('Space');
    await advanceSim(page, 0.4);
    const alive = await page.evaluate(() => (window as any).__game.effects.smokeAlive as number);
    await page.keyboard.up('Space');
    expect(alive).toBeGreaterThan(0);
    expect(alive).toBeLessThanOrEqual(256);
  });

  // C16 (door 6)
  test('chassis emits contact force events', async ({ page }) => {
    await open(page);
    const ev = await page.evaluate(() => (window as any).__game.car.collisionEvents);
    expect(ev.activeEvents).toBe(ev.contactForceEvents);
    expect(ev.threshold).toBe(2000);
  });

  // C15 + C19 (AC 15, AC 16, AC 19) - mesmo cenário de free-roam-city C9 (city-terrain C44: prédio do centro)
  test('collision throws sparks', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => (window as any).__game.effects.lastCollision)).toBeNull();
    const s = await buildingScenario(page);
    await teleport(page, s.x, s.y, s.z, s.heading);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => (window as any).__game.effects.lastCollision !== null, null, { timeout: 90_000 });
    const hit = await page.evaluate(() => ({
      c: (window as any).__game.effects.lastCollision,
      n: (window as any).__game.effects.sparksSpawned,
      shake: (window as any).__game.camera.shake,
    }));
    await page.keyboard.up('KeyW');
    expect(hit.c.impulse).toBeGreaterThanOrEqual(3000);
    expect(hit.n).toBe(40);
    expect(hit.shake).toBeGreaterThan(0);
    await advanceSim(page, 1);
    expect(await page.evaluate(() => (window as any).__game.camera.shake)).toBeLessThan(0.01);
    // o carro não atravessou o prédio (free-roam-city C9 segue valendo)
    const p = await position(page);
    expect(insideLot(s.lot, p.x, p.z)).toBe(false);
  });
});

test.describe('visual - S4 câmera', () => {
  // C17 (AC 17) - parte browser
  test('camera fov follows speed', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => (window as any).__game.camera.fov)).toBeCloseTo(62, 2);
    await page.keyboard.down('KeyW');
    await advanceSim(page, 3);
    const s = await page.evaluate(() => ({
      fov: (window as any).__game.camera.fov as number,
      kmh: (window as any).__game.car.speedKmh as number,
    }));
    await page.keyboard.up('KeyW');
    const expected = 62 + 16 * Math.min(1, Math.max(0, Math.abs(s.kmh) / 220));
    expect(Math.abs(s.fov - expected)).toBeLessThan(0.5);
    expect(s.fov).toBeGreaterThan(62.5);
  });
});

test.describe('visual - S4 câmera (rodada 2)', () => {
  // C33 (AC 20) - câmera desloca para a esquerda do carro virando à esquerda
  test('camera swings left while turning left', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => (window as any).__game.camera.lateral)).toBeCloseTo(0, 3);
    await page.evaluate(() => (window as any).__game.car.setForwardSpeed(15));
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');
    await advanceSim(page, 1);
    const s = await page.evaluate(() => {
      const g = (window as any).__game;
      return {
        lateral: g.camera.lateral as number,
        target: g.camera.target as { x: number; y: number; z: number },
        car: g.car.position as { x: number; y: number; z: number },
        heading: g.car.heading as number,
        yaw: g.car.angvel.y as number,
      };
    });
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyW');
    expect(s.yaw).toBeGreaterThan(0.2);
    expect(s.lateral).toBeGreaterThan(0.1);
    expect(s.lateral).toBeLessThanOrEqual(1.2);
    // o alvo REAL da câmera está deslocado para a esquerda do carro: (alvo - ponto 6 m atrás) · esquerda
    // o alvo é calculado no último frame; o carro pode ter girado um pouco desde então (tolerância 0.15 m)
    const behindX = s.car.x - Math.sin(s.heading) * 6;
    const behindZ = s.car.z - Math.cos(s.heading) * 6;
    const leftDisp = (s.target.x - behindX) * Math.cos(s.heading) + (s.target.z - behindZ) * -Math.sin(s.heading);
    expect(leftDisp).toBeGreaterThan(0.1);
    expect(Math.abs(leftDisp - s.lateral)).toBeLessThan(0.15);
  });

  // C41 (AC 27): janelas acesas não cintilam com a câmera andando (reflexo da rua oculto: mede só as fachadas)
  test('lit windows stay stable while the camera moves', async ({ page }) => {
    await open(page);
    await advanceSim(page, 1);
    const moving = await page.evaluate(() => (window as any).__game.render.shimmer(0.05, { mirror: false }) as number);
    const still = await page.evaluate(() => (window as any).__game.render.shimmer(0, { mirror: false }) as number);
    expect(still).toBe(0);
    expect(moving).toBeLessThan(0.01);
  });

  // C34 (AC 18) - blur ligado à velocidade no browser
  test('radial blur follows speed above 120 kmh', async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).__game.car.setForwardSpeed(170 / 3.6));
    await advanceSim(page, 0.05);
    const s = await page.evaluate(() => ({
      blur: (window as any).__game.post.uBlur as number,
      kmh: (window as any).__game.car.speedKmh as number,
    }));
    const expected = 0.6 * Math.min(1, Math.max(0, (Math.abs(s.kmh) - 120) / 100));
    expect(s.kmh).toBeGreaterThan(130);
    expect(s.blur).toBeGreaterThan(0.05);
    expect(Math.abs(s.blur - expected)).toBeLessThan(0.05);
  });
});

test.describe('visual - S5 pós', () => {
  // C21 (AC 21, door 7)
  test('pass order by quality', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => (window as any).__game.composer.passes)).toEqual([
      'RenderPass',
      'GTAOPass',
      'UnrealBloomPass',
      'ShaderPass',
      'SMAAPass',
      'OutputPass',
    ]);
    await open(page, '?quality=low');
    expect(await page.evaluate(() => (window as any).__game.composer.passes)).toEqual([
      'RenderPass',
      'UnrealBloomPass',
      'ShaderPass',
      'SMAAPass',
      'OutputPass',
    ]);
  });

  // C22 + C32 (AC 22)
  test('gtao at half resolution', async ({ page }) => {
    await open(page);
    const s = await page.evaluate(() => ({
      gtao: (window as any).__game.post.gtao,
      box: (window as any).__game.post.gtaoClipBox,
      w: window.innerWidth,
      h: window.innerHeight,
    }));
    expect(s.gtao.width).toBe(Math.floor(s.w / 2));
    expect(s.gtao.height).toBe(Math.floor(s.h / 2));
    expect(s.gtao.blendIntensity).toBeCloseTo(0.7, 6);
    expect(s.gtao.output).toBe(0);
    // city-terrain C44: a caixa cobre o mundo de 3 km e a altura dos morros com casas
    expect(s.box.min[0]).toBeLessThanOrEqual(-1536);
    expect(s.box.min[2]).toBeLessThanOrEqual(-1536);
    expect(s.box.max[0]).toBeGreaterThanOrEqual(1536);
    expect(s.box.max[2]).toBeGreaterThanOrEqual(1536);
    expect(s.box.max[1]).toBeGreaterThanOrEqual(160);
  });

  // C18 (parte browser) + C23 (AC 18, AC 23)
  test('grade uniforms and blur at rest', async ({ page }) => {
    await open(page);
    const post = await page.evaluate(() => ({
      u: (window as any).__game.post.uniforms,
      blur: (window as any).__game.post.uBlur,
      aces: (window as any).__game.toneMappingIsACES,
    }));
    expect(post.u.uAberration).toBeCloseTo(0.0015, 6);
    expect(post.u.uVignette).toBeCloseTo(0.35, 6);
    post.u.uLift.forEach((v: number, i: number) => expect(v).toBeCloseTo([0, 0.01, 0.03][i]!, 6));
    post.u.uGain.forEach((v: number, i: number) => expect(v).toBeCloseTo([1.05, 1, 0.95][i]!, 6));
    expect(post.aces).toBe(true);
    expect(post.blur).toBe(0);
  });

  // C24 (AC 24, door 5) - parte browser
  test('quality level from url', async ({ page }) => {
    await open(page, '?quality=low');
    expect(await page.evaluate(() => (window as any).__game.quality.level)).toBe('low');
    await open(page, '?quality=ultra');
    expect(await page.evaluate(() => (window as any).__game.quality.level)).toBe('high');
  });

  // C25 (AC 25)
  test('ready within 30 s at high quality', async ({ page }) => {
    const start = Date.now();
    await open(page);
    expect(Date.now() - start).toBeLessThan(30_000);
  });

  // C31 (door 5)
  test('low quality profile end to end', async ({ page }) => {
    await open(page, '?quality=low');
    const s = await page.evaluate(() => ({
      ready: (window as any).__game.ready,
      rain: (window as any).__game.weather.rainCount,
      refl: (window as any).__game.scene.reflector.present,
    }));
    expect(s).toEqual({ ready: true, rain: 1000, refl: false });
  });
});
