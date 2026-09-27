/**
 * Linha do trem elevado (block-life-extras door 2), pura: `buildTrainLine(network)`
 * tira da `RoadNetwork` o laço do viaduto por regra, nunca por coordenada
 * escrita à mão (estende a AD-016 ao mundo):
 *
 * - o quadrado das avenidas de x ≈ ±300 e z ≈ ±300, como o `circuito-centro`;
 * - cada canto vira um arco de 20 m (Bézier cúbica que aproxima o quarto de
 *   círculo), com o heading mudando no máximo 6° a cada 2 m;
 * - o deck fica 8 m acima do asfalto;
 * - portais a cada 24 m de linha, com 2 colunas a `w/2 + 2.6` m de cada lado,
 *   pulando onde outra estrada passa a menos de 12 m (cruzamentos).
 *
 * Heading segue o `Car`: frente = (sin h, cos h) no plano xz.
 */
import type { Road, RoadNetwork } from '../roads/RoadGenerator';
import { count, crossing, findAvenue, pointOf, type Pt } from '../roads/roadQuery';

export interface TrainFrame {
  x: number;
  z: number;
  /** asfalto sob o portal (a base real da coluna é o terreno ao lado, lido por quem monta) */
  y: number;
  heading: number;
  /** meia largura da avenida sob o portal */
  halfWidth: number;
}

export interface TrainLine {
  /** x, y, z do deck a cada ~2 m, laço fechado sem repetir o primeiro ponto */
  points: Float32Array;
  length: number;
  frames: TrainFrame[];
}

export const DECK_HEIGHT = 8;
export const DECK_THICKNESS = 1;
export const DECK_WIDTH = 4;
export const CORNER_RADIUS = 20;
export const FRAME_SPACING = 24;
/** coluna a `w/2 + FRAME_SIDE` da linha central da avenida */
export const FRAME_SIDE = 2.6;
export const FRAME_ROAD_CLEAR = 12;
export const COLUMN_HALF = 0.25;
/** ponto de avenida a cada 2 m: 10 pontos = 20 m de canto */
const CORNER_POINTS = CORNER_RADIUS / 2;
/** controle da Bézier que aproxima um quarto de círculo: 0.5523 · raio */
const BEZIER_K = 0.5523;
/** mínimo de trechos por canto e passo máximo entre pontos do arco (m) */
const CORNER_SEGMENTS = 16;
const CORNER_STEP = 1.9;

interface Leg {
  road: Road;
  from: number;
  to: number;
}

export function buildTrainLine(network: RoadNetwork): TrainLine | null {
  const south = findAvenue(network, 'x', -300);
  const north = findAvenue(network, 'x', 300);
  const west = findAvenue(network, 'z', -300);
  const east = findAvenue(network, 'z', 300);
  if (!south || !north || !west || !east) {
    console.warn('train line skipped: avenida do quadrado do centro não encontrada');
    return null;
  }
  const sw = crossing(south, west);
  const se = crossing(south, east);
  const ne = crossing(east, north);
  const nw = crossing(north, west);
  const legs: Leg[] = [
    { road: south, from: sw.i, to: se.i },
    { road: east, from: se.j, to: ne.i },
    { road: north, from: ne.j, to: nw.i },
    { road: west, from: nw.j, to: sw.j },
  ];
  // cada perna sem os 20 m de cada ponta; entre pernas, o arco do canto
  const trimmed = legs.map((leg) => {
    const dir = leg.to >= leg.from ? 1 : -1;
    const pts: Pt[] = [];
    for (let i = leg.from + dir * CORNER_POINTS; i !== leg.to - dir * CORNER_POINTS + dir; i += dir) pts.push(pointOf(leg.road, i));
    if (pts.length < 2) throw new Error('train line: perna curta demais');
    return pts;
  });
  const out: Pt[] = [];
  for (let k = 0; k < trimmed.length; k++) {
    const a = trimmed[k]!;
    const b = trimmed[(k + 1) % trimmed.length]!;
    for (const p of a) out.push([p[0], p[1] + DECK_HEIGHT, p[2]]);
    // arco: de fim de `a` (tangente de `a`) ao começo de `b` (tangente de `b`)
    const p0 = a[a.length - 1]!;
    const pPrev = a[a.length - 2]!;
    const p3 = b[0]!;
    const pNext = b[1]!;
    const ta = unit(p0[0] - pPrev[0], p0[2] - pPrev[2]);
    const tb = unit(pNext[0] - p3[0], pNext[2] - p3[2]);
    const r = Math.hypot(p3[0] - p0[0], p3[2] - p0[2]) / Math.SQRT2;
    const c1 = [p0[0] + ta[0] * BEZIER_K * r, p0[2] + ta[1] * BEZIER_K * r];
    const c2 = [p3[0] - tb[0] * BEZIER_K * r, p3[2] - tb[1] * BEZIER_K * r];
    const at = (t: number): [number, number] => {
      const u = 1 - t;
      return [
        u * u * u * p0[0] + 3 * u * u * t * c1[0]! + 3 * u * t * t * c2[0]! + t * t * t * p3[0],
        u * u * u * p0[2] + 3 * u * u * t * c1[1]! + 3 * u * t * t * c2[1]! + t * t * t * p3[2],
      ];
    };
    // passos de no máximo CORNER_STEP m ao longo do arco (o laço fecha a ≤ 2 m)
    let len = 0;
    let prev = at(0);
    for (let s = 1; s <= 64; s++) {
      const q = at(s / 64);
      len += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
      prev = q;
    }
    const segments = Math.max(CORNER_SEGMENTS, Math.ceil(len / CORNER_STEP));
    for (let s = 1; s < segments; s++) {
      const t = s / segments;
      const [x, z] = at(t);
      out.push([x, p0[1] + (p3[1] - p0[1]) * t + DECK_HEIGHT, z]);
    }
  }
  const points = new Float32Array(out.length * 3);
  out.forEach((p, i) => points.set(p, i * 3));
  const line: TrainLine = { points, length: 0, frames: [] };
  const cum = lineCumulative(line);
  line.length = cum[out.length]!;
  line.frames = placeFrames(line, cum, network, [south, east, north, west]);
  return line;
}

