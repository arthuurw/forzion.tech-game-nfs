import { describe, expect, it } from 'vitest';
import { generateTerrain, heightAt, riverCenterX, sampleXZ } from '../../src/world/terrain/TerrainGenerator';

const hm = generateTerrain(1337);

describe('terrain generator', () => {
  // C1 (AC 1, door 3)
  it('terrain is deterministic by seed', () => {
    const again = generateTerrain(1337);
    expect(again.heights.length).toBe(hm.heights.length);
    for (let i = 0; i < hm.heights.length; i++) {
      if (again.heights[i] !== hm.heights[i]) throw new Error(`sample ${i} differs`);
    }
    const other = generateTerrain(1338);
    let differ = 0;
    for (let i = 0; i < hm.heights.length; i++) if (other.heights[i] !== hm.heights[i]) differ++;
    expect(differ).toBeGreaterThanOrEqual(1000);
  });

  // C2 (AC 2, door 1)
  it('769 x 769 samples every 4 m', () => {
    expect(hm.size).toBe(769);
    expect(hm.spacing).toBe(4);
    expect(hm.origin).toBe(-1536);
    expect(hm.heights.length).toBe(591361);
    expect(sampleXZ(hm, 0, 0)).toEqual([-1536, -1536]);
    expect(sampleXZ(hm, 768, 768)).toEqual([1536, 1536]);
    // num ponto de grade: a amostra exata (linha = z, coluna = x)
    const ix = 600;
    const iz = 150;
    const [x, z] = sampleXZ(hm, ix, iz);
    expect(heightAt(hm, x, z)).toBeCloseTo(hm.heights[iz * 769 + ix]!, 6);
    // no meio de 4 amostras: sobre a diagonal da malha, a média das duas pontas dela
    // (era a média bilinear; a smooth-world AC 14 troca pelo triângulo da malha)
    const a = hm.heights[iz * 769 + ix]!;
    const b = hm.heights[iz * 769 + ix + 1]!;
    const c = hm.heights[(iz + 1) * 769 + ix]!;
    expect(heightAt(hm, x + 2, z + 2)).toBeCloseTo((b + c) / 2, 5);
    // um quarto do caminho em x: interpolação linear na linha
    expect(heightAt(hm, x + 1, z)).toBeCloseTo(a + (b - a) * 0.25, 5);
  });

  // smooth-world C19 (AC 14): num ponto de cada triângulo e sobre a diagonal, o plano do triângulo da malha
  it('heightAt follows the mesh diagonal', () => {
    // célula (0, 0) de uma grade 2 × 2 a cada 4 m, com alturas fora de um plano: as duas diagonais dão alturas diferentes
    const [h00, h10, h01, h11] = [1, 5, 2, 11];
    const grid = { size: 2, spacing: 4, origin: 0, heights: new Float32Array([h00, h10, h01, h11]) };
    /** plano pelos 3 vértices (x, z, y) no ponto (x, z) */
    const plane = (p: number[][], x: number, z: number) => {
      const [[x0, z0, y0], [x1, z1, y1], [x2, z2, y2]] = p as [number[], number[], number[]];
      const det = (x1! - x0!) * (z2! - z0!) - (x2! - x0!) * (z1! - z0!);
      const u = ((x - x0!) * (z2! - z0!) - (x2! - x0!) * (z - z0!)) / det;
      const v = ((x1! - x0!) * (z - z0!) - (x - x0!) * (z1! - z0!)) / det;
      return y0! + (y1! - y0!) * u + (y2! - y0!) * v;
    };
    // a malha do ChunkManager: (ix, iz), (ix, iz+1), (ix+1, iz) e (ix+1, iz), (ix, iz+1), (ix+1, iz+1)
    const lower = [[0, 0, h00], [0, 4, h01], [4, 0, h10]];
    const upper = [[4, 0, h10], [0, 4, h01], [4, 4, h11]];
    // a outra diagonal, para a prova distinguir
    const otherLower = [[0, 0, h00], [4, 0, h10], [4, 4, h11]];
    const otherUpper = [[0, 0, h00], [4, 4, h11], [0, 4, h01]];
    const cases: Array<[number, number, number[][], number[][]]> = [
      [1, 0.5, lower, otherUpper],
      [0.8, 2.4, lower, otherUpper],
      [3, 3.5, upper, otherUpper],
      [3.6, 1.2, upper, otherLower],
      [2, 2, lower, otherLower],
      [1, 3, upper, otherUpper],
    ];
    for (const [x, z, tri, other] of cases) {
      const got = heightAt(grid, x, z);
      expect(Math.abs(got - plane(tri, x, z)), `(${x}, ${z})`).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(got - plane(other, x, z)), `(${x}, ${z}) outra diagonal`).toBeGreaterThan(0.1);
    }
    // sobre a diagonal os dois triângulos da malha dão a mesma altura
    expect(Math.abs(plane(lower, 1, 3) - plane(upper, 1, 3))).toBeLessThanOrEqual(1e-9);
  });

  // C3 (AC 3, door 1)
  it('downtown square is flat at 0', () => {
    let checked = 0;
    for (let iz = 0; iz < 769; iz++) {
      for (let ix = 0; ix < 769; ix++) {
        const [x, z] = sampleXZ(hm, ix, iz);
        if (Math.abs(x) > 500 || Math.abs(z) > 500) continue;
        const h = hm.heights[iz * 769 + ix]!;
        if (h < -0.01 || h > 0.01) throw new Error(`(${x}, ${z}) = ${h}`);
        checked++;
      }
    }
    expect(checked).toBe(251 * 251);
  });

  // C4 (AC 4, door 1)
  it('hills peak between 80 and 140 m', () => {
    let max = -Infinity;
    let at = 0;
    for (let i = 0; i < hm.heights.length; i++) {
      if (hm.heights[i]! > max) {
        max = hm.heights[i]!;
        at = i;
      }
    }
    expect(max).toBeGreaterThanOrEqual(80);
    expect(max).toBeLessThanOrEqual(140);
    const [x, z] = sampleXZ(hm, at % 769, Math.floor(at / 769));
    expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(800);
  });

  // C5 (AC 5)
  it('river bed runs from the north edge to the bay', () => {
    const rows: number[] = [];
    for (let iz = 0; iz < 769; iz++) {
      const z = -1536 + iz * 4;
      if (z > 1300) break;
      rows.push(z);
      const rx = riverCenterX(z);
      expect(rx).toBeGreaterThan(500);
      const ix = Math.round((rx + 1536) / 4);
      const h = hm.heights[iz * 769 + ix]!;
      if (h > -5) throw new Error(`river at z=${z}, x=${rx}: ${h}`);
    }
    expect(rows[0]).toBe(-1536);
    expect(rows[rows.length - 1]).toBe(1300);
    // riverCenterX fica a leste do centro em todo z, não só nas linhas
    for (let z = -1536; z <= 1536; z += 0.5) expect(riverCenterX(z)).toBeGreaterThan(500);
  });

  // C6 (AC 6, door 1)
  it('bay below water level', () => {
    let checked = 0;
    for (let iz = 0; iz < 769; iz++) {
      const z = -1536 + iz * 4;
      if (z < 1300) continue;
      for (let ix = 0; ix < 769; ix++) {
        const h = hm.heights[iz * 769 + ix]!;
        if (!(h < -2)) throw new Error(`bay sample (${ix}, ${iz}) = ${h}`);
        checked++;
      }
    }
    expect(checked).toBe(60 * 769);
  });
});
