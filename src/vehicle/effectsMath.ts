/**
 * Estruturas puras dos efeitos: ring buffer das marcas de pneu, pool de
 * partículas com tempo de vida, e o limiar de faíscas. Sem three aqui.
 */
export interface Quad {
  x: number;
  z: number;
  /** direção (rad) para orientar o quad ao longo do movimento */
  heading: number;
}

/** Ring buffer de tamanho fixo: quando enche, o mais antigo é sobrescrito. */
export class SkidBuffer {
  readonly items: Array<Quad | null>;
  /** próximo índice a escrever */
  head = 0;
  /** quantos slots já foram escritos (satura em `capacity`) */
  count = 0;

  constructor(readonly capacity: number) {
    this.items = new Array<Quad | null>(capacity).fill(null);
  }

  push(quad: Quad): number {
    const index = this.head;
    this.items[index] = quad;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
    return index;
  }
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
}

/** Pool de partículas: `spawn` até o limite, `step` envelhece e mata. */
export class ParticlePool {
  readonly particles: Particle[] = [];

  constructor(
    readonly capacity: number,
    readonly lifetime: number,
  ) {}

  get alive(): number {
    return this.particles.length;
  }

  spawn(n: number, make: (i: number) => Omit<Particle, 'age'> = () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })): number {
    let spawned = 0;
    for (let i = 0; i < n && this.particles.length < this.capacity; i++) {
      this.particles.push({ ...make(i), age: 0 });
      spawned++;
    }
    return spawned;
  }

  step(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.age += dt;
      if (p.age >= this.lifetime) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
  }
}

export const SPARK_IMPULSE_THRESHOLD = 3000;
export const SPARK_BURST = 40;
export const SMOKE_PER_STEP = 4;
export const SMOKE_CAP = 256;
export const SMOKE_LIFETIME_S = 0.8;
export const SPARK_CAP = 128;
export const SPARK_LIFETIME_S = 0.4;
export const SKID_CAP = 400;
export const SKID_MIN_KMH = 20;

/** escorregamento lateral (m/s) no contato de uma roda acima do qual o pneu está derrapando */
export const SKID_LATERAL_SLIP_MS = 2.5;

/**
 * Derrapagem visível (car-handling AC 23): escorregamento lateral de alguma
 * roda acima de 2.5 m/s, ou freio de mão acima de 20 km/h.
 */
export function isSkidding(handbrake: boolean, speedKmh: number, lateralSlipMs: number): boolean {
  return lateralSlipMs > SKID_LATERAL_SLIP_MS || (handbrake && speedKmh > SKID_MIN_KMH);
}

/** Um quad de marca por roda traseira por passo fixo (AC 13). */
export const SKID_QUADS_PER_STEP = 2;

export interface ImpactEvent {
  impulse: number;
  x: number;
  y: number;
  z: number;
}

/**
 * Decide o que uma colisão drenada faz (AC 15, AC 16): a partir de 3000 N·s
 * registra `last` e pede 40 faíscas; abaixo disso não muda nada.
 */
export class CollisionTracker {
  last: ImpactEvent | null = null;

  /** Devolve quantas faíscas pedir (0 abaixo do limiar). */
  record(event: ImpactEvent): number {
    const burst = sparkBurstFor(event.impulse);
    if (burst === 0) return 0;
    this.last = { ...event };
    return burst;
  }
}

/** 40 faíscas a partir de 3000 N·s; nada abaixo. */
export function sparkBurstFor(impulse: number): number {
  return impulse >= SPARK_IMPULSE_THRESHOLD ? SPARK_BURST : 0;
}
