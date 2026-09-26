import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { Assets, PbrSet } from '../core/Loader';
import { FACADE_SETS, ROAD_SET, SIDEWALK_SET } from '../core/textureSets';
import type { QualityPreset } from '../core/quality';
import { FACADE_TYPES, NEON_PALETTE, type Building, type CityLayout } from './CityGenerator';

/**
 * Transforma o `CityLayout` (dados) em meshes instanciados e colliders fixos.
 *
 * Instancing mantém a cidade em poucas draw calls: um `InstancedMesh` por tipo
 * de peça. As fachadas usam um patch de shader (door 2 do visual-upgrade): cada
 * instância recebe `aRepeat` (largura/4, altura/4) e `aRepeatZ` (profundidade/4)
 * para a textura não esticar, e `aSeed` para decidir quais janelas de 4 m estão
 * acesas. A rua é um `Reflector` (espelho real) com asfalto PBR semitransparente
 * por cima (door 3).
 */
export const TILE_M = 4;
const WINDOW_COLOR = new THREE.Color('#ffd9a0');

export class CityScene {
  readonly roadMaterial: THREE.MeshStandardMaterial;
  readonly sidewalkMaterial: THREE.MeshStandardMaterial;
  readonly facadeMaterials: THREE.MeshStandardMaterial[] = [];
  readonly facadeMeshes: THREE.InstancedMesh[] = [];
  /** prédios de cada malha de fachada, na ordem das instâncias */
  readonly facadeBuildings: Building[][] = [];
  readonly signMaterials: THREE.MeshStandardMaterial[] = [];
  readonly lampMaterial: THREE.MeshStandardMaterial;
  readonly reflector: Reflector | null;
  readonly laneMarks: THREE.InstancedMesh;
  readonly group = new THREE.Group();
  readonly roadRepeat: number;

