import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// free-roam-city C39 (door 1) + visual-upgrade C26 + city-terrain C45 - table-driven over the 23 pure modules
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
];

// cobre `import x from 'three'`, `import 'three'`, `import('three')` e `require('three')`
const FORBIDDEN = /(from\s+|import\s+|import\s*\(\s*|require\s*\(\s*)['"](three|@dimforge\/rapier3d-compat)(\/[^'"]*)?['"]/;

describe('pure modules', () => {
  it('pure modules do not import three or rapier', () => {
    expect(PURE_MODULES.length).toBe(23);
    for (const rel of PURE_MODULES) {
      const source = readFileSync(resolve(process.cwd(), rel), 'utf8');
      expect(FORBIDDEN.test(source), rel).toBe(false);
      expect(source.length, rel).toBeGreaterThan(0);
    }
  });
});
