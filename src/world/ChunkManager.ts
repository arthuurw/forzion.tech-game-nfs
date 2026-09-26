import * as THREE from 'three';
import { CHUNK_SIZE, CHUNKS_PER_SIDE, chunkOf, planChunks } from './chunks';
import type { Road, RoadNetwork } from './roads/RoadGenerator';
import { bridgeMeshes, extrudeAlong, pillarBox, type BridgeParts } from './roads/bridges';
import { roadStripGeometry } from './roads/roadMesh';
import type { Heightmap } from './terrain/TerrainGenerator';
import type { BlockInteriors } from './interiors/BlockInteriors';
import { bounceWeight, terrainColor, terrainNoise, type GroundKind } from './interiors/interiorMotion';
import { DOWNTOWN_HALF } from './worldMath';

/** o pátio do centro fica um pouco acima do espelho da rua (y = 0) para não brigar com ele */
export const PATIO_LIFT = 0.03;

export interface ChunkMaterials {
  terrain: THREE.Material;
  roadDowntown: THREE.Material;
  roadOuter: THREE.Material;
  sidewalk: THREE.Material;
  bridge: THREE.Material;
}

const SIDEWALK_WIDTH = 5;
const SIDEWALK_HEIGHT = 0.12;

/**
 * Streaming das malhas do mundo por chunks de 512 m (door 7 da city-terrain).
 * A cada frame pergunta a `planChunks` o que construir (no máximo 1) e o que
 * descartar, e monta por chunk: terreno (129 × 129 vértices, sem as células
 * do centro, que ficam sob o espelho), asfalto (do centro e de fora),
 * calçadas do centro e pontes. Colisão não passa por aqui: está toda no boot.
 */