  constructor(
    readonly layout: CityLayout,
    scene: THREE.Scene,
    world: RAPIER.World,
    assets: Pick<Assets, 'textures'>,
    quality: QualityPreset,
  ) {
    const size = layout.bounds * 2 + 40; // 444 m
    this.roadRepeat = size / TILE_M; // 111

    // --- rua: reflector + asfalto PBR semitransparente por cima ---
    if (quality.reflector) {
      // door 3: render target = metade da viewport em pixels CSS (sem devicePixelRatio)
      this.reflector = new Reflector(new THREE.PlaneGeometry(size, size), {
        clipBias: 0.003,
        textureWidth: Math.floor(window.innerWidth * 0.5),
        textureHeight: Math.floor(window.innerHeight * 0.5),
        color: 0x8a8f9a,
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
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: asphalt ? '#ffffff' : '#0c0d14',
      roughness: 0.2,
      metalness: 0.1,
      envMapIntensity: 1.2,
      transparent: true,
      opacity: 0.65,
    });
    if (asphalt) this.applySet(this.roadMaterial, asphalt, this.roadRepeat);
    // o asfalto é escuro; a cor multiplica o albedo para não ficar cinza-claro
    this.roadMaterial.color.set('#5b5e66');
    const road = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.02;
    this.group.add(road);

    // --- calçadas ---
    const paving = assets.textures[SIDEWALK_SET];
    this.sidewalkMaterial = new THREE.MeshStandardMaterial({ color: paving ? '#8a8c94' : '#1c1d26', roughness: 0.85 });
    if (paving) this.applySet(this.sidewalkMaterial, paving, layout.blockSize / TILE_M);
    this.group.add(this.buildSidewalks(layout));

    // --- faixas ---
    this.laneMarks = this.buildLaneMarks(layout);
    this.group.add(this.laneMarks);

    // --- prédios ---
    for (let type = 0; type < FACADE_TYPES; type++) {
      const set = assets.textures[FACADE_SETS[type]!];
      const material = makeFacadeMaterial(set, type);
      this.facadeMaterials.push(material);
      const buildings = layout.blocks.flatMap((b) => b.buildings).filter((b) => b.facadeType === type);
      this.facadeBuildings.push(buildings);
      const mesh = this.buildFacadeMesh(buildings, material);
      this.facadeMeshes.push(mesh);
      this.group.add(mesh);
    }

    this.lampMaterial = new THREE.MeshStandardMaterial({
      color: '#000000',
      emissive: '#ffd9a0',
      emissiveIntensity: 2.5,
    });
    this.group.add(...this.buildLamps(layout));
    this.group.add(...this.buildSigns(layout));
    scene.add(this.group);

    this.buildColliders(layout, world);
  }

  /** Conta de instâncias de faixa (C7 do visual-upgrade). */
  get laneMarkCount(): number {
    return this.laneMarks.count;
  }

  private applySet(material: THREE.MeshStandardMaterial, set: PbrSet, repeat: number): void {
    const clone = (t: THREE.Texture): THREE.Texture => {
      const c = t.clone();
      c.repeat.set(repeat, repeat);
      c.needsUpdate = true;
      return c;
    };
    material.map = clone(set.map);
    material.normalMap = clone(set.normalMap);
    material.roughnessMap = clone(set.roughnessMap);
    material.needsUpdate = true;
  }

  private buildSidewalks(layout: CityLayout): THREE.InstancedMesh {
    const height = 0.15;
    const geometry = new THREE.BoxGeometry(layout.blockSize, height, layout.blockSize);
    const mesh = new THREE.InstancedMesh(geometry, this.sidewalkMaterial, layout.blocks.length);
    const m = new THREE.Matrix4();
    layout.blocks.forEach((block, i) => {
      m.makeTranslation(block.x, height / 2, block.z);
      mesh.setMatrixAt(i, m);
    });
    return mesh;
  }

  private buildLaneMarks(layout: CityLayout): THREE.InstancedMesh {
    const geometry = new THREE.PlaneGeometry(0.15, 2.5);
    geometry.rotateX(-Math.PI / 2); // deitado no chão, comprimento ao longo de Z
    const material = new THREE.MeshStandardMaterial({
      color: '#d8d2b8',
      roughness: 0.6,
      emissive: '#2a2820',
      emissiveIntensity: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const total = layout.streets.reduce((n, s) => n + s.laneMarks.length, 0);
    const mesh = new THREE.InstancedMesh(geometry, material, total);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    let i = 0;
    for (const street of layout.streets) {
      q.setFromAxisAngle(up, street.axis === 'x' ? Math.PI / 2 : 0);
      for (const along of street.laneMarks) {
        if (street.axis === 'x') p.set(along, 0.03, street.at);
        else p.set(street.at, 0.03, along);
        m.compose(p, q, one);
        mesh.setMatrixAt(i++, m);
      }
    }
    return mesh;
  }

  private buildFacadeMesh(buildings: Building[], material: THREE.MeshStandardMaterial): THREE.InstancedMesh {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const count = Math.max(1, buildings.length);
    const repeat = new Float32Array(count * 2);
    const repeatZ = new Float32Array(count);
    const seed = new Float32Array(count);
    buildings.forEach((b, i) => {
      repeat[i * 2] = b.width / TILE_M;
      repeat[i * 2 + 1] = b.height / TILE_M;
      repeatZ[i] = b.depth / TILE_M;
      seed[i] = ((b.x * 12.9898 + b.z * 78.233) % 1000) / 1000;
    });
    geometry.setAttribute('aRepeat', new THREE.InstancedBufferAttribute(repeat, 2));
    geometry.setAttribute('aRepeatZ', new THREE.InstancedBufferAttribute(repeatZ, 1));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    buildings.forEach((b, i) => {
      p.set(b.x, b.height / 2, b.z);
      s.set(b.width, b.height, b.depth);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.count = buildings.length;
    return mesh;
  }

  private buildLamps(layout: CityLayout): THREE.InstancedMesh[] {
    const postHeight = 6;
    const posts = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.08, 0.1, postHeight, 6),
      new THREE.MeshStandardMaterial({ color: '#2a2b33', roughness: 0.6, metalness: 0.6 }),
      layout.lamps.length,
    );
    const heads = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.5),
      this.lampMaterial,
      layout.lamps.length,
    );
    const m = new THREE.Matrix4();
    layout.lamps.forEach((lamp, i) => {
      m.makeTranslation(lamp.x, postHeight / 2, lamp.z);
      posts.setMatrixAt(i, m);
      m.makeTranslation(lamp.x, postHeight, lamp.z);
      heads.setMatrixAt(i, m);
    });
    return [posts, heads];
  }

  /** Um InstancedMesh por cor da paleta: o emissive (e o flicker) é por material. */
  private buildSigns(layout: CityLayout): THREE.InstancedMesh[] {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const signs = layout.blocks.flatMap((b) => b.signs);
    const meshes: THREE.InstancedMesh[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (const color of NEON_PALETTE) {
      const mine = signs.filter((sign) => sign.color === color);
      const material = new THREE.MeshStandardMaterial({
        color: '#000000',
        emissive: color,
        emissiveIntensity: 2.6,
        side: THREE.DoubleSide,
      });
      this.signMaterials.push(material);
      const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, mine.length));
      mine.forEach((sign, i) => {
        p.set(sign.x, sign.y, sign.z);
        q.setFromAxisAngle(up, sign.rotationY);
        s.set(sign.width, sign.height, 1);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      });
      mesh.count = mine.length;
      meshes.push(mesh);
    }
    return meshes;
  }

