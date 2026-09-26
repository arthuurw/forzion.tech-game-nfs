import type { CarState } from '../vehicle/Car';
import type { RoadNetwork } from '../world/roads/RoadGenerator';
import { MINIMAP_SIZE_PX, minimapSegments } from './minimapMath';

export const MINIMAP_ROAD_COLOR = '#4a5068';

/** Minimapa 2D: estradas da janela de 320 m como linhas, carro como triângulo no centro (city-terrain AC 34). */
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly network: RoadNetwork,
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

    ctx.strokeStyle = MINIMAP_ROAD_COLOR;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of minimapSegments(this.network, state)) {
      ctx.moveTo(x1!, y1!);
      ctx.lineTo(x2!, y2!);
    }
    ctx.stroke();

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