function unit(x: number, z: number): [number, number] {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}

/** Comprimento acumulado até cada ponto; a última entrada fecha o laço (= comprimento total). */
export function lineCumulative(line: TrainLine): Float32Array {
  const n = line.points.length / 3;
  const cum = new Float32Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const a = (i - 1) * 3;
    const b = (i % n) * 3;
    cum[i] = cum[i - 1]! + Math.hypot(line.points[b]! - line.points[a]!, line.points[b + 2]! - line.points[a + 2]!);
  }
  return cum;
}

/** Ponto e heading (tangente) do laço a `s` m do começo, com `s` enrolado no comprimento. */
export function lineAt(line: TrainLine, cum: Float32Array, s: number): { x: number; y: number; z: number; heading: number } {
  const n = line.points.length / 3;
  const L = cum[n]!;
  let d = ((s % L) + L) % L;
  let lo = 0;
  let hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! <= d) lo = mid;
    else hi = mid;
  }
  const a = lo * 3;
  const b = ((lo + 1) % n) * 3;
  const seg = cum[lo + 1]! - cum[lo]!;
  const t = seg > 0 ? (d - cum[lo]!) / seg : 0;
  const p = line.points;
  const dx = p[b]! - p[a]!;
  const dz = p[b + 2]! - p[a + 2]!;
  return {
    x: p[a]! + dx * t,
    y: p[a + 1]! + (p[b + 1]! - p[a + 1]!) * t,
    z: p[a + 2]! + dz * t,
    heading: Math.atan2(dx, dz),
  };
}

/** Portais a cada 24 m, sobre a avenida mais perto, pulando os que ficam a menos de 12 m de outra estrada. */
function placeFrames(line: TrainLine, cum: Float32Array, network: RoadNetwork, avenues: Road[]): TrainFrame[] {
  const frames: TrainFrame[] = [];
  const nearestOn = (road: Road, x: number, z: number): { d: number; y: number } => {
    let best = { d: Infinity, y: 0 };
    const n = count(road);
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(road.points[i * 3]! - x, road.points[i * 3 + 2]! - z);
      if (d < best.d) best = { d, y: road.points[i * 3 + 1]! };
    }
    return best;
  };
  for (let s = 0; s < line.length - FRAME_SPACING / 2; s += FRAME_SPACING) {
    const p = lineAt(line, cum, s);
    let under = avenues[0]!;
    let underD = Infinity;
    let y = p.y - DECK_HEIGHT;
    for (const av of avenues) {
      const n = nearestOn(av, p.x, p.z);
      if (n.d < underD) {
        underD = n.d;
        under = av;
        y = n.y;
      }
    }
    let clear = true;
    for (const road of network.roads) {
      if (road === under) continue;
      if (nearestOn(road, p.x, p.z).d < FRAME_ROAD_CLEAR) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;
    frames.push({ x: p.x, z: p.z, y, heading: p.heading, halfWidth: under.width / 2 });
  }
  return frames;
}

/** Posições das duas colunas de um portal: à direita e à esquerda da linha, a `w/2 + FRAME_SIDE`. */
export function frameColumns(f: TrainFrame): Array<{ x: number; z: number }> {
  const off = f.halfWidth + FRAME_SIDE;
  const rx = Math.cos(f.heading);
  const rz = -Math.sin(f.heading);
  return [
    { x: f.x + rx * off, z: f.z + rz * off },
    { x: f.x - rx * off, z: f.z - rz * off },
  ];
}
