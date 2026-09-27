/**
 * Objetos do miolo das quadras (door 2 da block-fill), função pura
 * `placeInteriorProps(seed, interiors, lots, carved)`. Os mesmos dados
 * alimentam o render (`InteriorScene`), a física (`WorldPhysics`) e os
 * pedestres (`Game`).
 *
 * - quintal: atrás de cada casa (lote fora do centro) com 8 m de chão livre
 *   atrás da fachada de fundo; poste de jardim de 2.5 m a 4-8 m da fachada e
 *   um cordão de 6 lâmpadas da fachada (a 2.2 m) até o topo do poste;
 * - piscina 4 × 8 m em ~30 % dos quintais, só onde cabe inteira na zona;
 * - árvores em zonas de fora, longe 6 m ou mais das casas, em chão de até
 *   35 % de inclinação, a 7 m ou mais uma da outra e no máximo 1 por 120 m²;
 * - canteiros de obra nas 6 maiores zonas do centro com 1500 m² ou mais;
 * - pontos de partida dos pedestres, 3 por 1000 m² de zona.
 */
import { mulberry32 } from '../CityGenerator';
import type { Lot } from '../lots/LotGenerator';
import { heightAt, type Heightmap } from '../terrain/TerrainGenerator';
import { nearestVertex, type BlockInteriors } from './BlockInteriors';

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface Yard {
  lotIndex: number;
  zoneId: number;
  /** topo do poste (2.5 m acima do terreno) */
  lamp: Point3;
  /** 6 lâmpadas do cordão, da fachada até o poste */
  bulbs: Point3[];
}

export interface Pool {
  x: number;
  /** superfície da água: terreno no centro + 0.05 m */
  y: number;
  z: number;
  /** ao longo de (sin rotation, cos rotation): 4 m */
  w: number;
  /** ao longo de (cos rotation, −sin rotation): 8 m */
  d: number;
  rotation: number;
  zoneId: number;
  /** índice do quintal em `yards` */
  yard: number;
}

export interface Tree {
  x: number;
  y: number;
  z: number;
  height: number;
  /** raio da copa (m) */
  crown: number;
  zoneId: number;
}

export interface Floodlight {
  x: number;
  y: number;
  z: number;
  /** direção do facho no meio da varredura (heading: 0 = +z) */
  heading: number;
}

export interface ConstructionSite {
  x: number;
  y: number;
  z: number;
  towerHeight: number;
  jibLength: number;
  floodlights: Floodlight[];
  zoneId: number;
}

export interface WalkerSpawn {
  zoneId: number;
  x: number;
  z: number;
}

// block-life-extras (door 1): estacionamentos, grades de vapor, gatos e holofotes

export interface ParkedCar {
  x: number;
  /** terreno sob o carro */
  y: number;
  z: number;
  heading: number;
  paint: string;
  zoneId: number;
}

export interface Vent {
  x: number;
  y: number;
  z: number;
  zoneId: number;
}

export interface CatSpawn {
  zoneId: number;
  x: number;
  z: number;
  /** índice do quintal em `yards`, ou `null` numa zona de fora */
  yard: number | null;
}

export interface Searchlight {
  x: number;
  /** teto do prédio: `lot.y + lot.height` */
  y: number;
  z: number;
  lotIndex: number;
  /** segundos por volta */
  period: number;
  phase: number;
}

export interface InteriorProps {
  yards: Yard[];
  pools: Pool[];
  trees: Tree[];
  sites: ConstructionSite[];
  walkers: WalkerSpawn[];
  parking: ParkedCar[];
  vents: Vent[];
  cats: CatSpawn[];
  searchlights: Searchlight[];
}

