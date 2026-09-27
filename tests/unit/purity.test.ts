import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
];

// cobre `import x from 'three'`, `import 'three'`, `import('three')` e `require('three')`
const FORBIDDEN = /(from\s+|import\s+|import\s*\(\s*|require\s*\(\s*)['"](three|@dimforge\/rapier3d-compat)(\/[^'"]*)?['"]/;

describe('pure modules', () => {
  it('pure modules do not import three or rapier', () => {
    expect(PURE_MODULES.length).toBe(33);
    for (const rel of PURE_MODULES) {
      const source = readFileSync(resolve(process.cwd(), rel), 'utf8');
      expect(FORBIDDEN.test(source), rel).toBe(false);
      expect(source.length, rel).toBeGreaterThan(0);
    }
  });
});
