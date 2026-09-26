import * as THREE from 'three';

/**
 * Um único passo de tela cheia com o "look" final (door 7 do visual-upgrade):
 * blur radial por velocidade, aberração cromática sutil, grade lift/gain
 * (teal nas sombras, laranja nas altas) e vinheta. Um passo só em vez de
 * quatro economiza três leituras de tela inteira por frame.
 */
export const GRADE_DEFAULTS = {
  uAberration: 0.0015,
  uVignette: 0.35,
  uBlur: 0,
  uLift: [0.0, 0.01, 0.03] as const,
  uGain: [1.05, 1.0, 0.95] as const,
};

export const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAberration: { value: GRADE_DEFAULTS.uAberration },
    uVignette: { value: GRADE_DEFAULTS.uVignette },
    uBlur: { value: GRADE_DEFAULTS.uBlur },
    uLift: { value: new THREE.Vector3(...GRADE_DEFAULTS.uLift) },
    uGain: { value: new THREE.Vector3(...GRADE_DEFAULTS.uGain) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uBlur;
    uniform vec3 uLift;
    uniform vec3 uGain;
    varying vec2 vUv;

    void main() {
      vec2 c = vUv - 0.5;
      vec3 col;
      if (uBlur > 0.001) {
        // blur radial: amostras em direção ao centro, mais fortes nas bordas
        vec3 acc = vec3(0.0);
        for (int i = 0; i < 8; i++) {
          float s = 1.0 - uBlur * 0.1 * float(i) / 7.0;
          acc += texture2D(tDiffuse, 0.5 + c * s).rgb;
        }
        col = acc / 8.0;
      } else {
        col = texture2D(tDiffuse, vUv).rgb;
      }
      // aberração cromática: vermelho para fora, azul para dentro
      float r = texture2D(tDiffuse, vUv + c * uAberration * 2.0).r;
      float b = texture2D(tDiffuse, vUv - c * uAberration * 2.0).b;
      col.r = mix(col.r, r, 0.8);
      col.b = mix(col.b, b, 0.8);
      // grade: lift nas sombras, gain nas altas
      col = col * uGain + uLift * (1.0 - clamp(col, 0.0, 1.0));
      // vinheta
      float v = smoothstep(0.85, 0.25, length(c) * 1.25);
      col *= mix(1.0 - uVignette, 1.0, v);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
