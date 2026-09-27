import { describe, expect, it } from 'vitest';
import { findBlockInteriors } from '../../src/world/interiors/BlockInteriors';
import { placeInteriorProps } from '../../src/world/interiors/InteriorProps';
import {
  CAT_CROUCH,
  SEARCHLIGHT_LENGTH,
  SEARCHLIGHT_TILT,
  createCat,
  searchlightHeading,
  steamPoint,
  stepCat,
  trainPose,
} from '../../src/world/interiors/interiorMotion';
import { generateLots } from '../../src/world/lots/LotGenerator';
import { buildTrainLine, lineCumulative } from '../../src/world/rail/trainLine';
import { generateRoads } from '../../src/world/roads/RoadGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';

// block-life-extras C16, C20, C24, C25, C31: o que se mexe, em função do tempo
const DT = 1 / 60;
const raw = generateTerrain(1337);
const network = generateRoads(1337, raw);
const carved = carveRoads(raw, network);
const { lots } = generateLots(1337, network, carved);
const interiors = findBlockInteriors(carved, network, lots);
const props = placeInteriorProps(1337, interiors, lots, carved);

const zoneAt = (x: number, z: number) =>
  interiors.zoneOf[Math.round((z - interiors.origin) / interiors.spacing) * interiors.size + Math.round((x - interiors.origin) / interiors.spacing)]!;

