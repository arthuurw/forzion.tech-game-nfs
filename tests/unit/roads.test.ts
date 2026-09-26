import { describe, expect, it } from 'vitest';
import { generateTerrain } from '../../src/world/terrain/TerrainGenerator';
import { carveRoads } from '../../src/world/terrain/carveRoads';
import { ROAD_SPECS, generateRoads, type Road } from '../../src/world/roads/RoadGenerator';
import { generateLamps } from '../../src/world/roads/roadMesh';

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
  it('road network is deterministic', () => {
    const again = generateRoads(1337, hm);
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
    }
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
    for (const r of net.roads) {
      const w2 = r.width / 2;
      const np = count(r);
      for (let i = 0; i < np; i += 5) {
        if (inBridge(r, i)) continue;
        const [px, py, pz] = pt(r, i);
        // amostras cuja seção transversal é o ponto i (o ponto mais próximo da estrada entre i−8 e i+8 é o próprio i)
        const cross = new Map<number, number>();
        const reach = w2 + 6;
        const ix0 = Math.max(0, Math.ceil((px - reach + 1536) / 4));
        const ix1 = Math.min(n - 1, Math.floor((px + reach + 1536) / 4));
        const iz0 = Math.max(0, Math.ceil((pz - reach + 1536) / 4));
        const iz1 = Math.min(n - 1, Math.floor((pz + reach + 1536) / 4));
        for (let iz = iz0; iz <= iz1; iz++) {
          for (let ix = ix0; ix <= ix1; ix++) {
            const sx = -1536 + ix * 4;
            const sz = -1536 + iz * 4;
            const d = Math.hypot(sx - px, sz - pz);
            if (d > reach) continue;
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
            cross.set(iz * n + ix, d);
          }
        }
        for (const [k, d] of cross) {
          if (d <= w2) {
            under++;
            const h = carved.heights[k]!;
            if (Math.abs(h - py) > 0.3) throw new Error(`road ${r.id} point ${i}: sample ${k} at ${d.toFixed(2)} m is ${h} vs ${py}`);
          } else {
            for (const nb of [k + 1, k - 1, k + n, k - n]) {
              const dn = cross.get(nb);
              if (dn === undefined || dn <= w2) continue;
              bandPairs++;
              const step = Math.abs(carved.heights[k]! - carved.heights[nb]!);
              if (step > 1.5) throw new Error(`road ${r.id} point ${i}: band step ${step}`);
            }
          }
        }
      }
    }
    expect(under).toBeGreaterThan(1000);
    expect(bandPairs).toBeGreaterThan(100);
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
