/**
 * Piloto dos oponentes (races door 2), puro: devolve só o `DriveInput` que o
 * `Car` do oponente recebe, como o teclado do jogador. Nenhuma força, torque ou
 * teleporte sai daqui; o reset de travado é decidido aqui e feito pela corrida.
 *
 * - volante: mira um ponto do traçado à frente (8-40 m, cresce com a velocidade),
 *   deslocado de lado pela faixa do oponente; esquerda = +1, como a tecla A
 * - velocidade: a de curva em cada ponto à frente, `habilidade² · sqrt(A_LAT · raio)`,
 *   com a distância de frenagem (`A_BRAKE · habilidade`) até ele; acelera abaixo do alvo, freia acima
 */
import type { DriveInput } from '../vehicle/drivetrain';
import type { RaceDef } from './raceRoutes';

/** habilidade, deslocamento lateral (m), pintura e nome dos oponentes 0, 1 e 2 */
export const AI_SKILLS = [0.8, 0.88, 0.95] as const;
export const AI_OFFSETS = [-3, 0, 3] as const;
export const AI_PAINTS = ['#2f8cff', '#ffd23f', '#3fe07a'] as const;
export const AI_NAMES = ['BIA', 'CAIO', 'DUDA'] as const;

/** aceleração lateral de referência (m/s²) com habilidade 1 */
const A_LAT = 1.0 * 9.81;
/** desaceleração que o piloto conta ter para frear antes da curva (m/s²) */
const A_BRAKE = 6;
/** velocidade máxima pedida (m/s) */
const V_MAX = 70;
/** pontos de cada lado para medir o raio (2 m por ponto: 10 m) */
const RADIUS_SPAN = 5;
/** zona morta do volante (rad) */
const STEER_DEADBAND = 0.03;
/** janela de busca do ponto mais perto, em pontos para trás e para a frente */
const SEARCH_BACK = 20;
const SEARCH_AHEAD = 60;

// travado (AC 21)
export const STUCK_WINDOW_S = 4;
export const STUCK_MIN_M = 5;
export const STUCK_WATER_Y = -1.5;

export interface AiView {
  x: number;
  y: number;
  z: number;
  heading: number;
  speedMs: number;
}

/** Traçado pré-processado: comprimento acumulado e raio de curva em cada ponto. */
export interface AiRoute {
  points: Float32Array;
  closed: boolean;
  length: number;
  cum: Float64Array;
  radius: Float64Array;
}

export interface AiState {
  /** índice do ponto do traçado mais perto (-1 = ainda não buscado) */
  index: number;
  /** progresso contínuo ao longo do traçado (m), somando voltas */
  progress: number;
  stuckT0: number;
  stuckS0: number;
}

export function createAiState(): AiState {
  return { index: -1, progress: 0, stuckT0: 0, stuckS0: 0 };
}

function n3(route: { points: Float32Array }): number {
  return route.points.length / 3;
}

export function prepareRoute(route: RaceDef['route']): AiRoute {
  const p = route.points;
  const n = p.length / 3;
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1]! + Math.hypot(p[i * 3]! - p[i * 3 - 3]!, p[i * 3 + 2]! - p[i * 3 - 1]!);
  const radius = new Float64Array(n);
  const at = (i: number) => {
    const k = route.closed ? ((i % n) + n) % n : Math.min(Math.max(i, 0), n - 1);
    return [p[k * 3]!, p[k * 3 + 2]!] as const;
  };
  for (let i = 0; i < n; i++) {
    const [ax, az] = at(i - RADIUS_SPAN);
    const [bx, bz] = at(i);
    const [cx, cz] = at(i + RADIUS_SPAN);
    const cross = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    const abc = Math.hypot(bx - ax, bz - az) * Math.hypot(cx - bx, cz - bz) * Math.hypot(cx - ax, cz - az);
    radius[i] = Math.abs(cross) < 1e-9 ? Infinity : abc / (2 * Math.abs(cross));
  }
  return { points: p, closed: route.closed, length: route.length, cum, radius };
}

/** Velocidade de curva (m/s) num raio `r` com a habilidade `skill`. */
export function cornerSpeed(r: number, skill: number): number {
  return Math.min(V_MAX, skill * skill * Math.sqrt(A_LAT * r));
}

function wrapIndex(route: AiRoute, i: number): number {
  const n = n3(route);
  return route.closed ? ((i % n) + n) % n : Math.min(Math.max(i, 0), n - 1);
}

