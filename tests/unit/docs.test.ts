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
    expect(rows[i18]![1]).toContain('`world/{terrain,roads,lots,interiors,rail}/`');
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

  // smooth-world C7 (doors 1 e 2): interpolação no render estende a AD-006; chão caminhável estende a AD-012
  it('interpolation and walkable ground are recorded decisions', () => {
    const rows = adRows();
    const ad20 = rows.find(([n]) => n === 20)?.[1] ?? '';
    const ad21 = rows.find(([n]) => n === 21)?.[1] ?? '';
    expect(ad20).toContain('| active |');
    expect(ad20).toContain('Estende a AD-006');
    expect(ad20).toContain('render(dt, alpha)');
    expect(ad20).toContain('alpha = stepper.accumulator / stepper.step');
    expect(ad20).toContain('lerp');
    expect(ad20).toContain('slerp');
    expect(ad20).toContain('`teleport` e `reset`');
    expect(ad21).toContain('| active |');
    expect(ad21).toContain('Estende a AD-012');
    expect(ad21).toContain('walkable(bi, zoneId, x, z)');
    expect(ad21).toContain('(floor)');
    expect(ad21).toContain('`LOT_MARGIN + 0.25` m');
    expect(ad21).toContain('`zoneAt`');
  });

  // e2e-speed C13 (AC 13): os tempos medidos da suíte (C11: 28.9 min, C12: 2.4 min) e a variável dos workers
  it('agents gives the e2e times and workers', () => {
    const lines = agents.split('\n');
    const full = lines.find((l) => l.startsWith('npm run test:e2e '));
    const smoke = lines.find((l) => l.startsWith('npm run test:e2e:smoke '));
    expect(full).toContain('E2E_WORKERS');
    expect(full).toContain('28.9 min');
    expect(full).not.toContain('~1 h');
    expect(smoke).toContain('2.4 min');
  });

  // play-fixes C30 (AC 24): o comentário do estacionamento cita os números que o código usa
  it('parking comment matches wellInside', () => {
    const src = read('src/world/interiors/InteriorProps.ts');
    const at = src.indexOf('const wellInside =');
    expect(at).toBeGreaterThan(0);
    const before = src.slice(0, at).split('\n');
    const comment: string[] = [];
    for (let i = before.length - 2; i >= 0 && before[i]!.trim().startsWith('//'); i--) comment.unshift(before[i]!.trim());
    const text = comment.join(' ');
    const calls = [...src.matchAll(/wellInside\(zone\.id, x, z, ([\d.]+), ([\d.]+)\)/g)].map((m) => [m[1]!, m[2]!]);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const [radius, facade] of calls) {
      expect(radius).toBe(calls[0]![0]);
      expect(facade).toBe(calls[0]![1]);
    }
    const [radius, facade] = calls[0]!;
    expect([radius, facade]).toEqual(['4', '5.5']);
    expect(text).toContain(`pontos a ${radius} m em volta`);
    expect(text).toContain(`${facade} m ou mais da fachada`);
    expect(text).toContain(`raio ${radius} m`);
    expect(text).toContain(`fachada ${facade} m`);
  });
});