/** cores dos carros estacionados */
export const PARKED_PAINTS = ['#e8e8e8', '#b9bcc4', '#1a1a1e', '#7a1f22', '#1d2a55', '#1f4a2e', '#c9b48a', '#5a5c63'] as const;
export const PARKING_MIN_AREA = 800;
export const PARKING_PITCH = 2.8;
/** fileiras a 6.5 m entre si (o mínimo é 6; a folga evita o empate de float) */
export const PARKING_ROW_GAP = 6.5;
export const PARKING_OCCUPANCY = 0.6;
export const PARKING_MAX = 160;
/** vagas por fileira e fileiras por pátio, para não lotar o pátio inteiro */
export const PARKING_ROW_SLOTS = 8;
export const PARKING_ROWS = 3;
export const PARKING_SITE_CLEAR = 12;
export const PARKING_PROP_CLEAR = 8;
export const VENT_AREA = 500;
export const VENT_MAX = 120;
export const VENT_FACADE_MIN = 3;
export const VENT_FACADE_MAX = 12;
export const VENT_SPACING = 6;
export const VENT_PARKING_CLEAR = 4;
export const VENT_SITE_CLEAR = 12;
export const CAT_YARD_CHANCE = 0.35;
export const CAT_YARD_SALT = 0xca75;
export const CAT_AREA = 2000;
export const SEARCHLIGHTS = 4;
export const SEARCHLIGHT_SPACING = 250;
export const SEARCHLIGHT_PERIOD_MIN = 32;
export const SEARCHLIGHT_PERIOD_MAX = 48;

export const YARD_DEPTH = 8;
export const YARD_LAMP_HEIGHT = 2.5;
export const YARD_BULB_HEIGHT = 2.2;
export const YARD_BULBS = 6;
export const POOL_CHANCE = 0.3;
export const POOL_W = 4;
export const POOL_D = 8;
export const TREE_MIN_FACADE = 6;
export const TREE_MAX_SLOPE = 0.35;
export const TREE_SPACING = 7;
export const TREE_AREA = 120;
export const SITE_MIN_AREA = 1500;
export const SITE_MAX = 6;
export const JIB_LENGTH = 30;
/** altura dos holofotes na torre e distância do centro do facho no chão (m) */
export const FLOOD_MOUNT = 12;
export const FLOOD_REACH = 14;

/** Centro da fachada de fundo e direção "para trás" (para fora do lote, oposta à rua). */
export function backFacade(l: Lot): { x: number; z: number; bx: number; bz: number; ax: number; az: number } {
  // a rua fica do lado −side·esquerda do centro do lote; esquerda do heading r = (cos r, −sin r)
  const bx = Math.cos(l.rotation) * l.side;
  const bz = -Math.sin(l.rotation) * l.side;
  return {
    x: l.x + (bx * l.depth) / 2,
    z: l.z + (bz * l.depth) / 2,
    bx,
    bz,
    // ao longo da fachada
    ax: Math.sin(l.rotation),
    az: Math.cos(l.rotation),
  };
}

/** Distância horizontal de (x, z) ao segmento da fachada de fundo do lote. */
export function backFacadeDistance(l: Lot, x: number, z: number): number {
  const f = backFacade(l);
  const u = (x - f.x) * f.ax + (z - f.z) * f.az;
  const v = (x - f.x) * f.bx + (z - f.z) * f.bz;
  const over = Math.max(0, Math.abs(u) - l.width / 2);
  return Math.hypot(over, v);
}

function vertexXZ(bi: BlockInteriors, k: number): [number, number] {
  return [bi.origin + (k % bi.size) * bi.spacing, bi.origin + Math.floor(k / bi.size) * bi.spacing];
}

/** Cantos (x, z) de um retângulo com `w` ao longo de (sin r, cos r) e `d` ao longo de (cos r, −sin r). */
export function rectCorners(x: number, z: number, w: number, d: number, rotation: number): Array<[number, number]> {
  const fx = Math.sin(rotation);
  const fz = Math.cos(rotation);
  const lx = Math.cos(rotation);
  const lz = -Math.sin(rotation);
  const out: Array<[number, number]> = [];
  for (const [a, b] of [[1, 1], [1, -1], [-1, -1], [-1, 1]] as const) {
    out.push([x + (fx * a * w) / 2 + (lx * b * d) / 2, z + (fz * a * w) / 2 + (lz * b * d) / 2]);
  }
  return out;
}

