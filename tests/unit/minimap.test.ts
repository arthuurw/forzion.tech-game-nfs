import { describe, expect, it } from 'vitest';
import { Minimap } from '../../src/hud/Minimap';
import {
  MINIMAP_GATE_COLOR,
  MINIMAP_MARKER_COLOR,
  MINIMAP_SIZE_PX,
  MINIMAP_WINDOW_M,
  minimapRaceMarks,
  minimapSegments,
  worldToMinimap,
} from '../../src/hud/minimapMath';

describe('minimap math', () => {
  // C30 (AC 23)
  it('320 m window into 160 px', () => {
    expect(MINIMAP_SIZE_PX).toBe(160);
    expect(MINIMAP_WINDOW_M).toBe(320);
    const car = { x: 10, z: -40 };
    expect(worldToMinimap(10, -40, car)).toEqual({ x: 80, y: 80 });
    expect(worldToMinimap(170, -40, car)).toEqual({ x: 160, y: 80 });
    expect(worldToMinimap(10, -200, car)).toEqual({ x: 80, y: 0 });
  });

  // city-terrain C41 (AC 34)
  it('road segments inside the 320 m window', () => {
    const road = (pts: number[], closed = false) => ({ closed, points: new Float32Array(pts) });
    const network = {
      roads: [
        // dentro da janela: 2 segmentos
        road([0, 0, 0, 2, 0, 0, 4, 0, 0]),
        // cruzando a borda: só o segmento com uma ponta dentro conta
        road([150, 0, 0, 170, 0, 0, 190, 0, 0]),
        // fora da janela
        road([500, 0, 500, 502, 0, 500]),
      ],
    };
    const car = { x: 0, z: 0 };
    const segs = minimapSegments(network, car);
    expect(segs).toEqual([
      [80, 80, 81, 80],
      [81, 80, 82, 80],
      [155, 80, 165, 80],
    ]);
    // carro a mais de 400 m de qualquer estrada: nada
    expect(minimapSegments(network, { x: -1000, z: -1000 })).toEqual([]);
  });

  // races C9 (AC 7)
  it('race marker icons inside the window only', () => {
    const car = { x: 0, z: 0 };
    const marks = minimapRaceMarks(car, {
      markers: [
        { x: 100, z: 0 },
        { x: -160, z: 160 },
        { x: 161, z: 0 },
        { x: 0, z: -500 },
      ],
    });
    expect(marks).toEqual([
      { kind: 'marker', x: 130, y: 80, color: MINIMAP_MARKER_COLOR },
      { kind: 'marker', x: 0, y: 160, color: MINIMAP_MARKER_COLOR },
    ]);
  });

  // races C14 (AC 12)
  it('next gate on the minimap', () => {
    const car = { x: 10, z: 10 };
    expect(minimapRaceMarks(car, { gate: { x: 30, z: 50 } })).toEqual([{ kind: 'gate', x: 90, y: 100, color: MINIMAP_GATE_COLOR }]);
    expect(minimapRaceMarks(car, { gate: { x: 400, z: 50 } })).toEqual([]);
    expect(minimapRaceMarks(car, { gate: null })).toEqual([]);
  });

  // races C24 (AC 22)
  it('opponent dots in their paint', () => {
    const car = { x: 0, z: 0 };
    const marks = minimapRaceMarks(car, {
      opponents: [
        { x: 20, z: 0, color: '#2f8cff' },
        { x: 0, z: 200, color: '#ffd23f' },
        { x: -40, z: -40, color: '#3fe07a' },
      ],
    });
    expect(marks).toEqual([
      { kind: 'opponent', x: 90, y: 80, color: '#2f8cff' },
      { kind: 'opponent', x: 60, y: 60, color: '#3fe07a' },
    ]);
  });

  // smooth-world C23 (AC 18): no máximo 30 redesenhos por segundo de simulação; mudança da corrida redesenha já
  it('minimap redraws at most 30 times per second', () => {
    // canvas falso: cada redesenho começa com um `clearRect`
    let clears = 0;
    const noop = () => {};
    const ctx = new Proxy({ clearRect: () => clears++ } as Record<string, unknown>, {
      get: (target, key) => (key in target ? target[key as string] : noop),
      set: () => true,
    });
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
    const network = { roads: [{ closed: false, points: new Float32Array([0, 0, 0, 2, 0, 0]) }] } as never;
    const map = new Minimap(canvas, network);
    const state = { x: 0, y: 0, z: 0, heading: 0, speedMs: 0, speedKmh: 0, gear: 1, rpm: 900 };
    // 1 s de simulação a 60 passos, um `update` por passo, com o relógio somado passo a passo
    let t = 0;
    for (let k = 0; k < 60; k++) {
      map.update(state, [], t, 'free');
      t += 1 / 60;
    }
    expect(clears).toBe(30);
    // logo abaixo e logo acima de 1/30 s desde o último desenho (em t = 58/60)
    const last = 58 / 60;
    map.update(state, [], last + 1 / 30 - 0.001, 'free');
    expect(clears).toBe(30);
    map.update(state, [], last + 1 / 30, 'free');
    expect(clears).toBe(31);
    // a corrida muda dentro do intervalo: redesenha nesse mesmo quadro, e o seguinte volta ao teto
    const now = last + 1 / 30;
    map.update(state, [], now + 1 / 60, 'countdown');
    expect(clears).toBe(32);
    map.update(state, [], now + 2 / 60, 'countdown');
    expect(clears).toBe(32);
    map.update(state, [], now + 2.5 / 60, 'racing');
    expect(clears).toBe(33);
    expect(map.draws).toBe(33);
  });
});
