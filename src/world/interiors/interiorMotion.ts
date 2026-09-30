/**
 * Tudo o que se mexe ou muda de cor no miolo das quadras (block-fill), em
 * função do tempo e sem three: a cor do terreno, o peso e o nível da luz
 * rebatida, o balanço das lâmpadas e das copas, os vagalumes, o guindaste, o
 * farol, os holofotes e os pedestres. Os shaders repetem as mesmas contas
 * (`InteriorScene`), então o que o teste prova aqui é o que a tela mostra.
 *
 * Ritmos calmos de propósito ("low-cortisol", pedido do usuário em 2026-09-25).
 */
import { mulberry32 } from '../CityGenerator';
import { valueNoise } from '../terrain/noise';
import { nearestVertex, type BlockInteriors, type InteriorZone } from './BlockInteriors';
import type { WalkerSpawn, CatSpawn } from './InteriorProps';
import { lineAt, type TrainLine } from '../rail/trainLine';

// ---------------------------------------------------------------- cor do chão

export const GRASS_HEX = '#3f5e36';
export const PATIO_HEX = '#55555a';
export const ROCK_HEX = '#4d473d';
export const SAND_HEX = '#5a5242';
/** variação de brilho da grama e do pátio (±8 %) */
export const GROUND_VARIATION = 0.08;
/** escala do ruído da grama (m) */
export const GROUND_NOISE_SCALE = 8;

export type GroundKind = 'none' | 'downtown' | 'outer';

/** Componente sRGB (0..1) para linear, a mesma curva do three. */
export function srgbToLinear(c: number): number {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

/** '#rrggbb' em RGB linear, como `THREE.Color` guarda. */
export function hexToLinear(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [srgbToLinear(((v >> 16) & 255) / 255), srgbToLinear(((v >> 8) & 255) / 255), srgbToLinear((v & 255) / 255)];
}

const GRASS = hexToLinear(GRASS_HEX);
const PATIO = hexToLinear(PATIO_HEX);
const ROCK = hexToLinear(ROCK_HEX);
const SAND = hexToLinear(SAND_HEX);

/** Ruído do seed em escala de 8 m, sempre em [−1, 1]. */
export function terrainNoise(seed: number, x: number, z: number): number {
  return 2 * valueNoise(x / GROUND_NOISE_SCALE, z / GROUND_NOISE_SCALE, seed ^ 0x6a55) - 1;
}

/**
 * Cor por vértice do terreno (RGB linear): grama (ou pátio de concreto no
 * miolo do centro) com ±8 % de brilho pelo ruído, misturada com rocha pela
 * inclinação e com areia perto da água, como antes da block-fill.
 */
export function terrainColor(height: number, slope: number, noise: number, kind: GroundKind): [number, number, number] {
  const base = kind === 'downtown' ? PATIO : GRASS;
  const k = 1 + GROUND_VARIATION * noise;
  let r = base[0] * k;
  let g = base[1] * k;
  let b = base[2] * k;
  const rock = Math.min(1, slope * 2.5);
  r += (ROCK[0] - r) * rock;
  g += (ROCK[1] - g) * rock;
  b += (ROCK[2] - b) * rock;
  if (height < 1) {
    const sand = Math.min(1, 1 - height);
    r += (SAND[0] - r) * sand;
    g += (SAND[1] - g) * sand;
    b += (SAND[2] - b) * sand;
  }
  return [r, g, b];
}

// ------------------------------------------------------------- luz rebatida

/** alcance da luz rebatida das janelas (m) */
export const BOUNCE_RANGE = 25;

/** Peso da luz rebatida no vértice: 0 fora do miolo, 1 colado no prédio, 0 a 25 m ou mais. */
export function bounceWeight(zoneOf: number, facadeDist: number): number {
  if (zoneOf < 0) return 0;
  return Math.max(0, 1 - facadeDist / BOUNCE_RANGE);
}

export const ZONE_HOLD_MIN = 20;
export const ZONE_HOLD_MAX = 60;
export const ZONE_RAMP = 3;

interface ZoneSchedule {
  /** início de cada patamar (s) */
  starts: number[];
  /** duração de cada patamar (s) */
  holds: number[];
  /** nível de cada patamar (1.0 ou 0.5) */
  levels: number[];
  rng: () => number;
}

const schedules = new Map<string, ZoneSchedule>();

function scheduleFor(zoneId: number, seed: number, until: number): ZoneSchedule {
  const key = `${seed}:${zoneId}`;
  let s = schedules.get(key);
  if (!s) {
    const rng = mulberry32((seed ^ 0x2f6b1d) + Math.imul(zoneId + 1, 0x9e3779b1));
    const first = rng() < 0.5 ? 1 : 0.5;
    s = { starts: [0], holds: [ZONE_HOLD_MIN + rng() * (ZONE_HOLD_MAX - ZONE_HOLD_MIN)], levels: [first], rng };
    schedules.set(key, s);
  }
  for (;;) {
    const last = s.starts.length - 1;
    const end = s.starts[last]! + s.holds[last]! + ZONE_RAMP;
    if (end > until) break;
    s.starts.push(end);
    s.holds.push(ZONE_HOLD_MIN + s.rng() * (ZONE_HOLD_MAX - ZONE_HOLD_MIN));
    s.levels.push(s.levels[last] === 1 ? 0.5 : 1);
  }
  return s;
}

/**
 * Nível da luz de uma zona no instante `t` (s): patamares de 1.0 e 0.5 que
 * duram de 20 a 60 s (sorteio pelo PRNG a partir do id da zona), ligados por
 * rampas lineares de 3 s. Mesmo id e mesmo t dão sempre o mesmo valor.
 */
export function zoneLight(zoneId: number, t: number, seed = 1337): number {
  const time = Math.max(0, t);
  const s = scheduleFor(zoneId, seed, time);
  // busca binária do patamar que começou por último antes de t
  let lo = 0;
  let hi = s.starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s.starts[mid]! <= time) lo = mid;
    else hi = mid - 1;
  }
  const into = time - s.starts[lo]!;
  const level = s.levels[lo]!;
  if (into <= s.holds[lo]!) return level;
  const next = level === 1 ? 0.5 : 1;
  return level + (next - level) * ((into - s.holds[lo]!) / ZONE_RAMP);
}

