import { describe, expect, it } from 'vitest';
import { DEFAULT_CAR } from '../../src/vehicle/carSpec';
import * as drivetrain from '../../src/vehicle/drivetrain';
import {
  stepDrivetrain,
  steerTarget,
  torqueAt,
  type DriveInput,
  type DrivetrainState,
} from '../../src/vehicle/drivetrain';

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

// ---- S3: motor, câmbio e freios ----

/** velocidade (m/s) que dá `rpm` na marcha (1..6) pela relação da ficha */
const speedFor = (gear: number, rpm: number, s = spec): number =>
  rpm / ((1 / s.wheelRadiusM) * (60 / (2 * Math.PI)) * s.gearRatios[gear - 1]! * s.finalDrive);
/** interpolação linear da curva, escrita aqui a partir do AC 14 */
function expectedTorque(rpm: number): number {
  const c = spec.torqueCurve;
  for (let i = 1; i < c.length; i++) {
    const [r0, t0] = c[i - 1]!;
    const [r1, t1] = c[i]!;
    if (rpm >= r0 && rpm <= r1) return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
  }
  throw new Error(`rpm ${rpm} outside the curve`);
}

describe('drivetrain - engine and gearbox', () => {
  // C15 (AC 14)
  it('engine force follows the torque curve', () => {
    const v = speedFor(3, 4500);
    const { state, cmd } = stepDrivetrain(spec, settled({ gear: 3 }), { ...idle, throttle: true }, v, DT);
    expect(state.gear).toBe(3);
    expect(state.rpm).toBeCloseTo(4500, 6);
    const expected =
      (expectedTorque(4500) * spec.gearRatios[2]! * spec.finalDrive * spec.drivetrainEfficiency) / spec.wheelRadiusM;
    expect(Math.abs(cmd.engineForce - expected)).toBeLessThanOrEqual(1e-6);

    // interpolação linear: ponto médio = média dos vizinhos; em cada ponto, o valor exato
    const c = spec.torqueCurve;
    for (let i = 0; i < c.length; i++) {
      expect(torqueAt(spec, c[i]![0]), `point ${c[i]![0]}`).toBe(c[i]![1]);
      if (i === 0) continue;
      const mid = (c[i - 1]![0] + c[i]![0]) / 2;
      expect(torqueAt(spec, mid), `mid ${mid}`).toBeCloseTo((c[i - 1]![1] + c[i]![1]) / 2, 9);
    }

    // limitador: rpm >= redline dá força zero (a 6ª não troca; na 1ª a troca está segurada)
    // (7000 exato por speedFor volta como 6999.999...; 7000.01 garante rpm >= redline em ponto flutuante)
    for (const rpm of [7000.01, 7500]) {
      const r = stepDrivetrain(spec, settled({ gear: 6 }), { ...idle, throttle: true }, speedFor(6, rpm), DT);
      expect(r.state.rpm, `6th at ${rpm}`).toBe(7000);
      expect(r.cmd.engineForce, `6th at ${rpm}`).toBe(0);
    }
    const first = stepDrivetrain(spec, settled({ gear: 1, lastShiftAgo: 0.1 }), { ...idle, throttle: true }, 60, DT);
    expect(first.state.gear).toBe(1);
    expect(first.cmd.engineForce).toBe(0);

    // sem acelerador: freio-motor, nunca força positiva
    for (let gear = 1; gear <= 6; gear++) {
      for (let v = 0; v <= 70; v += 2.5) {
        const r = stepDrivetrain(spec, settled({ gear, lastShiftAgo: 0 }), idle, v, DT);
        expect(r.cmd.engineForce, `gear ${gear} v ${v}`).toBeLessThanOrEqual(0);
      }
    }
  });

  // C16 (AC 15) - substitui free-roam-city C28
  it('rpm from wheel speed and gear', () => {
    const rpmOf = (s: DrivetrainState, input: DriveInput, v: number): number =>
      stepDrivetrain(spec, s, input, v, DT).state.rpm;
    const wheel3 = (20 / spec.wheelRadiusM) * (60 / (2 * Math.PI)) * spec.gearRatios[2]! * spec.finalDrive;
    expect(Math.abs(rpmOf(settled({ gear: 3 }), idle, 20) - Math.max(1000, wheel3))).toBeLessThanOrEqual(1e-6);
    expect(rpmOf(settled({ gear: 2 }), idle, 0)).toBe(1000);
    expect(rpmOf(settled({ gear: 1 }), { ...idle, throttle: true }, 1)).toBeGreaterThanOrEqual(2500);
    expect(rpmOf(settled({ gear: -1 }), { ...idle, brake: true }, -1)).toBeGreaterThanOrEqual(2500);
    expect(rpmOf(settled({ gear: 1 }), idle, 60)).toBe(7000);

    const inputs: DriveInput[] = [idle, { ...idle, throttle: true }, { ...idle, brake: true }];
    for (const gear of [-1, 1, 2, 3, 4, 5, 6]) {
      for (const input of inputs) {
        for (let v = -10; v <= 80; v += 0.5) {
          const rpm = rpmOf(settled({ gear }), input, v);
          expect(rpm, `gear ${gear} v ${v}`).toBeGreaterThanOrEqual(1000);
          expect(rpm, `gear ${gear} v ${v}`).toBeLessThanOrEqual(7000);
        }
      }
    }
  });

  // C17 (AC 16, door 2) - substitui free-roam-city C27 junto com C18
  it('upshift at 6500 rpm with power cut', () => {
    const throttle = { ...idle, throttle: true };
    const v = speedFor(2, 6600);
    let r = stepDrivetrain(spec, settled({ gear: 2 }), throttle, v, DT);
    expect(r.state.gear).toBe(3);
    expect(r.state.shiftTimer).toBe(0.25);
    for (let i = 1; i <= 15; i++) {
      r = stepDrivetrain(spec, r.state, throttle, v, DT);
      expect(r.cmd.engineForce, `step ${i} after the shift`).toBe(0);
    }
    r = stepDrivetrain(spec, r.state, throttle, v, DT);
    expect(r.state.gear).toBe(3);
    expect(r.cmd.engineForce).toBeGreaterThan(0);

    const sixth = stepDrivetrain(spec, settled({ gear: 6 }), throttle, speedFor(6, 6700), DT);
    expect(sixth.state.gear).toBe(6);
  });

  // C18 (AC 17, door 2) - substitui free-roam-city C27 junto com C17
  it('downshift with hysteresis and hold time', () => {
    const v4 = speedFor(4, 2600);
    for (const hold of [0.6, 1]) {
      const r = stepDrivetrain(spec, settled({ gear: 4, lastShiftAgo: hold }), idle, v4, DT);
      expect(r.state.gear, `hold ${hold}`).toBe(3);
      expect(r.state.rpm).toBeLessThan(6500);
    }

    // 3ª longe da 4ª: descer daria >= 6500 rpm, então fica na 4ª
    const wide = { ...spec, gearRatios: [6, 5, 4, 1.5, 1.1, 0.9] };
    const vw = speedFor(4, 2600, wide);
    expect(speedFor(3, 6500, wide)).toBeLessThanOrEqual(vw);
    const blocked = stepDrivetrain(wide, settled({ gear: 4 }), idle, vw, DT);
    expect(blocked.state.gear).toBe(4);

    // a menos de 0.6 s da troca anterior, nada muda
    const upHeld = stepDrivetrain(
      spec,
      settled({ gear: 2, lastShiftAgo: 0.5 }),
      { ...idle, throttle: true },
      speedFor(2, 6600),
      DT,
    );
    expect(upHeld.state.gear).toBe(2);
    const downHeld = stepDrivetrain(spec, settled({ gear: 4, lastShiftAgo: 0.5 }), idle, v4, DT);
    expect(downHeld.state.gear).toBe(4);

    // da 1ª não desce
    for (const v of [0, 1, 2]) {
      expect(stepDrivetrain(spec, settled({ gear: 1 }), idle, v, DT).state.gear, `v ${v}`).toBe(1);
    }
  });

  // C20, parte unitária (AC 19) - substitui free-roam-city C8
  it('no speed cut below redline', () => {
    const r = stepDrivetrain(spec, settled({ gear: 6 }), { ...idle, throttle: true }, 230 / 3.6, DT);
    expect(r.state.gear).toBe(6);
    expect(r.state.rpm).toBeLessThan(7000);
    expect(r.cmd.engineForce).toBeGreaterThan(0);
  });

  // C24 (free-roam-city AC 3, door 2) - substitui free-roam-city C4
  it('reverse gear capped at 30 kmh', () => {
    const brake = { ...idle, brake: true };
    for (const kmh of [1, 0, -0.5]) {
      const r = stepDrivetrain(spec, settled({ gear: 1 }), brake, kmh / 3.6, DT);
      expect(r.state.gear, `${kmh} km/h`).toBe(-1);
      expect(r.cmd.engineForce, `${kmh} km/h`).toBeLessThan(0);
    }
    expect(stepDrivetrain(spec, settled({ gear: -1 }), brake, -29 / 3.6, DT).cmd.engineForce).toBeLessThan(0);
    expect(stepDrivetrain(spec, settled({ gear: -1 }), brake, -30 / 3.6, DT).cmd.engineForce).toBe(0);
    expect(stepDrivetrain(spec, settled({ gear: -1 }), brake, -31 / 3.6, DT).cmd.engineForce).toBe(0);
    for (const kmh of [-1, 0, 0.5]) {
      const r = stepDrivetrain(spec, settled({ gear: -1 }), { ...idle, throttle: true }, kmh / 3.6, DT);
      expect(r.state.gear, `${kmh} km/h`).toBe(1);
    }
  });

  // C25 (free-roam-city AC 5) - substitui free-roam-city C7
  it('handbrake locks rear and cuts rear grip', () => {
    const { cmd } = stepDrivetrain(spec, settled({ gear: 3 }), { ...idle, handbrake: true }, 60 / 3.6, DT);
    expect(cmd.brakeFront).toBe(0);
    expect(cmd.brakeRear).toBeGreaterThan(0);
    expect(spec.handbrakeRearGrip).toBe(0.4);
    expect(cmd.rearFrictionFactor).toBe(spec.handbrakeRearGrip);
    expect(stepDrivetrain(spec, settled({ gear: 3 }), idle, 60 / 3.6, DT).cmd.rearFrictionFactor).toBe(1);
  });

  // C36 - decisão do usuário (2026-09-26): acelerador + freio de mão mantém a força do motor (power slide)
  it('handbrake with throttle keeps engine force', () => {
    const v = speedFor(3, 4500);
    const drive = stepDrivetrain(spec, settled({ gear: 3 }), { ...idle, throttle: true }, v, DT).cmd;
    const slide = stepDrivetrain(spec, settled({ gear: 3 }), { ...idle, throttle: true, handbrake: true }, v, DT).cmd;
    expect(drive.engineForce).toBeGreaterThan(0);
    expect(slide.engineForce).toBe(drive.engineForce);
    expect(slide.brakeFront).toBe(0);
    expect(slide.brakeRear).toBeGreaterThan(0);
    expect(slide.rearFrictionFactor).toBe(spec.handbrakeRearGrip);
    // sem acelerador, nem motor nem freio-motor
    expect(stepDrivetrain(spec, settled({ gear: 3 }), { ...idle, handbrake: true }, v, DT).cmd.engineForce).toBe(0);
  });

  // C37 - freio de serviço com a ré engatada: acelerador andando para trás, ou S andando para frente
  it('service brake while in reverse gear', () => {
    const both = spec.brakeForceN;
    const back = stepDrivetrain(spec, settled({ gear: -1 }), { ...idle, throttle: true }, -10 / 3.6, DT);
    expect(back.state.gear).toBe(-1);
    expect(back.cmd.engineForce).toBe(0);
    expect(back.cmd.brakeFront + back.cmd.brakeRear).toBeCloseTo(both, 9);
    expect(back.cmd.brakeFront / both).toBeCloseTo(spec.brakeBiasFront, 9);
    const fwd = stepDrivetrain(spec, settled({ gear: -1 }), { ...idle, brake: true }, 5 / 3.6, DT);
    expect(fwd.cmd.engineForce).toBe(0);
    expect(fwd.cmd.brakeFront + fwd.cmd.brakeRear).toBeCloseTo(both, 9);
  });

  // C26 (door 2)
  it('drivetrain step is pure', () => {
    const cases: Array<[DrivetrainState, DriveInput, number]> = [
      [settled({ gear: 2 }), { ...idle, throttle: true, steer: 1 }, speedFor(2, 6600)],
      [settled({ gear: 4, steer: 0.3 }), { ...idle, brake: true, steer: -1 }, 20],
      [settled({ gear: -1 }), { ...idle, brake: true }, -3],
      [settled({ gear: 3, shiftTimer: 0.1 }), { ...idle, handbrake: true }, 15],
    ];
    for (const [state, input, v] of cases) {
      const frozen = Object.freeze({ ...state });
      const copy = { ...state };
      const a = stepDrivetrain(spec, frozen, input, v, DT);
      const b = stepDrivetrain(spec, frozen, input, v, DT);
      expect(a).toEqual(b);
      expect(frozen).toEqual(copy);
    }
    expect('computeDrive' in drivetrain).toBe(false);
    expect('gearFor' in drivetrain).toBe(false);
    expect('rpmFor' in drivetrain).toBe(false);
  });
});
