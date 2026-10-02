/**
 * Rede de estradas da city-terrain (doors 2, 3, 5 e 6): função pura
 * `generateRoads(seed, heightmap)` que devolve um `RoadNetwork`.
 *
 * - rodovia em anel (6 faixas), fechada, sobre o traçado de `ringRadius`
 * - 6 avenidas (4 faixas) que cruzam o centro de anel a anel
 * - estradas de morro (2 faixas) que saem de uma avenida ou da rodovia e sobem
 *   em zigue-zague, mirando a cada 2 m uma rampa de 5 % a 20 m à frente
 *
 * Cada estrada é amostrada a cada 2 m (horizontal). A altura é a média móvel
 * de 40 m do terreno, com rampa limitada a 9 % (o check exige ≤ 10 %). Onde a
 * estrada cruza água ou fica mais de 4 m acima do terreno vira ponte.
 */
import { mulberry32 } from '../CityGenerator';
import { heightAt, limitGrade, movingAverage, type Heightmap } from '../terrain/TerrainGenerator';
import {
  DOWNTOWN_HALF,
  WATER_Y,
  avenueEnd,
  avenueLines,
  avenuePoint,
  ringRadius,
} from '../worldMath';

export type RoadKind = 'highway' | 'avenue' | 'street' | 'hill';

export const ROAD_SPECS: Record<RoadKind, { lanes: 2 | 4 | 6; width: number }> = {
  highway: { lanes: 6, width: 24 },
  avenue: { lanes: 4, width: 16 },
  hill: { lanes: 2, width: 10 },
  street: { lanes: 2, width: 10 },
};

export interface Road {
  id: number;
  kind: RoadKind;
  lanes: 2 | 4 | 6;
  width: number;
  closed: boolean;
  /** x, y, z a cada 2 m */
  points: Float32Array;
  /**
   * trechos de ponte, índices inclusivos em `points`; numa estrada fechada, um trecho que passa
   * pela costura tem `to` ≥ n (os índices seguem módulo n, smooth-world AC 15)
   */
  bridges: Array<{ from: number; to: number }>;
  /**
   * inclinação transversal por ponto (m): a borda esquerda da fita fica `bank` acima do eixo e a
   * direita o mesmo abaixo; sem o campo, a fita é plana na transversal. Só as pontas das avenidas
   * no anel têm, para a fita acompanhar a rampa do anel (smooth-world AC 5)
   */
  bank?: Float32Array;
}

export interface RoadNetwork {
  roads: Road[];
}

export const ROAD_STEP = 2;
const PROFILE_GRADE = 0.09;
const PROFILE_HALF = 10; // 10 pontos de cada lado = janela de 40 m
export const BRIDGE_HEIGHT = 4;
const DECK_MIN_Y = WATER_Y + 3;
/** até onde procurar o alto da margem, em pontos (80 m) */
const BANK_REACH = 40;
const BRIDGE_PAD = 3;
/** diferença pista-terreno abaixo da qual a ponte termina */
const BRIDGE_TOUCH = 1.5;

// estradas de morro
const HILL_TARGET = 6;
const HILL_MAX_TURN = (5.5 * Math.PI) / 180;
const HILL_MAX_GRADE = 0.1;
const HILL_LOOKAHEAD = 20;
const HILL_TARGET_GRADE = 0.065;
/** ângulo entre a direção de subida e o traçado: a estrada sobe na diagonal da encosta */
const HILL_DIAGONAL = (65 * Math.PI) / 180;
const HILL_MAX_CROSS = 0.15;
const HILL_MAX_LEN = 3000;
const HILL_MIN_LEN = 300;
const HILL_MIN_CLIMB = 42;
const HILL_EDGE = 1500;
/** distância mínima entre os pontos de partida de duas estradas de morro */
const HILL_START_SPACING = 150;