export function placeInteriorProps(seed: number, interiors: BlockInteriors, lots: Lot[], carved: Heightmap): InteriorProps {
  const bi = interiors;
  const zoneAtXZ = (x: number, z: number) => bi.zoneOf[nearestVertex(bi, x, z)]!;
  const H = (k: number) => carved.heights[k]!;

  // --- quintais ---
  const yards: Yard[] = [];
  lots.forEach((l, lotIndex) => {
    if (l.downtown) return;
    const f = backFacade(l);
    for (let t = 0; t <= YARD_DEPTH; t++) if (zoneAtXZ(f.x + f.bx * t, f.z + f.bz * t) < 0) return;
    let lampK = -1;
    for (const t of [6, 5, 7, 5.5, 6.5, 4.5, 7.5]) {
      const k = nearestVertex(bi, f.x + f.bx * t, f.z + f.bz * t);
      if (bi.zoneOf[k]! < 0) continue;
      const [x, z] = vertexXZ(bi, k);
      const d = backFacadeDistance(l, x, z);
      if (d < 4 || d > 8) continue;
      lampK = k;
      break;
    }
    if (lampK < 0) return;
    const [lx, lz] = vertexXZ(bi, lampK);
    const lamp = { x: lx, y: H(lampK) + YARD_LAMP_HEIGHT, z: lz };
    const start = { x: f.x, y: heightAt(carved, f.x, f.z) + YARD_BULB_HEIGHT, z: f.z };
    const bulbs: Point3[] = [];
    for (let i = 0; i < YARD_BULBS; i++) {
      const s = (i + 0.5) / YARD_BULBS;
      const sag = 0.3 * 4 * s * (1 - s); // o cordão cede no meio
      bulbs.push({
        x: start.x + (lamp.x - start.x) * s,
        y: start.y + (lamp.y - start.y) * s - sag,
        z: start.z + (lamp.z - start.z) * s,
      });
    }
    yards.push({ lotIndex, zoneId: bi.zoneOf[lampK]!, lamp, bulbs });
  });

  // --- piscinas: 30 % dos quintais, sorteados pelo seed entre os que cabem a piscina inteira numa zona ---
  const poolRng = mulberry32(seed ^ 0x9001ab);
  const fits: Pool[] = [];
  yards.forEach((yard, yardIndex) => {
    const l = lots[yard.lotIndex]!;
    const f = backFacade(l);
    const rotation = Math.atan2(f.bx, f.bz); // w (4 m) para trás, d (8 m) ao longo da fachada
    for (const t of [3.5, 4, 3, 4.5, 5, 5.5, 6]) {
      for (const s of [0, 1, -1, 2, -2, 3, -3]) {
        const x = f.x + f.bx * t + f.ax * s;
        const z = f.z + f.bz * t + f.az * s;
        const zone = zoneAtXZ(x, z);
        if (zone < 0) continue;
        const corners = rectCorners(x, z, POOL_W, POOL_D, rotation);
        if (!corners.every(([cx, cz]) => zoneAtXZ(cx, cz) === zone)) continue;
        // o poste fica fora da piscina (com 0.5 m de folga)
        const u = (yard.lamp.x - x) * Math.sin(rotation) + (yard.lamp.z - z) * Math.cos(rotation);
        const v = (yard.lamp.x - x) * Math.cos(rotation) - (yard.lamp.z - z) * Math.sin(rotation);
        if (Math.abs(u) < POOL_W / 2 + 0.5 && Math.abs(v) < POOL_D / 2 + 0.5) continue;
        fits.push({ x, y: heightAt(carved, x, z) + 0.05, z, w: POOL_W, d: POOL_D, rotation, zoneId: zone, yard: yardIndex });
        return;
      }
    }
  });
  // embaralha (Fisher-Yates) e fica com 30 % do número de quintais, na ordem dos quintais
  for (let i = fits.length - 1; i > 0; i--) {
    const j = Math.floor(poolRng() * (i + 1));
    [fits[i], fits[j]] = [fits[j]!, fits[i]!];
  }
  const pools = fits.slice(0, Math.round(POOL_CHANCE * yards.length)).sort((a, b) => a.yard - b.yard);

  // --- árvores ---
  const treeRng = mulberry32(seed ^ 0x7ee5);
  const trees: Tree[] = [];
  const perZone = new Map<number, number>();
  const cell = 8;
  const treeGrid = new Map<number, number[]>();
  const n = bi.size;
  const slopeAt = (ix: number, iz: number) => {
    const h = (a: number, b: number) => carved.heights[Math.min(n - 1, Math.max(0, b)) * n + Math.min(n - 1, Math.max(0, a))]!;
    const dx = (h(ix + 1, iz) - h(ix - 1, iz)) / (2 * bi.spacing);
    const dz = (h(ix, iz + 1) - h(ix, iz - 1)) / (2 * bi.spacing);
    return Math.hypot(dx, dz);
  };
  for (let k = 0; k < bi.zoneOf.length; k++) {
    const zoneId = bi.zoneOf[k]!;
    if (zoneId < 0) continue;
    const zone = bi.zones[zoneId]!;
    if (zone.kind !== 'outer') continue;
    const fd = bi.facadeDist[k]!;
    if (fd < TREE_MIN_FACADE) continue;
    // mais árvores perto das casas; nos morros vazios, poucas
    const chance = fd < 30 ? 0.06 : 0.003;
    if (treeRng() >= chance) continue;
    const ix = k % n;
    const iz = Math.floor(k / n);
    if (slopeAt(ix, iz) > TREE_MAX_SLOPE) continue;
    const count = perZone.get(zoneId) ?? 0;
    if (count + 1 > zone.areaM2 / TREE_AREA) continue;
    const [x, z] = vertexXZ(bi, k);
    const gx = Math.floor(x / cell);
    const gz = Math.floor(z / cell);
    let near = false;
    for (let a = gx - 1; a <= gx + 1 && !near; a++) {
      for (let b = gz - 1; b <= gz + 1 && !near; b++) {
        for (const j of treeGrid.get(a * 4096 + b) ?? []) {
          if (Math.hypot(trees[j]!.x - x, trees[j]!.z - z) < TREE_SPACING) {
            near = true;
            break;
          }
        }
      }
    }
    if (near) continue;
    const height = 5 + treeRng() * 5;
    const key = gx * 4096 + gz;
    let bucket = treeGrid.get(key);
    if (!bucket) treeGrid.set(key, (bucket = []));
    bucket.push(trees.length);
    trees.push({ x, y: H(k), z, height, crown: 1.2 + height * 0.2, zoneId });
    perZone.set(zoneId, count + 1);
  }

  // --- canteiros de obra: as 6 maiores zonas do centro com 1500 m² ou mais ---
  const siteRng = mulberry32(seed ^ 0xc4a3e);
  const big = bi.zones
    .filter((z) => z.kind === 'downtown' && z.areaM2 >= SITE_MIN_AREA)
    .sort((a, b) => b.areaM2 - a.areaM2 || a.id - b.id)
    .slice(0, SITE_MAX);
  const sites: ConstructionSite[] = big.map((zone) => {
    let x = zone.centroid.x;
    let z = zone.centroid.z;
    if (zoneAtXZ(x, z) !== zone.id) {
      let best = Infinity;
      for (let k = 0; k < bi.zoneOf.length; k++) {
        if (bi.zoneOf[k] !== zone.id) continue;
        const [vx, vz] = vertexXZ(bi, k);
        const d = (vx - zone.centroid.x) ** 2 + (vz - zone.centroid.z) ** 2;
        if (d < best) {
          best = d;
          x = vx;
          z = vz;
        }
      }
    }
    const y = heightAt(carved, x, z);
    const towerHeight = 40 + siteRng() * 20;
    // holofotes: as duas direções (a 90° ou mais uma da outra) com mais chão da zona sob a varredura
    const score = (h: number) => {
      let s = 0;
      for (const da of [-FLOOD_SWEEP_RAD, 0, FLOOD_SWEEP_RAD]) {
        for (const r of [FLOOD_REACH - 4, FLOOD_REACH, FLOOD_REACH + 4]) {
          if (zoneAtXZ(x + Math.sin(h + da) * r, z + Math.cos(h + da) * r) === zone.id) s += da === 0 && r === FLOOD_REACH ? 3 : 1;
        }
      }
      return s;
    };
    const turn = siteRng() * (Math.PI / 8);
    const headings = Array.from({ length: 16 }, (_, i) => turn + (i * Math.PI) / 8);
    const first = headings.reduce((a, b) => (score(b) > score(a) ? b : a));
    const second = headings
      .filter((h) => Math.abs(Math.atan2(Math.sin(h - first), Math.cos(h - first))) >= Math.PI / 2 - 1e-9)
      .reduce((a, b) => (score(b) > score(a) ? b : a));
    const floodlights = [first, second].map((heading) => ({
      x: x + Math.sin(heading) * 1.2,
      y: y + FLOOD_MOUNT,
      z: z + Math.cos(heading) * 1.2,
      heading,
    }));
    return { x, y, z, towerHeight, jibLength: JIB_LENGTH, floodlights, zoneId: zone.id };
  });

  // --- pedestres: 3 por 1000 m² de zona, em vértices sorteados da zona ---
  const walkerRng = mulberry32(seed ^ 0x3a1c);
  const vertsOf: number[][] = bi.zones.map(() => []);
  for (let k = 0; k < bi.zoneOf.length; k++) if (bi.zoneOf[k]! >= 0) vertsOf[bi.zoneOf[k]!]!.push(k);
  const walkers: WalkerSpawn[] = [];
  for (const zone of bi.zones) {
    const verts = vertsOf[zone.id]!;
    const count = Math.floor((zone.areaM2 * 3) / 1000);
    for (let i = 0; i < count; i++) {
      const [x, z] = vertexXZ(bi, verts[Math.floor(walkerRng() * verts.length)]!);
      walkers.push({ zoneId: zone.id, x, z });
    }
  }

  // --- estacionamentos: fileiras nos pátios do centro com 800 m² ou mais (block-life-extras) ---
  // um ponto é "bem dentro" do pátio quando ele e os 8 pontos a 6 m em volta caem na zona e o
  // vértice mais perto fica a 7 m ou mais de qualquer lote: assim o carro fica a 2 m dos lotes
  // e a `w/2 + 2` das estradas mesmo sem a rede aqui (o miolo já exclui `w/2 + 2` m de estrada)
  const wellInside = (zoneId: number, x: number, z: number, radius: number, facade: number): boolean => {
    if (zoneAtXZ(x, z) !== zoneId) return false;
    if (bi.facadeDist[nearestVertex(bi, x, z)]! < facade) return false;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      if (zoneAtXZ(x + Math.sin(a) * radius, z + Math.cos(a) * radius) !== zoneId) return false;
    }
    return true;
  };
  const farFromProps = (x: number, z: number, clear: number): boolean => {
    for (const y of yards) if (Math.hypot(y.lamp.x - x, y.lamp.z - z) < clear) return false;
    for (const p of pools) if (Math.hypot(p.x - x, p.z - z) < clear) return false;
    for (const t of trees) if (Math.hypot(t.x - x, t.z - z) < clear) return false;
    return true;
  };
  const farFromSites = (x: number, z: number, clear: number): boolean => sites.every((s) => Math.hypot(s.x - x, s.z - z) >= clear);
  const parkRng = mulberry32(seed ^ 0x9a4c);
  const parking: ParkedCar[] = [];
  for (const zone of bi.zones) {
    if (zone.kind !== 'downtown' || zone.areaM2 < PARKING_MIN_AREA || parking.length >= PARKING_MAX) continue;
    // os pátios são faixas ao longo da rua: a fileira corre ao longo da rua do lote mais perto do
    // centro do pátio e os carros ficam de nariz para o prédio (heading = rua + 90°)
    let street = 0;
    let bestD = Infinity;
    for (const l of lots) {
      const d = (l.x - zone.centroid.x) ** 2 + (l.z - zone.centroid.z) ** 2;
      if (d < bestD) {
        bestD = d;
        street = l.rotation;
      }
    }
    const heading = street + Math.PI / 2;
    // fileira ao longo da rua (= direita do carro); fileiras separadas ao longo da frente do carro
    const rx = Math.sin(street);
    const rz = Math.cos(street);
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    // centro das fileiras: 40 m do centroide ao longo da rua (o canteiro de obra fica no centroide),
    // no primeiro deslocamento que cai bem dentro da zona
    let cx = zone.centroid.x;
    let cz = zone.centroid.z;
    for (const shift of [40, -40, 80, -80, 0]) {
      const x = zone.centroid.x + rx * shift;
      const z = zone.centroid.z + rz * shift;
      if (wellInside(zone.id, x, z, 4, 5.5)) {
        cx = x;
        cz = z;
        break;
      }
    }
    for (let row = -Math.floor(PARKING_ROWS / 2); row <= Math.floor(PARKING_ROWS / 2); row++) {
      for (let slot = -Math.floor(PARKING_ROW_SLOTS / 2); slot < Math.ceil(PARKING_ROW_SLOTS / 2); slot++) {
        const x = cx + rx * slot * PARKING_PITCH + fx * row * PARKING_ROW_GAP;
        const z = cz + rz * slot * PARKING_PITCH + fz * row * PARKING_ROW_GAP;
        if (!wellInside(zone.id, x, z, 4, 5.5)) continue;
        if (!farFromSites(x, z, PARKING_SITE_CLEAR) || !farFromProps(x, z, PARKING_PROP_CLEAR)) continue;
        if (parkRng() >= PARKING_OCCUPANCY) continue;
        if (parking.length >= PARKING_MAX) break;
        const paint = PARKED_PAINTS[Math.floor(parkRng() * PARKED_PAINTS.length)]!;
        parking.push({ x, y: heightAt(carved, x, z), z, heading, paint, zoneId: zone.id });
      }
    }
  }

  // --- grades de vapor: 1 por 500 m² de pátio, em vértices a 3-12 m do prédio, longe das vagas ---
  const vents: Vent[] = [];
  const ventQuota = new Map<number, number>();
  for (let k = 0; k < bi.zoneOf.length && vents.length < VENT_MAX; k++) {
    const zoneId = bi.zoneOf[k]!;
    if (zoneId < 0) continue;
    const zone = bi.zones[zoneId]!;
    if (zone.kind !== 'downtown') continue;
    const used = ventQuota.get(zoneId) ?? 0;
    if (used >= Math.floor(zone.areaM2 / VENT_AREA)) continue;
    const fd = bi.facadeDist[k]!;
    if (fd < VENT_FACADE_MIN || fd > VENT_FACADE_MAX) continue;
    const [x, z] = vertexXZ(bi, k);
    if (!farFromSites(x, z, VENT_SITE_CLEAR)) continue;
    if (vents.some((v) => Math.hypot(v.x - x, v.z - z) < VENT_SPACING)) continue;
    if (parking.some((p) => Math.hypot(p.x - x, p.z - z) < VENT_PARKING_CLEAR)) continue;
    vents.push({ x, y: H(k), z, zoneId });
    ventQuota.set(zoneId, used + 1);
  }

  // --- gatos: 35 % dos quintais (no poste) e 1 por 2000 m² de zona de fora ---
  const catYardRng = mulberry32(seed ^ CAT_YARD_SALT);
  const cats: CatSpawn[] = [];
  yards.forEach((yard, i) => {
    if (catYardRng() < CAT_YARD_CHANCE) cats.push({ zoneId: yard.zoneId, x: yard.lamp.x, z: yard.lamp.z, yard: i });
  });
  const catRng = mulberry32(seed ^ 0x2ca7);
  for (const zone of bi.zones) {
    if (zone.kind !== 'outer') continue;
    const verts = vertsOf[zone.id]!;
    const count = Math.floor(zone.areaM2 / CAT_AREA);
    for (let i = 0; i < count; i++) {
      const [x, z] = vertexXZ(bi, verts[Math.floor(catRng() * verts.length)]!);
      cats.push({ zoneId: zone.id, x, z, yard: null });
    }
  }

  // --- holofotes: os 4 prédios mais altos do centro a 250 m ou mais entre si ---
  const lightRng = mulberry32(seed ^ 0x5ea7);
  const searchlights: Searchlight[] = [];
  const tall = lots.map((l, i) => ({ l, i })).filter((e) => e.l.downtown).sort((a, b) => b.l.height - a.l.height || a.i - b.i);
  for (const { l, i } of tall) {
    if (searchlights.length >= SEARCHLIGHTS) break;
    if (searchlights.some((s) => Math.hypot(s.x - l.x, s.z - l.z) < SEARCHLIGHT_SPACING)) continue;
    searchlights.push({
      x: l.x,
      y: l.y + l.height,
      z: l.z,
      lotIndex: i,
      period: SEARCHLIGHT_PERIOD_MIN + lightRng() * (SEARCHLIGHT_PERIOD_MAX - SEARCHLIGHT_PERIOD_MIN),
      phase: lightRng() * Math.PI * 2,
    });
  }

  return { yards, pools, trees, sites, walkers, parking, vents, cats, searchlights };
}

const FLOOD_SWEEP_RAD = Math.PI / 6;
