import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { blurFor, chaseTarget } from '../camera/chaseMath';
import { GradeShader } from '../post/GradeShader';
import { Effects } from '../vehicle/Effects';
import { flickerIntensity } from '../world/flicker';
import { Rain } from '../world/Rain';
import type { QualityPreset } from './quality';
import { AudioEngine } from '../audio/AudioEngine';
import { ChaseCamera } from '../camera/ChaseCamera';
import { Hud } from '../hud/Hud';
import { Minimap } from '../hud/Minimap';
import { Car } from '../vehicle/Car';
import { steerAxis } from './input';
import { DEFAULT_SEED } from '../world/CityGenerator';
import { CityScene, type WorldData } from '../world/CityScene';
import { generateLots } from '../world/lots/LotGenerator';
import { generateRoads, type Road } from '../world/roads/RoadGenerator';
import { generateLamps } from '../world/roads/roadMesh';
import { carveRoads } from '../world/terrain/carveRoads';
import { generateTerrain, heightAt, riverCenterX } from '../world/terrain/TerrainGenerator';
import { WorldPhysics } from '../world/WorldPhysics';
import { WORLD_HALF, nearestRoadPoint, needsWaterReset } from '../world/worldMath';
import { addNightLights, createNightEnvironment } from '../world/Environment';
import { GameLoop } from './GameLoop';
import { InputManager } from './InputManager';
import type { Assets } from './Loader';

/**
 * Ponto de spawn: na avenida que passa mais perto da origem, 6 pontos (12 m)
 * antes do ponto onde ela cruza outra avenida perto da origem, olhando para o cruzamento.
 */
function centralSpawn(roads: Road[]): { x: number; y: number; z: number; heading: number } {
  const avenues = roads.filter((r) => r.kind === 'avenue');
  const toOrigin = (r: Road) => nearestRoadPoint({ roads: [r] }, 0, 0).distance;
  const [main, cross] = [...avenues].sort((a, b) => toOrigin(a) - toOrigin(b));
  const p = main!.points;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < p.length / 3; i++) {
    const n = nearestRoadPoint({ roads: [cross!] }, p[i * 3]!, p[i * 3 + 2]!);
    if (n.distance < bestD) {
      bestD = n.distance;
      best = i;
    }
  }
  const i = Math.max(0, best - 6);
  const heading = Math.atan2(p[(i + 1) * 3]! - p[i * 3]!, p[(i + 1) * 3 + 2]! - p[i * 3 + 2]!);
  return { x: p[i * 3]!, y: p[i * 3 + 1]!, z: p[i * 3 + 2]!, heading };
}

/** Opções da sonda DEV `render.headlightShimmer` (facade-glint). */
interface HeadlightShimmerOpts {
  headlight: boolean;
  specularAA: boolean;
  /** false zera só o especular das fachadas (padrão true) */
  specular?: boolean;
  /** true usa os materiais de antes da facade-glint (normalScale 1, metal com metalness 0.5, sem piso de rugosidade) */
  legacyMaterials?: boolean;
}

function mapSrc(m: THREE.MeshStandardMaterial): string | null {
  const img = m.map?.image as { currentSrc?: string; src?: string } | undefined;
  return img?.currentSrc ?? img?.src ?? null;
}