/** Reamostra uma polilinha aberta (x, z) a cada `step` m; o resto final é descartado. */
function resampleOpen(xz: number[], step: number): number[] {
  const out = [xz[0]!, xz[1]!];
  let carry = 0;
  for (let i = 2; i < xz.length; i += 2) {
    const ax = xz[i - 2]!;
    const az = xz[i - 1]!;
    const bx = xz[i]!;
    const bz = xz[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    let t = step - carry;
    while (t <= len) {
      out.push(ax + ((bx - ax) * t) / len, az + ((bz - az) * t) / len);
      t += step;
    }
    carry = len - (t - step);
  }
  return out;
}

/** Reamostra uma polilinha fechada em n pontos iguais, n = round(comprimento / step). */
function resampleClosed(xz: number[], step: number): number[] {
  const loop = [...xz, xz[0]!, xz[1]!];
  let total = 0;
  for (let i = 2; i < loop.length; i += 2) total += Math.hypot(loop[i]! - loop[i - 2]!, loop[i + 1]! - loop[i - 1]!);
  const n = Math.round(total / step);
  const d = total / n;
  const out = resampleOpen(loop, d);
  return out.slice(0, n * 2);
}

/** Alturas da estrada: média de 40 m do terreno, água atravessada em nível, rampa ≤ 9 %. */
function profile(xz: number[], closed: boolean, hm: Heightmap, downtownFlat: boolean): number[] {
  const n = xz.length / 2;
  const raw: number[] = [];
  const water: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const h = heightAt(hm, xz[i * 2]!, xz[i * 2 + 1]!);
    raw.push(h);
    water.push(h < WATER_Y);
  }
  // sobre a água: a pista vai em linha reta do alto de uma margem ao alto da outra
  // (o ponto mais alto até 80 m antes e depois da água), e não da beira da água,
  // para não cortar o barranco subindo a 9 %
  const at = (i: number) => (closed ? ((i % n) + n) % n : i);
  for (let i = 0; i < n; i++) {
    if (!water[i]) continue;
    let a = i;
    while (a - 1 > (closed ? i - n : -1) && water[at(a - 1)]) a--;
    let b = i;
    while (b + 1 < (closed ? i + n : n) && water[at(b + 1)]) b++;
    let left = a;
    for (let k = a - 1; k >= a - BANK_REACH; k--) {
      if (!closed && k < 0) break;
      if (water[at(k)]) break;
      if (raw[at(k)]! > raw[at(left)]! || left === a) left = k;
    }
    let right = b;
    for (let k = b + 1; k <= b + BANK_REACH; k++) {
      if (!closed && k >= n) break;
      if (water[at(k)]) break;
      if (raw[at(k)]! > raw[at(right)]! || right === b) right = k;
    }
    const hl = left === a ? DECK_MIN_Y : Math.max(DECK_MIN_Y, raw[at(left)]!);
    const hr = right === b ? DECK_MIN_Y : Math.max(DECK_MIN_Y, raw[at(right)]!);
    for (let k = left + 1; k < right; k++) {
      const t = (k - left) / (right - left);
      raw[at(k)] = hl + (hr - hl) * t;
      water[at(k)] = true;
    }
    i = closed ? Math.max(i, b) : b;
  }
  const y = movingAverage(raw, PROFILE_HALF, closed);
  const flat = (i: number) =>
    downtownFlat && Math.max(Math.abs(xz[i * 2]!), Math.abs(xz[i * 2 + 1]!)) <= DOWNTOWN_HALF;
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < n; i++) {
      if (water[i]) y[i] = Math.max(y[i]!, DECK_MIN_Y);
      if (flat(i)) y[i] = 0;
    }
    limitGrade(y, PROFILE_GRADE * ROAD_STEP, closed);
  }
  return y;
}

function pack(xz: number[], y: number[]): Float32Array {
  const n = xz.length / 2;
  const points = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    points[i * 3] = xz[i * 2]!;
    points[i * 3 + 1] = y[i]!;
    points[i * 3 + 2] = xz[i * 2 + 1]!;
  }
  return points;
}

/**
 * Trechos de ponte: água sob o eixo ou pista mais de 4 m acima do terreno.
 * Cada trecho se estende para os dois lados enquanto a pista ainda está a mais
 * de 1.5 m do terreno (o aterro baixo que sobra cabe na mistura de 6 m do
 * carve sem degrau), mais 3 pontos de folga. Numa estrada fechada (`closed`) os
 * trechos dão a volta na costura: um trecho sobre o índice 0 sai inteiro, com
 * `from` em [0, n) e `to` ≥ n (smooth-world AC 15).
 */
