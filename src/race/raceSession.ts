/**
 * Sessão de corrida (races S1, S5), pura: prompt de largada, estados
 * `free` → `countdown` → `racing` → `finished`, Enter e Escape, contagem
 * 3-2-1-GO em passos fixos, input segurado na contagem e alvo do reset.
 */
import type { DriveInput } from '../vehicle/drivetrain';
import { clockAfter } from './raceProgress';
import { PLAYER_SLOT, type RaceDef } from './raceRoutes';

export type SessionState = 'free' | 'countdown' | 'racing' | 'finished';

export interface Session {
  state: SessionState;
  /** índice da corrida em andamento (-1 no free roam) */
  race: number;
  /** passos fixos desde o Enter (contagem) ou desde o GO (corrida) */
  steps: number;
}

export const COUNTDOWN_S = 3;
/** velocidade máxima para o prompt de largada aparecer (km/h) */
export const PROMPT_MAX_KMH = 30;
/** na contagem, o carro fica no freio de mão: o freio de serviço parado engata a ré */
export const HOLD_INPUT: Readonly<DriveInput> = { throttle: false, brake: false, steer: 0, handbrake: true };

export function createSession(): Session {
  return { state: 'free', race: -1, steps: 0 };
}

/** Marcador mais perto a no máximo `radius` do centro, abaixo de 30 km/h; `null` sem prompt. */
export function promptFor(
  pos: { x: number; z: number },
  speedKmh: number,
  markers: ReadonlyArray<{ x: number; z: number; radius: number }>,
): number | null {
  if (Math.abs(speedKmh) >= PROMPT_MAX_KMH) return null;
  let best: number | null = null;
  let bestD = Infinity;
  markers.forEach((m, i) => {
    const d = Math.hypot(pos.x - m.x, pos.z - m.z);
    if (d <= m.radius && d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/** Enter: com prompt no free roam começa a contagem; com o resultado na tela volta ao free roam; senão nada. */
export function onEnter(s: Session, prompt: number | null): Session {
  if (s.state === 'free' && prompt !== null) return { state: 'countdown', race: prompt, steps: 0 };
  if (s.state === 'finished') return createSession();
  return s;
}

/** Escape: abandona a contagem ou a corrida; nos outros estados, nada. */
export function onEscape(s: Session): Session {
  if (s.state === 'countdown' || s.state === 'racing') return createSession();
  return s;
}

/** Um passo fixo. A contagem vira corrida em 3.0 s; a corrida termina quando o jogador chega. */
export function tickSession(s: Session, dt: number, playerFinished: boolean): Session {
  if (s.state === 'countdown') {
    const steps = s.steps + 1;
    if (clockAfter(steps, dt) >= COUNTDOWN_S - 1e-9) return { ...s, state: 'racing', steps: 0 };
    return { ...s, steps };
  }
  if (s.state === 'racing') {
    if (playerFinished) return { ...s, state: 'finished' };
    return { ...s, steps: s.steps + 1 };
  }
  return s;
}

/** Relógio da corrida (s): 0 na contagem, passos desde o GO na corrida. */
export function raceClock(s: Session, dt: number): number {
  return s.state === 'racing' || s.state === 'finished' ? clockAfter(s.steps, dt) : 0;
}

/** Texto da contagem no tempo `t` (s) desde o Enter. */
export function countdownText(t: number): string {
  if (t >= COUNTDOWN_S - 1e-9) return 'GO';
  return String(3 - Math.floor(t + 1e-9));
}

/** O input que chega ao carro: segurado na contagem, o do jogador ou da IA fora dela. */
export function inputFor(s: Session, input: DriveInput): DriveInput {
  return s.state === 'countdown' ? { ...HOLD_INPUT } : input;
}

/** Para onde vai o reset na corrida: o último portão cruzado ou, sem nenhum, o lugar do grid. */
export function resetTarget(
  race: RaceDef,
  lastGate: number,
  slot: number = PLAYER_SLOT,
): { x: number; y: number; z: number; heading: number } {
  if (lastGate < 0) return { ...race.grid[slot]! };
  const g = race.gates[lastGate]!;
  return { x: g.x, y: g.y, z: g.z, heading: g.heading };
}
