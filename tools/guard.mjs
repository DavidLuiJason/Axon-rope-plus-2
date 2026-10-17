// AXON FILE GUARD v2.1. No dependencies (Node 18+). Run from the project root.
//
//   node tools/guard.mjs                  CHECK. Fails (exit 1) if a locked file is missing, or a dictionary file
//                                         is missing/changed. New files are allowed (room to grow).
//   node tools/guard.mjs --strict         CHECK and reject any locked file that shrank by >50%.
//   node tools/guard.mjs --ratchet        CHECK first (refuses if anything is damaged), then ADD every new tracked
//                                         file to tools/files.lock. The lock only ever grows by itself.
//   node tools/guard.mjs --refresh        Re-measure sizes of all locked normal files (after big deliberate rewrites).
//   node tools/guard.mjs --forget PATH    Deliberately remove a file (or a folder ending in /) from the lock.
//   node tools/guard.mjs --accept PATH    Deliberately accept a changed dictionary file (e.g. a new dictionary version).
//
// What is locked: every file tracked by git (or, with no git, every file on disk) except node_modules, dist, build,
// android, coverage, package-lock.json. Normal files are locked by PRESENCE and size (a big shrink gives a WARNING).
// Files under public/dictionary/ are locked by sha256 (via each dictionary's manifest.json): any change fails.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const LOCK = join(ROOT, 'tools', 'files.lock');
const DICT_PARENT = 'public/dictionary';
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'android', 'coverage', '.capacitor', '.cache', '_axon-source']);
const SKIP_FILES = new Set(['package-lock.json', 'tools/files.lock']);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argAfter = (f) => args[args.indexOf(f) + 1];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(relative(ROOT, p).split('\\').join('/'));
  }
  return out;
}
function listFiles() {
  if (existsSync(join(ROOT, '.git'))) {
    try {
      const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8');
      return out.split('\0').filter(Boolean).filter((f) => existsSync(join(ROOT, f)));
    } catch { /* fall through */ }
  }
  return walk(ROOT);
}
// Never locked: build leftovers, the uploaded zips used by the unpack workflow, and the unpack workflow itself.
const skipped = (f) => SKIP_FILES.has(f) || /\.zip$/i.test(f) || f === '.github/workflows/unpack.yml' || f.split('/').some((s) => SKIP_DIRS.has(s));

function dictDirs() {
  const base = join(ROOT, DICT_PARENT);
  if (!existsSync(base)) return [];
  return readdirSync(base).filter((n) => existsSync(join(base, n, 'manifest.json'))).map((n) => `${DICT_PARENT}/${n}`).sort();
}
function dictFiles(dir) { // paths covered by this dictionary's manifest
  const m = JSON.parse(readFileSync(join(ROOT, dir, 'manifest.json'), 'utf8'));
  return Object.entries(m.files).map(([rel, info]) => [`${dir}/${rel}`, info]);
}
function verifyDict(dir, problems) {
  let n = 0;
  let list;
  try { list = dictFiles(dir); } catch { problems.push(`unreadable manifest: ${dir}/manifest.json`); return 0; }
  for (const [p, info] of list) {
    const abs = join(ROOT, p);
    if (!existsSync(abs)) { problems.push(`missing: ${p}`); continue; }
    const buf = readFileSync(abs);
    if (buf.length !== info.bytes || sha(buf) !== info.sha256) problems.push(`changed: ${p}`);
    n++;
  }
  return n;
}
// The lock carries a "seal": a hash of its own entries. If a tool or a person edits, cuts or damages the lock
// by hand, the seal no longer matches and the guard fails. Only this script's own commands re-seal it.
const sealOf = (dictionaries, files) => sha(JSON.stringify({ dictionaries, files }));
function readLock() {
  if (!existsSync(LOCK)) return null;
  try { return JSON.parse(readFileSync(LOCK, 'utf8')); } catch { return { broken: true }; }
}
function writeLock(lock) {
  const dictionaries = [...new Set(lock.dictionaries)].sort();
  const files = {};
  for (const k of Object.keys(lock.files).sort()) files[k] = lock.files[k];
  writeFileSync(LOCK, JSON.stringify({ version: 2, seal: sealOf(dictionaries, files), dictionaries, files }, null, 1) + '\n');
}
function entryFor(p) {
  const buf = readFileSync(join(ROOT, p));
  return p.startsWith(DICT_PARENT + '/') ? { bytes: buf.length, sha256: sha(buf) } : { bytes: buf.length };
}
function coveredByManifests() {
  const set = new Set();
  for (const d of dictDirs()) { try { for (const [p] of dictFiles(d)) set.add(p); } catch { /* reported by check */ } }
  return set;
}

