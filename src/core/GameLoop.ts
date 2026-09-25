import { FixedStepper } from './FixedStepper';

/**
 * Loop principal: a cada `requestAnimationFrame` avança a física em passos
 * fixos (quantos couberem) e depois renderiza uma vez com o tempo real do
 * frame. Frames muito longos (aba oculta) são limitados a 0.25 s.
 */
export class GameLoop {
  private readonly stepper = new FixedStepper();
  private last = 0;
  private handle = 0;
  running = false;

  constructor(
    private readonly fixedUpdate: (dt: number) => void,
    private readonly render: (dt: number) => void,
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

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;

    const steps = this.stepper.advance(dt);
    for (let i = 0; i < steps; i++) this.fixedUpdate(this.stepper.step);

    this.render(dt);
    this.handle = requestAnimationFrame(this.frame);
  };
}
