import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { Assets, PbrSet } from '../core/Loader';
import { FACADE_SETS, ROAD_SET, SIDEWALK_SET } from '../core/textureSets';
import type { QualityPreset } from '../core/quality';
import { FACADE_TYPES, NEON_PALETTE } from './CityGenerator';
import { ChunkManager } from './ChunkManager';
import { facadeTransform, type Lot, type LotSign } from './lots/LotGenerator';
import { bridgeParts } from './roads/bridges';
import type { RoadNetwork } from './roads/RoadGenerator';
import { lampColor, lampHeadPosition, type Lamp } from './roads/roadMesh';
import { buildLampLight } from './lampLight';
import { addLampLight, buildStreetLamps, makeLampLightTexture, makeStreetLampMaterial } from './StreetLamps';
import type { Heightmap } from './terrain/TerrainGenerator';
import { Water } from './Water';
import type { BlockInteriors } from './interiors/BlockInteriors';
import type { InteriorProps } from './interiors/InteriorProps';
import { InteriorScene } from './interiors/InteriorScene';
import { DOWNTOWN_HALF } from './worldMath';
import { MIRROR_F0, MIRROR_STREAK_GROW, MIRROR_STREAK_TEXELS, MIRROR_TINT } from './mirrorMath';
import { GLYPH_H, GLYPH_PATTERNS, GLYPH_W, glyphMask, signPattern } from './signGlyphs';
import { WINDOW_COOL, WINDOW_COOL_BELOW, WINDOW_TV, WINDOW_WARM, WINDOW_WARM_BELOW } from './windowTint';

/**
 * Transforma os dados do mundo da city-terrain em malhas: materiais, o
 * `Reflector` só sobre o quadrado do centro (door 3 da visual-upgrade intacta),
 * a água, prédios / postes / letreiros instanciados para o mundo inteiro, e o
 * `ChunkManager` que monta terreno, asfalto, calçadas e pontes perto do carro.
 *
 * As fachadas usam o patch de shader da visual-upgrade (door 2): cada
 * instância recebe `aRepeat` (largura/4, altura/4) e `aRepeatZ`
 * (profundidade/4) e `aSeed` para decidir quais janelas de 4 m estão acesas.
 */
export const TILE_M = 4;
/** `normalScale` por tipo de fachada (facade-glint: metal e tijolo atenuados para o farol não cintilar) */
const FACADE_NORMAL_SCALE = [1, 0.2, 0.25, 1];
/** rugosidade mínima por tipo, antes do vidro (facade-glint: o tijolo liso brilhava aos pontos sob o farol) */
const FACADE_ROUGHNESS_FLOOR = [0, 0, 0.6, 0];
const WINDOW_COLOR = new THREE.Color(WINDOW_WARM);
/** profundidade do letreiro (night-city AC 16) */
export const SIGN_DEPTH_M = 0.12;
/** brilho percebido das janelas acesas (pedido do usuário: um pouco menos claras); a intensidade emissiva continua 2.2 para o bloom */
const WINDOW_BRIGHTNESS = 0.7;
/** cor da janela relativa à quente (o emissive do material), em linear, como `vec3` do GLSL */
function tintGlsl(hex: string): string {
  const c = new THREE.Color(hex);
  return `vec3(${(c.r / WINDOW_COLOR.r).toFixed(4)}, ${(c.g / WINDOW_COLOR.g).toFixed(4)}, ${(c.b / WINDOW_COLOR.b).toFixed(4)})`;
}
/** média das três cores de janela, pesada pelas proporções: o que a janela vira de longe */
const AVERAGE_TINT_GLSL = (() => {
  const w = [WINDOW_WARM_BELOW, WINDOW_COOL_BELOW - WINDOW_WARM_BELOW, 1 - WINDOW_COOL_BELOW];
  const cs = [WINDOW_WARM, WINDOW_COOL, WINDOW_TV].map((h) => new THREE.Color(h));
  const avg = (k: 'r' | 'g' | 'b') => cs.reduce((sum, c, i) => sum + w[i]! * c[k], 0) / WINDOW_COLOR[k];
  return `vec3(${avg('r').toFixed(4)}, ${avg('g').toFixed(4)}, ${avg('b').toFixed(4)})`;
})();

