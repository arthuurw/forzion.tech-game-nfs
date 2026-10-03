import * as THREE from 'three';
import { CHUNK_BUILD_M, CHUNK_SIZE, CHUNKS_PER_SIDE, chunkCenter, chunkOf, planChunks } from './chunks';
import type { Road, RoadNetwork } from './roads/RoadGenerator';
import { bridgeMeshes, bridgeRuns, extrudeAlong, pillarBox, type BridgeParts } from './roads/bridges';
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
/** linhas de terreno (das 129 de um chunk) por fatia do build (smooth-world door 3) */
export const TERRAIN_BAND_ROWS = 33;

/** arrays do terreno de um chunk, preenchidos faixa a faixa */
interface TerrainArrays {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  bounce: Float32Array;
  zones: Float32Array;
  interior: Uint8Array;
}

/** build de um chunk em andamento: a próxima fatia é a faixa de terreno `row`, depois `roads`, depois `bridges` */
interface ChunkJob {
  id: number;
  group: THREE.Group;
  /** linhas de terreno por fatia (`TERRAIN_BAND_ROWS`; 129 = o terreno inteiro numa fatia) */
  band: number;
  row: number;
  stage: 'terrain' | 'roads' | 'bridges';
  terrain: TerrainArrays;
}

/**
 * Streaming das malhas do mundo por chunks de 512 m (door 7 da city-terrain).
 * A cada frame pergunta a `planChunks` o que construir (no máximo 1) e o que
 * descartar, e monta por chunk: terreno (129 × 129 vértices, sem as células
 * do centro, que ficam sob o espelho), asfalto (do centro e de fora),
 * calçadas do centro e pontes. Colisão não passa por aqui: está toda no boot.
 *
 * smooth-world door 3: o build de um chunk é uma sequência de fatias (o
 * terreno em faixas de até 33 linhas, depois estradas e calçadas, depois
 * pontes e pilares) e cada `update` roda no máximo uma; o chunk entra na cena
 * quando a última termina. No boot, `prebuild` monta de uma vez os chunks a
 * até 900 m do spawn, antes do primeiro quadro.
 */
export class ChunkManager {
  readonly loaded = new Map<number, THREE.Group>();
  /** maior número de fatias de build entre dois `endFrame` (door 3: no máximo 1 por quadro) */
  maxSlicesInOneFrame = 0;
  /** fatias de build rodadas pelo `update` */
  slices = 0;
  /** chunks que o `update` terminou de montar (o `prebuild` não conta) */
  builds = 0;
  /** chunks montados de uma vez pelo `prebuild` do boot */
  readonly prebuilt: number[] = [];
  private slicesAtFrameStart = 0;
  private job: ChunkJob | null = null;
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

  /** Monta de uma vez, sem contar como fatia nem build, todo chunk a até 900 m de (x, z) (boot, door 3). */
  prebuild(x: number, z: number): void {
    for (let id = 0; id < CHUNKS_PER_SIDE * CHUNKS_PER_SIDE; id++) {
      const [cx, cz] = chunkCenter(id);
      if (this.loaded.has(id) || Math.hypot(cx - x, cz - z) > CHUNK_BUILD_M) continue;
      this.add(id, this.buildNow(id));
      this.prebuilt.push(id);
    }
  }

  /** O build de uma vez de um chunk (o terreno numa fatia só), sem pôr na cena. */
  buildNow(id: number): THREE.Group {
    const job = this.startJob(id, CHUNK_SIZE / this.carved.spacing + 1);
    while (!this.runSlice(job));
    return job.group;
  }

