import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Carrega o que precisa existir antes do primeiro frame: o WASM do Rapier, o
 * modelo do carro e os sets de textura PBR. Se o modelo falhar, o jogo segue
 * com um chassi placeholder (door 7 da free-roam-city); se um set de textura
 * falhar, aquele material vira cor chapada (AC 2 do visual-upgrade).
 */
export const CAR_MODEL_URL = '/models/car.glb';

import { FACADE_SETS, TEXTURE_SETS, type TextureSetName } from './textureSets';

export { FACADE_SETS, TEXTURE_SETS, type TextureSetName };

export interface PbrSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

export interface Assets {
  carModel: THREE.Group | null;
  placeholder: boolean;
  textures: Partial<Record<TextureSetName, PbrSet>>;
  loadedSets: TextureSetName[];
  failedSets: TextureSetName[];
}

export function textureUrl(set: TextureSetName, kind: 'Color' | 'NormalGL' | 'Roughness'): string {
  return `/textures/${set}/${set}_1K-JPG_${kind}.jpg`;
}

export function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

async function loadSet(loader: THREE.TextureLoader, set: TextureSetName): Promise<PbrSet> {
  const [map, normalMap, roughnessMap] = await Promise.all([
    loader.loadAsync(textureUrl(set, 'Color')),
    loader.loadAsync(textureUrl(set, 'NormalGL')),
    loader.loadAsync(textureUrl(set, 'Roughness')),
  ]);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, normalMap, roughnessMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  return { map, normalMap, roughnessMap };
}

export async function loadAssets(onProgress: (message: string) => void = () => {}): Promise<Assets> {
  onProgress('Carregando física...');
  await RAPIER.init();

  onProgress('Carregando texturas...');
  const loader = new THREE.TextureLoader();
  const textures: Partial<Record<TextureSetName, PbrSet>> = {};
  const loadedSets: TextureSetName[] = [];
  const failedSets: TextureSetName[] = [];
  await Promise.all(
    TEXTURE_SETS.map(async (set) => {
      try {
        textures[set] = await loadSet(loader, set);
        loadedSets.push(set);
      } catch (error) {
        console.warn(`Falha ao carregar texturas de /textures/${set}/; usando cor chapada`, error);
        failedSets.push(set);
      }
    }),
  );
  loadedSets.sort();
  failedSets.sort();

  onProgress('Carregando carro...');
  let carModel: THREE.Group | null = null;
  let placeholder = false;
  try {
    const gltf = await new GLTFLoader().loadAsync(CAR_MODEL_URL);
    carModel = gltf.scene;
  } catch (error) {
    console.warn(`Falha ao carregar ${CAR_MODEL_URL}; usando chassi placeholder`, error);
    placeholder = true;
  }
  return { carModel, placeholder, textures, loadedSets, failedSets };
}
