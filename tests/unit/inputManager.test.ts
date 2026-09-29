import { describe, expect, it } from 'vitest';
import { InputManager } from '../../src/core/InputManager';

// test-hardening C13-C15 (AC 12): o InputManager num alvo de eventos falso
function key(type: 'keydown' | 'keyup', code: string, repeat = false): Event {
  return Object.assign(new Event(type, { cancelable: true }), { code, repeat });
}

function setup() {
  const target = new EventTarget();
  const input = new InputManager(target as unknown as Window);
  return { target, input };
}

describe('InputManager', () => {
  // C13
  it('repeat keydown changes nothing', () => {
    const { target, input } = setup();
    let presses = 0;
    input.onPress('KeyR', () => presses++);
    target.dispatchEvent(key('keydown', 'KeyW', true));
    target.dispatchEvent(key('keydown', 'KeyR', true));
    expect(input.state.throttle).toBe(false);
    expect(presses).toBe(0);
  });

  // C14
  it('first key handler runs once', () => {
    const { target, input } = setup();
    let first = 0;
    input.setFirstKeyHandler(() => first++);
    target.dispatchEvent(key('keydown', 'KeyW'));
    target.dispatchEvent(key('keydown', 'KeyA'));
    target.dispatchEvent(key('keydown', 'KeyD'));
    expect(first).toBe(1);
  });

  // C32: Espaço é o freio de mão; o navegador não pode rolar a página com ele
  it('space keydown prevents the default action and other keys do not', () => {
    const { target } = setup();
    const space = key('keydown', 'Space');
    const w = key('keydown', 'KeyW');
    target.dispatchEvent(space);
    target.dispatchEvent(w);
    expect(space.defaultPrevented).toBe(true);
    expect(w.defaultPrevented).toBe(false);
  });

  // C15
  it('keyup clears and press handler runs per press', () => {
    const { target, input } = setup();
    target.dispatchEvent(key('keydown', 'KeyW'));
    expect(input.state.throttle).toBe(true);
    target.dispatchEvent(key('keyup', 'KeyW'));
    expect(input.state.throttle).toBe(false);

    let presses = 0;
    input.onPress('KeyR', () => presses++);
    target.dispatchEvent(key('keydown', 'KeyR'));
    target.dispatchEvent(key('keyup', 'KeyR'));
    expect(presses).toBe(1);
    target.dispatchEvent(key('keydown', 'KeyR'));
    target.dispatchEvent(key('keyup', 'KeyR'));
    expect(presses).toBe(2);
  });
});
