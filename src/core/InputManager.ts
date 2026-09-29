import { applyKey, createInputState, type InputState } from './input';

/**
 * Liga o teclado ao `InputState`. Teclas seguradas (W, S, A, D, Space) são
 * lidas pelo loop a cada passo; teclas de "toque" (R, M) disparam callbacks
 * uma vez por pressionamento. O primeiro keydown de qualquer tecla também
 * dispara `onFirstKey` (depois de aplicar a tecla), que o áudio usa para
 * obedecer a política de autoplay; todo keydown e pointerdown dispara
 * `onGesture`, que retoma um áudio suspenso. Perder o foco da janela ou
 * esconder a página solta todas as teclas: o `keyup` delas iria para outro lugar.
 */
export class InputManager {
  state: InputState = createInputState();
  private firstKeySeen = false;
  private readonly pressHandlers = new Map<string, () => void>();
  private onFirstKey: (() => void) | null = null;
  private onGesture: (() => void) | null = null;

  constructor(
    private readonly target: Window = window,
    private readonly doc: Document | null = typeof document === 'undefined' ? null : document,
  ) {
    target.addEventListener('keydown', this.handleKeyDown);
    target.addEventListener('keyup', this.handleKeyUp);
    target.addEventListener('pointerdown', this.handlePointerDown);
    target.addEventListener('blur', this.releaseAll);
    doc?.addEventListener('visibilitychange', this.handleVisibility);
  }

  onPress(code: string, handler: () => void): void {
    this.pressHandlers.set(code, handler);
  }

  setFirstKeyHandler(handler: () => void): void {
    this.onFirstKey = handler;
  }

  setGestureHandler(handler: () => void): void {
    this.onGesture = handler;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('pointerdown', this.handlePointerDown);
    this.target.removeEventListener('blur', this.releaseAll);
    this.doc?.removeEventListener('visibilitychange', this.handleVisibility);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space') event.preventDefault();
    if (!event.repeat) {
      this.state = applyKey(this.state, event.code, true);
      this.pressHandlers.get(event.code)?.();
    }
    if (!this.firstKeySeen) {
      this.firstKeySeen = true;
      this.onFirstKey?.();
    }
    this.onGesture?.();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.state = applyKey(this.state, event.code, false);
  };

  private readonly handlePointerDown = (): void => {
    this.onGesture?.();
  };

  private readonly releaseAll = (): void => {
    this.state = createInputState();
  };

  private readonly handleVisibility = (): void => {
    if (this.doc?.visibilityState === 'hidden') this.releaseAll();
  };
}