/**
 * meia-faixa do reflexo da rua perto da câmera (texels do alvo de meia resolução). O uniform
 * continua `uBlur`: com 0 as 9 amostras caem no mesmo ponto (a sonda `mirrorBlur: false`)
 */
export const MIRROR_BLUR_TEXELS = MIRROR_STREAK_TEXELS;

interface ReflectorShaderDef {
  name: string;
  uniforms: Record<string, THREE.IUniform>;
  vertexShader: string;
  fragmentShader: string;
}

const glslFloat = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

/**
 * Espelho da rua molhada (night-city S2): 13 amostras em tenda ao longo do eixo vertical da tela,
 * com a meia-faixa `streakTexels` crescendo com a distância, vezes o tom `MIRROR_TINT` e o
 * Fresnel. Sem o `blendOverlay` do three, que deixava o reflexo mais forte que a fonte.
 * Mantém os uniforms `color`, `tDiffuse` e `textureMatrix` que o `Reflector` preenche.
 */
export function streakReflectorShader(width: number, height: number): ReflectorShaderDef {
  const [tr, tg, tb] = MIRROR_TINT;
  return {
    name: 'StreakReflectorShader',
    uniforms: {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
      uBlur: { value: MIRROR_BLUR_TEXELS },
    },
    vertexShader: /* glsl */ `
		uniform mat4 textureMatrix;
		varying vec4 vUv;
		varying vec3 vWorld;
		#include <common>
		#include <logdepthbuf_pars_vertex>
		void main() {
			vUv = textureMatrix * vec4( position, 1.0 );
			vWorld = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			#include <logdepthbuf_vertex>
		}`,
    fragmentShader: /* glsl */ `
		uniform sampler2D tDiffuse;
		uniform vec2 uTexel;
		uniform float uBlur;
		varying vec4 vUv;
		varying vec3 vWorld;
		#include <logdepthbuf_pars_fragment>
		void main() {
			#include <logdepthbuf_fragment>
			vec2 uv = vUv.xy / vUv.w;
			vec3 toEye = cameraPosition - vWorld;
			float dist = length( toEye );
			// meia-faixa: streakTexels(uBlur, dist) de mirrorMath.ts
			float streak = uBlur * ( 1.0 + dist * ${glslFloat(MIRROR_STREAK_GROW)} );
			vec2 dv = vec2( 0.0, uTexel.y * streak / 6.0 );
			vec3 base = vec3( 0.0 );
			for ( int k = -6; k <= 6; k ++ ) {
				float w = ( 7.0 - abs( float( k ) ) ) / 49.0;
				base += w * texture2D( tDiffuse, uv + dv * float( k ) ).rgb;
			}
			// Fresnel de Schlick (mirrorFresnel): ${glslFloat(MIRROR_F0)} de cima, 1 rasante
			float c = clamp( abs( toEye.y ) / max( dist, 1e-4 ), 0.0, 1.0 );
			float fresnel = ${glslFloat(MIRROR_F0)} + ${glslFloat(1 - MIRROR_F0)} * pow( 1.0 - c, 5.0 );
			gl_FragColor = vec4( base * vec3( ${glslFloat(tr)}, ${glslFloat(tg)}, ${glslFloat(tb)} ) * fresnel, 1.0 );
			#include <tonemapping_fragment>
			#include <colorspace_fragment>
		}`,
  };
}

export interface WorldData {
  seed: number;
  raw: Heightmap;
  carved: Heightmap;
  network: RoadNetwork;
  lots: Lot[];
  signs: LotSign[];
  lamps: Lamp[];
  /** miolo das quadras e seus objetos (block-fill, doors 1 e 2) */
  interiors: BlockInteriors;
  props: InteriorProps;
}

