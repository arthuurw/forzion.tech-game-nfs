import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Assets } from '../core/Loader';
import { computeDrive, gearFor, rpmFor, type DriveInput } from './drivetrain';

/**
 * O carro: um corpo rígido (chassi) + 4 rodas por raycast do Rapier (door 2).
 * O Rapier não desenha nada; este módulo mantém o mesh do three grudado no
 * corpo físico a cada frame (`sync`). Todas as decisões numéricas vêm de
 * `drivetrain.ts`; aqui só aplicamos.
 */
export interface CarState {
  x: number;
  y: number;
  z: number;
  heading: number;
  speedMs: number;
  speedKmh: number;
  gear: number;
  rpm: number;
}

export interface ResetSnapshot {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  linvel: { x: number; y: number; z: number };
  angvel: { x: number; y: number; z: number };
}

const CHASSIS_HALF = { x: 0.9, y: 0.35, z: 2.1 };
const CHASSIS_MASS = 1200;
const WHEEL_RADIUS = 0.45;
const WHEEL_REST = 0.35;
const WHEEL_X = 0.85;
const WHEEL_Z = 1.3;
const WHEEL_Y = -0.2;
const BASE_FRICTION_SLIP = 10;
const MODEL_SCALE = 1.8;
const FRONT = [0, 1];
const REAR = [2, 3];

export class Car {
  readonly body: RAPIER.RigidBody;
  readonly controller: RAPIER.DynamicRayCastVehicleController;
  readonly mesh = new THREE.Group();
  readonly placeholder: boolean;
  lastReset: ResetSnapshot | null = null;

  private readonly wheelMeshes: THREE.Object3D[] = [];
  private wheelSpin = 0;
  private readonly forward = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();

