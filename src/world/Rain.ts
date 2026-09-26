import * as THREE from 'three';
import { mulberry32 } from './CityGenerator';
import { RAIN_BOX, RAIN_SPEED_MS } from './rainMath';

/**
 * Chuva na GPU (door 4 do visual-upgrade): um `Points` com N gotas. Cada gota
 * guarda só uma semente de posição; o vertex shader calcula a queda
 * (`rainY` de rainMath.ts, a mesma conta) e enrola a posição horizontal numa
 * caixa de 60 × 60 m que segue o carro, então as gotas ficam paradas no mundo
 * enquanto a caixa anda. O fragment desenha um risco vertical fino.
 */
export class Rain {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  readonly count: number;

  constructor(scene: THREE.Scene, count: number, seed = 42) {
    this.count = count;
    const rng = mulberry32(seed);
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      seeds[i * 3] = rng() * RAIN_BOX.x;
      seeds[i * 3 + 1] = rng() * RAIN_BOX.y;
      seeds[i * 3 + 2] = rng() * RAIN_BOX.z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
    // o bounding sphere real muda com a câmera; desliga o culling
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uBox: { value: new THREE.Vector3(RAIN_BOX.x, RAIN_BOX.y, RAIN_BOX.z) },
        uSpeed: { value: RAIN_SPEED_MS },
        uSize: { value: 26 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uCenter;
        uniform vec3 uBox;
        uniform float uSpeed;
        uniform float uSize;
        varying float vFade;
        void main() {
          // queda: mesma conta de rainY() em rainMath.ts
          float y = mod(position.y - uSpeed * uTime, uBox.y);
          // horizontal: posição fixa no mundo, enrolada na caixa centrada no carro
          vec2 halfBox = uBox.xz * 0.5;
          vec2 rel = mod(position.xz - uCenter.xz + halfBox, uBox.xz) - halfBox;
          vec3 world = vec3(uCenter.x + rel.x, y, uCenter.z + rel.y);
          vec4 mv = modelViewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize / max(1.0, -mv.z);
          // some perto das bordas da caixa para não "piscar" ao enrolar
          vFade = (1.0 - smoothstep(0.7, 1.0, length(rel / halfBox))) * smoothstep(0.0, 2.0, y);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vFade;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float streak = (1.0 - smoothstep(0.0, 0.06, abs(p.x))) * (1.0 - smoothstep(0.35, 0.5, abs(p.y)));
          if (streak < 0.01) discard;
          gl_FragColor = vec4(vec3(0.62, 0.72, 0.9), 0.22 * streak * vFade);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(time: number, center: { x: number; y: number; z: number }): void {
    this.material.uniforms.uTime!.value = time;
    (this.material.uniforms.uCenter!.value as THREE.Vector3).set(center.x, center.y, center.z);
  }

  get time(): number {
    return this.material.uniforms.uTime!.value as number;
  }

  get center(): { x: number; y: number; z: number } {
    const c = this.material.uniforms.uCenter!.value as THREE.Vector3;
    return { x: c.x, y: c.y, z: c.z };
  }
}
