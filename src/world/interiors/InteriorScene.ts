import * as THREE from 'three';
import type { QualityPreset } from '../../core/quality';
import type { BlockInteriors } from './BlockInteriors';
import type { InteriorProps } from './InteriorProps';
import { zoneLight } from './interiorMotion';

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
    this.update(0);
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
  }

  /** Objetos do miolo (o espelho da rua e a sonda do chão os escondem). */
  objects(): THREE.Object3D[] {
    return [this.group];
  }
}