// ------------------------------------------------------------------ quintais

/** amplitude do balanço das lâmpadas (m) */
export const BULB_AMPLITUDE = 0.12;

/** Frequência (0.2 a 0.4 Hz) e fase do balanço de uma lâmpada, pela posição. */
export function bulbSway(x: number, z: number): { freq: number; phase: number } {
  const h = hash01(x * 0.731 + 11.3, z * 1.137 - 4.1);
  const p = hash01(z * 0.913 - 7.7, x * 0.577 + 2.9);
  return { freq: 0.2 + 0.2 * h, phase: p * Math.PI * 2 };
}

/** Deslocamento horizontal da lâmpada (m): `A · sin(2π f t + fase)`. */
export function bulbOffset(t: number, phase: number, freq: number): number {
  return BULB_AMPLITUDE * Math.sin(2 * Math.PI * freq * t + phase);
}

/** velocidade do deslocamento do normal map da piscina (uv/s) */
export const POOL_FLOW = [0.02, 0.013] as const;

// ------------------------------------------------------------------- árvores

/** amplitude do balanço da copa (m) */
export const CROWN_AMPLITUDE = 0.25;

/** Frequência (0.2 a 0.4 Hz), fase e direção do vento na copa, pela posição. */
export function crownSwayParams(x: number, z: number): { freq: number; phase: number; dirX: number; dirZ: number } {
  const freq = 0.2 + 0.2 * hash01(x * 0.371 + 3.7, z * 0.529 - 1.3);
  const phase = hash01(z * 0.211 + 8.1, x * 0.433 + 5.5) * Math.PI * 2;
  // vento de oeste com ±30° de variação
  const a = Math.PI / 2 + (hash01(x * 0.137 - 2.2, z * 0.173 + 9.4) - 0.5) * (Math.PI / 3);
  return { freq, phase, dirX: Math.sin(a), dirZ: Math.cos(a) };
}

/** Deslocamento horizontal do topo da copa (m) no instante `t`. */
export function crownSway(t: number, x: number, z: number): { dx: number; dz: number } {
  const p = crownSwayParams(x, z);
  const s = CROWN_AMPLITUDE * Math.sin(2 * Math.PI * p.freq * t + p.phase);
  return { dx: s * p.dirX, dz: s * p.dirZ };
}

