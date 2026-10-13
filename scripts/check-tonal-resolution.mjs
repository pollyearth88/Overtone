#!/usr/bin/env node
/**
 * Walks the installed `tonal` dependency tree and reports any package whose
 * `main` field points at a file that was never published.
 *
 *   node scripts/check-tonal-resolution.mjs
 *
 * Several @tonaljs packages shipped exactly that way around tonal 6.5.0, which
 * makes them unresolvable by Node and by Vite. `pnpm-workspace.yaml` pins the
 * broken ones to their last good publish. Run this after any dependency bump
 * that touches tonal: it turns an inscrutable "Cannot find module .../dist/index.js"
 * into a named list of culprits.
 */

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** pnpm nests dependencies as siblings under the nearest `node_modules`. */
function nodeModulesRoot(dir) {
  let p = dir;
  while (p !== dirname(p)) {
    const parent = dirname(p);
    if (basename(parent) === 'node_modules') return parent;
    if (basename(dirname(parent)) === 'node_modules') return dirname(parent);
    p = parent;
  }
  return null;
}

const seen = new Map();

function walk(dir) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  } catch {
    return;
  }

  const id = `${pkg.name}@${pkg.version}`;
  if (seen.has(id)) return;
  seen.set(id, !pkg.main || existsSync(join(dir, pkg.main)));

  const root = nodeModulesRoot(dir);
  if (!root) return;

  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    const link = join(root, dep);
    if (!existsSync(link)) continue;
    try {
      walk(realpathSync(link));
    } catch {
      /* dangling link — the missing-main report below is what matters */
    }
  }
}

let entry;
try {
  entry = realpathSync('node_modules/tonal');
} catch {
  console.error('tonal is not installed. Run `pnpm install` first.');
  process.exit(1);
}

walk(entry);

const broken = [...seen]
  .filter(([, ok]) => !ok)
  .map(([id]) => id)
  .sort();

if (broken.length === 0) {
  console.log(`tonal tree OK — ${seen.size} packages, every "main" resolves.`);
  process.exit(0);
}

console.error(
  `${broken.length} of ${seen.size} packages declare a "main" that was not published:\n`,
);
for (const id of broken) console.error(`  ${id}`);
console.error('\nPin each to its last good version under `overrides` in pnpm-workspace.yaml.');
process.exit(1);
