import { describe, expect, it } from 'vitest';
import { DEFAULT_CAR } from '../../src/vehicle/carSpec';
import { stepDrivetrain, steerTarget, type DriveInput, type DrivetrainState } from '../../src/vehicle/drivetrain';

const spec = DEFAULT_CAR;
const DT = 1 / 60;
const idle: DriveInput = { throttle: false, brake: false, steer: 0, handbrake: false };
/** estado assentado: sem troca em curso, última troca há 1 s */
const settled = (over: Partial<DrivetrainState> = {}): DrivetrainState => ({
  gear: 1,
  rpm: 1000,
  shiftTimer: 0,
  lastShiftAgo: 1,
  steer: 0,
  ...over,
});

/** Roda `n` passos a `v` m/s com o mesmo input e devolve o `steer` depois de cada passo. */
function steerTrace(start: number, steer: number, n: number, v = 0): number[] {
  let s = settled({ steer: start });
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    s = stepDrivetrain(spec, s, { ...idle, steer }, v, DT).state;
    out.push(s.steer);
  }
  return out;
}

describe('drivetrain', () => {
  // C6 (AC 6, door 2) - substitui free-roam-city C6 junto com C7
  it('steering ramps toward the target', () => {
    const up = 2.5 / 60;
    const down = 3.5 / 60;

    // A: cresce 2.5/60 por passo, chega a 0.55 no passo 14 e fica
    const a = steerTrace(0, 1, 30);
    let prev = 0;
    for (let i = 0; i < 13; i++) {
      expect(Math.abs(a[i]! - prev - up), `step ${i + 1}`).toBeLessThan(1e-12);
      prev = a[i]!;
    }
    expect(a[12]!).toBeLessThan(0.55);
    expect(a[13]!).toBe(0.55);
    for (let i = 13; i < 30; i++) expect(a[i]!, `step ${i + 1}`).toBe(0.55);

    // soltando: cai 3.5/60 por passo até 0, sem passar para o outro lado
    const rel = steerTrace(0.55, 0, 20);
    prev = 0.55;
    let reachedZero = false;
    for (let i = 0; i < 20; i++) {
      const x = rel[i]!;
      expect(x, `release step ${i + 1}`).toBeGreaterThanOrEqual(0);
      if (!reachedZero && x > 0) expect(Math.abs(prev - x - down), `release step ${i + 1}`).toBeLessThan(1e-12);
      if (x === 0) reachedZero = true;
      prev = x;
    }
    expect(reachedZero).toBe(true);
    expect(rel[19]!).toBe(0);

    // de +0.55 com input -1: até -0.55 sem pular valores
    const flip = steerTrace(0.55, -1, 60);
    prev = 0.55;
    for (let i = 0; i < 60; i++) {
      expect(Math.abs(flip[i]! - prev), `flip step ${i + 1}`).toBeLessThanOrEqual(down + 1e-12);
      expect(flip[i]!).toBeGreaterThanOrEqual(-0.55);
      prev = flip[i]!;
    }
    expect(flip[59]!).toBe(-0.55);

    // D é o espelho exato de A (e dos outros dois casos)
    const mirror: Array<[number[], number[]]> = [
      [a, steerTrace(0, -1, 30)],
      [rel, steerTrace(-0.55, 0, 20)],
      [flip, steerTrace(-0.55, 1, 60)],
    ];
    for (const [pos, neg] of mirror) {
      pos.forEach((x, i) => expect(neg[i] === -x, `mirror step ${i + 1}`).toBe(true));
    }
  });

  // C7 (AC 7) - substitui free-roam-city C6 junto com C6
  it('steering target shrinks with speed', () => {
    const table: Array<[number, number]> = [
      [0, 0.55],
      [0.9, 0.55],
      [5, 0.55],
      [10, Math.atan(33.1578 / 100)],
      [27.78, Math.atan(33.1578 / 771.73)],
      [55.56, Math.atan(33.1578 / 3086.9)],
      [-5, 0.55],
    ];
    for (const [v, expected] of table) {
      expect(Math.abs(steerTarget(spec, v) - expected), `target at ${v} m/s`).toBeLessThanOrEqual(1e-6);
    }
    // a ré usa o mesmo alvo da frente
    expect(steerTarget(spec, -5)).toBe(steerTarget(spec, 5));
    // e é o alvo para onde a rampa de stepDrivetrain converge
    for (const [v, expected] of table) {
      const trace = steerTrace(0, 1, 30, v);
      expect(Math.abs(trace[29]! - expected), `ramp converges at ${v} m/s`).toBeLessThanOrEqual(1e-6);
    }
  });

  // C14 (AC 13, AC 21) - substitui free-roam-city C2
  it('brake split front biased', () => {
    const { cmd } = stepDrivetrain(spec, settled({ gear: 3 }), { ...idle, brake: true }, 60 / 3.6, DT);
    expect(cmd.engineForce).toBe(0);
    expect(cmd.brakeFront + cmd.brakeRear).toBeCloseTo(spec.brakeForceN, 9);
    expect(spec.brakeBiasFront).toBe(0.65);
    expect(Math.abs(cmd.brakeFront / (cmd.brakeFront + cmd.brakeRear) - 0.65)).toBeLessThanOrEqual(1e-9);
    expect(cmd.brakeFront).toBeGreaterThan(0);
    expect(cmd.brakeRear).toBeGreaterThan(0);
  });
});
