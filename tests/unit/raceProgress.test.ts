import { describe, expect, it } from 'vitest';
import {
  clockAfter,
  createProgress,
  formatRaceTime,
  lapLabel,
  resultRows,
  standings,
  stepProgress,
  type RacerProgress,
  type Standing,
} from '../../src/race/raceProgress';
import type { RaceDef, RaceGate } from '../../src/race/raceRoutes';

// races C15-C17, C26, C27: progresso puro sobre corridas sintéticas em linha reta ao longo de +z
const gate = (z: number, s: number): RaceGate => ({ x: 0, y: 0, z, heading: 0, halfWidth: 12, s });

function race(kind: 'sprint' | 'circuit', laps: number): RaceDef {
  return {
    id: 'teste',
    name: 'Teste',
    kind,
    laps,
    route: { points: new Float32Array([0, 0, 0, 0, 0, 400]), closed: kind === 'circuit', length: 400 },
    gates: [gate(100, 100), gate(200, 200), gate(300, 300)],
    grid: [],
    marker: { x: 0, z: 0, radius: 10 },
  };
}

const cross = (p: RacerProgress, r: RaceDef, z: number, x = 0, t = 0) =>
  stepProgress(p, r, { x, z: z - 0.5 }, { x, z: z + 0.5 }, t);

describe('race progress', () => {
  // C15
  it('gate crossing rules', () => {
    const r = race('sprint', 1);
    // para a frente, dentro da meia largura (11.9 m de lado): avança
    const a = createProgress();
    expect(cross(a, r, 100, 11.9)).toBe(true);
    expect(a.nextGate).toBe(1);
    expect(a.lastGate).toBe(0);
    // 0.1 m fora da meia largura: não avança
    const b = createProgress();
    expect(cross(b, r, 100, 12.1)).toBe(false);
    expect(b.nextGate).toBe(0);
    // o portão seguinte ao próximo: não avança
    const c = createProgress();
    expect(cross(c, r, 200)).toBe(false);
    expect(c.nextGate).toBe(0);
    // o próximo, de ré: não avança
    const d = createProgress();
    expect(stepProgress(d, r, { x: 0, z: 100.5 }, { x: 0, z: 99.5 }, 0)).toBe(false);
    expect(d.nextGate).toBe(0);
    // para 0.1 m antes do portão: não avança
    const e = createProgress();
    expect(stepProgress(e, r, { x: 0, z: 99 }, { x: 0, z: 99.9 }, 0)).toBe(false);
    expect(e.nextGate).toBe(0);
  });

  // C16
  it('clock sums fixed steps and formats m:ss.cc', () => {
    for (const n of [0, 1, 60, 3600, 12345]) expect(Math.abs(clockAfter(n, 1 / 60) - n / 60)).toBeLessThanOrEqual(1e-9);
    expect(formatRaceTime(0)).toBe('0:00.00');
    expect(formatRaceTime(61.239)).toBe('1:01.23');
    expect(formatRaceTime(599.999)).toBe('9:59.99');
  });

  // C17
  it('lap counts only after every gate', () => {
    const r = race('circuit', 2);
    const p = createProgress();
    // a linha de largada/chegada (último portão) antes dos outros: nada
    expect(cross(p, r, 300)).toBe(false);
    expect(p.lap).toBe(1);
    expect(lapLabel(p.lap, r.laps)).toBe('VOLTA 1/2');
    cross(p, r, 100);
    cross(p, r, 200);
    expect(p.lap).toBe(1);
    cross(p, r, 300);
    expect(p.lap).toBe(2);
    expect(p.nextGate).toBe(0);
    expect(lapLabel(p.lap, r.laps)).toBe('VOLTA 2/2');
  });

  // C26
  it('standings order by finish lap gate distance', () => {
    const prog = (o: Partial<RacerProgress>): RacerProgress => ({ ...createProgress(), ...o });
    const st = (racer: number, progress: RacerProgress, distance = 0): Standing => ({ racer, progress, distance });
    const order = (list: Standing[]) => standings(list).map((s) => s.racer);
    // dois terminados: menor tempo na frente
    expect(order([st(0, prog({ finished: true, finishTime: 90 })), st(1, prog({ finished: true, finishTime: 80 }))])).toEqual([1, 0]);
    // terminado na frente de não terminado, mesmo com volta maior
    expect(order([st(0, prog({ lap: 3 })), st(1, prog({ finished: true, finishTime: 200, lap: 1 }))])).toEqual([1, 0]);
    // volta 2 na frente de volta 1
    expect(order([st(0, prog({ lap: 1, nextGate: 9 })), st(1, prog({ lap: 2, nextGate: 0 }))])).toEqual([1, 0]);
    // mesma volta: portão 7 na frente de 5
    expect(order([st(0, prog({ nextGate: 5 }), 1), st(1, prog({ nextGate: 7 }), 100)])).toEqual([1, 0]);
    // mesma volta e portão: 12 m na frente de 30 m
    expect(order([st(0, prog({ nextGate: 4 }), 30), st(1, prog({ nextGate: 4 }), 12)])).toEqual([1, 0]);
  });

  // C27
  it('result rows with times and dashes', () => {
    const names = ['Bia', 'Caio', 'Duda', 'VOCÊ'];
    const done = (t: number): RacerProgress => ({ ...createProgress(), finished: true, finishTime: t });
    const rows = resultRows(
      [
        { racer: 0, progress: { ...createProgress(), nextGate: 3 }, distance: 50 },
        { racer: 1, progress: done(125.5), distance: 0 },
        { racer: 2, progress: { ...createProgress(), nextGate: 5 }, distance: 10 },
        { racer: 3, progress: done(121.349), distance: 0 },
      ],
      names,
    );
    expect(rows).toEqual([
      { position: 1, name: 'VOCÊ', time: '2:01.34' },
      { position: 2, name: 'Caio', time: '2:05.50' },
      { position: 3, name: 'Duda', time: '--:--.--' },
      { position: 4, name: 'Bia', time: '--:--.--' },
    ]);
  });
});
