/**
 * Gerador procedural determinístico da cidade (door 6). Só dados: nenhum
 * objeto do three aqui. `CityScene` transforma este layout em meshes e
 * colliders.
 *
 * Grid 8×8 de quarteirões de 40 m separados por ruas de 12 m. Sem rua nas
 * bordas: o mundo vai de -202 a +202 em x e z e termina em paredes invisíveis.
 */
export const GRID_SIZE = 8;
export const BLOCK_SIZE = 40;
export const STREET_WIDTH = 12;
export const PITCH = BLOCK_SIZE + STREET_WIDTH; // 52
export const CITY_EXTENT = (GRID_SIZE * BLOCK_SIZE + (GRID_SIZE - 1) * STREET_WIDTH) / 2; // 202
export const LAMP_SPACING = 40;
export const DEFAULT_SEED = 1337;
export const FACADE_TYPES = 4;
export const LANE_MARK_SPACING = 6;

export const NEON_PALETTE = ['#ff2d95', '#00e5ff', '#b026ff', '#ffd400'] as const;
export type NeonColor = (typeof NEON_PALETTE)[number];

export interface Building {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  /** 0 concreto, 1 metal, 2 tijolo, 3 reboco (visual-upgrade AC 5) */
  facadeType: number;
}

export interface Sign {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  /** rotação em Y (rad) para a face apontar para fora do prédio */
  rotationY: number;
  color: NeonColor;
}

export interface Lamp {
  x: number;
  z: number;
  /** eixo ao longo do qual corre a rua deste poste */
  axis: 'x' | 'z';
}

export interface Block {
  x: number;
  z: number;
  buildings: Building[];
  signs: Sign[];
}

export interface Street {
  axis: 'x' | 'z';
  /** coordenada lateral do centro da rua (z para ruas ao longo de x, x para ruas ao longo de z) */
  at: number;
  /** posições ao longo da rua dos traços da faixa central, a cada 6 m */
  laneMarks: number[];
}

export interface CityLayout {
  seed: number;
  gridSize: number;
  blockSize: number;
  streetWidth: number;
  bounds: number;
  blocks: Block[];
  streets: Street[];
  lamps: Lamp[];
}

/** PRNG pequeno e determinístico. Mesmo seed, mesma sequência. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blockCenter(i: number): number {
  return -CITY_EXTENT + BLOCK_SIZE / 2 + i * PITCH;
}

const MARGIN = 3; // calçada entre a rua e a fachada

/** Divide o quarteirão em 1..4 lotes e ergue um prédio em cada. */
function buildingsFor(block: { x: number; z: number }, rng: () => number): Building[] {
  const count = 1 + Math.floor(rng() * 4);
  const inner = BLOCK_SIZE - 2 * MARGIN; // 34
  const half = inner / 2;
  const lots: Array<{ x: number; z: number; w: number; d: number }> = [];

  if (count === 1) {
    lots.push({ x: 0, z: 0, w: inner, d: inner });
  } else if (count === 2) {
    lots.push({ x: -half / 2, z: 0, w: half, d: inner });
    lots.push({ x: half / 2, z: 0, w: half, d: inner });
  } else if (count === 3) {
    lots.push({ x: -half / 2, z: 0, w: half, d: inner });
    lots.push({ x: half / 2, z: -half / 2, w: half, d: half });
    lots.push({ x: half / 2, z: half / 2, w: half, d: half });
  } else {
    lots.push({ x: -half / 2, z: -half / 2, w: half, d: half });
    lots.push({ x: half / 2, z: -half / 2, w: half, d: half });
    lots.push({ x: -half / 2, z: half / 2, w: half, d: half });
    lots.push({ x: half / 2, z: half / 2, w: half, d: half });
  }

  const gap = 1.5; // respiro entre prédios do mesmo quarteirão
  return lots.map((lot) => ({
    x: block.x + lot.x,
    z: block.z + lot.z,
    width: lot.w - gap,
    depth: lot.d - gap,
    height: 10 + rng() * 50,
    facadeType: 0, // atribuído depois por um PRNG próprio, sem mudar o layout
  }));
}

