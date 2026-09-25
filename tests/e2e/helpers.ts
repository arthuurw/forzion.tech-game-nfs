import type { Page } from '@playwright/test';

/**
 * Os checks falam em segundos de jogo. Em headless (SwiftShader) o frame rate
 * é baixo e o acumulador de física limita 5 passos por frame, então 1 s de
 * relógio pode ser bem menos de 1 s simulado. Por isso todo "segurar por N s"
 * espera `__game.simTime` avançar N segundos, com timeout de relógio folgado.
 */
const SIM_TIMEOUT_MS = 90_000;

/** Abre o jogo e espera o primeiro frame (`window.__game.ready`). */
export async function gotoGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__game?.ready === true, null, { timeout: 30_000 });
}

export function simTime(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__game.simTime as number);
}

/** Espera o relógio da física avançar `seconds`. */
export async function advanceSim(page: Page, seconds: number): Promise<void> {
  const start = await simTime(page);
  await page.waitForFunction(
    (target) => (window as any).__game.simTime >= target,
    start + seconds,
    { timeout: SIM_TIMEOUT_MS },
  );
}

/** Segura a tecla por `seconds` de simulação. */
export async function holdKeySim(page: Page, code: string, seconds: number): Promise<void> {
  await page.keyboard.down(code);
  await advanceSim(page, seconds);
  await page.keyboard.up(code);
}

/** Espera até `predicate` valer ou `seconds` de simulação passarem; devolve se valeu. */
export async function waitSimUntil(page: Page, predicate: string, seconds: number): Promise<boolean> {
  const start = await simTime(page);
  try {
    await page.waitForFunction(
      ({ predicate, deadline }) => {
        const g = (window as any).__game;
        // eslint-disable-next-line no-new-func
        if (new Function('g', `return (${predicate});`)(g)) return true;
        if (g.simTime >= deadline) return 'timeout';
        return false;
      },
      { predicate, deadline: start + seconds },
      { timeout: SIM_TIMEOUT_MS },
    );
  } catch {
    return false;
  }
  return page.evaluate((predicate) => {
    const g = (window as any).__game;
    return Boolean(new Function('g', `return (${predicate});`)(g));
  }, predicate);
}

export function speedKmh(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__game.car.speedKmh as number);
}

export function position(page: Page): Promise<{ x: number; y: number; z: number }> {
  return page.evaluate(() => (window as any).__game.car.position);
}

export function heading(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__game.car.heading as number);
}

export function teleport(page: Page, x: number, y: number, z: number, headingRad: number): Promise<void> {
  return page.evaluate(
    ([x, y, z, h]) => (window as any).__game.car.teleport(x, y, z, h),
    [x, y, z, headingRad] as const,
  );
}
