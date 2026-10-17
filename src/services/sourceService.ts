/** AXON G2: ONE verified snapshot for source tree, viewer and complete export.
 * Z1 is archived at build time. Z2 (dictionary) stays in the app assets and in
 * every complete export. No Vite glob or separate dev-only all-files route.
 */
import JSZip from 'jszip';
import { RecentChat } from '../types';
import { saveFile, SaveFileResult } from './saveFile';
import { mapPool } from './exportPool';

export interface SourceNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: number;
  children?: SourceNode[];
}
export interface SourceFileRecord {
  path: string;
  name: string;
  content: string;
  size?: number;
  mtime?: number;
}
interface SnapshotEntry {
  path: string;
  zone: 'Z1' | 'Z2';
  form?: 'shards' | 'packs';
  bytes: number;
  sha256: string;
  mtime?: number;
}
interface SnapshotManifest {
  version: number;
  zones: { Z1: { files: number; bytes: number }; Z2: { files: number; bytes: number } };
  ignore: string[];
  sourceArchive: { path: string; bytes: number; sha256: string };
  files: SnapshotEntry[];
}
/** Files checked at the same time during an export. Bounded, so it never fans out into thousands of requests. */
const EXPORT_PARALLEL = 16;
const assetBase = `${import.meta.env.BASE_URL}_axon-source/`;
let lastManifest: SnapshotManifest | null = null;
let sourceZip: JSZip | null = null;
let sourceZipHash: string | null = null;

function validPath(p: string): boolean {
  return p.length > 0 && !p.startsWith('/') && !p.includes('\\') && !p.includes('\0') &&
    p.split('/').every((segment) => segment !== '..' && segment !== '.' && segment.length > 0);
}
async function digest(bytes: Uint8Array): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('SHA-256 is unavailable; refusing an unverified project export.');
  }
  const hash = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
