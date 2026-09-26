import * as THREE from 'three';
import {
  ParticlePool,
  SKID_CAP,
  SMOKE_CAP,
  SMOKE_LIFETIME_S,
  SMOKE_PER_STEP,
  SPARK_CAP,
  SPARK_LIFETIME_S,
  SkidBuffer,
  sparkBurstFor,
  type Particle,
} from './effectsMath';

/**
 * Efeitos do carro (door 4 do visual-upgrade): marcas de pneu num ring
 * buffer de quads, fumaça no drift e faíscas na batida. A lógica (limites,
 * vida, limiar) está em effectsMath.ts; aqui só se desenha.
 */
export interface CollisionEvent {
  impulse: number;
  x: number;
  y: number;
  z: number;
}

const SKID_W = 0.28;
const SKID_L = 0.6;

export class Effects {
  readonly skids = new SkidBuffer(SKID_CAP);
  readonly smoke = new ParticlePool(SMOKE_CAP, SMOKE_LIFETIME_S);
  readonly sparks = new ParticlePool(SPARK_CAP, SPARK_LIFETIME_S);
  lastCollision: CollisionEvent | null = null;
  sparksSpawned = 0;

  private readonly skidMesh: THREE.Mesh;
  private readonly skidPositions: Float32Array;
  private readonly smokePoints: THREE.Points;
  private readonly sparkPoints: THREE.Points;
  private readonly rng: () => number;

  constructor(scene: THREE.Scene, rng: () => number = Math.random) {
    this.rng = rng;

    // marcas: 400 quads (4 vértices, 2 triângulos cada), escondidos até serem escritos
    this.skidPositions = new Float32Array(SKID_CAP * 4 * 3).fill(-1000);
    const index: number[] = [];
    for (let q = 0; q < SKID_CAP; q++) {
      const v = q * 4;
      index.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    const skidGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.skidPositions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    skidGeo.setAttribute('position', posAttr);
    skidGeo.setIndex(index);
    skidGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.skidMesh = new THREE.Mesh(
      skidGeo,
      new THREE.MeshBasicMaterial({
        color: '#050505',
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
      }),
    );
    this.skidMesh.frustumCulled = false;
    scene.add(this.skidMesh);

    const soft = makeSoftDot();
    this.smokePoints = makePoints(SMOKE_CAP, '#9ea2ab', 0.16, THREE.NormalBlending, 130, soft);
    this.sparkPoints = makePoints(SPARK_CAP, '#ffb040', 1.0, THREE.AdditiveBlending, 14, soft);
    this.skidMesh.visible = false;
    scene.add(this.smokePoints, this.sparkPoints);
  }

  /** Objetos de cena dos efeitos (o reflexo da rua os esconde). */
  get objects(): THREE.Object3D[] {
    return [this.skidMesh, this.smokePoints, this.sparkPoints];
  }

  get skidCount(): number {
    return this.skids.count;
  }

  /** Um passo fixo: marcas e fumaça sob as rodas traseiras enquanto derrapa. */
  step(dt: number, skidding: boolean, rearWheels: Array<{ x: number; z: number }>, heading: number): void {
    if (skidding) {
      for (const w of rearWheels) {
        const idx = this.skids.push({ x: w.x, z: w.z, heading });
        this.writeSkidQuad(idx, w.x, w.z, heading);
      }
      this.smoke.spawn(SMOKE_PER_STEP, (i) => {
        const w = rearWheels[i % rearWheels.length]!;
        return {
          x: w.x + (this.rng() - 0.5) * 0.4,
          y: 0.25,
          z: w.z + (this.rng() - 0.5) * 0.4,
          vx: (this.rng() - 0.5) * 1.2,
          vy: 0.8 + this.rng() * 0.8,
          vz: (this.rng() - 0.5) * 1.2,
        };
      });
    }
    this.smoke.step(dt);
    this.sparks.step(dt);
    for (const p of this.sparks.particles) p.vy -= 9.81 * dt;
  }

  /** Evento de colisão drenado do Rapier (AC 15, AC 16). */
  collide(event: CollisionEvent): void {
    const n = sparkBurstFor(event.impulse);
    if (n === 0) return;
    this.lastCollision = { ...event };
    this.sparksSpawned = this.sparks.spawn(n, () => {
      const a = this.rng() * Math.PI * 2;
      const s = 3 + this.rng() * 6;
      return { x: event.x, y: event.y, z: event.z, vx: Math.cos(a) * s, vy: 2 + this.rng() * 4, vz: Math.sin(a) * s };
    });
  }

  /** Copia partículas vivas para os buffers de GPU (uma vez por frame). */
  render(): void {
    uploadParticles(this.smokePoints, this.smoke.particles);
    uploadParticles(this.sparkPoints, this.sparks.particles);
  }

  private writeSkidQuad(index: number, x: number, z: number, heading: number): void {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const rx = fz;
    const rz = -fx;
    const hw = SKID_W / 2;
    const hl = SKID_L / 2;
    const y = 0.035;
    const corners = [
      [x - rx * hw - fx * hl, z - rz * hw - fz * hl],
      [x + rx * hw - fx * hl, z + rz * hw - fz * hl],
      [x + rx * hw + fx * hl, z + rz * hw + fz * hl],
      [x - rx * hw + fx * hl, z - rz * hw + fz * hl],
    ];
    const base = index * 12;
    corners.forEach(([cx, cz], k) => {
      this.skidPositions[base + k * 3] = cx!;
      this.skidPositions[base + k * 3 + 1] = y;
      this.skidPositions[base + k * 3 + 2] = cz!;
    });
    const attr = this.skidMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
    this.skidMesh.visible = true;
  }
}

/** Textura de ponto redondo com borda suave (evita os quadrados do PointsMaterial). */
function makeSoftDot(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makePoints(
  capacity: number,
  color: string,
  opacity: number,
  blending: THREE.Blending,
  size: number,
  map: THREE.Texture,
): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attr);
  geometry.setDrawRange(0, 0);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const material = new THREE.PointsMaterial({
    color,
    size: size / 100,
    sizeAttenuation: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending,
    map,
    alphaTest: 0.01,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function uploadParticles(points: THREE.Points, particles: Particle[]): void {
  const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  particles.forEach((p, i) => {
    arr[i * 3] = p.x;
    arr[i * 3 + 1] = p.y;
    arr[i * 3 + 2] = p.z;
  });
  points.geometry.setDrawRange(0, particles.length);
  attr.needsUpdate = true;
}