/**
 * Deriva do vagalume por eixo: amplitude (m) e frequência (Hz). Fonte única da conta do
 * vertex shader do vagalume (`InteriorScene.ts`) e da sonda DEV `fireflyPositions`.
 * |v| ≤ √((1.0·2π·0.05)² + (1.0·2π·0.045)² + (0.4·2π·0.06)²) ≈ 0.45 m/s
 */
export type FireflyDriftSpec = Record<'x' | 'y' | 'z', { amp: number; freq: number }>;

export const FIREFLY_DRIFT: Readonly<FireflyDriftSpec> = {
  x: { amp: 1.0, freq: 0.05 },
  y: { amp: 0.4, freq: 0.06 },
  z: { amp: 1.0, freq: 0.045 },
};

/** Deslocamento do vagalume em torno da âncora (m): `A · sin(2π f t + fase)` em cada eixo. */
export function fireflyDrift(
  t: number,
  phaseX: number,
  phaseY: number,
  phaseZ: number,
  drift: Readonly<FireflyDriftSpec> = FIREFLY_DRIFT,
): { dx: number; dy: number; dz: number } {
  return {
    dx: drift.x.amp * Math.sin(2 * Math.PI * drift.x.freq * t + phaseX),
    dy: drift.y.amp * Math.sin(2 * Math.PI * drift.y.freq * t + phaseY),
    dz: drift.z.amp * Math.sin(2 * Math.PI * drift.z.freq * t + phaseZ),
  };
}

/** Deriva e brilho do vagalume `i` em torno da sua âncora: lento (≤ 0.5 m/s) e pulsando a 0.3-0.6 Hz. */
export function fireflyMotion(
  t: number,
  i: number,
): { dx: number; dy: number; dz: number; glow: number; pulseHz: number; phaseX: number; phaseY: number; phaseZ: number } {
  const phaseX = hash01(i * 0.618 + 0.3, 1.7) * Math.PI * 2;
  const phaseZ = hash01(i * 0.414 + 2.1, 3.9) * Math.PI * 2;
  const phaseY = hash01(i * 0.732 + 4.4, 0.6) * Math.PI * 2;
  const pulseHz = 0.3 + 0.3 * hash01(i * 0.271 + 6.2, 7.1);
  const { dx, dy, dz } = fireflyDrift(t, phaseX, phaseY, phaseZ);
  const glow = 0.5 + 0.5 * Math.sin(2 * Math.PI * pulseHz * t + phaseX);
  return { dx, dy, dz, glow, pulseHz, phaseX, phaseY, phaseZ };
}

/** vagalumes por qualidade */
export const FIREFLIES_HIGH = 600;
export const FIREFLIES_LOW = 300;

// --------------------------------------------------------------------- obras

/** Período de uma volta da lança (90 a 150 s), pela posição do canteiro. */
export function cranePeriod(x: number, z: number): number {
  return 90 + 60 * hash01(x * 0.0917 + 1.9, z * 0.0731 - 3.3);
}

/** Ângulo da lança (rad, sem enrolar): uma volta completa a cada `period` s. */
export function jibAngle(t: number, period: number, phase = 0): number {
  return phase + (2 * Math.PI * t) / period;
}

/** Farol vermelho no topo da torre: 1 Hz, aceso 0.2 s de cada segundo. */
export function beaconOn(t: number): boolean {
  return t - Math.floor(t) < 0.2;
}

export const FLOOD_SWEEP = Math.PI / 6;
export const FLOOD_PERIOD = 20;

/** Heading do holofote: ±30° em torno de `base`, num ciclo de 20 s. */
export function floodSweep(t: number, base: number): number {
  return base + FLOOD_SWEEP * Math.sin((2 * Math.PI * t) / FLOOD_PERIOD);
}

// ----------------------------------------------------------------- pedestres

export const WALKER_RANGE = 300;
export const WALKER_DENSITY = 3 / 1000;
export const WALKER_CAP_HIGH = 400;
export const WALKER_CAP_LOW = 200;
export const WALKER_SPEED_MIN = 1.25;
export const WALKER_SPEED_MAX = 1.55;
export const FLEE_SPEED = 3;
export const FLEE_START = 8;
export const FLEE_STOP = 15;

