import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Assets } from '../core/Loader';
import type { MinimapMark } from '../hud/minimapMath';
import { minimapRaceMarks } from '../hud/minimapMath';
import { RaceHud } from '../hud/RaceHud';
import type { Car, CarState } from '../vehicle/Car';
import type { DriveInput } from '../vehicle/drivetrain';
import type { RoadNetwork } from '../world/roads/RoadGenerator';
import { AI_NAMES, AI_PAINTS, prepareRoute, type AiRoute } from './aiDriver';
import { Opponent, PLACE_HEIGHT } from './Opponent';
import {
  createProgress,
  formatRaceTime,
  lapLabel,
  resultRows,
  standings,
  stepProgress,
  type RacerProgress,
  type ResultRow,
  type Standing,
} from './raceProgress';
import { PLAYER_SLOT, generateRaces, type RaceDef } from './raceRoutes';
import {
  countdownText,
  createSession,
  inputFor,
  onEnter,
  onEscape,
  promptFor,
  raceClock,
  resetTarget,
  tickSession,
  type Session,
} from './raceSession';

export const PLAYER_NAME = 'VOCÊ';
/** altura do portão visível (m) */
export const GATE_HEIGHT = 4;
/** por quanto tempo o GO fica na tela depois da largada (s) */
const GO_HOLD_S = 1;

/**
 * Corridas no jogo (races): as 4 corridas geradas no boot, os marcadores no
 * chão, a sessão (prompt, contagem, corrida, resultado), os 3 oponentes, o
 * portão visível e o HUD. O `Game` chama `playerInput` / `beforeStep` /
 * `afterStep` no passo fixo e `render` a cada quadro.
 */
export class RaceController {
  readonly races: RaceDef[];
  session: Session = createSession();
  /** Só DEV/testes (test-hardening C24): segura a contagem para provar o prazo do teste */
  holdCountdown = false;
  opponents: Opponent[] = [];
  player: RacerProgress = createProgress();
  /** marcador com prompt agora (índice da corrida) ou `null` */
  prompt: number | null = null;
  /** resultado congelado na chegada do jogador */
  results: ResultRow[] | null = null;

  private readonly routes: AiRoute[];
  private readonly markerMesh: THREE.InstancedMesh;
  readonly gateMesh: THREE.Mesh;
  private readonly hud: RaceHud;
  private playerPrev = { x: 0, z: 0 };
  private readonly dt = 1 / 60;

