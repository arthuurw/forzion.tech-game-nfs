import * as THREE from 'three';
import type { QualityPreset } from '../../core/quality';
import type { BlockInteriors } from './BlockInteriors';
import type { InteriorProps } from './InteriorProps';
import { waveNormalMap } from '../Water';
import {
  BULB_AMPLITUDE,
  CROWN_AMPLITUDE,
  FIREFLIES_HIGH,
  FIREFLIES_LOW,
  POOL_FLOW,
  bulbSway,
  crownSwayParams,
  fireflyMotion,
  zoneLight,
} from './interiorMotion';
import { YARD_LAMP_HEIGHT } from './InteriorProps';

/** cor da luz rebatida das janelas (a mesma luz quente das fachadas) */
const BOUNCE_COLOR = new THREE.Color('#ffb877');
/** força da luz rebatida no chão colado ao prédio com a zona em 1.0 */
const BOUNCE_STRENGTH = 1.5;

/**
 * Render do miolo das quadras (block-fill): o que o terreno precisa para a luz
 * rebatida (nível de cada zona numa textura de 1 linha, lida pelo vertex
 * shader) e os objetos do miolo. Tudo que se mexe é calculado pelas funções
 * puras de `interiorMotion` com o mesmo tempo da física (`simTime`).
 */
export class InteriorScene {
  readonly group = new THREE.Group();
  /** nível de luz de cada zona, lido pelo shader do terreno */
  readonly zoneLevels: Float32Array;
  readonly zoneTexture: THREE.DataTexture;
  /** uniforms do terreno: `uBounce` 1 liga a luz rebatida, 0 desliga (só a sonda DEV zera) */
  readonly terrainUniforms = {
    uZoneTex: { value: null as THREE.DataTexture | null },
    uBounce: { value: 1 },
    uBounceColor: { value: BOUNCE_COLOR.clone().multiplyScalar(BOUNCE_STRENGTH) },
  };
  time = 0;
  /** `uTime` dos materiais que balançam no vertex shader (lâmpadas, copas), em s de física */
  readonly swayTime = { value: 0 };
  /** poste de jardim (poste + cabeça emissiva numa malha só) */
  readonly yardLamps: THREE.InstancedMesh;
  readonly yardLampMaterial: THREE.MeshStandardMaterial;
  /** lâmpadas do cordão, balançando pelo `aSway` (freq, fase, direção) de cada instância */
  readonly bulbs: THREE.InstancedMesh;
  readonly bulbMaterial: THREE.MeshStandardMaterial;
  readonly pools: THREE.InstancedMesh;
  readonly poolMaterial: THREE.MeshStandardMaterial;
  /** árvores: tronco e copa numa malha só; a copa balança no vertex shader, o tronco fica parado */
  readonly trees: THREE.InstancedMesh;
  readonly treeMaterial: THREE.MeshStandardMaterial;
  /** vagalumes: `Points` com âncora (perto de uma árvore) e parâmetros por ponto; o movimento é no shader */
  readonly fireflies: THREE.Points;
  readonly fireflyMaterial: THREE.ShaderMaterial;
  /** vagalumes na cena */
  readonly fireflyCount: number;
  /** centro (x, z) usado na última escolha das árvores com vagalumes */
  private fireflyCenter: { x: number; z: number } | null = null;
  /** pedestres ativos */
  readonly walkers: unknown[] = [];

  constructor(
    readonly interiors: BlockInteriors,
    readonly props: InteriorProps,
    readonly seed: number,
    readonly quality: QualityPreset,
  ) {
    const count = Math.max(1, interiors.zones.length);
    this.zoneLevels = new Float32Array(count);
    this.zoneTexture = new THREE.DataTexture(this.zoneLevels, count, 1, THREE.RedFormat, THREE.FloatType);
    this.zoneTexture.minFilter = THREE.NearestFilter;
    this.zoneTexture.magFilter = THREE.NearestFilter;
    this.terrainUniforms.uZoneTex.value = this.zoneTexture;

    // --- quintais: poste com cabeça quente e cordão de lâmpadas ---
    this.yardLampMaterial = new THREE.MeshStandardMaterial({
      color: '#2a2b33',
      roughness: 0.6,
      metalness: 0.4,
      emissive: '#ffcf8a',
      emissiveIntensity: 2.5,
    });
    glowOnly(this.yardLampMaterial, 'yard-lamp');
    this.yardLamps = this.buildYardLamps();
    this.bulbMaterial = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffd28a', emissiveIntensity: 3 });
    swaying(this.bulbMaterial, this.swayTime, 'bulb');
    this.bulbs = this.buildBulbs();
    this.poolMaterial = new THREE.MeshStandardMaterial({
      color: '#0b4a5c',
      roughness: 0.08,
      metalness: 0,
      emissive: '#1fb8d0',
      emissiveIntensity: 0.8,
      normalMap: waveNormalMap(),
      normalScale: new THREE.Vector2(0.5, 0.5),
    });
    this.poolMaterial.normalMap!.repeat.set(2, 2);
    this.pools = this.buildPools();

    // --- árvores e vagalumes ---
    this.treeMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
    crownSwaying(this.treeMaterial, this.swayTime);
    this.trees = this.buildTrees();
    this.fireflyCount = quality.level === 'low' ? FIREFLIES_LOW : FIREFLIES_HIGH;
    this.fireflyMaterial = fireflyMaterial(this.swayTime);
    this.fireflies = this.buildFireflies();
    this.group.add(this.yardLamps, this.bulbs, this.pools, this.trees, this.fireflies);
    this.update(0);
  }

