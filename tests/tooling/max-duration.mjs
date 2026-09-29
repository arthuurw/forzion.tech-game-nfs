// test-hardening C2: falha se algum teste do relatório JSON do vitest passou do limite (ms).
// uso: node tests/tooling/max-duration.mjs <relatorio.json> <limite-ms>
import { readFileSync } from 'node:fs';

const [file, limitArg] = process.argv.slice(2);
if (!file || !limitArg) {
  console.error('uso: node tests/tooling/max-duration.mjs <relatorio.json> <limite-ms>');
  process.exit(2);
}
const limit = Number(limitArg);
const report = JSON.parse(readFileSync(file, 'utf8'));
const slow = [];
let total = 0;
for (const f of report.testResults) {
  for (const t of f.assertionResults) {
    total++;
    if ((t.duration ?? 0) > limit) slow.push(`${Math.round(t.duration)} ms  ${t.fullName}`);
  }
}
if (total === 0) {
  console.error('nenhum teste no relatório');
  process.exit(1);
}
if (slow.length) {
  console.error(`${slow.length} de ${total} testes acima de ${limit} ms:\n${slow.join('\n')}`);
  process.exit(1);
}
console.log(`${total} testes, todos ≤ ${limit} ms`);
