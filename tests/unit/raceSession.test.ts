import { describe, expect, it } from 'vitest';
import { createProgress, stepProgress } from '../../src/race/raceProgress';
import { generateRaces, widthAt, type RaceDef, type RaceGate } from '../../src/race/raceRoutes';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';
import {
  countdownText,
  createSession,
  inputFor,
  onEnter,
  onEscape,
  promptFor,
  raceClock,
  resetTarget,
  STOP_KMH,
  stopInput,
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
    // play-fixes AC 12: com portão, o lugar do grid montado atrás dele (slot 3 = fileira 16 m, à direita)
    const t = resetTarget(race, 1);
    expect(t.x).toBeCloseTo(-3, 9);
    expect(t.y).toBeCloseTo(0, 9);
    expect(t.z).toBeCloseTo(184, 9);
    expect(t.heading).toBeCloseTo(0, 9);
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

  // play-fixes C13 (AC 9)
  it('stop input after the finish', () => {
    const ai = { throttle: true, brake: false, steer: -1, handbrake: false };
    const forward = { throttle: false, brake: true, steer: -1, handbrake: false };
    const backward = { throttle: true, brake: false, steer: -1, handbrake: false };
    const hold = { throttle: false, brake: false, steer: 0, handbrake: true };
    expect(STOP_KMH).toBe(5);
    const rows: Array<[number, typeof hold]> = [
      [120, forward],
      [5.01, forward],
      [4.99, hold],
      [0, hold],
      [-4.99, hold],
      [-5.01, backward],
      [-20, backward],
    ];
    for (const [kmh, want] of rows) expect(stopInput(ai, kmh), `${kmh} km/h`).toEqual(want);
  });

  // play-fixes C17 (AC 12)
  it('gate reset spreads the four slots like the grid', () => {
    const raw = generateTerrain(1337);
    const network = generateRoads(1337, raw);
    const races = generateRaces(network);
    expect(races.map((r) => r.id)).toEqual(['circuito-centro', 'circuito-anel', 'sprint-cruzada', 'sprint-morro']);
    /** cantos da caixa do chassi (meia medida 0.9 × 2.1 m) orientada pelo heading */
    const corners = (p: { x: number; z: number; heading: number }) => {
      const f = { x: Math.sin(p.heading), z: Math.cos(p.heading) };
      const r = { x: -Math.cos(p.heading), z: Math.sin(p.heading) };
      return [
        [1, 1],
        [1, -1],
        [-1, -1],
        [-1, 1],
      ].map(([a, b]) => ({ x: p.x + f.x * 2.1 * a! + r.x * 0.9 * b!, z: p.z + f.z * 2.1 * a! + r.z * 0.9 * b! }));
    };
    /** separação por eixos (SAT) entre duas caixas orientadas */
    const overlap = (a: ReturnType<typeof corners>, b: ReturnType<typeof corners>) => {
      for (const poly of [a, b]) {
        for (let i = 0; i < 4; i++) {
          const e = { x: poly[(i + 1) % 4]!.x - poly[i]!.x, z: poly[(i + 1) % 4]!.z - poly[i]!.z };
          const n = { x: -e.z, z: e.x };
          const pa = a.map((c) => c.x * n.x + c.z * n.z);
          const pb = b.map((c) => c.x * n.x + c.z * n.z);
          if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
        }
      }
      return true;
    };
    const distToRoute = (r: RaceDef, x: number, z: number) => {
      const p = r.route.points;
      const n = p.length / 3;
      let best = Infinity;
      for (let i = 0; i < (r.route.closed ? n : n - 1); i++) {
        const j = (i + 1) % n;
        const dx = p[j * 3]! - p[i * 3]!;
        const dz = p[j * 3 + 2]! - p[i * 3 + 2]!;
        const l2 = dx * dx + dz * dz;
        const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - p[i * 3]!) * dx + (z - p[i * 3 + 2]!) * dz) / l2)) : 0;
        best = Math.min(best, Math.hypot(x - p[i * 3]! - dx * t, z - p[i * 3 + 2]! - dz * t));
      }
      return best;
    };
    let checked = 0;
    for (const r of races) {
      for (let g = 0; g < r.gates.length; g++) {
        const targets = [0, 1, 2, 3].map((slot) => resetTarget(r, g, slot));
        const boxes = targets.map(corners);
        for (let a = 0; a < 4; a++) {
          const t = targets[a]!;
          const label = `${r.id} portão ${g} slot ${a}`;
          expect(distToRoute(r, t.x, t.z), label).toBeLessThanOrEqual(widthAt(network, t.x, t.z) / 2 - 1);
          for (let b = a + 1; b < 4; b++) {
            expect(Math.hypot(t.x - targets[b]!.x, t.z - targets[b]!.z), `${label} x ${b}`).toBeGreaterThan(0);
            expect(overlap(boxes[a]!, boxes[b]!), `${label} x ${b}`).toBe(false);
          }
          checked++;
        }
      }
    }
    expect(checked).toBe(4 * races.reduce((n, r) => n + r.gates.length, 0));
  });
});