  /**
   * Descarta os chunks longe do carro e roda no máximo uma fatia do build em andamento, ou do
   * chunk mais perto que falta (door 3); o chunk entra na cena quando a última fatia termina.
   */
  update(carX: number, carZ: number): void {
    const planned = new Set(this.loaded.keys());
    if (this.job) planned.add(this.job.id);
    const plan = planChunks(carX, carZ, planned);
    for (const id of plan.dispose) {
      const group = this.loaded.get(id);
      if (!group) continue;
      this.dropped.push(group.userData.disposal);
      if (this.dropped.length > 64) this.dropped.shift();
      this.scene.remove(group);
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      this.loaded.delete(id);
    }
    if (!this.job && plan.build.length > 0) this.job = this.startJob(plan.build[0]!, TERRAIN_BAND_ROWS);
    const job = this.job;
    if (!job) return;
    this.slices++;
    if (!this.runSlice(job)) return;
    this.job = null;
    this.add(job.id, job.group);
    this.builds++;
  }

  /** Fecha o quadro: guarda quantas fatias rodaram desde o `endFrame` anterior. */
  endFrame(): void {
    this.maxSlicesInOneFrame = Math.max(this.maxSlicesInOneFrame, this.slices - this.slicesAtFrameStart);
    this.slicesAtFrameStart = this.slices;
  }

