/**
 * Corridas da cidade (races, door 1): função pura `generateRaces(network)` que
 * tira da `RoadNetwork` as 4 corridas por regra sobre a geometria das estradas,
 * nunca por id de estrada nem por coordenada escrita à mão.
 *
 * - `circuito-centro`: o quadrado das avenidas em x ≈ ±300 e z ≈ ±300, 2 voltas
 * - `circuito-anel`: a rodovia em anel, 1 volta
 * - `sprint-cruzada`: avenida em z ≈ 0 da ponta oeste até o centro, e dali pela
 *   avenida em x ≈ 0 até a ponta com z > 0
 * - `sprint-morro`: a estrada de morro mais longa, do começo ao fim
 *
 * Heading segue o `Car`: frente = (sin h, cos h) no plano xz.
 */
import type { Road, RoadNetwork } from '../world/roads/RoadGenerator';

export type RaceKind = 'sprint' | 'circuit';

export interface RaceGate {
  x: number;
  y: number;
  z: number;
  heading: number;
  halfWidth: number;
  /** m ao longo do traçado */
  s: number;
}

export interface GridSlot {
  x: number;
  y: number;
  z: number;
  heading: number;
}

export interface RaceDef {
  id: string;
  name: string;
  kind: RaceKind;
  laps: number;
  route: { points: Float32Array /* x,y,z */; closed: boolean; length: number };
  /** o último é a chegada; no circuito, a linha de largada/chegada */
  gates: RaceGate[];
  /** 4; o jogador fica no 3 */
  grid: GridSlot[];
  marker: { x: number; z: number; radius: number };
}

/** lugar do grid do jogador */
export const PLAYER_SLOT = 3;
export const MARKER_RADIUS = 10;
/** distância máxima entre portões ao longo do traçado (m) */
const GATE_SPACING = 200;
/** folga de cada lado da pista na meia largura do portão (m) */
const GATE_MARGIN = 4;
/** no sprint, a linha de largada fica a 30 m do começo do traçado; o grid fica antes dela */
const SPRINT_START_S = 30;
/** filas do grid: distância antes da linha de largada (m) */
const GRID_ROWS = [8, 16];
/** deslocamento lateral de cada coluna do grid (m) */
const GRID_LATERAL = 3;
/** passo máximo entre pontos ao ligar duas estradas num cruzamento (m) */
const JOIN_STEP = 2;
/** salto acima do qual a junção ganha pontos intermediários (m); as estradas já têm ponto a cada 2 m */
const JOIN_GAP = 3;

// ------------------------------------------------------------------ geometria

type Pt = [number, number, number];

function pointOf(road: Road, i: number): Pt {
  const p = road.points;
  return [p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!];
}

function count(road: Road): number {
  return road.points.length / 3;
}

/** Eixo e coordenada lateral média de uma avenida (ao longo de x: lateral = z médio). */
function avenueAxis(road: Road): { axis: 'x' | 'z'; lateral: number } {
  const n = count(road);
  const [x0, , z0] = pointOf(road, 0);
  const [x1, , z1] = pointOf(road, n - 1);
  const axis = Math.abs(x1 - x0) >= Math.abs(z1 - z0) ? 'x' : 'z';
  let sum = 0;
  for (let i = 0; i < n; i++) sum += road.points[i * 3 + (axis === 'x' ? 2 : 0)]!;
  return { axis, lateral: sum / n };
}

/** A avenida ao longo de `axis` com lateral média mais perto de `lateral`, a no máximo 60 m. */
function findAvenue(network: RoadNetwork, axis: 'x' | 'z', lateral: number): Road | null {
  let best: Road | null = null;
  let bestD = 60;
  for (const road of network.roads) {
    if (road.kind !== 'avenue') continue;
    const a = avenueAxis(road);
    if (a.axis !== axis) continue;
    const d = Math.abs(a.lateral - lateral);
    if (d < bestD) {
      bestD = d;
      best = road;
    }
  }
  return best;
}

/** Par de índices (i em a, j em b) de menor distância horizontal: o cruzamento das duas estradas. */
function crossing(a: Road, b: Road): { i: number; j: number; d: number } {
  let best = { i: 0, j: 0, d: Infinity };
  const na = count(a);
  const nb = count(b);
  for (let i = 0; i < na; i++) {
    const ax = a.points[i * 3]!;
    const az = a.points[i * 3 + 2]!;
    for (let j = 0; j < nb; j++) {
      const d = (b.points[j * 3]! - ax) ** 2 + (b.points[j * 3 + 2]! - az) ** 2;
      if (d < best.d) best = { i, j, d };
    }
  }
  return { ...best, d: Math.sqrt(best.d) };
}

