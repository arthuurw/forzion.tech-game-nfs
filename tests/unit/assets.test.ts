import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FACADE_SETS, ROAD_SET, SIDEWALK_SET, TEXTURE_SETS } from '../../src/core/textureSets';

const ROOT = process.cwd();
const SETS = ['Asphalt012', 'PavingStones070', 'Concrete034', 'MetalPlates006', 'Bricks059', 'PaintedPlaster017'];
const KINDS = ['Color', 'NormalGL', 'Roughness'];

describe('texture assets', () => {
  // visual-upgrade C27 (door 1)
  it('texture pipeline files present', () => {
    expect(existsSync(resolve(ROOT, 'scripts/fetch-textures.mjs'))).toBe(true);
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['fetch:textures']).toContain('scripts/fetch-textures.mjs');
    const license = readFileSync(resolve(ROOT, 'public/textures/LICENSE-ambientcg.txt'), 'utf8');
    expect(license).toContain('CC0');
  });

  // visual-upgrade C37 - qual set veste cada superfície
  it('texture set mapping by surface', () => {
    expect([...TEXTURE_SETS]).toEqual(SETS);
    expect([...FACADE_SETS]).toEqual(['Concrete034', 'MetalPlates006', 'Bricks059', 'PaintedPlaster017']);
    expect(ROAD_SET).toBe('Asphalt012');
    expect(SIDEWALK_SET).toBe('PavingStones070');
  });

  // visual-upgrade C28 (assunção do plano: ≤ 15 MB)
  it('texture sets complete and under 15 MB', () => {
    let total = 0;
    for (const set of SETS) {
      const dir = resolve(ROOT, 'public/textures', set);
      const files = readdirSync(dir).sort();
      expect(files, set).toEqual(KINDS.map((k) => `${set}_1K-JPG_${k}.jpg`).sort());
      for (const f of files) total += statSync(resolve(dir, f)).size;
    }
    expect(total).toBeLessThanOrEqual(15 * 1024 * 1024);
  });
});
