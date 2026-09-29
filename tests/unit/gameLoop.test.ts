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
});
