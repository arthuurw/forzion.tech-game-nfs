import { describe, expect, it } from 'vitest';
import { createProgress, stepProgress } from '../../src/race/raceProgress';
import type { RaceDef, RaceGate } from '../../src/race/raceRoutes';
import {
  countdownText,
  createSession,
  inputFor,
  onEnter,
  onEscape,
  promptFor,
  raceClock,
  resetTarget,
  tickSession,
  type Session,
} from '../../src/race/raceSession';

// races C10, C13, C18, C29, C32: sessão pura
const DT = 1 / 60;
const gate = (z: number, s: number): RaceGate => ({ x: 0, y: 1, z, heading: 0.2, halfWidth: 12, s });
const race: RaceDef = {
  id: 'teste',
  name: 'Teste',
  kind: 'sprint',
  laps: 1,
  route: { points: new Float32Array([0, 0, 0, 0, 0, 300]), closed: false, length: 300 },
  gates: [gate(100, 100), gate(200, 200)],
  grid: [0, 1, 2, 3].map((k) => ({ x: k * 6, y: 2, z: -10, heading: 0.1 })),
  marker: { x: 0, z: 0, radius: 10 },
};

describe('race session', () => {
  // C10
  it('prompt only within 10 m below 30 kmh', () => {
    const m = [{ x: 0, z: 0, radius: 10 }];
    expect(promptFor({ x: 10, z: 0 }, 29.9, m)).toBe(0);
    expect(promptFor({ x: 10.01, z: 0 }, 0, m)).toBeNull();
    expect(promptFor({ x: 0, z: 0 }, 30.0, m)).toBeNull();
    const two = [
      { x: 0, z: 0, radius: 10 },
      { x: 8, z: 0, radius: 10 },
    ];
    expect(promptFor({ x: 5, z: 0 }, 0, two)).toBe(1);
    expect(promptFor({ x: 3, z: 0 }, 0, two)).toBe(0);
  });

  // C13
  it('countdown 3 2 1 GO then racing', () => {
    let s = onEnter(createSession(), 0);
    expect(s.state).toBe('countdown');
    const texts: Record<number, string> = {};
    for (let k = 0; k < 180; k++) {
      texts[k] = countdownText(k * DT);
      expect(s.state, `step ${k}`).toBe('countdown');
      expect(raceClock(s, DT)).toBe(0);
      s = tickSession(s, DT, false);
    }
    expect(texts[0]).toBe('3');
    expect(texts[59]).toBe('3');
    expect(texts[60]).toBe('2');
    expect(texts[119]).toBe('2');
    expect(texts[120]).toBe('1');
    expect(texts[179]).toBe('1');
    expect(countdownText(3.0)).toBe('GO');
    expect(s.state).toBe('racing');
    expect(raceClock(s, DT)).toBe(0);
    // na contagem o carro recebe freio de mão, sem acelerador e sem volante
    const held = inputFor({ state: 'countdown', race: 0, steps: 10 }, { throttle: true, brake: false, steer: 1, handbrake: false });
    expect(held).toEqual({ throttle: false, brake: false, steer: 0, handbrake: true });
    const free = inputFor({ state: 'racing', race: 0, steps: 10 }, { throttle: true, brake: false, steer: 1, handbrake: false });
    expect(free).toEqual({ throttle: true, brake: false, steer: 1, handbrake: false });
  });

  // C18
  it('player finish freezes time and finishes the session', () => {
    let s: Session = { state: 'racing', race: 0, steps: 0 };
    const p = createProgress();
    for (let k = 0; k < 600; k++) s = tickSession(s, DT, p.finished);
    stepProgress(p, race, { x: 0, z: 99 }, { x: 0, z: 101 }, raceClock(s, DT));
    stepProgress(p, race, { x: 0, z: 199 }, { x: 0, z: 201 }, raceClock(s, DT));
    expect(p.finished).toBe(true);
    expect(p.finishTime).toBeCloseTo(10, 9);
    s = tickSession(s, DT, p.finished);
    expect(s.state).toBe('finished');
    for (let k = 0; k < 60; k++) {
      s = tickSession(s, DT, p.finished);
      stepProgress(p, race, { x: 0, z: 199 }, { x: 0, z: 201 }, raceClock(s, DT));
    }
    expect(p.finishTime).toBeCloseTo(10, 9);
    expect(s.state).toBe('finished');
  });

  // C29
  it('reset target is last gate or grid slot', () => {
    expect(resetTarget(race, -1)).toEqual({ x: 18, y: 2, z: -10, heading: 0.1 });
    expect(resetTarget(race, -1, 1)).toEqual({ x: 6, y: 2, z: -10, heading: 0.1 });
    expect(resetTarget(race, 1)).toEqual({ x: 0, y: 1, z: 200, heading: 0.2 });
  });

  // C32
  it('session transitions on enter and escape', () => {
    const free = createSession();
    const countdown: Session = { state: 'countdown', race: 2, steps: 30 };
    const racing: Session = { state: 'racing', race: 2, steps: 30 };
    const finished: Session = { state: 'finished', race: 2, steps: 30 };
    // Enter
    expect(onEnter(free, 1)).toEqual({ state: 'countdown', race: 1, steps: 0 });
    expect(onEnter(free, null)).toEqual(free);
    expect(onEnter(countdown, 0)).toEqual(countdown);
    expect(onEnter(racing, 0)).toEqual(racing);
    expect(onEnter(finished, null)).toEqual(createSession());
    // Escape
    expect(onEscape(free)).toEqual(free);
    expect(onEscape(countdown)).toEqual(createSession());
    expect(onEscape(racing)).toEqual(createSession());
    expect(onEscape(finished)).toEqual(finished);
  });
});
