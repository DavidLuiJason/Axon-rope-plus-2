import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Dictionary } from '../src/brain/dictionary/dictionary';
import { fnv1a, pickHeadword, type HeadwordSource } from '../src/brain/dictionary/pickHeadword';
import type { DictEntry } from '../src/brain/dictionary/types';
let checks = 0;
function assert(value: boolean, message: string) { checks++; if (!value) throw new Error(message); }
const entry = (example = 'Example'): DictEntry => ({ id: 'a', pos: 'noun', pos_tag: 'n', senses: [{ synset: 's', pos_tag: 'n', definition: 'Meaning', examples: example ? [example] : [] }] });
const fake: HeadwordSource = { leafKeys: () => ['a', 'b'], headwordsOf: async () => [
  { word: 'ABCD', entries: [entry()] }, { word: 'abc-def', entries: [entry()] },
  { word: 'ab', entries: [entry()] }, { word: 'alpha', entries: [entry()] },
  { word: 'bravo', entries: [entry()] }, { word: 'short', entries: [entry('')] },
  { word: 'apple', entries: [entry()] }, { word: 'cat', entries: [entry()] },
] };
async function main() {
  assert(fnv1a('hello') === 0x4f9f2cab, 'FNV known vector');
  const a = await pickHeadword({ dictionary: fake, mode: 'day', seed: '2026-10-17' });
  assert(a.ok && /^[a-z]{5,}$/.test(a.word), 'day only eligible');
  for (let i = 0; i < 20; i++) assert(JSON.stringify(await pickHeadword({ dictionary: fake, mode: 'day', seed: '2026-10-17' })) === JSON.stringify(a), 'stable');
  const random = await pickHeadword({ dictionary: fake, mode: 'random', seed: 'abc' });
  assert(random.ok && random.word.length >= 3, 'random min three');
  assert(!(await pickHeadword({ dictionary: { leafKeys: () => ['a'], headwordsOf: async () => [] }, seed: 'x', mode: 'random' })).ok, 'none');
  assert((await pickHeadword({ dictionary: fake, seed: '', mode: 'random' })).ok === false, 'invalid');
  assert((await pickHeadword({ dictionary: { leafKeys: () => ['a'], headwordsOf: async () => { throw Error('bad'); } }, seed: 'x', mode: 'random' })).ok === false, 'reader failure');
  // Each isolated fixture has exactly one rule to prove, regardless of hash selection.
  const source = (items: { word: string; entries: DictEntry[] }[], leaves = ['leaf']): HeadwordSource => ({
    leafKeys: () => [...leaves], headwordsOf: async () => items,
  });
  const pick = (dictionary: HeadwordSource, mode: 'day' | 'random' = 'day', seed = '2026-10-17') =>
    pickHeadword({ dictionary, mode, seed: mode === 'day' ? seed : 'random-seed' });
  assert((await pick(source([{ word: 'four', entries: [entry()] }]))).ok === false, 'day rejects four letters');
  assert((await pick(source([{ word: 'valid', entries: [entry()] }]))).ok === true, 'day accepts five letters');
  assert((await pick(source([{ word: 'ab', entries: [entry()] }]), 'random')).ok === false, 'random rejects two letters');
  assert((await pick(source([{ word: 'cat', entries: [entry()] }]), 'random')).ok === true, 'random accepts three letters');
  assert((await pick(source([{ word: 'alpha', entries: [entry('')] }]))).ok === false, 'day requires example');
  assert((await pick(source([{ word: 'alpha', entries: [entry('')] }]), 'random')).ok === true, 'random does not require example');
  for (const badWord of ['Alpha', 'ALPHA', 'alpha-beta', 'alpha2', 'éclair', '😀alpha']) {
    assert((await pick(source([{ word: badWord, entries: [entry()] }]))).ok === false, `reject non-lowercase alphabetic ${badWord}`);
  }
  // With 61 leaves, position the sole match at the 61st probe, irrespective of hash.
  const leaves61 = Array.from({ length: 61 }, (_, i) => `leaf-${i}`);
  const start61 = fnv1a('2026-10-17') % leaves61.length;
  const lastLeaf = leaves61[(start61 + 60) % 61];
  const sixtyFirst: HeadwordSource = {
    leafKeys: () => [...leaves61],
    headwordsOf: async (leaf: string) => leaf === lastLeaf ? [{ word: 'alpha', entries: [entry()] }] : [],
  };
  assert((await pick(sixtyFirst)).ok === false, '61st leaf is never visited');
  const sixtiethLeaf = leaves61[(start61 + 59) % 61];
  const sixtieth: HeadwordSource = {
    leafKeys: () => [...leaves61],
    headwordsOf: async (leaf: string) => leaf === sixtiethLeaf ? [{ word: 'alpha', entries: [entry()] }] : [],
  };
  const sixtiethResult = await pick(sixtieth);
  assert(sixtiethResult.ok && sixtiethResult.word === 'alpha', '60th leaf is visited');
  const unsorted = ['zebra', 'apple', 'mango', 'bravo'].map((word) => ({ word, entries: [entry()] }));
  const ordered = [...unsorted].sort((a, b) => a.word.localeCompare(b.word));
  for (let i = 0; i < 20; i++) {
    const seed = `2026-11-${String(i + 1).padStart(2, '0')}`;
    const x = await pick(source(unsorted), 'day', seed);
    const y = await pick(source(ordered), 'day', seed);
    assert(x.ok && y.ok && x.word === y.word, `candidate order invariant ${seed}`);
  }
  const dir = './public/dictionary/en';
  const d = await Dictionary.open({ read: (p) => readFile(join(dir, p), 'utf8'), hash: (s) => createHash('sha256').update(s).digest('hex') });
  const dates: string[] = [];
  for (let i = 0; i < 10; i++) {
    const date = `2026-10-${String(17 + i).padStart(2, '0')}`;
    const result = await pickHeadword({ dictionary: d, mode: 'day', seed: date });
    assert(result.ok, `real day ${date}`);
    if (result.ok) dates.push(`${date}: ${result.word}`);
  }
  console.log(dates.join('\n'));
  console.log(`pickHeadword: ${checks} checks`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