export function markBridges(points: Float32Array, hm: Heightmap, closed = false): Array<{ from: number; to: number }> {
  const n = points.length / 3;
  if (closed) return markClosedBridges(points, hm);
  const cond: boolean[] = [];
  const gap: number[] = [];
  for (let i = 0; i < n; i++) {
    const h = heightAt(hm, points[i * 3]!, points[i * 3 + 2]!);
    cond.push(h < WATER_Y || points[i * 3 + 1]! - h > BRIDGE_HEIGHT);
    gap.push(Math.abs(points[i * 3 + 1]! - h));
  }
  const ranges: Array<{ from: number; to: number }> = [];
  for (let i = 0; i < n; i++) {
    if (!cond[i]) continue;
    let j = i;
    while (j + 1 < n && cond[j + 1]) j++;
    let a = i;
    let b = j;
    while (a > 0 && gap[a - 1]! > BRIDGE_TOUCH) a--;
    while (b < n - 1 && gap[b + 1]! > BRIDGE_TOUCH) b++;
    const from = Math.max(0, a - BRIDGE_PAD);
    const to = Math.min(n - 1, b + BRIDGE_PAD);
    const last = ranges[ranges.length - 1];
    if (last && from <= last.to + 1) last.to = to;
    else ranges.push({ from, to });
    i = b;
  }
  return ranges;
}

/**
 * `markBridges` de uma estrada fechada: a mesma regra lida em volta do laço. Começa num ponto que
 * nenhum trecho alcança (sem condição e com a pista a até 1.5 m do terreno, longe da folga), então
 * nenhum trecho é cortado na costura; os índices voltam para [0, n) no `from`.
 */
function markClosedBridges(points: Float32Array, hm: Heightmap): Array<{ from: number; to: number }> {
  const n = points.length / 3;
  const at = (i: number) => ((i % n) + n) % n;
  const cond: boolean[] = [];
  const gap: number[] = [];
  for (let i = 0; i < n; i++) {
    const h = heightAt(hm, points[i * 3]!, points[i * 3 + 2]!);
    cond.push(h < WATER_Y || points[i * 3 + 1]! - h > BRIDGE_HEIGHT);
    gap.push(Math.abs(points[i * 3 + 1]! - h));
  }
  // ponto de partida: fora de condição e de aterro alto com BRIDGE_PAD + 1 pontos de cada lado assim
  const calm = (i: number) => !cond[at(i)] && gap[at(i)]! <= BRIDGE_TOUCH;
  let start = -1;
  for (let i = 0; i < n && start < 0; i++) {
    let ok = true;
    for (let d = -BRIDGE_PAD - 1; d <= BRIDGE_PAD + 1 && ok; d++) ok = calm(i + d);
    if (ok) start = i;
  }
  // laço inteiro de ponte: um trecho só
  if (start < 0) return cond.some(Boolean) ? [{ from: 0, to: n - 1 }] : [];
  const ranges: Array<{ from: number; to: number }> = [];
  for (let k = 0; k < n; k++) {
    const i = start + k;
    if (!cond[at(i)]) continue;
    let j = i;
    while (j + 1 < start + n && cond[at(j + 1)]) j++;
    let a = i;
    let b = j;
    while (gap[at(a - 1)]! > BRIDGE_TOUCH) a--;
    while (gap[at(b + 1)]! > BRIDGE_TOUCH) b++;
    const from = a - BRIDGE_PAD;
    const to = b + BRIDGE_PAD;
    const last = ranges[ranges.length - 1];
    if (last && from <= last.to + 1) last.to = to;
    else ranges.push({ from, to });
    k = b - start;
  }
  return ranges.map((r) => ({ from: at(r.from), to: at(r.from) + (r.to - r.from) })).sort((x, y) => x.from - y.from);
}

function makeRoad(id: number, kind: RoadKind, closed: boolean, points: Float32Array, hm: Heightmap, bank?: Float32Array): Road {
  const spec = ROAD_SPECS[kind];
  const road: Road = { id, kind, lanes: spec.lanes, width: spec.width, closed, points, bridges: markBridges(points, hm, closed) };
  if (bank) road.bank = bank;
  return road;
}

/**
 * Altura da fita de uma estrada fechada (plana na transversal) sob (x, z): a do eixo no pé da
 * perpendicular ao segmento mais perto, interpolada ao longo dele.
 */
