import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Assets } from '../core/Loader';
import { DEFAULT_CAR, type CarSpec } from './carSpec';
import { isSkidding } from './effectsMath';
import {
  airDragN,
  initialDrivetrain,
  rollingResistanceN,
  stepDrivetrain,
  type DriveInput,
  type DrivetrainState,
} from './drivetrain';
import { CAR_PAINT_GLSL } from './carPaint';
import { cornerAssistForce } from './cornerAssist';
import { yawAssistTorque } from './yawAssist';

/**
 * O carro: um corpo rígido (chassi) + 4 rodas por raycast do Rapier (door 2).
 * O Rapier não desenha nada; este módulo mantém o mesh do three grudado no
 * corpo físico a cada frame (`sync`). Massa, geometria, arrasto, aderência
 * e suspensão vêm da ficha (`carSpec.ts`); motor, câmbio, freios e volante vêm de
 * `drivetrain.ts`. Aqui só aplicamos e medimos.
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
const WHEEL_REST = 0.35;
const WHEEL_Y = -0.2;
/** caixa usada só para a inércia do chassi: largura, altura e comprimento (m) */
const INERTIA_BOX = { x: 1.8, y: 0.9, z: 4.2 };
const GRAVITY = 9.81;
/** rigidez da mola antes da car-feel; só fixa a altura parada, a mola de verdade vem da ficha */
const RIDE_HEIGHT_REF_STIFFNESS = 32;
/**
 * comprimento da suspensão com o carro parado (m): o de antes da car-feel (mola 32).
 * O comprimento livre de cada mola sai daqui e da rigidez da ficha, para o chassi
 * ficar na mesma altura com qualquer mola.
 */
const LOADED_SUSPENSION = WHEEL_REST - GRAVITY / (4 * RIDE_HEIGHT_REF_STIFFNESS);
/** fração da altura do contato em que o Rapier aplica a força lateral (medido: a rolagem saía 10 % da esperada) */
const RAPIER_ROLL_INFLUENCE = 0.1;
/** passos na janela da aceleração lateral (0.5 s) */
const LATERAL_G_WINDOW = 30;
export const MODEL_SCALE = 1.8;
const FRONT = [0, 1];
const REAR = [2, 3];
/** limiar de força de contato do chassi para gerar eventos (door 6 do visual-upgrade) */
export const CONTACT_FORCE_THRESHOLD = 2000;
/** cor da carroceria do jogador (races: os oponentes passam a sua no construtor) */
export const PLAYER_PAINT = '#ff4d1a';

export class Car {
  readonly body: RAPIER.RigidBody;
  readonly controller: RAPIER.DynamicRayCastVehicleController;
  readonly mesh = new THREE.Group();
  readonly placeholder: boolean;
  lastReset: ResetSnapshot | null = null;
  readonly chassisCollider: RAPIER.Collider;
  /** escorregamento lateral real ou freio de mão acima de 20 km/h (car-handling AC 23) */
  skidding = false;
  /** câmbio e volante (door 2 da car-handling) */
  drive: DrivetrainState;
  /** aceleração lateral (g), média dos últimos 30 passos */
  lateralG = 0;
  /** torque da ajuda de giro aplicado no último passo (N·m, eixo Y do mundo; door 1 da yaw-assist) */
  yawAssistNm = 0;
  /** força de curva aplicada no último passo (N, positiva = esquerda do carro; door 1 da corner-assist) */
  cornerAssistN = 0;
  /** impulso da força de curva no último passo (N·s, mundo); zero quando não houve força */
  readonly cornerAssistImpulse = { x: 0, y: 0, z: 0 };

  /** material da carroceria com a pintura deste carro (races AC 19); `null` no modelo glb do jogador */
  paintMaterial: THREE.MeshStandardMaterial | null = null;
  /** pintura que o shader da carroceria lê (só o oponente com glb); o placeholder usa `paintMaterial.color` */
  private paintUniform: { value: THREE.Color } | null = null;

