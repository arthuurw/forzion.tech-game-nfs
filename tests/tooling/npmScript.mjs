// test-hardening C3/C4: transforma um script npm `vitest run <args>` do package.json em
// `npx vitest list --json <args>`, para as provas listarem o que o script de fato roda.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export function scriptList(name) {
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts ?? {};
  const script = scripts[name];
  if (typeof script !== 'string' || !/^vitest run(\s|$)/.test(script)) {
    throw new Error(`o script "${name}" não é "vitest run ...": ${JSON.stringify(script)}`);
  }
  return vitestList(script.replace(/^vitest run/, '').trim());
}

/** lista do vitest (`arquivo :: nome`) com os argumentos dados */
export function vitestList(args) {
  const out = execSync(`npx vitest list --json ${args}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out.slice(out.indexOf('['))).map((t) => `${t.file} :: ${t.name}`);
}