interface Leg {
  road: Road;
  from: number;
  to: number;
}

/** Junta os trechos numa polilinha; entre o fim de um trecho e o começo do próximo, pontos a cada ≤ 2 m. */
function joinLegs(legs: Leg[], closed: boolean): Pt[] {
  const out: Pt[] = [];
  const push = (p: Pt) => {
    const last = out[out.length - 1];
    if (last) {
      const gap = Math.hypot(p[0] - last[0], p[2] - last[2]);
      if (gap < 0.5) return;
      // pontos intermediários só num salto maior que o passo das estradas
      const n = gap > JOIN_GAP ? Math.ceil(gap / JOIN_STEP) : 1;
      for (let k = 1; k < n; k++) {
        const t = k / n;
        out.push([last[0] + (p[0] - last[0]) * t, last[1] + (p[1] - last[1]) * t, last[2] + (p[2] - last[2]) * t]);
      }
    }
    out.push(p);
  };
  for (const leg of legs) {
    const dir = leg.to >= leg.from ? 1 : -1;
    for (let i = leg.from; i !== leg.to + dir; i += dir) push(pointOf(leg.road, i));
  }
  if (closed && out.length > 1) {
    // fecha o laço com pontos intermediários, sem repetir o primeiro
    const first = out[0]!;
    const last = out[out.length - 1]!;
    const gap = Math.hypot(first[0] - last[0], first[2] - last[2]);
    if (gap < 0.5) out.pop();
    else {
      const n = gap > JOIN_GAP ? Math.ceil(gap / JOIN_STEP) : 1;
      for (let k = 1; k < n; k++) {
        const t = k / n;
        out.push([last[0] + (first[0] - last[0]) * t, last[1] + (first[1] - last[1]) * t, last[2] + (first[2] - last[2]) * t]);
      }
    }
  }
  return out;
}

/** Comprimento acumulado horizontal: `cum[i]` = m do ponto 0 ao ponto i; `total` fecha o laço no circuito. */
function cumulative(pts: Pt[], closed: boolean): { cum: number[]; total: number } {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![2] - pts[i - 1]![2]));
  }
  let total = cum[cum.length - 1]!;
  if (closed) {
    const a = pts[pts.length - 1]!;
    const b = pts[0]!;
    total += Math.hypot(b[0] - a[0], b[2] - a[2]);
  }
  return { cum, total };
}

/** Ponto e heading do traçado na distância `s` (com volta, no circuito). */
export function routeAt(
  route: RaceDef['route'],
  s: number,
): { x: number; y: number; z: number; heading: number } {
  const p = route.points;
  const n = p.length / 3;
  const L = route.length;
  let t = route.closed ? ((s % L) + L) % L : Math.min(Math.max(s, 0), L);
  const segs = route.closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n;
    const seg = Math.hypot(p[j * 3]! - p[i * 3]!, p[j * 3 + 2]! - p[i * 3 + 2]!);
    if (t <= seg || i === segs - 1) {
      const f = seg > 0 ? Math.min(t / seg, 1) : 0;
      return {
        x: p[i * 3]! + (p[j * 3]! - p[i * 3]!) * f,
        y: p[i * 3 + 1]! + (p[j * 3 + 1]! - p[i * 3 + 1]!) * f,
        z: p[i * 3 + 2]! + (p[j * 3 + 2]! - p[i * 3 + 2]!) * f,
        heading: Math.atan2(p[j * 3]! - p[i * 3]!, p[j * 3 + 2]! - p[i * 3 + 2]!),
      };
    }
    t -= seg;
  }
  throw new Error('route needs at least 2 points');
}

/** Largura da estrada cujo ponto fica mais perto de (x, z). */
function widthAt(network: RoadNetwork, x: number, z: number): number {
  let best = Infinity;
  let width = 10;
  for (const road of network.roads) {
    const p = road.points;
    for (let i = 0; i < p.length; i += 3) {
      const d = (p[i]! - x) ** 2 + (p[i + 2]! - z) ** 2;
      if (d < best) {
        best = d;
        width = road.width;
      }
    }
  }
  return width;
}

// ------------------------------------------------------------------ montagem

