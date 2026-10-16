import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(resolve(root, file), 'utf8');
const errors = [];
const manifest = JSON.parse(await read('package.json'));
if (manifest.private !== true) errors.push('Root workspace must remain private.');
const names = new Set();
let workspaceCount = 0;
for (const group of ['apps', 'packages']) {
  for (const entry of await readdir(resolve(root, group), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = `${group}/${entry.name}/package.json`;
    const pkg = JSON.parse(await read(file));
    if (!pkg.name?.startsWith('@onepage/') || names.has(pkg.name)) errors.push(`${file}: missing/duplicate workspace name`);
    if (pkg.private !== true || pkg.type !== 'module') errors.push(`${file}: expected private ESM scaffold`);
    names.add(pkg.name);
    workspaceCount++;
  }
}

const archive = 'archive/2026-10-16-pre-consolidation';
const hashes = JSON.parse(await read(`${archive}/SHA256.json`));
for (const [file, expected] of Object.entries(hashes)) {
  const bytes = await readFile(resolve(root, archive, file));
  if (createHash('sha256').update(bytes).digest('hex') !== expected) errors.push(`Historical archive changed: ${file}`);
}

// Check current relative Markdown file links. URL availability and anchor targets
// are deliberately outside this small, network-free scaffold check.
const ignored = new Set(['.git', 'node_modules', 'archive', 'dist']);
let documentCount = 0;
async function checkDocuments(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = resolve(folder, entry.name);
    if (entry.isDirectory() && !ignored.has(entry.name)) await checkDocuments(file);
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    documentCount++;
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
      const target = match[1];
      if (/^[a-z][a-z0-9+.-]*:|^#/i.test(target)) continue;
      const path = decodeURIComponent(target.split('#')[0]);
      try { await stat(resolve(dirname(file), path)); }
      catch { errors.push(`${relative(root, file)}: missing linked file ${target}`); }
    }
  }
}
await checkDocuments(root);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Scaffold verified: ${workspaceCount} private workspaces, ${documentCount} current Markdown documents, ${Object.keys(hashes).length} unchanged archived files.`);
  console.log('This does not validate a composer, runtime, synth, import adapter or export implementation.');
}