  private buildYardLamps(): THREE.InstancedMesh {
    const post = new THREE.CylinderGeometry(0.05, 0.06, YARD_LAMP_HEIGHT, 6);
    post.translate(0, YARD_LAMP_HEIGHT / 2, 0);
    const head = new THREE.BoxGeometry(0.28, 0.22, 0.28);
    head.translate(0, YARD_LAMP_HEIGHT, 0);
    const geometry = mergeWithGlow([
      [post, 0],
      [head, 1],
    ]);
    const yards = this.props.yards;
    const mesh = new THREE.InstancedMesh(geometry, this.yardLampMaterial, Math.max(1, yards.length));
    const m = new THREE.Matrix4();
    yards.forEach((y, i) => mesh.setMatrixAt(i, m.makeTranslation(y.lamp.x, y.lamp.y - YARD_LAMP_HEIGHT, y.lamp.z)));
    mesh.count = yards.length;
    mesh.name = 'yard-lamps';
    mesh.computeBoundingSphere();
    return mesh;
  }

  private buildBulbs(): THREE.InstancedMesh {
    const geometry = new THREE.IcosahedronGeometry(0.09, 0);
    const bulbs = this.props.yards.flatMap((y) => y.bulbs.map((b) => ({ b, y })));
    const sway = new Float32Array(Math.max(1, bulbs.length) * 4);
    const mesh = new THREE.InstancedMesh(geometry, this.bulbMaterial, Math.max(1, bulbs.length));
    const m = new THREE.Matrix4();
    bulbs.forEach(({ b, y }, i) => {
      mesh.setMatrixAt(i, m.makeTranslation(b.x, b.y, b.z));
      const p = bulbSway(b.x, b.z);
      // balança na horizontal, de través ao cordão
      const dx = y.lamp.x - y.bulbs[0]!.x;
      const dz = y.lamp.z - y.bulbs[0]!.z;
      const len = Math.hypot(dx, dz) || 1;
      sway.set([p.freq, p.phase, -dz / len, dx / len], i * 4);
    });
    geometry.setAttribute('aSway', new THREE.InstancedBufferAttribute(sway, 4));
    mesh.count = bulbs.length;
    mesh.name = 'yard-bulbs';
    mesh.computeBoundingSphere();
    return mesh;
  }

  private buildPools(): THREE.InstancedMesh {
    const geometry = new THREE.BoxGeometry(1, 0.1, 1);
    const pools = this.props.pools;
    const mesh = new THREE.InstancedMesh(geometry, this.poolMaterial, Math.max(1, pools.length));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    pools.forEach((p, i) => {
      // x local = d (ao longo da fachada), z local = w (para trás): yaw = rotation
      q.setFromAxisAngle(up, p.rotation);
      m.compose(new THREE.Vector3(p.x, p.y - 0.05, p.z), q, new THREE.Vector3(p.d, 0.1, p.w));
      mesh.setMatrixAt(i, m);
    });
    mesh.count = pools.length;
    mesh.name = 'pools';
    mesh.computeBoundingSphere();
    return mesh;
  }

