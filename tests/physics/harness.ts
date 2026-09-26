import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Assets } from '../../src/core/Loader';
import { Car } from '../../src/vehicle/Car';
import { DEFAULT_CAR, type CarSpec } from '../../src/vehicle/carSpec';
import type { DriveInput } from '../../src/vehicle/drivetrain';

/**
 * Harness de física real (door 3 da car-handling, AD-011): Rapier de verdade em
 * node, o `Car` do jogo com assets placeholder, passo fixo de 1/60 s.
 * Chão plano de 8 km × 8 km com topo em y = 0, ou uma rampa de 9 % com 400 m.
 * As grandezas medidas são calculadas aqui, a partir do corpo do Rapier, e não
 * pelos getters do `Car`.
 */
export const DT = 1 / 60;
export const G = 9.81;
export const NO_INPUT: DriveInput = { throttle: false, brake: false, steer: 0, handbrake: false };
export const RAMP_GRADE = 0.09;
export const RAMP_LENGTH_M = 400;

const PLACEHOLDER_ASSETS: Assets = {
  carModel: null,
  placeholder: true,
  textures: {},
  loadedSets: [],
  failedSets: [],
};

let ready: Promise<void> | null = null;
export function initRapier(): Promise<void> {
  ready ??= RAPIER.init();
  return ready;
}

export interface Harness {
  world: RAPIER.World;
  car: Car;
  /** passos dados desde a criação */
  steps: number;
  step(input?: DriveInput): void;
  /** o carro assenta parado 0.5 s (30 passos) sem entradas */
  settle(): void;
  /** `setLinvel` ao longo do heading (km/h) */
  setForwardKmh(kmh: number): void;
}

export function createHarness(options: { spec?: CarSpec; ramp?: boolean } = {}): Harness {
  const world = new RAPIER.World({ x: 0, y: -G, z: 0 });
  world.timestep = DT;
  const scene = new THREE.Scene();
  let spawn = { x: 0, y: 1.2, z: 0 };
  let spawnRotation = { x: 0, y: 0, z: 0, w: 1 };

  if (options.ramp) {
    // rampa de 9 % subindo em +Z: 400 m ao longo da inclinação, topo da laje passando pela origem
    const angle = Math.atan(RAMP_GRADE);
    const q = { x: -Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) };
    const halfLen = RAMP_LENGTH_M / 2;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(20, 0.5, halfLen)
        .setRotation(q)
        .setTranslation(0, -0.5 * Math.cos(angle), 0.5 * Math.sin(angle)),
    );
    // o carro começa 180 m abaixo do centro da rampa, alinhado com ela e virado para cima
    const d = -180;
    spawn = { x: 0, y: d * Math.sin(angle) + 1.2 / Math.cos(angle), z: d * Math.cos(angle) };
    spawnRotation = q;
  } else {
    world.createCollider(RAPIER.ColliderDesc.cuboid(4000, 0.5, 4000).setTranslation(0, -0.5, 0));
  }

  const car = new Car(world, scene, PLACEHOLDER_ASSETS, spawn, options.spec ?? DEFAULT_CAR);
  car.body.setRotation(spawnRotation, true);

  const h: Harness = {
    world,
    car,
    steps: 0,
    step(input = NO_INPUT) {
      car.fixedUpdate(input, DT);
      world.step();
      h.steps++;
    },
    settle() {
      for (let i = 0; i < 30; i++) h.step(NO_INPUT);
    },
    setForwardKmh(kmh: number) {
      const f = axis(car, 0, 0, 1);
      const v = kmh / 3.6;
      car.body.setLinvel({ x: f.x * v, y: f.y * v, z: f.z * v }, true);
    },
  };
  return h;
}

/** Eixo local do chassi no mundo. */
export function axis(car: Car, x: number, y: number, z: number): THREE.Vector3 {
  const r = car.body.rotation();
  return new THREE.Vector3(x, y, z).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
}

const DEG = 180 / Math.PI;

/** Ângulo (graus) entre o +Y do chassi e o +Y do mundo. */
export function tiltDeg(car: Car): number {
  return Math.acos(Math.max(-1, Math.min(1, axis(car, 0, 1, 0).y))) * DEG;
}

/** Rolagem (graus): asin da componente y do +X do chassi; positiva = lado esquerdo para cima. */
export function rollDeg(car: Car): number {
  return Math.asin(Math.max(-1, Math.min(1, axis(car, 1, 0, 0).y))) * DEG;
}

/** Arfagem (graus): asin da componente y do +Z do chassi; negativa = frente para baixo. */
export function pitchDeg(car: Car): number {
  return Math.asin(Math.max(-1, Math.min(1, axis(car, 0, 0, 1).y))) * DEG;
}

export function horizontalSpeed(car: Car): number {
  const v = car.body.linvel();
  return Math.hypot(v.x, v.z);
}

/** Sideslip (graus) entre o +Z do chassi no plano e a velocidade horizontal; null até 3 m/s. */
export function sideslipDeg(car: Car): number | null {
  const v = car.body.linvel();
  if (Math.hypot(v.x, v.z) <= 3) return null;
  const f = axis(car, 0, 0, 1);
  const d = Math.atan2(v.x, v.z) - Math.atan2(f.x, f.z);
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * DEG;
}

/** Velocidade ao longo do +Z do chassi (m/s). */
export function forwardSpeed(car: Car): number {
  const v = car.body.linvel();
  const f = axis(car, 0, 0, 1);
  return v.x * f.x + v.y * f.y + v.z * f.z;
}

/** Aceleração lateral (g) em janela deslizante de 30 passos: `|v_h| × |angvel.y| / 9.81`. */
export class LateralGWindow {
  private readonly samples: number[] = [];
  value = 0;
  push(car: Car): number {
    this.samples.push((horizontalSpeed(car) * Math.abs(car.body.angvel().y)) / G);
    if (this.samples.length > 30) this.samples.shift();
    this.value = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    return this.value;
  }
}

export function allWheelsInContact(car: Car): boolean {
  return [0, 1, 2, 3].every((i) => car.controller.wheelIsInContact(i));
}

export function kmh(car: Car): number {
  return forwardSpeed(car) * 3.6;
}
