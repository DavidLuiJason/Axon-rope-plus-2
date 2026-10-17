/** Compare two project directories or a project directory with a source ZIP.
 * Ignores only documented build outputs and secrets. Reports byte-level differences.
 * Usage: node tools/compare-dirs.mjs PROJECT_DIR EXPORTED.zip [--ignore path/]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { readZip } from './zip-reader.mjs';
import { excluded } from './snapshot.mjs';
const [leftArg, rightArg] = process.argv.slice(2);
if (!leftArg || !rightArg) { console.error('Usage: node tools/compare-dirs.mjs LEFT_DIR RIGHT_DIR_OR_ZIP [--ignore path/]'); process.exit(2); }
const extraIgnores = [];
for (let i = 4; i < process.argv.length; i++) if (process.argv[i] === '--ignore') extraIgnores.push(process.argv[++i]);
const skip = (p) => excluded(p) || extraIgnores.some((x) => p === x || p.startsWith(x.endsWith('/') ? x : x + '/'));
function readDir(folder) {
  const root = resolve(folder), out = new Map();
  function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, e.name), rel = relative(root, abs).split('\\').join('/');
      if (skip(rel)) continue;
      if (e.isSymbolicLink()) throw new Error(`Refuse symlink: ${rel}`);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile()) out.set(rel, readFileSync(abs));
    }
  }
  walk(root); return out;
}
function readInput(p) {
  if (statSync(p).isDirectory()) return readDir(p);
  const entries = readZip(p);
  return new Map([...entries].filter(([name]) => !skip(name)));
}
try {
  const a = readInput(leftArg), b = readInput(rightArg);
  const missing = [...a.keys()].filter((k) => !b.has(k)).sort();
  const extra = [...b.keys()].filter((k) => !a.has(k)).sort();
  const different = [...a.keys()].filter((k) => b.has(k) && !a.get(k).equals(b.get(k))).sort();
  for (const [label, list] of [['MISSING', missing], ['EXTRA', extra], ['DIFFERENT', different]]) {
    for (const name of list.slice(0, 30)) console.log(`${label}: ${name}`);
    if (list.length > 30) console.log(`${label}: ... ${list.length - 30} more`);
  }
  console.log(`${missing.length || extra.length || different.length ? 'COMPARE FAILED' : 'COMPARE OK'}: missing ${missing.length}, extra ${extra.length}, different ${different.length}; left ${a.size}, right ${b.size}`);
  if (missing.length || extra.length || different.length) process.exitCode = 1;
} catch (e) { console.error('COMPARE ERROR:', e.message); process.exitCode = 1; }
