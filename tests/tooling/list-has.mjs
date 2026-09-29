// test-hardening C3/C4: confere se um teste aparece (ou não) na lista do vitest.
// uso: node tests/tooling/list-has.mjs [--tags-filter=<expr>] (--present|--absent) "<nome do teste>"
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const filter = args.find((a) => a.startsWith('--tags-filter='));
const modeIdx = args.findIndex((a) => a === '--present' || a === '--absent');
if (modeIdx < 0 || !args[modeIdx + 1]) {
  console.error('uso: node tests/tooling/list-has.mjs [--tags-filter=<expr>] (--present|--absent) "<nome>"');
  process.exit(2);
}
const mode = args[modeIdx];
const name = args[modeIdx + 1];
const cli = ['vitest', 'list', '--json'];
if (filter) cli.push(filter);
const out = execFileSync('npx', cli, { encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });
const list = JSON.parse(out.slice(out.indexOf('[')));
const found = list.some((t) => t.name.endsWith(name));
console.log(`${list.length} testes listados; "${name}" ${found ? 'presente' : 'ausente'}`);
process.exit((mode === '--present') === found ? 0 : 1);
