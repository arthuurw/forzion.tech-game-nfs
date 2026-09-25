import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { NEON_PALETTE, mulberry32, type CityLayout } from './CityGenerator';

/**
 * Transforma o `CityLayout` (dados) em meshes instanciados e colliders fixos.
 * Instancing é o que mantém a cidade inteira em ~8 draw calls: um
 * `InstancedMesh` por tipo de peça, com a matriz de cada instância dizendo
 * onde e de que tamanho ela é.
 */
export class CityScene {
  readonly roadMaterial: THREE.MeshStandardMaterial;
  readonly windowMaterial: THREE.MeshStandardMaterial;
  readonly signMaterials: THREE.MeshStandardMaterial[] = [];
  readonly lampMaterial: THREE.MeshStandardMaterial;
  readonly group = new THREE.Group();

  constructor(
    readonly layout: CityLayout,
    scene: THREE.Scene,
    world: RAPIER.World,
  ) {
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: '#0c0d14',
      roughness: 0.18,
      metalness: 0.45,
      envMapIntensity: 1.4,
    });
    this.windowMaterial = new THREE.MeshStandardMaterial({
      color: '#14151f',
      roughness: 0.7,
      metalness: 0.1,
      emissive: '#ffffff',
      emissiveIntensity: 2.0,
      emissiveMap: makeWindowTexture(layout.seed),
    });
    this.lampMaterial = new THREE.MeshStandardMaterial({
      color: '#000000',
      emissive: '#ffd9a0',
      emissiveIntensity: 2.5,
    });

    this.group.add(this.buildGround(layout));
    this.group.add(this.buildSidewalks(layout));
    this.group.add(this.buildBuildings(layout));
    this.group.add(...this.buildLamps(layout));
    this.group.add(...this.buildSigns(layout));
    scene.add(this.group);

    this.buildColliders(layout, world);
  }

  private buildGround(layout: CityLayout): THREE.Mesh {
    const size = layout.bounds * 2 + 40;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.roadMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    return ground;
  }

  private buildSidewalks(layout: CityLayout): THREE.InstancedMesh {
    const height = 0.15;
    const geometry = new THREE.BoxGeometry(layout.blockSize, height, layout.blockSize);
    const material = new THREE.MeshStandardMaterial({ color: '#1c1d26', roughness: 0.9 });
    const mesh = new THREE.InstancedMesh(geometry, material, layout.blocks.length);
    const m = new THREE.Matrix4();
    layout.blocks.forEach((block, i) => {
      m.makeTranslation(block.x, height / 2, block.z);
      mesh.setMatrixAt(i, m);
    });
    return mesh;
  }

  private buildBuildings(layout: CityLayout): THREE.InstancedMesh {
    const buildings = layout.blocks.flatMap((b) => b.buildings);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geometry, this.windowMaterial, buildings.length);
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

  /** Um InstancedMesh por cor da paleta: o emissive não varia por instância. */
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
        emissiveIntensity: 3.0,
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

    // paredes invisíveis nos 4 limites (AC 8)
    const wallH = 20;
    const wallT = 1;
    const at = layout.bounds + wallT;
    world.createCollider(RAPIER.ColliderDesc.cuboid(wallT, wallH, extent).setTranslation(at, wallH, 0), ground);
    world.createCollider(RAPIER.ColliderDesc.cuboid(wallT, wallH, extent).setTranslation(-at, wallH, 0), ground);
    world.createCollider(RAPIER.ColliderDesc.cuboid(extent, wallH, wallT).setTranslation(0, wallH, at), ground);
    world.createCollider(RAPIER.ColliderDesc.cuboid(extent, wallH, wallT).setTranslation(0, wallH, -at), ground);
  }
}

/** Textura de janelas acesas: quadradinhos claros num fundo preto, repetida na fachada. */
function makeWindowTexture(seed: number): THREE.CanvasTexture {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 64, 64);
  const cols = 8;
  const rows = 8;
  const cw = 64 / cols;
  const ch = 64 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.32) {
        const warm = rng() < 0.7;
        ctx.fillStyle = warm ? '#ffe2a8' : '#a8d8ff';
        ctx.globalAlpha = 0.18 + rng() * 0.32;
        ctx.fillRect(c * cw + 2, r * ch + 2, cw - 4, ch - 5);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // a face de um prédio vai de 0..1 em UV independente do tamanho, então a
  // repetição define o tamanho da janela: ~3 m de largura num prédio de 25 m
  texture.repeat.set(8, 14);
  texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