describe('extras motion', () => {
  // C16
  it('steam rises drifts and grows in a 4 s cycle', () => {
    for (let seed = 0; seed < 50; seed++) {
      let prev = steamPoint(0, seed);
      expect(Math.abs(prev.dy)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(prev.size - 1)).toBeLessThanOrEqual(0.01);
      for (let t = 0.1; t < 4; t += 0.1) {
        const p = steamPoint(t, seed);
        expect(p.dy, `seed ${seed} t ${t}`).toBeGreaterThan(prev.dy);
        expect(p.size, `seed ${seed} t ${t}`).toBeGreaterThan(prev.size);
        expect(Math.abs(p.dx)).toBeLessThanOrEqual(1.5);
        expect(Math.abs(p.dz)).toBeLessThanOrEqual(1.5);
        const q = steamPoint(t + 4, seed);
        expect(Math.abs(q.dx - p.dx) + Math.abs(q.dy - p.dy) + Math.abs(q.dz - p.dz) + Math.abs(q.size - p.size)).toBeLessThanOrEqual(1e-6);
        prev = p;
      }
      const end = steamPoint(3.999, seed);
      expect(Math.abs(end.dy - 5)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(end.size - 3)).toBeLessThanOrEqual(0.01);
    }
  });

  // C20
  it('searchlight heading turns once per period', () => {
    for (const [t, period, phase] of [
      [0, 40, 1],
      [10, 40, 0],
      [60, 32, 2],
    ]) {
      expect(Math.abs(searchlightHeading(t!, period!, phase!) - (phase! + (2 * Math.PI * t!) / period!))).toBeLessThanOrEqual(1e-9);
    }
    // 80° da vertical (renegociado em 2026-09-27: a câmera não mostra o céu acima de ~17°)
    expect(SEARCHLIGHT_TILT).toBe(80);
    expect(SEARCHLIGHT_LENGTH).toBe(400);
  });

  // C24
  it('cats walk sit and stay in their zone', () => {
    const picks = Array.from({ length: 20 }, (_, i) => Math.floor((i * props.cats.length) / 20));
    const car = { x: 1e3 + 2e3, z: 1e3 };
    let sits = 0;
    for (const idx of picks) {
      const spawn = props.cats[idx]!;
      const cat = createCat(spawn, idx);
      let prev = { x: cat.x, z: cat.z };
      let walkedSinceSit = 0;
      let sitStart = -1;
      let lastSitEnd = 0;
      const seen = new Set<string>();
      for (let step = 0; step < 120 * 60; step++) {
        const t = step * DT;
        const wasSitting = cat.state === 'sit';
        stepCat(cat, DT, car, interiors);
        expect(cat.state === 'walk' || cat.state === 'sit', `cat ${idx} state ${cat.state}`).toBe(true);
        const moved = Math.hypot(cat.x - prev.x, cat.z - prev.z);
        if (cat.state === 'sit') {
          expect(cat.crouch).toBe(CAT_CROUCH);
          if (!wasSitting) {
            // o passo em que senta ainda é um passo andado
            const speed = moved / DT;
            if (speed < 0.5 - 1e-9 || speed > 0.9 + 1e-9) throw new Error(`cat ${idx} step ${step} speed ${speed}`);
            walkedSinceSit += moved;
            sitStart = t;
            expect(walkedSinceSit, `cat ${idx} sits after ${walkedSinceSit} m`).toBeGreaterThanOrEqual(6 - 0.02);
            expect(walkedSinceSit).toBeLessThanOrEqual(12 + 0.02);
            sits++;
          } else {
            expect(moved).toBe(0);
          }
        } else {
          expect(cat.crouch).toBe(0);
          if (wasSitting) {
            expect(t - sitStart).toBeGreaterThanOrEqual(2 - 0.02);
            expect(t - sitStart).toBeLessThanOrEqual(5 + 0.02);
            lastSitEnd = t;
            walkedSinceSit = 0;
          }
          const speed = moved / DT;
          if (speed < 0.5 - 1e-9 || speed > 0.9 + 1e-9) throw new Error(`cat ${idx} step ${step} speed ${speed}`);
          walkedSinceSit += moved;
        }
        prev = { x: cat.x, z: cat.z };
        const key = `${cat.fromX},${cat.fromZ},${cat.toX},${cat.toZ}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const len = Math.hypot(cat.toX - cat.fromX, cat.toZ - cat.fromZ);
        for (let d = 0; d <= len; d += 1) {
          const u = len > 0 ? d / len : 0;
          expect(zoneAt(cat.fromX + (cat.toX - cat.fromX) * u, cat.fromZ + (cat.toZ - cat.fromZ) * u), `cat ${idx} leaves zone`).toBe(spawn.zoneId);
        }
      }
      expect(lastSitEnd).toBeGreaterThan(0);
    }
    expect(sits).toBeGreaterThan(40);
  });

  // C25
  it('cats flee and are never under the car', () => {
    const spawn = props.cats.find((c) => c.yard === null)!;
    const idx = props.cats.indexOf(spawn);
    // carro parado a 5 m: foge no mesmo passo e se afasta até 12 m
    const cat = createCat(spawn, idx);
    const car = { x: cat.x + 5, z: cat.z };
    let prevD = 5;
    stepCat(cat, DT, car, interiors);
    expect(cat.state).toBe('flee');
    let steps = 0;
    while (cat.state === 'flee' && steps < 60 * 20) {
      const before = { x: cat.x, z: cat.z };
      stepCat(cat, DT, car, interiors);
      steps++;
      if (cat.state !== 'flee') break;
      const moved = Math.hypot(cat.x - before.x, cat.z - before.z);
      // 4 m/s ± 0.01 m/s
      expect(Math.abs(moved / DT - 4), `step ${steps}`).toBeLessThanOrEqual(0.01);
      const d = Math.hypot(cat.x - car.x, cat.z - car.z);
      expect(d, `step ${steps}`).toBeGreaterThan(prevD - 1e-9);
      prevD = d;
    }
    expect(cat.state).toBe('walk');
    expect(Math.hypot(cat.x - car.x, cat.z - car.z)).toBeGreaterThanOrEqual(12 - 0.1);

    // carro indo direto ao gato a 20 m/s: nunca a menos de 0.5 m (gatos do seed 1337)
    for (const k of [0, 3, 7]) {
      const s = props.cats[Math.floor((k * props.cats.length) / 10)]!;
      const c = createCat(s, k);
      const dir = Math.PI / 4 + k;
      const chaser = { x: c.x - Math.sin(dir) * 40, z: c.z - Math.cos(dir) * 40 };
      for (let step = 0; step < 60 * 6; step++) {
        chaser.x += Math.sin(dir) * 20 * DT;
        chaser.z += Math.cos(dir) * 20 * DT;
        stepCat(c, DT, chaser, interiors);
        if (c.state === 'gone') continue;
        expect(Math.hypot(c.x - chaser.x, c.z - chaser.z), `cat ${k} step ${step}`).toBeGreaterThanOrEqual(0.5);
      }
    }

    // zona pequena (chão plano com água na moldura, para a zona não encostar na borda do mapa):
    // encurralado na borda, o empurrão sai da zona e o gato some
    const size = 16;
    const origin = -30;
    const heights = new Float32Array(size * size);
    for (let iz = 0; iz < size; iz++) {
      for (let ix = 0; ix < size; ix++) if (ix < 2 || iz < 2 || ix >= size - 2 || iz >= size - 2) heights[iz * size + ix] = -10;
    }
    const small = findBlockInteriors({ size, spacing: 4, origin, heights }, { roads: [] }, []);
    expect(small.zones.length).toBe(1);
    expect(small.zones[0]!.cells).toBeLessThan(size * size);
    // o carro persegue o gato um pouco mais rápido que a fuga (5 m/s contra 4): empurra-o até a borda
    const pursue = (car: { x: number; z: number }, cat: { x: number; z: number }) => {
      const d = Math.hypot(cat.x - car.x, cat.z - car.z) || 1;
      car.x += ((cat.x - car.x) / d) * 5 * DT;
      car.z += ((cat.z - car.z) / d) * 5 * DT;
    };
    const cornered = createCat({ zoneId: 0, x: 0, z: 0, yard: null }, 99);
    const chaser = { x: -10, z: 0 };
    let goneAt = -1;
    for (let step = 0; step < 60 * 30 && goneAt < 0; step++) {
      pursue(chaser, cornered);
      stepCat(cornered, DT, chaser, small);
      if (cornered.state === 'gone') goneAt = step;
      else expect(Math.hypot(cornered.x - chaser.x, cornered.z - chaser.z), `cornered step ${step}`).toBeGreaterThanOrEqual(0.5);
    }
    expect(goneAt).toBeGreaterThan(0);
    // some por 10 s; volta ao ponto de partida só com o carro a mais de 30 m dele: a 29 m fica sumido, a 31 m volta
    const at29 = { x: 29, z: 0 };
    for (let step = 0; step < 60 * 11; step++) stepCat(cornered, DT, at29, small);
    expect(cornered.state).toBe('gone');
    stepCat(cornered, DT, { x: 31, z: 0 }, small);
    expect(cornered.state).toBe('walk');
    expect(Math.hypot(cornered.x, cornered.z)).toBeLessThanOrEqual(1e-9);
    const far = { x: 1e5, z: 1e5 };
    // e antes dos 10 s não volta, mesmo com o carro longe
    const early = createCat({ zoneId: 0, x: 0, z: 0, yard: null }, 98);
    const chaser2 = { x: -10, z: 0 };
    for (let step = 0; step < 60 * 30 && early.state !== 'gone'; step++) {
      pursue(chaser2, early);
      stepCat(early, DT, chaser2, small);
    }
    expect(early.state).toBe('gone');
    for (let step = 0; step < 60 * 9; step++) stepCat(early, DT, far, small);
    expect(early.state).toBe('gone');
  });

  // C31
  it('train pose follows the line at 18 m per second', () => {
    const line = buildTrainLine(network)!;
    expect(line).not.toBeNull();
    const cum = lineCumulative(line);
    const L = line.length;
    for (const [t, k] of [
      [0, 0],
      [0, 2],
      [100, 1],
      [200, 0],
    ]) {
      const pose = trainPose(t!, line, k!, cum);
      const s = (((18 * t! - 13 * k!) % L) + L) % L;
      expect(Math.abs(pose.s - s), `t ${t} k ${k}`).toBeLessThanOrEqual(1e-6);
      // posição sobre a linha: a 0.5 m de algum segmento, com o heading tangente a ele
      // (num vértice, dois segmentos empatam: vale o mais alinhado dos dois)
      let best = { d: Infinity, i: 0 };
      const n = line.points.length / 3;
      const segHeading = (i: number) => {
        const a = ((i + n) % n) * 3;
        const b = ((i + 1 + n) % n) * 3;
        return Math.atan2(line.points[b]! - line.points[a]!, line.points[b + 2]! - line.points[a + 2]!);
      };
      for (let i = 0; i < n; i++) {
        const a = i * 3;
        const b = ((i + 1) % n) * 3;
        const dx = line.points[b]! - line.points[a]!;
        const dz = line.points[b + 2]! - line.points[a + 2]!;
        const len2 = dx * dx + dz * dz;
        const u = Math.max(0, Math.min(1, ((pose.x - line.points[a]!) * dx + (pose.z - line.points[a + 2]!) * dz) / len2));
        const d = Math.hypot(pose.x - (line.points[a]! + dx * u), pose.z - (line.points[a + 2]! + dz * u));
        if (d < best.d) best = { d, i };
      }
      expect(best.d, `t ${t} k ${k}`).toBeLessThanOrEqual(0.5);
      const diff = (h: number) => Math.abs(Math.atan2(Math.sin(pose.heading - h), Math.cos(pose.heading - h)));
      expect(Math.min(diff(segHeading(best.i)), diff(segHeading(best.i - 1)), diff(segHeading(best.i + 1))), `t ${t} k ${k} heading`).toBeLessThanOrEqual(Math.PI / 180);
    }
    const a = trainPose(0, line, 0, cum);
    const b = trainPose(2, line, 0, cum);
    expect(Math.abs((((b.s - a.s) % L) + L) % L - 36)).toBeLessThanOrEqual(1e-6);
  });
});
