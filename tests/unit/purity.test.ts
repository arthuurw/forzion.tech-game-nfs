import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// free-roam-city C39 (door 1) + visual-upgrade C26 - table-driven over the 13 pure modules
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
];

// cobre `import x from 'three'`, `import 'three'`, `import('three')` e `require('three')`
const FORBIDDEN = /(from\s+|import\s+|import\s*\(\s*|require\s*\(\s*)['"](three|@dimforge\/rapier3d-compat)(\/[^'"]*)?['"]/;

describe('pure modules', () => {
  it('pure modules do not import three or rapier', () => {
    expect(PURE_MODULES.length).toBe(13);
    for (const rel of PURE_MODULES) {
      const source = readFileSync(resolve(process.cwd(), rel), 'utf8');
      expect(FORBIDDEN.test(source), rel).toBe(false);
      expect(source.length, rel).toBeGreaterThan(0);
    }
  });
});
