import * as THREE from 'three';
import { NEON_PALETTE } from './CityGenerator';

/**
 * Céu noturno + mapa de ambiente. O env map é o que faz o asfalto "molhado"
 * refletir alguma coisa: sem ele, um material com roughness baixo fica só
 * preto. Geramos uma equiretangular pequena num canvas (gradiente escuro com
 * faixas de neon no horizonte) e convertemos com PMREM.
 */
export function createNightEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#020208');
  sky.addColorStop(0.45, '#0a0c1e');
  sky.addColorStop(0.5, '#1a1230');
  sky.addColorStop(0.55, '#0a0c1e');
  sky.addColorStop(1, '#050508');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // faixas de neon no horizonte: é isso que aparece refletido na rua
  const horizon = canvas.height * 0.5;
  for (let i = 0; i < 40; i++) {
    const color = NEON_PALETTE[i % NEON_PALETTE.length]!;
    const x = (i / 40) * canvas.width + ((i * 37) % 11);
    const w = 6 + ((i * 13) % 14);
    const h = 3 + ((i * 7) % 6);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, horizon - h - ((i * 5) % 8), w, h);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(texture).texture;
  pmrem.dispose();
  texture.dispose();

  scene.environment = envMap;
  scene.background = new THREE.Color('#05060d');
  scene.fog = new THREE.FogExp2('#05060d', 0.0035);
  return envMap;
}

/** No máximo 3 luzes reais; o resto do brilho vem de emissive + bloom. */
export function addNightLights(scene: THREE.Scene): void {
  const hemi = new THREE.HemisphereLight('#3a4a9a', '#0a0a10', 0.35);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight('#8aa0ff', 0.25);
  moon.position.set(-60, 120, 40);
  scene.add(moon);
}