/** Índice do ponto mais perto: busca global na primeira vez, depois numa janela em volta do último. */
function nearestIndex(route: AiRoute, x: number, z: number, hint: number): number {
  const p = route.points;
  const n = n3(route);
  const from = hint < 0 ? 0 : hint - SEARCH_BACK;
  const to = hint < 0 ? n - 1 : hint + SEARCH_AHEAD;
  let best = hint < 0 ? 0 : wrapIndex(route, hint);
  let bestD = Infinity;
  for (let k = from; k <= to; k++) {
    const i = wrapIndex(route, k);
    const d = (p[i * 3]! - x) ** 2 + (p[i * 3 + 2]! - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Distância ao longo do traçado de `i` para a frente até `j`. */
function ahead(route: AiRoute, i: number, j: number): number {
  const d = route.cum[j]! - route.cum[i]!;
  return d < 0 && route.closed ? d + route.length : d;
}

/** Velocidade-alvo agora: a menor entre as curvas à frente, cada uma com a distância para frear até ela. */
export function targetSpeed(route: AiRoute, index: number, skill: number, speedMs: number): number {
  const window = (speedMs * speedMs) / (2 * A_BRAKE * skill) + 40;
  let target = V_MAX;
  const n = n3(route);
  for (let k = 0; k < n; k++) {
    const j = wrapIndex(route, index + k);
    if (!route.closed && index + k >= n) break;
    const d = ahead(route, index, j);
    if (d > window) break;
    const v = cornerSpeed(route.radius[j]!, skill);
    target = Math.min(target, Math.sqrt(v * v + 2 * A_BRAKE * skill * d));
  }
  return target;
}

/** Um passo do piloto: o `DriveInput` do oponente e o estado atualizado (índice e progresso). */
export function aiDrive(car: AiView, route: AiRoute, ai: AiState, skill: number, offset: number): DriveInput {
  const prev = ai.index;
  const index = nearestIndex(route, car.x, car.z, prev);
  if (prev >= 0) {
    let ds = route.cum[index]! - route.cum[prev]!;
    if (route.closed && ds < -route.length / 2) ds += route.length;
    if (route.closed && ds > route.length / 2) ds -= route.length;
    ai.progress += ds;
  } else ai.progress = route.cum[index]!;
  ai.index = index;

  // ponto-alvo à frente, deslocado para a faixa do oponente
  const look = Math.min(40, Math.max(8, 8 + 0.6 * car.speedMs));
  const p = route.points;
  let j = index;
  const n = n3(route);
  for (let k = 1; k < n; k++) {
    const next = wrapIndex(route, index + k);
    if (!route.closed && index + k >= n) break;
    j = next;
    if (ahead(route, index, j) >= look) break;
  }
  // tangente do traçado em j (no fim de um sprint, a do último trecho)
  const last = !route.closed && j === n - 1;
  const a0 = last ? j - 1 : j;
  const a1 = last ? j : wrapIndex(route, j + 1);
  const hx = p[a1 * 3]! - p[a0 * 3]!;
  const hz = p[a1 * 3 + 2]! - p[a0 * 3 + 2]!;
  const hl = Math.hypot(hx, hz) || 1;
  // com frente (hx, hz), a direita é (−hz, hx)
  const tx = p[j * 3]! + (-hz / hl) * offset;
  const tz = p[j * 3 + 2]! + (hx / hl) * offset;

  let a = Math.atan2(tx - car.x, tz - car.z) - car.heading;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  const steer = a > STEER_DEADBAND ? 1 : a < -STEER_DEADBAND ? -1 : 0;

  const target = targetSpeed(route, index, skill, car.speedMs);
  const v = car.speedMs;
  return {
    throttle: v < target - 0.5,
    brake: v > target + 1.5,
    steer,
    handbrake: false,
  };
}

/** Depois de um teleporte: acha o ponto mais perto no traçado todo e soma ao progresso só o salto até ele. */
export function relocate(route: AiRoute, ai: AiState, x: number, z: number): void {
  const i = nearestIndex(route, x, z, -1);
  if (ai.index >= 0) {
    let ds = route.cum[i]! - route.cum[ai.index]!;
    if (route.closed && ds < -route.length / 2) ds += route.length;
    if (route.closed && ds > route.length / 2) ds -= route.length;
    ai.progress += ds;
  } else ai.progress = route.cum[i]!;
  ai.index = i;
}

/**
 * Travado (AC 21): na água (chassi abaixo de -1.5 m) na hora; ou quando faz
 * 4 s que o progresso ao longo do traçado não anda 5 m (a marca sobe a cada
 * 5 m andados). Depois de disparar, a marca recomeça em (t, s).
 */
export function checkStuck(ai: AiState, t: number, y: number): boolean {
  if (y < STUCK_WATER_Y) {
    restartStuck(ai, t);
    return true;
  }
  if (ai.progress - ai.stuckS0 >= STUCK_MIN_M) {
    restartStuck(ai, t);
    return false;
  }
  if (t - ai.stuckT0 < STUCK_WINDOW_S - 1e-9) return false;
  restartStuck(ai, t);
  return true;
}

export function restartStuck(ai: AiState, t: number): void {
  ai.stuckT0 = t;
  ai.stuckS0 = ai.progress;
}
