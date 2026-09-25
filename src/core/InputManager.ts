import { applyKey, createInputState, type InputState } from './input';

/**
 * Liga o teclado ao `InputState`. Teclas seguradas (W, S, A, D, Space) são
 * lidas pelo loop a cada passo; teclas de "toque" (R, M) disparam callbacks
 * uma vez por pressionamento. O primeiro keydown de qualquer tecla também
 * dispara `onFirstKey`, que o áudio usa para obedecer a política de autoplay.
 */
export class InputManager {
  state: InputState = createInputState();
  private firstKeySeen = false;
  private readonly pressHandlers = new Map<string, () => void>();
  private onFirstKey: (() => void) | null = null;

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', this.handleKeyDown);
    target.addEventListener('keyup', this.handleKeyUp);
  }

  onPress(code: string, handler: () => void): void {
    this.pressHandlers.set(code, handler);
  }

  setFirstKeyHandler(handler: () => void): void {
    this.onFirstKey = handler;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space') event.preventDefault();
    if (!this.firstKeySeen) {
      this.firstKeySeen = true;
      this.onFirstKey?.();
    }
    if (event.repeat) return;
    this.state = applyKey(this.state, event.code, true);
    this.pressHandlers.get(event.code)?.();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.state = applyKey(this.state, event.code, false);
  };
}
