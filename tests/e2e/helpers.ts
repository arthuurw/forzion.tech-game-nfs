import type { Page } from '@playwright/test';

/**
 * Os checks falam em segundos de jogo. Em headless (SwiftShader) o quadro custa ~150 ms e o
 * acumulador limita 5 passos por quadro, então a física anda a ~0.25 do tempo real. Por isso as
 * esperas de simulação vão, por padrão, pelo avanço rápido (`__game.stepSim`, AD-019): os passos
 * rodam na hora, sem render entre eles, e o helper espera 1 quadro para HUD, malhas e câmera lerem
 * o último passo. Prova que mede algo atualizado só no render ao longo do tempo (suavização da
 * câmera, áudio, amostragem por quadro) passa `{ realtime: true }` e espera o laço de quadros.
 */
const SIM_TIMEOUT_MS = 90_000;

/**
 * Prazo de relógio do boot: sozinho leva 3-5 s, mas com a máquina ocupada (workers em paralelo,
 * outra suíte num worktree) passava dos 30 s de antes.
 */
export const BOOT_TIMEOUT_MS = 90_000;

/** Abre o jogo (com `query`, ex. `?quality=low`) e espera o primeiro frame (`window.__game.ready`). */
export async function gotoGame(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => (window as any).__game?.ready === true, null, { timeout: BOOT_TIMEOUT_MS });
}

export function simTime(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__game.simTime as number);
}

export interface SimOptions {
  /** espera o laço de quadros andar a simulação, em vez do avanço rápido */
  realtime?: boolean;
}

/** Espera o próximo quadro depois de `frames` (ou o laço parado por erro). */
async function frameAfter(page: Page, frames: number): Promise<void> {
  await page.waitForFunction(
    (frames) => {
      const g = (window as any).__game;
      return g.frames > frames || !g.running;
    },
    frames,
    { timeout: SIM_TIMEOUT_MS },
  );
}

/** Avança `seconds` de simulação: na hora pelo `stepSim` e 1 quadro, ou pelo laço com `realtime`. */
export async function advanceSim(page: Page, seconds: number, opts: SimOptions = {}): Promise<void> {
  if (!opts.realtime) {
    const frames = await page.evaluate((s) => {
      const g = (window as any).__game;
      g.stepSim(s);
      return g.frames as number;
    }, seconds);
    await frameAfter(page, frames);
    return;
  }
  const start = await simTime(page);
  await page.waitForFunction(
    (target) => (window as any).__game.simTime >= target,
    start + seconds,
    { timeout: SIM_TIMEOUT_MS },
  );
}

/** Segura a tecla por `seconds` de simulação. */
export async function holdKeySim(page: Page, code: string, seconds: number, opts: SimOptions = {}): Promise<void> {
  await page.keyboard.down(code);
  await advanceSim(page, seconds, opts);
  await page.keyboard.up(code);
}

/**
 * Espera até `predicate` valer ou `seconds` de simulação passarem; devolve se valeu. Sem
 * `realtime`, anda um passo por vez pelo `stepSim` e para no primeiro em que o predicado vale.
 */
export async function waitSimUntil(page: Page, predicate: string, seconds: number, opts: SimOptions = {}): Promise<boolean> {
  if (!opts.realtime) {
    const r = await page.evaluate(
      ({ predicate, seconds }) => {
        const g = (window as any).__game;
        // eslint-disable-next-line no-new-func
        const holds = new Function('g', `return (${predicate});`) as (g: unknown) => unknown;
        let ok = Boolean(holds(g));
        for (let i = 0, n = Math.round(seconds * 60); !ok && i < n && g.running; i++) {
          g.stepSim(1 / 60);
          ok = Boolean(holds(g));
        }
        return ok;
      },
      { predicate, seconds },
    );
    // sem esperar quadro: um quadro de ~150 ms traria até 5 passos depois do que fez o predicado valer
    return r;
  }
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

/**
 * Cenário de batida da city-terrain (C44): o primeiro prédio do centro em
 * `__game.world.lots`, com o carro a 8 m da fachada voltada para a rua, de
 * frente para ela. Devolve o lote e a pose do carro.
 */
export async function buildingScenario(page: Page): Promise<{
  lot: { x: number; z: number; y: number; width: number; depth: number; height: number; rotation: number; side: number };
  x: number;
  y: number;
  z: number;
  heading: number;
}> {
  return page.evaluate(() => {
    const w = (window as any).__game.world;
    const lot = w.lots.find((l: any) => l.downtown && Math.abs(l.x) < 400 && Math.abs(l.z) < 400);
    // a rua fica do lado −side·esquerda do centro do lote; esquerda do heading r = (cos r, −sin r)
    const lx = Math.cos(lot.rotation) * lot.side;
    const lz = -Math.sin(lot.rotation) * lot.side;
    const d = lot.depth / 2 + 8;
    const x = lot.x - lx * d;
    const z = lot.z - lz * d;
    return { lot, x, y: w.heightAt(x, z) + 1.2, z, heading: Math.atan2(lx, lz) };
  });
}

/** O chassi está dentro do retângulo (orientado) do lote? */
export function insideLot(
  lot: { x: number; z: number; width: number; depth: number; rotation: number },
  x: number,
  z: number,
): boolean {
  const dx = x - lot.x;
  const dz = z - lot.z;
  const u = dx * Math.sin(lot.rotation) + dz * Math.cos(lot.rotation);
  const v = dx * Math.cos(lot.rotation) - dz * Math.sin(lot.rotation);
  return Math.abs(u) <= lot.width / 2 && Math.abs(v) <= lot.depth / 2;
}

/** Espera o jogo renderizar mais `n` quadros (`__game.frames`); substitui esperas de relógio. */
export async function waitFrames(page: Page, n: number): Promise<void> {
  const start = await page.evaluate(() => (window as any).__game.frames as number);
  await page.waitForFunction((target) => (window as any).__game.frames >= target, start + n, { timeout: SIM_TIMEOUT_MS });
}

/** Espera `n` quadros do navegador (rAF), para quando não existe `__game` (boot que falhou). */
export async function pageFrames(page: Page, n: number): Promise<void> {
  await page.evaluate(
    (n) =>
      new Promise<void>((done) => {
        let left = n;
        const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );
}

/**
 * Amostra, dentro do navegador e a cada quadro, a maior velocidade (km/h) de todos os carros
 * enquanto a corrida está em `countdown`. Falha com `countdown não terminou em N s` se a
 * contagem não acaba em `deadlineS` de simulação (test-hardening C24).
 */
export async function sampleCountdown(page: Page, deadlineS: number): Promise<number> {
  const r = await page.evaluate(
    (deadlineS) =>
      new Promise<{ ended: boolean; maxKmh: number }>((done) => {
        const g = (window as any).__game;
        const end = g.simTime + deadlineS;
        let maxKmh = 0;
        const tick = () => {
          if (g.race.state !== 'countdown') return done({ ended: true, maxKmh });
          if (g.simTime >= end) return done({ ended: false, maxKmh });
          maxKmh = Math.max(maxKmh, Math.abs(g.car.speedKmh), ...g.race.opponents.map((o: any) => Math.abs(o.speedKmh)));
          requestAnimationFrame(tick);
        };
        tick();
      }),
    deadlineS,
  );
  if (!r.ended) throw new Error(`countdown não terminou em ${deadlineS} s`);
  return r.maxKmh;
}