function ringStripY(road: Road, x: number, z: number): number {
  const p = road.points;
  const n = p.length / 3;
  let best = Infinity;
  let y = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = p[i * 3]!;
    const az = p[i * 3 + 2]!;
    const dx = p[j * 3]! - ax;
    const dz = p[j * 3 + 2]! - az;
    const len2 = dx * dx + dz * dz;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2));
    const d = (ax + dx * t - x) ** 2 + (az + dz * t - z) ** 2;
    if (d < best) {
      best = d;
      y = p[i * 3 + 1]! + (p[j * 3 + 1]! - p[i * 3 + 1]!) * t;
    }
  }
  return y;
}

/** Grade espacial dos pontos de estrada (célula de 32 m) para as buscas de vizinhança. */
class PointGrid {
  private readonly cells = new Map<number, number[]>();
  private static key(x: number, z: number): number {
    return Math.floor((x + 2048) / 32) * 1024 + Math.floor((z + 2048) / 32);
  }
  add(x: number, z: number, clearance: number, tag: number): void {
    const k = PointGrid.key(x, z);
    let c = this.cells.get(k);
    if (!c) this.cells.set(k, (c = []));
    c.push(x, z, clearance, tag);
  }
  /** Verdadeiro se algum ponto (com outra tag) está mais perto que a sua folga + `extra`. */
  blocked(x: number, z: number, extra: number, ignoreTag: number): boolean {
    const cx = Math.floor((x + 2048) / 32);
    const cz = Math.floor((z + 2048) / 32);
    for (let a = cx - 2; a <= cx + 2; a++) {
      for (let b = cz - 2; b <= cz + 2; b++) {
        const c = this.cells.get(a * 1024 + b);
        if (!c) continue;
        for (let i = 0; i < c.length; i += 4) {
          if (c[i + 3] === ignoreTag) continue;
          const r = c[i + 2]! + extra;
          if ((c[i]! - x) ** 2 + (c[i + 1]! - z) ** 2 < r * r) return true;
        }
      }
    }
    return false;
  }
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Caminha 2 m por vez subindo o morro; devolve a polilinha (x, z) ou null se não serviu. */
function walkHill(
  hm: Heightmap,
  startX: number,
  startZ: number,
  startHeading: number,
  grid: PointGrid,
  parentTag: number,
  rng: () => number,
): number[] | null {
  const pts = [startX, startZ];
  let x = startX;
  let z = startZ;
  let heading = startHeading;
  const h0 = heightAt(hm, x, z);
  let maxH = h0;
  const wigglePhase = rng() * Math.PI * 2;
  // zigue-zague: a cada `wiggleLen` m a estrada troca de lado na encosta (curva em grampo)
  const wiggleLen = 160 + rng() * 120;
  const own = new PointGrid();
  const H = (px: number, pz: number) => heightAt(hm, px, pz);
  const free = (px: number, pz: number, s: number): boolean =>
    Math.abs(px) <= HILL_EDGE &&
    Math.abs(pz) <= HILL_EDGE &&
    Math.max(Math.abs(px), Math.abs(pz)) >= DOWNTOWN_HALF + 20 &&
    H(px, pz) >= 1 &&
    // longe das outras estradas (a mãe só conta depois de 100 m) e do próprio traçado antigo
    !grid.blocked(px, pz, 18, s < 100 ? parentTag : -1) &&
    !own.blocked(px, pz, 0, -1);
  for (let s = 0; s < HILL_MAX_LEN; s += ROAD_STEP) {
    const here = H(x, z);
    let desired = startHeading;
    if (s >= 40) {
      // antecipação: entre 72 direções, a que dá rampa perto de 5 % daqui a 20 m,
      // de preferência na diagonal da encosta do lado atual do zigue-zague
      const gx = (H(x + 4, z) - H(x - 4, z)) / 8;
      const gz = (H(x, z + 4) - H(x, z - 4)) / 8;
      const side = Math.sin((Math.PI * s) / wiggleLen + wigglePhase) >= 0 ? 1 : -1;
      const pref = Math.atan2(gx, gz) + side * HILL_DIAGONAL;
      let bestScore = -Infinity;
      for (let k = 0; k < 72; k++) {
        const t = (k / 72) * Math.PI * 2;
        const ax = x + Math.sin(t) * HILL_LOOKAHEAD;
        const az = z + Math.cos(t) * HILL_LOOKAHEAD;
        if (!free(ax, az, s)) continue;
        const g = (H(ax, az) - here) / HILL_LOOKAHEAD;
        const score =
          -8 * Math.abs(g - HILL_TARGET_GRADE) +
          0.25 * Math.cos(angleDiff(t, pref)) -
          (0.8 * Math.abs(angleDiff(t, heading))) / Math.PI;
        if (score > bestScore) {
          bestScore = score;
          desired = t;
        }
      }
      if (bestScore === -Infinity) break;
    }
    // o passo: dentro de ±5.5°, o mais perto de `desired` que respeita rampa e inclinação lateral
    let best: { h: number; score: number } | null = null;
    for (let k = -4; k <= 4; k++) {
      const h = heading + (k / 4) * HILL_MAX_TURN;
      const nx = x + Math.sin(h) * ROAD_STEP;
      const nz = z + Math.cos(h) * ROAD_STEP;
      if (!free(nx, nz, s)) continue;
      const grade = (H(nx, nz) - here) / ROAD_STEP;
      if (Math.abs(grade) > HILL_MAX_GRADE) continue;
      const cross =
        Math.abs(H(nx + Math.cos(h) * 8, nz - Math.sin(h) * 8) - H(nx - Math.cos(h) * 8, nz + Math.sin(h) * 8)) / 16;
      if (cross > HILL_MAX_CROSS) continue;
      const score = Math.cos(angleDiff(h, desired));
      if (!best || score > best.score) best = { h, score };
    }
    if (!best) break;
    heading = best.h;
    x += Math.sin(heading) * ROAD_STEP;
    z += Math.cos(heading) * ROAD_STEP;
    pts.push(x, z);
    maxH = Math.max(maxH, H(x, z));
    // o traçado com mais de 40 pontos de idade vira obstáculo para ele mesmo
    const n = pts.length / 2;
    if (n > 40) own.add(pts[(n - 40) * 2]!, pts[(n - 40) * 2 + 1]!, 16, 0);
    if (maxH - h0 >= 90) break;
  }
  const len = (pts.length / 2 - 1) * ROAD_STEP;
  if (len < HILL_MIN_LEN) return null;
  return pts;
}

function totalTurn(xz: number[]): number {
  let sum = 0;
  for (let i = 4; i < xz.length; i += 2) {
    const h1 = Math.atan2(xz[i - 2]! - xz[i - 4]!, xz[i - 1]! - xz[i - 3]!);
    const h2 = Math.atan2(xz[i]! - xz[i - 2]!, xz[i + 1]! - xz[i - 1]!);
    sum += Math.abs(angleDiff(h2, h1));
  }
  return sum;
}

export function generateRoads(seed: number, hm: Heightmap): RoadNetwork {
  const roads: Road[] = [];
  const grid = new PointGrid();
  const register = (road: Road) => {
    roads.push(road);
    const p = road.points;
    for (let i = 0; i < p.length; i += 3) grid.add(p[i]!, p[i + 2]!, road.width / 2, road.id);
  };

  // rodovia em anel
  const dense: number[] = [];
  for (let i = 0; i < 7200; i++) {
    const t = (i / 7200) * Math.PI * 2;
    const r = ringRadius(t, seed);
    dense.push(Math.cos(t) * r, Math.sin(t) * r);
  }
  const ringXZ = resampleClosed(dense, ROAD_STEP);
  const ring = makeRoad(0, 'highway', true, pack(ringXZ, profile(ringXZ, true, hm, false)), hm);
  register(ring);

  // avenidas: de anel a anel, planas no centro, com as pontas na altura do anel. A seção da ponta
  // assenta na fita do anel, com a rampa dele na transversal (smooth-world AC 5); nos 60 m antes,
  // a altura mistura com a do ponto do anel mais perto e a rampa transversal some aos poucos
  const avenueHalf = ROAD_SPECS.avenue.width / 2;
  for (const line of avenueLines(seed)) {
    const s0 = avenueEnd(line, -1, seed);
    const s1 = avenueEnd(line, 1, seed);
    const denseAv: number[] = [];
    for (let s = s0; s <= s1; s += 0.5) denseAv.push(...avenuePoint(line, s));
    const xz = resampleOpen(denseAv, ROAD_STEP);
    const y = profile(xz, false, hm, true);
    const n = xz.length / 2;
    const bank = new Float32Array(n);
    const blend = 30;
    for (const end of [0, n - 1]) {
      const ex = xz[end * 2]!;
      const ez = xz[end * 2 + 1]!;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < ring.points.length; i += 3) {
        const d = (ring.points[i]! - ex) ** 2 + (ring.points[i + 2]! - ez) ** 2;
        if (d < bestD) {
          bestD = d;
          best = ring.points[i + 1]!;
        }
      }
      for (let k = 0; k < blend; k++) {
        const i = end === 0 ? k : n - 1 - k;
        const t = 1 - k / blend;
        // bordas da seção (perpendicular ao heading por diferença central, como a fita)
        const a = Math.max(0, i - 1);
        const b = Math.min(n - 1, i + 1);
        const h = Math.atan2(xz[b * 2]! - xz[a * 2]!, xz[b * 2 + 1]! - xz[a * 2 + 1]!);
        const lx = Math.cos(h) * avenueHalf;
        const lz = -Math.sin(h) * avenueHalf;
        const x = xz[i * 2]!;
        const z = xz[i * 2 + 1]!;
        const left = ringStripY(ring, x + lx, z + lz);
        const right = ringStripY(ring, x - lx, z - lz);
        y[i] = y[i]! + ((k === 0 ? (left + right) / 2 : best) - y[i]!) * t;
        bank[i] = ((left - right) / 2) * t;
      }
    }
    limitGrade(y, PROFILE_GRADE * ROAD_STEP, false);
    register(makeRoad(roads.length, 'avenue', false, pack(xz, y), hm, bank));
  }

