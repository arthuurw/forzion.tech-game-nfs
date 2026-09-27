import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowOnly, mergeWithGlow } from '../interiors/InteriorScene';
import { WAGONS, WAGON_LENGTH, trainPose } from '../interiors/interiorMotion';
import { heightAt, type Heightmap } from '../terrain/TerrainGenerator';
import { COLUMN_HALF, DECK_HEIGHT, DECK_THICKNESS, DECK_WIDTH, frameColumns, lineCumulative, type TrainLine } from './trainLine';

/** altura do guarda-corpo e da viga do portal (m) */
const RAIL_HEIGHT = 1;
const RAIL_WIDTH = 0.12;
const BEAM_HEIGHT = 0.8;
const BEAM_DEPTH = 0.6;
/** vagão: largura, altura e folga sobre o deck (m) */
const WAGON_WIDTH = 2.6;
const WAGON_HEIGHT = 3;
const WAGON_LIFT = 0.4;
const WINDOW_HEIGHT = 1;
const WINDOW_Y = 2.1;

/**
 * Render do trem elevado (block-life-extras): o viaduto (deck + guarda-corpos +
 * portais) numa malha só e os 3 vagões numa `InstancedMesh` com a faixa de
 * janelas emissiva. A pose vem de `trainPose` com o tempo da física.
 */
export class TrainScene {
  readonly group = new THREE.Group();
  readonly lineMesh: THREE.Mesh;
  readonly wagons: THREE.InstancedMesh;
  readonly windowMaterial: THREE.MeshStandardMaterial;
  /** posição de cada vagão ao longo da linha na última atualização (m) */
  readonly s: number[] = Array.from({ length: WAGONS }, () => 0);
  private readonly cum: Float32Array;
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly pos = new THREE.Vector3();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(
    readonly line: TrainLine,
    carved: Heightmap,
  ) {
    this.cum = lineCumulative(line);
    const concrete = new THREE.MeshStandardMaterial({ color: '#6a6c74', roughness: 0.85, metalness: 0.05 });
    this.lineMesh = new THREE.Mesh(buildViaduct(line, carved), concrete);
    this.lineMesh.name = 'train-line';

    // vagão: caixa azul escura sobre o deck com uma faixa de janelas de cada lado
    const body = new THREE.BoxGeometry(WAGON_WIDTH, WAGON_HEIGHT, WAGON_LENGTH);
    body.translate(0, WAGON_LIFT + WAGON_HEIGHT / 2, 0);
    const windows: Array<[THREE.BufferGeometry, number]> = [[body, 0]];
    for (const side of [1, -1]) {
      const strip = new THREE.BoxGeometry(0.06, WINDOW_HEIGHT, WAGON_LENGTH - 1.5);
      strip.translate((side * (WAGON_WIDTH + 0.02)) / 2, WAGON_LIFT + WINDOW_Y, 0);
      windows.push([strip, 1]);
    }
    this.windowMaterial = new THREE.MeshStandardMaterial({
      color: '#1d2a55',
      roughness: 0.5,
      metalness: 0.3,
      emissive: '#ffd28a',
      emissiveIntensity: 2.5,
    });
    glowOnly(this.windowMaterial, 'train-windows');
    this.wagons = new THREE.InstancedMesh(mergeWithGlow(windows), this.windowMaterial, WAGONS);
    this.wagons.name = 'train';
    this.wagons.frustumCulled = false;
    this.group.add(this.lineMesh, this.wagons);
    this.update(0);
  }

  /** Um quadro: os vagões na pose do instante `time` (s de física), sentados sobre o deck. */
  update(time: number): void {
    for (let k = 0; k < WAGONS; k++) {
      const p = trainPose(time, this.line, k, this.cum);
      this.s[k] = p.s;
      this.quat.setFromAxisAngle(this.up, p.heading);
      this.pos.set(p.x, p.y + DECK_THICKNESS / 2, p.z);
      this.wagons.setMatrixAt(k, this.matrix.compose(this.pos, this.quat, this.one));
    }
    this.wagons.instanceMatrix.needsUpdate = true;
  }

  /** Objetos do trem (o espelho da rua os pula). */
  objects(): THREE.Object3D[] {
    return [this.group];
  }
}

