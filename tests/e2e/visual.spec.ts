import { expect, test, type Page } from '@playwright/test';
import { advanceSim, buildingScenario, holdKeySim, insideLot, position, teleport } from './helpers';

const SETS = ['Asphalt012', 'PavingStones070', 'Concrete034', 'MetalPlates006', 'Bricks059', 'PaintedPlaster017'];
const KINDS = ['Color', 'NormalGL', 'Roughness'];

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => (window as any).__game?.ready === true, null, { timeout: 30_000 });
}

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

  // play-fixes C24 (AC 18): a chuva acompanha o carro no morro
  test('rain falls on the hill roads', async ({ page }) => {
    await open(page);
    const pick = await page.evaluate(() => {
      const races = (window as any).__game.race.races as Array<{ id: string; gates: Array<{ x: number; y: number; z: number; heading: number }> }>;
      const hill = races.find((r) => r.id === 'sprint-morro')!.gates.reduce((a, b) => (b.y > a.y ? b : a));
      const low = races.find((r) => r.id === 'circuito-centro')!.gates.reduce((a, b) => (Math.abs(b.y - 2) < Math.abs(a.y - 2) ? b : a));
      return { hill, low };
    });
    expect(pick.hill.y).toBeGreaterThanOrEqual(60);
    expect(Math.abs(pick.low.y - 2)).toBeLessThanOrEqual(1.5);
    const countAt = async (g: { x: number; y: number; z: number; heading: number }) => {
      await teleport(page, g.x, g.y + 1.2, g.z, g.heading);
      // a câmera de perseguição volta para trás do carro
      await advanceSim(page, 1.5);
      return page.evaluate(() => (window as any).__game.render.rainPixels() as number);
    };
    const low = await countAt(pick.low);
    const high = await countAt(pick.hill);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(0);
    expect(high).toBeGreaterThanOrEqual(0.5 * low);
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

  // car-feel C16 (AC 14, AC 15): a câmera inclina junto com a carroceria sem mudar para onde olha
  test('camera leans with the body', async ({ page }) => {
    await open(page);
    expect(Math.abs(await page.evaluate(() => (window as any).__game.camera.roll as number))).toBeLessThan(0.001);
    await page.evaluate(() => (window as any).__game.car.setForwardSpeed(60 / 3.6));
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');
    await advanceSim(page, 2);
    const s = await page.evaluate(() => {
      const g = (window as any).__game;
      return {
        roll: g.camera.roll as number,
        bodyRoll: g.car.bodyRoll as number,
        direction: g.camera.direction as { x: number; y: number; z: number },
        up: g.camera.up as { x: number; y: number; z: number },
        camera: g.camera.position as { x: number; y: number; z: number },
        car: g.car.position as { x: number; y: number; z: number },
      };
    });
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyW');
    expect(Math.sign(s.roll)).toBe(Math.sign(s.bodyRoll));
    expect(Math.abs(s.roll)).toBeGreaterThanOrEqual(0.01745);
    // direção de visão contra a direção da câmera até o ponto de lookAt (1 m acima do carro)
    const lx = s.car.x - s.camera.x;
    const ly = s.car.y + 1 - s.camera.y;
    const lz = s.car.z - s.camera.z;
    const len = Math.hypot(lx, ly, lz);
    const dLen = Math.hypot(s.direction.x, s.direction.y, s.direction.z);
    const cos = (s.direction.x * lx + s.direction.y * ly + s.direction.z * lz) / (len * dLen);
    const angleDeg = (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
    expect(angleDeg).toBeLessThan(0.5);
    // a câmera do three inclina de fato: o "cima" dela, contra o de um lookAt sem inclinação
    // (direita0 = direção × Y, cima0 = direita0 × direção), gira `roll` em torno da direção de visão
    const d = { x: s.direction.x / dLen, y: s.direction.y / dLen, z: s.direction.z / dLen };
    const rx = -d.z;
    const rz = d.x; // direção × (0, 1, 0) = (−d.z, 0, d.x)
    const rLen = Math.hypot(rx, rz);
    const r0 = { x: rx / rLen, y: 0, z: rz / rLen };
    const u0 = {
      x: r0.y * d.z - r0.z * d.y,
      y: r0.z * d.x - r0.x * d.z,
      z: r0.x * d.y - r0.y * d.x,
    };
    const upRight = s.up.x * r0.x + s.up.y * r0.y + s.up.z * r0.z;
    const upUp = s.up.x * u0.x + s.up.y * u0.y + s.up.z * u0.z;
    expect(Math.sign(upRight)).toBe(Math.sign(s.bodyRoll));
    const tilt = Math.atan2(upRight, upUp);
    expect(Math.abs(tilt - s.roll)).toBeLessThanOrEqual((0.2 * Math.PI) / 180);
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
  test('low quality profile end to end', { tag: '@smoke' }, async ({ page }) => {
    await open(page, '?quality=low');
    const s = await page.evaluate(() => ({
      ready: (window as any).__game.ready,
      rain: (window as any).__game.weather.rainCount,
      refl: (window as any).__game.scene.reflector.present,
    }));
    expect(s).toEqual({ ready: true, rain: 1000, refl: false });
  });
});

test.describe('facade-glint', () => {
  const FACADE_TYPES = [0, 1, 2, 3];
  type Probe = { flicker: number; litMean: number };
  type Opts = { headlight: boolean; specularAA: boolean; specular?: boolean; legacyMaterials?: boolean };
  const headlightShimmer = (page: Page, type: number, opts: Opts): Promise<Probe> =>
    page.evaluate(
      ([type, opts]) => (window as any).__game.render.headlightShimmer(type, opts) as Probe,
      [type, opts] as const,
    );

  // C1: com farol e antialiasing, o especular da fachada não acrescenta cintilação em nenhum dos 4 tipos
  test('headlight adds no facade glint', async ({ page }) => {
    await open(page);
    await advanceSim(page, 1);
    for (const type of FACADE_TYPES) {
      const spec = await headlightShimmer(page, type, { headlight: true, specularAA: true, specular: true });
      const flat = await headlightShimmer(page, type, { headlight: true, specularAA: true, specular: false });
      expect(spec.flicker - flat.flicker, `facade type ${type}`).toBeLessThanOrEqual(0.001);
    }
  });

  // C2: sem o antialiasing e com os materiais de antes, a sonda enxerga o brilho em pelo menos um tipo
  test('probe detects glint without specular antialiasing', async ({ page }) => {
    await open(page);
    await advanceSim(page, 1);
    const diffs: number[] = [];
    for (const type of FACADE_TYPES) {
      const before = { headlight: true, specularAA: false, legacyMaterials: true };
      const spec = await headlightShimmer(page, type, { ...before, specular: true });
      const flat = await headlightShimmer(page, type, { ...before, specular: false });
      diffs.push(spec.flicker - flat.flicker);
    }
    expect(Math.max(...diffs)).toBeGreaterThan(0.001);
  });

  // C3: com antialiasing, o farol continua iluminando a fachada
  test('headlight still lights the facade', async ({ page }) => {
    await open(page);
    await advanceSim(page, 1);
    for (const type of FACADE_TYPES) {
      const on = await headlightShimmer(page, type, { headlight: true, specularAA: true });
      const off = await headlightShimmer(page, type, { headlight: false, specularAA: true });
      expect(on.litMean, `facade type ${type}`).toBeGreaterThanOrEqual(1.2 * off.litMean);
    }
  });

  // C5: antialiasing de especular ligado por padrão, logo depois de ready e antes de qualquer sonda
  test('specular antialiasing on by default', { tag: '@smoke' }, async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => (window as any).__game.materials.facadeSpecularAA)).toBe(true);
  });
});

