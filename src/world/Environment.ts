import * as THREE from 'three';
import { NEON_PALETTE } from './CityGenerator';
import { SKYLINE_STEPS, SKYLINE_TABLE, SKY_GLOW, SKY_HORIZON, SKY_RADIUS_M, SKY_SILHOUETTE, SKY_ZENITH } from './skyMath';

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
  // night-city door 3: a névoa tem a cor do horizonte da cúpula; o fundo é o zênite
  scene.background = new THREE.Color(SKY_ZENITH);
  scene.fog = new THREE.FogExp2(SKY_HORIZON, 0.0035);
  return envMap;
}

/** No máximo 3 luzes reais; o resto do brilho vem de emissive + bloom. */
export function addNightLights(scene: THREE.Scene): void {
  const hemi = new THREE.HemisphereLight('#3a4a9a', '#0a0a10', 0.35);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight('#8aa0ff', 0.35);
  moon.position.set(-60, 120, 40);
  scene.add(moon);
}

const glslColor = (hex: string) => {
  const c = new THREE.Color(hex);
  return `vec3( ${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)} )`;
};

/**
 * Cúpula do céu (night-city door 3): esfera de 500 m por dentro, que o `Game` põe na câmera a
 * cada quadro. Degradê do zênite para o horizonte, brilho laranja fraco da cidade na faixa do
 * horizonte e a silhueta de prédios distantes (`skylineHeight`). Sem tempo: nada se mexe.
 */
export function createSky(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    name: 'night-sky',
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uHorizon: { value: new THREE.Color(SKY_HORIZON) },
      uSkyline: { value: [...SKYLINE_TABLE] },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      uniform vec3 uHorizon;
      uniform float uSkyline[${SKYLINE_STEPS}];
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float e = d.y;
        // azimute como atan2(x, z) de skyMath.ts, em voltas [0, 1)
        float turn = fract((atan(d.x, d.z) + PI) / (2.0 * PI));
        int idx = int(min(float(${SKYLINE_STEPS - 1}), floor(turn * ${SKYLINE_STEPS.toFixed(1)})));
        vec3 sky = mix(uHorizon, ${glslColor(SKY_ZENITH)}, smoothstep(0.0, 0.2, e));
        sky += ${glslColor(SKY_GLOW)} * exp(-max(e, 0.0) * 14.0);
        if (e < uSkyline[idx]) sky = mix(${glslColor(SKY_SILHOUETTE)}, uHorizon, clamp(-e * 20.0, 0.0, 1.0));
        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS_M, 48, 24), material);
  mesh.name = 'sky';
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}
