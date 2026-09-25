import { describe, expect, it } from 'vitest';
import { exposeDebug } from '../../src/core/exposeDebug';

describe('exposeDebug', () => {
  // C34 (door 4)
  it('debug handle only in DEV', () => {
    const game = { ready: true };

    const prod: Record<string, unknown> = {};
    exposeDebug({ DEV: false }, game, prod);
    expect(prod.__game).toBeUndefined();

    const dev: Record<string, unknown> = {};
    exposeDebug({ DEV: true }, game, dev);
    expect(dev.__game).toBe(game);
  });
});
