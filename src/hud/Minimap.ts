import type { CarState } from '../vehicle/Car';
import type { RoadNetwork } from '../world/roads/RoadGenerator';
import { MINIMAP_SIZE_PX, minimapSegments, type MinimapMark } from './minimapMath';

export const MINIMAP_ROAD_COLOR = '#4a5068';
/** redesenhos por segundo de simulação, no máximo (smooth-world AC 18) */
export const MINIMAP_HZ = 30;

/**
 * Minimapa 2D: estradas da janela de 320 m como linhas, carro como triângulo no centro (city-terrain AC 34).
 * Redesenha no máximo 30 vezes por segundo de simulação, e logo que o estado da corrida muda.
 */
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  private lastDraw = -Infinity;
  private lastRace: string | null = null;
  /** redesenhos feitos (para as provas) */
  draws = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly network: RoadNetwork,
  ) {
    canvas.width = MINIMAP_SIZE_PX;
    canvas.height = MINIMAP_SIZE_PX;
    this.ctx = canvas.getContext('2d')!;
  }

  /**
   * `marks`: marcas de corrida já projetadas (`minimapRaceMarks`), desenhadas sobre as estradas.
   * `time`: relógio da simulação (s); `race`: estado da corrida. Sem mudança na corrida, só redesenha
   * passado 1/30 s de simulação do último desenho (a soma de passos fica uns ulps abaixo: folga de 1e-9).
   */
  update(state: CarState, marks: ReadonlyArray<MinimapMark>, time: number, race: string): void {
    if (race === this.lastRace && time - this.lastDraw < 1 / MINIMAP_HZ - 1e-9) return;
    this.lastRace = race;
    this.lastDraw = time;
    this.draws++;
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

    // corrida (races AC 7, 12, 22): marcador = disco, portão = quadrado, oponente = ponto
    for (const m of marks) {
      ctx.fillStyle = m.color;
      if (m.kind === 'gate') ctx.fillRect(m.x - 4, m.y - 4, 8, 8);
      else {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.kind === 'marker' ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
      }
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
