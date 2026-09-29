import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// free-roam-city C39 (door 1) + visual-upgrade C26 + city-terrain C45 + car-handling C27 + yaw-assist C9 + block-fill C7 + corner-assist C8 + races C35 - table-driven over the 33 pure modules
const PURE_MODULES = [
  'src/world/CityGenerator.ts',
  'src/vehicle/drivetrain.ts',
  'src/core/FixedStepper.ts',
  'src/core/input.ts',
  'src/core/exposeDebug.ts',
  'src/camera/chaseMath.ts',
  'src/hud/format.ts',
  'src/hud/minimapMath.ts',
  'src/audio/audioMap.ts',
  'src/world/rainMath.ts',
  'src/world/flicker.ts',
  'src/vehicle/effectsMath.ts',
  'src/core/quality.ts',
  'src/core/textureSets.ts',
  // city-terrain C45 (door 3)
  'src/world/terrain/noise.ts',
  'src/world/terrain/TerrainGenerator.ts',
  'src/world/terrain/carveRoads.ts',
  'src/world/roads/RoadGenerator.ts',
  'src/world/roads/roadMesh.ts',
  'src/world/roads/bridges.ts',
  'src/world/lots/LotGenerator.ts',
  'src/world/chunks.ts',
  'src/world/worldMath.ts',
  // car-handling C27 (door 1; drivetrain.ts, door 2, já está na lista)
  'src/vehicle/carSpec.ts',
  // yaw-assist C9 (door 1)
  'src/vehicle/yawAssist.ts',
  // block-fill C7 (doors 1 e 2; interiorMotion.ts guarda também a cor do terreno, `terrainColor`)
  'src/world/interiors/BlockInteriors.ts',
  'src/world/interiors/InteriorProps.ts',
  'src/world/interiors/interiorMotion.ts',
  // corner-assist C8 (door 1)
  'src/vehicle/cornerAssist.ts',
  // races C35 (doors 1 e 2)
  'src/race/raceRoutes.ts',
  'src/race/raceProgress.ts',
  'src/race/raceSession.ts',
  'src/race/aiDriver.ts',
  // block-life-extras C38 (doors 2 e 3; roadQuery serve as corridas e o trem)
  'src/vehicle/carPaint.ts',
  'src/world/rail/trainLine.ts',
  'src/world/roads/roadQuery.ts',
];

// cobre `import x from 'three'`, `import 'three'`, `import('three')` e `require('three')`
const FORBIDDEN = /(from\s+|import\s+|import\s*\(\s*|require\s*\(\s*)['"](three|@dimforge\/rapier3d-compat)(\/[^'"]*)?['"]/;

// imports relativos que carregam código (não `import type`), com e sem `from`
const RELATIVE = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;

function resolveLocal(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec);
  for (const f of [base, `${base}.ts`, join(base, 'index.ts')]) if (existsSync(f) && f.endsWith('.ts')) return f;
  return null;
}

/**
 * test-hardening C20 (AC 16): o primeiro arquivo, seguindo imports relativos que não são
 * `import type`, que importa three ou rapier; null se nenhum.
 */
function forbiddenReach(file: string, seen = new Set<string>()): string | null {
  if (seen.has(file)) return null;
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  if (FORBIDDEN.test(source)) return file;
  for (const m of source.matchAll(RELATIVE)) {
    if (m[2]) continue; // `import type ... from` não carrega código
    const next = resolveLocal(file, m[3]!);
    if (!next) continue;
    const hit = forbiddenReach(next, seen);
    if (hit) return hit;
  }
  return null;
}

describe('pure modules', () => {
  it('pure modules do not import three or rapier', () => {
    expect(PURE_MODULES.length).toBe(36);
    for (const rel of PURE_MODULES) {
      const file = resolve(process.cwd(), rel);
      const source = readFileSync(file, 'utf8');
      expect(FORBIDDEN.test(source), rel).toBe(false);
      expect(source.length, rel).toBeGreaterThan(0);
      expect(forbiddenReach(file), rel).toBeNull();
    }
  });

  // test-hardening C20 (AC 16)
  it('transitive imports are followed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'purity-'));
    const put = (name: string, body: string) => writeFileSync(join(dir, name), body);
    put('heavy.ts', "import * as THREE from 'three';\nexport const v = new THREE.Vector3();\n");
    put('middle.ts', "export { v } from './heavy';\n");
    put('indirect.ts', "import { v } from './middle';\nexport const x = v.x;\n");
    put('typeOnly.ts', "import type { v } from './heavy';\nexport type V = typeof v;\n");
    put('clean.ts', "import { x } from './leaf';\nexport const y = x;\n");
    put('leaf.ts', 'export const x = 1;\n');
    expect(forbiddenReach(join(dir, 'indirect.ts'))).toBe(join(dir, 'heavy.ts'));
    expect(forbiddenReach(join(dir, 'typeOnly.ts'))).toBeNull();
    expect(forbiddenReach(join(dir, 'clean.ts'))).toBeNull();
  });
});
