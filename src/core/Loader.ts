import RAPIER from '@dimforge/rapier3d-compat';
import type { Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Carrega o que precisa existir antes do primeiro frame: o WASM do Rapier e
 * o modelo do carro. Se o modelo falhar (arquivo ausente, rede), o jogo segue
 * com um chassi placeholder em vez de quebrar (door 7).
 */
export const CAR_MODEL_URL = '/models/car.glb';

export interface Assets {
  carModel: Group | null;
  placeholder: boolean;
}

export function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

export async function loadAssets(onProgress: (message: string) => void = () => {}): Promise<Assets> {
  onProgress('Carregando física...');
  await RAPIER.init();

  onProgress('Carregando carro...');
  try {
    const gltf = await new GLTFLoader().loadAsync(CAR_MODEL_URL);
    return { carModel: gltf.scene, placeholder: false };
  } catch (error) {
    console.warn(`Falha ao carregar ${CAR_MODEL_URL}; usando chassi placeholder`, error);
    return { carModel: null, placeholder: true };
  }
}
