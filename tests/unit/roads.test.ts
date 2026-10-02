import { beforeAll, describe, expect, it } from 'vitest';
import { generateTerrain, type Heightmap } from '../../src/world/terrain/TerrainGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { ROAD_SPECS, generateRoads, type Road } from '../../src/world/roads/RoadGenerator';
import { generateLamps, roadStripGeometry } from '../../src/world/roads/roadMesh';

const hm = generateTerrain(1337);
const net = generateRoads(1337, hm);
const carved = carveRoads(hm, net);

const count = (r: Road) => r.points.length / 3;
const pt = (r: Road, i: number) => [r.points[i * 3]!, r.points[i * 3 + 1]!, r.points[i * 3 + 2]!] as const;
const inBridge = (r: Road, i: number) => r.bridges.some((b) => i >= b.from && i <= b.to);
const angle = (a: number) => {
  let d = a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};
const headingOf = (r: Road, i: number) => {
  const [ax, , az] = pt(r, i);
  const [bx, , bz] = pt(r, i + 1);
  return Math.atan2(bx - ax, bz - az);
};

describe('road network', () => {
  // C12 (AC 10, door 3)
  // a segunda geração fica no hook: o teste só compara (test-hardening AC 2)
  let again: ReturnType<typeof generateRoads>;
  beforeAll(() => {
    again = generateRoads(1337, hm);
  });

  it('road network is deterministic', () => {
    expect(again.roads.length).toBe(net.roads.length);
    net.roads.forEach((r, k) => {
      const o = again.roads[k]!;
      expect([o.id, o.kind, o.lanes, o.width, o.closed]).toEqual([r.id, r.kind, r.lanes, r.width, r.closed]);
      expect(o.bridges).toEqual(r.bridges);
      expect(o.points.length).toBe(r.points.length);
      for (let i = 0; i < r.points.length; i++) {
        if (o.points[i] !== r.points[i]) throw new Error(`road ${r.id} value ${i} differs`);
      }
    });
  });

  // C13 (door 2)
  it('road specs by kind', () => {
    expect(Object.keys(ROAD_SPECS).sort()).toEqual(['avenue', 'highway', 'hill', 'street']);
    expect(ROAD_SPECS.highway).toEqual({ lanes: 6, width: 24 });
    expect(ROAD_SPECS.avenue).toEqual({ lanes: 4, width: 16 });
    expect(ROAD_SPECS.hill).toEqual({ lanes: 2, width: 10 });
    expect(ROAD_SPECS.street).toEqual({ lanes: 2, width: 10 });
    for (const r of net.roads) {
      expect(r.lanes, `road ${r.id}`).toBe(ROAD_SPECS[r.kind].lanes);
      expect(r.width, `road ${r.id}`).toBe(ROAD_SPECS[r.kind].width);
    }
  });

  // C14 (AC 11)
  it('one closed highway ring around downtown', () => {
    const highways = net.roads.filter((r) => r.kind === 'highway');
    expect(highways.length).toBe(1);
    const ring = highways[0]!;
    expect(ring.closed).toBe(true);
    let winding = 0;
    const n = count(ring);
    for (let i = 0; i < n; i++) {
      const [x, , z] = pt(ring, i);
      const d = Math.hypot(x, z);
      expect(d).toBeGreaterThanOrEqual(900);
      expect(d).toBeLessThanOrEqual(1350);
      const [nx, , nz] = pt(ring, (i + 1) % n);
      winding += angle(Math.atan2(nz, nx) - Math.atan2(z, x));
    }
    expect(Math.abs(Math.round(winding / (2 * Math.PI)))).toBe(1);
  });

  // C15 (AC 12)
  it('six avenues cross downtown', () => {
    const avenues = net.roads.filter((r) => r.kind === 'avenue');
    expect(avenues.length).toBeGreaterThanOrEqual(6);
    const sideOf = (x: number, z: number) =>
      Math.abs(x) >= Math.abs(z) ? (x > 0 ? '+x' : '-x') : z > 0 ? '+z' : '-z';
    for (const r of avenues) {
      const n = count(r);
      let inside = false;
      for (let i = 0; i < n; i++) {
        const [x, , z] = pt(r, i);
        if (Math.max(Math.abs(x), Math.abs(z)) < 500) inside = true;
      }
      expect(inside, `avenue ${r.id}`).toBe(true);
      const [ax, , az] = pt(r, 0);
      const [bx, , bz] = pt(r, n - 1);
      expect(Math.max(Math.abs(ax), Math.abs(az))).toBeGreaterThanOrEqual(498);
      expect(Math.max(Math.abs(bx), Math.abs(bz))).toBeGreaterThanOrEqual(498);
      expect(sideOf(ax, az)).not.toBe(sideOf(bx, bz));
    }
  });

  // C16 (AC 13)
  it('hill roads start on the network and climb 40 m', () => {
    const hills = net.roads.filter((r) => r.kind === 'hill');
    expect(hills.length).toBeGreaterThanOrEqual(5);
    const trunk = net.roads.filter((r) => r.kind === 'avenue' || r.kind === 'highway');
    for (const r of hills) {
      const [sx, , sz] = pt(r, 0);
      let best = Infinity;
      for (const t of trunk) {
        for (let i = 0; i < count(t); i++) {
          const [x, , z] = pt(t, i);
          best = Math.min(best, Math.hypot(x - sx, z - sz));
        }
      }
      expect(best, `hill ${r.id}`).toBeLessThanOrEqual(30);
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < count(r); i++) {
        lo = Math.min(lo, pt(r, i)[1]);
        hi = Math.max(hi, pt(r, i)[1]);
      }
      expect(hi - lo, `hill ${r.id}`).toBeGreaterThanOrEqual(40);
    }
  });

  // C17 (AC 14, door 2)
  it('points every 2 m', () => {
    for (const r of net.roads) {
      const n = count(r);
      const last = r.closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const [ax, ay, az] = pt(r, i);
        const [bx, by, bz] = pt(r, (i + 1) % n);
        const d = Math.hypot(bx - ax, by - ay, bz - az);
        if (d < 1.95 || d > 2.05) throw new Error(`road ${r.id} step ${i}: ${d}`);
      }
    }
  });

  // C18 (AC 15, door 5)
  it('grade at most 10 percent', () => {
    for (const r of net.roads) {
      const n = count(r);
      const last = r.closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const [ax, ay, az] = pt(r, i);
        const [bx, by, bz] = pt(r, (i + 1) % n);
        const g = Math.abs(by - ay) / Math.hypot(bx - ax, bz - az);
        if (g > 0.1) throw new Error(`road ${r.id} step ${i}: grade ${g}`);
      }
      // smooth-world C9 (AC 6): nas avenidas, também nas bordas da fita, que nas pontas acompanham a rampa do anel
      if (r.kind !== 'avenue') continue;
      const strip = roadStripGeometry(r, 0, last).positions;
      for (let k = 0; k < last; k++) {
        for (const side of [0, 3]) {
          const a = k * 6 + side;
          const b = (k + 1) * 6 + side;
          const g = Math.abs(strip[b + 1]! - strip[a + 1]!) / Math.hypot(strip[b]! - strip[a]!, strip[b + 2]! - strip[a + 2]!);
          if (g > 0.1) throw new Error(`road ${r.id} step ${k} edge ${side / 3}: grade ${g}`);
        }
      }
    }
  });

  // smooth-world C8 (AC 5): a borda final de cada avenida fica na altura da fita do anel logo abaixo
  it('avenue ends meet the ring without a step', () => {
    const ring = net.roads.find((r) => r.kind === 'highway')!;
    const rs = roadStripGeometry(ring, 0, count(ring));
    /** altura da fita do anel sob (x, z): o triângulo dela que contém o ponto, por baricêntricas */
    const ringY = (x: number, z: number): number | null => {
      const P = rs.positions;
      for (let t = 0; t < rs.indices.length; t += 3) {
        const [i, j, k] = [rs.indices[t]! * 3, rs.indices[t + 1]! * 3, rs.indices[t + 2]! * 3];
        const det = (P[j]! - P[i]!) * (P[k + 2]! - P[i + 2]!) - (P[k]! - P[i]!) * (P[j + 2]! - P[i + 2]!);
        const u = ((x - P[i]!) * (P[k + 2]! - P[i + 2]!) - (P[k]! - P[i]!) * (z - P[i + 2]!)) / det;
        const v = ((P[j]! - P[i]!) * (z - P[i + 2]!) - (x - P[i]!) * (P[j + 2]! - P[i + 2]!)) / det;
        if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
        return P[i + 1]! + (P[j + 1]! - P[i + 1]!) * u + (P[k + 1]! - P[i + 1]!) * v;
      }
      return null;
    };
    const avenues = net.roads.filter((r) => r.kind === 'avenue');
    expect(avenues).toHaveLength(6);
    let junctions = 0;
    let worst = 0;
    for (const av of avenues) {
      const g = roadStripGeometry(av).positions;
      const n = count(av);
      for (const end of [0, n - 1]) {
        junctions++;
        for (const side of [0, 3]) {
          const o = end * 6 + side;
          const y = ringY(g[o]!, g[o + 2]!);
          expect(y, `avenida ${av.id} ponta ${end} borda ${side / 3} sobre o anel`).not.toBeNull();
          const d = Math.abs(g[o + 1]! - y!);
          worst = Math.max(worst, d);
          expect(d, `avenida ${av.id} ponta ${end} borda ${side / 3}`).toBeLessThanOrEqual(0.02);
        }
      }
    }
    expect(junctions).toBe(12);
    expect(worst).toBeLessThanOrEqual(0.02);
  });

  // C19 (AC 16)
  it('hill roads curve', () => {
    for (const r of net.roads.filter((x) => x.kind === 'hill')) {
      let sum = 0;
      for (let i = 1; i < count(r) - 1; i++) {
        const d = Math.abs(angle(headingOf(r, i) - headingOf(r, i - 1)));
        if (d > (6 * Math.PI) / 180 + 1e-9) throw new Error(`hill ${r.id} step ${i}: ${(d * 180) / Math.PI}°`);
        sum += d;
      }
      expect(sum, `hill ${r.id}`).toBeGreaterThanOrEqual(Math.PI);
    }
  });

  // C20 (AC 17, door 5)
  it('carve flattens terrain under roads', () => {
    const n = carved.size;
    let under = 0;
    let bandPairs = 0;
    let innerPairs = 0;
    let outerPairs = 0;
    let shaped = 0;
    for (const r of net.roads) {
      const w2 = r.width / 2;
      const np = count(r);
      for (let i = 0; i < np; i += 5) {
        if (inBridge(r, i)) continue;
        const [px, py, pz] = pt(r, i);
        // amostras cuja seção transversal é o ponto i (o ponto mais próximo da estrada entre i−8 e i+8 é o próprio i)
        const cross = new Map<number, number>();
        // as mesmas, até 4 m (1 amostra) além da mistura: vizinhas de fora do par que cruza w/2 + 6
        const beyond = new Map<number, number>();
        const reach = w2 + 6;
        const scan = reach + 4;
        const ix0 = Math.max(0, Math.ceil((px - scan + 1536) / 4));
        const ix1 = Math.min(n - 1, Math.floor((px + scan + 1536) / 4));
        const iz0 = Math.max(0, Math.ceil((pz - scan + 1536) / 4));
        const iz1 = Math.min(n - 1, Math.floor((pz + scan + 1536) / 4));
        for (let iz = iz0; iz <= iz1; iz++) {
          for (let ix = ix0; ix <= ix1; ix++) {
            const sx = -1536 + ix * 4;
            const sz = -1536 + iz * 4;
            const d = Math.hypot(sx - px, sz - pz);
            if (d > scan) continue;
            let nearest = i;
            let nd = d;
            for (let j = i - 8; j <= i + 8; j++) {
              const jj = r.closed ? (j + np) % np : j;
              if (jj < 0 || jj >= np) continue;
              const [qx, , qz] = pt(r, jj);
              const dj = Math.hypot(sx - qx, sz - qz);
              if (dj < nd) {
                nd = dj;
                nearest = jj;
              }
            }
            if (nearest !== i) continue;
            if (d <= reach) cross.set(iz * n + ix, d);
            else beyond.set(iz * n + ix, d);
          }
        }
        for (const [k, d] of cross) {
          if (d <= w2) {
            under++;
            const h = carved.heights[k]!;
            if (Math.abs(h - py) > 0.3) throw new Error(`road ${r.id} point ${i}: sample ${k} at ${d.toFixed(2)} m is ${h} vs ${py}`);
            // par que cruza w/2: da pista para a mistura também sem degrau (AC 17)
            for (const nb of [k + 1, k - 1, k + n, k - n]) {
              const dn = cross.get(nb);
              if (dn === undefined || dn <= w2) continue;
              innerPairs++;
              const step = Math.abs(h - carved.heights[nb]!);
              if (step > 1.5) throw new Error(`road ${r.id} point ${i}: step ${step} crossing width/2`);
            }
          } else {
            for (const nb of [k + 1, k - 1, k + n, k - n]) {
              const dn = cross.get(nb);
              if (dn === undefined || dn <= w2) continue;
              bandPairs++;
              const step = Math.abs(carved.heights[k]! - carved.heights[nb]!);
              if (step > 1.5) throw new Error(`road ${r.id} point ${i}: band step ${step}`);
            }
            // par que cruza w/2 + 6: a mistura chega ao terreno de fora sem degrau (AC 17, door 5)
            for (const nb of [k + 1, k - 1, k + n, k - n]) {
              if (!beyond.has(nb)) continue;
              outerPairs++;
              const step = Math.abs(carved.heights[k]! - carved.heights[nb]!);
              if (step > 1.5) throw new Error(`road ${r.id} point ${i}: step ${step} crossing width/2 + 6`);
            }
            // formato da mistura (door 5): de `py` em w/2 até a altura crua em w/2 + 6, sem sair do
            // intervalo entre as duas; no 1.º quarto da faixa mais perto da pista, no último mais perto do terreno
            const rawH = hm.heights[k]!;
            const h = carved.heights[k]!;
            if (h < Math.min(py, rawH) - 0.3 || h > Math.max(py, rawH) + 0.3) {
              throw new Error(`road ${r.id} point ${i}: blend ${h} outside [${py}, ${rawH}]`);
            }
            if (Math.abs(rawH - py) > 1) {
              const t = (d - w2) / 6;
              const f = (h - py) / (rawH - py);
              if (t <= 0.25 && f > 0.5) throw new Error(`road ${r.id} point ${i}: t ${t.toFixed(2)} already ${f.toFixed(2)} of the way to the terrain`);
              if (t >= 0.75 && f < 0.5) throw new Error(`road ${r.id} point ${i}: t ${t.toFixed(2)} only ${f.toFixed(2)} of the way to the terrain`);
              if (t <= 0.25 || t >= 0.75) shaped++;
            }
          }
        }
      }
    }
    expect(under).toBeGreaterThan(1000);
    expect(bandPairs).toBeGreaterThan(100);
    expect(innerPairs).toBeGreaterThan(100);
    expect(outerPairs).toBeGreaterThan(100);
    expect(shaped).toBeGreaterThan(20);
  });

  // C20 (AC 17, door 5): um caso afirmado por faixa do carve - sob a pista, mistura, fora do alcance e sob ponte
  it('carve bands: under the road, blend, outside and under a bridge', () => {
    // terreno plano a 3 m, amostras a cada 1 m em x, z ∈ [-80, 80]; estrada reta em x = 0, y = 0, largura 10;
    // pontos a cada 2 m de z = -80 a 80, com os de z ≥ 20 em ponte
    const size = 161;
    const flat: Heightmap = { size, spacing: 1, origin: -80, heights: new Float32Array(size * size).fill(3) };
    const np = 81;
    const points = new Float32Array(np * 3);
    for (let i = 0; i < np; i++) points[i * 3 + 2] = -80 + i * 2;
    const road: Road = { id: 0, kind: 'hill', lanes: 2, width: 10, closed: false, points, bridges: [{ from: 50, to: 80 }] };
    const out = carveRoads(flat, { roads: [road] });
    const at = (x: number, z: number) => out.heights[(z + 80) * size + (x + 80)]!;
    // distância ao ponto fora de ponte mais próximo (z ≤ 18)
    const dist = (x: number, z: number) => Math.hypot(x, z - Math.max(-80, Math.min(18, 2 * Math.round(z / 2))));

    // sob a pista (d ≤ width/2): altura da estrada
    for (const x of [-5, -2, 0, 3, 5]) expect(at(x, -40), `x ${x}`).toBeCloseTo(0, 5);
    // mistura (width/2, width/2 + 6]: estritamente entre a pista e o terreno, subindo com a distância;
    // no 1.º quarto mais perto da pista, no último mais perto do terreno, e chega ao terreno em width/2 + 6
    let prev = 0;
    for (let x = 6; x <= 11; x++) {
      const h = at(x, -40);
      expect(at(-x, -40), `x ±${x} symmetric`).toBeCloseTo(h, 5);
      const t = (x - 5) / 6;
      if (x < 11) {
        expect(h, `x ${x}`).toBeGreaterThan(0);
        expect(h, `x ${x}`).toBeLessThan(3);
      }
      if (t <= 0.25) expect(h / 3, `x ${x}`).toBeLessThanOrEqual(0.5);
      if (t >= 0.75) expect(h / 3, `x ${x}`).toBeGreaterThanOrEqual(0.5);
      expect(h, `x ${x} rises`).toBeGreaterThan(prev);
      expect(h - prev, `x ${x} step`).toBeLessThanOrEqual(1.5);
      prev = h;
    }
    expect(at(11, -40)).toBeCloseTo(3, 5);
    // fora do alcance (d > width/2 + 6): terreno intacto
    for (let z = -80; z <= 80; z++) {
      for (let x = -80; x <= 80; x++) {
        if (dist(x, z) > 11) expect(at(x, z), `(${x}, ${z})`).toBe(3);
      }
    }
    // sob ponte (só pontos de ponte ao alcance): nada muda, nem no eixo
    let bridged = 0;
    for (let z = 30; z <= 80; z++) {
      for (let x = -11; x <= 11; x++) {
        expect(dist(x, z)).toBeGreaterThan(11);
        expect(at(x, z), `(${x}, ${z}) under the bridge`).toBe(3);
        bridged++;
      }
    }
    expect(bridged).toBeGreaterThan(1000);
    expect(flat.heights.every((h) => h === 3)).toBe(true);

    // no mundo do seed 1337: amostra longe de todo ponto fora de ponte (> width/2 + 6) fica com a altura crua,
    // inclusive as que só têm ponto de ponte ao alcance
    const n = hm.size;
    const touched = new Uint8Array(n * n);
    const nearBridge = new Uint8Array(n * n);
    for (const r of net.roads) {
      const reach = r.width / 2 + 6 + 0.01;
      for (let i = 0; i < count(r); i++) {
        const [px, , pz] = pt(r, i);
        const mark = inBridge(r, i) ? nearBridge : touched;
        const ix0 = Math.max(0, Math.ceil((px - reach + 1536) / 4));
        const ix1 = Math.min(n - 1, Math.floor((px + reach + 1536) / 4));
        const iz0 = Math.max(0, Math.ceil((pz - reach + 1536) / 4));
        const iz1 = Math.min(n - 1, Math.floor((pz + reach + 1536) / 4));
        for (let iz = iz0; iz <= iz1; iz++) {
          for (let ix = ix0; ix <= ix1; ix++) {
            if (Math.hypot(-1536 + ix * 4 - px, -1536 + iz * 4 - pz) <= reach) mark[iz * n + ix] = 1;
          }
        }
      }
    }
    let outside = 0;
    let underBridge = 0;
    for (let k = 0; k < n * n; k++) {
      if (touched[k]) continue;
      outside++;
      if (nearBridge[k]) underBridge++;
      if (carved.heights[k] !== hm.heights[k]) throw new Error(`sample ${k} out of reach changed: ${hm.heights[k]} -> ${carved.heights[k]}`);
    }
    expect(outside).toBeGreaterThan(500_000);
    expect(underBridge).toBeGreaterThan(500);
  });

  // C24 (AC 19)
  it('lamp posts every 40 m on both sides', () => {
    const { lamps, skipped } = generateLamps(net);
    let expected = 0;
    for (const r of net.roads) {
      const n = count(r);
      const bridge = new Array<boolean>(n).fill(false);
      for (const b of r.bridges) for (let i = b.from; i <= b.to; i++) bridge[i] = true;
      // trechos contínuos fora de ponte, recontados aqui a partir de `bridges`
      const runs: number[] = [];
      if (r.closed && r.bridges.length === 0) runs.push(n);
      else {
        const start = r.closed ? (r.bridges[0]!.to + 1) % n : 0;
        let run = 0;
        for (let k = 0; k < n; k++) {
          if (bridge[(start + k) % n]) {
            if (run) runs.push(run - 1);
            run = 0;
          } else run++;
        }
        if (run) runs.push(run - 1);
      }
      for (const segs of runs) expected += 2 * Math.floor((segs * 2) / 40);
    }
    expect(lamps.length + skipped.length).toBe(expected);
    expect(lamps.length).toBeGreaterThan(0);

    const all = [...lamps.map((l) => ({ l, kept: true })), ...skipped.map((l) => ({ l, kept: false }))];
    const groups = new Map<string, number[]>();
    for (const { l, kept } of all) {
      const road = net.roads[l.roadId]!;
      // a posição fica a width/2 + 1.5 do eixo e não num trecho de ponte
      let best = Infinity;
      let bi = 0;
      for (let i = 0; i < count(road); i++) {
        const [x, , z] = pt(road, i);
        const d = Math.hypot(x - l.x, z - l.z);
        if (d < best) {
          best = d;
          bi = i;
        }
      }
      expect(Math.abs(best - (road.width / 2 + 1.5))).toBeLessThan(0.25);
      expect(inBridge(road, bi), `lamp on bridge of road ${road.id}`).toBe(false);
      // night-city C2: o heading guardado é o do segmento da estrada sob o poste. Voltando do poste
      // para o eixo pela perpendicular desse heading, o ponto cai num segmento com esse mesmo heading
      const off = road.width / 2 + 1.5;
      const cx = l.x - l.side * Math.cos(l.heading) * off;
      const cz = l.z + l.side * Math.sin(l.heading) * off;
      let onSegment = false;
      const segs = road.closed ? count(road) : count(road) - 1;
      for (let i = 0; i < segs && !onSegment; i++) {
        const [ax, , az] = pt(road, i);
        const [bx, , bz] = pt(road, (i + 1) % count(road));
        const seg = Math.atan2(bx - ax, bz - az);
        const len = Math.hypot(bx - ax, bz - az);
        const t = ((cx - ax) * (bx - ax) + (cz - az) * (bz - az)) / (len * len);
        const dx = ax + (bx - ax) * t - cx;
        const dz = az + (bz - az) * t - cz;
        if (t >= -1e-6 && t <= 1 + 1e-6 && Math.hypot(dx, dz) < 1e-3 && Math.abs(Math.atan2(Math.sin(seg - l.heading), Math.cos(seg - l.heading))) <= 1e-6) onSegment = true;
      }
      expect(onSegment, `lamp heading of road ${road.id}`).toBe(true);
      // pulado ⇔ a ≤ width/2 + 1 do eixo de outra estrada
      let onOther = false;
      for (const other of net.roads) {
        if (other === road) continue;
        for (let i = 0; i < count(other); i++) {
          const [x, , z] = pt(other, i);
          if (Math.hypot(x - l.x, z - l.z) <= other.width / 2 + 1) onOther = true;
        }
      }
      expect(onOther).toBe(!kept);
      const key = `${l.roadId}:${l.side}:${l.stretch}`;
      groups.set(key, [...(groups.get(key) ?? []), l.along]);
    }
    for (const [key, along] of groups) {
      along.sort((a, b) => a - b);
      for (let i = 1; i < along.length; i++) {
        expect(Math.abs(along[i]! - along[i - 1]! - 40), key).toBeLessThanOrEqual(0.5);
      }
    }
  });
});
