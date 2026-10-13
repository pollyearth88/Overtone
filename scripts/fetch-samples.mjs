#!/usr/bin/env node
/**
 * Downloads the instrument samples listed in `src/lib/audio/instruments.ts`
 * into `public/samples/<instrument>/`.
 *
 *   node scripts/fetch-samples.mjs          # fetch anything missing
 *   node scripts/fetch-samples.mjs --force  # re-fetch everything
 *   node scripts/fetch-samples.mjs --check  # report missing files, download nothing
 *
 * The samples are committed to the repo, so this only needs running when the
 * manifest changes. Sources and licences: docs/CREDITS.md.
 *
 * Imports a .ts manifest directly — Node 22.18+/24 strips the types natively.
 */

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { INSTRUMENT_IDS, INSTRUMENTS, sampleFileName } from '../src/lib/audio/instruments.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'samples');

/** Upstream sample set. Folder names there match our instrument ids. */
const BASE_URL = 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples';

const force = process.argv.includes('--force');
const checkOnly = process.argv.includes('--check');

async function exists(path) {
  try {
    const info = await stat(path);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

let fetched = 0;
let skipped = 0;
let missing = 0;
let bytes = 0;
const failures = [];

for (const id of INSTRUMENT_IDS) {
  const spec = INSTRUMENTS[id];
  const dir = join(OUT_DIR, id);
  if (!checkOnly) await mkdir(dir, { recursive: true });

  for (const note of spec.samples) {
    const file = sampleFileName(note);
    const dest = join(dir, file);

    if (!force && (await exists(dest))) {
      skipped += 1;
      continue;
    }
    if (checkOnly) {
      missing += 1;
      console.log(`missing  ${id}/${file}`);
      continue;
    }

    try {
      const buf = await download(`${BASE_URL}/${id}/${file}`);
      await writeFile(dest, buf);
      fetched += 1;
      bytes += buf.byteLength;
      console.log(`fetched  ${id}/${file}  ${(buf.byteLength / 1024).toFixed(0)} KB`);
    } catch (err) {
      failures.push(`${id}/${file}: ${err.message}`);
      console.error(`FAILED   ${id}/${file}  ${err.message}`);
    }
  }
}

if (checkOnly) {
  console.log(`\n${missing} missing, ${skipped} present`);
  process.exit(missing > 0 ? 1 : 0);
}

console.log(
  `\n${fetched} fetched (${(bytes / 1024 / 1024).toFixed(1)} MB), ${skipped} already present`,
);

if (failures.length > 0) {
  console.error(`\n${failures.length} failed:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