  private add(id: number, group: THREE.Group): void {
    this.scene.add(group);
    this.loaded.set(id, group);
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

  private startJob(id: number, band: number): ChunkJob {
    const group = new THREE.Group();
    group.name = `chunk-${id}`;
    const cx = id % CHUNKS_PER_SIDE;
    const cz = Math.floor(id / CHUNKS_PER_SIDE);
    const x0 = this.carved.origin + cx * CHUNK_SIZE;
    const z0 = this.carved.origin + cz * CHUNK_SIZE;
    group.userData.downtown = x0 < DOWNTOWN_HALF && x0 + CHUNK_SIZE > -DOWNTOWN_HALF && z0 < DOWNTOWN_HALF && z0 + CHUNK_SIZE > -DOWNTOWN_HALF;
    const side = CHUNK_SIZE / this.carved.spacing + 1; // 129
    const terrain: TerrainArrays = {
      positions: new Float32Array(side * side * 3),
      normals: new Float32Array(side * side * 3),
      colors: new Float32Array(side * side * 3),
      // block-fill: peso da luz rebatida e zona de cada vértice (−1 fora do miolo)
      bounce: new Float32Array(side * side),
      zones: new Float32Array(side * side).fill(-1),
      interior: new Uint8Array(side * side),
    };
    return { id, group, band, row: 0, stage: 'terrain', terrain };
  }

  /** Roda a próxima fatia do build; verdadeiro quando o chunk ficou pronto. */
  private runSlice(job: ChunkJob): boolean {
    const cx = job.id % CHUNKS_PER_SIDE;
    const cz = Math.floor(job.id / CHUNKS_PER_SIDE);
    if (job.stage === 'terrain') {
      const side = CHUNK_SIZE / this.carved.spacing + 1;
      const end = Math.min(side, job.row + job.band);
      this.terrainRows(cx, cz, job.row, end, job.terrain);
      job.row = end;
      if (end < side) return false;
      const terrain = this.terrainMesh(cx, cz, job.terrain);
      if (terrain) job.group.add(terrain);
      job.stage = 'roads';
      return false;
    }
    if (job.stage === 'roads') {
      this.roadMeshes(job.id, job.group);
      job.stage = 'bridges';
      return false;
    }
    this.bridgeMesh(job.id, job.group);
    const disposal = { id: job.id, geometries: 0, disposed: 0 };
    job.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      disposal.geometries++;
      o.geometry.addEventListener('dispose', () => disposal.disposed++);
    });
    job.group.userData.disposal = disposal;
    return true;
  }

  /** Fatia de estradas e calçadas: asfalto do centro e de fora, calçadas do centro. */
  private roadMeshes(id: number, group: THREE.Group): void {
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
    const meshes: Array<[MeshBuilder, THREE.Material, string]> = [
      [downtownRoads, this.materials.roadDowntown, 'road-downtown'],
      [outerRoads, this.materials.roadOuter, 'road-outer'],
      [sidewalks, this.materials.sidewalk, 'sidewalk'],
    ];
    for (const [builder, material, name] of meshes) addMesh(group, builder, material, name);
  }

  /** Fatia de pontes: tabuleiros, guarda-corpos e pilares deste chunk. */
  private bridgeMesh(id: number, group: THREE.Group): void {
    const bridges = new MeshBuilder();
    for (const { road, parts } of this.bridges) {
      // os trechos deste chunk, com um ponto a mais para emendar com o vizinho (na ordem da ponte: n−1 → 0 conta)
      for (const run of bridgeRuns(parts.indices, (i) => this.pointChunk(road, i) === id)) {
        const { deck, rails } = bridgeMeshes(road, { indices: run, pillars: [] });
        for (const m of [deck, ...rails]) bridges.add(m.positions, m.indices);
      }
      for (const p of parts.pillars) {
        if (chunkOf(p.x, p.z) !== id) continue;
        const box = pillarBox(p.x, p.z, p.bottom, p.top, p.heading);
        bridges.add(box.positions, box.indices);
      }
    }
    addMesh(group, bridges, this.materials.bridge, 'bridge');
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

  /** Fatia de terreno: as linhas de vértices `z0..z1-1` do chunk (posição, normal, cor, luz rebatida, zona). */
  private terrainRows(cx: number, cz: number, z0: number, z1: number, t: TerrainArrays): void {
    const hm = this.carved;
    const cells = CHUNK_SIZE / hm.spacing; // 128
    const side = cells + 1; // 129
    const ix0 = cx * cells;
    const iz0 = cz * cells;
    const { positions, normals, colors, bounce, zones, interior } = t;
    const n = hm.size;
    const H = (ix: number, iz: number) =>
      hm.heights[Math.min(n - 1, Math.max(0, iz)) * n + Math.min(n - 1, Math.max(0, ix))]!;
    const bi = this.interiors;
    for (let z = z0; z < z1; z++) {
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
  }

  /** Malha de terreno do chunk com as linhas já preenchidas; null sem célula para desenhar. */
  private terrainMesh(cx: number, cz: number, t: TerrainArrays): THREE.Mesh | null {
    const hm = this.carved;
    const cells = CHUNK_SIZE / hm.spacing; // 128
    const side = cells + 1; // 129
    const ix0 = cx * cells;
    const iz0 = cz * cells;
    const { positions, normals, colors, bounce, zones, interior } = t;
    // índices num array tipado do tamanho máximo: a fatia final do terreno cabe no orçamento (door 3)
    const indices = side * side <= 0xffff ? new Uint16Array(cells * cells * 6) : new Uint32Array(cells * cells * 6);
    let count = 0;
    const tri = (a: number, b: number, c: number) => {
      indices[count++] = a;
      indices[count++] = b;
      indices[count++] = c;
    };
    for (let z = 0; z < cells; z++) {
      for (let x = 0; x < cells; x++) {
        const wx = hm.origin + (ix0 + x) * hm.spacing;
        const wz = hm.origin + (iz0 + z) * hm.spacing;
        const a = z * side + x;
        // células inteiramente no centro ficam sob o espelho, menos o pátio do miolo (block-fill):
        // cada triângulo com os 3 vértices no miolo é desenhado
        if (wx >= -DOWNTOWN_HALF && wx + hm.spacing <= DOWNTOWN_HALF && wz >= -DOWNTOWN_HALF && wz + hm.spacing <= DOWNTOWN_HALF) {
          if (interior[a] && interior[a + side] && interior[a + 1]) tri(a, a + side, a + 1);
          if (interior[a + 1] && interior[a + side] && interior[a + side + 1]) tri(a + 1, a + side, a + side + 1);
          continue;
        }
        tri(a, a + side, a + 1);
        tri(a + 1, a + side, a + side + 1);
      }
    }
    if (count === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aBounce', new THREE.BufferAttribute(bounce, 1));
    geometry.setAttribute('aZone', new THREE.BufferAttribute(zones, 1));
    geometry.setIndex(new THREE.BufferAttribute(indices.slice(0, count), 1));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.materials.terrain);
    mesh.name = 'terrain';
    return mesh;
  }
}

/** Põe na `group` a malha do `builder` (se houver triângulos), com o nome dado. */
function addMesh(group: THREE.Group, builder: MeshBuilder, material: THREE.Material, name: string): void {
  const mesh = builder.mesh(material);
  if (!mesh) return;
  mesh.name = name;
  group.add(mesh);
}

function gridKey(x: number, z: number): number {
  return Math.floor((x + 2048) / 32) * 1024 + Math.floor((z + 2048) / 32);
}

/** Junta várias malhas (mesmos atributos) numa só geometria. */
class MeshBuilder {
  private readonly parts: Array<{ positions: ArrayLike<number>; indices: ArrayLike<number>; extra?: { uv: ArrayLike<number>; width: ArrayLike<number> } }> = [];
  private vertices = 0;
  private triangles = 0;

  add(positions: ArrayLike<number>, indices: ArrayLike<number>, extra?: { uv: ArrayLike<number>; width: ArrayLike<number> }): void {
    this.parts.push({ positions, indices, extra });
    this.vertices += positions.length / 3;
    this.triangles += indices.length / 3;
  }

  /** As partes numa geometria só, copiadas em arrays tipados (sem `push` por número: cabe numa fatia, door 3). */
  mesh(material: THREE.Material): THREE.Mesh | null {
    if (this.triangles === 0) return null;
    const positions = new Float32Array(this.vertices * 3);
    const indices = new Uint32Array(this.triangles * 3);
    const hasUv = this.parts.some((p) => p.extra);
    const uvs = hasUv ? new Float32Array(this.vertices * 2) : null;
    const widths = hasUv ? new Float32Array(this.vertices) : null;
    let v = 0;
    let t = 0;
    for (const p of this.parts) {
      positions.set(p.positions, v * 3);
      for (let i = 0; i < p.indices.length; i++) indices[t + i] = p.indices[i]! + v;
      if (p.extra) {
        uvs!.set(p.extra.uv, v * 2);
        widths!.set(p.extra.width, v);
      }
      v += p.positions.length / 3;
      t += p.indices.length;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (uvs && widths) {
      g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      g.setAttribute('aWidth', new THREE.BufferAttribute(widths, 1));
    }
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.setAttribute('normal', new THREE.BufferAttribute(vertexNormals(positions, indices), 3));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, material);
  }
}

/**
 * Normais por vértice como o `computeVertexNormals` do three (soma das normais dos triângulos do
 * vértice, normalizada), direto nos arrays tipados: sem um `Vector3` por leitura, cabe na fatia.
 */
function vertexNormals(p: Float32Array, indices: Uint32Array): Float32Array {
  const n = new Float32Array(p.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]! * 3;
    const b = indices[t + 1]! * 3;
    const c = indices[t + 2]! * 3;
    // (c − b) × (a − b), como o three
    const cbx = p[c]! - p[b]!;
    const cby = p[c + 1]! - p[b + 1]!;
    const cbz = p[c + 2]! - p[b + 2]!;
    const abx = p[a]! - p[b]!;
    const aby = p[a + 1]! - p[b + 1]!;
    const abz = p[a + 2]! - p[b + 2]!;
    const nx = cby * abz - cbz * aby;
    const ny = cbz * abx - cbx * abz;
    const nz = cbx * aby - cby * abx;
    n[a] = n[a]! + nx;
    n[a + 1] = n[a + 1]! + ny;
    n[a + 2] = n[a + 2]! + nz;
    n[b] = n[b]! + nx;
    n[b + 1] = n[b + 1]! + ny;
    n[b + 2] = n[b + 2]! + nz;
    n[c] = n[c]! + nx;
    n[c + 1] = n[c + 1]! + ny;
    n[c + 2] = n[c + 2]! + nz;
  }
  for (let i = 0; i < n.length; i += 3) {
    const len = Math.hypot(n[i]!, n[i + 1]!, n[i + 2]!);
    if (len === 0) continue;
    n[i] = n[i]! / len;
    n[i + 1] = n[i + 1]! / len;
    n[i + 2] = n[i + 2]! / len;
  }
  return n;
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
