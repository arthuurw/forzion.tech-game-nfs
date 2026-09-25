import type { CityLayout } from '../world/CityGenerator';
import type { CarState } from '../vehicle/Car';
import { MINIMAP_SCALE, MINIMAP_SIZE_PX, worldToMinimap } from './minimapMath';

/** Minimapa 2D: quarteirões como retângulos, carro como triângulo no centro (AC 23). */
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly layout: CityLayout,
  ) {
    canvas.width = MINIMAP_SIZE_PX;
    canvas.height = MINIMAP_SIZE_PX;
    this.ctx = canvas.getContext('2d')!;
  }

  update(state: CarState): void {
    const ctx = this.ctx;
    const size = MINIMAP_SIZE_PX;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(5, 6, 13, 0.75)';
    ctx.fillRect(0, 0, size, size);

    const half = (this.layout.blockSize / 2) * MINIMAP_SCALE;
    ctx.fillStyle = '#2b2d3d';
    for (const block of this.layout.blocks) {
      const p = worldToMinimap(block.x, block.z, state);
      if (p.x < -half || p.x > size + half || p.y < -half || p.y > size + half) continue;
      ctx.fillRect(p.x - half, p.y - half, half * 2, half * 2);
    }

    // carro: triângulo apontando na direção do heading (+z do mundo = para baixo no mapa)
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(-state.heading);
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(-5, -5);
    ctx.lineTo(5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
