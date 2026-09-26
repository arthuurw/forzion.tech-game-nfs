import { describe, expect, it } from 'vitest';
import { findBlockInteriors } from '../../src/world/interiors/BlockInteriors';
import { placeInteriorProps } from '../../src/world/interiors/InteriorProps';
import {
  bounceWeight,
  bulbOffset,
  bulbSway,
  crownSway,
  fireflyMotion,
  terrainColor,
  terrainNoise,
  zoneLight,
} from '../../src/world/interiors/interiorMotion';
import { generateLots } from '../../src/world/lots/LotGenerator';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';

const raw = generateTerrain(1337);
const network = generateRoads(1337, raw);
const carved = carveRoads(raw, network);
const { lots } = generateLots(1337, network, carved);
const interiors = findBlockInteriors(carved, network, lots);
const props = placeInteriorProps(1337, interiors, lots, carved);

/** '#rrggbb' em RGB linear pela curva sRGB padrão (IEC 61966-2-1). */
function linear(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return [f(((v >> 16) & 255) / 255), f(((v >> 8) & 255) / 255), f((v & 255) / 255)];
}

function expectColor(actual: number[], expected: number[]): void {
  for (let i = 0; i < 3; i++) expect(Math.abs(actual[i]! - expected[i]!)).toBeLessThanOrEqual(1e-6);
}

const DT = 1 / 60;

