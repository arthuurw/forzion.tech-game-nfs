// test-hardening C4: o que `npm test` roda é exatamente o que `npm run test:quick` roda mais os testes
// com a tag `slow`, sem sobra, falta ou repetição, e o teste lento da IA está entre os `slow`.
// As duas listas saem dos scripts do package.json, não de flags repetidos aqui.
// uso: node tests/tooling/suite-split.mjs
import { scriptList, vitestList } from './npmScript.mjs';

const full = scriptList('test');
const quick = scriptList('test:quick');
const slow = vitestList('--tags-filter=slow');
const problems = [];
if (new Set(full).size !== full.length) problems.push('nomes repetidos na lista do npm test');
const union = new Set([...quick, ...slow]);
for (const t of full) if (!union.has(t)) problems.push(`no npm test e em nenhuma das duas: ${t}`);
for (const t of union) if (!full.includes(t)) problems.push(`fora do npm test: ${t}`);
for (const t of quick) if (slow.includes(t)) problems.push(`no test:quick e marcado slow: ${t}`);
if (!slow.some((t) => t.endsWith('each opponent finishes every race in time'))) problems.push('o teste lento da IA não está marcado slow');
console.log(`npm test: ${full.length} · test:quick: ${quick.length} · slow: ${slow.length}`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