export class ChunkManager {
  readonly loaded = new Map<number, THREE.Group>();
  maxBuildsInOneFrame = 0;
  builds = 0;
  /**
   * Últimos chunks descartados: quantas geometrias cada um tinha e quantas já
   * emitiram o evento `dispose` do three (door 7; lido por C37).
   */
  readonly dropped: Array<{ id: number; geometries: number; disposed: number }> = [];
  private readonly bridges: Array<{ road: Road; parts: BridgeParts }>;
  /** pontos de estrada por célula de 32 m: [x, z, meia largura, id da estrada, ...] */
  private readonly grid = new Map<number, number[]>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly carved: Heightmap,
    private readonly network: RoadNetwork,
    bridges: Array<{ road: Road; parts: BridgeParts }>,
    private readonly materials: ChunkMaterials,
    /** miolo das quadras (block-fill): cor, luz rebatida e pátio do centro; null = terreno de antes */
    private readonly interiors: BlockInteriors | null = null,
    private readonly seed = 0,
  ) {
    this.bridges = bridges;
    for (const road of network.roads) {
      const p = road.points;
      for (let i = 0; i < p.length; i += 3) {
        const k = gridKey(p[i]!, p[i + 2]!);
        let c = this.grid.get(k);
        if (!c) this.grid.set(k, (c = []));
        c.push(p[i]!, p[i + 2]!, road.width / 2, road.id);
      }
    }
  }

  update(carX: number, carZ: number): void {
    const plan = planChunks(carX, carZ, new Set(this.loaded.keys()));
    for (const id of plan.dispose) {
      const group = this.loaded.get(id)!;
      this.dropped.push(group.userData.disposal);
      if (this.dropped.length > 64) this.dropped.shift();
      this.scene.remove(group);
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      this.loaded.delete(id);
    }
    this.maxBuildsInOneFrame = Math.max(this.maxBuildsInOneFrame, plan.build.length);
    for (const id of plan.build) {
      const group = this.build(id);
      this.scene.add(group);
      this.loaded.set(id, group);
      this.builds++;
    }
  }

  /**
   * Só DEV/testes (block-fill C9, C10): cor, peso da luz rebatida e zona que a
   * malha de terreno carregada guarda no vértice (ix, iz) da grade; null se o
   * chunk dele não está carregado.
   */
  terrainVertex(ix: number, iz: number): { color: [number, number, number]; bounce: number; zone: number; y: number } | null {
    const cells = CHUNK_SIZE / this.carved.spacing;
    const cx = Math.min(CHUNKS_PER_SIDE - 1, Math.floor(ix / cells));
    const cz = Math.min(CHUNKS_PER_SIDE - 1, Math.floor(iz / cells));
    const group = this.loaded.get(cz * CHUNKS_PER_SIDE + cx);
    const mesh = group?.getObjectByName('terrain') as THREE.Mesh | undefined;
    if (!mesh) return null;
    const k = (iz - cz * cells) * (cells + 1) + (ix - cx * cells);
    const g = mesh.geometry;
    const c = g.getAttribute('color');
    return {
      color: [c.getX(k), c.getY(k), c.getZ(k)],
      bounce: g.getAttribute('aBounce').getX(k),
      zone: g.getAttribute('aZone').getX(k),
      y: g.getAttribute('position').getY(k),
    };
  }

  /** Objetos de chunk fora do centro (o espelho do centro pode ignorá-los). */
  outerObjects(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const g of this.loaded.values()) if (!g.userData.downtown) out.push(g);
    return out;
  }

  private build(id: number): THREE.Group {
    const group = new THREE.Group();
    group.name = `chunk-${id}`;
    const cx = id % CHUNKS_PER_SIDE;
    const cz = Math.floor(id / CHUNKS_PER_SIDE);
    const x0 = this.carved.origin + cx * CHUNK_SIZE;
    const z0 = this.carved.origin + cz * CHUNK_SIZE;
    group.userData.downtown = x0 < DOWNTOWN_HALF && x0 + CHUNK_SIZE > -DOWNTOWN_HALF && z0 < DOWNTOWN_HALF && z0 + CHUNK_SIZE > -DOWNTOWN_HALF;

    const terrain = this.terrainMesh(cx, cz);
    if (terrain) group.add(terrain);

    const downtownRoads = new MeshBuilder();
    const outerRoads = new MeshBuilder();
    const sidewalks = new MeshBuilder();
    for (const road of this.network.roads) {
      for (const [from, to, downtown] of this.runsInChunk(road, id)) {
        const strip = roadStripGeometry(road, from, to);
        (downtown ? downtownRoads : outerRoads).add(strip.positions, strip.indices, { uv: strip.uvs, width: strip.widths });
        if (downtown) {
          for (const side of [1, -1]) {
            const idx = this.sidewalkIndices(road, from, to, side);
            for (const run of splitRuns(idx)) {
              if (run.length < 2) continue;
              const box = extrudeAlong(road, run, side * (road.width / 2 + SIDEWALK_WIDTH / 2), SIDEWALK_WIDTH / 2, -0.05, SIDEWALK_HEIGHT);
              sidewalks.add(box.positions, box.indices);
            }
          }
        }
      }
    }
    const bridges = new MeshBuilder();
    for (const { road, parts } of this.bridges) {
      const mine = parts.indices.filter((i) => this.pointChunk(road, i) === id);
      for (const run of splitRuns(mine)) {
        // um ponto a mais para emendar com o chunk vizinho
        const last = run[run.length - 1]!;
        if (parts.indices.includes(last + 1)) run.push(last + 1);
        if (run.length < 2) continue;
        const { deck, rails } = bridgeMeshes(road, { indices: run, pillars: [] });
        for (const m of [deck, ...rails]) bridges.add(m.positions, m.indices);
      }
      for (const p of parts.pillars) {
        if (chunkOf(p.x, p.z) !== id) continue;
        const box = pillarBox(p.x, p.z, p.bottom, p.top, p.heading);
        bridges.add(box.positions, box.indices);
      }
    }
    const meshes: Array<[MeshBuilder, THREE.Material, string]> = [
      [downtownRoads, this.materials.roadDowntown, 'road-downtown'],
      [outerRoads, this.materials.roadOuter, 'road-outer'],
      [sidewalks, this.materials.sidewalk, 'sidewalk'],
      [bridges, this.materials.bridge, 'bridge'],
    ];
    for (const [builder, material, name] of meshes) {
      const mesh = builder.mesh(material);
      if (!mesh) continue;
      mesh.name = name;
      group.add(mesh);
    }
    const disposal = { id, geometries: 0, disposed: 0 };
    group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      disposal.geometries++;
      o.geometry.addEventListener('dispose', () => disposal.disposed++);
    });
    group.userData.disposal = disposal;
    return group;
  }

  private pointChunk(road: Road, i: number): number {
    return chunkOf(road.points[i * 3]!, road.points[i * 3 + 2]!);
  }

  /** Trechos `[from, to, doCentro]` cujos segmentos começam neste chunk (to pode passar de n numa estrada fechada). */
  private runsInChunk(road: Road, id: number): Array<[number, number, boolean]> {
    const p = road.points;
    const n = p.length / 3;
    const segs = road.closed ? n : n - 1;
    const runs: Array<[number, number, boolean]> = [];
    let start = -1;
    let startDowntown = false;
    for (let i = 0; i <= segs; i++) {
      let inside = false;
      let downtown = false;
      if (i < segs) {
        const j = (i + 1) % n;
        const mx = (p[i * 3]! + p[j * 3]!) / 2;
        const mz = (p[i * 3 + 2]! + p[j * 3 + 2]!) / 2;
        inside = chunkOf(mx, mz) === id;
        downtown = Math.max(Math.abs(mx), Math.abs(mz)) <= DOWNTOWN_HALF;
      }
      if (start >= 0 && (!inside || downtown !== startDowntown)) {
        runs.push([start, i, startDowntown]);
        start = -1;
      }
      if (inside && start < 0) {
        start = i;
        startDowntown = downtown;
      }
    }
    return runs;
  }

  /** Índices de `from..to` onde a calçada do lado `side` não invade outra estrada. */
  private sidewalkIndices(road: Road, from: number, to: number, side: number): number[] {
    const p = road.points;
    const n = p.length / 3;
    const out: number[] = [];
    for (let k = from; k <= to; k++) {
      const i = k % n;
      const j = Math.min(n - 1, i + 1);
      const a = Math.max(0, i - 1);
      const h = Math.atan2(p[j * 3]! - p[a * 3]!, p[j * 3 + 2]! - p[a * 3 + 2]!);
      const off = road.width / 2 + SIDEWALK_WIDTH / 2;
      const x = p[i * 3]! + Math.cos(h) * off * side;
      const z = p[i * 3 + 2]! - Math.sin(h) * off * side;
      if (!this.onOtherRoad(road, x, z, SIDEWALK_WIDTH / 2 + 1)) out.push(i);
    }
    return out;
  }

  private onOtherRoad(self: Road, x: number, z: number, margin: number): boolean {
    const cx = Math.floor((x + 2048) / 32);
    const cz = Math.floor((z + 2048) / 32);
    for (let a = cx - 1; a <= cx + 1; a++) {
      for (let b = cz - 1; b <= cz + 1; b++) {
        const c = this.grid.get(a * 1024 + b);
        if (!c) continue;
        for (let i = 0; i < c.length; i += 4) {
          if (c[i + 3] === self.id) continue;
          const r = c[i + 2]! + margin;
          if ((c[i]! - x) ** 2 + (c[i + 1]! - z) ** 2 < r * r) return true;
        }
      }
    }
    return false;
  }

  private terrainMesh(cx: number, cz: number): THREE.Mesh | null {
    const hm = this.carved;
    const cells = CHUNK_SIZE / hm.spacing; // 128
    const side = cells + 1; // 129
    const ix0 = cx * cells;
    const iz0 = cz * cells;
    const positions = new Float32Array(side * side * 3);
    const normals = new Float32Array(side * side * 3);
    const colors = new Float32Array(side * side * 3);
    // block-fill: peso da luz rebatida e zona de cada vértice (−1 fora do miolo)
    const bounce = new Float32Array(side * side);
    const zones = new Float32Array(side * side).fill(-1);
    const interior = new Uint8Array(side * side);
    const n = hm.size;
    const H = (ix: number, iz: number) =>
      hm.heights[Math.min(n - 1, Math.max(0, iz)) * n + Math.min(n - 1, Math.max(0, ix))]!;
    const bi = this.interiors;
    for (let z = 0; z < side; z++) {
      for (let x = 0; x < side; x++) {
        const ix = ix0 + x;
        const iz = iz0 + z;
        const k = z * side + x;
        const h = H(ix, iz);
        positions[k * 3] = hm.origin + ix * hm.spacing;
        positions[k * 3 + 1] = h;
        positions[k * 3 + 2] = hm.origin + iz * hm.spacing;
        // normal pela diferença central do heightmap: sem emenda entre chunks
        const dx = (H(ix + 1, iz) - H(ix - 1, iz)) / (2 * hm.spacing);
        const dz = (H(ix, iz + 1) - H(ix, iz - 1)) / (2 * hm.spacing);
        const len = Math.hypot(dx, 1, dz);
        normals[k * 3] = -dx / len;
        normals[k * 3 + 1] = 1 / len;
        normals[k * 3 + 2] = -dz / len;
        const slope = Math.hypot(dx, dz);
        let kind: GroundKind = 'none';
        const inGrid = ix < n && iz < n;
        if (bi && inGrid) {
          const zone = bi.zoneOf[iz * n + ix]!;
          if (zone >= 0) {
            kind = bi.zones[zone]!.kind;
            zones[k] = zone;
            interior[k] = 1;
            bounce[k] = bounceWeight(zone, bi.facadeDist[iz * n + ix]!);
          }
        }
        const vx = hm.origin + ix * hm.spacing;
        const vz = hm.origin + iz * hm.spacing;
        colors.set(terrainColor(h, slope, terrainNoise(this.seed, vx, vz), kind), k * 3);
        if (kind === 'downtown' && Math.abs(vx) <= DOWNTOWN_HALF && Math.abs(vz) <= DOWNTOWN_HALF) positions[k * 3 + 1] = h + PATIO_LIFT;
      }
    }
    const indices: number[] = [];
    for (let z = 0; z < cells; z++) {
      for (let x = 0; x < cells; x++) {
        const wx = hm.origin + (ix0 + x) * hm.spacing;
        const wz = hm.origin + (iz0 + z) * hm.spacing;
        const a = z * side + x;
        // células inteiramente no centro ficam sob o espelho, menos o pátio do miolo (block-fill):
        // cada triângulo com os 3 vértices no miolo é desenhado
        if (wx >= -DOWNTOWN_HALF && wx + hm.spacing <= DOWNTOWN_HALF && wz >= -DOWNTOWN_HALF && wz + hm.spacing <= DOWNTOWN_HALF) {
          if (interior[a] && interior[a + side] && interior[a + 1]) indices.push(a, a + side, a + 1);
          if (interior[a + 1] && interior[a + side] && interior[a + side + 1]) indices.push(a + 1, a + side, a + side + 1);
          continue;
        }
        indices.push(a, a + side, a + 1, a + 1, a + side, a + side + 1);
      }
    }
    if (indices.length === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aBounce', new THREE.BufferAttribute(bounce, 1));
    geometry.setAttribute('aZone', new THREE.BufferAttribute(zones, 1));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.materials.terrain);
    mesh.name = 'terrain';
    return mesh;
  }
}