/**
 * Raiz de composição: cria mundo físico, cena, carro, câmera, HUD e áudio, e
 * liga tudo ao `GameLoop`. É o único lugar que conhece todos os módulos.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly world: RAPIER.World;
  readonly city: CityScene;
  readonly physics: WorldPhysics;
  readonly car: Car;
  /** quantas vezes o carro caiu na água e voltou para a estrada (door 9) */
  waterResets = 0;
  /** estado do chassi logo depois do último reset por água, e o ponto de estrada usado */
  lastWaterReset: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    linvel: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number; heading: number; roadId: number };
  } | null = null;
  readonly chase: ChaseCamera;
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly gtao: GTAOPass | null;
  readonly grade: ShaderPass;
  readonly gtaoClipBox = new THREE.Box3();
  readonly rain: Rain;
  readonly effects: Effects;
  readonly headlightCones: THREE.Mesh[] = [];
  readonly headlight: THREE.SpotLight;
  private readonly spawn: { x: number; y: number; z: number; heading: number };
  readonly quality: QualityPreset;
  private readonly eventQueue: RAPIER.EventQueue;
  readonly hud: Hud;
  readonly minimap: Minimap;
  readonly audio = new AudioEngine();
  readonly input = new InputManager();
  readonly loop: GameLoop;
  ready = false;
  drawCalls = 0;
  /** segundos de física simulados desde o início (avança em passos de 1/60) */
  simTime = 0;
  frames = 0;
  private readonly onFirstFrame: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    hudRoot: HTMLElement,
    readonly assets: Assets,
    quality: QualityPreset,
    onFirstFrame: () => void,
  ) {
    this.onFirstFrame = onFirstFrame;
    this.quality = quality;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.info.autoReset = false; // contamos draw calls de todos os passes por frame

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.eventQueue = new RAPIER.EventQueue(true);

    createNightEnvironment(this.renderer, this.scene);
    addNightLights(this.scene);

    // mundo da city-terrain: tudo gerado por seed no boot (doors 1-6)
    const seed = DEFAULT_SEED;
    const raw = generateTerrain(seed);
    const network = generateRoads(seed, raw);
    const carved = carveRoads(raw, network);
    const { lots, signs } = generateLots(seed, network, carved);
    const { lamps } = generateLamps(network);
    const data: WorldData = { seed, raw, carved, network, lots, signs, lamps };
    this.physics = new WorldPhysics(this.world, carved, raw, network, lots);
    this.city = new CityScene(data, this.scene, assets, quality);

    // spawn: parado numa avenida do centro, alinhado a ela, 12 m antes do cruzamento
    // central (AC 33): à frente e à esquerda há pista livre (a avenida transversal)
    const spawn = centralSpawn(network.roads);
    this.spawn = spawn;
    this.car = new Car(this.world, this.scene, assets, { x: spawn.x, y: spawn.y + 1.2, z: spawn.z });
    this.car.teleport(spawn.x, spawn.y + 1.2, spawn.z, spawn.heading);
    this.city.chunks.update(spawn.x, spawn.z);

    // farol: única luz presa ao carro
    const headlight = new THREE.SpotLight('#dfe8ff', 40, 60, Math.PI / 5, 0.6, 1.2);
    headlight.position.set(0, 0.6, 1.8);
    headlight.target.position.set(0, -0.5, 20);
    this.car.mesh.add(headlight, headlight.target);
    this.headlight = headlight;

    // cones de farol visíveis (AC 12): aditivos e bem transparentes
    const coneLength = 14;
    const coneGeo = new THREE.ConeGeometry(2.6, coneLength, 20, 1, true);
    coneGeo.rotateX(-Math.PI / 2); // ápice para -Z
    coneGeo.translate(0, 0, coneLength / 2); // ápice na origem, abrindo para +Z
    // gradiente: forte no farol (ápice, uv.y = 1), some na ponta do feixe (uv.y = 0)
    const fadeCanvas = document.createElement('canvas');
    fadeCanvas.width = 4;
    fadeCanvas.height = 64;
    const fctx = fadeCanvas.getContext('2d')!;
    const grad = fctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#000000');
    fctx.fillStyle = grad;
    fctx.fillRect(0, 0, 4, 64);
    const coneMat = new THREE.MeshBasicMaterial({
      color: '#cfe0ff',
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
      alphaMap: new THREE.CanvasTexture(fadeCanvas),
    });
    for (const x of [-0.6, 0.6]) {
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(x, 0.35, 2.0);
      cone.rotation.x = 0.08; // levemente para baixo
      this.car.mesh.add(cone);
      this.headlightCones.push(cone);
    }

    this.rain = new Rain(this.scene, quality.rainCount);
    this.effects = new Effects(this.scene);

    // o reflexo da rua não precisa de partículas, cones, água nem dos chunks fora do centro: menos draw calls no espelho
    const reflector = this.city.reflector;
    if (reflector) {
      const renderMirror = reflector.onBeforeRender.bind(reflector);
      reflector.onBeforeRender = (...args: Parameters<typeof reflector.onBeforeRender>) => {
        const skip: THREE.Object3D[] = [
          this.rain.points,
          ...this.effects.objects,
          ...this.headlightCones,
          this.city.water.mesh,
          ...this.city.chunks.outerObjects(),
        ];
        const was = skip.map((o) => o.visible);
        skip.forEach((o) => (o.visible = false));
        renderMirror(...args);
        skip.forEach((o, i) => (o.visible = was[i]!));
      };
    }

    this.chase = new ChaseCamera(window.innerWidth / window.innerHeight);
    this.chase.snapTo(this.car.state());

    // pós (door 7): Render -> GTAO -> Bloom -> Grade -> SMAA -> Output
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.chase.camera));
    if (quality.gtao) {
      const halfW = Math.floor(window.innerWidth / 2);
      const halfH = Math.floor(window.innerHeight / 2);
      const gtao = new GTAOPass(this.scene, this.chase.camera, halfW, halfH);
      gtao.output = GTAOPass.OUTPUT.Default;
      gtao.blendIntensity = 0.7;
      // o composer redimensiona todo passo para a tela cheia; o GTAO fica em meia resolução
      const baseSetSize = gtao.setSize.bind(gtao);
      gtao.setSize = () => baseSetSize(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2));
      this.gtaoClipBox.set(
        new THREE.Vector3(-WORLD_HALF, -10, -WORLD_HALF),
        new THREE.Vector3(WORLD_HALF, 200, WORLD_HALF),
      );
      gtao.setSceneClipBox(this.gtaoClipBox);
      this.composer.addPass(gtao);
      this.gtao = gtao;
    } else {
      this.gtao = null;
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.4, 0.7);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new SMAAPass());
    this.composer.addPass(new OutputPass());

    this.hud = new Hud(hudRoot);
    const minimapCanvas = hudRoot.querySelector<HTMLCanvasElement>('#minimap');
    if (!minimapCanvas) throw new Error('HUD: #minimap não encontrado');
    this.minimap = new Minimap(minimapCanvas, network);

    this.input.setFirstKeyHandler(() => this.audio.start());
    this.input.onPress('KeyR', () => this.car.reset());
    this.input.onPress('KeyM', () => this.audio.toggleMute());

    window.addEventListener('resize', this.handleResize);

    this.loop = new GameLoop(this.fixedUpdate, this.render);
  }

  start(): void {
    this.loop.start();
  }

  private readonly fixedUpdate = (dt: number): void => {
    const s = this.input.state;
    // sentido do movimento antes do passo: a batida zera a velocidade, então o lado do impacto vem daqui
    const movingDir = this.car.speedMs() >= 0 ? 1 : -1;
    this.car.fixedUpdate(
      { throttle: s.throttle, brake: s.brake, steer: steerAxis(s), handbrake: s.handbrake },
      dt,
    );
    this.world.step(this.eventQueue);
    this.simTime += dt;

    // caiu na água (door 9): volta em pé, parado, 1 m acima do ponto de estrada mais próximo
    const pos = this.car.body.translation();
    if (needsWaterReset(pos.y)) {
      const near = nearestRoadPoint(this.city.data.network, pos.x, pos.z);
      this.car.teleport(near.x, near.y + 1, near.z, near.heading);
      this.waterResets++;
      this.lastWaterReset = {
        position: { ...this.car.body.translation() },
        rotation: { ...this.car.body.rotation() },
        linvel: { ...this.car.body.linvel() },
        target: { x: near.x, y: near.y, z: near.z, heading: near.heading, roadId: near.road.id },
      };
    }

    // colisões (door 6): força de contato do chassi -> impulso deste passo (o maior do passo)
    let strongest = 0;
    this.eventQueue.drainContactForceEvents((event) => {
      strongest = Math.max(strongest, event.totalForceMagnitude() * dt);
    });
    if (strongest > 0) {
      // faíscas no para-choque do lado para onde o carro andava
      const carPos = this.car.body.translation();
      const h = this.car.heading();
      const dir = movingDir;
      this.effects.collide({
        impulse: strongest,
        x: carPos.x + Math.sin(h) * 2.2 * dir,
        y: 0.6,
        z: carPos.z + Math.cos(h) * 2.2 * dir,
      });
      this.chase.impact(strongest);
    }

    this.effects.step(dt, this.car.skidding, this.car.rearWheelPositions(), this.car.heading());
  };

  private readonly render = (dt: number): void => {
    this.car.sync();
    const state = this.car.state();
    this.chase.update(dt, state, this.car.yawRate());
    this.city.chunks.update(state.x, state.z);
    this.city.water.update(this.simTime);
    this.rain.update(this.simTime, { x: state.x, y: state.y, z: state.z });
    this.effects.render();
    this.city.signMaterials.forEach((m, i) => {
      m.emissiveIntensity = flickerIntensity(this.simTime, i);
    });
    (this.grade.uniforms.uBlur as { value: number }).value = blurFor(state.speedKmh);
    this.hud.update(state);
    this.minimap.update(state);
    this.audio.update(state.rpm, this.input.state.throttle);

    this.renderer.info.reset();
    this.composer.render();
    this.drawCalls = this.renderer.info.render.calls;
    this.frames++;

    if (!this.ready) {
      this.ready = true;
      this.onFirstFrame();
    }
  };

  private readonly handleResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.grade.setSize(w, h);
    this.chase.resize(w / h);
  };

  /** Objeto lido por `window.__game` nos testes Playwright (só em DEV). */
  debugHandle(): unknown {
    const game = this;
    return {
      get ready() {
        return game.ready;
      },
      get simTime() {
        return game.simTime;
      },
      get frames() {
        return game.frames;
      },
      city: {
        seed: game.city.data.seed,
        get facadeMeshes() {
          return game.city.facadeMeshes.map((mesh, i) => {
            const aRepeat = mesh.geometry.getAttribute('aRepeat') as THREE.InstancedBufferAttribute;
            const aSeed = mesh.geometry.getAttribute('aSeed') as THREE.InstancedBufferAttribute;
            const b = game.city.facadeLots[i]![0];
            return {
              count: mesh.count,
              aRepeatItemSize: aRepeat?.itemSize ?? 0,
              aSeedItemSize: aSeed?.itemSize ?? 0,
              firstRepeat: aRepeat ? [aRepeat.getX(0), aRepeat.getY(0)] : null,
              firstBuilding: b ? { width: b.width, height: b.height } : null,
              mapSrc: (() => {
                const map = (mesh.material as THREE.MeshStandardMaterial).map;
                const img = map?.image as { src?: string; currentSrc?: string } | undefined;
                return img?.currentSrc ?? img?.src ?? null;
              })(),
            };
          });
        },
      },
      world: game.worldDebug(),
      textures: {
        loaded: [...game.assets.loadedSets],
        failed: [...game.assets.failedSets],
      },
      quality: {
        level: game.quality.level,
      },
      weather: {
        get rainCount() {
          return game.rain.count;
        },
        get rainObject() {
          return game.rain.points.type;
        },
        get uTime() {
          return game.rain.time;
        },
        get center() {
          return game.rain.center;
        },
      },
      effects: {
        get headlightCones() {
          return game.headlightCones.map((c) => {
            const m = c.material as THREE.MeshBasicMaterial;
            c.geometry.computeBoundingBox();
            const box = c.geometry.boundingBox!;
            return {
              transparent: m.transparent,
              opacity: m.opacity,
              additive: m.blending === THREE.AdditiveBlending,
              minZ: box.min.z,
              maxZ: box.max.z,
            };
          });
        },
        get skidCount() {
          return game.effects.skidCount;
        },
        get smokeAlive() {
          return game.effects.smoke.alive;
        },
        get sparksSpawned() {
          return game.effects.sparksSpawned;
        },
        get config() {
          return {
            smokeCap: game.effects.smoke.capacity,
            smokeLifetime: game.effects.smoke.lifetime,
            sparkCap: game.effects.sparks.capacity,
            sparkLifetime: game.effects.sparks.lifetime,
            skidCap: game.effects.skids.capacity,
          };
        },
        get lastCollision() {
          return game.effects.lastCollision;
        },
      },
      post: {
        get uBlur() {
          return (game.grade.uniforms.uBlur as { value: number }).value;
        },
        get uniforms() {
          const u = game.grade.uniforms as Record<string, { value: unknown }>;
          const v3 = (x: unknown) => {
            const v = x as THREE.Vector3;
            return [v.x, v.y, v.z];
          };
          return {
            uAberration: u.uAberration!.value,
            uVignette: u.uVignette!.value,
            uLift: v3(u.uLift!.value),
            uGain: v3(u.uGain!.value),
          };
        },
        get gtao() {
          const g = game.gtao;
          return g ? { width: g.width, height: g.height, blendIntensity: g.blendIntensity, output: g.output } : null;
        },
        get gtaoClipBox() {
          const b = game.gtaoClipBox;
          return { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] };
        },
      },
      car: {
        get speedKmh() {
          return game.car.speedKmh();
        },
        get position() {
          return { ...game.car.body.translation() };
        },
        get rotation() {
          return { ...game.car.body.rotation() };
        },
        get linvel() {
          return { ...game.car.body.linvel() };
        },
        get angvel() {
          return { ...game.car.body.angvel() };
        },
        get heading() {
          return game.car.heading();
        },
        get lastReset() {
          return game.car.lastReset;
        },
        wheelCount: game.car.controller.numWheels(),
        // o bundle do Rapier é minificado, então `constructor.name` não serve; instanceof serve
        controllerKind:
          game.car.controller instanceof RAPIER.DynamicRayCastVehicleController
            ? 'DynamicRayCastVehicleController'
            : (game.car.controller as object).constructor.name,
        get wheelSteering() {
          return [0, 1, 2, 3].map((i) => game.car.controller.wheelSteering(i));
        },
        get wheelContact() {
          return [0, 1, 2, 3].map((i) => game.car.controller.wheelIsInContact(i));
        },
        get wheelEngineForce() {
          return [0, 1, 2, 3].map((i) => game.car.controller.wheelEngineForce(i));
        },
        get gear() {
          return game.car.state().gear;
        },
        get rpm() {
          return game.car.state().rpm;
        },
        placeholder: game.car.placeholder,
        get collisionEvents() {
          return {
            activeEvents: game.car.chassisCollider.activeEvents(),
            contactForceEvents: RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS,
            threshold: game.car.chassisCollider.contactForceEventThreshold(),
          };
        },
        teleport: (x: number, y: number, z: number, heading: number) => game.car.teleport(x, y, z, heading),
        /** só DEV/testes: velocidade ao longo da frente do carro (m/s) */
        setForwardSpeed: (ms: number) => {
          const h = game.car.heading();
          game.car.body.setLinvel({ x: Math.sin(h) * ms, y: 0, z: Math.cos(h) * ms }, true);
        },
        setRotation: (q: { x: number; y: number; z: number; w: number }) => game.car.setRotation(q),
      },
      render: {
        get calls() {
          return game.drawCalls;
        },
        /**
         * só DEV/testes: cintilação com a câmera andando. Renderiza `frames` quadros
         * avançando a câmera `step` m para a frente por quadro (chuva e partículas
         * escondidas, cena parada) e devolve a fração de pixels cuja luminância tem
         * segunda diferença no tempo acima de 0.15. Movimento suave dá ~0; um padrão
         * que muda de pixel para pixel a cada quadro dá valores altos.
         * `mirror: false` troca o reflexo da rua pelo chão escuro do modo `low`
         * (sem chão, o centro vira um buraco e as bordas contra o fundo cintilam),
         * para medir só as fachadas.
         */
        shimmer: (step: number, opts: { frames?: number; mirror?: boolean } = {}): number => {
          const frames = opts.frames ?? 10;
          const cam = game.chase.camera;
          const hidden: THREE.Object3D[] = [game.rain.points, ...game.effects.objects];
          let ground: THREE.Mesh | null = null;
          if (opts.mirror === false && game.city.reflector) {
            hidden.push(game.city.reflector);
            const size = game.city.reflectorSize;
            ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: '#07080d' }));
            ground.rotation.x = -Math.PI / 2;
            game.scene.add(ground);
          }
          const was = hidden.map((o) => o.visible);
          hidden.forEach((o) => (o.visible = false));
          const p0 = cam.position.clone();
          const dir = new THREE.Vector3();
          cam.getWorldDirection(dir);
          dir.y = 0;
          dir.normalize();
          const gl = game.renderer.getContext();
          const w = gl.drawingBufferWidth;
          const h = gl.drawingBufferHeight;
          const px = new Uint8Array(w * h * 4);
          const lum: Float32Array[] = [];
          for (let i = 0; i < frames; i++) {
            cam.position.copy(p0).addScaledVector(dir, i * step);
            cam.updateMatrixWorld();
            game.composer.render(0);
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
            const l = new Float32Array(w * h);
            for (let k = 0; k < w * h; k++) l[k] = (0.2126 * px[4 * k]! + 0.7152 * px[4 * k + 1]! + 0.0722 * px[4 * k + 2]!) / 255;
            lum.push(l);
          }
          cam.position.copy(p0);
          cam.updateMatrixWorld();
          hidden.forEach((o, i) => (o.visible = was[i]!));
          if (ground) {
            game.scene.remove(ground);
            ground.geometry.dispose();
            (ground.material as THREE.Material).dispose();
          }
          let flicker = 0;
          for (let i = 1; i < frames - 1; i++) {
            const a = lum[i - 1]!, b = lum[i]!, c = lum[i + 1]!;
            for (let k = 0; k < w * h; k++) if (Math.abs(c[k]! - 2 * b[k]! + a[k]!) > 0.15) flicker++;
          }
          return flicker / ((frames - 2) * w * h);
        },
        headlightShimmer: (type: number, opts: HeadlightShimmerOpts) =>
          game.probeHeadlightShimmer(type, opts),
        probeRoadMarks: (roadId: number, index: number) => game.probeRoadMarks(roadId, index),
      },
      camera: {
        get fov() {
          return game.chase.camera.fov;
        },
        get shake() {
          return game.chase.shake;
        },
        get lateral() {
          return game.chase.lateralOffset;
        },
        get target() {
          return game.chase.targetPosition;
        },
        get position() {
          return { x: game.chase.camera.position.x, y: game.chase.camera.position.y, z: game.chase.camera.position.z };
        },
      },
      physics: {
        get timestep() {
          return game.world.timestep;
        },
      },
      materials: {
        get roadRoughness() {
          return game.city.roadMaterial.roughness;
        },
        /** antialiasing de especular das fachadas: o uniform compartilhado vale 1 nos 4 materiais */
        get facadeSpecularAA() {
          return game.city.facadeMaterials.every(
            (m) => (m.userData.specularAA as { value: number } | undefined)?.value === 1,
          );
        },
        get windowEmissiveIntensity() {
          return game.city.facadeMaterials[0]!.emissiveIntensity;
        },
        get road() {
          const m = game.city.roadMaterial;
          return {
            hasMap: m.map !== null,
            hasNormalMap: m.normalMap !== null,
            hasRoughnessMap: m.roughnessMap !== null,
            roughness: m.roughness,
            transparent: m.transparent,
            opacity: m.opacity,
            mapSrc: mapSrc(m),
          };
        },
        get roadOuter() {
          const m = game.city.roadOuterMaterial;
          return {
            hasMap: m.map !== null,
            hasNormalMap: m.normalMap !== null,
            hasRoughnessMap: m.roughnessMap !== null,
            transparent: m.transparent,
            opacity: m.opacity,
            mapSrc: mapSrc(m),
          };
        },
        get sidewalk() {
          const m = game.city.sidewalkMaterial;
          const img = m.map?.image as { currentSrc?: string; src?: string } | undefined;
          return { hasMap: m.map !== null, hasNormalMap: m.normalMap !== null, mapSrc: img?.currentSrc ?? img?.src ?? null };
        },
        get signEmissiveIntensities() {
          return game.city.signMaterials.map((m) => m.emissiveIntensity);
        },
        get lampEmissiveIntensity() {
          return game.city.lampMaterial.emissiveIntensity;
        },
      },
      scene: {
        get hasEnvironment() {
          return game.scene.environment !== null;
        },
        get reflector() {
          const r = game.city.reflector;
          if (!r) return { present: false, size: null, y: null, planeSize: null, position: null };
          const rt = r.getRenderTarget();
          const g = (r.geometry as THREE.PlaneGeometry).parameters;
          return {
            present: game.scene.getObjectById(r.id) !== undefined,
            size: [rt.width, rt.height],
            y: r.position.y,
            planeSize: [g.width, g.height],
            position: [r.position.x, r.position.y, r.position.z],
          };
        },
      },
      composer: {
        get passes() {
          return game.composer.passes.map((p) => p.constructor.name);
        },
        get bloomEnabled() {
          return game.bloom.enabled;
        },
        get bloomParams() {
          return { strength: game.bloom.strength, radius: game.bloom.radius, threshold: game.bloom.threshold };
        },
      },
      get toneMapping() {
        return game.renderer.toneMapping;
      },
      get toneMappingIsACES() {
        return game.renderer.toneMapping === THREE.ACESFilmicToneMapping;
      },
      audio: {
        get state() {
          return game.audio.state;
        },
        get contextState() {
          return game.audio.contextState();
        },
        get gains() {
          return game.audio.gains();
        },
        get graph() {
          return game.audio.graph();
        },
        get compressor() {
          return game.audio.compressorParams();
        },
        get cutoffTarget() {
          return game.audio.currentCutoffTarget();
        },
        get firingHz() {
          return game.audio.currentFiringHz();
        },
        get params() {
          return game.audio.params();
        },
        get throttling() {
          return game.audio.isThrottling();
        },
      },
    };
  }

  /** `__game.world` (só DEV): dados e consultas do mundo da city-terrain para as provas. */
  private worldDebug(): unknown {
    const game = this;
    const data = this.city.data;
    const roadInfo = (r: Road) => ({ id: r.id, kind: r.kind, lanes: r.lanes, width: r.width, closed: r.closed, count: r.points.length / 3, bridges: r.bridges });
    return {
      heightAt: (x: number, z: number) => heightAt(data.carved, x, z),
      rawHeightAt: (x: number, z: number) => heightAt(data.raw, x, z),
      raycastDown: (x: number, z: number) => game.physics.raycastDown(x, z),
      riverCenterX: (z: number) => riverCenterX(z, data.seed),
      roads: data.network.roads.map(roadInfo),
      roadPoint: (id: number, i: number) => {
        const p = data.network.roads[id]!.points;
        return { x: p[i * 3]!, y: p[i * 3 + 1]!, z: p[i * 3 + 2]! };
      },
      roadPoints: (id: number) => Array.from(data.network.roads[id]!.points),
      nearestRoad: (x: number, z: number) => {
        const n = nearestRoadPoint(data.network, x, z);
        return { roadId: n.road.id, kind: n.road.kind, width: n.road.width, index: n.index, x: n.x, y: n.y, z: n.z, heading: n.heading, distance: n.distance };
      },
      lots: data.lots.map((l) => ({ ...l })),
      lampCount: data.lamps.length,
      get lamps() {
        return game.city.lampMeshes.map((m) => ({ count: m.count, instanced: m.isInstancedMesh === true }));
      },
      get chunks() {
        return {
          loaded: [...game.city.chunks.loaded.keys()].sort((a, b) => a - b),
          maxBuildsInOneFrame: game.city.chunks.maxBuildsInOneFrame,
          builds: game.city.chunks.builds,
        };
      },
      walls: game.physics.walls.map((w) => ({ ...w })),
      get water() {
        const w = game.city.water;
        const m = w.material;
        return {
          y: w.mesh.position.y,
          size: [w.size, w.size],
          roughness: m.roughness,
          metalness: m.metalness,
          hasNormalMap: m.normalMap !== null,
          hasEnvMap: m.envMap !== null,
          offset: m.normalMap ? [m.normalMap.offset.x, m.normalMap.offset.y] : null,
        };
      },
      get waterResets() {
        return game.waterResets;
      },
      get lastWaterReset() {
        return game.lastWaterReset;
      },
    };
  }

  /**
   * Só DEV/testes (facade-glint): cintilação do farol numa fachada do tipo `type`.
   * Pega o lote do centro desse tipo mais próximo do spawn, põe o carro (só a
   * malha, a física não muda) na rua do lote a 12 m da fachada e virado para ela,
   * com a câmera de perseguição atrás. Esconde chuva, partículas e cones, troca o
   * espelho pelo chão escuro, liga/desliga o farol e o antialiasing de especular
   * (`specular: false` zera só o especular das fachadas; `legacyMaterials` usa
   * os materiais de antes da facade-glint) e renderiza 12 quadros andando carro
   * e câmera 0.15 m por quadro, paralelo à fachada. Devolve `flicker` (como `render.shimmer`) e `litMean`, a luminância
   * média do quarto central da tela no primeiro quadro. Restaura tudo no fim.
   */
  probeHeadlightShimmer(type: number, opts: HeadlightShimmerOpts): { flicker: number; litMean: number } {
    const frames = 12;
    const step = 0.15;
    const data = this.city.data;
    const lot = data.lots
      .filter((l) => l.facadeType === type && l.downtown)
      .reduce((best, l) =>
        Math.hypot(l.x - this.spawn.x, l.z - this.spawn.z) < Math.hypot(best.x - this.spawn.x, best.z - this.spawn.z) ? l : best,
      );
    // a rua fica do lado −side·esquerda do centro do lote; esquerda do heading r = (cos r, −sin r)
    const lx = Math.cos(lot.rotation) * lot.side;
    const lz = -Math.sin(lot.rotation) * lot.side;
    const d = lot.depth / 2 + 12;
    const x0 = lot.x - lx * d;
    const z0 = lot.z - lz * d;
    const heading = Math.atan2(lx, lz);
    const alongX = Math.sin(lot.rotation);
    const alongZ = Math.cos(lot.rotation);
    const carNow = this.car.body.translation();
    const rideHeight = carNow.y - heightAt(data.carved, carNow.x, carNow.z);

    const cam = this.chase.camera;
    const camPos = cam.position.clone();
    const camQuat = cam.quaternion.clone();
    const hidden: THREE.Object3D[] = [this.rain.points, ...this.effects.objects, ...this.headlightCones];
    let ground: THREE.Mesh | null = null;
    if (this.city.reflector) {
      hidden.push(this.city.reflector);
      const size = this.city.reflectorSize;
      ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: '#07080d' }));
      ground.rotation.x = -Math.PI / 2;
      this.scene.add(ground);
    }
    const was = hidden.map((o) => o.visible);
    hidden.forEach((o) => (o.visible = false));
    const intensity = this.headlight.intensity;
    this.headlight.intensity = opts.headlight ? intensity : 0;
    const aa = this.city.facadeSpecularAA.value;
    this.city.facadeSpecularAA.value = opts.specularAA ? 1 : 0;
    const spec = this.city.facadeSpecular.value;
    this.city.facadeSpecular.value = opts.specular === false ? 0 : 1;
    // aparência de antes da facade-glint (db836b8): normal map inteiro, metal com metalness 0.5, sem piso de rugosidade
    const floorOf = (m: THREE.MeshStandardMaterial) => m.userData.roughnessFloor as { value: number };
    const look = this.city.facadeMaterials.map((m) => ({
      normalScale: m.normalScale.clone(),
      metalness: m.metalness,
      roughnessFloor: floorOf(m).value,
    }));
    if (opts.legacyMaterials) {
      this.city.facadeMaterials.forEach((m, i) => {
        m.normalScale.set(1, 1);
        m.metalness = i === 1 ? 0.5 : 0.05;
        floorOf(m).value = 0;
      });
    }

    const gl = this.renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    const lum: Float32Array[] = [];
    for (let i = 0; i < frames; i++) {
      const x = x0 + alongX * step * i;
      const z = z0 + alongZ * step * i;
      const y = heightAt(data.carved, x0, z0) + rideHeight;
      this.car.mesh.position.set(x, y, z);
      this.car.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
      const t = chaseTarget({ x, y, z }, heading);
      cam.position.set(t.position.x, t.position.y, t.position.z);
      cam.lookAt(t.lookAt.x, t.lookAt.y, t.lookAt.z);
      cam.updateMatrixWorld();
      this.composer.render(0);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const l = new Float32Array(w * h);
      for (let k = 0; k < w * h; k++) l[k] = (0.2126 * px[4 * k]! + 0.7152 * px[4 * k + 1]! + 0.0722 * px[4 * k + 2]!) / 255;
      lum.push(l);
    }

    this.city.facadeSpecularAA.value = aa;
    this.city.facadeSpecular.value = spec;
    this.city.facadeMaterials.forEach((m, i) => {
      m.normalScale.copy(look[i]!.normalScale);
      m.metalness = look[i]!.metalness;
      floorOf(m).value = look[i]!.roughnessFloor;
    });
    this.headlight.intensity = intensity;
    hidden.forEach((o, i) => (o.visible = was[i]!));
    if (ground) {
      this.scene.remove(ground);
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
    }
    cam.position.copy(camPos);
    cam.quaternion.copy(camQuat);
    cam.updateMatrixWorld();
    this.car.sync();

    let flicker = 0;
    for (let i = 1; i < frames - 1; i++) {
      const a = lum[i - 1]!, b = lum[i]!, c = lum[i + 1]!;
      for (let k = 0; k < w * h; k++) if (Math.abs(c[k]! - 2 * b[k]! + a[k]!) > 0.15) flicker++;
    }
    let litSum = 0;
    let litCount = 0;
    const first = lum[0]!;
    for (let y = Math.floor(h / 4); y < Math.floor((3 * h) / 4); y++) {
      for (let x = Math.floor(w / 4); x < Math.floor((3 * w) / 4); x++) {
        litSum += first[y * w + x]!;
        litCount++;
      }
    }
    return { flicker: flicker / ((frames - 2) * w * h), litMean: litSum / litCount };
  }

  /**
   * Só DEV/testes (C23): vista ortográfica de cima sobre o ponto `index` da
   * estrada `roadId` (chuva, partículas, carro e espelho ocultos), renderizada
   * direto no canvas (com o tone mapping e o sRGB da tela: num render target a
   * noite em cor linear quantiza para preto), cobrindo 24 m na vertical com a
   * estrada na vertical, e lida com `readPixels` no mesmo instante.
   * Devolve a luminância média no centro de um traço da linha central, no
   * centro do vão seguinte, na linha de borda e no meio da faixa, e a
   * distância (m) entre centros de traços consecutivos medida na imagem.
   */
  probeRoadMarks(roadId: number, index: number): { dash: number; gap: number; edge: number; lane: number; spacing: number[] } {
    const road = this.city.data.network.roads[roadId]!;
    const p = road.points;
    const n = p.length / 3;
    const next = Math.min(n - 1, index + 1);
    const prev = Math.max(0, index - 1);
    const h = Math.atan2(p[next * 3]! - p[prev * 3]!, p[next * 3 + 2]! - p[prev * 3 + 2]!);
    const fwd = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
    const left = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
    const center = new THREE.Vector3(p[index * 3]!, p[index * 3 + 1]!, p[index * 3 + 2]!);
    const span = 24;
    const gl = this.renderer.getContext();
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const aspect = W / H;
    const cam = new THREE.OrthographicCamera((-span / 2) * aspect, (span / 2) * aspect, span / 2, -span / 2, 1, 200);
    cam.position.copy(center).add(new THREE.Vector3(0, 60, 0));
    cam.up.copy(fwd);
    cam.lookAt(center);
    cam.updateMatrixWorld();
    const hidden: THREE.Object3D[] = [this.rain.points, ...this.effects.objects, this.car.mesh];
    if (this.city.reflector) hidden.push(this.city.reflector);
    const was = hidden.map((o) => o.visible);
    hidden.forEach((o) => (o.visible = false));
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, cam);
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    hidden.forEach((o, i) => (o.visible = was[i]!));

    const lum = (world: THREE.Vector3): number => {
      const v = world.clone().project(cam);
      const cx = Math.round(((v.x + 1) / 2) * (W - 1));
      const cy = Math.round(((v.y + 1) / 2) * (H - 1));
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = Math.min(W - 1, Math.max(0, cx + dx));
          const y = Math.min(H - 1, Math.max(0, cy + dy));
          const k = (y * W + x) * 4;
          sum += (0.2126 * buf[k]! + 0.7152 * buf[k + 1]! + 0.0722 * buf[k + 2]!) / 255;
          count++;
        }
      }
      return sum / count;
    };
    // ao longo: alongM = índice × 2; traço em [6k, 6k + 3), centro em 6k + 1.5
    const along0 = index * 2;
    const dashAlong = Math.ceil((along0 - 1.5) / 6) * 6 + 1.5;
    const at = (alongM: number, lateral: number) =>
      center.clone().addScaledVector(fwd, alongM - along0).addScaledVector(left, lateral).setY(center.y + 0.05);
    const w2 = road.width / 2;
    const result = {
      dash: lum(at(dashAlong, 0)),
      gap: lum(at(dashAlong + 3, 0)),
      edge: lum(at(dashAlong, w2 - 0.45)),
      lane: lum(at(dashAlong, w2 / 2)),
      spacing: [] as number[],
    };
    // varre o eixo na imagem, acha os traços (acima do meio entre traço e vão) e mede os centros
    const threshold = (result.dash + result.gap) / 2;
    const centers: number[] = [];
    let start: number | null = null;
    for (let a = along0 - 10; a <= along0 + 10; a += 0.05) {
      const bright = lum(at(a, 0)) > threshold;
      if (bright && start === null) start = a;
      if (!bright && start !== null) {
        if (start > along0 - 10) centers.push((start + a) / 2);
        start = null;
      }
    }
    for (let i = 1; i < centers.length; i++) result.spacing.push(centers[i]! - centers[i - 1]!);
    return result;
  }
}
