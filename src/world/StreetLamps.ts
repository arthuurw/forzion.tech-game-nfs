import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hexToRgb } from '../vehicle/carPaint';
import { WORLD_EXTENT_M, type LampLightGrid } from './lampLight';
import type { RoadNetwork } from './roads/RoadGenerator';
import { LAMP_ARM_M, LAMP_POST_HEIGHT, lampColor, type Lamp } from './roads/roadMesh';

/**
 * Postes da night-city (AC 1, AC 2, AC 5): uma `InstancedMesh` só para o mundo todo, com
 * haste, braço, carcaça e a lente virada para baixo numa geometria. O eixo local +X aponta
 * para a estrada. Só a lente brilha (atributo `aLens`), na cor do bairro (`aLampColor`).
 */
export function buildStreetLamps(lamps: Lamp[], network: RoadNetwork, material: THREE.MeshStandardMaterial): THREE.InstancedMesh {
  const part = (g: THREE.BufferGeometry, x: number, y: number, lens: number) => {
    g.translate(x, y, 0);
    const n = g.getAttribute('position').count;
    g.setAttribute('aLens', new THREE.BufferAttribute(new Float32Array(n).fill(lens), 1));
    return g;
  };
  const geometry = mergeGeometries([
    part(new THREE.CylinderGeometry(0.08, 0.1, LAMP_POST_HEIGHT, 6), 0, LAMP_POST_HEIGHT / 2, 0),
    part(new THREE.BoxGeometry(LAMP_ARM_M, 0.07, 0.07), LAMP_ARM_M / 2, LAMP_POST_HEIGHT - 0.05, 0),
    part(new THREE.BoxGeometry(0.6, 0.14, 0.3), LAMP_ARM_M, LAMP_POST_HEIGHT - 0.1, 0),
    part(new THREE.BoxGeometry(0.5, 0.02, 0.22), LAMP_ARM_M, LAMP_POST_HEIGHT - 0.18, 1),
  ]);
  if (!geometry) throw new Error('StreetLamps: partes do poste não juntam');
  const count = Math.max(1, lamps.length);
  const colors = new Float32Array(count * 3);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  lamps.forEach((lamp, i) => {
    // braço para o eixo: −side·(cos h, −sin h); girar +X em Y por `a` dá (cos a, −sin a)
    const dx = -lamp.side * Math.cos(lamp.heading);
    const dz = lamp.side * Math.sin(lamp.heading);
    q.setFromAxisAngle(up, Math.atan2(-dz, dx));
    m.compose(p.set(lamp.x, lamp.y, lamp.z), q, one);
    mesh.setMatrixAt(i, m);
    colors.set(hexToRgb(lampColor(lamp, network.roads[lamp.roadId]!)), i * 3);
  });
  geometry.setAttribute('aLampColor', new THREE.InstancedBufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  mesh.count = lamps.length;
  mesh.frustumCulled = false;
  mesh.name = 'street-lamps';
  return mesh;
}

/** Material dos postes: metal escuro; a emissão (2.5, para o bloom) só na lente, na cor do poste. */
export function makeStreetLampMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#2a2b33',
    roughness: 0.6,
    metalness: 0.6,
    emissive: '#ffffff',
    emissiveIntensity: 2.5,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aLens;\nattribute vec3 aLampColor;\nvarying float vLens;\nvarying vec3 vLampColor;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvLens = aLens;\nvLampColor = aLampColor;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vLens;\nvarying vec3 vLampColor;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vLens * vLampColor;`);
  };
  material.customProgramCacheKey = () => 'street-lamp';
  return material;
}

/** A grade de luz no chão como textura: 1536 × 1536, filtro linear, sem mipmap, cores em sRGB. */
export function makeLampLightTexture(grid: LampLightGrid): THREE.DataTexture {
  const texture = new THREE.DataTexture(grid.data, grid.size, grid.size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Faz um material de chão receber a luz dos postes (night-city door 2): soma `luz · albedo · gain`
 * no difuso e `luz · sheen` no especular (o asfalto molhado brilha mais que a grama). Mantém o
 * `onBeforeCompile` que o material já tinha e acrescenta a chave de programa.
 */
export function addLampLight(material: THREE.MeshStandardMaterial, texture: THREE.Texture, gain: number, sheen: number, key: string): void {
  const uniforms = { uLampLight: { value: texture }, uLampGain: { value: gain }, uLampSheen: { value: sheen } };
  material.userData.lampLight = uniforms;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vLampXZ;`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>\nvLampXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec2 vLampXZ;\nuniform sampler2D uLampLight;\nuniform float uLampGain;\nuniform float uLampSheen;`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
vec3 lampL = texture2D(uLampLight, (vLampXZ + ${(WORLD_EXTENT_M / 2).toFixed(1)}) / ${WORLD_EXTENT_M.toFixed(1)}).rgb;
reflectedLight.directDiffuse += diffuseColor.rgb * lampL * uLampGain;
reflectedLight.directSpecular += lampL * uLampSheen;`,
      );
  };
  // chave explícita: a padrão do three é o texto do `onBeforeCompile`, igual para todos os que passam por aqui
  material.customProgramCacheKey = () => `lamp-light-${key}`;
}

