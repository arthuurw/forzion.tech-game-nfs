import { beforeAll, describe, expect, it } from 'vitest';
import { LOT_MARGIN, WALK_CLEARANCE, findBlockInteriors, walkable, type BlockInteriors } from '../../src/world/interiors/BlockInteriors';
import { placeInteriorProps } from '../../src/world/interiors/InteriorProps';
import { generateLots, type Lot } from '../../src/world/lots/LotGenerator';
import { generateRoads, type Road, type RoadNetwork } from '../../src/world/roads/RoadGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { generateTerrain, type Heightmap } from '../../src/world/terrain/TerrainGenerator';

const WATER_Y = -2;

function world(seed: number) {
  const raw = generateTerrain(seed);
  const network = generateRoads(seed, raw);
  const carved = carveRoads(raw, network);
  const { lots } = generateLots(seed, network, carved);
  const interiors = findBlockInteriors(carved, network, lots);
  return { raw, network, carved, lots, interiors };
}

const w1337 = world(1337);

/** Heightmap sintético com altura `y` em todo vértice (ou por função). */
function flatMap(size: number, origin: number, y: number | ((x: number, z: number) => number) = 0): Heightmap {
  const heights = new Float32Array(size * size);
  for (let iz = 0; iz < size; iz++) {
    for (let ix = 0; ix < size; ix++) {
      const x = origin + ix * 4;
      const z = origin + iz * 4;
      heights[iz * size + ix] = typeof y === 'number' ? y : y(x, z);
    }
  }
  return { size, spacing: 4, origin, heights };
}

function lot(x: number, z: number, width: number, depth: number, rotation = 0): Lot {
  return { x, z, y: 0, width, depth, height: 10, rotation, facadeType: 0, downtown: false, roadId: 0, side: 1 };
}

/** Estrada reta ao longo de z em x = `x`, pontos a cada 2 m. */
function straightRoad(x: number, width: number, from: number, to: number): Road {
  const pts: number[] = [];
  for (let z = from; z <= to; z += 2) pts.push(x, 0, z);
  return { id: 0, kind: 'avenue', lanes: 4, width, closed: false, points: new Float32Array(pts), bridges: [] };
}

const EMPTY: RoadNetwork = { roads: [] };

/** Distância horizontal ao retângulo orientado do lote, pela geometria (cantos e arestas). */
function rectDistance(l: Lot, x: number, z: number): number {
  const fx = Math.sin(l.rotation);
  const fz = Math.cos(l.rotation);
  const lx = Math.cos(l.rotation);
  const lz = -Math.sin(l.rotation);
  const corners: Array<[number, number]> = [];
  for (const [a, b] of [[1, 1], [1, -1], [-1, -1], [-1, 1]] as const) {
    corners.push([l.x + (fx * a * l.width) / 2 + (lx * b * l.depth) / 2, l.z + (fz * a * l.width) / 2 + (lz * b * l.depth) / 2]);
  }
  // dentro: projeções nos dois eixos dentro das meias medidas
  const u = (x - l.x) * fx + (z - l.z) * fz;
  const v = (x - l.x) * lx + (z - l.z) * lz;
  if (Math.abs(u) <= l.width / 2 && Math.abs(v) <= l.depth / 2) return 0;
  let best = Infinity;
  for (let i = 0; i < 4; i++) best = Math.min(best, segDist(x, z, corners[i]!, corners[(i + 1) % 4]!));
  return best;
}

function segDist(px: number, pz: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2)) : 0;
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

