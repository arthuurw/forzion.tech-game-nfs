import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
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

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement, assets: Assets, onFirstFrame: () => void) {
    this.onFirstFrame = onFirstFrame;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.info.autoReset = false; // contamos draw calls de todos os passes por frame

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;

    createNightEnvironment(this.renderer, this.scene);
    addNightLights(this.scene);

    const layout = generateCity();
    this.city = new CityScene(layout, this.scene, this.world);
    this.car = new Car(this.world, this.scene, assets, { x: 0, y: 1.2, z: 0 });

    // farol: única luz presa ao carro
    const headlight = new THREE.SpotLight('#dfe8ff', 40, 60, Math.PI / 5, 0.6, 1.2);
    headlight.position.set(0, 0.6, 1.8);
    headlight.target.position.set(0, -0.5, 20);
    this.car.mesh.add(headlight, headlight.target);

    this.chase = new ChaseCamera(window.innerWidth / window.innerHeight);
    this.chase.snapTo(this.car.state());

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.chase.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.4, 0.7);
    this.composer.addPass(this.bloom);
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
    this.car.fixedUpdate(
      { throttle: s.throttle, brake: s.brake, steer: steerAxis(s), handbrake: s.handbrake },
      dt,
    );
    this.world.step();
    this.simTime += dt;
  };

  private readonly render = (dt: number): void => {
    this.car.sync();
    const state = this.car.state();
    this.chase.update(dt, state);
    this.hud.update(state);
    this.minimap.update(state);
    this.audio.setRpm(state.rpm);

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
      city: game.city.layout,
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
        placeholder: game.car.placeholder,
        teleport: (x: number, y: number, z: number, heading: number) => game.car.teleport(x, y, z, heading),
        setRotation: (q: { x: number; y: number; z: number; w: number }) => game.car.setRotation(q),
      },
      render: {
        get calls() {
          return game.drawCalls;
        },
      },
      materials: {
        get roadRoughness() {
          return game.city.roadMaterial.roughness;
        },
        get windowEmissiveIntensity() {
          return game.city.windowMaterial.emissiveIntensity;
        },
        get signEmissiveIntensities() {
          return game.city.signMaterials.map((m) => m.emissiveIntensity);
        },
      },
      scene: {
        get hasEnvironment() {
          return game.scene.environment !== null;
        },
      },
      composer: {
        get passes() {
          return game.composer.passes.map((p) => p.constructor.name);
        },
        get bloomEnabled() {
          return game.bloom.enabled;
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
      },
    };
  }
}
