#!/usr/bin/env node
/**
 * Baixa sets de textura CC0 do ambientCG e extrai só Color, NormalGL e Roughness (1K JPG)
 * para <outDir>/<Set>/. Uso: node scripts/fetch-textures.mjs [outDir]
 * Sai com código 1 no primeiro set que não existir (HTTP != 200).
 */
import { copyFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

export const TEXTURE_SETS = [
  'Asphalt012',
  'PavingStones070',
  'Concrete034',
  'MetalPlates006',
  'Bricks059',
  'PaintedPlaster017',
];
export const MAP_KINDS = ['Color', 'NormalGL', 'Roughness'];

const outDir = process.argv[2] ?? 'public/textures';

async function fetchZip(set) {
  const url = `https://ambientcg.com/get?file=${set}_1K-JPG.zip`;
  const res = await fetch(url, { redirect: 'follow' });
  if (res.status !== 200) {
    console.error(`${set}: HTTP ${res.status} em ${url}`);
    process.exit(1);
  }
  return Buffer.from(await res.arrayBuffer());
}

function extract(set, zipBuffer) {
  const tmpZip = join(tmpdir(), `${set}.zip`);
  const tmpOut = join(tmpdir(), `${set}-extract`);
  writeFileSync(tmpZip, zipBuffer);
  mkdirSync(tmpOut, { recursive: true });
  // PowerShell Expand-Archive existe em todo Windows 10+; em outros SOs use unzip.
  if (process.platform === 'win32') {
    execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -LiteralPath '${tmpZip}' -DestinationPath '${tmpOut}'`]);
  } else {
    execFileSync('unzip', ['-o', '-q', tmpZip, '-d', tmpOut]);
  }
  const dest = join(outDir, set);
  mkdirSync(dest, { recursive: true });
  for (const kind of MAP_KINDS) {
    const name = `${set}_1K-JPG_${kind}.jpg`;
    const src = join(tmpOut, name);
    if (!existsSync(src)) {
      console.error(`${set}: arquivo ${name} não veio no zip`);
      process.exit(1);
    }
    copyFileSync(src, join(dest, name));
  }
  console.log(`${set}: ok (${MAP_KINDS.join(', ')})`);
}

for (const set of TEXTURE_SETS) {
  extract(set, await fetchZip(set));
}
writeFileSync(
  join(outDir, 'LICENSE-ambientcg.txt'),
  `Texturas de https://ambientcg.com - licença CC0 1.0 Universal (domínio público).\nSets: ${TEXTURE_SETS.join(', ')} (1K JPG: Color, NormalGL, Roughness).\n`,
);
console.log('done');