function gridKey(x: number, z: number): number {
  return Math.floor((x + 2048) / 32) * 1024 + Math.floor((z + 2048) / 32);
}

/** Junta várias malhas (mesmos atributos) numa só geometria. */
class MeshBuilder {
  private readonly positions: number[] = [];
  private readonly indices: number[] = [];
  private readonly uvs: number[] = [];
  private readonly widths: number[] = [];
  private hasUv = false;

  add(positions: ArrayLike<number>, indices: ArrayLike<number>, extra?: { uv: ArrayLike<number>; width: ArrayLike<number> }): void {
    const base = this.positions.length / 3;
    for (let i = 0; i < positions.length; i++) this.positions.push(positions[i]!);
    for (let i = 0; i < indices.length; i++) this.indices.push(indices[i]! + base);
    if (extra) {
      this.hasUv = true;
      for (let i = 0; i < extra.uv.length; i++) this.uvs.push(extra.uv[i]!);
      for (let i = 0; i < extra.width.length; i++) this.widths.push(extra.width[i]!);
    }
  }

  mesh(material: THREE.Material): THREE.Mesh | null {
    if (this.indices.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    if (this.hasUv) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
      g.setAttribute('aWidth', new THREE.Float32BufferAttribute(this.widths, 1));
    }
    g.setIndex(this.indices);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return new THREE.Mesh(g, material);
  }
}

function splitRuns(idx: number[]): number[][] {
  const runs: number[][] = [];
  let cur: number[] = [];
  for (const i of idx) {
    if (cur.length && i !== cur[cur.length - 1]! + 1) {
      runs.push(cur);
      cur = [];
    }
    cur.push(i);
  }
  if (cur.length) runs.push(cur);
  return runs;
}