  private buildColliders(layout: CityLayout, world: RAPIER.World): void {
    const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const extent = layout.bounds + 40;
    world.createCollider(RAPIER.ColliderDesc.cuboid(extent, 0.5, extent).setTranslation(0, -0.5, 0), ground);

    for (const block of layout.blocks) {
      for (const b of block.buildings) {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(b.width / 2, b.height / 2, b.depth / 2).setTranslation(b.x, b.height / 2, b.z),
          ground,
        );
      }
    }

    // paredes invisíveis nos 4 limites (free-roam-city AC 8)
    const wallH = 20;
    const wallT = 1;
    const at = layout.bounds + wallT;
    world.createCollider(RAPIER.ColliderDesc.cuboid(wallT, wallH, extent).setTranslation(at, wallH, 0), ground);
    world.createCollider(RAPIER.ColliderDesc.cuboid(wallT, wallH, extent).setTranslation(-at, wallH, 0), ground);
    world.createCollider(RAPIER.ColliderDesc.cuboid(extent, wallH, wallT).setTranslation(0, wallH, at), ground);
    world.createCollider(RAPIER.ColliderDesc.cuboid(extent, wallH, wallT).setTranslation(0, wallH, -at), ground);
  }
}

/**
 * Material de fachada: PBR do set (se carregou) + janelas procedurais.
 * O patch lê `aRepeat`, `aRepeatZ` e `aSeed` por instância, escala as UVs de
 * cada face pelo tamanho real (1 tile = 4 m), e no fragment desenha uma
 * janela por célula de 4 m: vidro escuro no albedo, luz quente no emissive
 * quando o hash (seed, célula) diz que está acesa.
 */
function makeFacadeMaterial(set: PbrSet | undefined, type: number): THREE.MeshStandardMaterial {
  const tint = ['#b8b4ac', '#9aa0a8', '#a0776a', '#c8c0b0'][type] ?? '#aaaaaa';
  const material = new THREE.MeshStandardMaterial({
    color: set ? tint : '#2a2c36',
    roughness: 0.85,
    metalness: type === 1 ? 0.5 : 0.05,
    emissive: WINDOW_COLOR,
    emissiveIntensity: 2.2,
  });
  if (set) {
    material.map = set.map;
    material.normalMap = set.normalMap;
    material.roughnessMap = set.roughnessMap;
  }
  const litRatio = [0.14, 0.18, 0.12, 0.16][type] ?? 0.14;

  material.onBeforeCompile = (shader) => {
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
float warm = mix(0.8, 0.5 + 0.5 * windowHash(cellId + 3.1, vSeedF), detail);
totalEmissiveRadiance *= lit * warm;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.08, glass);`,
      );
  };
  // chave única por tipo para o three não reaproveitar o programa de outro material
  material.customProgramCacheKey = () => `facade-${type}-${set ? 'pbr' : 'flat'}`;
  return material;
}
