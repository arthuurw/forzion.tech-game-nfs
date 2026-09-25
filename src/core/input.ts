/**
 * Estado de input puro (sem DOM). O `InputManager` traduz eventos de teclado
 * para chamadas de `applyKey`; o resto do jogo só lê `InputState`.
 *
 * Direção é guardada como dois booleanos (esquerda/direita) para que A+D
 * juntos resultem em 0, e `steerAxis` devolve -1, 0 ou +1.
 */
export interface InputState {
  throttle: boolean;
  brake: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  handbrake: boolean;
  reset: boolean;
  mute: boolean;
}

/** `KeyboardEvent.code` -> campo de InputState. Fonte única do mapa de teclas. */
export const KEYMAP: Readonly<Record<string, keyof InputState>> = {
  KeyW: 'throttle',
  KeyS: 'brake',
  KeyA: 'steerLeft',
  KeyD: 'steerRight',
  Space: 'handbrake',
  KeyR: 'reset',
  KeyM: 'mute',
};

export function createInputState(): InputState {
  return {
    throttle: false,
    brake: false,
    steerLeft: false,
    steerRight: false,
    handbrake: false,
    reset: false,
    mute: false,
  };
}

/** Retorna um novo estado com a tecla `code` pressionada (`down = true`) ou solta. */
export function applyKey(state: InputState, code: string, down: boolean): InputState {
  const field = KEYMAP[code];
  if (!field) return state;
  return { ...state, [field]: down };
}

/** +1 = esquerda (A), -1 = direita (D), 0 = nenhum ou ambos. */
export function steerAxis(state: InputState): number {
  return (state.steerLeft ? 1 : 0) - (state.steerRight ? 1 : 0);
}
