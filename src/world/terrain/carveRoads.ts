/**
 * Aplaina o terreno sob as estradas (door 5 da city-terrain), função pura.
 *
 * Cada amostra do `Heightmap` a até `width/2 + 6 m` de um ponto de estrada
 * fora de ponte é "dona" do ponto que a cobre melhor (menor `distância −
 * width/2`, então num cruzamento vence a estrada cujo eixo está mais perto).
 * Até `width/2` a amostra fica na altura da estrada; nos 6 m seguintes mistura
 * suavemente com a altura original. Sob pontes nada muda. Numa estrada com
 * `bank` (ponta de avenida no anel), a altura acompanha a inclinação
 * transversal da fita, presa à das bordas.
 */
import type { RoadNetwork } from '../roads/RoadGenerator';
import { pointHeading } from '../roads/roadMesh';
import type { Heightmap } from './TerrainGenerator';

export const CARVE_BLEND = 6;

export function carveRoads(hm: Heightmap, network: RoadNetwork): Heightmap {
  const n = hm.size;
  const heights = new Float32Array(hm.heights);
  const score = new Float32Array(n * n).fill(Infinity);
  const dist = new Float32Array(n * n);
  const half = new Float32Array(n * n);
  const target = new Float32Array(n * n);
  for (const road of network.roads) {
    const p = road.points;
    const w2 = road.width / 2;
    const reach = w2 + CARVE_BLEND;
    const onBridge = new Uint8Array(p.length / 3);
    // numa estrada fechada, o trecho que passa pela costura tem `to` ≥ n
    for (const b of road.bridges) for (let i = b.from; i <= b.to; i++) onBridge[i % onBridge.length] = 1;
    for (let i = 0; i < p.length / 3; i++) {
      if (onBridge[i]) continue;
      const px = p[i * 3]!;
      const py = p[i * 3 + 1]!;
      const pz = p[i * 3 + 2]!;
      const bank = road.bank?.[i] ?? 0;
      const h = bank !== 0 ? pointHeading(road, i) : 0;
      // esquerda do heading, por metro de largura: a altura sobe `bank` na borda esquerda
      const lx = Math.cos(h) / w2;
      const lz = -Math.sin(h) / w2;
      const ix0 = Math.max(0, Math.ceil((px - reach - hm.origin) / hm.spacing));
      const ix1 = Math.min(n - 1, Math.floor((px + reach - hm.origin) / hm.spacing));
      const iz0 = Math.max(0, Math.ceil((pz - reach - hm.origin) / hm.spacing));
      const iz1 = Math.min(n - 1, Math.floor((pz + reach - hm.origin) / hm.spacing));
      for (let iz = iz0; iz <= iz1; iz++) {
        const dz = hm.origin + iz * hm.spacing - pz;
        for (let ix = ix0; ix <= ix1; ix++) {
          const dx = hm.origin + ix * hm.spacing - px;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d > reach) continue;
          const k = iz * n + ix;
          const sc = d - w2;
          if (sc < score[k]!) {
            score[k] = sc;
            dist[k] = d;
            half[k] = w2;
            target[k] = bank === 0 ? py : py + bank * Math.min(1, Math.max(-1, dx * lx + dz * lz));
          }
        }
      }
    }
  }
  for (let k = 0; k < n * n; k++) {
    if (score[k] === Infinity) continue;
    const y = target[k]!;
    if (dist[k]! <= half[k]!) {
      heights[k] = y;
    } else {
      const t = Math.min(1, (dist[k]! - half[k]!) / CARVE_BLEND);
      const s = t * t * (3 - 2 * t);
      heights[k] = y + (heights[k]! - y) * s;
    }
  }
  return { size: hm.size, spacing: hm.spacing, origin: hm.origin, heights };
}