/** Quantos pedestres cabem: 3 por 1000 m² das zonas ao alcance, até 400 (high) ou 200 (low). */
export function walkerBudget(zonesInRange: ReadonlyArray<Pick<InteriorZone, 'areaM2'>>, quality: 'high' | 'low'): number {
  const cap = quality === 'low' ? WALKER_CAP_LOW : WALKER_CAP_HIGH;
  let area = 0;
  for (const z of zonesInRange) area += z.areaM2;
  return Math.min(cap, Math.floor((area * 3) / 1000));
}

/** Balanço vertical do corpo (m): ±3 cm a 2 Hz. */
export function walkerBob(t: number): number {
  return 0.03 * Math.sin(4 * Math.PI * t);
}

/**
 * Quais pontos de partida de pedestre ficam ativos com o carro em (x, z): as
 * zonas cuja caixa chega a 300 m do carro dão o orçamento (`walkerBudget`), e
 * entram os pontos dessas zonas a até 300 m, do mais perto para o mais longe,
 * até o orçamento. Devolve os índices em `spawns`.
 */
export function activeWalkerSpawns(
  spawns: ReadonlyArray<WalkerSpawn>,
  zones: ReadonlyArray<InteriorZone>,
  car: { x: number; z: number },
  quality: 'high' | 'low',
): number[] {
  const inRange = zones.filter((z) => {
    const dx = Math.max(z.bbox.minX - car.x, 0, car.x - z.bbox.maxX);
    const dz = Math.max(z.bbox.minZ - car.z, 0, car.z - z.bbox.maxZ);
    return Math.hypot(dx, dz) <= WALKER_RANGE;
  });
  const budget = walkerBudget(inRange, quality);
  if (budget === 0) return [];
  const ids = new Set(inRange.map((z) => z.id));
  const near: Array<{ i: number; d: number }> = [];
  spawns.forEach((s, i) => {
    if (!ids.has(s.zoneId)) return;
    const d = Math.hypot(s.x - car.x, s.z - car.z);
    if (d <= WALKER_RANGE) near.push({ i, d });
  });
  near.sort((a, b) => a.d - b.d || a.i - b.i);
  return near.slice(0, budget).map((n) => n.i);
}

/**
 * Caixa do chassi com folga (play-fixes AC 19, AC 20): meia medida 0.9 × 2.1 m mais 0.3 m.
 * Gato e pedestre nunca ficam dentro dela.
 */
export const CAR_BOX_SIDE = 1.2;
export const CAR_BOX_ALONG = 2.4;

/** Posição e heading do carro (rad, 0 = +z); sem heading, 0. */
export interface CarPose {
  x: number;
  z: number;
  heading?: number;
}

/** (x, z) no referencial do carro: `along` para a frente, `side` para a direita. */
export function carBoxLocal(x: number, z: number, car: CarPose): { along: number; side: number } {
  const h = car.heading ?? 0;
  const dx = x - car.x;
  const dz = z - car.z;
  // frente (sin h, cos h); direita (−cos h, sin h)
  return { along: dx * Math.sin(h) + dz * Math.cos(h), side: -dx * Math.cos(h) + dz * Math.sin(h) };
}

export function insideCarBox(x: number, z: number, car: CarPose): boolean {
  const l = carBoxLocal(x, z, car);
  return Math.abs(l.along) < CAR_BOX_ALONG && Math.abs(l.side) < CAR_BOX_SIDE;
}

/**
 * Pontos logo fora da caixa, na ordem de preferência: o lado mais perto na mesma altura do
 * carro, o outro lado, depois a frente ou a traseira mais perto e a outra.
 */
export function carBoxExits(x: number, z: number, car: CarPose): Array<[number, number]> {
  const h = car.heading ?? 0;
  const l = carBoxLocal(x, z, car);
  const s = l.side >= 0 ? 1 : -1;
  const a = l.along >= 0 ? 1 : -1;
  const side = CAR_BOX_SIDE + 0.01;
  const along = CAR_BOX_ALONG + 0.01;
  const at = (u: number, v: number): [number, number] => [car.x + Math.sin(h) * u - Math.cos(h) * v, car.z + Math.cos(h) * u + Math.sin(h) * v];
  return [at(l.along, s * side), at(l.along, -s * side), at(a * along, l.side), at(-a * along, l.side)];
}

/**
 * Cor de cada extra ativo pela identidade dele (índice do ponto de partida), não pela vaga na
 * malha instanciada: a cor não muda quando outro extra entra ou sai (play-fixes AC 22).
 */