export class CityScene {
  /** asfalto do centro, semitransparente sobre o espelho */
  readonly roadMaterial: THREE.MeshStandardMaterial;
  /** asfalto fora do centro, opaco */
  readonly roadOuterMaterial: THREE.MeshStandardMaterial;
  readonly sidewalkMaterial: THREE.MeshStandardMaterial;
  readonly terrainMaterial: THREE.MeshStandardMaterial;
  readonly bridgeMaterial: THREE.MeshStandardMaterial;
  readonly facadeMaterials: THREE.MeshStandardMaterial[] = [];
  readonly facadeMeshes: THREE.InstancedMesh[] = [];
  /**
   * `uSpecularAA` das 4 fachadas (um só objeto): 1 = antialiasing de especular ligado.
   * Em produção fica sempre 1; só a sonda DEV `render.headlightShimmer` muda o valor.
   */
  readonly facadeSpecularAA = { value: 1 };
  /** `uFacadeSpecular` das 4 fachadas: 1 = especular normal; só a sonda DEV zera, para separar o brilho do difuso */
  readonly facadeSpecular = { value: 1 };
  /** lotes de cada malha de fachada, na ordem das instâncias */
  readonly facadeLots: Lot[][] = [];
  readonly signMaterials: THREE.MeshStandardMaterial[] = [];
  readonly signMeshes: THREE.InstancedMesh[] = [];
  readonly lampMaterial: THREE.MeshStandardMaterial;
  readonly lampMeshes: THREE.InstancedMesh[];
  /** luz dos postes no chão (night-city door 2), lida por asfalto, calçada e terreno */
  readonly lampLight: THREE.DataTexture;
  readonly reflector: Reflector | null;
  readonly reflectorSize = DOWNTOWN_HALF * 2;
  readonly water: Water;
  readonly chunks: ChunkManager;
  readonly interiors: InteriorScene;
  readonly group = new THREE.Group();

