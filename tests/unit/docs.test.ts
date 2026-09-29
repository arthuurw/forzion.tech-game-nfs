import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// test-hardening S6: o documento bate com o código (C29-C31)
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');
const readme = read('README.md');
const agents = read('AGENTS.md');
const state = read('.specs/STATE.md');

/** texto de uma seção `## título` até a próxima `## ` */
function section(doc: string, title: string): string {
  const start = doc.indexOf(`## ${title}`);
  if (start < 0) return '';
  const end = doc.indexOf('\n## ', start + 3);
  return doc.slice(start, end < 0 ? undefined : end);
}

/** linhas da tabela de decisões, na ordem do arquivo: [número, linha] */
function adRows(): Array<[number, string]> {
  return state
    .split('\n')
    .filter((l) => /^\| AD-\d{3} \|/.test(l))
    .map((l) => [Number(l.slice(5, 8)), l]);
}

describe('docs', () => {
  // C29 (AC 25, AC 26)
  it('readme describes what exists', () => {
    expect(readme).not.toContain('as corridas ainda não existem');
    const roadmap = section(readme, 'Roadmap');
    const item2 = roadmap.split('\n').find((l) => l.startsWith('2. '));
    expect(item2).toBeDefined();
    expect(item2).toMatch(/~~Corridas~~|\(concluído\)/);
    const exists = section(readme, 'O que já existe');
    expect(exists).toMatch(/Corridas/);
    expect(exists).toMatch(/trem/);
    const keys = section(readme, 'Como rodar').split('\n');
    expect(keys.some((l) => l.startsWith('| `Enter` |'))).toBe(true);
    expect(keys.some((l) => l.startsWith('| `Esc` |'))).toBe(true);
    expect(keys.find((l) => l.startsWith('| `R` |'))).toMatch(/último portão/);
  });

  // C30 (AC 27, door 3)
  it('layout is the same in agents readme and state', () => {
    expect(agents).toContain('`src/{core,world,vehicle,camera,hud,audio,post,race}/`');
    expect(agents).toContain('`world/{terrain,roads,lots,interiors,rail}/`');
    const tree = section(readme, 'Estrutura');
    expect(tree).toMatch(/├── race\//);
    expect(tree).toMatch(/rail\//);
    const rows = adRows();
    const ad004 = rows.find(([n]) => n === 4)![1];
    expect(ad004).toContain('superseded by AD-018');
    const i17 = rows.findIndex(([n]) => n === 17);
    const i18 = rows.findIndex(([n]) => n === 18);
    expect(i18).toBeGreaterThan(i17);
    expect(rows[i18]![1]).toContain('| active |');
    expect(rows[i18]![1]).toContain('`src/{core,world,vehicle,camera,hud,audio,post,race}/`');
  });

  // C31 (AC 28, AC 29, AC 30)
  it('state and docs are current', () => {
    const residuals = state.split('\n').find((l) => l.includes('`residuals`'));
    expect(residuals).toContain('(concluída, verificada rodada 1)');
    const numbers = adRows().map(([n]) => n);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    const open = state.split('\n').find((l) => l.startsWith('Resíduos conhecidos'))!;
    expect(open).not.toContain('races: pintura dos oponentes sai escura');
    const car = read('src/vehicle/Car.ts');
    const doc = car.slice(car.lastIndexOf('/**', car.indexOf('  teleport(')), car.indexOf('  teleport('));
    expect(doc).toMatch(/grid/);
    expect(doc).toMatch(/AD-015/);
    expect(doc).toMatch(/água/);
    expect(doc).not.toMatch(/Só para testes e debug/);
    expect(section(readme, 'Como é feito')).toContain('## Intent');
  });
});
