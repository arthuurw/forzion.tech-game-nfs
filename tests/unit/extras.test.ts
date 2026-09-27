import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/world/CityGenerator';
import { findBlockInteriors, type BlockInteriors } from '../../src/world/interiors/BlockInteriors';
import {
  CAT_YARD_CHANCE,
  CAT_YARD_SALT,
  PARKED_PAINTS,
  placeInteriorProps,
  rectCorners,
} from '../../src/world/interiors/InteriorProps';
import { activeCatSpawns } from '../../src/world/interiors/interiorMotion';
import { generateLots, type Lot } from '../../src/world/lots/LotGenerator';
import { generateRoads, type RoadNetwork } from '../../src/world/roads/RoadGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';

// block-life-extras C9, C10, C11, C15, C19, C23: os extras do miolo do seed 1337 (door 1)
const raw = generateTerrain(1337);
const network = generateRoads(1337, raw);
const carved = carveRoads(raw, network);
const { lots } = generateLots(1337, network, carved);
const bi = findBlockInteriors(carved, network, lots);
const props = placeInteriorProps(1337, bi, lots, carved);

function zoneAt(b: BlockInteriors, x: number, z: number): number {
  const ix = Math.round((x - b.origin) / b.spacing);
  const iz = Math.round((z - b.origin) / b.spacing);
  if (ix < 0 || iz < 0 || ix >= b.size || iz >= b.size) return -1;
  return b.zoneOf[iz * b.size + ix]!;
}

function facadeAt(b: BlockInteriors, x: number, z: number): number {
  const ix = Math.round((x - b.origin) / b.spacing);
  const iz = Math.round((z - b.origin) / b.spacing);
  return b.facadeDist[iz * b.size + ix]!;
}

/** distância horizontal de (x, z) ao retângulo do lote (0 dentro) */
function lotDistance(l: Lot, x: number, z: number): number {
  // no referencial do lote: u ao longo da rua (largura), v para dentro (profundidade)
  const u = (x - l.x) * Math.sin(l.rotation) + (z - l.z) * Math.cos(l.rotation);
  const v = (x - l.x) * Math.cos(l.rotation) - (z - l.z) * Math.sin(l.rotation);
  const du = Math.max(0, Math.abs(u) - l.width / 2);
  const dv = Math.max(0, Math.abs(v) - l.depth / 2);
  return Math.hypot(du, dv);
}

/** ponto de estrada mais perto: distância e largura */
function nearestRoad(net: RoadNetwork, x: number, z: number): { d: number; width: number } {
  let best = { d: Infinity, width: 0 };
  for (const road of net.roads) {
    const p = road.points;
    for (let i = 0; i < p.length; i += 3) {
      const d = Math.hypot(p[i]! - x, p[i + 2]! - z);
      if (d < best.d) best = { d, width: road.width };
    }
  }
  return best;
}

