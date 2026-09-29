import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// test-hardening: regras de repositório sobre os próprios testes, provadas lendo os arquivos
const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');
const e2eSpecs = readdirSync(resolve(root, 'tests/e2e')).filter((f) => f.endsWith('.spec.ts'));

const walk = (dir: string): string[] =>
  readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(`${dir}/${d.name}`) : d.name.endsWith('.ts') ? [`${dir}/${d.name}`] : [],
  );

// `expect(` cujo argumento é só número, operador e `Math.*` sobre números: testa o JavaScript, não o código
const LITERAL_ONLY = /expect\(\s*[-0-9.() *+/]*(Math\.[a-z]+\([-0-9.() *+/]*\)[-0-9.() *+/]*)*\)\./;

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

  // C22 (AC 17)
  it('no literal-only assertions left', () => {
    const hits: string[] = [];
    for (const f of [...walk('tests/unit'), ...walk('tests/physics')]) {
      read(f)
        .split('\n')
        .forEach((line, i) => {
          if (LITERAL_ONLY.test(line) && !/expect\(\s*\)/.test(line)) hits.push(`${f}:${i + 1}`);
        });
    }
    expect(hits).toEqual([]);
    // drivetrain: a razão `t` só era conferida > 0, o que o rpm acima da marcha lenta já prova
    expect(read('tests/unit/drivetrain.test.ts')).not.toContain('const t = (back.state.rpm - spec.idleRpm)');
  });
});
