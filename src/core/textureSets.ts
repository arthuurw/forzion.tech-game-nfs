/**
 * Sets CC0 do ambientCG em public/textures/<Set>/ (door 1 do visual-upgrade)
 * e qual set veste cada tipo de fachada. Módulo puro: o Loader e a cena
 * importam daqui, e o vitest prova o mapeamento sem precisar de three.
 */
export const TEXTURE_SETS = [
  'Asphalt012',
  'PavingStones070',
  'Concrete034',
  'MetalPlates006',
  'Bricks059',
  'PaintedPlaster017',
] as const;
export type TextureSetName = (typeof TEXTURE_SETS)[number];

/** Fachadas por `facadeType`: 0 concreto, 1 metal, 2 tijolo, 3 reboco. */
export const FACADE_SETS: readonly TextureSetName[] = ['Concrete034', 'MetalPlates006', 'Bricks059', 'PaintedPlaster017'];

export const ROAD_SET: TextureSetName = 'Asphalt012';
export const SIDEWALK_SET: TextureSetName = 'PavingStones070';
