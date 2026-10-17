/** G3 candidate: indexed, hash-checked, lazy ZIP-pack dictionary reader.
 * NOT YET CONNECTED to the production dictionary (needs G3c build and phone proof).
 * Each ZIP member is compressed independently; at most three packs stay cached.
 */
import JSZip from 'jszip';
import type { ReadText } from './types';

interface PackIndex {
  version: number;
  packs: Record<string, { bytes: number; sha256: string }>;
  files: Record<string, string>;
}
const sha = async (bytes: Uint8Array): Promise<string> => {
  if (typeof crypto === 'undefined' || !crypto.subtle) throw new Error('SHA-256 is required to verify dictionary packs');
  const hash = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
};
export function createPackedReader(baseUrl: string, maxCachedPacks = 3): ReadText {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const cache = new Map<string, Promise<JSZip>>();
  let indexPromise: Promise<PackIndex> | null = null;
  const text = async (path: string): Promise<string> => {
    const response = await fetch(base + path);
    if (!response.ok) throw new Error(`Dictionary HTTP ${response.status}: ${path}`);
    return response.text();
  };
  const getIndex = (): Promise<PackIndex> => {
    if (!indexPromise) indexPromise = (async () => {
      const manifest = JSON.parse(await text('manifest.json')) as { version: number; files: Record<string, { bytes: number; sha256: string }> };
      if (manifest.version !== 2 || !manifest.files['packs/index.json']) throw new Error('Dictionary pack manifest missing or unsupported');
      const response = await fetch(`${base}packs/index.json`);
      if (!response.ok) throw new Error(`Dictionary pack index HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const expected = manifest.files['packs/index.json'];
      if (bytes.length !== expected.bytes || await sha(bytes) !== expected.sha256) throw new Error('Dictionary pack index failed SHA-256');
      const value = JSON.parse(new TextDecoder().decode(bytes)) as PackIndex;
      if (value.version !== 1) throw new Error('Unsupported dictionary pack index');
      for (const [name, info] of Object.entries(value.packs)) {
        const physical = manifest.files[`packs/${name}`];
        if (!physical || physical.bytes !== info.bytes || physical.sha256 !== info.sha256) throw new Error(`Pack index/manifest mismatch: ${name}`);
      }
      return value;
    })().catch((err) => { indexPromise = null; throw err; });
    return indexPromise;
  };
  return async (path: string) => {
    if (!path.startsWith('core/') && !path.startsWith('rel/')) return text(path);
    const index = await getIndex();
    const pack = Object.prototype.hasOwnProperty.call(index.files, path) ? index.files[path] : undefined;
    if (!pack || !Object.prototype.hasOwnProperty.call(index.packs, pack)) throw new Error(`Dictionary shard missing from pack index: ${path}`);
    let loading = cache.get(pack);
    if (!loading) {
      loading = (async () => {
        const response = await fetch(`${base}packs/${pack}`);
        if (!response.ok) throw new Error(`Dictionary pack HTTP ${response.status}: ${pack}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const expected = index.packs[pack];
        if (bytes.length !== expected.bytes || await sha(bytes) !== expected.sha256) throw new Error(`Dictionary pack hash failed: ${pack}`);
        return JSZip.loadAsync(bytes, { checkCRC32: true });
      })();
      cache.set(pack, loading);
      while (cache.size > Math.max(1, maxCachedPacks)) cache.delete(cache.keys().next().value!);
      loading.catch(() => { if (cache.get(pack) === loading) cache.delete(pack); });
    } else { cache.delete(pack); cache.set(pack, loading); }
    const archive = await loading;
    const member = archive.file(path);
    if (!member) throw new Error(`Dictionary shard missing inside pack: ${path}`);
    return member.async('string');
  };
}
