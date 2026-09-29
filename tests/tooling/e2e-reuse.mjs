// test-hardening C5/C6: com um servidor já de pé na porta do e2e,
//   sem E2E_REUSE  -> o Playwright recusa a porta (exit != 0, "is already used", nenhum teste roda)
//   com E2E_REUSE=1 -> reaproveita o servidor e o teste passa (exit 0)
// uso: node tests/tooling/e2e-reuse.mjs [porta]
import { spawn, spawnSync, execSync } from 'node:child_process';

const PORT = Number(process.argv[2] ?? 5197);
// uma linha só: com shell, argumentos com espaço precisam de aspas
const TEST = 'npx playwright test tests/e2e/hud.spec.ts -g "webgl2 missing shows error overlay" --reporter=line';

function killTree(child) {
  if (process.platform === 'win32') execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
  else child.kill('SIGTERM');
}

async function waitUp(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function runPlaywright(extraEnv) {
  const env = { ...process.env, E2E_PORT: String(PORT), ...extraEnv };
  if (!('E2E_REUSE' in extraEnv)) delete env.E2E_REUSE;
  const r = spawnSync(TEST, { env, encoding: 'utf8', shell: true, timeout: 300_000 });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

const server = spawn(`npx vite --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' });
let failed = false;
try {
  if (!(await waitUp(`http://localhost:${PORT}`, 60_000))) throw new Error(`vite não subiu na porta ${PORT}`);

  const without = runPlaywright({});
  const refused = without.code !== 0 && without.out.includes('is already used') && !/\d+ passed/.test(without.out);
  console.log(`without E2E_REUSE: exit ${without.code}, recusou a porta: ${refused}`);
  if (!refused) {
    failed = true;
    console.log(without.out);
  }

  const withReuse = runPlaywright({ E2E_REUSE: '1' });
  const reused = withReuse.code === 0 && /1 passed/.test(withReuse.out);
  console.log(`with E2E_REUSE=1: exit ${withReuse.code}, reaproveitou e passou: ${reused}`);
  if (!reused) {
    failed = true;
    console.log(withReuse.out);
  }
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  killTree(server);
}
process.exit(failed ? 1 : 0);
