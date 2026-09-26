import * as THREE from 'three';
import type { CarState } from '../vehicle/Car';
import { cameraRoll, chaseTarget, fovFor, lateralOffset, shakeAmplitude, shakeAt, smoothingFactor, stepRoll } from './chaseMath';

/**
 * Câmera atrás do carro com suavização exponencial (free-roam-city AC 11), e
 * no visual-upgrade: FOV por velocidade, atraso lateral na curva e shake de
 * colisão. Na car-feel, inclina junto com a carroceria. As fórmulas estão em
 * chaseMath.ts.
 */
export class ChaseCamera {
  readonly camera: THREE.PerspectiveCamera;
  private readonly target = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private lateral = 0;
  private rollAngle = 0;
  private shakeAmp = 0;
  private shakeT = 0;
  /** posição sem shake, suavizada; o shake é somado só na câmera final */
  private readonly smoothPos = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.1, 600);
  }

  /** Alvo da câmera neste frame (com o deslocamento lateral, antes da suavização e do shake). */
  get targetPosition(): { x: number; y: number; z: number } {
    return { x: this.target.x, y: this.target.y, z: this.target.z };
  }

  /** Deslocamento lateral atual (m), positivo = esquerda do carro (AC 20). */
  get lateralOffset(): number {
    return this.lateral;
  }

  /** Inclinação atual (rad), no mesmo sentido da rolagem da carroceria (car-feel AC 14). */
  get roll(): number {
    return this.rollAngle;
  }

  /** Amplitude atual do shake (m), para debug e provas. */
  get shake(): number {
    return shakeAt(this.shakeT, this.shakeAmp);
  }

  snapTo(state: CarState): void {
    const t = chaseTarget(state, state.heading);
    this.smoothPos.set(t.position.x, t.position.y, t.position.z);
    this.camera.position.copy(this.smoothPos);
    this.camera.lookAt(t.lookAt.x, t.lookAt.y, t.lookAt.z);
  }

  /** Inicia um shake pelo impulso de uma colisão (AC 19). */
  impact(impulse: number): void {
    const amp = shakeAmplitude(impulse);
    if (amp >= this.shake) {
      this.shakeAmp = amp;
      this.shakeT = 0;
    }
  }

  update(dt: number, state: CarState, yawRate = 0, bodyRoll = 0): void {
    const k = smoothingFactor(dt);
    this.rollAngle = stepRoll(this.rollAngle, cameraRoll(bodyRoll), dt);
    // atraso lateral na curva (AC 20): positivo = para a esquerda do carro
    this.lateral += (lateralOffset(yawRate) - this.lateral) * k;
    const t = chaseTarget(state, state.heading);
    const leftX = Math.cos(state.heading);
    const leftZ = -Math.sin(state.heading);
    this.target.set(t.position.x + leftX * this.lateral, t.position.y, t.position.z + leftZ * this.lateral);
    this.smoothPos.lerp(this.target, k);

    this.shakeT += dt;
    const s = this.shake;
    this.camera.position.set(
      this.smoothPos.x + (Math.random() - 0.5) * 2 * s,
      this.smoothPos.y + (Math.random() - 0.5) * 2 * s,
      this.smoothPos.z + (Math.random() - 0.5) * 2 * s,
    );

    // FOV por velocidade (AC 17)
    const fov = fovFor(state.speedKmh);
    if (Math.abs(this.camera.fov - fov) > 1e-4) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    this.look.set(t.lookAt.x, t.lookAt.y, t.lookAt.z);
    this.camera.lookAt(this.look);
    // gira em torno do eixo de visão (+Z local aponta para trás): -roll inclina no
    // mesmo sentido da carroceria, rolagem positiva = lado esquerdo para cima
    this.camera.rotateZ(-this.rollAngle);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