/** Deck com guarda-corpos ao longo do laço, mais os portais (colunas do terreno ao deck e viga), numa geometria só. */
function buildViaduct(line: TrainLine, carved: Heightmap): THREE.BufferGeometry {
  const n = line.points.length / 3;
  const p = line.points;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], nx: number, ny: number, nz: number) => {
    const base = positions.length / 3;
    for (const v of [a, b, c, d]) {
      positions.push(v[0]!, v[1]!, v[2]!);
      normals.push(nx, ny, nz);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const at = (i: number) => {
    const k = ((i % n) + n) % n;
    return { x: p[k * 3]!, y: p[k * 3 + 1]!, z: p[k * 3 + 2]! };
  };
  for (let i = 0; i < n; i++) {
    const a = at(i);
    const b = at(i + 1);
    const prev = at(i - 1);
    const next = at(i + 2);
    // direita em cada ponto pela tangente média (as juntas ficam alinhadas)
    const ra = right(prev, b);
    const rb = right(a, next);
    const half = DECK_WIDTH / 2;
    const top = DECK_THICKNESS / 2;
    // deck: topo, fundo e as duas laterais
    const strips: Array<[number, number, number, number]> = [
      [half, top, -half, top],
      [-half, -top, half, -top],
      [half, -top, half, top],
      [-half, top, -half, -top],
    ];
    for (const [o1, y1, o2, y2] of strips) {
      const a1 = [a.x + ra[0] * o1, a.y + y1, a.z + ra[1] * o1];
      const a2 = [a.x + ra[0] * o2, a.y + y2, a.z + ra[1] * o2];
      const b1 = [b.x + rb[0] * o1, b.y + y1, b.z + rb[1] * o1];
      const b2 = [b.x + rb[0] * o2, b.y + y2, b.z + rb[1] * o2];
      const nrm = faceNormal(a1, b1, a2);
      quad(a1, b1, b2, a2, nrm[0], nrm[1], nrm[2]);
    }
    // guarda-corpos: faces de fora, de dentro e de cima
    for (const side of [1, -1]) {
      const outer = side * half;
      const inner = side * (half - RAIL_WIDTH);
      const rails: Array<[number, number, number, number]> = [
        [outer, top, outer, top + RAIL_HEIGHT],
        [inner, top + RAIL_HEIGHT, inner, top],
        [outer, top + RAIL_HEIGHT, inner, top + RAIL_HEIGHT],
      ];
      for (const [o1, y1, o2, y2] of rails) {
        const a1 = [a.x + ra[0] * o1, a.y + y1, a.z + ra[1] * o1];
        const a2 = [a.x + ra[0] * o2, a.y + y2, a.z + ra[1] * o2];
        const b1 = [b.x + rb[0] * o1, b.y + y1, b.z + rb[1] * o1];
        const b2 = [b.x + rb[0] * o2, b.y + y2, b.z + rb[1] * o2];
        const nrm = faceNormal(a1, b1, a2);
        quad(a1, b1, b2, a2, nrm[0], nrm[1], nrm[2]);
      }
    }
  }
  const ribbon = new THREE.BufferGeometry();
  ribbon.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  ribbon.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  ribbon.setIndex(indices);

  const parts: THREE.BufferGeometry[] = [ribbon];
  for (const f of line.frames) {
    const deckY = f.y + DECK_HEIGHT;
    for (const c of frameColumns(f)) {
      const bottom = heightAt(carved, c.x, c.z) - 0.5;
      const h = deckY - DECK_THICKNESS / 2 - bottom;
      const col = new THREE.BoxGeometry(COLUMN_HALF * 2, h, COLUMN_HALF * 2);
      col.deleteAttribute('uv');
      col.rotateY(f.heading);
      col.translate(c.x, bottom + h / 2, c.z);
      parts.push(col);
    }
    const span = 2 * (f.halfWidth + COLUMN_HALF) + 2 * 2.6;
    const beam = new THREE.BoxGeometry(span, BEAM_HEIGHT, BEAM_DEPTH);
    beam.deleteAttribute('uv');
    beam.rotateY(f.heading);
    beam.translate(f.x, deckY - DECK_THICKNESS / 2 - BEAM_HEIGHT / 2, f.z);
    parts.push(beam);
  }
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('TrainScene: viaduto não junta');
  merged.computeBoundingSphere();
  return merged;
}

/** vetor à direita da tangente de `a` para `b` no plano xz */
function right(a: { x: number; z: number }, b: { x: number; z: number }): [number, number] {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l = Math.hypot(dx, dz) || 1;
  // frente (sin h, cos h) → direita (cos h, −sin h) = (dz, −dx) / l
  return [dz / l, -dx / l];
}

function faceNormal(a: number[], b: number[], c: number[]): [number, number, number] {
  const ux = b[0]! - a[0]!;
  const uy = b[1]! - a[1]!;
  const uz = b[2]! - a[2]!;
  const vx = c[0]! - a[0]!;
  const vy = c[1]! - a[1]!;
  const vz = c[2]! - a[2]!;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
