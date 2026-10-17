/** AXON G2 source snapshot: one contract for preview, installed app and export.
 * Run `node tools/snapshot.mjs` before a web build, or `--check` after one.
 * Z1 is archived as binary-safe ZIP; Z2 stays in public/ and is indexed by SHA-256.
 * The generated folder is build output, never source or part of the export.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { readZip } from './zip-reader.mjs';

const ROOT = resolve(process.cwd());
const OUTPUT = 'public/_axon-source';
export const EXCLUDED = ['node_modules/', '.git/', 'dist/', 'build/', 'android/', '.gradle/', 'coverage/', '.cache/', '.capacitor/', 'public/_axon-source/', '.DS_Store',
  // Files that package installers and operating systems create by themselves (AI Studio adds bun.lock).
  // Listed one by one on purpose: an unknown stray file must still show up as a difference. package-lock.json is NOT here.
  'bun.lock', 'bun.lockb', 'yarn.lock', 'pnpm-lock.yaml', 'Thumbs.db'];
const MAX_Z1_FILES = 600;
const MAX_Z1_BYTES = 25 * 1024 * 1024;
const sha = (b) => createHash('sha256').update(b).digest('hex');
const clean = (s) => s.split('\\').join('/');

export function excluded(path) {
  const p = clean(path);
  if (EXCLUDED.some((x) => x.endsWith('/') ? p === x.slice(0, -1) || p.startsWith(x) : p === x || p.endsWith('/' + x))) return true;
  // Never include secrets in a downloadable project. .env.example is a documented public template.
  if (p.split('/').some((s) => /^\.env(?:\..*)?$/.test(s) && s !== '.env.example')) return true;
  return false;
}
export function listSourceFiles() {
  const files = [];
  function walk(abs, prefix = '') {
    for (const item of readdirSync(abs, { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${item.name}` : item.name;
      if (excluded(name)) continue;
      if (item.isSymbolicLink()) throw new Error(`Source snapshot refuses symlink: ${name}`);
      if (item.isDirectory()) walk(join(abs, item.name), name);
      else if (item.isFile()) files.push(name);
    }
  }
  walk(ROOT);
  return files.sort();
}
function crc32(data) {
  let c = -1;
  for (const b of data) {
    c ^= b;
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ -1) >>> 0;
}
function writeZip(files) {
  const locals = [], centers = [];
  let offset = 0;
  for (const [name, data] of files) {
    const pathBytes = Buffer.from(name);
    const compressed = deflateRawSync(data, { level: 6 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(pathBytes.length, 26);
    locals.push(local, pathBytes, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(pathBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centers.push(central, pathBytes);
    offset += local.length + pathBytes.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(centers);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}
export function buildSnapshot() {
  const paths = listSourceFiles();
  const z1 = [], entries = [];
  const dictionaryForms = new Map();
  for (const path of paths.filter((p) => /^public\/dictionary\/[^/]+\/manifest\.json$/.test(p))) {
    const meta = JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
    dictionaryForms.set(path.split('/')[2], meta.version === 2 || meta.form === 'packs' ? 'packs' : 'shards');
  }
  let z1Bytes = 0, z2Bytes = 0;
  for (const path of paths) {
    const bytes = readFileSync(join(ROOT, path));
    const zone = path.startsWith('public/dictionary/') ? 'Z2' : 'Z1';
    const form = zone === 'Z2' ? (dictionaryForms.get(path.split('/')[2]) ?? 'shards') : undefined;
    entries.push({ path, zone, ...(form ? { form } : {}), bytes: bytes.length, sha256: sha(bytes), mtime: Math.floor(statSync(join(ROOT, path)).mtimeMs) });
    if (zone === 'Z1') { z1.push([path, bytes]); z1Bytes += bytes.length; }
    else z2Bytes += bytes.length;
  }
  if (z1.length > MAX_Z1_FILES || z1Bytes > MAX_Z1_BYTES) throw new Error(`Z1 budget exceeded: ${z1.length}/${MAX_Z1_FILES} files, ${z1Bytes}/${MAX_Z1_BYTES} bytes`);
  if (z1.length > 65535) throw new Error('Too many ZIP entries');
  const archive = writeZip(z1);
  const manifest = {
    version: 1,
    zones: { Z1: { files: z1.length, bytes: z1Bytes }, Z2: { files: entries.length - z1.length, bytes: z2Bytes } },
    ignore: [...EXCLUDED, '.env (except .env.example)'],
    sourceArchive: { path: `${OUTPUT}/source.zip`, bytes: archive.length, sha256: sha(archive) },
    files: entries,
  };
  mkdirSync(join(ROOT, OUTPUT), { recursive: true });
  writeFileSync(join(ROOT, OUTPUT, 'source.zip'), archive);
  writeFileSync(join(ROOT, OUTPUT, 'manifest.json'), JSON.stringify(manifest));
  console.log(`SNAPSHOT OK: Z1 ${z1.length} files/${z1Bytes} bytes; Z2 ${manifest.zones.Z2.files} files/${z2Bytes} bytes; archive ${archive.length} bytes`);
  return manifest;
}
export function checkSnapshot() {
  const base = join(ROOT, OUTPUT);
  const manifest = JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf8'));
  const archive = readFileSync(join(base, 'source.zip'));
  if (sha(archive) !== manifest.sourceArchive.sha256 || archive.length !== manifest.sourceArchive.bytes) throw new Error('Source archive failed SHA-256/size check');
  const contents = readZip(archive);
  const actual = listSourceFiles();
  const listed = manifest.files.map((f) => f.path);
  if (JSON.stringify(actual) !== JSON.stringify(listed)) throw new Error('Snapshot source file list differs from disk');
  for (const entry of manifest.files) {
    const disk = readFileSync(join(ROOT, entry.path));
    if (disk.length !== entry.bytes || sha(disk) !== entry.sha256) throw new Error(`Snapshot mismatch: ${entry.path}`);
    if (entry.zone === 'Z1') {
      const archived = contents.get(entry.path);
      if (!archived || !archived.equals(disk)) throw new Error(`Source ZIP mismatch: ${entry.path}`);
    } else if (contents.has(entry.path)) throw new Error(`Dictionary duplicated inside Z1: ${entry.path}`);
  }
  if (contents.size !== manifest.zones.Z1.files) throw new Error('Source archive has missing or extra entries');
  console.log(`SNAPSHOT CHECK OK: ${manifest.files.length} files, 0 missing, 0 different; Z2 included in manifest`);
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try { if (process.argv.includes('--check')) checkSnapshot(); else buildSnapshot(); }
  catch (e) { console.error('SNAPSHOT FAILED:', e.message); process.exitCode = 1; }
}