  constructor(
    private readonly world: RAPIER.World,
    scene: THREE.Scene,
    assets: Assets,
    spawn: { x: number; y: number; z: number },
  ) {
    this.placeholder = assets.placeholder;

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawn.x, spawn.y, spawn.z)
        .setLinearDamping(0.08)
        .setAngularDamping(1.2)
        .setCcdEnabled(true),
    );
    // Casco leve + lastro pesado e baixo: desce o centro de massa para o carro
    // não empinar ao acelerar nem tombar em curva (o Rapier aplica a força do
    // motor no ponto de contato da roda, abaixo do centro do chassi).
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(CHASSIS_HALF.x, CHASSIS_HALF.y, CHASSIS_HALF.z)
        .setMass(CHASSIS_MASS * 0.3)
        .setFriction(0.4),
      this.body,
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.6, 0.05, 1.5)
        .setTranslation(0, -0.3, 0)
        .setMass(CHASSIS_MASS * 0.7),
      this.body,
    );

    this.controller = world.createVehicleController(this.body);
    this.controller.setIndexForwardAxis = 2; // +Z é a frente (door 9)
    this.controller.indexUpAxis = 1;
    const down = { x: 0, y: -1, z: 0 };
    const axle = { x: -1, y: 0, z: 0 };
    const positions = [
      { x: WHEEL_X, y: WHEEL_Y, z: WHEEL_Z },
      { x: -WHEEL_X, y: WHEEL_Y, z: WHEEL_Z },
      { x: WHEEL_X, y: WHEEL_Y, z: -WHEEL_Z },
      { x: -WHEEL_X, y: WHEEL_Y, z: -WHEEL_Z },
    ];
    positions.forEach((p, i) => {
      this.controller.addWheel(p, down, axle, WHEEL_REST, WHEEL_RADIUS);
      this.controller.setWheelSuspensionStiffness(i, 32);
      this.controller.setWheelSuspensionCompression(i, 2.4);
      this.controller.setWheelSuspensionRelaxation(i, 2.8);
      this.controller.setWheelMaxSuspensionTravel(i, 0.3);
      this.controller.setWheelMaxSuspensionForce(i, 40000);
      this.controller.setWheelFrictionSlip(i, BASE_FRICTION_SLIP);
      this.controller.setWheelSideFrictionStiffness(i, 1.0);
    });

    this.buildVisual(assets);
    scene.add(this.mesh);
    this.sync();
  }

  /** Um passo fixo de física: aplica o input e integra o veículo. */
  fixedUpdate(input: DriveInput, dt: number): void {
    const cmd = computeDrive(input, this.speedKmh());
    for (const i of REAR) {
      this.controller.setWheelEngineForce(i, cmd.engineForce);
      this.controller.setWheelBrake(i, cmd.brakeRear);
      this.controller.setWheelFrictionSlip(i, BASE_FRICTION_SLIP * cmd.rearFrictionFactor);
    }
    for (const i of FRONT) {
      this.controller.setWheelEngineForce(i, 0);
      this.controller.setWheelBrake(i, cmd.brakeFront);
      this.controller.setWheelSteering(i, cmd.steer);
    }
    this.controller.updateVehicle(dt);
    this.wheelSpin += (this.speedMs() * dt) / WHEEL_RADIUS;
  }

  /** Copia a pose física para o mesh (uma vez por frame renderizado). */
  sync(): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.mesh.position.set(t.x, t.y, t.z);
    this.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    const steer = this.controller.numWheels() > 0 ? this.controller.wheelSteering(0) ?? 0 : 0;
    this.wheelMeshes.forEach((wheel, i) => {
      wheel.rotation.set(this.wheelSpin, i < 2 ? steer : 0, 0, 'YXZ');
    });
  }

  state(): CarState {
    const t = this.body.translation();
    const speedMs = this.speedMs();
    const speedKmh = speedMs * 3.6;
    return {
      x: t.x,
      y: t.y,
      z: t.z,
      heading: this.heading(),
      speedMs,
      speedKmh,
      gear: gearFor(speedKmh),
      rpm: rpmFor(speedKmh),
    };
  }

  /** Velocidade ao longo da frente do carro (m/s), negativa em ré. */
  speedMs(): number {
    const v = this.body.linvel();
    const f = this.forwardWorld();
    return v.x * f.x + v.y * f.y + v.z * f.z;
  }

  speedKmh(): number {
    return this.speedMs() * 3.6;
  }

  heading(): number {
    const f = this.forwardWorld();
    return Math.atan2(f.x, f.z);
  }

  /** Levanta o carro 1 m, em pé, parado (AC 9). */
  reset(): void {
    const t = this.body.translation();
    this.body.setTranslation({ x: t.x, y: t.y + 1, z: t.z }, true);
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.controller.updateVehicle(0); // re-sincroniza as rodas antes do próximo passo
    this.lastReset = {
      position: { ...this.body.translation() },
      rotation: { ...this.body.rotation() },
      linvel: { ...this.body.linvel() },
      angvel: { ...this.body.angvel() },
    };
    this.sync();
  }

  /** Só para testes e debug: coloca o carro em qualquer lugar, parado. */
  teleport(x: number, y: number, z: number, heading: number): void {
    this.body.setTranslation({ x, y, z }, true);
    this.body.setRotation({ x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.sync();
  }

  setRotation(q: { x: number; y: number; z: number; w: number }): void {
    this.body.setRotation(q, true);
    this.sync();
  }

  private forwardWorld(): THREE.Vector3 {
    const r = this.body.rotation();
    this.quat.set(r.x, r.y, r.z, r.w);
    return this.forward.set(0, 0, 1).applyQuaternion(this.quat);
  }

  private buildVisual(assets: Assets): void {
    if (assets.carModel) {
      const model = assets.carModel;
      model.scale.setScalar(MODEL_SCALE);
      // o modelo do Kenney tem o chão em y=0; o chassi físico tem centro em y=0
      model.position.y = -(CHASSIS_HALF.y + WHEEL_REST * 0.4);
      model.traverse((obj) => {
        if (/^wheel/.test(obj.name)) this.wheelMeshes.push(obj);
      });
      // ordem: frente-esq, frente-dir, tras-esq, tras-dir (para casar com FRONT/REAR)
      this.wheelMeshes.sort((a, b) => b.position.z - a.position.z || b.position.x - a.position.x);
      this.mesh.add(model);
      return;
    }

    const bodyMat = new THREE.MeshStandardMaterial({ color: '#ff4d1a', roughness: 0.35, metalness: 0.6 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: '#101018', roughness: 0.2, metalness: 0.8 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.9 });
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 4.2), bodyMat);
    bodyMesh.position.y = -0.05;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.0), cabinMat);
    cabin.position.set(0, 0.45, -0.2);
    this.mesh.add(bodyMesh, cabin);
    const wheelGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const p of [
      { x: WHEEL_X, z: WHEEL_Z },
      { x: -WHEEL_X, z: WHEEL_Z },
      { x: WHEEL_X, z: -WHEEL_Z },
      { x: -WHEEL_X, z: -WHEEL_Z },
    ]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(p.x, WHEEL_Y - WHEEL_REST * 0.5, p.z);
      this.mesh.add(w);
      this.wheelMeshes.push(w);
    }
  }
}
