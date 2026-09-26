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
  const indices: number[] = [];
  for (let i = range.from; i <= range.to; i++) indices.push(i);
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
 * `[y + yBottom, y + yTop]`. Topo, fundo e as duas laterais.
 */
export function extrudeAlong(road: Road, indices: number[], offset: number, halfWidth: number, yBottom: number, yTop: number): TriMesh {
  const p = road.points;
  const m = indices.length;
  const positions = new Float32Array(m * 4 * 3);
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
    positions.set(
      [
        x + lx * l, y + yTop, z + lz * l,
        x + lx * r, y + yTop, z + lz * r,
        x + lx * r, y + yBottom, z + lz * r,
        x + lx * l, y + yBottom, z + lz * l,
      ],
      k * 12,
    );
  }
  const tris: number[] = [];
  for (let k = 0; k < m - 1; k++) {
    const a = k * 4;
    const b = (k + 1) * 4;
    // cada face da seção (0-1 topo, 1-2 direita, 2-3 fundo, 3-0 esquerda) vira um quad entre k e k+1
    for (const [u, v] of [[0, 1], [1, 2], [2, 3], [3, 0]] as const) {
      tris.push(a + u, b + u, a + v, a + v, b + u, b + v);
    }
  }
  // tampas nas pontas
  const e = (m - 1) * 4;
  tris.push(0, 1, 2, 0, 2, 3, e, e + 2, e + 1, e, e + 3, e + 2);
  return { positions, indices: new Uint32Array(tris) };
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