  constructor(
    readonly data: WorldData,
    scene: THREE.Scene,
    assets: Pick<Assets, 'textures' | 'carModel' | 'placeholder'>,
    quality: QualityPreset,
  ) {
    const size = this.reflectorSize;

    // --- centro: reflector (ou chão escuro em `low`) sob o asfalto semitransparente ---
    if (quality.reflector) {
      // door 3: render target = metade da viewport em pixels CSS (sem devicePixelRatio)
      const textureWidth = Math.floor(window.innerWidth * 0.5);
      const textureHeight = Math.floor(window.innerHeight * 0.5);
      this.reflector = new Reflector(new THREE.PlaneGeometry(size, size), {
        clipBias: 0.003,
        textureWidth,
        textureHeight,
        color: 0x8a8f9a,
        shader: streakReflectorShader(textureWidth, textureHeight),
      });
      this.reflector.rotation.x = -Math.PI / 2;
      this.reflector.position.y = 0;
      this.group.add(this.reflector);
    } else {
      this.reflector = null;
      const under = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: '#07080d' }));
      under.rotation.x = -Math.PI / 2;
      this.group.add(under);
    }

    const asphalt = assets.textures[ROAD_SET];
    this.roadMaterial = makeRoadMaterial(asphalt, true);
    this.roadOuterMaterial = makeRoadMaterial(asphalt, false);

    const paving = assets.textures[SIDEWALK_SET];
    this.sidewalkMaterial = new THREE.MeshStandardMaterial({ color: paving ? '#8a8c94' : '#1c1d26', roughness: 0.85 });
    if (paving) applySet(this.sidewalkMaterial, paving);
    worldUv(this.sidewalkMaterial, 'sidewalk');

    this.terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    // block-fill: luz rebatida das janelas no chão do miolo
    this.interiors = new InteriorScene(data.interiors, data.props, data.seed, quality, data.carved, assets);
    this.interiors.patchTerrainMaterial(this.terrainMaterial);
    scene.add(this.interiors.group);
    const concrete = assets.textures[FACADE_SETS[0]!];
    this.bridgeMaterial = new THREE.MeshStandardMaterial({ color: concrete ? '#9a9890' : '#4a4b52', roughness: 0.8 });
    if (concrete) applySet(this.bridgeMaterial, concrete);
    worldUv(this.bridgeMaterial, 'bridge');

    this.water = new Water(scene);

    // --- prédios: 4 malhas instanciadas para o mundo todo ---
    for (let type = 0; type < FACADE_TYPES; type++) {
      const set = assets.textures[FACADE_SETS[type]!];
      const material = makeFacadeMaterial(set, type, this.facadeSpecularAA, this.facadeSpecular);
      this.facadeMaterials.push(material);
      const lots = data.lots.filter((l) => l.facadeType === type);
      this.facadeLots.push(lots);
      const mesh = this.buildFacadeMesh(lots, material);
      this.facadeMeshes.push(mesh);
      this.group.add(mesh);
    }

    this.lampMaterial = makeStreetLampMaterial();
    this.lampMeshes = [buildStreetLamps(data.lamps, data.network, this.lampMaterial)];
    this.lampLight = makeLampLightTexture(
      buildLampLight(data.lamps.map((l) => ({ ...lampHeadPosition(l), color: lampColor(l, data.network.roads[l.roadId]!) }))),
    );
    // o asfalto molhado brilha sob o poste; calçada e terra só recebem a luz no difuso
    addLampLight(this.roadMaterial, this.lampLight, 3, 0.12, 'road-downtown');
    addLampLight(this.roadOuterMaterial, this.lampLight, 3, 0.12, 'road-outer');
    addLampLight(this.sidewalkMaterial, this.lampLight, 3, 0, 'sidewalk');
    addLampLight(this.terrainMaterial, this.lampLight, 3, 0, 'terrain');
    this.group.add(...this.lampMeshes);
    this.signMeshes.push(...this.buildSigns(data.signs));
    this.group.add(...this.signMeshes);
    scene.add(this.group);

    const bridges = data.network.roads.flatMap((road) =>
      road.bridges.map((range) => ({ road, parts: bridgeParts(road, range, data.raw) })),
    );
    this.chunks = new ChunkManager(scene, data.carved, data.network, bridges, {
      terrain: this.terrainMaterial,
      roadDowntown: this.roadMaterial,
      roadOuter: this.roadOuterMaterial,
      sidewalk: this.sidewalkMaterial,
      bridge: this.bridgeMaterial,
    }, data.interiors, data.seed);
  }

  private buildFacadeMesh(lots: Lot[], material: THREE.MeshStandardMaterial): THREE.InstancedMesh {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const count = Math.max(1, lots.length);
    const repeat = new Float32Array(count * 2);
    const repeatZ = new Float32Array(count);
    const seed = new Float32Array(count);
    lots.forEach((l, i) => {
      repeat[i * 2] = l.width / TILE_M;
      repeat[i * 2 + 1] = l.height / TILE_M;
      repeatZ[i] = l.depth / TILE_M;
      seed[i] = ((l.x * 12.9898 + l.z * 78.233) % 1000) / 1000;
    });
    geometry.setAttribute('aRepeat', new THREE.InstancedBufferAttribute(repeat, 2));
    geometry.setAttribute('aRepeatZ', new THREE.InstancedBufferAttribute(repeatZ, 1));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    lots.forEach((l, i) => {
      // eixo local x ao longo da rua; a caixa unitária começa na base do lote e sobe `height`
      const t = facadeTransform(l);
      q.setFromAxisAngle(up, t.yaw);
      p.set(...t.position);
      s.set(...t.scale);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.count = lots.length;
    mesh.frustumCulled = false;
    return mesh;
  }

  /**
   * O alvo do espelho segue a janela (play-fixes AC 26): metade da viewport em pixels CSS, sem
   * devicePixelRatio (door 3 da visual-upgrade), e o `uTexel` da faixa é o inverso do tamanho.
   */
  resizeMirror(cssWidth: number, cssHeight: number): void {
    if (!this.reflector) return;
    const w = Math.floor(cssWidth * 0.5);
    const h = Math.floor(cssHeight * 0.5);
    this.reflector.getRenderTarget().setSize(w, h);
    ((this.reflector.material as THREE.ShaderMaterial).uniforms.uTexel!.value as THREE.Vector2).set(1 / w, 1 / h);
  }

  /**
   * Um InstancedMesh por cor da paleta: o emissive (e o respiro) é por material. Cada letreiro é
   * uma caixa de 12 cm com moldura escura; só os tubos do padrão dele brilham, na face da frente
   * e na de trás (night-city AC 16, AC 17).
   */
  private buildSigns(signs: LotSign[]): THREE.InstancedMesh[] {
    const glyphs = makeGlyphTexture();
    const meshes: THREE.InstancedMesh[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (const color of NEON_PALETTE) {
      const mine = signs.filter((sign) => sign.color === color);
      const material = makeSignMaterial(color, glyphs);
      this.signMaterials.push(material);
      const geometry = new THREE.BoxGeometry(1, 1, SIGN_DEPTH_M);
      const count = Math.max(1, mine.length);
      const patterns = new Float32Array(count);
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mine.forEach((sign, i) => {
        p.set(sign.x, sign.y, sign.z);
        q.setFromAxisAngle(up, sign.rotationY);
        s.set(sign.width, sign.height, 1);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        patterns[i] = signPattern(sign.x, sign.z);
      });
      geometry.setAttribute('aPattern', new THREE.InstancedBufferAttribute(patterns, 1));
      geometry.computeBoundingBox();
      mesh.count = mine.length;
      mesh.frustumCulled = false;
      mesh.name = 'neon-signs';
      meshes.push(mesh);
    }
    return meshes;
  }
}

function applySet(material: THREE.MeshStandardMaterial, set: PbrSet): void {
  const clone = (t: THREE.Texture): THREE.Texture => {
    const c = t.clone();
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(1, 1);
    c.needsUpdate = true;
    return c;
  };
  material.map = clone(set.map);
  material.normalMap = clone(set.normalMap);
  material.roughnessMap = clone(set.roughnessMap);
  material.needsUpdate = true;
}

/** UV pelo mundo (1 tile a cada 4 m no plano xz) para malhas sem atributo `uv`. */
function worldUv(material: THREE.MeshStandardMaterial, key: string): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
vec2 worldTile = (modelMatrix * vec4(transformed, 1.0)).xz / ${TILE_M.toFixed(1)};
#ifdef USE_MAP
vMapUv = worldTile;
#endif
#ifdef USE_NORMALMAP
vNormalMapUv = worldTile;
#endif
#ifdef USE_ROUGHNESSMAP
vRoughnessMapUv = worldTile;
#endif`,
    );
  };
  material.customProgramCacheKey = () => `world-uv-${key}`;
}

