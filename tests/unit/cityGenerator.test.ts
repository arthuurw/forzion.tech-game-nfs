import { describe, expect, it } from 'vitest';
import { NEON_PALETTE, generateCity } from '../../src/world/CityGenerator';

describe('CityGenerator', () => {
  // C16 (AC 12)
  it('deterministic by seed', () => {
    expect(JSON.stringify(generateCity(1337))).toBe(JSON.stringify(generateCity(1337)));
    expect(JSON.stringify(generateCity(1))).not.toBe(JSON.stringify(generateCity(2)));
  });

  // C17 (AC 13)
  it('8x8 grid of 40 m blocks with 12 m streets', () => {
    const city = generateCity(1337);
    expect(city.blocks.length).toBe(64);
    expect(city.blockSize).toBe(40);
    expect(city.streetWidth).toBe(12);
    expect(city.bounds).toBe(202);
    const xs = [...new Set(city.blocks.map((b) => b.x))].sort((a, b) => a - b);
    const zs = [...new Set(city.blocks.map((b) => b.z))].sort((a, b) => a - b);
    expect(xs.length).toBe(8);
    expect(zs.length).toBe(8);
    for (let i = 1; i < 8; i++) {
      expect(xs[i]! - xs[i - 1]!).toBeCloseTo(52, 6);
      expect(zs[i]! - zs[i - 1]!).toBeCloseTo(52, 6);
    }
    expect(xs[0]).toBeCloseTo(-182, 6);
    expect(xs[7]).toBeCloseTo(182, 6);
    expect(zs[0]).toBeCloseTo(-182, 6);
    expect(zs[7]).toBeCloseTo(182, 6);
  });

  // C18 (AC 14)
  it('buildings per block within bounds', () => {
    const city = generateCity(1337);
    for (const block of city.blocks) {
      expect(block.buildings.length).toBeGreaterThanOrEqual(1);
      expect(block.buildings.length).toBeLessThanOrEqual(4);
      const half = city.blockSize / 2;
      for (const b of block.buildings) {
        expect(b.height).toBeGreaterThanOrEqual(10);
        expect(b.height).toBeLessThanOrEqual(60);
        expect(b.x - b.width / 2).toBeGreaterThanOrEqual(block.x - half - 1e-9);
        expect(b.x + b.width / 2).toBeLessThanOrEqual(block.x + half + 1e-9);
        expect(b.z - b.depth / 2).toBeGreaterThanOrEqual(block.z - half - 1e-9);
        expect(b.z + b.depth / 2).toBeLessThanOrEqual(block.z + half + 1e-9);
      }
    }
  });

  // C19 (AC 15) - table-driven over the 4 palette colors
  it('neon signs use the 4-color palette', () => {
    expect([...NEON_PALETTE]).toEqual(['#ff2d95', '#00e5ff', '#b026ff', '#ffd400']);
    const palette = new Set<string>(NEON_PALETTE);
    const city = generateCity(1337);
    const used = new Set<string>();
    for (const block of city.blocks) {
      expect(block.signs.length).toBeGreaterThanOrEqual(1);
      for (const s of block.signs) {
        expect(palette.has(s.color), `color ${s.color}`).toBe(true);
        used.add(s.color);
      }
    }
    expect(used.size).toBe(4);
  });

  // C20 (AC 16)
  it('lamp posts every 20 m on both sides', () => {
    const city = generateCity(1337);
    const streetsPerAxis = 7;
    const streetLength = 404;
    const expected = 2 * (2 * streetsPerAxis) * Math.floor(streetLength / 20);
    expect(city.lamps.length).toBe(expected);

    // group by street (axis + lateral coordinate) and check spacing along the street
    const groups = new Map<string, number[]>();
    for (const lamp of city.lamps) {
      const key = lamp.axis === 'x' ? `x:${lamp.z.toFixed(3)}` : `z:${lamp.x.toFixed(3)}`;
      const along = lamp.axis === 'x' ? lamp.x : lamp.z;
      groups.set(key, [...(groups.get(key) ?? []), along]);
    }
    expect(groups.size).toBe(2 * 2 * streetsPerAxis);
    for (const [key, coords] of groups) {
      coords.sort((a, b) => a - b);
      expect(coords.length, key).toBe(Math.floor(streetLength / 20));
      for (let i = 1; i < coords.length; i++) {
        expect(coords[i]! - coords[i - 1]!, key).toBeCloseTo(20, 2);
      }
    }
  });
});
