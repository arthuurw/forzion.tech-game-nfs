import { expect, test, type Page } from '@playwright/test';
import { advanceSim, gotoGame, waitSimUntil } from './helpers';

// e2e-speed: o avanço rápido da simulação (AD-019) e os helpers que andam por ele

/** `simTime` e `frames` lidos juntos */
function clock(page: Page): Promise<{ simTime: number; frames: number }> {
  return page.evaluate(() => {
    const g = (window as any).__game;
    return { simTime: g.simTime as number, frames: g.frames as number };
  });
}

/**
 * Espiona os `stepSim` que `run` faz: devolve o `simTime` antes do primeiro e depois do último, os
 * dois lidos no mesmo `evaluate` do helper, sem quadros entre eles. `reached` é a comparação feita
 * na página, com o mesmo `t0 + s` do helper.
 */
async function spySteps(page: Page, s: number, run: () => Promise<unknown>): Promise<{ span: number; reached: boolean }> {
  await page.evaluate(() => {
    const g = (window as any).__game;
    const orig = g.stepSim;
    const log: number[][] = [];
    (window as any).__spy = { orig, log };
    g.stepSim = (secs: number) => {
      const before = g.simTime as number;
      const r = orig(secs);
      log.push([before, g.simTime as number]);
      return r;
    };
  });
  await run();
  return page.evaluate((s) => {
    const g = (window as any).__game;
    const { orig, log } = (window as any).__spy;
    g.stepSim = orig;
    const t0 = log[0][0] as number;
    const end = log[log.length - 1][1] as number;
    return { span: end - t0, reached: end >= t0 + s };
  }, s);
}

test.describe('harness - avanço rápido', () => {
  // C3 (AC 3)
  test('stepSim advances exactly the requested steps', { tag: '@smoke' }, async ({ page }) => {
    await gotoGame(page);
    for (const s of [0.5, 1, 1 / 60]) {
      const d = await page.evaluate((s) => {
        const g = (window as any).__game;
        const before = g.simTime as number;
        return (g.stepSim(s) as number) - before;
      }, s);
      expect(Math.abs(d - Math.round(s * 60) / 60), `s = ${s}`).toBeLessThanOrEqual(1e-9);
    }
  });

  // C4 (AC 4)
  test('stepSim reads held keys', async ({ page }) => {
    await gotoGame(page);
    await page.keyboard.down('KeyW');
    const kmh = await page.evaluate(() => {
      const g = (window as any).__game;
      g.stepSim(2);
      return g.car.speedKmh as number;
    });
    await page.keyboard.up('KeyW');
    expect(kmh).toBeGreaterThan(10);
  });

  // C5 (AC 5)
  test('next frame shows the last step', async ({ page }) => {
    await gotoGame(page);
    await page.keyboard.down('KeyW');
    const frames = await page.evaluate(() => {
      const g = (window as any).__game;
      g.stepSim(2);
      return g.frames as number;
    });
    await page.waitForFunction((f) => (window as any).__game.frames >= f + 1, frames);
    const [label, kmh] = await page.evaluate(() => [
      Number(document.querySelector('#speed')!.textContent),
      (window as any).__game.car.speedKmh as number,
    ]);
    await page.keyboard.up('KeyW');
    expect(kmh).toBeGreaterThan(10);
    expect(Math.abs(label - Math.round(Math.abs(kmh)))).toBeLessThanOrEqual(1);
  });
});

test.describe('harness - helpers', () => {
  // C6 (AC 6)
  test('advanceSim steps fast and waits one frame', { tag: '@smoke' }, async ({ page }) => {
    await gotoGame(page);
    const a = await clock(page);
    const r = await spySteps(page, 3, () => advanceSim(page, 3));
    const b = await clock(page);
    expect(r.reached).toBe(true);
    expect(r.span).toBeLessThanOrEqual(3 + 1 / 60 + 1e-9);
    expect(b.frames - a.frames).toBeGreaterThanOrEqual(1);
    // o laço de quadros levaria ≥ 36 quadros para 3 s a 5 passos por quadro
    expect(b.frames - a.frames).toBeLessThanOrEqual(10);
    // 1.2 passos: Math.round dá 1, e só o passo extra alcança o alvo
    const small = await spySteps(page, 0.02, () => advanceSim(page, 0.02));
    expect(small.reached).toBe(true);
    expect(small.span).toBeLessThanOrEqual(0.02 + 1 / 60 + 1e-9);
  });

  // C7 (AC 7)
  test('advanceSim realtime waits on the frame loop', async ({ page }) => {
    await gotoGame(page);
    const a = await clock(page);
    await advanceSim(page, 1, { realtime: true });
    const b = await clock(page);
    expect(b.simTime - a.simTime).toBeGreaterThanOrEqual(1);
    expect(b.frames - a.frames).toBeGreaterThanOrEqual(12);
  });

  // C8 (AC 8)
  test('waitSimUntil stops on the first step that holds', async ({ page }) => {
    await gotoGame(page);
    await page.keyboard.down('KeyW');
    expect(await waitSimUntil(page, 'g.car.speedKmh >= 30', 10)).toBe(true);
    const r = await page.evaluate(() => {
      const g = (window as any).__game;
      const at = g.car.speedKmh as number;
      g.stepSim(1 / 60);
      return { at, gain: (g.car.speedKmh as number) - at };
    });
    await page.keyboard.up('KeyW');
    expect(r.at).toBeGreaterThanOrEqual(30);
    expect(r.at).toBeLessThan(30 + r.gain + 0.5);

    let held: boolean | undefined;
    const d = await spySteps(page, 0.5, async () => {
      held = await waitSimUntil(page, 'false', 0.5);
    });
    expect(held).toBe(false);
    expect(d.reached).toBe(true);
    expect(d.span).toBeLessThanOrEqual(0.5 + 1 / 60 + 1e-9);
  });
});
