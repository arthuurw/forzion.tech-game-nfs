import { describe, expect, it } from 'vitest';
import { applyKey, createInputState, steerAxis } from '../../src/core/input';

describe('input keymap', () => {
  // C15 (AC 1-5, 9, 30) - table-driven over all 7 keys
  it('keymap table', () => {
    const table: Array<[string, (s: ReturnType<typeof createInputState>) => unknown, unknown]> = [
      ['KeyW', (s) => s.throttle, true],
      ['KeyS', (s) => s.brake, true],
      ['KeyA', (s) => steerAxis(s), 1],
      ['KeyD', (s) => steerAxis(s), -1],
      ['Space', (s) => s.handbrake, true],
      ['KeyR', (s) => s.reset, true],
      ['KeyM', (s) => s.mute, true],
    ];
    expect(table.length).toBe(7);
    for (const [code, read, expected] of table) {
      const fresh = createInputState();
      const down = applyKey(fresh, code, true);
      expect(read(down), `${code} down`).toBe(expected);
      const up = applyKey(down, code, false);
      expect(up, `${code} up restores`).toEqual(createInputState());
    }

    const untouched = applyKey(createInputState(), 'KeyQ', true);
    expect(untouched).toEqual(createInputState());

    const both = applyKey(applyKey(createInputState(), 'KeyA', true), 'KeyD', true);
    expect(steerAxis(both)).toBe(0);
  });
});
