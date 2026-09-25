import * as THREE from 'three';
import type { CarState } from '../vehicle/Car';
import { chaseTarget, smoothingFactor } from './chaseMath';

/** Câmera atrás do carro com suavização exponencial (AC 11). */
export class ChaseCamera {
  readonly camera: THREE.PerspectiveCamera;
  private readonly target = new THREE.Vector3();
  private readonly look = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.1, 600);
  }

  snapTo(state: CarState): void {
    const t = chaseTarget(state, state.heading);
    this.camera.position.set(t.position.x, t.position.y, t.position.z);
    this.camera.lookAt(t.lookAt.x, t.lookAt.y, t.lookAt.z);
  }

  update(dt: number, state: CarState): void {
    const t = chaseTarget(state, state.heading);
    this.target.set(t.position.x, t.position.y, t.position.z);
    this.camera.position.lerp(this.target, smoothingFactor(dt));
    this.look.set(t.lookAt.x, t.lookAt.y, t.lookAt.z);
    this.camera.lookAt(this.look);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
