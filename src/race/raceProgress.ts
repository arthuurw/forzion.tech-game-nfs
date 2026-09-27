/**
 * Progresso de cada racer numa corrida (races S2 e S4), puro: cruzamento de
 * portão, voltas, chegada, relógio de passos fixos (door 3), ordem e resultado.
 */
import type { RaceDef, RaceGate } from './raceRoutes';

export interface RacerProgress {
  /** índice do próximo portão em `race.gates` */
  nextGate: number;
  /** último portão cruzado (-1 = nenhum ainda) */
  lastGate: number;
  /** volta atual, de 1 a `laps` */
  lap: number;
  finished: boolean;
  /** tempo de chegada (s), `null` enquanto corre */
  finishTime: number | null;
}

export function createProgress(): RacerProgress {
  return { nextGate: 0, lastGate: -1, lap: 1, finished: false, finishTime: null };
}

/** Distância assinada de (x, z) à linha do portão, positiva à frente dele (no sentido do traçado). */
function along(g: RaceGate, x: number, z: number): number {
  return (x - g.x) * Math.sin(g.heading) + (z - g.z) * Math.cos(g.heading);
}

/** Deslocamento lateral de (x, z) ao longo da linha do portão. */
function across(g: RaceGate, x: number, z: number): number {
  return (x - g.x) * Math.cos(g.heading) - (z - g.z) * Math.sin(g.heading);
}

/**
 * Um passo do racer de `prev` para `cur` (centro do chassi, xz). Cruzar o
 * próximo portão para a frente, dentro de `halfWidth`, avança o portão; o
 * último da última volta termina a corrida no tempo `time`. Qualquer outro
 * cruzamento não muda nada. Devolve se avançou.
 */
export function stepProgress(
  p: RacerProgress,
  race: RaceDef,
  prev: { x: number; z: number },
  cur: { x: number; z: number },
  time: number,
): boolean {
  if (p.finished) return false;
  const g = race.gates[p.nextGate]!;
  const a0 = along(g, prev.x, prev.z);
  const a1 = along(g, cur.x, cur.z);
  if (!(a0 < 0 && a1 >= 0)) return false;
  // ponto onde o segmento corta a linha do portão
  const t = a0 / (a0 - a1);
  const x = prev.x + (cur.x - prev.x) * t;
  const z = prev.z + (cur.z - prev.z) * t;
  if (Math.abs(across(g, x, z)) > g.halfWidth) return false;
  p.lastGate = p.nextGate;
  p.nextGate++;
  if (p.nextGate >= race.gates.length) {
    if (p.lap >= race.laps) {
      p.finished = true;
      p.finishTime = time;
      p.nextGate = race.gates.length - 1;
    } else {
      p.lap++;
      p.nextGate = 0;
    }
  }
  return true;
}

/** Relógio da corrida (door 3): soma de passos fixos desde o GO. */
export function clockAfter(steps: number, dt: number): number {
  return steps * dt;
}

/** `m:ss.cc`, centésimos truncados. */
export function formatRaceTime(seconds: number): string {
  const centis = Math.floor(seconds * 100 + 1e-7);
  const m = Math.floor(centis / 6000);
  const s = Math.floor((centis % 6000) / 100);
  const c = centis % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

export function lapLabel(lap: number, laps: number): string {
  return `VOLTA ${Math.min(lap, laps)}/${laps}`;
}

export interface Standing {
  /** índice do racer (0-2 oponentes, 3 jogador) */
  racer: number;
  progress: RacerProgress;
  /** distância horizontal ao próximo portão (m) */
  distance: number;
}

/** Ordem: terminados por tempo; depois volta, próximo portão (maiores primeiro) e distância ao portão (menor primeiro). */
export function standings(list: Standing[]): Standing[] {
  return [...list].sort((a, b) => {
    const fa = a.progress.finished;
    const fb = b.progress.finished;
    if (fa && fb) return a.progress.finishTime! - b.progress.finishTime!;
    if (fa !== fb) return fa ? -1 : 1;
    if (a.progress.lap !== b.progress.lap) return b.progress.lap - a.progress.lap;
    if (a.progress.nextGate !== b.progress.nextGate) return b.progress.nextGate - a.progress.nextGate;
    return a.distance - b.distance;
  });
}

export interface ResultRow {
  position: number;
  name: string;
  time: string;
}

/** Linhas do resultado na ordem de `standings`; quem não terminou fica com `--:--.--`. */
export function resultRows(list: Standing[], names: string[]): ResultRow[] {
  return standings(list).map((s, k) => ({
    position: k + 1,
    name: names[s.racer]!,
    time: s.progress.finished ? formatRaceTime(s.progress.finishTime!) : '--:--.--',
  }));
}
