import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameLoop } from '../../src/core/GameLoop';

// play-fixes C10 (AC 7): um throw no quadro para o loop e chega ao handler de erro
describe('GameLoop', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function harness() {
    const queue: Array<(now: number) => void> = [];
    vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => {
      queue.push(cb);
      return queue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    let now = performance.now();
    /** roda o próximo quadro pedido, 50 ms depois do anterior; false se nenhum foi pedido */
    const frame = (): boolean => {
      const cb = queue.shift();
      if (!cb) return false;
      now += 50;
      cb(now);
      return true;
    };
    return { queue, frame };
  }

  it('a throw in the frame stops the loop and reports it', () => {
    for (const where of ['fixedUpdate', 'render'] as const) {
      const { queue, frame } = harness();
      const boom = new Error(`boom in ${where}`);
      let frames = 0;
      const loop = new GameLoop(
        () => {
          if (where === 'fixedUpdate' && frames === 2) throw boom;
        },
        () => {
          frames++;
          if (where === 'render' && frames === 3) throw boom;
        },
      );
      const reported: unknown[] = [];
      loop.onError = (e) => reported.push(e);
      loop.start();
      expect(frame()).toBe(true);
      expect(frame()).toBe(true);
      expect(loop.running, where).toBe(true);
      expect(frame()).toBe(true);
      expect(loop.running, where).toBe(false);
      expect(queue, where).toHaveLength(0);
      expect(reported, where).toEqual([boom]);
      expect(frame()).toBe(false);
    }
  });

  // smooth-world C1 (AC 1, door 1): alpha = acumulador / passo, em [0, 1), em todo quadro
  it('render receives the interpolation alpha', () => {
    for (const hz of [144, 30]) {
      const queue: Array<(now: number) => void> = [];
      vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => queue.push(cb));
      vi.stubGlobal('cancelAnimationFrame', () => {});
      let clock = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => clock);
      let steps = 0;
      const seen: Array<{ steps: number; alpha: number }> = [];
      const loop = new GameLoop(
        () => steps++,
        (_dt, alpha) => seen.push({ steps, alpha }),
      );
      loop.start();
      const frames = hz * 2;
      for (let f = 1; f <= frames; f++) {
        clock += 1000 / hz;
        queue.shift()!(clock);
        // depois de f quadros passaram f/hz s: os passos inteiros de 1/60 rodaram e a sobra é o alpha
        const exact = (f / hz) * 60;
        const whole = Math.floor(exact + 1e-6);
        const r = seen[f - 1]!;
        expect(r.steps, `${hz} Hz quadro ${f}`).toBe(whole);
        expect(Math.abs(r.alpha - (exact - whole)), `${hz} Hz quadro ${f}`).toBeLessThan(1e-9);
        expect(r.alpha).toBeGreaterThanOrEqual(0);
        expect(r.alpha).toBeLessThan(1);
      }
      expect(seen).toHaveLength(frames);
      // a 144 Hz a sobra varia de quadro a quadro; a 30 Hz cada quadro fecha 2 passos inteiros
      const distinct = new Set(seen.map((r) => r.alpha.toFixed(6))).size;
      if (hz === 144) expect(distinct).toBeGreaterThan(5);
      else expect(seen.every((r) => r.alpha < 1e-9)).toBe(true);
      loop.stop();
      vi.restoreAllMocks();
    }
  });

  // e2e-speed C1 (AC 1)
  it('runSteps calls fixedUpdate n times without render', () => {
    harness();
    const dts: number[] = [];
    let renders = 0;
    const loop = new GameLoop(
      (dt) => dts.push(dt),
      () => renders++,
    );
    loop.start();
    loop.runSteps(5);
    expect(dts).toEqual([1 / 60, 1 / 60, 1 / 60, 1 / 60, 1 / 60]);
    expect(renders).toBe(0);
    loop.runSteps(0);
    expect(dts).toHaveLength(5);
    expect(renders).toBe(0);
  });

  // e2e-speed C2 (AC 2)
  it('runSteps stops on a throw and reports it once', () => {
    harness();
    const boom = new Error('boom in runSteps');
    let calls = 0;
    const loop = new GameLoop(
      () => {
        calls++;
        if (calls === 3) throw boom;
      },
      () => {},
    );
    const reported: unknown[] = [];
    loop.onError = (e) => reported.push(e);
    loop.start();
    expect(loop.running).toBe(true);
    expect(() => loop.runSteps(5)).not.toThrow();
    expect(calls).toBe(3);
    expect(loop.running).toBe(false);
    expect(reported).toEqual([boom]);
  });
});
