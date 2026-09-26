import RAPIER from '@dimforge/rapier3d-compat';
import type { Lot } from './lots/LotGenerator';
import type { RoadNetwork } from './roads/RoadGenerator';
import { bridgeMeshes, bridgeParts, PILLAR_SIZE } from './roads/bridges';
import { roadStripGeometry } from './roads/roadMesh';
import type { Heightmap } from './terrain/TerrainGenerator';
import { WORLD_HALF } from './worldMath';

/**
 * Colliders estáticos do mundo da city-terrain, todos criados no boot (door 4):
 * um heightfield para o terreno aplainado, um trimesh por estrada (a fita do
 * asfalto, 5 cm acima do terreno), trimesh dos guarda-corpos das pontes,
 * cuboides para pilares e prédios, e 4 paredes nas bordas.
 */
export class WorldPhysics {
  readonly body: RAPIER.RigidBody;
  readonly walls: Array<{ x: number; z: number; hx: number; hz: number }> = [];

  constructor(
    private readonly world: RAPIER.World,
    carved: Heightmap,
    raw: Heightmap,
    network: RoadNetwork,
    lots: Lot[],
  ) {
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    // heightfield: matriz em column-major com linhas ao longo de z e colunas ao longo de x;
    // `nrows`/`ncols` contam subdivisões (768), a matriz tem 769 × 769 alturas
    const n = carved.size;
    const hf = new Float32Array(n * n);
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) hf[ix * n + iz] = carved.heights[iz * n + ix]!;
    }
    const span = (n - 1) * carved.spacing;
    world.createCollider(RAPIER.ColliderDesc.heightfield(n - 1, n - 1, hf, { x: span, y: 1, z: span }), this.body);

    for (const road of network.roads) {
      const last = road.closed ? road.points.length / 3 : road.points.length / 3 - 1;
      const strip = roadStripGeometry(road, 0, last);
      world.createCollider(RAPIER.ColliderDesc.trimesh(strip.positions, strip.indices), this.body);
      for (const range of road.bridges) {
        const parts = bridgeParts(road, range, raw);
        for (const rail of bridgeMeshes(road, parts).rails) {
          world.createCollider(RAPIER.ColliderDesc.trimesh(rail.positions, rail.indices), this.body);
        }
        for (const p of parts.pillars) {
          const h = (p.top - p.bottom) / 2;
          world.createCollider(
            RAPIER.ColliderDesc.cuboid(PILLAR_SIZE / 2, h, PILLAR_SIZE / 2)
              .setTranslation(p.x, p.bottom + h, p.z)
              .setRotation(yaw(p.heading)),
            this.body,
          );
        }
      }
    }

    // prédios: o eixo local z do cuboide acompanha a rua (largura), o x vai para dentro do lote (profundidade)
    for (const l of lots) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(l.depth / 2, l.height / 2, l.width / 2)
          .setTranslation(l.x, l.y + l.height / 2, l.z)
          .setRotation(yaw(l.rotation)),
        this.body,
      );
    }

    // paredes invisíveis nas bordas (AC 35)
    const t = 1;
    const wallH = 200;
    for (const [x, z, hx, hz] of [
      [WORLD_HALF + t, 0, t, WORLD_HALF + 2 * t],
      [-WORLD_HALF - t, 0, t, WORLD_HALF + 2 * t],
      [0, WORLD_HALF + t, WORLD_HALF + 2 * t, t],
      [0, -WORLD_HALF - t, WORLD_HALF + 2 * t, t],
    ] as const) {
      world.createCollider(RAPIER.ColliderDesc.cuboid(hx, wallH, hz).setTranslation(x, 0, z), this.body);
      this.walls.push({ x, z, hx, hz });
    }
  }

  /** Altura do primeiro collider estático abaixo de (x, 400, z), ou null. */
  raycastDown(x: number, z: number): number | null {
    const ray = new RAPIER.Ray({ x, y: 400, z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, 1000, true, undefined, undefined, undefined, undefined, (c) => c.parent()?.handle === this.body.handle);
    return hit ? 400 - hit.timeOfImpact : null;
  }
}

function yaw(heading: number): { x: number; y: number; z: number; w: number } {
  return { x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) };
}