function angleDiff(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

describe('interior extras of seed 1337', () => {
  // C9
  it('parked cars sit in downtown patios away from everything', () => {
    expect(props.parking.length).toBeGreaterThanOrEqual(60);
    expect(props.parking.length).toBeLessThanOrEqual(160);
    for (const [k, car] of props.parking.entries()) {
      const zone = bi.zones[car.zoneId]!;
      expect(zone.kind, `car ${k}`).toBe('downtown');
      expect(zone.areaM2, `car ${k}`).toBeGreaterThanOrEqual(800);
      expect(zoneAt(bi, car.x, car.z), `car ${k} zone`).toBe(car.zoneId);
      for (const l of lots) expect(lotDistance(l, car.x, car.z), `car ${k} lot`).toBeGreaterThanOrEqual(2);
      const road = nearestRoad(network, car.x, car.z);
      expect(road.d, `car ${k} road`).toBeGreaterThanOrEqual(road.width / 2 + 2);
      for (const s of props.sites) expect(Math.hypot(s.x - car.x, s.z - car.z), `car ${k} site`).toBeGreaterThanOrEqual(12);
      for (const y of props.yards) expect(Math.hypot(y.lamp.x - car.x, y.lamp.z - car.z), `car ${k} lamp`).toBeGreaterThanOrEqual(8);
      for (const p of props.pools) expect(Math.hypot(p.x - car.x, p.z - car.z), `car ${k} pool`).toBeGreaterThanOrEqual(8);
      for (const t of props.trees) expect(Math.hypot(t.x - car.x, t.z - car.z), `car ${k} tree`).toBeGreaterThanOrEqual(8);
    }
  });

  // C10
  it('parked cars form rows with a 2.8 m pitch', () => {
    const cars = props.parking;
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i]!;
        const b = cars[j]!;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        expect(d, `cars ${i} ${j}`).toBeGreaterThanOrEqual(2.7);
        if (a.zoneId !== b.zoneId || angleDiff(a.heading, b.heading) > (1 * Math.PI) / 180) continue;
        if (d >= 6) continue;
        // direita de a: (−cos h, sin h); frente: (sin h, cos h)
        const lateral = (b.x - a.x) * -Math.cos(a.heading) + (b.z - a.z) * Math.sin(a.heading);
        const along = (b.x - a.x) * Math.sin(a.heading) + (b.z - a.z) * Math.cos(a.heading);
        const k = Math.round(lateral / 2.8);
        expect(Math.abs(lateral - k * 2.8), `cars ${i} ${j} pitch`).toBeLessThanOrEqual(0.1);
        expect(Math.abs(along), `cars ${i} ${j} along`).toBeLessThanOrEqual(0.1);
      }
    }
  });

  // C11
  it('parked paints come from the palette and repeat with the seed', () => {
    const used = new Set<string>();
    for (const car of props.parking) {
      expect(PARKED_PAINTS).toContain(car.paint);
      used.add(car.paint);
    }
    expect(PARKED_PAINTS.length).toBe(8);
    expect(used.size).toBeGreaterThanOrEqual(6);
    const again = placeInteriorProps(1337, findBlockInteriors(carved, network, lots), lots, carved);
    expect(again.parking).toEqual(props.parking);
  });

  // C15
  it('steam vents sit on the patio', () => {
    const vents = props.vents;
    expect(vents.length).toBeGreaterThanOrEqual(40);
    expect(vents.length).toBeLessThanOrEqual(120);
    let quota = 0;
    for (const z of bi.zones) if (z.kind === 'downtown') quota += Math.floor(z.areaM2 / 500);
    expect(vents.length).toBeGreaterThanOrEqual(0.8 * Math.min(120, quota));
    for (const [k, v] of vents.entries()) {
      expect(bi.zones[v.zoneId]!.kind, `vent ${k}`).toBe('downtown');
      expect(zoneAt(bi, v.x, v.z), `vent ${k}`).toBe(v.zoneId);
      const fd = facadeAt(bi, v.x, v.z);
      expect(fd, `vent ${k} facade`).toBeGreaterThanOrEqual(3);
      expect(fd, `vent ${k} facade`).toBeLessThanOrEqual(12);
      for (let j = k + 1; j < vents.length; j++) expect(Math.hypot(vents[j]!.x - v.x, vents[j]!.z - v.z), `vents ${k} ${j}`).toBeGreaterThanOrEqual(6);
      for (const p of props.parking) expect(Math.hypot(p.x - v.x, p.z - v.z), `vent ${k} car`).toBeGreaterThanOrEqual(4);
      for (const s of props.sites) expect(Math.hypot(s.x - v.x, s.z - v.z), `vent ${k} site`).toBeGreaterThanOrEqual(12);
    }
  });

  // C19
  it('four searchlights on the tallest towers', () => {
    const lights = props.searchlights;
    expect(lights.length).toBe(4);
    const expected: number[] = [];
    const order = lots.map((l, i) => ({ l, i })).filter((e) => e.l.downtown).sort((a, b) => b.l.height - a.l.height || a.i - b.i);
    for (const { l, i } of order) {
      if (expected.length >= 4) break;
      if (expected.some((j) => Math.hypot(lots[j]!.x - l.x, lots[j]!.z - l.z) < 250)) continue;
      expected.push(i);
    }
    expect(lights.map((s) => s.lotIndex)).toEqual(expected);
    for (const s of lights) {
      const l = lots[s.lotIndex]!;
      expect(l.downtown).toBe(true);
      expect(Math.abs(s.y - (l.y + l.height))).toBeLessThanOrEqual(0.01);
      expect(s.period).toBeGreaterThanOrEqual(32);
      expect(s.period).toBeLessThanOrEqual(48);
    }
    const again = placeInteriorProps(1337, findBlockInteriors(carved, network, lots), lots, carved);
    expect(again.searchlights).toEqual(lights);
  });

  // C23
  it('cat spawns in yards and outer zones with a range cap', () => {
    const rng = mulberry32(1337 ^ CAT_YARD_SALT);
    let yardCats = 0;
    for (let i = 0; i < props.yards.length; i++) if (rng() < CAT_YARD_CHANCE) yardCats++;
    let outerCats = 0;
    for (const z of bi.zones) if (z.kind === 'outer') outerCats += Math.floor(z.areaM2 / 2000);
    expect(props.cats.length).toBe(yardCats + outerCats);
    expect(props.cats.filter((c) => c.yard !== null).length).toBe(yardCats);
    for (const [k, c] of props.cats.entries()) {
      expect(zoneAt(bi, c.x, c.z), `cat ${k}`).toBe(c.zoneId);
      if (c.yard === null) continue;
      const yard = props.yards[c.yard]!;
      const l = lots[yard.lotIndex]!;
      // fachada de fundo: segmento no lado oposto à rua
      const bx = Math.cos(l.rotation) * l.side;
      const bz = -Math.sin(l.rotation) * l.side;
      const fx = l.x + (bx * l.depth) / 2;
      const fz = l.z + (bz * l.depth) / 2;
      const u = (c.x - fx) * Math.sin(l.rotation) + (c.z - fz) * Math.cos(l.rotation);
      const v = (c.x - fx) * bx + (c.z - fz) * bz;
      expect(Math.hypot(Math.max(0, Math.abs(u) - l.width / 2), v), `cat ${k} facade`).toBeLessThanOrEqual(8);
    }
    const car = { x: props.cats[0]!.x, z: props.cats[0]!.z };
    for (const [quality, cap] of [['high', 60], ['low', 30]] as const) {
      const active = activeCatSpawns(props.cats, car, quality);
      expect(active.length).toBeLessThanOrEqual(cap);
      for (const i of active) expect(Math.hypot(props.cats[i]!.x - car.x, props.cats[i]!.z - car.z)).toBeLessThanOrEqual(200);
    }
    expect(activeCatSpawns(props.cats, { x: 1e6, z: 1e6 }, 'high')).toEqual([]);
    expect(rectCorners(0, 0, 2, 4, 0).length).toBe(4);
  });
});