function buildRace(
  network: RoadNetwork,
  id: string,
  name: string,
  kind: RaceKind,
  laps: number,
  pts: Pt[],
): RaceDef {
  const closed = kind === 'circuit';
  const { total } = cumulative(pts, closed);
  const points = new Float32Array(pts.length * 3);
  pts.forEach((p, i) => points.set(p, i * 3));
  const route = { points, closed, length: total };

  // linha de largada: s = 0 no circuito (é também a chegada), 30 m no sprint
  const startS = closed ? 0 : SPRINT_START_S;
  const n = Math.max(1, Math.ceil((total - startS) / GATE_SPACING));
  const step = (total - startS) / n;
  const gates: RaceGate[] = [];
  for (let k = 1; k <= n; k++) {
    const s = startS + step * k;
    const at = routeAt(route, closed && k === n ? 0 : s);
    gates.push({ ...at, halfWidth: widthAt(network, at.x, at.z) / 2 + GATE_MARGIN, s });
  }

  const grid: GridSlot[] = [];
  for (const back of GRID_ROWS) {
    const at = routeAt(route, startS - back);
    // direita do carro = (−cos h, sin h)
    const rx = -Math.cos(at.heading);
    const rz = Math.sin(at.heading);
    for (const side of [-1, 1]) {
      grid.push({ x: at.x + rx * side * GRID_LATERAL, y: at.y, z: at.z + rz * side * GRID_LATERAL, heading: at.heading });
    }
  }

  const start = routeAt(route, startS);
  return { id, name, kind, laps, route, gates, grid, marker: { x: start.x, z: start.z, radius: MARKER_RADIUS } };
}

/** Roda o loop para começar no meio do primeiro trecho (o grid não fica numa esquina). */
function rotateToMiddleOfFirstLeg(pts: Pt[], firstLegLength: number): Pt[] {
  const k = Math.floor(firstLegLength / 2);
  return [...pts.slice(k), ...pts.slice(0, k)];
}

type RaceRule = (network: RoadNetwork) => RaceDef | string;

const RULES: RaceRule[] = [
  (network) => {
    const south = findAvenue(network, 'x', -300);
    const north = findAvenue(network, 'x', 300);
    const west = findAvenue(network, 'z', -300);
    const east = findAvenue(network, 'z', 300);
    if (!south || !north || !west || !east) return 'avenida do quadrado do centro não encontrada';
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
    const pts = rotateToMiddleOfFirstLeg(joinLegs(legs, true), Math.abs(se.i - sw.i));
    return buildRace(network, 'circuito-centro', 'Circuito Centro', 'circuit', 2, pts);
  },
  (network) => {
    const ring = network.roads.find((r) => r.kind === 'highway' && r.closed);
    if (!ring) return 'rodovia em anel não encontrada';
    const pts = joinLegs([{ road: ring, from: 0, to: count(ring) - 1 }], true);
    return buildRace(network, 'circuito-anel', 'Circuito Anel', 'circuit', 1, pts);
  },
  (network) => {
    const across = findAvenue(network, 'x', 0);
    const up = findAvenue(network, 'z', 0);
    if (!across || !up) return 'avenidas do centro não encontradas';
    const c = crossing(across, up);
    const na = count(across);
    const nu = count(up);
    const westEnd = across.points[0]! <= across.points[(na - 1) * 3]! ? 0 : na - 1;
    const northEnd = up.points[2]! > up.points[(nu - 1) * 3 + 2]! ? 0 : nu - 1;
    const pts = joinLegs(
      [
        { road: across, from: westEnd, to: c.i },
        { road: up, from: c.j, to: northEnd },
      ],
      false,
    );
    return buildRace(network, 'sprint-cruzada', 'Sprint Cruzada', 'sprint', 1, pts);
  },
  (network) => {
    let hill: Road | null = null;
    for (const r of network.roads) if (r.kind === 'hill' && (!hill || count(r) > count(hill))) hill = r;
    if (!hill) return 'estrada de morro não encontrada';
    const pts = joinLegs([{ road: hill, from: 0, to: count(hill) - 1 }], false);
    return buildRace(network, 'sprint-morro', 'Sprint Morro', 'sprint', 1, pts);
  },
];

const RULE_IDS = ['circuito-centro', 'circuito-anel', 'sprint-cruzada', 'sprint-morro'];

/** As corridas da rede, na ordem fixa. Uma regra que não acha a estrada dela deixa a corrida de fora. */
export function generateRaces(network: RoadNetwork): RaceDef[] {
  const races: RaceDef[] = [];
  RULES.forEach((rule, k) => {
    const r = rule(network);
    if (typeof r === 'string') console.warn(`race ${RULE_IDS[k]} skipped: ${r}`);
    else races.push(r);
  });
  return races;
}
