/**
 * Nível de qualidade gráfica lido de `?quality=` (door 5 do visual-upgrade).
 * `low` desliga GTAO e o Reflector e reduz a chuva; qualquer outro valor é `high`.
 */
export type QualityLevel = 'high' | 'low';

export interface QualityPreset {
  level: QualityLevel;
  gtao: boolean;
  reflector: boolean;
  rainCount: number;
}

export const RAIN_COUNT_HIGH = 4000;
export const RAIN_COUNT_LOW = 1000;

export function parseQuality(search: string): QualityLevel {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get('quality') === 'low' ? 'low' : 'high';
}

export function qualityPreset(level: QualityLevel): QualityPreset {
  if (level === 'low') return { level, gtao: false, reflector: false, rainCount: RAIN_COUNT_LOW };
  return { level, gtao: true, reflector: true, rainCount: RAIN_COUNT_HIGH };
}
