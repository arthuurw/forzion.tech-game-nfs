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
import { RaceController } from '../race/RaceController';
import { Car } from '../vehicle/Car';
import { DEFAULT_CAR } from '../vehicle/carSpec';
import { steerAxis } from './input';
import { DEFAULT_SEED } from '../world/CityGenerator';
import { CityScene, type WorldData } from '../world/CityScene';
import { generateLots } from '../world/lots/LotGenerator';
import { generateRoads, type Road } from '../world/roads/RoadGenerator';
import { generateLamps, lampHeadPosition } from '../world/roads/roadMesh';
import { carveRoads } from '../world/terrain/carveRoads';
import { generateTerrain, heightAt, riverCenterX } from '../world/terrain/TerrainGenerator';
import { WorldPhysics } from '../world/WorldPhysics';
import { findBlockInteriors } from '../world/interiors/BlockInteriors';
import { FLOOD_REACH, placeInteriorProps } from '../world/interiors/InteriorProps';
import { SEARCHLIGHT_TILT } from '../world/interiors/interiorMotion';
import { buildTrainLine, type TrainLine } from '../world/rail/trainLine';
import { TrainScene } from '../world/rail/TrainScene';
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
  /** linha do trem elevado e seu render (block-life-extras); `null` se uma avenida do quadrado falta */
  readonly train: TrainLine | null;
  readonly trainScene: TrainScene | null;
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
  /** corridas (races): marcadores, sessão, oponentes e HUD de corrida */
  readonly race: RaceController;
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
    // block-fill: miolo das quadras (door 1) e o que existe nele (door 2), do mesmo seed
    const interiors = findBlockInteriors(carved, network, lots);
    const props = placeInteriorProps(seed, interiors, lots, carved);
    const data: WorldData = { seed, raw, carved, network, lots, signs, lamps, interiors, props };
    // block-life-extras: a linha do trem sai da rede por regra (door 2); colunas viram colliders
    this.train = buildTrainLine(network);
    this.physics = new WorldPhysics(this.world, carved, raw, network, lots, props, this.train);
    this.city = new CityScene(data, this.scene, assets, quality);
    this.trainScene = this.train ? new TrainScene(this.train, carved) : null;
    if (this.trainScene) this.scene.add(this.trainScene.group);

    // spawn: parado numa avenida do centro, alinhado a ela, 12 m antes do cruzamento
    // central (AC 33): à frente e à esquerda há pista livre (a avenida transversal)
    const spawn = centralSpawn(network.roads);
    this.spawn = spawn;
    this.car = new Car(this.world, this.scene, assets, { x: spawn.x, y: spawn.y + 1.2, z: spawn.z }, DEFAULT_CAR);
    this.car.teleport(spawn.x, spawn.y + 1.2, spawn.z, spawn.heading);
    this.city.chunks.update(spawn.x, spawn.z);
    this.city.chunks.endFrame(); // o build do boot não conta como quadro

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
        const skip = this.reflectorSkipList();
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
    this.race = new RaceController(this.world, this.scene, assets, network, hudRoot);

    this.input.setFirstKeyHandler(() => this.audio.start());
    // na corrida, R volta ao último portão (races AC 27); no free roam desvira no lugar
    this.input.onPress('KeyR', () => {
      if (!this.race.resetPlayer(this.car)) this.car.reset();
    });
    this.input.onPress('Enter', () => this.race.enter(this.car));
    this.input.onPress('Escape', () => this.race.escape());
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
      this.race.playerInput({ throttle: s.throttle, brake: s.brake, steer: steerAxis(s), handbrake: s.handbrake }),
      dt,
    );
    this.race.beforeStep(dt);
    this.world.step(this.eventQueue);
    this.simTime += dt;
    this.race.afterStep(dt, this.car);
    // pedestres do miolo (block-fill): sem collider, só leem a posição do carro
    const carNow = this.car.body.translation();
    this.city.interiors.stepWalkers(dt, { x: carNow.x, z: carNow.z }, this.simTime);

    // caiu na água (door 9): volta em pé, parado, 1 m acima do ponto de estrada mais próximo
    const pos = this.car.body.translation();
    // na corrida, a água leva ao último portão (races AC 28) e não conta como reset na água
    if (needsWaterReset(pos.y) && !this.race.resetPlayer(this.car)) {
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
    const chassis = this.car.chassisCollider.handle;
    this.eventQueue.drainContactForceEvents((event) => {
      // só as batidas do carro do jogador (os oponentes também geram eventos)
      if (event.collider1() !== chassis && event.collider2() !== chassis) return;
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
    this.chase.update(dt, state, this.car.yawRate(), this.car.bodyRoll);
    this.city.chunks.update(state.x, state.z);
    this.city.chunks.endFrame();
    this.city.water.update(this.simTime);
    this.city.interiors.update(this.simTime);
    this.trainScene?.update(this.simTime);
    this.city.interiors.follow(state.x, state.z);
    this.rain.update(this.simTime, { x: state.x, y: state.y, z: state.z });
    this.effects.render();
    this.city.signMaterials.forEach((m, i) => {
      m.emissiveIntensity = flickerIntensity(this.simTime, i);
    });
    (this.grade.uniforms.uBlur as { value: number }).value = blurFor(state.speedKmh);
    this.hud.update(state);
    this.minimap.update(state, this.race.render(state));
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
      /** só DEV (races): corridas, sessão, oponentes, portão e sondas das provas */
      race: {
        get state() {
          return game.race.session.state;
        },
        get raceId() {
          return game.race.race?.id ?? null;
        },
        get races() {
          return game.race.races.map((r) => ({
            id: r.id,
            name: r.name,
            kind: r.kind,
            laps: r.laps,
            marker: { ...r.marker },
            gates: r.gates.map((g) => ({ ...g })),
            grid: r.grid.map((g) => ({ ...g })),
          }));
        },
        get markers() {
          const visible = game.race.objects()[0]!.visible;
          return game.race.races.map((r) => ({ ...r.marker, visible }));
        },
        get prompt() {
          return game.race.prompt;
        },
        get time() {
          return game.race.time;
        },
        get player() {
          return { ...game.race.player, position: game.race.position() };
        },
        get opponents() {
          return game.race.opponents.map((o) => {
            const p = o.car.body.translation();
            return {
              index: o.index,
              position: { x: p.x, y: p.y, z: p.z },
              speedKmh: o.car.speedKmh(),
              paint: o.car.paint,
              bodyColor: o.car.bodyColor(),
              materialColor: o.car.paintMaterial ? `#${o.car.paintMaterial.color.getHexString()}` : null,
              resets: o.resets,
              progress: { ...o.progress },
              prev: { ...o.prev },
            };
          });
        },
        /** block-life-extras C3: cor média do teto da carroceria do oponente `i` (−1 = jogador) na tela */
        bodyProbe: (i: number) => game.probeBody(i),
        get gate() {
          const m = game.race.gateMesh;
          return { visible: m.visible, x: m.position.x, y: m.position.y, z: m.position.z, height: m.scale.y };
        },
        get visibleGates() {
          let n = 0;
          game.scene.traverseVisible((o) => {
            if (o.name === 'race-gate') n++;
          });
          return n;
        },
        get bodies() {
          return game.world.bodies.len();
        },
        /** malhas de carro (`car`) na cena: o jogador e os oponentes */
        get carsInScene() {
          return game.scene.children.filter((o) => o.name === 'car').length;
        },
        crossNextGate: () => game.race.crossNextGate(game.car),
        /** põe um oponente em (x, y, z), parado (para as provas do minimapa) */
        placeOpponent: (i: number, x: number, y: number, z: number, heading: number) =>
          game.race.opponents[i]?.placeAt(x, y, z, heading),
        /** test-hardening C24: segura a contagem em `countdown` */
        set holdCountdown(on: boolean) {
          game.race.holdCountdown = on;
        },
      },
      get simTime() {
        return game.simTime;
      },
      get frames() {
        return game.frames;
      },
      city: {
        seed: game.city.data.seed,
        /** Por malha de fachada, por instância: [y mínimo, y máximo, x, z] da caixa depois da matriz (C33). */
        facadeSpans() {
          const m = new THREE.Matrix4();
          const v = new THREE.Vector3();
          return game.city.facadeMeshes.map((mesh) => {
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
            const b = mesh.geometry.boundingBox!;
            const out: number[][] = [];
            for (let i = 0; i < mesh.count; i++) {
              mesh.getMatrixAt(i, m);
              let lo = Infinity;
              let hi = -Infinity;
              for (const x of [b.min.x, b.max.x]) {
                for (const y of [b.min.y, b.max.y]) {
                  for (const z of [b.min.z, b.max.z]) {
                    v.set(x, y, z).applyMatrix4(m);
                    lo = Math.min(lo, v.y);
                    hi = Math.max(hi, v.y);
                  }
                }
              }
              v.setFromMatrixPosition(m);
              out.push([lo, hi, v.x, v.z]);
            }
            return out;
          });
        },
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
        /** ficha técnica com que o carro foi construído (car-handling door 1) */
        spec: game.car.spec,
        /** ângulo atual das rodas dianteiras depois da rampa do volante (rad) */
        get steerInput() {
          return game.car.steerInput;
        },
        get bodyRoll() {
          return game.car.bodyRoll;
        },
        get bodyPitch() {
          return game.car.bodyPitch;
        },
        get sideslip() {
          return game.car.sideslip;
        },
        get lateralG() {
          return game.car.lateralG;
        },
        /** torque da ajuda de giro no último passo (N·m, eixo Y do mundo; yaw-assist) */
        get yawAssistNm() {
          return game.car.yawAssistNm;
        },
        /** força de curva no último passo (N, positiva = esquerda do carro; corner-assist) */
        get cornerAssistN() {
          return game.car.cornerAssistN;
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
        /** ponto do mundo em pixels do canvas pela câmera de perseguição (sondas) */
        project: (x: number, y: number, z: number) => game.toPixel(x, y, z),
        /** nomes de tudo que o espelho da rua pula (block-life-extras C35), com os filhos dos grupos */
        get reflectorSkipped() {
          const names: string[] = [];
          for (const o of game.reflectorSkipList()) o.traverse((c) => c.name && names.push(c.name));
          return names;
        },
        get calls() {
          return game.drawCalls;
        },
        /**
         * só DEV/testes (night-city C9-C11): uma esfera brilhante de 0.25 m a `d` m à frente da
         * câmera, 1.5 m acima do asfalto do centro, com o carro do jogador escondido (o reflexo perto
         * cairia atrás dele) e sem bloom (o halo da esfera escorreria para baixo do ponto do chão). Renderiza com e sem ela e devolve a caixa dos
         * pixels que mudaram mais de 25 % do pico (e > 0.01) abaixo do ponto do chão sob a esfera (`w`, `h`:
         * o reflexo) e a altura da própria esfera projetada na tela (`srcH`), em pixels.
         * `mirrorBlur: false` mede com o espelho de uma amostra.
         */
        mirrorStreak: (d: number, opts: { mirrorBlur?: boolean } = {}) => {
          const restoreBlur = game.setMirrorBlur(opts.mirrorBlur);
          const cam = game.chase.camera;
          const dir = new THREE.Vector3();
          cam.getWorldDirection(dir);
          dir.y = 0;
          dir.normalize();
          const at = cam.position.clone().addScaledVector(dir, d);
          const ball = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 16, 8),
            new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveIntensity: 3 }),
          );
          ball.position.set(at.x, 1.5, at.z);
          const hidden: THREE.Object3D[] = [game.rain.points, ...game.effects.objects, game.car.mesh];
          const was = hidden.map((o) => o.visible);
          hidden.forEach((o) => (o.visible = false));
          const gl = game.renderer.getContext();
          const w = gl.drawingBufferWidth;
          const h = gl.drawingBufferHeight;
          const grab = (): Float32Array => {
            game.composer.render(0);
            const px = new Uint8Array(w * h * 4);
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
            const l = new Float32Array(w * h);
            for (let k = 0; k < w * h; k++) l[k] = (0.2126 * px[4 * k]! + 0.7152 * px[4 * k + 1]! + 0.0722 * px[4 * k + 2]!) / 255;
            return l;
          };
          const bloomWas = game.bloom.enabled;
          game.bloom.enabled = false;
          const without = grab();
          game.scene.add(ball);
          const withBall = grab();
          game.scene.remove(ball);
          game.bloom.enabled = bloomWas;
          ball.geometry.dispose();
          (ball.material as THREE.Material).dispose();
          hidden.forEach((o, i) => (o.visible = was[i]!));
          restoreBlur();
          const gy = game.toPixel(at.x, 0, at.z).py;
          const box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
          // limiar relativo ao pico do reflexo: mede a forma da mancha, não o quanto ela brilha
          let peak = 0;
          for (let y = 0; y < Math.min(h, gy - 1); y++) {
            for (let x = 0; x < w; x++) peak = Math.max(peak, withBall[y * w + x]! - without[y * w + x]!);
          }
          const cut = Math.max(0.01, 0.25 * peak);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const k = y * w + x;
              if (withBall[k]! - without[k]! <= cut) continue;
              if (y >= gy - 1) continue;
              box.x0 = Math.min(box.x0, x);
              box.x1 = Math.max(box.x1, x);
              box.y0 = Math.min(box.y0, y);
              box.y1 = Math.max(box.y1, y);
            }
          }
          const found = box.x1 >= box.x0;
          return {
            w: found ? box.x1 - box.x0 + 1 : 0,
            h: found ? box.y1 - box.y0 + 1 : 0,
            srcH: game.toPixel(at.x, 1.75, at.z).py - game.toPixel(at.x, 1.25, at.z).py + 1,
          };
        },
        /**
         * só DEV/testes (night-city C6): um quadro pelo composer, sem chuva nem partículas, e a
         * luminância média 3 × 3 em volta de cada ponto do mundo projetado na tela (null se atrás).
         */
        lumAt: (points: Array<{ x: number; y: number; z: number }>): Array<number | null> => {
          const hidden: THREE.Object3D[] = [game.rain.points, ...game.effects.objects];
          const was = hidden.map((o) => o.visible);
          hidden.forEach((o) => (o.visible = false));
          game.composer.render(0);
          const gl = game.renderer.getContext();
          const px = new Uint8Array(9 * 4);
          const out = points.map((p) => {
            const s = game.toPixel(p.x, p.y, p.z);
            if (!s.front) return null;
            gl.readPixels(s.px - 1, s.py - 1, 3, 3, gl.RGBA, gl.UNSIGNED_BYTE, px);
            let sum = 0;
            for (let k = 0; k < 9; k++) sum += (0.2126 * px[4 * k]! + 0.7152 * px[4 * k + 1]! + 0.0722 * px[4 * k + 2]!) / 255;
            return sum / 9;
          });
          hidden.forEach((o, i) => (o.visible = was[i]!));
          return out;
        },
        /**
         * só DEV/testes: cintilação com a câmera andando. Renderiza `frames` quadros
         * avançando a câmera `step` m para a frente por quadro (chuva e partículas
         * escondidas, cena parada) e devolve a fração de pixels cuja luminância tem
         * segunda diferença no tempo acima de 0.15. Movimento suave dá ~0; um padrão
         * que muda de pixel para pixel a cada quadro dá valores altos.
         * `mirror: false` troca o reflexo da rua pelo chão escuro do modo `low`
         * (sem chão, o centro vira um buraco e as bordas contra o fundo cintilam),
         * para medir só as fachadas. `mirrorBlur: false` zera o blur do espelho durante a
         * medida (o shader de uma amostra de antes da residuals).
         */
        shimmer: (step: number, opts: { frames?: number; mirror?: boolean; mirrorBlur?: boolean } = {}): number => {
          const frames = opts.frames ?? 10;
          const restoreBlur = game.setMirrorBlur(opts.mirrorBlur);
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
          restoreBlur();
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
        /**
         * só DEV/testes (residuals C4): brilho que o espelho soma à rua. Luminância média da
         * metade de baixo do quadro com o espelho, menos a mesma área com o chão escuro do
         * modo `low` no lugar dele, na pose atual da câmera (chuva e partículas escondidas).
         */
        mirrorGain: (opts: { mirrorBlur?: boolean } = {}): number => {
          const r = game.city.reflector;
          if (!r) return 0;
          const restoreBlur = game.setMirrorBlur(opts.mirrorBlur);
          const hidden: THREE.Object3D[] = [game.rain.points, ...game.effects.objects];
          const was = hidden.map((o) => o.visible);
          hidden.forEach((o) => (o.visible = false));
          const gl = game.renderer.getContext();
          const w = gl.drawingBufferWidth;
          const h = gl.drawingBufferHeight;
          const rows = Math.floor(h / 2);
          const px = new Uint8Array(w * rows * 4);
          const meanLum = (): number => {
            game.composer.render(0);
            gl.readPixels(0, 0, w, rows, gl.RGBA, gl.UNSIGNED_BYTE, px);
            let sum = 0;
            for (let k = 0; k < w * rows; k++) sum += (0.2126 * px[4 * k]! + 0.7152 * px[4 * k + 1]! + 0.0722 * px[4 * k + 2]!) / 255;
            return sum / (w * rows);
          };
          const withMirror = meanLum();
          const size = game.city.reflectorSize;
          const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: '#07080d' }));
          ground.rotation.x = -Math.PI / 2;
          game.scene.add(ground);
          r.visible = false;
          const without = meanLum();
          r.visible = true;
          game.scene.remove(ground);
          ground.geometry.dispose();
          (ground.material as THREE.Material).dispose();
          hidden.forEach((o, i) => (o.visible = was[i]!));
          restoreBlur();
          return withMirror - without;
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
        /** inclinação atual da câmera (rad), car-feel AC 14 */
        get roll() {
          return game.chase.roll;
        },
        /** direção de visão (`getWorldDirection`), para provar que inclinar não muda para onde a câmera olha */
        get direction() {
          const d = game.chase.camera.getWorldDirection(new THREE.Vector3());
          return { x: d.x, y: d.y, z: d.z };
        },
        /** "cima" da câmera no mundo (`up` local pelo quaternion), para provar que a câmera inclina de fato */
        get up() {
          const q = game.chase.camera.getWorldQuaternion(new THREE.Quaternion());
          const u = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
          return { x: u.x, y: u.y, z: u.z };
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
            // residuals S1: blur do shader do espelho, em texels do alvo, e o texel que ele usa
            blur: (r.material as THREE.ShaderMaterial).uniforms.uBlur!.value as number,
            texel: [
              ((r.material as THREE.ShaderMaterial).uniforms.uTexel!.value as THREE.Vector2).x,
              ((r.material as THREE.ShaderMaterial).uniforms.uTexel!.value as THREE.Vector2).y,
            ],
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
        return game.city.lampMeshes.map((m) => {
          const b = m.geometry.boundingBox!;
          return { count: m.count, instanced: m.isInstancedMesh === true, width: b.max.x - b.min.x, depth: b.max.z - b.min.z };
        });
      },
      /** night-city C8: cor da luz do poste `i` (atributo por instância), com os dados dele */
      lampAt: (i: number) => {
        const lamp = data.lamps[i]!;
        const c = game.city.lampMeshes[0]!.geometry.getAttribute('aLampColor') as THREE.InstancedBufferAttribute;
        const hex = '#' + [c.getX(i), c.getY(i), c.getZ(i)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
        return { x: lamp.x, y: lamp.y, z: lamp.z, heading: lamp.heading, side: lamp.side, kind: data.network.roads[lamp.roadId]!.kind, color: hex, head: lampHeadPosition(lamp) };
      },
      /** night-city C29: o mapa de luz dos postes em cada material de chão */
      get lampLight() {
        const t = game.city.lampLight;
        const read = (m: THREE.Material) => (m.userData.lampLight?.uLampLight.value as THREE.Texture | undefined)?.uuid ?? null;
        return {
          uuid: t.uuid,
          width: t.image.width,
          height: t.image.height,
          linear: t.magFilter === THREE.LinearFilter && t.minFilter === THREE.LinearFilter,
          mipmaps: t.generateMipmaps,
          materials: {
            roadDowntown: read(game.city.roadMaterial),
            roadOuter: read(game.city.roadOuterMaterial),
            sidewalk: read(game.city.sidewalkMaterial),
            terrain: read(game.city.terrainMaterial),
          },
        };
      },
      get chunks() {
        return {
          loaded: [...game.city.chunks.loaded.keys()].sort((a, b) => a - b),
          maxBuildsInOneFrame: game.city.chunks.maxBuildsInOneFrame,
          builds: game.city.chunks.builds,
          dropped: game.city.chunks.dropped.map((d) => ({ ...d })),
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
      interiors: game.interiorsDebug(),
      extras: game.extrasDebug(),
      get lastWaterReset() {
        return game.lastWaterReset;
      },
    };
  }

  /** O que o espelho da rua não reflete: partículas, cones, água, chunks de fora, miolo, corrida e trem. */
  private reflectorSkipList(): THREE.Object3D[] {
    return [
      this.rain.points,
      ...this.effects.objects,
      ...this.headlightCones,
      this.city.water.mesh,
      ...this.city.chunks.outerObjects(),
      ...this.city.interiors.objects(),
      ...this.race.objects(),
      ...(this.trainScene?.objects() ?? []),
    ];
  }

  /** Cor média de 9 × 9 px em torno de (px, py) do canvas, lida do último render. */
  private readPatch(px: number, py: number): { r: number; g: number; b: number; luminance: number; onScreen: boolean } {
    const gl = this.renderer.getContext();
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const onScreen = px >= 4 && px <= W - 5 && py >= 4 && py <= H - 5;
    const buf = new Uint8Array(9 * 9 * 4);
    gl.readPixels(Math.min(W - 9, Math.max(0, px - 4)), Math.min(H - 9, Math.max(0, py - 4)), 9, 9, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let r = 0;
    let g = 0;
    let b = 0;
    for (let k = 0; k < 81; k++) {
      r += buf[k * 4]!;
      g += buf[k * 4 + 1]!;
      b += buf[k * 4 + 2]!;
    }
    r /= 81 * 255;
    g /= 81 * 255;
    b /= 81 * 255;
    return { r, g, b, luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b, onScreen };
  }

  /** Ponto do mundo projetado na câmera de perseguição, em pixels do canvas (y para cima), e se está na frente da câmera. */
  private toPixel(x: number, y: number, z: number): { px: number; py: number; front: boolean } {
    const gl = this.renderer.getContext();
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const v = new THREE.Vector3(x, y, z).project(this.chase.camera);
    return { px: Math.round(((v.x + 1) / 2) * (W - 1)), py: Math.round(((v.y + 1) / 2) * (H - 1)), front: v.z < 1 && v.z > -1 };
  }

  /**
   * Só DEV (block-life-extras C18): um quadro pelo composer com a câmera como está e a
   * luminância média 1 m acima da grade `i` (`over`) e num ponto na mesma altura a 6 m de
   * lado, de través à câmera (`aside`).
   */
  probeSteam(i: number): { over: number; aside: number; onScreen: boolean } {
    const v = this.city.interiors.props.vents[i]!;
    this.composer.render(0);
    const cam = this.chase.camera;
    // de través: perpendicular à direção câmera → grade, no plano xz
    const dx = v.x - cam.position.x;
    const dz = v.z - cam.position.z;
    const l = Math.hypot(dx, dz) || 1;
    const a = this.toPixel(v.x, v.y + 1, v.z);
    const b = this.toPixel(v.x + (dz / l) * 6, v.y + 1, v.z - (dx / l) * 6);
    const over = this.readPatch(a.px, a.py);
    const aside = this.readPatch(b.px, b.py);
    return { over: over.luminance, aside: aside.luminance, onScreen: a.front && b.front && over.onScreen && aside.onScreen };
  }

  /**
   * Só DEV (block-life-extras C22): um quadro pelo composer com a câmera como está;
   * procura ao longo do facho `i`, de 30 a 300 m da base a cada 10 m, entre os pontos
   * projetados dentro da tela com 40 px de margem horizontal e 8 px vertical, o ponto
   * em que os fachos mais clareiam, e devolve a luminância média nele (`beam`), 40 px
   * ao lado (`sky`) e no mesmo ponto com os fachos escondidos (`without`), ou `null`.
   */
  probeSearchlight(i: number): { beam: number; sky: number; without: number; distance: number } | null {
    const it = this.city.interiors;
    const s = it.props.searchlights[i]!;
    const h = it.searchlightHeadings[i]!;
    const tilt = (SEARCHLIGHT_TILT * Math.PI) / 180;
    const dir = { x: Math.sin(tilt) * Math.sin(h), y: Math.cos(tilt), z: Math.sin(tilt) * Math.cos(h) };
    const gl = this.renderer.getContext();
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    // dois quadros inteiros, com e sem os fachos; as leituras vêm deles
    const frame = () => {
      this.composer.render(0);
      const buf = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return buf;
    };
    const withBeams = frame();
    it.searchlightMesh.visible = false;
    const without = frame();
    it.searchlightMesh.visible = true;
    const patch = (buf: Uint8Array, px: number, py: number): number => {
      let sum = 0;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const k = (Math.min(H - 1, Math.max(0, py + dy)) * W + Math.min(W - 1, Math.max(0, px + dx))) * 4;
          sum += (0.2126 * buf[k]! + 0.7152 * buf[k + 1]! + 0.0722 * buf[k + 2]!) / 255;
        }
      }
      return sum / 81;
    };
    // o ponto do facho dentro do quadro onde os fachos mais clareiam (perto da base o próprio telhado esconde o facho)
    let best: { beam: number; sky: number; without: number; distance: number } | null = null;
    for (let d = 30; d <= 300; d += 10) {
      const p = this.toPixel(s.x + dir.x * d, s.y + dir.y * d, s.z + dir.z * d);
      if (!p.front || p.px < 40 || p.px > W - 41 || p.py < 8 || p.py > H - 9) continue;
      const beam = patch(withBeams, p.px, p.py);
      const bare = patch(without, p.px, p.py);
      const sky = patch(withBeams, p.px + (p.px + 40 <= W - 5 ? 40 : -40), p.py);
      if (!best || beam - bare > best.beam - best.without) best = { beam, sky, without: bare, distance: d };
    }
    return best;
  }

  /** Só DEV: pixels do quadro que mudam quando os fachos somem, e a maior diferença de luminância. */
  private searchlightFrameDiff(): { changed: number; maxDiff: number; total: number } {
    const it = this.city.interiors;
    const gl = this.renderer.getContext();
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const read = () => {
      this.composer.render(0);
      const buf = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return buf;
    };
    const withBeams = read();
    it.searchlightMesh.visible = false;
    const without = read();
    it.searchlightMesh.visible = true;
    let changed = 0;
    let maxDiff = 0;
    for (let k = 0; k < W * H; k++) {
      const a = (0.2126 * withBeams[k * 4]! + 0.7152 * withBeams[k * 4 + 1]! + 0.0722 * withBeams[k * 4 + 2]!) / 255;
      const b = (0.2126 * without[k * 4]! + 0.7152 * without[k * 4 + 1]! + 0.0722 * without[k * 4 + 2]!) / 255;
      const d = Math.abs(a - b);
      if (d > 1 / 255) changed++;
      if (d > maxDiff) maxDiff = d;
    }
    return { changed, maxDiff, total: W * H };
  }

  /** `__game.world.extras` (só DEV): estacionados, vapor, gatos, holofotes e trem (block-life-extras). */
  private extrasDebug(): unknown {
    const it = this.city.interiors;
    const game = this;
    const train = this.trainScene;
    return {
      parking: {
        get count() {
          return it.props.parking.length;
        },
        meshName: it.parkedMesh.name,
        get instanceCount() {
          return it.parkedMesh.count;
        },
        placeholder: it.parkedPlaceholder,
        colorAt: (i: number) => {
          const c = new THREE.Color();
          it.parkedMesh.getColorAt(i, c);
          return `#${c.getHexString()}`;
        },
        list: () => it.props.parking.map((p) => ({ ...p })),
      },
      steam: {
        name: it.steam.name,
        get points() {
          return it.steam.geometry.getAttribute('position').count;
        },
        get uTime() {
          return it.steamMaterial.uniforms.uTime!.value as number;
        },
        perVent: it.steamPerVent,
        vents: () => it.props.vents.map((v) => ({ ...v })),
      },
      cats: {
        name: it.catMesh.name,
        vertices: it.catMesh.geometry.getAttribute('position').count,
        get active() {
          return it.cats.filter((c) => c.state !== 'gone').length;
        },
        cap: it.catCap,
        spawns: () => it.props.cats.map((c) => ({ ...c })),
      },
      searchlights: {
        name: it.searchlightMesh.name,
        count: it.searchlightMesh.count,
        additive: (it.searchlightMesh.material as THREE.Material).blending === THREE.AdditiveBlending,
        get headings() {
          return [...it.searchlightHeadings];
        },
        list: it.props.searchlights.map((s) => ({ ...s })),
        /** sondas: esconde os fachos ou muda a opacidade do cone */
        setVisible: (on: boolean) => {
          it.searchlightMesh.visible = on;
        },
        setOpacity: (v: number) => {
          (it.searchlightMesh.material as THREE.MeshBasicMaterial).opacity = v;
        },
        /** quantos pixels do último quadro mudam quando os fachos somem, e a maior diferença de luminância */
        frameDiff: () => game.searchlightFrameDiff(),
      },
      train: train
        ? {
            lineMesh: train.lineMesh.name,
            lineInstanced: (train.lineMesh as THREE.Object3D as { isInstancedMesh?: boolean }).isInstancedMesh === true,
            name: train.wagons.name,
            count: train.wagons.count,
            windowEmissive: train.windowMaterial.emissiveIntensity,
            length: train.line.length,
            frames: train.line.frames.length,
            get s() {
              return [...train.s];
            },
          }
        : null,
      steamProbe: (i: number) => game.probeSteam(i),
      beamProbe: (i: number) => game.probeSearchlight(i),
    };
  }

  /** `__game.world.interiors` (só DEV): miolo das quadras, contagens e sondas (block-fill). */
  private interiorsDebug(): unknown {
    const game = this;
    const bi = this.city.data.interiors;
    const props = this.city.data.props;
    const scene = this.city.interiors;
    return {
      summary() {
        return {
          zones: bi.zones.length,
          downtown: bi.zones.filter((z) => z.kind === 'downtown').length,
          outer: bi.zones.filter((z) => z.kind === 'outer').length,
          yards: props.yards.length,
          pools: props.pools.length,
          trees: props.trees.length,
          sites: props.sites.length,
          fireflies: scene.fireflyCount,
          walkersActive: scene.walkers.length,
        };
      },
      zones: bi.zones.map((z) => ({ ...z, centroid: { ...z.centroid }, bbox: { ...z.bbox } })),
      spacing: bi.spacing,
      origin: bi.origin,
      size: bi.size,
      /** zona e distância à fachada do vértice (ix, iz) */
      cell: (ix: number, iz: number) => ({ zoneOf: bi.zoneOf[iz * bi.size + ix]!, facadeDist: bi.facadeDist[iz * bi.size + ix]! }),
      /** o que a malha de terreno carregada guarda no vértice (ix, iz): cor, peso da luz rebatida e zona; null se o chunk não está carregado */
      terrainVertex: (ix: number, iz: number) => game.city.chunks.terrainVertex(ix, iz),
      /** nível da luz da zona que o shader do terreno recebe agora */
      zoneLevel: (id: number) => scene.zoneLevels[id]!,
      get time() {
        return scene.time;
      },
      groundProbe: (x: number, z: number, opts: { bounce: boolean }) => game.probeGround(x, z, opts),
      get materials() {
        const pool = scene.poolMaterial;
        return {
          yardLampEmissive: scene.yardLampMaterial.emissiveIntensity,
          bulbEmissive: scene.bulbMaterial.emissiveIntensity,
          pool: {
            hasNormalMap: pool.normalMap !== null,
            offset: pool.normalMap ? [pool.normalMap.offset.x, pool.normalMap.offset.y] : null,
            emissive: [pool.emissive.r, pool.emissive.g, pool.emissive.b],
            emissiveIntensity: pool.emissiveIntensity,
          },
        };
      },
      get bulbCount() {
        return scene.bulbs.count;
      },
      /** `uTime` do material das copas agora */
      get crownTime() {
        return scene.swayTime.value;
      },
      /** as `n` primeiras matrizes de instância das árvores (troncos e copas) */
      treeMatrices: (n: number) => {
        const m = new THREE.Matrix4();
        const out: number[][] = [];
        for (let i = 0; i < Math.min(n, scene.trees.count); i++) {
          scene.trees.getMatrixAt(i, m);
          out.push([...m.elements]);
        }
        return out;
      },
      /** vértices da árvore `i` onde o shader os põe agora, com a cor (tronco marrom, copa verde) */
      treeVertices: (i: number) => scene.treeVertices(i),
      /** vagalumes onde o shader os põe agora (âncora + deriva) */
      fireflyPositions: () => scene.fireflyPositions(),
      trees: props.trees.map((t) => ({ ...t })),
      sites: props.sites.map((s) => ({ ...s, floodlights: s.floodlights.map((f) => ({ ...f })) })),
      /** yaw (rad) da lança do canteiro `i`, lido da matriz da instância na cena */
      jibYaw: (i: number) => scene.jibYaw(i),
      /** intensidade do farol vermelho agora e o tempo com que foi calculada */
      get beacon() {
        return { intensity: scene.beaconMaterial.emissiveIntensity, time: scene.time };
      },
      beamProbe: (siteIndex: number) => game.probeBeam(siteIndex),
      /** pedestres ativos: posição, zona e se está fugindo do carro */
      walkers: () => scene.walkers.map((w) => ({ x: w.x, z: w.z, zoneId: w.zoneId, fleeing: w.fleeing })),
      /** colliders do mundo no Rapier, e o que cada parte do mundo criou */
      colliders: () => ({
        total: game.world.colliders.len(),
        terrain: 1,
        roads: game.city.data.network.roads.length,
        rails: game.physics.rails,
        pillars: game.physics.pillars.length,
        lots: game.city.data.lots.length,
        walls: game.physics.walls.length,
        trees: game.physics.trees.length,
        cranes: game.physics.cranes.length,
        parked: game.physics.parked.length,
        columns: game.physics.columns.length,
        car: game.car.body.numColliders(),
      }),
      /** posição da lâmpada `i` lida da malha: matriz da instância + balanço com o `uTime` aplicado */
      bulbPosition: (i: number) => scene.bulbPosition(i),
    };
  }

  /** Só DEV: `false` zera o blur do espelho até chamar a função devolvida; `undefined` não mexe. */
  setMirrorBlur(on: boolean | undefined): () => void {
    const r = this.city.reflector;
    if (on !== false || !r) return () => {};
    const u = (r.material as THREE.ShaderMaterial).uniforms.uBlur!;
    const was = u.value as number;
    u.value = 0;
    return () => {
      u.value = was;
    };
  }

  /**
   * Só DEV (block-life-extras C3): vista ortográfica de cima do grid (40 m,
   * centrada entre os carros; chuva, partículas e espelho ocultos) renderizada
   * direto no canvas, e a cor média de 9 × 9 px no ponto projetado do teto da
   * carroceria (centro do chassi + 0.7 m) do oponente `i`, ou do jogador com
   * `i` = −1. `onScreen` diz se o ponto, com a margem dos 9 px, cai no canvas.
   */
  probeBody(i: number): { r: number; g: number; b: number; luminance: number; onScreen: boolean } {
    const cars = [this.car, ...this.race.opponents.map((o) => o.car)];
    const car = i < 0 ? this.car : this.race.opponents[i]!.car;
    const t = car.body.translation();
    let cx = 0;
    let cz = 0;
    for (const c of cars) {
      const p = c.body.translation();
      cx += p.x / cars.length;
      cz += p.z / cars.length;
    }
    const gl = this.renderer.getContext();
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const span = 40;
    const aspect = W / H;
    const cam = new THREE.OrthographicCamera((-span / 2) * aspect, (span / 2) * aspect, span / 2, -span / 2, 1, 400);
    cam.position.set(cx, t.y + 150, cz);
    cam.up.set(0, 0, -1);
    cam.lookAt(cx, t.y, cz);
    cam.updateMatrixWorld();
    for (const c of cars) c.sync();
    const hidden: THREE.Object3D[] = [this.rain.points, ...this.effects.objects];
    if (this.city.reflector) hidden.push(this.city.reflector);
    const was = hidden.map((o) => o.visible);
    hidden.forEach((o) => (o.visible = false));
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, cam);
    hidden.forEach((o, k) => (o.visible = was[k]!));
    const v = new THREE.Vector3(t.x, t.y + 0.7, t.z).project(cam);
    const px = Math.round(((v.x + 1) / 2) * (W - 1));
    const py = Math.round(((v.y + 1) / 2) * (H - 1));
    const onScreen = px >= 4 && px <= W - 5 && py >= 4 && py <= H - 5;
    const buf = new Uint8Array(9 * 9 * 4);
    gl.readPixels(Math.min(W - 9, Math.max(0, px - 4)), Math.min(H - 9, Math.max(0, py - 4)), 9, 9, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let r = 0;
    let g = 0;
    let b = 0;
    for (let k = 0; k < 81; k++) {
      r += buf[k * 4]!;
      g += buf[k * 4 + 1]!;
      b += buf[k * 4 + 2]!;
    }
    r /= 81 * 255;
    g /= 81 * 255;
    b /= 81 * 255;
    return { r, g, b, luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b, onScreen };
  }

  /** Luminância média do quarto central da tela no último `composer.render` (lida com `readPixels`). */
  private centralLuminance(): number {
    const gl = this.renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0;
    let count = 0;
    for (let y = Math.floor(h / 4); y < Math.floor((3 * h) / 4); y++) {
      for (let x = Math.floor(w / 4); x < Math.floor((3 * w) / 4); x++) {
        const k = (y * w + x) * 4;
        sum += (0.2126 * px[k]! + 0.7152 * px[k + 1]! + 0.0722 * px[k + 2]!) / 255;
        count++;
      }
    }
    return sum / count;
  }

  /**
   * Só DEV/testes (block-fill C11, C12): câmera 3 m acima de (x, z) olhando
   * para baixo; carro, farol, cones, chuva, partículas, espelho da rua e os
   * objetos do miolo escondidos; `bounce: false` zera só a luz rebatida. Um
   * quadro pelo composer e a luminância média do quarto central da tela.
   * Restaura tudo ao sair.
   */
  probeGround(x: number, z: number, opts: { bounce: boolean }): number {
    const y = heightAt(this.city.data.carved, x, z);
    const cam = this.chase.camera;
    const camPos = cam.position.clone();
    const camQuat = cam.quaternion.clone();
    const hidden: THREE.Object3D[] = [
      this.car.mesh,
      this.rain.points,
      ...this.effects.objects,
      ...this.headlightCones,
      ...this.city.interiors.objects(),
    ];
    if (this.city.reflector) hidden.push(this.city.reflector);
    const was = hidden.map((o) => o.visible);
    hidden.forEach((o) => (o.visible = false));
    const intensity = this.headlight.intensity;
    this.headlight.intensity = 0;
    const bounce = this.city.interiors.terrainUniforms.uBounce.value;
    this.city.interiors.terrainUniforms.uBounce.value = opts.bounce ? 1 : 0;

    cam.position.set(x, y + 3, z);
    cam.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    cam.updateMatrixWorld();
    this.composer.render(0);
    const lum = this.centralLuminance();

    this.city.interiors.terrainUniforms.uBounce.value = bounce;
    this.headlight.intensity = intensity;
    hidden.forEach((o, i) => (o.visible = was[i]!));
    cam.position.copy(camPos);
    cam.quaternion.copy(camQuat);
    cam.updateMatrixWorld();
    return lum;
  }

  /**
   * Só DEV/testes (block-fill C29): com o holofote 0 do canteiro `siteIndex`
   * parado no meio da varredura, vista ortográfica de cima (carro, chuva,
   * partículas, espelho e objetos do miolo ocultos) renderizada direto no
   * canvas e lida com `readPixels`. Devolve a luminância média de 9 × 9 px no
   * centro do facho no chão e a de um ponto do mesmo canteiro (vértice da
   * mesma zona) a 12 m do centro do facho, de través a ele e fora dele.
   */
  probeBeam(siteIndex: number): { beam: number; outside: number; beamPoint: { x: number; z: number }; outsidePoint: { x: number; z: number } } {
    const it = this.city.interiors;
    const data = this.city.data;
    const site = data.props.sites[siteIndex]!;
    const f = site.floodlights[0]!;
    const bi = data.interiors;
    it.floodsFrozen = true;
    it.update(this.simTime);
    const dir = { x: Math.sin(f.heading), z: Math.cos(f.heading) };
    const beam = { x: f.x + dir.x * FLOOD_REACH, z: f.z + dir.z * FLOOD_REACH };
    // 12 m de través (dos dois lados) ou mais para frente/trás; o primeiro que cai na zona do canteiro
    const zoneAt = (x: number, z: number) =>
      bi.zoneOf[Math.round((z - bi.origin) / bi.spacing) * bi.size + Math.round((x - bi.origin) / bi.spacing)]!;
    let outside = { x: beam.x + dir.z * 12, z: beam.z - dir.x * 12 };
    for (let k = 0; k < 16; k++) {
      const a = Math.PI / 2 + (k % 2 ? 1 : -1) * Math.floor((k + 1) / 2) * (Math.PI / 8);
      const c = { x: beam.x + (dir.x * Math.cos(a) + dir.z * Math.sin(a)) * 12, z: beam.z + (dir.z * Math.cos(a) - dir.x * Math.sin(a)) * 12 };
      if (zoneAt(c.x, c.z) === site.zoneId) {
        outside = c;
        break;
      }
    }
    const span = 40;
    const gl = this.renderer.getContext();
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const aspect = W / H;
    const cx = (beam.x + outside.x) / 2;
    const cz = (beam.z + outside.z) / 2;
    const y0 = heightAt(data.carved, cx, cz);
    const cam = new THREE.OrthographicCamera((-span / 2) * aspect, (span / 2) * aspect, span / 2, -span / 2, 1, 400);
    cam.position.set(cx, y0 + 150, cz);
    cam.up.set(0, 0, -1);
    cam.lookAt(cx, y0, cz);
    cam.updateMatrixWorld();
    const hidden: THREE.Object3D[] = [this.rain.points, ...this.effects.objects, this.car.mesh, ...it.objects()];
    if (this.city.reflector) hidden.push(this.city.reflector);
    const was = hidden.map((o) => o.visible);
    hidden.forEach((o) => (o.visible = false));
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, cam);
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    hidden.forEach((o, i) => (o.visible = was[i]!));
    it.floodsFrozen = false;
    it.update(this.simTime);
    const lum = (x: number, z: number): number => {
      const v = new THREE.Vector3(x, heightAt(data.carved, x, z), z).project(cam);
      const px = Math.round(((v.x + 1) / 2) * (W - 1));
      const py = Math.round(((v.y + 1) / 2) * (H - 1));
      let sum = 0;
      let count = 0;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const k = (Math.min(H - 1, Math.max(0, py + dy)) * W + Math.min(W - 1, Math.max(0, px + dx))) * 4;
          sum += (0.2126 * buf[k]! + 0.7152 * buf[k + 1]! + 0.0722 * buf[k + 2]!) / 255;
          count++;
        }
      }
      return sum / count;
    };
    return { beam: lum(beam.x, beam.z), outside: lum(outside.x, outside.z), beamPoint: beam, outsidePoint: outside };
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
    // o viaduto do trem cobre a avenida vista de cima: a sonda mede o asfalto, não o deck
    const hidden: THREE.Object3D[] = [this.rain.points, ...this.effects.objects, this.car.mesh, ...(this.trainScene?.objects() ?? [])];
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