  private buildTrees(): THREE.InstancedMesh {
    // árvore de altura 1: tronco até 0.5, copa (icosaedro achatado) centrada em 0.66
    const trunk = new THREE.CylinderGeometry(0.022, 0.032, 0.52, 6, 1, true);
    trunk.translate(0, 0.26, 0);
    const crown = new THREE.IcosahedronGeometry(0.3, 1);
    crown.scale(1, 0.85, 1);
    crown.translate(0, 0.66, 0);
    const geometry = mergeTree(trunk, crown);
    const trees = this.props.trees;
    const sway = new Float32Array(Math.max(1, trees.length) * 4);
    const mesh = new THREE.InstancedMesh(geometry, this.treeMaterial, Math.max(1, trees.length));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    trees.forEach((t, i) => {
      // giro pela posição, para as copas não ficarem todas iguais
      q.setFromAxisAngle(up, (t.x * 0.37 + t.z * 0.61) % (Math.PI * 2));
      m.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.height, t.height, t.height));
      mesh.setMatrixAt(i, m);
      const p = crownSwayParams(t.x, t.z);
      // o deslocamento é aplicado antes da matriz (escala = altura): divide pela altura; a direção
      // do vento vai para o espaço local desfazendo o giro da instância
      const a = -((t.x * 0.37 + t.z * 0.61) % (Math.PI * 2));
      const lx = p.dirX * Math.cos(a) + p.dirZ * Math.sin(a);
      const lz = -p.dirX * Math.sin(a) + p.dirZ * Math.cos(a);
      sway.set([p.freq, p.phase, (lx * CROWN_AMPLITUDE) / t.height, (lz * CROWN_AMPLITUDE) / t.height], i * 4);
    });
    geometry.setAttribute('aSway', new THREE.InstancedBufferAttribute(sway, 4));
    mesh.count = trees.length;
    mesh.name = 'trees';
    mesh.computeBoundingSphere();
    return mesh;
  }

  private buildFireflies(): THREE.Points {
    const n = this.fireflyCount;
    const geometry = new THREE.BufferGeometry();
    // posição = âncora (reescrita quando o carro anda); aParams = fases e frequência de pulso de fireflyMotion
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const params = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const f = fireflyMotion(0, i);
      params.set([f.phaseX, f.phaseZ, f.phaseY, f.pulseHz], i * 4);
    }
    geometry.setAttribute('aParams', new THREE.BufferAttribute(params, 4));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const points = new THREE.Points(geometry, this.fireflyMaterial);
    points.frustumCulled = false;
    points.name = 'fireflies';
    return points;
  }

  /** Põe os vagalumes em volta das árvores mais perto de (x, z): 3 por árvore, até 3 m da copa. */
  private anchorFireflies(x: number, z: number): void {
    const trees = this.props.trees;
    const pos = this.fireflies.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (trees.length === 0) return;
    const perTree = 3;
    const order = trees
      .map((t, i) => ({ i, d: (t.x - x) ** 2 + (t.z - z) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, Math.ceil(this.fireflyCount / perTree));
    for (let k = 0; k < this.fireflyCount; k++) {
      const t = trees[order[Math.floor(k / perTree) % order.length]!.i]!;
      const a = ((k * 2.399963) % (Math.PI * 2)) + t.x;
      const r = t.crown * (0.8 + 0.6 * (((k * 0.618034) % 1) + 0.0));
      pos.setXYZ(k, t.x + Math.sin(a) * r, t.y + 0.8 + ((k * 0.414214) % 1) * 2, t.z + Math.cos(a) * r);
    }
    pos.needsUpdate = true;
    this.fireflyCenter = { x, z };
  }

  /** Árvores perto do carro para os vagalumes: reescolhe quando o carro anda 60 m. */
  follow(x: number, z: number): void {
    const c = this.fireflyCenter;
    if (!c || Math.hypot(c.x - x, c.z - z) > 60) this.anchorFireflies(x, z);
  }

  /** Posição da lâmpada `i` agora: a matriz da instância mais o balanço do shader com o `uTime` aplicado. */
  bulbPosition(i: number): { x: number; y: number; z: number } {
    const m = new THREE.Matrix4();
    this.bulbs.getMatrixAt(i, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    const a = this.bulbs.geometry.getAttribute('aSway') as THREE.InstancedBufferAttribute;
    const s = BULB_AMPLITUDE * Math.sin(2 * Math.PI * a.getX(i) * this.swayTime.value + a.getY(i));
    return { x: p.x + a.getZ(i) * s, y: p.y, z: p.z + a.getW(i) * s };
  }

  /** Liga o shader do terreno à luz rebatida: `aBounce` × nível da zona `aZone` × luz quente × albedo. */
  patchTerrainMaterial(material: THREE.MeshStandardMaterial): void {
    const u = this.terrainUniforms;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aBounce;
attribute float aZone;
uniform sampler2D uZoneTex;
varying float vBounce;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
float zoneLevel = aZone >= 0.0 ? texelFetch(uZoneTex, ivec2(int(aZone + 0.5), 0), 0).r : 0.0;
vBounce = aBounce * zoneLevel;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uBounce;
uniform vec3 uBounceColor;
varying float vBounce;`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * uBounceColor * vBounce * uBounce;`,
        );
    };
    material.customProgramCacheKey = () => 'terrain-interiors';
    material.needsUpdate = true;
  }

  /** Um quadro: níveis das zonas no instante `time` (s de física). */
  update(time: number): void {
    this.time = time;
    for (let i = 0; i < this.interiors.zones.length; i++) this.zoneLevels[i] = zoneLight(i, time, this.seed);
    this.zoneTexture.needsUpdate = true;
    this.swayTime.value = time;
    this.poolMaterial.normalMap!.offset.set((time * POOL_FLOW[0]) % 1, (time * POOL_FLOW[1]) % 1);
  }

  /** Objetos do miolo (o espelho da rua e a sonda do chão os escondem). */
  objects(): THREE.Object3D[] {
    return [this.group];
  }
}

