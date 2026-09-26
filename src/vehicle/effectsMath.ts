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

/** 40 faíscas a partir de 3000 N·s; nada abaixo. */
export function sparkBurstFor(impulse: number): number {
  return impulse >= SPARK_IMPULSE_THRESHOLD ? SPARK_BURST : 0;
}
