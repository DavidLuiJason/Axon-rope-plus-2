import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Dictionary, DictionaryError } from '../src/brain/dictionary/dictionary';
let checks = 0;
function assert(v: boolean, m: string) { checks++; if (!v) throw Error(m); }
const dir = './public/dictionary/en';
const read = (p: string) => readFile(join(dir, p), 'utf8');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
async function main() {
  let coreReads = 0;
  const d = await Dictionary.open({ read: async (p) => { if (p.startsWith('core/')) coreReads++; return read(p); }, hash: sha });
  const keys = d.leafKeys();
  assert(keys.length > 0, 'keys exist');
  assert(JSON.stringify(keys) === JSON.stringify([...keys].sort()), 'sorted');
  const manifest = JSON.parse(await read('manifest.json')) as { files: Record<string, unknown> };
  assert(keys.length === Object.keys(manifest.files).filter((p) => /^core\/.+\.json$/.test(p)).length, 'manifest core count');
  keys.pop(); assert(d.leafKeys().length === keys.length + 1, 'copy');
  assert(JSON.stringify(d.leafKeys()) === JSON.stringify([...d.leafKeys()].sort()), 'stable');
  let seen = 0;
  for (const leaf of d.leafKeys().slice(0, 5)) {
    const words = await d.headwordsOf(leaf);
    assert(JSON.stringify(words.map((x) => x.word)) === JSON.stringify(words.map((x) => x.word).sort()), 'headword order');
    for (const item of words.slice(0, 12)) { assert(await d.has(item.word), 'has agrees'); seen++; }
    const before = coreReads;
    const again = await d.headwordsOf(leaf);
    assert(coreReads === before && again.length === words.length, 'cache reuse');
    if (words.length) { again.pop(); assert((await d.headwordsOf(leaf)).length === words.length, 'copy headwords'); }
  }
  assert(seen >= 40, '40 real words across five leaves');
  let unknown = false;
  try { await d.headwordsOf('not-a-leaf'); } catch (e) { unknown = e instanceof DictionaryError && e.message.includes('unknown leaf'); }
  assert(unknown, 'unknown leaf rejected');
  const leaf = d.leafKeys()[0];
  const sample = (await d.headwordsOf(leaf))[0]?.word;
  const bad = await Dictionary.open({ read: async (p) => p === `core/${leaf}.json` ? (await read(p)) + ' ' : read(p), hash: sha });
  let rejected = false;
  try { await bad.headwordsOf(leaf); } catch (e) { rejected = e instanceof DictionaryError && e.message.includes('failed its check'); }
  assert(rejected, 'tampered shard rejected');
  if (sample) {
    let lookupRejected = false;
    try { await bad.lookup(sample); } catch (e) { lookupRejected = e instanceof DictionaryError && e.message.includes('failed its check'); }
    assert(lookupRejected, 'lookup integrity unchanged');
  }
  console.log(`dictionaryEnumerate: ${checks} checks`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