/** Grade espacial de 32 m com os segmentos de estrada [ax, az, bx, bz, raio]. */
function segmentGrid(network: RoadNetwork) {
  const cell = 32;
  const grid = new Map<string, number[][]>();
  for (const road of network.roads) {
    const p = road.points;
    const n = p.length / 3;
    const segs = road.closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n;
      const s = [p[i * 3]!, p[i * 3 + 2]!, p[j * 3]!, p[j * 3 + 2]!, road.width / 2 + 2];
      const r = s[4]!;
      for (let cx = Math.floor((Math.min(s[0]!, s[2]!) - r) / cell); cx <= Math.floor((Math.max(s[0]!, s[2]!) + r) / cell); cx++) {
        for (let cz = Math.floor((Math.min(s[1]!, s[3]!) - r) / cell); cz <= Math.floor((Math.max(s[1]!, s[3]!) + r) / cell); cz++) {
          const k = `${cx},${cz}`;
          let c = grid.get(k);
          if (!c) grid.set(k, (c = []));
          c.push(s);
        }
      }
    }
  }
  return (x: number, z: number) => grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? [];
}

function lotGrid(lots: Lot[], reach: number) {
  const cell = 64;
  const grid = new Map<string, Lot[]>();
  for (const l of lots) {
    const r = Math.hypot(l.width, l.depth) / 2 + reach;
    for (let cx = Math.floor((l.x - r) / cell); cx <= Math.floor((l.x + r) / cell); cx++) {
      for (let cz = Math.floor((l.z - r) / cell); cz <= Math.floor((l.z + r) / cell); cz++) {
        const k = `${cx},${cz}`;
        let c = grid.get(k);
        if (!c) grid.set(k, (c = []));
        c.push(l);
      }
    }
  }
  return (x: number, z: number) => grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? [];
}

