import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// test-hardening: regras de repositório sobre os próprios testes, provadas lendo os arquivos
const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');
const e2eSpecs = readdirSync(resolve(root, 'tests/e2e')).filter((f) => f.endsWith('.spec.ts'));

describe('test hygiene', () => {
  // C7 (AC 7, door 2)
  it('every e2e spec file has a smoke test', () => {
    expect(e2eSpecs.sort()).toEqual(
      ['audio', 'drive', 'extras', 'hud', 'interiors', 'race', 'render', 'visual', 'world'].map((n) => `${n}.spec.ts`),
    );
    for (const f of e2eSpecs) {
      const smoke = read(`tests/e2e/${f}`).match(/\{\s*tag:\s*'@smoke'\s*\}/g) ?? [];
      expect(smoke.length, f).toBeGreaterThanOrEqual(1);
    }
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['test:e2e:smoke']).toBe('playwright test --grep @smoke');
  });
});
