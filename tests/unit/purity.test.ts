import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// C39 (door 1) - table-driven over the 8 pure modules
const PURE_MODULES = [
  'src/world/CityGenerator.ts',
  'src/vehicle/drivetrain.ts',
  'src/core/FixedStepper.ts',
  'src/core/input.ts',
  'src/camera/chaseMath.ts',
  'src/hud/format.ts',
  'src/hud/minimapMath.ts',
  'src/audio/audioMap.ts',
];

// cobre `import x from 'three'`, `import 'three'`, `import('three')` e `require('three')`
const FORBIDDEN = /(from\s+|import\s+|import\s*\(\s*|require\s*\(\s*)['"](three|@dimforge\/rapier3d-compat)(\/[^'"]*)?['"]/;

describe('pure modules', () => {
  it('pure modules do not import three or rapier', () => {
    expect(PURE_MODULES.length).toBe(8);
    for (const rel of PURE_MODULES) {
      const source = readFileSync(resolve(process.cwd(), rel), 'utf8');
      expect(FORBIDDEN.test(source), rel).toBe(false);
      expect(source.length, rel).toBeGreaterThan(0);
    }
  });
});
