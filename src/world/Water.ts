import * as THREE from 'three';
import { WATER_Y, WORLD_HALF } from './worldMath';

/**
 * Água da baía e do rio (door 8 da city-terrain): um plano único de 3072 m em
 * y = -2, escuro e quase espelhado, com um normal map de ondas gerado aqui e
 * deslocado a cada frame. O terreno acima da água cobre o resto.
 */
export class Water {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  readonly size = WORLD_HALF * 2;

  constructor(scene: THREE.Scene) {
    this.material = new THREE.MeshStandardMaterial({
      color: '#0a1622',
      roughness: 0.08,
      metalness: 0.2,
      normalMap: waveNormalMap(),
      normalScale: new THREE.Vector2(0.6, 0.6),
    });
    this.material.envMap = scene.environment;
    this.material.normalMap!.repeat.set(this.size / 40, this.size / 40);
    const geometry = new THREE.PlaneGeometry(this.size, this.size);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.y = WATER_Y;
    scene.add(this.mesh);
  }

  update(time: number): void {
    const map = this.material.normalMap!;
    map.offset.set((time * 0.013) % 1, (time * 0.008) % 1);
  }
}

/** Normal map 128 × 128 de ondas (soma de senos com período inteiro, repete sem emenda). */
function waveNormalMap(): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const h = (x: number, y: number) => {
    const u = (x / size) * Math.PI * 2;
    const v = (y / size) * Math.PI * 2;
    return Math.sin(u * 3 + v) * 0.5 + Math.sin(u * 5 - v * 4) * 0.3 + Math.sin(v * 7 + u * 2) * 0.2;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const nx = -dx * 2;
      const ny = -dy * 2;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}
