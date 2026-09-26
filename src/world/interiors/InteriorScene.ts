import * as THREE from 'three';
import type { QualityPreset } from '../../core/quality';
import type { BlockInteriors } from './BlockInteriors';
import type { InteriorProps } from './InteriorProps';
import { waveNormalMap } from '../Water';
import { BULB_AMPLITUDE, POOL_FLOW, bulbSway, zoneLight } from './interiorMotion';
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
  /** vagalumes na cena */
  fireflyCount = 0;
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
    this.group.add(this.yardLamps, this.bulbs, this.pools);
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
