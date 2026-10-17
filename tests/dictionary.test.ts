/**
 * Dictionary loader tests (DICT-C2). Run against the real converted English dictionary.
 * Set DICT_DIR to the folder written by reshard_dictionary.py (default ./public/dictionary/en)
 * and DICT_SOURCE_DIR to the DICT-X1 "out" folder for the spot-check comparison (optional).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Dictionary, DictionaryError, keyOf, lemmaCandidates } from '../src/brain/dictionary';
import { irregularBases } from '../src/brain/dictionary/irregulars';
import type { DictEntry, LookupResult } from '../src/brain/dictionary';

const DIR = process.env.DICT_DIR ?? './public/dictionary/en';
const SRC = process.env.DICT_SOURCE_DIR ?? '';

let checks = 0;
function assert(cond: boolean, msg: string) {
  checks += 1;
  if (!cond) throw new Error(`FAIL: ${msg}`);
}
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const reader = (dir: string) => (p: string) => readFile(join(dir, p), 'utf8');
const words = (r: LookupResult) => r.matches.map((m) => `${m.word}:${m.via}`);
const hasPos = (r: LookupResult, word: string, tag: string) =>
  r.matches.some((m) => m.word === word && m.entries.some((e) => e.pos_tag === tag));

async function main() {
  const reads: string[] = [];
  const counting = (p: string) => { reads.push(p); return readFile(join(DIR, p), 'utf8'); };
  const d = await Dictionary.open({ read: counting, hash: sha });
  const info = d.info();

  // opening and credits
  assert(info.headwords === 128009 && info.entries === 135969 && info.senses === 185129, 'manifest counts match the extraction run');
  assert(info.label.includes('Open English Wordnet') && info.version === '2025', 'source name and release are recorded');
  const credit = await d.attribution();
  assert(credit.includes('Princeton') && credit.includes('Creative Commons'), 'credit text names Princeton and Creative Commons');
  assert(existsSync(join(DIR, 'licenses', 'LICENSE.md')) && existsSync(join(DIR, 'licenses', 'WNDB_License.txt')), 'licence files ship with the data');

  // plain lookups
  const bank = await d.lookup('bank');
  assert(bank.found && bank.matches[0]?.via === 'exact', 'bank is found exactly');
  assert(hasPos(bank, 'bank', 'n') && hasPos(bank, 'bank', 'v'), 'bank has noun and verb entries');
  assert((bank.matches[0]?.entries[0]?.senses[0]?.definition ?? '').length > 5, 'bank has a definition');
  assert((await d.lookup('  Bank ')).matches.some((m) => m.word === 'bank'), 'spaces and capitals are tolerated');

  // capitalisation: "zealot" and "Zealot" are separate headwords
  const zExact = await d.lookup('zealot');
  assert(zExact.matches[0]?.word === 'zealot' && zExact.matches[0].via === 'exact', 'zealot is found exactly');
  const zUp = await d.lookup('ZEALOT');
  assert(zUp.matches.some((m) => m.word === 'Zealot' && m.via === 'case') && zUp.matches.some((m) => m.word === 'zealot'), 'ZEALOT finds both capitalisations');
  const monday = await d.lookup('monday');
  assert(monday.matches.some((m) => m.word === 'Monday' && m.via === 'case'), 'monday finds Monday');

  // irregular forms
  assert(hasPos(await d.lookup('ran'), 'run', 'v'), 'ran -> run (verb)');
  assert(hasPos(await d.lookup('gone'), 'go', 'v'), 'gone -> go');
  assert(hasPos(await d.lookup('was'), 'be', 'v'), 'was -> be');
  assert(hasPos(await d.lookup('mice'), 'mouse', 'n'), 'mice -> mouse');
  assert(hasPos(await d.lookup('children'), 'child', 'n'), 'children -> child');
  assert(hasPos(await d.lookup('knives'), 'knife', 'n'), 'knives -> knife');
  const better = await d.lookup('better');
  assert(better.matches[0]?.via === 'exact', 'better is found as itself first');
  assert(hasPos(better, 'good', 'a') && hasPos(better, 'well', 'r'), 'better -> good (adjective) and well (adverb)');
  assert(hasPos(await d.lookup('wrote'), 'write', 'v') && hasPos(await d.lookup('written'), 'write', 'v'), 'wrote and written -> write');

  // suffix rules
  assert(hasPos(await d.lookup('running'), 'run', 'v'), 'running -> run');
  assert(hasPos(await d.lookup('dogs'), 'dog', 'n'), 'dogs -> dog');
  assert(hasPos(await d.lookup('cities'), 'city', 'n'), 'cities -> city');
  assert(hasPos(await d.lookup('studies'), 'study', 'v') && hasPos(await d.lookup('studies'), 'study', 'n'), 'studies -> study (verb and noun)');
  assert(hasPos(await d.lookup('bigger'), 'big', 'a'), 'bigger -> big');
  assert(hasPos(await d.lookup('tried'), 'try', 'v'), 'tried -> try');
  assert(hasPos(await d.lookup('making'), 'make', 'v'), 'making -> make');
  assert(hasPos(await d.lookup('happier'), 'happy', 'a'), 'happier -> happy');
  assert(hasPos(await d.lookup('dying'), 'die', 'v'), 'dying -> die');
  assert(hasPos(await d.lookup('boxes'), 'box', 'n'), 'boxes -> box');
  assert(hasPos(await d.lookup('African clawed frogs'), 'African clawed frog', 'n'), 'last word of a phrase is inflected');
  const frog = await d.lookup('African clawed frog');
  assert(frog.found && frog.matches[0]?.via === 'exact', 'multi-word headword is found');

  // the dictionary's own form list
  assert((await d.lookup('aardwolves')).matches.some((m) => m.word === 'aardwolf'), 'aardwolves -> aardwolf');

  // nothing invented
  assert(!(await d.lookup('qzxvbn')).found, 'a nonsense word is not found');
  assert(!(await d.lookup('')).found && !(await d.lookup('   ')).found, 'empty input is not found');
  assert(!(await d.has('zzzzzzz')), 'has() is false for a missing word');
  for (const m of (await d.lookup('running')).matches) assert(m.entries.length > 0, 'every match carries entries');

  // words that are also names of object properties must not break anything
  for (const odd of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
    const r = await d.lookup(odd);
    assert(Array.isArray(r.matches), `${odd} is handled safely`);
    for (const m of r.matches) assert(Array.isArray(m.entries) && m.entries.length > 0, `${odd} matches are real entries`);
    assert((await d.relations(odd)).every((e) => Array.isArray(e)), `${odd} relations are safe`);
  }

  // relations
  const rel = await d.relations('run');
  const runEntries = (await d.lookup('run')).matches[0]?.entries ?? [];
  assert(rel.length === runEntries.length, 'relations align with entries');
  assert(rel.every((r, i) => r.length === (runEntries[i]?.senses.length ?? -1)), 'relations align with senses');
  const baseball = runEntries.flatMap((e, i) => e.senses.map((s, j) => ({ s, r: rel[i]?.[j] }))).find((x) => (x.s.definition ?? '').includes('baseball'));
  assert(!!baseball && (baseball.r?.relations?.hypernym ?? []).includes('score'), 'the baseball sense of run links up to score');
  assert((await d.relations('qzxvbn')).length === 0, 'no relations for a missing word');

  // every headword resolves to the file that holds it
  let bad = 0;
  let total = 0;
  const coreDir = join(DIR, 'core');
  for (const f of readdirSync(coreDir)) {
    const leaf = f.replace('.json', '');
    const data = JSON.parse(readFileSync(join(coreDir, f), 'utf8')) as Record<string, DictEntry[]>;
    for (const w of Object.keys(data)) { total += 1; if (d.leafOf(w) !== leaf) bad += 1; }
  }
  assert(total === 128009, `all ${total} headwords were visited`);
  assert(bad === 0, `every headword maps to its own file (${bad} do not)`);

  // exact lookup of a deterministic sample of 4000 headwords
  const allLeaves = readdirSync(coreDir).sort();
  let sampled = 0; let missed = 0; let n = 0;
  for (const f of allLeaves) {
    const data = JSON.parse(readFileSync(join(coreDir, f), 'utf8')) as Record<string, DictEntry[]>;
    for (const w of Object.keys(data)) {
      n += 1;
      if (n % 32 !== 0) continue;
      sampled += 1;
      const r = await d.lookup(w);
      if (!(r.matches[0]?.word === w && r.matches[0].via === 'exact')) missed += 1;
    }
  }
  assert(sampled > 3900 && missed === 0, `sample of ${sampled} headwords all found exactly (${missed} missed)`);

  // the hand-written irregular list is checked against the real dictionary
  const wrong: string[] = [];
  for (const { base, pos } of irregularBases()) {
    const r = await d.lookup(base);
    const ok = r.matches[0]?.via === 'exact' && r.matches[0].entries.some((e) => (e.pos_tag === 's' ? 'a' : e.pos_tag) === pos);
    if (!ok) wrong.push(`${base}/${pos}`);
  }
  assert(wrong.length === 0, `irregular bases missing from the dictionary: ${wrong.join(', ')}`);
  assert(lemmaCandidates('ran').some((c) => c.base === 'run' && c.via === 'irregular'), 'rules module lists ran -> run as irregular');

  // the 200 spot-check words from the extraction run, compared to this layout
  if (SRC && existsSync(join(SRC, 'spot_check.json'))) {
    const sc = JSON.parse(readFileSync(join(SRC, 'spot_check.json'), 'utf8')) as { words: Record<string, DictEntry[]> };
    let diff = 0;
    for (const [w, srcEntries] of Object.entries(sc.words)) {
      const got = (await d.lookup(w)).matches.find((m) => m.word === w && m.via === 'exact');
      const rels = await d.relations(w);
      const merged = (got?.entries ?? []).map((e, i) => ({
        ...e,
        senses: e.senses.map((s, j) => ({ ...s, ...(rels[i]?.[j]?.relations ? { relations: rels[i]?.[j]?.relations } : {}), ...(rels[i]?.[j]?.sense_relations ? { sense_relations: rels[i]?.[j]?.sense_relations } : {}) })),
      }));
      if (JSON.stringify(sortKeys(merged)) !== JSON.stringify(sortKeys(srcEntries))) diff += 1;
    }
    assert(diff === 0, `the 200 spot-check words match the extraction run exactly (${diff} differ)`);
  }

  // integrity: a changed file is refused
  const tampered = async (p: string) => {
    const t = await readFile(join(DIR, p), 'utf8');
    return p === 'core/ba.json' || p.startsWith('core/b') ? t.replace('"', '“') : t;
  };
  const dt = await Dictionary.open({ read: tampered, hash: sha });
  let refused = false;
  try { await dt.lookup('bank'); } catch (e) { refused = e instanceof DictionaryError; }
  assert(refused, 'a file that fails its hash check is refused');

  // credits are required
  let noCredit = false;
  try {
    await Dictionary.open({ read: async (p) => { if (p === 'ATTRIBUTION.txt') throw new Error('missing'); return readFile(join(DIR, p), 'utf8'); } });
  } catch (e) { noCredit = e instanceof DictionaryError; }
  assert(noCredit, 'the dictionary does not open without its credits');

  // files are loaded on demand and kept
  reads.length = 0;
  const d2 = await Dictionary.open({ read: counting, cacheFiles: 4 });
  const before = reads.length;
  await d2.lookup('zebra'); const afterFirst = reads.length;
  await d2.lookup('zebra');
  assert(reads.length === afterFirst && afterFirst > before, 'a second lookup of the same word reads no new file');
  assert(keyOf('Éclair', 3) === 'ecl' && keyOf('a', 3) === 'a__' && keyOf("'hood", 2) === '_h', 'key rule handles accents, short words and punctuation');

  console.log(`dictionary tests passed: ${checks} checks`);
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, sortKeys(x)]));
  return v;
}

main().catch((e) => { console.error(e); process.exit(1); });
