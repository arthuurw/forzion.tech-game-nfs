import type RAPIER from '@dimforge/rapier3d-compat';
import type * as THREE from 'three';
import type { Assets } from '../core/Loader';
import { Car } from '../vehicle/Car';
import { DEFAULT_CAR } from '../vehicle/carSpec';
import type { DriveInput } from '../vehicle/drivetrain';
import {
  AI_OFFSETS,
  AI_PAINTS,
  AI_SKILLS,
  aiDrive,
  checkStuck,
  createAiState,
  relocate,
  restartStuck,
  type AiRoute,
} from './aiDriver';
import { createProgress, stepProgress } from './raceProgress';
import type { RaceDef } from './raceRoutes';
import { HOLD_INPUT, resetTarget } from './raceSession';

/** altura acima do ponto de estrada em que um carro é posto (m), como o spawn do jogo */
export const PLACE_HEIGHT = 1.2;

/**
 * Um oponente numa corrida (races S3): o `Car` dele, dirigido só pelo
 * `DriveInput` do `aiDriver` (door 2), o progresso nos portões e o reset de
 * travado. O `Game` e o teste de física usam esta mesma classe.
 */
export class Opponent {
  readonly car: Car;
  readonly ai = createAiState();
  readonly progress = createProgress();
  readonly skill: number;
  readonly offset: number;
  /** resets de travado nesta corrida */
  resets = 0;
  /** o input entregue ao carro no último passo */
  lastInput: DriveInput = { ...HOLD_INPUT };
  /** posição do passo anterior, de onde sai o segmento que cruza os portões */
  prev = { x: 0, z: 0 };

  constructor(
    world: RAPIER.World,
    scene: THREE.Scene,
    assets: Assets,
    private readonly race: RaceDef,
    private readonly route: AiRoute,
    /** 0-2: lugar do grid, habilidade, faixa e pintura */
    readonly index: number,
  ) {
    this.skill = AI_SKILLS[index]!;
    this.offset = AI_OFFSETS[index]!;
    const slot = race.grid[index]!;
    this.car = new Car(world, scene, assets, { x: slot.x, y: slot.y + PLACE_HEIGHT, z: slot.z }, DEFAULT_CAR, AI_PAINTS[index]!);
    this.place(slot);
  }

  /** Antes do `world.step`: o input deste passo; `hold` na contagem. */
  drive(dt: number, hold: boolean): DriveInput {
    const s = this.car.state();
    const input = aiDrive({ x: s.x, y: s.y, z: s.z, heading: s.heading, speedMs: s.speedMs }, this.route, this.ai, this.skill, this.offset);
    this.lastInput = hold ? { ...HOLD_INPUT } : input;
    this.car.fixedUpdate(this.lastInput, dt);
    return this.lastInput;
  }

  /** Depois do `world.step`: portões no relógio `time` e, correndo, o reset de travado. */
  track(time: number, racing: boolean): void {
    const t = this.car.body.translation();
    stepProgress(this.progress, this.race, this.prev, { x: t.x, z: t.z }, time);
    this.prev = { x: t.x, z: t.z };
    if (racing && !this.progress.finished && checkStuck(this.ai, time, t.y)) this.resetToLastGate(time);
  }

  /** Recomeça a janela de travado (no GO). */
  startClock(time: number): void {
    restartStuck(this.ai, time);
  }

  resetToLastGate(time: number): void {
    this.place(resetTarget(this.race, this.progress.lastGate, this.index));
    this.resets++;
    restartStuck(this.ai, time);
  }

  /** Põe o oponente parado em (x, y, z): como o grid e o reset, atualiza `prev` e a IA junto (hook DEV `placeOpponent`). */
  placeAt(x: number, y: number, z: number, heading: number): void {
    this.place({ x, y: y - PLACE_HEIGHT, z, heading });
  }

  dispose(): void {
    this.car.dispose();
  }

  private place(p: { x: number; y: number; z: number; heading: number }): void {
    this.car.teleport(p.x, p.y + PLACE_HEIGHT, p.z, p.heading);
    this.prev = { x: p.x, z: p.z };
    relocate(this.route, this.ai, p.x, p.z);
  }
}