/** Junta geometrias num `BufferGeometry` com `aGlow` por vértice (0 apagado, 1 emissivo). */
function mergeWithGlow(parts: Array<[THREE.BufferGeometry, number]>): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const glow: number[] = [];
  for (const [g0, value] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      glow.push(value);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
  return out;
}

/** O emissivo do material só vale onde `aGlow` = 1 (a cabeça do poste; o poste fica apagado). */
function glowOnly(material: THREE.MeshStandardMaterial, key: string): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aGlow;
varying float vGlow;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vGlow = aGlow;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vGlow;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance *= vGlow;`,
      );
  };
  material.customProgramCacheKey = () => key;
}

/**
 * Balanço horizontal no vertex shader: `aSway` = (freq, fase, dirX, dirZ) por
 * instância, deslocamento `A · sin(2π f t + fase)` ao longo de (dirX, dirZ),
 * a mesma conta de `bulbOffset`.
 */
function swaying(material: THREE.MeshStandardMaterial, time: { value: number }, key: string): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aSway;
uniform float uTime;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float swayS = ${BULB_AMPLITUDE.toFixed(3)} * sin(6.28318530718 * aSway.x * uTime + aSway.y);
transformed.xz += aSway.zw * swayS;`,
      );
  };
  material.customProgramCacheKey = () => key;
}

/** Junta tronco (marrom) e copa (verde, com `aCrown` 1) numa geometria com cor por vértice. */
function mergeTree(trunk: THREE.BufferGeometry, crown: THREE.BufferGeometry): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const mask: number[] = [];
  const bark = new THREE.Color('#3b2a1e');
  const leaf = new THREE.Color('#2f5a2a');
  for (const [g0, color, isCrown] of [
    [trunk, bark, 0],
    [crown, leaf, 1],
  ] as const) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      // um pouco de variação na copa pela altura do vértice
      const shade = isCrown ? 0.85 + 0.3 * Math.min(1, Math.max(0, (p.getY(i) - 0.4) / 0.5)) : 1;
      colors.push(color.r * shade, color.g * shade, color.b * shade);
      // a copa balança mais em cima; o tronco não balança
      mask.push(isCrown ? Math.min(1, Math.max(0, (p.getY(i) - 0.4) / 0.56)) : 0);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  out.setAttribute('aCrown', new THREE.Float32BufferAttribute(mask, 1));
  return out;
}

/** Copa balançando: `aSway` = (freq, fase, dirX·A/h, dirZ·A/h), deslocamento pesado por `aCrown` (0 no tronco). */
function crownSwaying(material: THREE.MeshStandardMaterial, time: { value: number }): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aSway;
attribute float aCrown;
uniform float uTime;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
transformed.xz += aSway.zw * aCrown * sin(6.28318530718 * aSway.x * uTime + aSway.y);`,
      );
  };
  material.customProgramCacheKey = () => 'tree-crown';
}

/** Vagalume: deriva lenta e pulso (as contas de `fireflyMotion`), ponto aditivo com névoa. */
function fireflyMaterial(time: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time },
    vertexShader: /* glsl */ `
      attribute vec4 aParams;
      uniform float uTime;
      varying float vGlow;
      varying float vFog;
      void main() {
        float t = uTime;
        vec3 p = position + vec3(
          1.0 * sin(6.28318530718 * 0.05 * t + aParams.x),
          0.4 * sin(6.28318530718 * 0.06 * t + aParams.z),
          1.0 * sin(6.28318530718 * 0.045 * t + aParams.y));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(40.0 / max(1.0, -mv.z), 1.5, 8.0);
        vGlow = 0.5 + 0.5 * sin(6.28318530718 * aParams.w * t + aParams.x);
        float f = 0.0035 * -mv.z;
        vFog = exp(-f * f);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vGlow;
      varying float vFog;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = 1.0 - smoothstep(0.1, 0.5, length(c));
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(0.75, 1.0, 0.35) * 1.6 * vGlow * a * vFog, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