test.describe('residuals - reflexo da rua e tijolo', () => {
  const shimmer = (page: Page, step: number, opts: { mirror: boolean; mirrorBlur?: boolean }): Promise<number> =>
    page.evaluate(([step, opts]) => (window as any).__game.render.shimmer(step, opts) as number, [step, opts] as const);

  // C1 (AC 1): com o espelho ligado, a câmera andando quase não soma cintilação ao "sem espelho"
  test('street reflection stays stable while the camera moves', async ({ page }) => {
    await open(page);
    await advanceSim(page, 1);
    const moving = await shimmer(page, 0.05, { mirror: true });
    const noMirror = await shimmer(page, 0.05, { mirror: false });
    const still = await shimmer(page, 0, { mirror: true });
    expect(still).toBe(0);
    expect(moving - noMirror).toBeLessThanOrEqual(0.001);
  });

  // C2 (AC 1): sem o blur (shader de uma amostra), a mesma sonda enxerga o espelho cintilando
  test('probe detects reflection shimmer without blur', async ({ page }) => {
    await open(page);
    await advanceSim(page, 1);
    const sharp = await shimmer(page, 0.05, { mirror: true, mirrorBlur: false });
    const noMirror = await shimmer(page, 0.05, { mirror: false });
    expect(sharp - noMirror).toBeGreaterThanOrEqual(0.003);
  });

  // C3 (AC 2): o blur usa o texel do alvo de meia resolução, que não muda de tamanho
  test('reflection blur keeps the half-resolution target', async ({ page }) => {
    await open(page);
    const s = await page.evaluate(() => ({
      r: (window as any).__game.scene.reflector,
      w: window.innerWidth,
      h: window.innerHeight,
    }));
    const size = [Math.floor(s.w * 0.5), Math.floor(s.h * 0.5)];
    expect(size).toEqual([320, 180]);
    expect(s.r.size).toEqual(size);
    expect(s.r.texel[0]).toBeCloseTo(1 / size[0]!, 9);
    expect(s.r.texel[1]).toBeCloseTo(1 / size[1]!, 9);
    expect(s.r.blur).toBeGreaterThan(0);
  });

  // play-fixes C32 (AC 26): o alvo do espelho segue a janela
  test('reflection target follows a window resize', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 360 });
    await open(page);
    const read = () => page.evaluate(() => ({ r: (window as any).__game.scene.reflector, w: window.innerWidth, h: window.innerHeight }));
    const a = await read();
    expect([a.w, a.h]).toEqual([640, 360]);
    expect(a.r.size).toEqual([320, 180]);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForFunction(() => (window as any).__game.scene.reflector.size[0] === 640, null, { timeout: 5_000 });
    const b = await read();
    expect([b.w, b.h]).toEqual([1280, 720]);
    expect(b.r.size).toEqual([Math.floor(b.w * 0.5), Math.floor(b.h * 0.5)]);
    expect(b.r.size).toEqual([640, 360]);
    expect(b.r.texel[0]).toBeCloseTo(1 / 640, 9);
    expect(b.r.texel[1]).toBeCloseTo(1 / 360, 9);
  });

  // play-fixes C33 (AC 27): pixelRatio e GTAO seguem o devicePixelRatio
  test('pixel ratio and gtao follow the device', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 360 });
    await open(page);
    const read = () => page.evaluate(() => ({ post: (window as any).__game.post, w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }));
    const a = await read();
    expect(a.dpr).toBe(1);
    expect(a.post.pixelRatio).toEqual({ renderer: 1, composer: 1 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 360, deviceScaleFactor: 2, mobile: false });
    await page.waitForFunction(() => window.devicePixelRatio === 2, null, { timeout: 5_000 });
    await page.setViewportSize({ width: 800, height: 450 });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 800, height: 450, deviceScaleFactor: 2, mobile: false });
    await page.waitForFunction(() => (window as any).__game.post.pixelRatio.renderer === 2 && window.innerWidth === 800, null, { timeout: 5_000 });
    const b = await read();
    expect(b.post.pixelRatio).toEqual({ renderer: Math.min(b.dpr, 2), composer: Math.min(b.dpr, 2) });
    expect(b.post.gtao.width).toBe(Math.floor((b.w * 2) / 2));
    expect(b.post.gtao.height).toBe(Math.floor((b.h * 2) / 2));
  });

  // play-fixes C34 (AC 28): sem MSAA no canvas; o SMAA do composer fica
  test('renderer without msaa keeps smaa', async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => ({
      antialias: (document.querySelector('#game') as HTMLCanvasElement).getContext('webgl2')!.getContextAttributes()!.antialias,
      passes: (window as any).__game.composer.passes as string[],
    }));
    expect(r.antialias).toBe(false);
    expect(r.passes).toContain('SMAAPass');
  });

  // C4 (AC 3): o blur não apaga o reflexo - ganho ≥ 0.6 × o do shader de uma amostra
  test('blurred reflection keeps most of its brightness', async ({ page }) => {
    await open(page);
    await advanceSim(page, 1);
    const blurred = await page.evaluate(() => (window as any).__game.render.mirrorGain({}) as number);
    const sharp = await page.evaluate(() => (window as any).__game.render.mirrorGain({ mirrorBlur: false }) as number);
    expect(sharp).toBeGreaterThan(0);
    expect(blurred).toBeGreaterThanOrEqual(0.6 * sharp);
  });

  // C5 (AC 4): guarda de regressão do tijolo (tipo 2) na C1 da facade-glint
  test('brick facade glint has margin', async ({ page }) => {
    await open(page);
    await advanceSim(page, 1);
    const probe = (specular: boolean) =>
      page.evaluate(
        (specular) =>
          (window as any).__game.render.headlightShimmer(2, { headlight: true, specularAA: true, specular }) as {
            flicker: number;
          },
        specular,
      );
    const spec = await probe(true);
    const flat = await probe(false);
    expect(spec.flicker - flat.flicker).toBeLessThanOrEqual(0.0007);
  });
});