async function getBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Missing source asset (${response.status}): ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}
async function getManifest(refresh = false): Promise<SnapshotManifest> {
  if (!refresh && lastManifest) return lastManifest;
  // In AI Studio/Vite, this endpoint regenerates the same snapshot from live files.
  // The installed app uses the build-time copy of that very same snapshot.
  const url = import.meta.env.DEV ? '/api/axon-source/manifest' : `${assetBase}manifest.json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Cannot load AXON source manifest (HTTP ${res.status})`);
  const manifest = await res.json() as SnapshotManifest;
  if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error('Unsupported AXON source manifest');
  const seen = new Set<string>();
  let z1 = 0, z2 = 0, b1 = 0, b2 = 0;
  for (const file of manifest.files) {
    if (!validPath(file.path) || seen.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0) {
      throw new Error(`Invalid or duplicate source manifest entry: ${file.path}`);
    }
    seen.add(file.path);
    if (file.zone === 'Z1') { z1++; b1 += file.bytes; }
    else if (file.zone === 'Z2') { z2++; b2 += file.bytes; }
    else throw new Error(`Unknown source zone: ${file.path}`);
  }
  if (z1 !== manifest.zones.Z1.files || z2 !== manifest.zones.Z2.files || b1 !== manifest.zones.Z1.bytes || b2 !== manifest.zones.Z2.bytes) {
    throw new Error('AXON source manifest count or byte budget mismatch');
  }
  lastManifest = manifest;
  return manifest;
}
async function loadZ1(manifest: SnapshotManifest): Promise<JSZip> {
  if (sourceZip && sourceZipHash === manifest.sourceArchive.sha256) return sourceZip;
  const bytes = await getBytes(`${assetBase}source.zip`);
  if (bytes.length !== manifest.sourceArchive.bytes || await digest(bytes) !== manifest.sourceArchive.sha256) {
    throw new Error('AXON source archive failed SHA-256 verification');
  }
  const archive = await JSZip.loadAsync(bytes, { checkCRC32: true });
  sourceZip = archive;
  sourceZipHash = manifest.sourceArchive.sha256;
  return archive;
}
async function readEntry(entry: SnapshotEntry, manifest: SnapshotManifest): Promise<Uint8Array> {
  let bytes: Uint8Array;
  if (entry.zone === 'Z1') {
    const archive = await loadZ1(manifest);
    const file = archive.file(entry.path);
    if (!file) throw new Error(`Missing source file: ${entry.path}`);
    bytes = await file.async('uint8array');
  } else {
    bytes = await getBytes(`${import.meta.env.BASE_URL}${entry.path.replace(/^public\//, '')}`);
  }
  if (bytes.length !== entry.bytes || await digest(bytes) !== entry.sha256) {
    throw new Error(`File failed SHA-256/size verification: ${entry.path}`);
  }
  return bytes;
}
function decodeForViewer(bytes: Uint8Array): string {
  if (bytes.includes(0)) return '[Binary file: available byte-for-byte in the source export]';
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return '[Binary file: available byte-for-byte in the source export]'; }
}
export async function fetchLiveSourceTree(): Promise<SourceNode[]> {
  const manifest = await getManifest(true);
  const root: SourceNode[] = [];
  for (const entry of manifest.files) {
    const segments = entry.path.split('/');
    let nodes = root;
    let p = '';
    for (let i = 0; i < segments.length; i++) {
      const name = segments[i];
      p = p ? `${p}/${name}` : name;
      if (i === segments.length - 1) nodes.push({ name, path: p, type: 'file', size: entry.bytes, mtime: entry.mtime });
      else {
        let dir = nodes.find((n) => n.type === 'directory' && n.name === name);
        if (!dir) { dir = { name, path: p, type: 'directory', children: [] }; nodes.push(dir); }
        nodes = dir.children!;
      }
    }
  }
  return root;
}
export async function fetchLiveSourceFile(filePath: string): Promise<{ content: string; size?: number; mtime?: number }> {
  const manifest = await getManifest();
  const entry = manifest.files.find((f) => f.path === filePath);
  if (!entry) throw new Error(`Source file not in manifest: ${filePath}`);
  const bytes = await readEntry(entry, manifest);
  return { content: decodeForViewer(bytes), size: entry.bytes, mtime: entry.mtime };
}
export async function fetchAllLiveFiles(): Promise<SourceFileRecord[]> {
  const manifest = await getManifest(true);
  const result: SourceFileRecord[] = [];
  for (const entry of manifest.files) {
    const bytes = await readEntry(entry, manifest);
    result.push({ path: entry.path, name: entry.path.split('/').pop() || entry.path, content: decodeForViewer(bytes), size: entry.bytes, mtime: entry.mtime });
  }
  return result;
}
export interface ExportZipOptions {
  withUserData: boolean;
  includeDictionary?: boolean;
  recents: RecentChat[];
  userName: string;
  selectedModel: string;
  activeChatId: string | null;
  /** Called while exporting: phase 'verify' counts files, phase 'pack' counts percent. */
  onProgress?: (info: { phase: 'verify' | 'pack'; done: number; total: number }) => void;
}
export async function exportAsZip(options: ExportZipOptions): Promise<SaveFileResult> {
  const manifest = await getManifest(true);
  const complete = options.includeDictionary !== false;
  const zip = new JSZip();
  const selected = manifest.files.filter((f) => complete || f.zone === 'Z1');
  const startedAt = Date.now();
  // Every file must pass its size and SHA-256 check before a ZIP can be saved.
  // A small fixed number of files are checked at once (EXPORT_PARALLEL): the same checks,
  // far less waiting for the network. Results keep the manifest order, so the ZIP is the same.
  if (selected.some((f) => f.zone === 'Z1')) await loadZ1(manifest); // load the source archive once, before the lanes start
  const verified = await mapPool(selected, EXPORT_PARALLEL, (entry) => readEntry(entry, manifest),
    (done, total) => options.onProgress?.({ phase: 'verify', done, total }));
  selected.forEach((entry, i) => {
    // Dictionary text is large and compresses well at a cheaper setting; the file bytes are unchanged.
    zip.file(entry.path, verified[i], entry.zone === 'Z2' ? { compression: 'DEFLATE', compressionOptions: { level: 3 } } : undefined);
  });
  if (options.withUserData) {
    const folder = zip.folder('user-data')!;
    const exportedAt = new Date().toISOString();
    folder.file('conversations.json', JSON.stringify({ exportedAt, userName: options.userName, selectedModel: options.selectedModel, activeChatId: options.activeChatId, conversations: options.recents }, null, 2));
    folder.file('settings.json', JSON.stringify({ userName: options.userName, selectedModel: options.selectedModel, exportedAt, version: 'AXON 1.0 Foundation' }, null, 2));
    let history = `# AXON Conversation History\nExported: ${exportedAt}\n\n`;
    for (const chat of options.recents) {
      history += `## ${chat.title}\n*Timestamp: ${chat.timestamp}*\n\n`;
      for (const msg of chat.messages) history += `### ${msg.role === 'user' ? options.userName : 'AXON'}\n${msg.content}\n\n`;
    }
    folder.file('conversation-history.md', history);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => options.onProgress?.({ phase: 'pack', done: Math.round(meta.percent), total: 100 }));
  const day = new Date().toISOString().slice(0, 10);
  const name = !complete ? `axon-SOURCE-ONLY-NOT-A-PROJECT-${day}.zip` : options.withUserData ? `axon-source-with-userdata-${day}.zip` : `axon-source-code-${day}.zip`;
  const saved = await saveFile(name, blob, 'application/zip');
  if (!saved.success) throw new Error(saved.error || 'Unable to save verified source ZIP');
  return { ...saved, message: `${complete ? 'Complete verified project' : 'INCOMPLETE source only (NOT a project)'}: ${selected.length}/${manifest.files.length} files, ${selected.reduce((sum, e) => sum + e.bytes, 0)} bytes verified in ${((Date.now() - startedAt) / 1000).toFixed(1)} s. ${saved.message ?? ''}` };
}
