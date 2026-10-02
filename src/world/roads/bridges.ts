/**
 * Pontes e viadutos da city-terrain (door 6), sem three: tabuleiro, guarda-
 * corpos e pilares de um trecho de ponte. As mesmas malhas servem para o
 * render (`ChunkManager`) e para a física (`WorldPhysics`).
 *
 * - tabuleiro: fita da estrada com topo na altura da estrada e 0.8 m de espessura
 * - guarda-corpos: muretas de 1 m de altura e 0.3 m de largura em ±width/2
 * - pilares: 1.5 × 1.5 m a cada 24 m ao longo do trecho, do fundo do
 *   tabuleiro até 0.5 m abaixo do terreno (ou do leito do rio)
 */
import { heightAt, type Heightmap } from '../terrain/TerrainGenerator';
import { ROAD_STEP, type Road } from './RoadGenerator';
import { pointHeading } from './roadMesh';

export const DECK_THICKNESS = 0.8;
export const RAIL_HEIGHT = 1;
export const RAIL_WIDTH = 0.3;
export const PILLAR_SIZE = 1.5;
export const PILLAR_SPACING = 24;

export interface Pillar {
  x: number;
  z: number;
  top: number;
  bottom: number;
  heading: number;
  /** distância ao longo do trecho (m) */
  along: number;
}

export interface BridgeParts {
  /** índices dos pontos da estrada no trecho, na ordem */
  indices: number[];
  pillars: Pillar[];
}

export interface TriMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

export function bridgeParts(road: Road, range: { from: number; to: number }, hm: Heightmap): BridgeParts {
  const p = road.points;
  const n = p.length / 3;
  const indices: number[] = [];
  // numa estrada fechada o trecho pode passar pela costura (`to` ≥ n): os índices voltam a 0
  for (let i = range.from; i <= range.to; i++) indices.push(i % n);
  const pillars: Pillar[] = [];
  const length = (indices.length - 1) * ROAD_STEP;
  for (let along = PILLAR_SPACING / 2; along <= length - PILLAR_SPACING / 2 + 1e-9; along += PILLAR_SPACING) {
    const f = along / ROAD_STEP;
    const j = Math.min(indices.length - 2, Math.floor(f));
    const t = f - j;
    const a = indices[j]!;
    const b = indices[j + 1]!;
    const x = p[a * 3]! + (p[b * 3]! - p[a * 3]!) * t;
    const y = p[a * 3 + 1]! + (p[b * 3 + 1]! - p[a * 3 + 1]!) * t;
    const z = p[a * 3 + 2]! + (p[b * 3 + 2]! - p[a * 3 + 2]!) * t;
    const top = y - DECK_THICKNESS;
    const ground = heightAt(hm, x, z);
    pillars.push({
      x,
      z,
      top,
      bottom: Math.min(ground - 0.5, top - 0.2),
      heading: Math.atan2(p[b * 3]! - p[a * 3]!, p[b * 3 + 2]! - p[a * 3 + 2]!),
      along,
    });
  }
  return { indices, pillars };
}

/**
 * Caixa extrudada ao longo dos pontos `indices` da estrada: seção de
 * `offset ± halfWidth` (lateral, à esquerda do heading) e altura
 * `[y + yBottom, y + yTop]`. Topo, fundo e as duas laterais. Cada face de
 * cada segmento (e cada tampa) tem os seus 4 vértices: a normal calculada no
 * vértice é a da face, sem média com a vizinha na quina de 90° (smooth-world AC 16).
 */
