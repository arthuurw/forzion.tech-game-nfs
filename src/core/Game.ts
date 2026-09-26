import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { blurFor } from '../camera/chaseMath';
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
import { generateCity } from '../world/CityGenerator';
import { CityScene } from '../world/CityScene';
import { addNightLights, createNightEnvironment } from '../world/Environment';
import { GameLoop } from './GameLoop';
import { InputManager } from './InputManager';
import type { Assets } from './Loader';

/**
 * Raiz de composição: cria mundo físico, cena, carro, câmera, HUD e áudio, e
 * liga tudo ao `GameLoop`. É o único lugar que conhece todos os módulos.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly world: RAPIER.World;
  readonly city: CityScene;
  readonly car: Car;
  readonly chase: ChaseCamera;
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly gtao: GTAOPass | null;
  readonly grade: ShaderPass;
  readonly gtaoClipBox = new THREE.Box3();
  readonly rain: Rain;
  readonly effects: Effects;
  readonly headlightCones: THREE.Mesh[] = [];
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

    const layout = generateCity();
    this.city = new CityScene(layout, this.scene, this.world, assets, quality);
    this.car = new Car(this.world, this.scene, assets, { x: 0, y: 1.2, z: 0 });

    // farol: única luz presa ao carro
    const headlight = new THREE.SpotLight('#dfe8ff', 40, 60, Math.PI / 5, 0.6, 1.2);
    headlight.position.set(0, 0.6, 1.8);
    headlight.target.position.set(0, -0.5, 20);
    this.car.mesh.add(headlight, headlight.target);

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

    // o reflexo da rua não precisa de partículas, cones e faixas: menos draw calls no espelho
    const reflector = this.city.reflector;
    if (reflector) {
      const skip: THREE.Object3D[] = [this.rain.points, ...this.effects.objects, ...this.headlightCones, this.city.laneMarks];
      const renderMirror = reflector.onBeforeRender.bind(reflector);
      reflector.onBeforeRender = (...args: Parameters<typeof reflector.onBeforeRender>) => {
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
        new THREE.Vector3(-layout.bounds - 20, -1, -layout.bounds - 20),
        new THREE.Vector3(layout.bounds + 20, 70, layout.bounds + 20),
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
    this.minimap = new Minimap(minimapCanvas, layout);

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
        ...game.city.layout,
        get facadeMeshes() {
          return game.city.facadeMeshes.map((mesh, i) => {
            const aRepeat = mesh.geometry.getAttribute('aRepeat') as THREE.InstancedBufferAttribute;
            const aSeed = mesh.geometry.getAttribute('aSeed') as THREE.InstancedBufferAttribute;
            const b = game.city.facadeBuildings[i]![0];
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
        get laneMarkCount() {
          return game.city.laneMarkCount;
        },
      },
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
            repeat: m.map ? m.map.repeat.x : null,
            mapSrc: ((m.map?.image as { currentSrc?: string; src?: string } | undefined)?.currentSrc ??
              (m.map?.image as { src?: string } | undefined)?.src ?? null),
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
          if (!r) return { present: false, size: null, y: null };
          const rt = r.getRenderTarget();
          return { present: game.scene.getObjectById(r.id) !== undefined, size: [rt.width, rt.height], y: r.position.y };
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
}