function check() {
  const lock = readLock();
  const problems = [], warns = [];
  if (!lock) { problems.push('missing: tools/files.lock (the lock itself)'); return { problems, warns, lock: null, stats: {} }; }
  if (lock.broken || !lock.files) { problems.push('tools/files.lock is unreadable (damaged). Restore it from the last good copy.'); return { problems, warns, lock: null, stats: {} }; }
  if (lock.seal !== sealOf(lock.dictionaries || [], lock.files)) {
    problems.push('tools/files.lock does not match its seal: it was edited by hand or damaged (entries may have been removed). Restore it from the last good copy.');
  }
  let present = 0;
  for (const [p, e] of Object.entries(lock.files)) {
    const abs = join(ROOT, p);
    if (!existsSync(abs)) { problems.push(`missing: ${p}`); continue; }
    present++;
    const buf = readFileSync(abs);
    if (e.sha256 && sha(buf) !== e.sha256) problems.push(`changed: ${p}`);
    else if (e.bytes >= 200 && buf.length < e.bytes * 0.5) {
      const msg = `shrunk by more than half: ${p} (${e.bytes} -> ${buf.length} bytes)`;
      if (has('--strict')) problems.push(msg); else warns.push(msg);
    }
  }
  let dictOk = 0;
  const present_dirs = dictDirs();
  for (const d of lock.dictionaries || []) {
    if (!present_dirs.includes(d)) problems.push(`missing: dictionary folder ${d} (no manifest.json)`);
  }
  for (const d of present_dirs) dictOk += verifyDict(d, problems);
  const covered = coveredByManifests();
  const fresh = listFiles().filter((f) => !skipped(f) && !covered.has(f) && !(f in lock.files));
  return { problems, warns, lock, stats: { present, dictOk, fresh, dicts: present_dirs.length } };
}

function report(r) {
  for (const w of r.warns) console.warn('GUARD WARN: ' + w);
  if (r.problems.length) {
    console.error(`GUARD FAIL: ${r.problems.length} problem(s). First 40:`);
    for (const p of r.problems.slice(0, 40)) console.error('  ' + p);
    console.error('Do not push or build. Restore the files from the last good copy.');
    return false;
  }
  const s = r.stats;
  console.log(`GUARD OK: ${s.present} locked files present; ${s.dictOk} dictionary files match their hashes (${s.dicts} dictionary folder(s)); ${s.fresh.length} new file(s) not locked yet.`);
  return true;
}

if (has('--forget')) {
  const target = argAfter('--forget');
  const lock = readLock();
  if (!lock || lock.broken) { console.error('Lock missing or damaged.'); process.exit(1); }
  let n = 0;
  for (const k of Object.keys(lock.files)) if (k === target || (target.endsWith('/') && k.startsWith(target))) { delete lock.files[k]; n++; }
  writeLock(lock); console.log(`Forgot ${n} entr${n === 1 ? 'y' : 'ies'} for ${target}.`); process.exit(0);
}
if (has('--accept')) {
  const target = argAfter('--accept');
  const lock = readLock();
  if (!lock || lock.broken) { console.error('Lock missing or damaged.'); process.exit(1); }
  if (!existsSync(join(ROOT, target))) { console.error('No such file: ' + target); process.exit(1); }
  lock.files[target] = entryFor(target); writeLock(lock); console.log('Accepted new content of ' + target); process.exit(0);
}
if (has('--init')) { // first-time creation only
  if (existsSync(LOCK)) { console.error('Lock already exists. Use --ratchet.'); process.exit(1); }
  const dirs = dictDirs(); const covered = coveredByManifests(); const files = {};
  for (const f of listFiles()) if (!skipped(f) && !covered.has(f)) files[f] = entryFor(f);
  writeLock({ dictionaries: dirs, files }); console.log(`Lock created: ${Object.keys(files).length} files, ${dirs.length} dictionary folder(s).`); process.exit(0);
}

const r = check();
if (has('--ratchet') || has('--refresh')) {
  if (!r.lock) { console.error('GUARD FAIL: no lock. Run --init once.'); process.exit(1); }
  if (!report(r)) { console.error('Ratchet refused: fix the damage first.'); process.exit(1); }
  const lock = r.lock; let added = 0, refreshed = 0;
  for (const f of r.stats.fresh) { lock.files[f] = entryFor(f); added++; }
  if (has('--refresh')) for (const p of Object.keys(lock.files)) if (!lock.files[p].sha256) { lock.files[p] = entryFor(p); refreshed++; }
  const dirs = new Set([...(lock.dictionaries || []), ...dictDirs()]); const grew = dirs.size !== (lock.dictionaries || []).length;
  lock.dictionaries = [...dirs];
  if (added || refreshed || grew) { writeLock(lock); console.log(`Lock updated: ${added} added, ${refreshed} refreshed${grew ? ', new dictionary folder locked' : ''}.`); }
  else console.log('Lock unchanged.');
  process.exit(0);
}
process.exit(report(r) ? 0 : 1);