export function extrudeAlong(road: Road, indices: number[], offset: number, halfWidth: number, yBottom: number, yTop: number): TriMesh {
  const p = road.points;
  const m = indices.length;
  const corners = new Float32Array(m * 4 * 3);
  for (let k = 0; k < m; k++) {
    const i = indices[k]!;
    const h = pointHeading(road, i);
    const lx = Math.cos(h);
    const lz = -Math.sin(h);
    const x = p[i * 3]!;
    const y = p[i * 3 + 1]!;
    const z = p[i * 3 + 2]!;
    const l = offset + halfWidth;
    const r = offset - halfWidth;
    // 0 topo esquerdo, 1 topo direito, 2 fundo direito, 3 fundo esquerdo
    corners.set(
      [
        x + lx * l, y + yTop, z + lz * l,
        x + lx * r, y + yTop, z + lz * r,
        x + lx * r, y + yBottom, z + lz * r,
        x + lx * l, y + yBottom, z + lz * l,
      ],
      k * 12,
    );
  }
  const positions = new Float32Array(((m - 1) * 4 + 2) * 4 * 3);
  const tris = new Uint32Array(((m - 1) * 4 + 2) * 6);
  let quad = 0;
  /** um quad com 4 vértices próprios (cantos `c0..c3`), em 2 triângulos (0, 1, 2) e (1, 3, 2) */
  const put = (c0: number, c1: number, c2: number, c3: number): void => {
    const v = quad * 4;
    [c0, c1, c2, c3].forEach((c, j) => positions.set(corners.subarray(c * 3, c * 3 + 3), (v + j) * 3));
    tris.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], quad * 6);
    quad++;
  };
  for (let k = 0; k < m - 1; k++) {
    const a = k * 4;
    const b = (k + 1) * 4;
    // cada face da seção (0-1 topo, 1-2 direita, 2-3 fundo, 3-0 esquerda) vira um quad entre k e k+1,
    // com as normais para fora da caixa
    for (const [u, v] of [[0, 1], [1, 2], [2, 3], [3, 0]] as const) put(a + u, a + v, b + u, b + v);
  }
  // tampas nas pontas (a do começo olha para trás, a do fim para a frente)
  const e = (m - 1) * 4;
  put(0, 3, 1, 2);
  put(e, e + 1, e + 3, e + 2);
  return { positions, indices: tris };
}

/**
 * Trechos de uma ponte (`indices`, na ordem dela) com os pontos em que `keep` vale, cada um com o
 * ponto seguinte da ponte no fim para emendar com o vizinho; só os de 2 pontos ou mais. Seguir a
 * ordem da ponte, e não a do índice, mantém o segmento n−1 → 0 de uma estrada fechada (AC 15).
 */
export function bridgeRuns(indices: number[], keep: (i: number) => boolean): number[][] {
  const runs: number[][] = [];
  let cur: number[] = [];
  for (const i of indices) {
    if (keep(i)) {
      cur.push(i);
      continue;
    }
    if (cur.length) runs.push([...cur, i]);
    cur = [];
  }
  if (cur.length) runs.push(cur);
  return runs.filter((r) => r.length >= 2);
}

/** Tabuleiro e os dois guarda-corpos de um trecho de ponte. */
export function bridgeMeshes(road: Road, parts: BridgeParts): { deck: TriMesh; rails: TriMesh[] } {
  const w2 = road.width / 2;
  return {
    deck: extrudeAlong(road, parts.indices, 0, w2, -DECK_THICKNESS, 0),
    rails: [1, -1].map((side) =>
      extrudeAlong(road, parts.indices, side * (w2 - RAIL_WIDTH / 2), RAIL_WIDTH / 2, 0, RAIL_HEIGHT),
    ),
  };
}

/** Pilar: caixa de `PILLAR_SIZE` × `PILLAR_SIZE` girada pelo heading, de `bottom` a `top` (render; a física usa um cuboide do mesmo tamanho). */
export function pillarBox(x: number, z: number, bottom: number, top: number, heading: number): TriMesh {
  const s = PILLAR_SIZE / 2;
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  const corners: number[] = [];
  for (const y of [bottom, top]) {
    for (const [a, b] of [[-s, -s], [s, -s], [s, s], [-s, s]] as const) {
      corners.push(x + a * cos + b * sin, y, z - a * sin + b * cos);
    }
  }
  // normais para fora: fundo para −y, topo para +y, laterais para fora; cada face com os seus
  // 4 vértices (smooth-world AC 16), na ordem em que os 2 triângulos dela os usam
  const faces = [
    [0, 1, 2, 0, 2, 3],
    [4, 6, 5, 4, 7, 6],
    [0, 5, 1, 0, 4, 5],
    [1, 6, 2, 1, 5, 6],
    [2, 7, 3, 2, 6, 7],
    [3, 4, 0, 3, 7, 4],
  ];
  const positions = new Float32Array(faces.length * 4 * 3);
  const idx: number[] = [];
  faces.forEach((face, f) => {
    const own = [...new Set(face)].sort((a, b) => a - b);
    own.forEach((c, j) => positions.set(corners.slice(c * 3, c * 3 + 3), (f * 4 + j) * 3));
    for (const c of face) idx.push(f * 4 + own.indexOf(c));
  });
  return { positions, indices: new Uint32Array(idx) };
}
