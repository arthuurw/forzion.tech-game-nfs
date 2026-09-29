// test-hardening C3: confere se um teste aparece (ou não) no que um script npm roda.
// uso: node tests/tooling/list-has.mjs --script <nome-do-script> (--present|--absent) "<nome do teste>"
import { scriptList } from './npmScript.mjs';

const args = process.argv.slice(2);
const scriptIdx = args.indexOf('--script');
const modeIdx = args.findIndex((a) => a === '--present' || a === '--absent');
if (scriptIdx < 0 || !args[scriptIdx + 1] || modeIdx < 0 || !args[modeIdx + 1]) {
  console.error('uso: node tests/tooling/list-has.mjs --script <nome> (--present|--absent) "<nome do teste>"');
  process.exit(2);
}
const script = args[scriptIdx + 1];
const mode = args[modeIdx];
const name = args[modeIdx + 1];
const list = scriptList(script);
const found = list.some((t) => t.endsWith(name));
console.log(`npm run ${script}: ${list.length} testes; "${name}" ${found ? 'presente' : 'ausente'}`);
process.exit((mode === '--present') === found ? 0 : 1);