export function extraColors(active: ReadonlyArray<number>, palette: ReadonlyArray<string>): string[] {
  return active.map((spawn) => palette[spawn % palette.length]!);
}

export interface Walker {
  zoneId: number;
  x: number;
  z: number;
  /** trecho atual: de (fromX, fromZ) a (toX, toZ) */
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  speed: number;
  fleeing: boolean;
  /** s seguidos em fuga sem conseguir andar (play-fixes AC 21) */
  fleeStuck: number;
  /** s até poder fugir de novo, depois de desistir de uma fuga sem saída */
  fleeCooldown: number;
  /** fase do balanço do corpo (s) */
  phase: number;
  /** estado do PRNG próprio (mulberry32) */
  rng: number;
}

function nextRand(w: Walker): number {
  w.rng = (w.rng + 0x6d2b79f5) >>> 0;
  let t = w.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function inZone(bi: BlockInteriors, zoneId: number, x: number, z: number): boolean {
  return bi.zoneOf[nearestVertex(bi, x, z)] === zoneId;
}

/** Todo ponto do trecho, a cada 0.25 m (inclui os pontos a cada 1 m), cai num vértice da zona. */
export function segmentInZone(bi: BlockInteriors, zoneId: number, ax: number, az: number, bx: number, bz: number): boolean {
  const len = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(len / 0.25));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!inZone(bi, zoneId, ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

export function createWalker(spawn: WalkerSpawn, index: number): Walker {
  const w: Walker = {
    zoneId: spawn.zoneId,
    x: spawn.x,
    z: spawn.z,
    fromX: spawn.x,
    fromZ: spawn.z,
    toX: spawn.x,
    toZ: spawn.z,
    speed: WALKER_SPEED_MIN,
    fleeing: false,
    fleeStuck: 0,
    fleeCooldown: 0,
    phase: 0,
    rng: (Math.imul(index + 1, 0x9e3779b1) ^ 0x5eed) >>> 0,
  };
  w.phase = nextRand(w) * 0.5;
  w.speed = WALKER_SPEED_MIN + nextRand(w) * (WALKER_SPEED_MAX - WALKER_SPEED_MIN);
  return w;
}

/** Escolhe o próximo trecho a partir do vértice (x, z): reto, até outro vértice da mesma zona. */
function pickSegment(w: Walker, bi: BlockInteriors): void {
  const sp = bi.spacing;
  for (let tries = 0; tries < 8; tries++) {
    const a = nextRand(w) * Math.PI * 2;
    const len = 4 + nextRand(w) * 12;
    const v = nearestVertex(bi, w.x + Math.sin(a) * len, w.z + Math.cos(a) * len);
    const tx = bi.origin + (v % bi.size) * sp;
    const tz = bi.origin + Math.floor(v / bi.size) * sp;
    if ((tx === w.x && tz === w.z) || bi.zoneOf[v] !== w.zoneId) continue;
    if (!segmentInZone(bi, w.zoneId, w.x, w.z, tx, tz)) continue;
    w.fromX = w.x;
    w.fromZ = w.z;
    w.toX = tx;
    w.toZ = tz;
    return;
  }
  // um vizinho de 4 sempre existe numa zona de 25 vértices ou mais
  const start = Math.floor(nextRand(w) * 4);
  for (let k = 0; k < 4; k++) {
    const [dx, dz] = [[sp, 0], [-sp, 0], [0, sp], [0, -sp]][(start + k) % 4]!;
    if (!inZone(bi, w.zoneId, w.x + dx!, w.z + dz!)) continue;
    w.fromX = w.x;
    w.fromZ = w.z;
    w.toX = w.x + dx!;
    w.toZ = w.z + dz!;
    return;
  }
  w.fromX = w.toX = w.x;
  w.fromZ = w.toZ = w.z;
}

/** Ponto do trecho (from → to) a distância `r` de (px, pz), além de `to` (círculo × segmento). */
function pointOnSegmentAt(px: number, pz: number, r: number, w: Walker): [number, number] {
  const dx = w.toX - w.fromX;
  const dz = w.toZ - w.fromZ;
  const fx = w.fromX - px;
  const fz = w.fromZ - pz;
  const a = dx * dx + dz * dz;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r * r;
  const disc = Math.max(0, b * b - 4 * a * c);
  const t = Math.min(1, Math.max(0, (-b + Math.sqrt(disc)) / (2 * a)));
  return [w.fromX + dx * t, w.fromZ + dz * t];
}

/** fuga sem saída por este tempo (s) vira caminhada num trecho novo (play-fixes AC 21) */
export const FLEE_STUCK_S = 1;
/** depois de desistir, o pedestre só foge de novo passado este tempo (s) */
export const FLEE_COOLDOWN_S = 2;

/**
 * Um passo de `dt` do pedestre. Andando, segue o trecho a `speed` (1.25 a
 * 1.55 m/s); ao chegar ao fim, sorteia o próximo e continua de modo que o
 * deslocamento do passo tenha sempre `speed · dt`. Com o carro a menos de 8 m,
 * foge a 3 m/s (para longe do carro, só por vértices da zona) até ficar a 15 m;
 * encurralado por 1 s, desiste e anda num trecho novo. Nunca fica dentro da
 * caixa do carro: é empurrado para fora pelo lado.
 */
export function stepWalker(w: Walker, dt: number, car: CarPose, bi: BlockInteriors): void {
  walkerMove(w, dt, car, bi);
  if (insideCarBox(w.x, w.z, car)) {
    const exits = carBoxExits(w.x, w.z, car);
    const [nx, nz] = exits.find(([x, z]) => inZone(bi, w.zoneId, x, z)) ?? exits[0]!;
    w.x = w.fromX = w.toX = nx;
    w.z = w.fromZ = w.toZ = nz;
  }
}

function walkerMove(w: Walker, dt: number, car: CarPose, bi: BlockInteriors): void {
  const toCar = Math.hypot(w.x - car.x, w.z - car.z);
  w.fleeCooldown = Math.max(0, w.fleeCooldown - dt);
  if (!w.fleeing && toCar < FLEE_START && w.fleeCooldown === 0) {
    w.fleeing = true;
    w.fleeStuck = 0;
  }
  if (w.fleeing) {
    if (toCar >= FLEE_STOP) {
      w.fleeing = false;
      restartAtNearestVertex(w, bi);
    } else {
      const moved = fleeStep(w, FLEE_SPEED * dt, car, bi);
      w.fleeStuck = moved ? 0 : w.fleeStuck + dt;
      if (w.fleeStuck < FLEE_STUCK_S - 1e-9) return;
      // sem saída: volta a andar num trecho novo e não foge de novo por 2 s
      w.fleeing = false;
      w.fleeStuck = 0;
      w.fleeCooldown = FLEE_COOLDOWN_S;
      restartAtNearestVertex(w, bi);
      pickSegment(w, bi);
    }
  }
  advance(w, w.speed * dt, bi);
}

/** Volta a andar a partir do vértice da zona mais próximo. */
function restartAtNearestVertex(w: Walker, bi: BlockInteriors): void {
  const v = nearestVertex(bi, w.x, w.z);
  w.fromX = w.x;
  w.fromZ = w.z;
  w.toX = bi.origin + (v % bi.size) * bi.spacing;
  w.toZ = bi.origin + Math.floor(v / bi.size) * bi.spacing;
}

/** Um passo de `step` m para longe do carro, só por pontos da zona (desvia até ±75° se preciso); false sem saída. */
function fleeStep(w: Walker, step: number, car: { x: number; z: number }, bi: BlockInteriors): boolean {
  const toCar = Math.hypot(w.x - car.x, w.z - car.z);
  const base = toCar > 1e-6 ? Math.atan2(w.x - car.x, w.z - car.z) : nextRand(w) * Math.PI * 2;
  for (const turn of [0, 15, -15, 30, -30, 45, -45, 60, -60, 75, -75]) {
    const a = base + (turn * Math.PI) / 180;
    const nx = w.x + Math.sin(a) * step;
    const nz = w.z + Math.cos(a) * step;
    if (!inZone(bi, w.zoneId, nx, nz)) continue;
    w.x = nx;
    w.z = nz;
    return true;
  }
  return false;
}

/** Um passo de `step` m ao longo do trecho; ao chegar ao fim, sorteia o próximo e continua com o resto. */
function advance(w: Walker, step: number, bi: BlockInteriors): void {
  const left = Math.hypot(w.toX - w.x, w.toZ - w.z);
  if (left > step) {
    w.x += ((w.toX - w.x) / left) * step;
    w.z += ((w.toZ - w.z) / left) * step;
    return;
  }
  // chega ao fim do trecho neste passo: o resto vai para o próximo trecho
  const px = w.x;
  const pz = w.z;
  w.x = w.toX;
  w.z = w.toZ;
  pickSegment(w, bi);
  if (w.toX === w.fromX && w.toZ === w.fromZ) return;
  const [nx, nz] = pointOnSegmentAt(px, pz, step, w);
  w.x = nx;
  w.z = nz;
}

// ------------------------------------------------------------------ block-life-extras

/** vapor das grades: sobe 5 m em 4 s, deriva até 1.5 m de lado e cresce 3× */
export const STEAM_RISE = 5;
export const STEAM_PERIOD = 4;
export const STEAM_DRIFT = 1.5;
export const STEAM_GROW = 3;
export const STEAM_PER_VENT_HIGH = 24;
export const STEAM_PER_VENT_LOW = 12;

/** Deslocamento e tamanho de uma partícula de vapor no instante `t` (ciclo de 4 s; direção da deriva por `seed`). */
export function steamPoint(t: number, seed: number): { dx: number; dy: number; dz: number; size: number } {
  const u = (((t % STEAM_PERIOD) + STEAM_PERIOD) % STEAM_PERIOD) / STEAM_PERIOD;
  const a = hash01(seed, 1) * Math.PI * 2;
  return { dx: STEAM_DRIFT * u * Math.sin(a), dy: STEAM_RISE * u, dz: STEAM_DRIFT * u * Math.cos(a), size: 1 + (STEAM_GROW - 1) * u };
}

/**
 * holofotes para o céu: inclinação da vertical (graus) e comprimento do facho (m).
 * 80° da vertical (10° acima do horizonte): a câmera de perseguição só mostra céu
 * até ~17° acima do horizonte, então um facho mais empinado sai do quadro (usuário, 2026-09-27)
 */
export const SEARCHLIGHT_TILT = 80;
export const SEARCHLIGHT_LENGTH = 400;

export function searchlightHeading(t: number, period: number, phase: number): number {
  return phase + (2 * Math.PI * t) / period;
}

/** gatos: alcance, tetos por qualidade, velocidades e ritmo de sentar */
export const CAT_RANGE = 200;
export const CAT_CAP_HIGH = 60;
export const CAT_CAP_LOW = 30;
export const CAT_SPEED_MIN = 0.5;
export const CAT_SPEED_MAX = 0.9;
export const CAT_SIT_AFTER_MIN = 6;
export const CAT_SIT_AFTER_MAX = 12;
export const CAT_SIT_MIN = 2;
export const CAT_SIT_MAX = 5;
export const CAT_CROUCH = 0.3;
export const CAT_FLEE_START = 6;
export const CAT_FLEE_STOP = 12;
export const CAT_FLEE_SPEED = 4;
export const CAT_GONE_S = 10;
export const CAT_GONE_CAR = 30;

export type CatState = 'walk' | 'sit' | 'flee' | 'gone';

export interface Cat extends Walker {
  state: CatState;
  /** 0 andando, `CAT_CROUCH` sentado */
  crouch: number;
  /** metros andados desde o último sentar e quando sentar de novo */
  walked: number;
  nextSit: number;
  sitLeft: number;
  goneLeft: number;
  spawnX: number;
  spawnZ: number;
}

/** Pontos de gato ativos: os a até 200 m do carro, do mais perto ao mais longe, até 60 (high) ou 30 (low). */
export function activeCatSpawns(spawns: ReadonlyArray<CatSpawn>, car: { x: number; z: number }, quality: 'high' | 'low'): number[] {
  const cap = quality === 'low' ? CAT_CAP_LOW : CAT_CAP_HIGH;
  const near: Array<{ i: number; d: number }> = [];
  spawns.forEach((s, i) => {
    const d = Math.hypot(s.x - car.x, s.z - car.z);
    if (d <= CAT_RANGE) near.push({ i, d });
  });
  near.sort((a, b) => a.d - b.d || a.i - b.i);
  return near.slice(0, cap).map((n) => n.i);
}

export function createCat(spawn: CatSpawn, index: number): Cat {
  const w = createWalker({ zoneId: spawn.zoneId, x: spawn.x, z: spawn.z }, index + 7919);
  const c: Cat = { ...w, state: 'walk', crouch: 0, walked: 0, nextSit: 0, sitLeft: 0, goneLeft: 0, spawnX: spawn.x, spawnZ: spawn.z };
  c.speed = CAT_SPEED_MIN + nextRand(c) * (CAT_SPEED_MAX - CAT_SPEED_MIN);
  c.nextSit = CAT_SIT_AFTER_MIN + nextRand(c) * (CAT_SIT_AFTER_MAX - CAT_SIT_AFTER_MIN);
  return c;
}

/**
 * Um passo de `dt` do gato. Anda a 0.5-0.9 m/s por trechos da zona (como o
 * pedestre) e a cada 6-12 m senta por 2-5 s; com o carro a menos de 6 m foge a
 * 4 m/s até 12 m. Dentro da caixa do chassi com folga é empurrado para o lado
 * mais perto (dentro da zona) ou some por 10 s, voltando ao ponto de partida com
 * o carro a mais de 30 m: nunca fica debaixo do carro (play-fixes AC 19).
 */
export function stepCat(c: Cat, dt: number, car: CarPose, bi: BlockInteriors): void {
  if (c.state === 'gone') {
    c.goneLeft -= dt;
    if (c.goneLeft <= 0 && Math.hypot(c.spawnX - car.x, c.spawnZ - car.z) > CAT_GONE_CAR) {
      c.x = c.fromX = c.toX = c.spawnX;
      c.z = c.fromZ = c.toZ = c.spawnZ;
      c.state = 'walk';
      c.walked = 0;
      c.crouch = 0;
    }
    return;
  }
  const toCar = Math.hypot(c.x - car.x, c.z - car.z);
  if (c.state !== 'flee' && toCar < CAT_FLEE_START) {
    c.state = 'flee';
    c.crouch = 0;
  }
  if (c.state === 'flee') {
    if (toCar >= CAT_FLEE_STOP) {
      c.state = 'walk';
      c.walked = 0;
      restartAtNearestVertex(c, bi);
    } else {
      fleeStep(c, CAT_FLEE_SPEED * dt, car, bi);
    }
  } else {
    if (c.state === 'sit') {
      c.sitLeft -= dt;
      c.crouch = CAT_CROUCH;
      if (c.sitLeft > 0) return;
      // levanta e já anda neste passo
      c.state = 'walk';
      c.crouch = 0;
      c.walked = 0;
      c.nextSit = CAT_SIT_AFTER_MIN + nextRand(c) * (CAT_SIT_AFTER_MAX - CAT_SIT_AFTER_MIN);
    }
    const step = c.speed * dt;
    advance(c, step, bi);
    c.walked += step;
    if (c.walked >= c.nextSit) {
      c.state = 'sit';
      c.crouch = CAT_CROUCH;
      c.sitLeft = CAT_SIT_MIN + nextRand(c) * (CAT_SIT_MAX - CAT_SIT_MIN);
    }
  }
  // nunca dentro da caixa do carro: empurra para o lado mais perto ou some
  if (insideCarBox(c.x, c.z, car)) {
    const [nx, nz] = carBoxExits(c.x, c.z, car)[0]!;
    if (inZone(bi, c.zoneId, nx, nz)) {
      c.x = c.fromX = c.toX = nx;
      c.z = c.fromZ = c.toZ = nz;
    } else {
      c.state = 'gone';
      c.goneLeft = CAT_GONE_S;
      c.crouch = 0;
    }
  }
}

/** trem: 3 vagões de 12 m com 1 m entre eles a 18 m/s */
export const TRAIN_SPEED = 18;
export const WAGON_LENGTH = 12;
export const WAGON_GAP = 1;
export const WAGONS = 3;

/** Pose do vagão `k` no instante `t`: centro em `s = (18 t − 13 k) mod comprimento`, heading tangente. */
export function trainPose(t: number, line: TrainLine, k: number, cum: Float32Array): { x: number; y: number; z: number; heading: number; s: number } {
  const L = line.length;
  const s = ((((TRAIN_SPEED * t - (WAGON_LENGTH + WAGON_GAP) * k) % L) + L) % L);
  return { ...lineAt(line, cum, s), s };
}

// ------------------------------------------------------------------ util

/** Hash determinístico em [0, 1) de dois números (sem estado). */
export function hash01(a: number, b: number): number {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
