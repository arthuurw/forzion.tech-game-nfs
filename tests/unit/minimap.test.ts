import { describe, expect, it } from 'vitest';
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
});
