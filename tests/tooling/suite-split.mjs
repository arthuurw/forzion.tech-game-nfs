// test-hardening C4: o `npm test` lista exatamente o que o `test:quick` lista mais os testes `slow`,
// sem sobra nem falta, e o teste lento da IA está entre os `slow`. Não depende de um total escrito à mão.
// uso: node tests/tooling/suite-split.mjs
import { execSync } from 'node:child_process';

function list(filter) {
  const out = execSync(`npx vitest list --json${filter ? ` "--tags-filter=${filter}"` : ''}`, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out.slice(out.indexOf('['))).map((t) => `${t.file} :: ${t.name}`);
}

const full = list(null);
const quick = list('!slow');
const slow = list('slow');
const problems = [];
if (new Set(full).size !== full.length) problems.push('nomes repetidos na lista completa');
const union = new Set([...quick, ...slow]);
for (const t of full) if (!union.has(t)) problems.push(`na lista completa e em nenhuma das duas: ${t}`);
for (const t of union) if (!full.includes(t)) problems.push(`fora da lista completa: ${t}`);
for (const t of quick) if (slow.includes(t)) problems.push(`nas duas listas: ${t}`);
if (!slow.some((t) => t.endsWith('each opponent finishes every race in time'))) problems.push('o teste lento da IA não está marcado slow');
console.log(`npm test: ${full.length} · test:quick: ${quick.length} · slow: ${slow.length}`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