  constructor(
    private readonly world: RAPIER.World,
    private readonly scene: THREE.Scene,
    private readonly assets: Assets,
    network: RoadNetwork,
    hudRoot: HTMLElement,
  ) {
    this.races = generateRaces(network);
    this.routes = this.races.map((r) => prepareRoute(r.route));
    this.hud = new RaceHud(hudRoot);

    // marcadores: um anel de luz de raio 10 m no chão por corrida, numa malha instanciada
    const ring = new THREE.RingGeometry(8.6, 10, 48);
    ring.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#35e0ff', transparent: true, opacity: 0.85, depthWrite: false });
    this.markerMesh = new THREE.InstancedMesh(ring, ringMat, Math.max(1, this.races.length));
    this.markerMesh.count = this.races.length;
    const m = new THREE.Matrix4();
    this.races.forEach((r, i) => {
      m.makeTranslation(r.marker.x, this.markerY(r) + 0.15, r.marker.z);
      this.markerMesh.setMatrixAt(i, m);
    });
    this.markerMesh.frustumCulled = false;
    this.markerMesh.name = 'race-markers';
    scene.add(this.markerMesh);

    // portão: faixa luminosa de 4 m cruzando a pista (plano unitário escalado)
    const plane = new THREE.PlaneGeometry(1, 1);
    const gateMat = new THREE.MeshBasicMaterial({
      color: '#ffe14a',
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.gateMesh = new THREE.Mesh(plane, gateMat);
    this.gateMesh.name = 'race-gate';
    this.gateMesh.visible = false;
    scene.add(this.gateMesh);
  }

  get race(): RaceDef | null {
    return this.session.race >= 0 ? this.races[this.session.race]! : null;
  }

  /** contagem ou corrida em andamento */
  get active(): boolean {
    return this.session.state === 'countdown' || this.session.state === 'racing';
  }

  get time(): number {
    if (this.session.state === 'finished' && this.player.finishTime !== null) return this.player.finishTime;
    return raceClock(this.session, this.dt);
  }

  // ------------------------------------------------------------------ teclas

  enter(car: Car): void {
    const s = car.state();
    const prompt = this.session.state === 'free' ? promptFor(s, s.speedKmh, this.markers()) : null;
    const next = onEnter(this.session, prompt);
    if (next === this.session) return;
    if (next.state === 'countdown') this.start(next, car);
    else this.end();
  }

  escape(): void {
    const next = onEscape(this.session);
    if (next !== this.session) this.end();
  }

  /** R e água durante a contagem ou a corrida: volta ao último portão. Devolve se tratou. */
  resetPlayer(car: Car): boolean {
    const race = this.race;
    if (!this.active || !race) return false;
    const t = resetTarget(race, this.player.lastGate, PLAYER_SLOT);
    car.teleport(t.x, t.y + PLACE_HEIGHT, t.z, t.heading);
    this.playerPrev = { x: t.x, z: t.z };
    return true;
  }

  // ------------------------------------------------------------------ passo fixo

  playerInput(input: DriveInput): DriveInput {
    return this.active ? inputFor(this.session, input) : input;
  }

  beforeStep(dt: number): void {
    const st = this.session.state;
    for (const op of this.opponents) {
      // depois da chegada dele, ou da do jogador, o oponente freia até parar (play-fixes AC 9, AC 11)
      const mode = st === 'countdown' ? 'hold' : st === 'finished' || op.progress.finished ? 'stop' : 'race';
      op.drive(dt, mode);
    }
  }

  afterStep(dt: number, car: Car): void {
    const race = this.race;
    if (!race) return;
    if (this.session.state === 'countdown') {
      if (!this.holdCountdown) this.session = tickSession(this.session, dt, false);
      if (this.session.state === 'racing') {
        for (const op of this.opponents) op.startClock(0);
      }
      for (const op of this.opponents) op.track(0, false);
      const t = car.body.translation();
      this.playerPrev = { x: t.x, z: t.z };
      return;
    }
    if (this.session.state !== 'racing') return;
    this.session = tickSession(this.session, dt, false);
    const time = raceClock(this.session, dt);
    const t = car.body.translation();
    stepProgress(this.player, race, this.playerPrev, { x: t.x, z: t.z }, time);
    this.playerPrev = { x: t.x, z: t.z };
    for (const op of this.opponents) op.track(time, true);
    if (this.player.finished) {
      this.session = tickSession(this.session, dt, true);
      this.results = resultRows(this.standingList(), this.names());
    }
  }

  // ------------------------------------------------------------------ quadro

  /** `alpha`: fração do passo em que cada oponente é desenhado (smooth-world door 1). */
  render(state: CarState, alpha: number): MinimapMark[] {
    for (const op of this.opponents) op.car.drawPose(alpha);
    const race = this.race;
    const st = this.session.state;

    this.markerMesh.visible = st === 'free';
    this.prompt = st === 'free' ? promptFor(state, state.speedKmh, this.markers()) : null;
    this.hud.showPrompt(this.prompt === null ? null : `ENTER · ${this.races[this.prompt]!.name}`);

    const countdownT = this.session.steps * this.dt;
    if (st === 'countdown') this.hud.showCountdown(countdownText(countdownT));
    else if (st === 'racing' && countdownT < GO_HOLD_S) this.hud.showCountdown('GO');
    else this.hud.showCountdown(null);

    const gate = st === 'racing' && race ? race.gates[this.player.nextGate]! : null;
    this.gateMesh.visible = gate !== null;
    if (gate) {
      this.gateMesh.position.set(gate.x, gate.y + GATE_HEIGHT / 2, gate.z);
      this.gateMesh.rotation.set(0, gate.heading, 0);
      this.gateMesh.scale.set(gate.halfWidth * 2, GATE_HEIGHT, 1);
    }

    if ((st === 'countdown' || st === 'racing') && race) {
      this.hud.showPanel({
        pos: `POS ${this.position()}/4`,
        lap: race.kind === 'circuit' ? lapLabel(this.player.lap, race.laps) : null,
        time: formatRaceTime(this.time),
      });
    } else this.hud.showPanel(null);

    if (st === 'finished' && race && this.results) this.hud.showResults(race.name.toUpperCase(), this.results, PLAYER_NAME);
    else this.hud.showResults(null);

    return minimapRaceMarks(state, {
      markers: st === 'free' ? this.races.map((r) => r.marker) : [],
      gate,
      opponents: st === 'free' ? [] : this.opponents.map((o) => {
        const p = o.car.body.translation();
        return { x: p.x, z: p.z, color: AI_PAINTS[o.index]! };
      }),
    });
  }

  /** posição do jogador (1-4) na ordem da AC 24 */
  position(): number {
    return standings(this.standingList()).findIndex((s) => s.racer === PLAYER_SLOT) + 1;
  }

  standingList(): Standing[] {
    const race = this.race;
    if (!race) return [];
    const dist = (p: RacerProgress, x: number, z: number) => {
      const g = race.gates[p.nextGate]!;
      return Math.hypot(g.x - x, g.z - z);
    };
    const list: Standing[] = this.opponents.map((o) => {
      const t = o.car.body.translation();
      return { racer: o.index, progress: o.progress, distance: dist(o.progress, t.x, t.z) };
    });
    list.push({ racer: PLAYER_SLOT, progress: this.player, distance: dist(this.player, this.playerPrev.x, this.playerPrev.z) });
    return list;
  }

  markers(): Array<{ x: number; z: number; radius: number }> {
    return this.races.map((r) => r.marker);
  }

  /** objetos da corrida na cena (para o espelho da rua pular) */
  objects(): THREE.Object3D[] {
    return [this.markerMesh, this.gateMesh];
  }

  // ------------------------------------------------------------------ interno

  private names(): string[] {
    return [...AI_NAMES, PLAYER_NAME];
  }

  private start(next: Session, car: Car): void {
    this.session = next;
    const race = this.race!;
    const route = this.routes[next.race]!;
    const slot = race.grid[PLAYER_SLOT]!;
    car.teleport(slot.x, slot.y + PLACE_HEIGHT, slot.z, slot.heading);
    this.playerPrev = { x: slot.x, z: slot.z };
    this.player = createProgress();
    this.results = null;
    this.opponents = [0, 1, 2].map((k) => new Opponent(this.world, this.scene, this.assets, race, route, k));
  }

  private end(): void {
    for (const op of this.opponents) op.dispose();
    this.opponents = [];
    this.session = createSession();
    this.results = null;
    this.player = createProgress();
  }

  private markerY(r: RaceDef): number {
    const p = r.route.points;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < p.length; i += 3) {
      const d = (p[i]! - r.marker.x) ** 2 + (p[i + 2]! - r.marker.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p[i + 1]!;
      }
    }
    return best;
  }

  /** só DEV: o jogador cruza o próximo portão agora (as provas levam o jogador portão a portão) */
  crossNextGate(car: Car): void {
    const race = this.race;
    if (!race || this.session.state !== 'racing') return;
    const g = race.gates[this.player.nextGate]!;
    const fx = Math.sin(g.heading);
    const fz = Math.cos(g.heading);
    stepProgress(this.player, race, { x: g.x - fx, z: g.z - fz }, { x: g.x + fx, z: g.z + fz }, this.time);
    car.teleport(g.x + fx * 2, g.y + PLACE_HEIGHT, g.z + fz * 2, g.heading);
    this.playerPrev = { x: g.x + fx * 2, z: g.z + fz * 2 };
  }
}