/** 1..2 letreiros por quarteirão, cada um na fachada de um prédio. */
function signsFor(buildings: Building[], rng: () => number): Sign[] {
  const count = 1 + Math.floor(rng() * 2);
  const signs: Sign[] = [];
  for (let i = 0; i < count; i++) {
    const b = buildings[Math.floor(rng() * buildings.length)]!;
    const face = Math.floor(rng() * 4); // 0 +z, 1 -z, 2 +x, 3 -x
    const color = NEON_PALETTE[Math.floor(rng() * NEON_PALETTE.length)]!;
    const width = Math.min(10, (face < 2 ? b.width : b.depth) * 0.7);
    const height = 2;
    const y = Math.min(b.height - 2, 4 + rng() * (b.height * 0.5));
    const offset = 0.15; // um pouco à frente da parede para não brigar com ela
    let x = b.x;
    let z = b.z;
    let rotationY = 0;
    if (face === 0) {
      z = b.z + b.depth / 2 + offset;
      rotationY = 0;
    } else if (face === 1) {
      z = b.z - b.depth / 2 - offset;
      rotationY = Math.PI;
    } else if (face === 2) {
      x = b.x + b.width / 2 + offset;
      rotationY = Math.PI / 2;
    } else {
      x = b.x - b.width / 2 - offset;
      rotationY = -Math.PI / 2;
    }
    signs.push({ x, y, z, width, height, rotationY, color });
  }
  return signs;
}

/** Traços da faixa central: um a cada 6 m, começando 3 m depois da borda. */
function laneMarksFor(): number[] {
  const length = 2 * CITY_EXTENT; // 404
  const count = Math.floor(length / LANE_MARK_SPACING); // 67
  const marks: number[] = [];
  for (let i = 0; i < count; i++) marks.push(-CITY_EXTENT + LANE_MARK_SPACING / 2 + i * LANE_MARK_SPACING);
  return marks;
}

function streetsFor(): Street[] {
  const streets: Street[] = [];
  for (let i = 0; i < GRID_SIZE - 1; i++) {
    const at = blockCenter(i) + PITCH / 2; // meio da rua entre o quarteirão i e i+1
    streets.push({ axis: 'x', at, laneMarks: laneMarksFor() });
    streets.push({ axis: 'z', at, laneMarks: laneMarksFor() });
  }
  return streets;
}

/** Postes a cada 40 m nos dois lados de cada rua, começando 20 m depois da borda. */
function lampsFor(streets: Street[]): Lamp[] {
  const lamps: Lamp[] = [];
  const length = 2 * CITY_EXTENT; // 404
  const count = Math.floor(length / LAMP_SPACING); // 10
  const side = STREET_WIDTH / 2 - 0.6; // no meio-fio
  for (const street of streets) {
    for (let i = 0; i < count; i++) {
      const along = -CITY_EXTENT + LAMP_SPACING / 2 + i * LAMP_SPACING;
      for (const s of [-1, 1]) {
        if (street.axis === 'x') {
          lamps.push({ x: along, z: street.at + s * side, axis: 'x' });
        } else {
          lamps.push({ x: street.at + s * side, z: along, axis: 'z' });
        }
      }
    }
  }
  return lamps;
}

export function generateCity(seed: number = DEFAULT_SEED): CityLayout {
  const rng = mulberry32(seed);
  const blocks: Block[] = [];
  for (let iz = 0; iz < GRID_SIZE; iz++) {
    for (let ix = 0; ix < GRID_SIZE; ix++) {
      const center = { x: blockCenter(ix), z: blockCenter(iz) };
      const buildings = buildingsFor(center, rng);
      const signs = signsFor(buildings, rng);
      blocks.push({ ...center, buildings, signs });
    }
  }
  // fachadas com um PRNG separado: o layout de prédios de um seed continua o mesmo de antes
  const facadeRng = mulberry32(seed ^ 0x5bd1e995);
  for (const block of blocks) {
    for (const b of block.buildings) b.facadeType = Math.floor(facadeRng() * FACADE_TYPES);
  }
  const streets = streetsFor();
  return {
    seed,
    gridSize: GRID_SIZE,
    blockSize: BLOCK_SIZE,
    streetWidth: STREET_WIDTH,
    bounds: CITY_EXTENT,
    blocks,
    streets,
    lamps: lampsFor(streets),
  };
}