/**
 * Asfalto com as faixas desenhadas no shader (AC 18): `uv` em tiles de 4 m
 * (u atravessando, v ao longo) e `aWidth` em metros. Linha central tracejada
 * (3 m pintados a cada 6 m) e linhas de borda contínuas a 0.45 m das bordas.
 */
function makeRoadMaterial(set: PbrSet | undefined, translucent: boolean): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: set ? '#ffffff' : '#0c0d14',
    // fora do centro não há espelho: um pouco mais áspero e com mais env map, para o molhado ainda aparecer
    roughness: translucent ? 0.2 : 0.3,
    metalness: 0.1,
    envMapIntensity: translucent ? 1.2 : 1.8,
    transparent: translucent,
    opacity: translucent ? 0.65 : 1,
  });
  if (set) applySet(material, set);
  // o asfalto é escuro; a cor multiplica o albedo para não ficar cinza-claro
  material.color.set('#5b5e66');
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aWidth;
varying vec2 vRoadUv;
varying float vRoadWidth;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
vRoadUv = uv;
vRoadWidth = aWidth;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vRoadUv;
varying float vRoadWidth;
// cobertura de uma linha de meia largura hw a distância d, filtrada por um pixel de largura fw
float laneLine(float d, float hw, float fw) {
  float lo = clamp((abs(d) - hw) / fw + 0.5, 0.0, 1.0);
  return (1.0 - lo) * min(1.0, 2.0 * hw / fw);
}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
float acrossM = vRoadUv.x * ${TILE_M.toFixed(1)};
float alongM = vRoadUv.y * ${TILE_M.toFixed(1)};
// filtradas pelo tamanho do pixel: linha mais fina que um pixel vira cobertura parcial e o
// tracejado vira a média (0.5) quando o traço fica menor que um pixel, sem cintilar com a câmera andando
float fwA = max(fwidth(acrossM), 1e-4);
float fwL = max(fwidth(alongM), 1e-4);
float f = fract(alongM / 6.0);
float e = fwL / 6.0;
float dash = smoothstep(-e, e, f) * (1.0 - smoothstep(0.5 - e, 0.5 + e, f)) + smoothstep(1.0 - e, 1.0 + e, f);
dash = mix(dash, 0.5, smoothstep(0.08, 0.25, e));
float centerLine = laneLine(acrossM - vRoadWidth * 0.5, 0.12, fwA) * dash;
float edgeLine = laneLine(acrossM - 0.45, 0.1, fwA) + laneLine(acrossM - (vRoadWidth - 0.45), 0.1, fwA);
float laneMark = clamp(centerLine + edgeLine, 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.8, 0.7), laneMark);
diffuseColor.a = mix(diffuseColor.a, 1.0, laneMark);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.16, 0.155, 0.13) * laneMark;`,
      );
  };
  material.customProgramCacheKey = () => (translucent ? 'road-downtown' : 'road-outer');
  return material;
}

/**
 * Material de fachada: PBR do set (se carregou) + janelas procedurais.
 * O patch lê `aRepeat`, `aRepeatZ` e `aSeed` por instância, escala as UVs de
 * cada face pelo tamanho real (1 tile = 4 m), e no fragment desenha uma
 * janela por célula de 4 m: vidro escuro no albedo, luz quente no emissive
 * quando o hash (seed, célula) diz que está acesa.
 */
export function makeFacadeMaterial(
  set: PbrSet | undefined,
  type: number,
  specularAA: { value: number },
  specular: { value: number },
): THREE.MeshStandardMaterial {
  const tint = ['#b8b4ac', '#9aa0a8', '#a0776a', '#c8c0b0'][type] ?? '#aaaaaa';
  const material = new THREE.MeshStandardMaterial({
    color: set ? tint : '#2a2c36',
    roughness: 0.85,
    // facade-glint: metal com pouco metalness (o reflexo do farol tinha a textura do albedo)
    metalness: 0.05,
    emissive: WINDOW_COLOR,
    emissiveIntensity: 2.2,
  });
  if (set) {
    material.map = set.map;
    material.normalMap = set.normalMap;
    material.roughnessMap = set.roughnessMap;
    // facade-glint: relevo do metal e do tijolo atenuado; concreto e reboco seguem com o normal map inteiro
    const normalScale = FACADE_NORMAL_SCALE[type] ?? 1;
    material.normalScale.set(normalScale, normalScale);
  }
  // uniform por material: a sonda DEV `legacyMaterials` zera para medir a aparência de antes
  const roughnessFloor = { value: FACADE_ROUGHNESS_FLOOR[type] ?? 0 };
  material.userData.roughnessFloor = roughnessFloor;
  const litRatio = [0.14, 0.18, 0.12, 0.16][type] ?? 0.14;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSpecularAA = specularAA;
    shader.uniforms.uFacadeSpecular = specular;
    shader.uniforms.uRoughnessFloor = roughnessFloor;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 aRepeat;
attribute float aRepeatZ;
attribute float aSeed;
varying vec2 vCell;
flat varying float vSeedF;
varying float vRoof;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
vec2 faceRepeat = aRepeat;
if (abs(normal.x) > 0.5) faceRepeat = vec2(aRepeatZ, aRepeat.y);
if (abs(normal.y) > 0.5) faceRepeat = vec2(aRepeat.x, aRepeatZ);
vCell = uv * faceRepeat;
// flat: o hash amplifica o seed ~10^8 vezes; interpolado, o erro de arredondamento
// por pixel sorteava janelas diferentes a cada quadro e elas cintilavam com a câmera andando
vSeedF = aSeed;
vRoof = abs(normal.y);
#ifdef USE_MAP
vMapUv *= faceRepeat;
#endif
#ifdef USE_NORMALMAP
vNormalMapUv *= faceRepeat;
#endif
#ifdef USE_ROUGHNESSMAP
vRoughnessMapUv *= faceRepeat;
#endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vCell;
flat varying float vSeedF;
varying float vRoof;
uniform float uSpecularAA;
uniform float uFacadeSpecular;
uniform float uRoughnessFloor;
float windowHash(vec2 c, float s) { return fract(sin(dot(c + s * 97.0, vec2(12.9898, 78.233))) * 43758.5453); }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
vec2 cellId = floor(vCell);
vec2 inCell = fract(vCell);
// janela de 1.6 m x 1.4 m no meio da célula de 4 m
// bordas suavizadas pela largura do pixel: sem degraus, a janela não cintila com a câmera andando
vec2 fw = max(fwidth(vCell), vec2(1e-4));
vec2 winLo = smoothstep(vec2(0.3, 0.35) - fw, vec2(0.3, 0.35) + fw, inCell);
vec2 winHi = 1.0 - smoothstep(vec2(0.7) - fw, vec2(0.7) + fw, inCell);
float glassMask = winLo.x * winLo.y * winHi.x * winHi.y;
float litMask = glassMask * step(windowHash(cellId, vSeedF), ${litRatio.toFixed(2)});
// longe, a janela fica menor que um pixel e o padrão vira ruído: troca pela média da célula
float cellPx = max(fwidth(vCell.x), fwidth(vCell.y));
float detail = 1.0 - smoothstep(0.05, 0.2, cellPx);
float glass = mix(0.14, glassMask, detail);
float lit = mix(0.14 * ${litRatio.toFixed(2)}, litMask, detail);
glass *= (1.0 - step(0.5, vRoof));
lit *= (1.0 - step(0.5, vRoof));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.035, 0.05), glass);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float warm = ${WINDOW_BRIGHTNESS.toFixed(2)} * mix(0.8, 0.5 + 0.5 * windowHash(cellId + 3.1, vSeedF), detail);
// night-city AC 18: cor fixa por janela, por um hash próprio; longe, a média das três (sem ruído)
float tintHash = windowHash(cellId + 7.7, vSeedF);
vec3 cellTint = tintHash < ${WINDOW_WARM_BELOW.toFixed(2)} ? ${tintGlsl(WINDOW_WARM)} : (tintHash < ${WINDOW_COOL_BELOW.toFixed(2)} ? ${tintGlsl(WINDOW_COOL)} : ${tintGlsl(WINDOW_TV)});
totalEmissiveRadiance *= lit * warm * mix(${AVERAGE_TINT_GLSL}, cellTint, detail);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(max(roughnessFactor, uRoughnessFloor), 0.08, glass);`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
// antialiasing de especular (Tokuyoshi e Kaplanyan): o normal map repetido muda de direção dentro
// de um pixel, e o brilho do farol caía em pontos menores que um pixel que piscavam com o carro
// andando. A variância da normal perturbada na tela soma na rugosidade², limitada.
// σ² 2 e κ 1 (mais forte que os 0.25 / 0.18 do artigo): medidos na sonda do farol (facade-glint C1).
vec3 nDx = dFdx(normal);
vec3 nDy = dFdy(normal);
float nVariance = 2.0 * (dot(nDx, nDx) + dot(nDy, nDy));
float kernelR2 = min(2.0 * nVariance, 1.0);
float aaRoughness = sqrt(clamp(material.roughness * material.roughness + kernelR2, 0.0, 1.0));
material.roughness = mix(material.roughness, aaRoughness, uSpecularAA);
material.specularColor *= uFacadeSpecular;
material.specularColorBlended *= uFacadeSpecular;
material.specularF90 *= uFacadeSpecular;`,
      );
  };
  // chave única por tipo para o three não reaproveitar o programa de outro material
  material.userData.specularAA = specularAA;
  material.customProgramCacheKey = () => `facade-${type}-${set ? 'pbr' : 'flat'}`;
  return material;
}

/** As 8 máscaras de `glyphMask` empilhadas: 64 × 256, um canal, filtro linear (tubo com borda suave). */
function makeGlyphTexture(): THREE.DataTexture {
  const data = new Uint8Array(GLYPH_W * GLYPH_H * GLYPH_PATTERNS);
  for (let p = 0; p < GLYPH_PATTERNS; p++) {
    const mask = glyphMask(p);
    for (let k = 0; k < mask.length; k++) data[p * mask.length + k] = mask[k]! * 255;
  }
  const t = new THREE.DataTexture(data, GLYPH_W, GLYPH_H * GLYPH_PATTERNS, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** Letreiro: moldura metálica escura; emissão só nos tubos, nas faces de frente e de trás. */
export function makeSignMaterial(color: string, glyphs: THREE.Texture): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#101014',
    roughness: 0.5,
    metalness: 0.6,
    emissive: color,
    emissiveIntensity: 2.6,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlyphs = { value: glyphs };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aPattern;
varying vec2 vSignUv;
varying float vSignFace;
flat varying float vPattern;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vSignUv = uv;
vSignFace = step(0.5, abs(normal.z));
vPattern = aPattern;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uGlyphs;
varying vec2 vSignUv;
varying float vSignFace;
flat varying float vPattern;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float tube = texture2D(uGlyphs, vec2(vSignUv.x, (vPattern + vSignUv.y) / ${GLYPH_PATTERNS.toFixed(1)})).r;
totalEmissiveRadiance *= tube * vSignFace;`);
  };
  material.customProgramCacheKey = () => 'neon-sign';
  return material;
}
