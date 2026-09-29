import { describe, expect, it } from 'vitest';
import {
  AI_OFFSETS,
  AI_PAINTS,
  AI_SKILLS,
  checkStuck,
  cornerSpeed,
  createAiState,
  prepareRoute,
  restartStuck,
  targetSpeed,
} from '../../src/race/aiDriver';
import type { RaceDef } from '../../src/race/raceRoutes';
import { resetTarget } from '../../src/race/raceSession';

// races C21, C23: piloto dos oponentes, puro

/** círculo de raio 50 m com ponto a cada ~2 m */
function circle(r: number): RaceDef['route'] {
  const n = Math.round((2 * Math.PI * r) / 2);
  const points = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    points.set([Math.cos(t) * r, 0, Math.sin(t) * r], i * 3);
  }
  return { points, closed: true, length: 2 * Math.PI * r };
}

describe('ai driver', () => {
  // C21
  it('skills offsets and paints', () => {
    expect([...AI_SKILLS]).toEqual([0.8, 0.88, 0.95]);
    expect([...AI_OFFSETS]).toEqual([-3, 0, 3]);
    const paints = AI_PAINTS.map((c) => c.toLowerCase());
    expect(new Set(paints).size).toBe(3);
    expect(paints).not.toContain('#ff4d1a');
    // na mesma curva de raio 50 m, habilidade maior pede mais velocidade
    const route = prepareRoute(circle(50));
    const v = AI_SKILLS.map((k) => targetSpeed(route, 10, k, 20));
    expect(v[2]).toBeGreaterThan(v[1]!);
    expect(v[1]).toBeGreaterThan(v[0]!);
    expect(cornerSpeed(50, 0.95)).toBeGreaterThan(cornerSpeed(50, 0.88));
    expect(cornerSpeed(50, 0.88)).toBeGreaterThan(cornerSpeed(50, 0.8));
  });

  // C23
  it('stuck detector thresholds and target', () => {
    const run = (moved: number, y = 0) => {
      const ai = createAiState();
      ai.progress = 100;
      restartStuck(ai, 0); // começa a janela em t = 0, s = 100
      ai.progress = 100 + moved;
      return checkStuck(ai, 4, y);
    };
    expect(run(4.9)).toBe(true);
    expect(run(5.1)).toBe(false);
    // test-hardening C16 (AC 13): os dois lados da janela de 4 s, com o mesmo progresso de 4.9 m
    const at = (t: number) => {
      const ai = createAiState();
      ai.progress = 100;
      restartStuck(ai, 0);
      ai.progress = 104.9;
      return checkStuck(ai, t, 0);
    };
    expect(at(3.99)).toBe(false);
    expect(at(4.0)).toBe(true);
    // na água dispara na hora, sem esperar a janela
    const wet = createAiState();
    expect(checkStuck(wet, 0.5, -1.51)).toBe(true);
    const dry = createAiState();
    expect(checkStuck(dry, 0.5, -1.49)).toBe(false);
    // o alvo é o último portão cruzado, ou o lugar do oponente no grid
    const race: RaceDef = {
      id: 't',
      name: 'T',
      kind: 'sprint',
      laps: 1,
      route: { points: new Float32Array([0, 0, 0, 0, 0, 100]), closed: false, length: 100 },
      gates: [{ x: 0, y: 0, z: 50, heading: 0, halfWidth: 12, s: 50 }],
      grid: [0, 1, 2, 3].map((k) => ({ x: k, y: 0, z: -10, heading: 0 })),
      marker: { x: 0, z: 0, radius: 10 },
    };
    expect(resetTarget(race, -1, 2)).toEqual({ x: 2, y: 0, z: -10, heading: 0 });
    expect(resetTarget(race, 0, 2)).toEqual({ x: 0, y: 0, z: 50, heading: 0 });
  });
});