  // estradas de morro: partem de pontos da rodovia e das avenidas fora do centro
  const rng = mulberry32(seed ^ 0x411f);
  const starts: Array<{ road: Road; i: number }> = [];
  for (const road of roads) {
    const p = road.points;
    for (let i = 0; i < p.length / 3; i += 10) {
      const x = p[i * 3]!;
      const z = p[i * 3 + 2]!;
      if (Math.max(Math.abs(x), Math.abs(z)) < DOWNTOWN_HALF + 60) continue;
      // numa estrada fechada a folga de 10 pontos dá a volta na costura
      const shifts = road.closed ? [-p.length / 3, 0, p.length / 3] : [0];
      if (road.bridges.some((b) => shifts.some((d) => i + d >= b.from - 10 && i + d <= b.to + 10))) continue;
      starts.push({ road, i });
    }
  }
  for (let i = starts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [starts[i], starts[j]] = [starts[j]!, starts[i]!];
  }
  let hills = 0;
  const used: number[] = [];
  for (const { road, i } of starts) {
    if (hills >= HILL_TARGET) break;
    const p = road.points;
    const sx = p[i * 3]!;
    const sz = p[i * 3 + 2]!;
    let near = false;
    for (let k = 0; k < used.length; k += 2) {
      if (Math.hypot(used[k]! - sx, used[k + 1]! - sz) < HILL_START_SPACING) near = true;
    }
    if (near) continue;
    const next = Math.min(p.length / 3 - 1, i + 1);
    const prev = Math.max(0, i - 1);
    const hx = p[next * 3]! - p[prev * 3]!;
    const hz = p[next * 3 + 2]! - p[prev * 3 + 2]!;
    const len = Math.hypot(hx, hz);
    // perpendicular à mãe, para o lado que sobe
    let nx = hz / len;
    let nz = -hx / len;
    const off = road.width / 2 + 2;
    const px = p[i * 3]!;
    const pz = p[i * 3 + 2]!;
    if (heightAt(hm, px - nx * 30, pz - nz * 30) > heightAt(hm, px + nx * 30, pz + nz * 30)) {
      nx = -nx;
      nz = -nz;
    }
    const xz = walkHill(hm, px + nx * off, pz + nz * off, Math.atan2(nx, nz), grid, road.id, rng);
    if (!xz) continue;
    if (totalTurn(xz) < Math.PI + 0.2) continue;
    const y = profile(xz, false, hm, false);
    // começa na altura da estrada mãe
    const parentY = p[i * 3 + 1]!;
    const blend = 15;
    for (let k = 0; k < blend && k < y.length; k++) y[k] = y[k]! + (parentY - y[k]!) * (1 - k / blend);
    limitGrade(y, PROFILE_GRADE * ROAD_STEP, false);
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of y) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    if (hi - lo < HILL_MIN_CLIMB) continue;
    register(makeRoad(roads.length, 'hill', false, pack(xz, y), hm));
    used.push(sx, sz);
    hills++;
  }
  return { roads };
}