describe('interior motion', () => {
  // C8 (AC 7, AC 8)
  it('terrain color', () => {
    const grass = linear('#3f5e36');
    const rock = linear('#4d473d');
    const sand = linear('#5a5242');
    const patio = linear('#55555a');
    expectColor(terrainColor(10, 0, 0, 'outer'), grass);
    expectColor(terrainColor(10, 0, 0, 'none'), grass);
    expectColor(terrainColor(10, 0, 1, 'outer'), grass.map((c) => c * 1.08));
    expectColor(terrainColor(10, 0, -1, 'outer'), grass.map((c) => c * 0.92));
    expectColor(terrainColor(10, 0.4, 0, 'outer'), rock);
    expectColor(terrainColor(0.5, 0, 0, 'outer'), grass.map((c, i) => (c + sand[i]!) / 2));
    expectColor(terrainColor(10, 0, 0, 'downtown'), patio);

    // ruído do seed sempre em [−1, 1] (10 000 pontos)
    let s = 7;
    const rand = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 10_000; i++) {
      const n = terrainNoise(1337, (rand() - 0.5) * 3072, (rand() - 0.5) * 3072);
      lo = Math.min(lo, n);
      hi = Math.max(hi, n);
    }
    expect(lo).toBeGreaterThanOrEqual(-1);
    expect(hi).toBeLessThanOrEqual(1);
    // varia de verdade (não é constante)
    expect(hi - lo).toBeGreaterThan(0.5);
  });

  // C10 (AC 9) - parte pura
  it('bounce weight', () => {
    expect(bounceWeight(-1, 0)).toBe(0);
    expect(bounceWeight(3, 0)).toBeCloseTo(1, 12);
    expect(bounceWeight(3, 12.5)).toBeCloseTo(0.5, 12);
    expect(bounceWeight(3, 25)).toBeCloseTo(0, 12);
    expect(bounceWeight(3, 40)).toBe(0);
  });

  // C13 (AC 12)
  it('zone light holds and ramps', { timeout: 120_000 }, () => {
    const steps = Math.round(600 / DT);
    for (let id = 0; id < 50; id++) {
      const v = new Float64Array(steps + 1);
      for (let i = 0; i <= steps; i++) v[i] = zoneLight(id, i * DT);
      // mesmo id e mesmo t: mesmo valor (de trás para frente e de novo)
      for (let i = steps; i >= 0; i -= 997) expect(zoneLight(id, i * DT)).toBe(v[i]);
      const plateau = (x: number) => x === 1 || x === 0.5;
      let i = 0;
      let segments = 0;
      while (i <= steps) {
        if (v[i]! < 0.5 || v[i]! > 1) throw new Error(`zone ${id} at ${i * DT}: ${v[i]}`);
        if (plateau(v[i]!)) {
          const level = v[i]!;
          let j = i;
          while (j + 1 <= steps && v[j + 1] === level) j++;
          // o último patamar é cortado pelo fim da varredura
          if (j < steps) {
            const dur = (j - i) * DT;
            expect(dur, `zone ${id} plateau at ${i * DT}`).toBeGreaterThanOrEqual(20 - DT);
            expect(dur, `zone ${id} plateau at ${i * DT}`).toBeLessThanOrEqual(60 + DT);
            segments++;
          }
          i = j + 1;
        } else {
          // rampa: fora de patamar até o próximo patamar
          let j = i;
          while (j + 1 <= steps && !plateau(v[j + 1]!)) j++;
          if (j + 1 <= steps) {
            const dur = (j + 1 - (i - 1)) * DT;
            expect(Math.abs(dur - 3), `zone ${id} ramp at ${i * DT}`).toBeLessThanOrEqual(DT + 1e-9);
            expect(plateau(v[i - 1]!) && plateau(v[j + 1]!) && v[i - 1] !== v[j + 1]).toBe(true);
            // linear: segunda diferença nula dentro da rampa
            for (let k = i + 1; k < j; k++) if (Math.abs(v[k + 1]! - 2 * v[k]! + v[k - 1]!) > 1e-9) throw new Error(`zone ${id} ramp not linear at ${k * DT}`);
          }
          i = j + 1;
        }
      }
      expect(segments).toBeGreaterThanOrEqual(8);
    }
  });

  // C14 (AC 13) - parte pura
  it('zone light is calm and always changes', { timeout: 120_000 }, () => {
    const half = Math.round(0.5 / DT);
    const steps = Math.round(600 / DT);
    let worst = 0;
    for (let id = 0; id < 50; id++) {
      const v = new Float64Array(steps + 1);
      for (let i = 0; i <= steps; i++) v[i] = zoneLight(id, i * DT);
      for (let i = 0; i + half <= steps; i++) worst = Math.max(worst, Math.abs(v[i + half]! - v[i]!));
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(0.1);
    // toda zona do seed 1337 troca de patamar entre t = 0 e t = 180
    expect(interiors.zones.length).toBeGreaterThan(0);
    for (const zone of interiors.zones) {
      const first = zoneLight(zone.id, 0, 1337);
      let changed = false;
      for (let i = 1; i <= Math.round(180 / DT) && !changed; i++) if (zoneLight(zone.id, i * DT, 1337) !== first) changed = true;
      expect(changed, `zone ${zone.id}`).toBe(true);
    }
  });

  // C17 (AC 16) - parte pura
  it('string lights sway', () => {
    const bulbs = props.yards.flatMap((y) => y.bulbs);
    expect(bulbs.length).toBeGreaterThan(0);
    let worst = 0;
    for (const b of bulbs) {
      const { freq, phase } = bulbSway(b.x, b.z);
      expect(freq).toBeGreaterThanOrEqual(0.2);
      expect(freq).toBeLessThanOrEqual(0.4);
      for (let i = 0; i <= 60 * 60; i += 7) {
        const t = i * DT;
        worst = Math.max(worst, Math.abs(bulbOffset(t, phase, freq)));
        // repete a cada 1/freq
        expect(Math.abs(bulbOffset(t + 1 / freq, phase, freq) - bulbOffset(t, phase, freq))).toBeLessThanOrEqual(1e-9);
      }
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(0.15);
  });

  // C22 (AC 21) - parte pura
  it('tree crowns sway', () => {
    let s = 3;
    const rand = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
    for (let p = 0; p < 100; p++) {
      const x = (rand() - 0.5) * 3000;
      const z = (rand() - 0.5) * 3000;
      let worst = 0;
      let axis: [number, number] | null = null;
      let crossings = 0;
      let prev = 0;
      for (let i = 0; i <= 60 * 60; i++) {
        const d = crownSway(i * DT, x, z);
        const mag = Math.hypot(d.dx, d.dz);
        worst = Math.max(worst, mag);
        if (!axis && mag > 1e-3) axis = [d.dx / mag, d.dz / mag];
        const along = axis ? d.dx * axis[0] + d.dz * axis[1] : 0;
        if (i > 0 && Math.sign(along) !== Math.sign(prev) && along !== 0 && prev !== 0) crossings++;
        if (along !== 0) prev = along;
      }
      expect(worst).toBeGreaterThan(0);
      expect(worst).toBeLessThanOrEqual(0.3);
      // cada ciclo cruza o zero 2 vezes: frequência ≈ cruzamentos / (2 · 60 s)
      const freq = crossings / 120;
      expect(freq, `(${x}, ${z})`).toBeGreaterThanOrEqual(0.2 - 1 / 120);
      expect(freq, `(${x}, ${z})`).toBeLessThanOrEqual(0.4 + 1 / 120);
    }
  });

  // C25 (AC 23) - parte pura
  it('fireflies drift and pulse slowly', () => {
    for (let i = 0; i < 200; i++) {
      let fastest = 0;
      let crossings = 0;
      let prevGlow = fireflyMotion(0, i).glow - 0.5;
      let prev = fireflyMotion(0, i);
      for (let k = 1; k <= 60 * 60; k++) {
        const m = fireflyMotion(k * DT, i);
        fastest = Math.max(fastest, Math.hypot(m.dx - prev.dx, m.dy - prev.dy, m.dz - prev.dz) / DT);
        const g = m.glow - 0.5;
        if (g !== 0 && prevGlow !== 0 && Math.sign(g) !== Math.sign(prevGlow)) crossings++;
        if (g !== 0) prevGlow = g;
        prev = m;
      }
      expect(fastest, `firefly ${i}`).toBeLessThanOrEqual(0.5);
      expect(fastest).toBeGreaterThan(0);
      const pulse = crossings / 120;
      expect(pulse, `firefly ${i}`).toBeGreaterThanOrEqual(0.3 - 1 / 120);
      expect(pulse, `firefly ${i}`).toBeLessThanOrEqual(0.6 + 1 / 120);
    }
  });
});
