import { FixedStepper } from './FixedStepper';

/**
 * Loop principal: a cada `requestAnimationFrame` avança a física em passos
 * fixos (quantos couberem) e depois renderiza uma vez com o tempo real do
 * frame e a fração de passo que sobrou no acumulador (`alpha`, em [0, 1)): o
 * render desenha entre a pose do passo anterior e a atual (smooth-world door 1,
 * AD-020). Frames muito longos (aba oculta) são limitados a 0.25 s. Um throw
 * no passo ou no render para o loop e vai para `onError`: sem isso o jogo
 * congelaria na última imagem sem aviso.
 */
export class GameLoop {
  private readonly stepper = new FixedStepper();
  private last = 0;
  private handle = 0;
  running = false;
  onError: ((error: unknown) => void) | null = null;

  constructor(
    private readonly fixedUpdate: (dt: number) => void,
    private readonly render: (dt: number, alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.handle = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
  }

  /**
   * Avanço rápido só para testes (AD-019): `n` passos fixos seguidos, sem
   * render entre eles, no mesmo tratamento de erro do quadro.
   */
  runSteps(n: number): void {
    try {
      for (let i = 0; i < n; i++) this.fixedUpdate(this.stepper.step);
    } catch (error) {
      this.stop();
      this.onError?.(error);
    }
    // o tempo gasto aqui já virou passos: o próximo quadro não cobra ele de novo
    this.last = performance.now();
    this.stepper.accumulator = 0;
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;

    try {
      const steps = this.stepper.advance(dt);
      for (let i = 0; i < steps; i++) this.fixedUpdate(this.stepper.step);
      this.render(dt, this.stepper.accumulator / this.stepper.step);
    } catch (error) {
      this.stop();
      this.onError?.(error);
      return;
    }
    this.handle = requestAnimationFrame(this.frame);
  };
}
