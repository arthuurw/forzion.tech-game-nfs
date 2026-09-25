/**
 * Acumulador de passo fixo (door 5).
 *
 * O browser chama `requestAnimationFrame` em intervalos irregulares (16 ms a
 * 60 FPS, 33 ms a 30 FPS...). A física precisa de passos iguais para ser
 * estável e reproduzível, então acumulamos o tempo real e executamos quantos
 * passos de 1/60 s couberem. Se o frame demorou demais (aba em segundo plano,
 * travada), limitamos a 5 passos e descartamos o resto para não entrar em
 * espiral de morte.
 */
export class FixedStepper {
  accumulator = 0;

  constructor(
    readonly step = 1 / 60,
    readonly maxSteps = 5,
  ) {}

  /** Recebe o tempo real decorrido (s) e devolve quantos passos fixos executar. */
  advance(dt: number): number {
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= this.step - 1e-9 && steps < this.maxSteps) {
      this.accumulator -= this.step;
      steps++;
    }
    if (steps === this.maxSteps) {
      // excedente descartado: o jogo desacelera em vez de congelar
      this.accumulator = 0;
    }
    if (this.accumulator < 0) this.accumulator = 0;
    return steps;
  }
}