describe('block interiors', () => {
  // smooth-world C10 (door 2): célula inteira (floor) na zona, folga da fachada interpolada, dentro da grade
  it('walkable needs the whole cell and the facade gap', () => {
    expect(WALK_CLEARANCE).toBe(0.25);
    const limit = LOT_MARGIN + 0.25;
    // grade 4 × 4 vértices a cada 4 m a partir de (0, 0); zona 0 em tudo, fachada a 3 m de todo vértice
    const grid = (patch: (zoneOf: Int32Array, facade: Float32Array) => void = () => {}): BlockInteriors => {
      const zoneOf = new Int32Array(16).fill(0);
      const facadeDist = new Float32Array(16).fill(3);
      patch(zoneOf, facadeDist);
      return { spacing: 4, origin: 0, size: 4, zoneOf, facadeDist, zones: [] };
    };
    const v = (ix: number, iz: number) => iz * 4 + ix;
    // célula (1, 1): vértices (1,1) (2,1) (1,2) (2,2); o ponto (6, 6) é o meio dela
    const rows: Array<[string, BlockInteriors, number, number, boolean]> = [
      ['célula inteira na zona e fachada longe', grid(), 6, 6, true],
      ['vértice (1,1) fora da zona', grid((z) => (z[v(1, 1)] = -1)), 6, 6, false],
      ['vértice (2,1) de outra zona', grid((z) => (z[v(2, 1)] = 1)), 6, 6, false],
      ['vértice (1,2) fora da zona', grid((z) => (z[v(1, 2)] = -1)), 6, 6, false],
      ['vértice (2,2) fora da zona', grid((z) => (z[v(2, 2)] = -1)), 6, 6, false],
      // floor, não o vértice mais perto: a 0.1 m do vértice (2, 2), que é da célula seguinte e está fora
      ['vértice mais perto fora, célula do floor inteira', grid((z) => (z[v(3, 2)] = -1)), 7.9, 6, true],
      ['passou para a célula com o vértice fora', grid((z) => (z[v(3, 2)] = -1)), 8.1, 6, false],
      // fachada interpolada no meio da célula = média dos 4 vértices; os vértices sozinhos passariam
      [
        'fachada interpolada 0.01 m abaixo do limite',
        grid((_, f) => [v(1, 1), v(2, 1), v(1, 2), v(2, 2)].forEach((k, i) => (f[k] = i % 2 ? limit + 0.49 : limit + 0.49 - 1))),
        6,
        6,
        false,
      ],
      [
        'fachada interpolada no limite',
        grid((_, f) => [v(1, 1), v(2, 1), v(1, 2), v(2, 2)].forEach((k, i) => (f[k] = i % 2 ? limit + 0.5 : limit - 0.5))),
        6,
        6,
        true,
      ],
      ['fora da grade, x < origem', grid(), -0.1, 6, false],
      ['fora da grade, z < origem', grid(), 6, -0.1, false],
      ['fora da grade, x na última linha', grid(), 12, 6, false],
      ['fora da grade, z além do fim', grid(), 6, 12.5, false],
    ];
    for (const [name, bi, x, z, want] of rows) expect(walkable(bi, 0, x, z), name).toBe(want);
    // a fachada do caso "0.01 abaixo" interpola mesmo a 1.24 e a do "no limite" a 1.25
    const below = rows[7]![1];
    const at = rows[8]![1];
    const mean = (bi: BlockInteriors) => [v(1, 1), v(2, 1), v(1, 2), v(2, 2)].reduce((s, k) => s + bi.facadeDist[k]!, 0) / 4;
    expect(mean(below)).toBeCloseTo(limit - 0.01, 6);
    expect(mean(at)).toBeCloseTo(limit, 6);
    expect([v(1, 1), v(2, 1), v(1, 2), v(2, 2)].filter((k) => below.facadeDist[k]! >= limit)).toHaveLength(2);
  });

  // C1 (AC 1, door 1)
  it('interior vertex rule', { timeout: 60_000 }, () => {
    // estrada avenue (w = 16) no eixo z e lote 10 × 10 sem rotação em (40, 0). A grade de 4 m é
    // deslocada para ter um vértice exatamente em x = alvo, com a linha de z a menos de 2 m de 0
    // (a estrada vai de z = -200 a 200 e a face do lote vai de z = -5 a 5, então só x conta).
    const scenario = (targetX: number, y = 0) => {
      const origin = targetX - 4 * 30;
      const hm = flatMap(61, origin, y);
      const bi = findBlockInteriors(hm, { roads: [straightRoad(0, 16, -200, 200)] }, [lot(40, 0, 10, 10)]);
      const iz = Math.round((0 - origin) / 4);
      expect(Math.abs(origin + iz * 4)).toBeLessThanOrEqual(2);
      return bi.zoneOf[iz * hm.size + 30]!;
    };
    // do eixo: w/2 + 1.9 = 9.9 m não é interior, 10.1 m é
    expect(scenario(9.9)).toBe(-1);
    expect(scenario(10.1)).toBeGreaterThanOrEqual(0);
    // do footprint (face em x = 45): 0.9 m não é interior, 1.1 m é
    expect(scenario(45.9)).toBe(-1);
    expect(scenario(46.1)).toBeGreaterThanOrEqual(0);
    // água: chão em WATER_Y + 0.4 não é interior, em WATER_Y + 0.6 é (vértice longe da estrada e do lote)
    expect(scenario(70, WATER_Y + 0.4)).toBe(-1);
    expect(scenario(70, WATER_Y + 0.6)).toBeGreaterThanOrEqual(0);

    // borda do mundo (±1536): vértice a 7.9 m não é interior, a 8.1 m é
    for (const [gap, interior] of [[7.9, false], [8.1, true]] as const) {
      const origin = -1536 + gap - 8; // vértice ix = 2 em x = -1536 + gap
      const edge = findBlockInteriors(flatMap(21, origin, 0), EMPTY, []);
      const k = 10 * 21 + 2; // z = origin + 40, longe da borda
      expect(-1536 + gap).toBeCloseTo(origin + 8, 9);
      expect(edge.zoneOf[k]! >= 0, `edge gap ${gap}`).toBe(interior);
    }

    // seed 1337: todo vértice interior cumpre as 4 condições, recalculadas aqui
    const { interiors: bi, network, lots, carved } = w1337;
    const segs = segmentGrid(network);
    const lotsNear = lotGrid(lots, 2);
    let checked = 0;
    for (let k = 0; k < bi.zoneOf.length; k++) {
      if (bi.zoneOf[k]! < 0) continue;
      const ix = k % bi.size;
      const iz = Math.floor(k / bi.size);
      const x = bi.origin + ix * bi.spacing;
      const z = bi.origin + iz * bi.spacing;
      if (1536 - Math.max(Math.abs(x), Math.abs(z)) < 8) throw new Error(`edge (${x}, ${z})`);
      if (carved.heights[k]! < WATER_Y + 0.5) throw new Error(`water (${x}, ${z})`);
      for (const s of segs(x, z)) {
        if (segDist(x, z, [s[0]!, s[1]!], [s[2]!, s[3]!]) < s[4]!) throw new Error(`road (${x}, ${z})`);
      }
      for (const l of lotsNear(x, z)) if (rectDistance(l, x, z) < 1) throw new Error(`lot (${x}, ${z})`);
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
  });

  // C2 (AC 2, door 1)
  it('zones are 4-connected groups of at least 25', () => {
    // grade 20 × 20; todo vértice fora dos grupos recebe um lote de 0.5 m em cima (bloqueia só ele)
    const size = 20;
    const origin = 0;
    const blockAllBut = (keep: Set<string>): Lot[] => {
      const out: Lot[] = [];
      for (let iz = 0; iz < size; iz++) for (let ix = 0; ix < size; ix++) if (!keep.has(`${ix},${iz}`)) out.push(lot(origin + ix * 4, origin + iz * 4, 0.5, 0.5));
      return out;
    };
    const hm = flatMap(size, origin, 0);
    // L de 30 vértices: 15 na coluna ix = 2 e 15 na linha iz = 16
    const L = new Set<string>();
    for (let iz = 2; iz <= 16; iz++) L.add(`2,${iz}`); // 15
    for (let ix = 3; ix <= 17; ix++) L.add(`${ix},16`); // 15
    expect(L.size).toBe(30);
    const bl = findBlockInteriors(hm, EMPTY, blockAllBut(L));
    expect(bl.zones.length).toBe(1);
    expect(bl.zones[0]!.cells).toBe(30);
    for (const key of L) {
      const [ix, iz] = key.split(',').map(Number);
      expect(bl.zoneOf[iz! * size + ix!]).toBe(0);
    }

    // dois grupos de 30 (retângulos 5 × 6) que só se tocam na diagonal
    const two = new Set<string>();
    for (let iz = 0; iz < 6; iz++) for (let ix = 0; ix < 5; ix++) two.add(`${ix + 1},${iz + 1}`); // até (5, 6)
    for (let iz = 0; iz < 6; iz++) for (let ix = 0; ix < 5; ix++) two.add(`${ix + 6},${iz + 7}`); // de (6, 7)
    expect(two.size).toBe(60);
    const bt = findBlockInteriors(hm, EMPTY, blockAllBut(two));
    expect(bt.zones.length).toBe(2);
    expect(bt.zones.map((z) => z.cells)).toEqual([30, 30]);
    expect(bt.zoneOf[6 * size + 5]).not.toBe(bt.zoneOf[7 * size + 6]);

    // grupo de 24 fica fora
    const small = new Set<string>();
    for (let iz = 0; iz < 4; iz++) for (let ix = 0; ix < 6; ix++) small.add(`${ix + 3},${iz + 3}`);
    expect(small.size).toBe(24);
    const bs = findBlockInteriors(hm, EMPTY, blockAllBut(small));
    expect(bs.zones.length).toBe(0);
    for (const key of small) {
      const [ix, iz] = key.split(',').map(Number);
      expect(bs.zoneOf[iz! * size + ix!]).toBe(-1);
    }

    // seed 1337: contagem, mínimo de 25 e alcance da busca de 4 vizinhos
    const bi = w1337.interiors;
    const counts = new Map<number, number>();
    for (let k = 0; k < bi.zoneOf.length; k++) if (bi.zoneOf[k]! >= 0) counts.set(bi.zoneOf[k]!, (counts.get(bi.zoneOf[k]!) ?? 0) + 1);
    expect(bi.zones.length).toBeGreaterThan(0);
    const n = bi.size;
    for (const zone of bi.zones) {
      expect(zone.cells).toBe(counts.get(zone.id));
      expect(zone.cells).toBeGreaterThanOrEqual(25);
      let start = -1;
      for (let k = 0; k < bi.zoneOf.length && start < 0; k++) if (bi.zoneOf[k] === zone.id) start = k;
      const seen = new Uint8Array(n * n);
      const queue = [start];
      seen[start] = 1;
      let reached = 0;
      while (queue.length) {
        const k = queue.pop()!;
        reached++;
        const ix = k % n;
        const neigh = [ix > 0 ? k - 1 : -1, ix < n - 1 ? k + 1 : -1, k - n, k + n];
        for (const m of neigh) {
          if (m < 0 || m >= n * n || seen[m]) continue;
          if (bi.zoneOf[m] !== zone.id) {
            // vizinho interior de outra zona seria erro de agrupamento
            expect(bi.zoneOf[m]).toBe(-1);
            continue;
          }
          seen[m] = 1;
          queue.push(m);
        }
      }
      expect(reached).toBe(zone.cells);
    }
  });

  // C3 (AC 3)
  it('zone kind and measures', () => {
    // zona 5 × 5 com centroide em (500, 0) e em (500.1, 0.1): o resto do mapa é água
    for (const [shift, kind] of [[0, 'downtown'], [0.1, 'outer']] as const) {
      const origin = -12 + shift;
      const size = 134;
      const hm = flatMap(size, origin, (x, z) => (Math.abs(x - (500 + shift)) <= 8.01 && Math.abs(z - shift) <= 8.01 ? 0 : -5));
      const bi = findBlockInteriors(hm, EMPTY, []);
      expect(bi.zones.length).toBe(1);
      const zone = bi.zones[0]!;
      expect(zone.cells).toBe(25);
      expect(zone.centroid.x).toBeCloseTo(500 + shift, 6);
      expect(zone.centroid.z).toBeCloseTo(shift, 6);
      expect(zone.kind).toBe(kind);
    }

    const bi = w1337.interiors;
    const sums = bi.zones.map(() => ({ x: 0, z: 0, n: 0, minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }));
    for (let k = 0; k < bi.zoneOf.length; k++) {
      const id = bi.zoneOf[k]!;
      if (id < 0) continue;
      const s = sums[id]!;
      const x = bi.origin + (k % bi.size) * bi.spacing;
      const z = bi.origin + Math.floor(k / bi.size) * bi.spacing;
      s.x += x;
      s.z += z;
      s.n++;
      s.minX = Math.min(s.minX, x);
      s.maxX = Math.max(s.maxX, x);
      s.minZ = Math.min(s.minZ, z);
      s.maxZ = Math.max(s.maxZ, z);
    }
    for (const zone of bi.zones) {
      const s = sums[zone.id]!;
      const cx = s.x / s.n;
      const cz = s.z / s.n;
      expect(Math.abs(zone.centroid.x - cx)).toBeLessThanOrEqual(1e-6);
      expect(Math.abs(zone.centroid.z - cz)).toBeLessThanOrEqual(1e-6);
      expect(zone.kind).toBe(Math.abs(cx) <= 500 && Math.abs(cz) <= 500 ? 'downtown' : 'outer');
      expect(zone.areaM2).toBe(zone.cells * 16);
      expect(zone.bbox.minX).toBeLessThanOrEqual(s.minX);
      expect(zone.bbox.maxX).toBeGreaterThanOrEqual(s.maxX);
      expect(zone.bbox.minZ).toBeLessThanOrEqual(s.minZ);
      expect(zone.bbox.maxZ).toBeGreaterThanOrEqual(s.maxZ);
    }
  });

  // C4 (AC 4)
  it('facade distance', () => {
    const l = lot(0, 0, 10, 10, Math.PI / 6);
    // ponto a 12 m da face lateral (normal (cos r, −sin r)), deslizado ao longo dela até x − z ser
    // múltiplo de 4: a grade (mesma origem em x e z) passa a ter um vértice exatamente ali
    const r = l.rotation;
    const nx = Math.cos(r);
    const nz = -Math.sin(r);
    const fx = Math.sin(r);
    const fz = Math.cos(r);
    const a = 17 * (nx - nz);
    const b = fx - fz;
    const slide = (Math.round(a / 4) * 4 - a) / b;
    expect(Math.abs(slide)).toBeLessThan(5);
    const px = 17 * nx + slide * fx;
    const pz = 17 * nz + slide * fz;
    const origin = px - 4 * 40;
    const hm = flatMap(81, origin, 0);
    const bi = findBlockInteriors(hm, EMPTY, [l]);
    const iz = Math.round((pz - origin) / 4);
    expect(Math.abs(origin + iz * 4 - pz)).toBeLessThan(1e-6);
    const at12 = iz * hm.size + 40;
    expect(bi.zoneOf[at12]).toBeGreaterThanOrEqual(0);
    expect(rectDistance(l, origin + 40 * 4, origin + iz * 4)).toBeCloseTo(12, 6);
    expect(Math.abs(bi.facadeDist[at12]! - 12)).toBeLessThanOrEqual(0.01);
    // um vértice interior a 80 m (pela geometria) fica com 60
    let at80 = -1;
    for (let k = 0; k < bi.zoneOf.length && at80 < 0; k++) {
      if (bi.zoneOf[k]! < 0) continue;
      const d = rectDistance(l, origin + (k % hm.size) * 4, origin + Math.floor(k / hm.size) * 4);
      if (Math.abs(d - 80) < 1) at80 = k;
    }
    expect(at80).toBeGreaterThanOrEqual(0);
    expect(bi.facadeDist[at80]).toBeCloseTo(60, 6);

    // seed 1337: 200 vértices interiores sorteados contra a distância exata ao footprint mais próximo
    const { interiors, lots } = w1337;
    const interiorIdx: number[] = [];
    for (let k = 0; k < interiors.zoneOf.length; k++) if (interiors.zoneOf[k]! >= 0) interiorIdx.push(k);
    let s = 12345;
    const rand = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
    for (let i = 0; i < 200; i++) {
      const k = interiorIdx[Math.floor(rand() * interiorIdx.length)]!;
      const x = interiors.origin + (k % interiors.size) * 4;
      const z = interiors.origin + Math.floor(k / interiors.size) * 4;
      let best = Infinity;
      for (const lt of lots) best = Math.min(best, rectDistance(lt, x, z));
      expect(Math.abs(interiors.facadeDist[k]! - Math.min(60, best)), `(${x}, ${z})`).toBeLessThanOrEqual(0.01);
    }
  });

  // C5 (AC 5, doors 1 e 2)
  // as duas gerações extras (mesmo seed e outro seed) ficam no hook: o teste só compara (test-hardening AC 2)
  let again: ReturnType<typeof world>;
  let other1338: ReturnType<typeof world>;
  beforeAll(() => {
    again = world(1337);
    other1338 = world(1338);
  }, 60_000);

  it('interiors and props are deterministic', () => {
    const a = w1337.interiors;
    const b = again.interiors;
    expect(b.zoneOf.length).toBe(a.zoneOf.length);
    for (let k = 0; k < a.zoneOf.length; k++) if (a.zoneOf[k] !== b.zoneOf[k]) throw new Error(`zoneOf ${k}`);
    for (let k = 0; k < a.facadeDist.length; k++) if (a.facadeDist[k] !== b.facadeDist[k]) throw new Error(`facadeDist ${k}`);
    expect(b.zones).toEqual(a.zones);
    expect(placeInteriorProps(1337, b, again.lots, again.carved)).toEqual(placeInteriorProps(1337, a, w1337.lots, w1337.carved));

    const other = other1338.interiors;
    let differ = 0;
    for (let k = 0; k < a.zoneOf.length; k++) if (other.zoneOf[k] !== a.zoneOf[k]) differ++;
    expect(differ).toBeGreaterThanOrEqual(1000);
  });

  // C6 (AC 6)
  it('seed 1337 has both zone kinds', () => {
    const kinds = new Set(w1337.interiors.zones.map((z) => z.kind));
    expect(kinds.has('downtown')).toBe(true);
    expect(kinds.has('outer')).toBe(true);
  });
});