  /** cor da carroceria como o jogador vê: a pintura do shader, ou a cor do material no placeholder; `null` sem pintura */
  bodyColor(): string | null {
    const c = this.paintUniform?.value ?? this.paintMaterial?.color;
    return c ? `#${c.getHexString()}` : null;
  }

  private readonly wheelMeshes: THREE.Object3D[] = [];
  /**
   * oponente com o modelo glb (races AC 32): as 4 rodas numa malha instanciada,
   * com a posição de cada uma e o espelho do lado direito
   */
  private wheelInstances: { mesh: THREE.InstancedMesh; base: THREE.Vector3[]; mirror: number[] } | null = null;
  private readonly wheelMatrix = new THREE.Matrix4();
  private readonly wheelQuat = new THREE.Quaternion();
  private readonly wheelEuler = new THREE.Euler();
  private readonly wheelScale = new THREE.Vector3();
  /** geometrias e materiais criados só para este carro, liberados no `dispose` */
  private readonly owned: Array<{ dispose(): void }> = [];
  private wheelSpin = 0;
  private readonly lateralSamples: number[] = [];
  private readonly wheelX: number;
  private readonly wheelZ: number;
  private readonly wheelRadius: number;
  private readonly forward = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();

  constructor(
    private readonly world: RAPIER.World,
    scene: THREE.Scene,
    assets: Assets,
    spawn: { x: number; y: number; z: number },
    readonly spec: CarSpec = DEFAULT_CAR,
    /** pintura da carroceria; sem ela, o carro do jogador (o glb sem tinta, ou `PLAYER_PAINT` no placeholder) */
    readonly paint: string | null = null,
  ) {
    this.placeholder = assets.placeholder;
    this.drive = initialDrivetrain(spec);
    this.wheelX = spec.trackM / 2;
    this.wheelZ = spec.wheelbaseM / 2;
    this.wheelRadius = spec.wheelRadiusM;

    // Massa, centro de massa e inércia vêm da ficha, não dos colliders (densidade 0).
    // O centro de massa fica `comHeightM` acima do chão com a suspensão assentada,
    // abaixo do chassi: o carro derrapa antes de capotar (AC 1).
    const restLength = LOADED_SUSPENSION + GRAVITY / (4 * spec.suspensionStiffness);
    const rideHeight = -WHEEL_Y + LOADED_SUSPENSION + spec.wheelRadiusM;
    const m = spec.massKg;
    const b = INERTIA_BOX;
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawn.x, spawn.y, spawn.z)
        .setAngularDamping(1.2)
        .setAdditionalMassProperties(
          m,
          { x: 0, y: spec.comHeightM - rideHeight, z: 0 },
          {
            x: (m / 12) * (b.y * b.y + b.z * b.z),
            y: (m / 12) * (b.x * b.x + b.z * b.z),
            z: (m / 12) * (b.x * b.x + b.y * b.y),
          },
          { x: 0, y: 0, z: 0, w: 1 },
        )
        .setCcdEnabled(true),
    );
    this.chassisCollider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(CHASSIS_HALF.x, CHASSIS_HALF.y, CHASSIS_HALF.z)
        .setDensity(0)
        .setFriction(0.4)
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(CONTACT_FORCE_THRESHOLD),
      this.body,
    );
    // sem isto a massa só aparece depois do primeiro passo do mundo
    this.body.recomputeMassPropertiesFromColliders();

    this.controller = world.createVehicleController(this.body);
    this.controller.setIndexForwardAxis = 2; // +Z é a frente (door 9)
    this.controller.indexUpAxis = 1;
    const down = { x: 0, y: -1, z: 0 };
    const axle = { x: -1, y: 0, z: 0 };
    this.wheelLocal().forEach((p, i) => {
      this.controller.addWheel({ x: p.x, y: WHEEL_Y, z: p.z }, down, axle, restLength, spec.wheelRadiusM);
      this.controller.setWheelSuspensionStiffness(i, spec.suspensionStiffness);
      this.controller.setWheelSuspensionCompression(i, spec.suspensionCompression);
      this.controller.setWheelSuspensionRelaxation(i, spec.suspensionRelaxation);
      this.controller.setWheelMaxSuspensionTravel(i, 0.3);
      this.controller.setWheelMaxSuspensionForce(i, 40000);
      this.controller.setWheelFrictionSlip(i, spec.tireGrip);
      this.controller.setWheelSideFrictionStiffness(i, 1.0);
    });

    this.buildVisual(assets);
    this.mesh.name = 'car';
    scene.add(this.mesh);
    this.sync();
  }

  /** Um passo fixo de física: aplica o input e integra o veículo. */
  fixedUpdate(input: DriveInput, dt: number): void {
    const spec = this.spec;
    const speedMs = this.speedMs();
    this.skidding = isSkidding(input.handbrake, speedMs * 3.6, this.maxLateralSlip());
    const { state, cmd } = stepDrivetrain(spec, this.drive, input, speedMs, dt);
    this.drive = state;
    // o comando é por eixo e o Rapier recebe por roda; o freio do Rapier é um impulso máximo por passo
    for (const i of REAR) {
      this.controller.setWheelEngineForce(i, cmd.engineForce / 2);
      this.controller.setWheelBrake(i, (cmd.brakeRear / 2) * dt);
      this.controller.setWheelFrictionSlip(i, spec.tireGrip * spec.rearGripFactor * cmd.rearFrictionFactor);
    }
    for (const i of FRONT) {
      this.controller.setWheelEngineForce(i, 0);
      this.controller.setWheelBrake(i, (cmd.brakeFront / 2) * dt);
      this.controller.setWheelSteering(i, cmd.steer);
    }
    this.controller.updateVehicle(dt);
    this.restoreRollMoment();
    this.applyYawAssist(dt);
    this.applyCornerAssist(input.handbrake, dt);
    this.applyResistance(dt);
    this.sampleLateralG();
    this.wheelSpin += (this.speedMs() * dt) / this.wheelRadius;
  }

  /** Ângulo atual das rodas dianteiras (rad), depois da rampa do volante. */
  get steerInput(): number {
    return this.drive.steer;
  }

  /** Rolagem (rad): asin da componente y do eixo +X do chassi; positiva = lado esquerdo para cima. */
  get bodyRoll(): number {
    return Math.asin(Math.max(-1, Math.min(1, this.axisWorld(1, 0, 0).y)));
  }

  /** Arfagem (rad): asin da componente y do eixo +Z do chassi; negativa = frente para baixo. */
  get bodyPitch(): number {
    return Math.asin(Math.max(-1, Math.min(1, this.axisWorld(0, 0, 1).y)));
  }

  /** Sideslip (rad): ângulo entre a frente no plano e a velocidade horizontal; 0 até 3 m/s. */
  get sideslip(): number {
    const v = this.body.linvel();
    if (Math.hypot(v.x, v.z) <= 3) return 0;
    const f = this.forwardWorld();
    const d = Math.atan2(v.x, v.z) - Math.atan2(f.x, f.z);
    return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
  }

  /** Posição no mundo (x, z) dos pontos de contato das rodas traseiras. */
  rearWheelPositions(): Array<{ x: number; z: number }> {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.quat.set(r.x, r.y, r.z, r.w);
    return [
      { x: this.wheelX, z: -this.wheelZ },
      { x: -this.wheelX, z: -this.wheelZ },
    ].map((w) => {
      const v = new THREE.Vector3(w.x, 0, w.z).applyQuaternion(this.quat);
      return { x: t.x + v.x, z: t.z + v.z };
    });
  }

  /** Velocidade angular em Y (rad/s): positiva = virando à esquerda. */
  yawRate(): number {
    return this.body.angvel().y;
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
    const inst = this.wheelInstances;
    if (inst) {
      inst.base.forEach((p, i) => {
        this.wheelQuat.setFromEuler(this.wheelEuler.set(this.wheelSpin, i < 2 ? steer : 0, 0, 'YXZ'));
        this.wheelMatrix.compose(p, this.wheelQuat, this.wheelScale.set(inst.mirror[i]!, 1, 1));
        inst.mesh.setMatrixAt(i, this.wheelMatrix);
      });
      inst.mesh.instanceMatrix.needsUpdate = true;
    }
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
      gear: this.drive.gear,
      rpm: this.drive.rpm,
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

  /** Arrasto aerodinâmico contra a velocidade e resistência de rolagem ao longo da frente. */
  private applyResistance(dt: number): void {
    const v = this.body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    const f = this.forwardWorld();
    const roll = this.wheelsOnGround() > 0 ? rollingResistanceN(this.spec, this.speedMs()) : 0;
    const drag = speed > 0 ? airDragN(this.spec, speed) / speed : 0;
    this.body.applyImpulse(
      {
        x: (-drag * v.x - roll * f.x) * dt,
        y: (-drag * v.y - roll * f.y) * dt,
        z: (-drag * v.z - roll * f.z) * dt,
      },
      true,
    );
  }

  /**
   * O Rapier aplica o impulso lateral de cada roda a só 10 % da altura entre o
   * ponto de contato e o centro de massa (a "roll influence" do Bullet), e o
   * carro quase não rola em curva. Aqui devolvemos os outros 90 % do momento,
   * como se a força lateral agisse no chão: a rolagem sai da altura real do
   * centro de massa (AC 4).
   */
  private restoreRollMoment(): void {
    const r = this.body.rotation();
    this.quat.set(r.x, r.y, r.z, r.w);
    const up = this.axis.set(0, 1, 0).applyQuaternion(this.quat);
    const com = this.body.worldCom();
    let tx = 0;
    let ty = 0;
    let tz = 0;
    for (let i = 0; i < 4; i++) {
      if (!this.controller.wheelIsInContact(i)) continue;
      const impulse = this.controller.wheelSideImpulse(i) ?? 0;
      const p = this.controller.wheelContactPoint(i);
      if (impulse === 0 || !p) continue;
      const steer = i < 2 ? this.controller.wheelSteering(i) ?? 0 : 0;
      // eixo da roda (-X local) girado pela direção em torno de +Y, no mundo
      const f = this.scratch.set(-Math.cos(steer), 0, Math.sin(steer)).applyQuaternion(this.quat).multiplyScalar(impulse);
      const h = (up.x * (p.x - com.x) + up.y * (p.y - com.y) + up.z * (p.z - com.z)) * (1 - RAPIER_ROLL_INFLUENCE);
      // torque de deslocar o ponto de aplicação por h ao longo de up: (up × h) × f
      tx += h * (up.y * f.z - up.z * f.y);
      ty += h * (up.z * f.x - up.x * f.z);
      tz += h * (up.x * f.y - up.y * f.x);
    }
    this.body.applyTorqueImpulse({ x: tx, y: ty, z: tz }, true);
  }

  /** Ajuda arcade de giro (AD-014): torque em Y do mundo que leva o giro ao alvo das rodas. */
  private applyYawAssist(dt: number): void {
    const yawInertia = this.body.effectiveAngularInertia().m22;
    this.yawAssistNm = yawAssistTorque(
      this.spec,
      this.drive.steer,
      this.speedMs(),
      this.body.angvel().y,
      this.wheelsOnGround(),
      yawInertia,
    );
    if (this.yawAssistNm !== 0) this.body.applyTorqueImpulse({ x: 0, y: this.yawAssistNm * dt, z: 0 }, true);
  }

  /**
   * Ajuda arcade de curva (AD-014): força horizontal no centro de massa, perpendicular à
   * velocidade horizontal, do lado esquerdo do carro quando positiva. No centro de massa
   * ela fecha a trajetória sem gerar momento de tombamento.
   */
  private applyCornerAssist(handbrake: boolean, dt: number): void {
    const forwardSpeed = this.speedMs();
    this.cornerAssistN = cornerAssistForce(this.spec, this.drive.steer, forwardSpeed, this.wheelsOnGround(), handbrake);
    this.cornerAssistImpulse.x = 0;
    this.cornerAssistImpulse.y = 0;
    this.cornerAssistImpulse.z = 0;
    if (this.cornerAssistN === 0) return;
    const v = this.body.linvel();
    const speed = Math.hypot(v.x, v.z);
    if (speed < 1e-6) return;
    // esquerda da velocidade: +Y × v (de frente, +Z → +X, o lado esquerdo do carro); de ré, o outro lado
    const side = Math.sign(forwardSpeed) / speed;
    const k = this.cornerAssistN * dt * side;
    this.cornerAssistImpulse.x = v.z * k;
    this.cornerAssistImpulse.z = -v.x * k;
    this.body.applyImpulse(this.cornerAssistImpulse, true);
  }

  private sampleLateralG(): void {
    const v = this.body.linvel();
    this.lateralSamples.push((Math.hypot(v.x, v.z) * Math.abs(this.body.angvel().y)) / GRAVITY);
    if (this.lateralSamples.length > LATERAL_G_WINDOW) this.lateralSamples.shift();
    this.lateralG = this.lateralSamples.reduce((a, b) => a + b, 0) / this.lateralSamples.length;
  }

  private wheelsOnGround(): number {
    let n = 0;
    for (let i = 0; i < 4; i++) if (this.controller.wheelIsInContact(i)) n++;
    return n;
  }

  /** Maior velocidade lateral (m/s) no ponto de contato das rodas no chão, ao longo do eixo de cada roda. */
  private maxLateralSlip(): number {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.quat.set(r.x, r.y, r.z, r.w);
    const com = this.body.worldCom();
    const v = this.body.linvel();
    const w = this.body.angvel();
    let max = 0;
    this.wheelLocal().forEach((p, i) => {
      if (!this.controller.wheelIsInContact(i)) return;
      const susp = this.controller.wheelSuspensionLength(i) ?? WHEEL_REST;
      const c = this.scratch.set(p.x, WHEEL_Y - susp - this.wheelRadius, p.z).applyQuaternion(this.quat);
      const rx = t.x + c.x - com.x;
      const ry = t.y + c.y - com.y;
      const rz = t.z + c.z - com.z;
      // velocidade do ponto de contato: v + w × r
      const px = v.x + w.y * rz - w.z * ry;
      const py = v.y + w.z * rx - w.x * rz;
      const pz = v.z + w.x * ry - w.y * rx;
      const steer = i < 2 ? this.controller.wheelSteering(i) ?? 0 : 0;
      // eixo lateral da roda: +X local girado pelo ângulo de direção em torno de +Y
      const side = this.scratch.set(Math.cos(steer), 0, -Math.sin(steer)).applyQuaternion(this.quat);
      max = Math.max(max, Math.abs(px * side.x + py * side.y + pz * side.z));
    });
    return max;
  }

  /** Posição (x, z) local das rodas: frente-esq, frente-dir, trás-esq, trás-dir. */
  private wheelLocal(): Array<{ x: number; z: number }> {
    return [
      { x: this.wheelX, z: this.wheelZ },
      { x: -this.wheelX, z: this.wheelZ },
      { x: this.wheelX, z: -this.wheelZ },
      { x: -this.wheelX, z: -this.wheelZ },
    ];
  }

  private axisWorld(x: number, y: number, z: number): THREE.Vector3 {
    const r = this.body.rotation();
    this.quat.set(r.x, r.y, r.z, r.w);
    return this.axis.set(x, y, z).applyQuaternion(this.quat);
  }

  private forwardWorld(): THREE.Vector3 {
    const r = this.body.rotation();
    this.quat.set(r.x, r.y, r.z, r.w);
    return this.forward.set(0, 0, 1).applyQuaternion(this.quat);
  }

  /**
   * Tira o carro do mundo (races AC 23): controlador de veículo, corpo com o
   * collider, malha da cena, e o que foi criado só para ele.
   */
  dispose(): void {
    this.world.removeVehicleController(this.controller);
    this.world.removeRigidBody(this.body);
    this.mesh.removeFromParent();
    this.owned.forEach((o) => o.dispose());
    this.owned.length = 0;
  }

  private buildVisual(assets: Assets): void {
    if (assets.carModel) {
      // o jogador usa o modelo carregado; um oponente usa uma cópia com a carroceria tingida
      const model = this.paint ? assets.carModel.clone(true) : assets.carModel;
      if (this.paint) {
        this.buildOpponentModel(model);
        return;
      }
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

    this.buildPlaceholder();
  }

  /**
   * Oponente com o modelo glb (races AC 19 e AC 32): carroceria e aerofólio numa
   * malha só, com a pintura, e as 4 rodas numa malha instanciada. 2 draw calls
   * por passe em vez de 6.
   */
  private buildOpponentModel(model: THREE.Object3D): void {
    // matrizes relativas à raiz do modelo (os nós podem estar aninhados)
    model.position.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);
    const parts: THREE.Mesh[] = [];
    const wheels: THREE.Mesh[] = [];
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (/^wheel/.test(obj.name)) wheels.push(mesh);
      else parts.push(mesh);
    });
    const group = new THREE.Group();
    group.scale.setScalar(MODEL_SCALE);
    group.position.y = -(CHASSIS_HALF.y + WHEEL_REST * 0.4);

    // a pintura troca o laranja da paleta no shader (block-life-extras door 3); a cor do material fica branca
    const material = (parts[0]!.material as THREE.MeshStandardMaterial).clone();
    material.color.set('#ffffff');
    const paintUniform = { value: new THREE.Color(this.paint!) };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uPaint = paintUniform;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uPaint;')
        .replace('#include <map_fragment>', `#include <map_fragment>\nvec3 carPaint = uPaint;\n${CAR_PAINT_GLSL}`);
    };
    material.customProgramCacheKey = () => 'car-paint';
    this.paintUniform = paintUniform;
    this.paintMaterial = material;
    const bodyGeo = mergeGeometries(
      parts.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld)),
    );
    if (!bodyGeo) throw new Error('Car: carroceria do oponente não junta');
    group.add(new THREE.Mesh(bodyGeo, material));

    // ordem: frente-esq, frente-dir, tras-esq, tras-dir (como `wheelMeshes`)
    const at = (w: THREE.Object3D) => new THREE.Vector3().setFromMatrixPosition(w.matrixWorld);
    wheels.sort((a, b) => at(b).z - at(a).z || at(b).x - at(a).x);
    const left = wheels.find((w) => at(w).x > 0) ?? wheels[0]!;
    const wheelMesh = new THREE.InstancedMesh(left.geometry, left.material as THREE.Material, wheels.length);
    wheelMesh.frustumCulled = false;
    this.wheelInstances = {
      mesh: wheelMesh,
      base: wheels.map(at),
      mirror: wheels.map((w) => (at(w).x > 0 ? 1 : -1)),
    };
    group.add(wheelMesh);
    this.owned.push(material, bodyGeo, { dispose: () => wheelMesh.dispose() });
    this.mesh.add(group);
  }

  private buildPlaceholder(): void {
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.paint ?? PLAYER_PAINT, roughness: 0.35, metalness: 0.6 });
    this.paintMaterial = bodyMat;
    const cabinMat = new THREE.MeshStandardMaterial({ color: '#101018', roughness: 0.2, metalness: 0.8 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.9 });
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 4.2), bodyMat);
    bodyMesh.position.y = -0.05;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.0), cabinMat);
    cabin.position.set(0, 0.45, -0.2);
    this.mesh.add(bodyMesh, cabin);
    const wheelGeo = new THREE.CylinderGeometry(this.wheelRadius, this.wheelRadius, 0.3, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    this.owned.push(bodyMat, cabinMat, wheelMat, bodyMesh.geometry, cabin.geometry, wheelGeo);
    for (const p of this.wheelLocal()) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(p.x, WHEEL_Y - WHEEL_REST * 0.5, p.z);
      this.mesh.add(w);
      this.wheelMeshes.push(w);
    }
  }
}
