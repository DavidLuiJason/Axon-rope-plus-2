/** Adapter integration test against the real shard dictionary, read like dictionary.test.ts. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';

let checks = 0;
function assert(condition: boolean, message: string): void {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const DIR = process.env.DICT_DIR ?? './public/dictionary/en';
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

async function main(): Promise<void> {
  let opens = 0;
  let fileReads = 0;
  const openOnDisk = async () => {
    opens += 1;
    return Dictionary.open({
      read: async (path: string) => {
        fileReads += 1;
        return readFile(join(DIR, path), 'utf8');
      },
      hash: sha,
    });
  };
  const slot = createDictionarySlot(openOnDisk);
  assert(slot.status().source.includes('Open English WordNet'), 'status names the dictionary source');
  assert(opens === 0 && fileReads === 0, 'status does not open or read dictionary data');
  assert(slot.credits().version === '2025', 'credits expose the source version without opening data');
  assert(opens === 0 && fileReads === 0, 'credits do not open or read dictionary data');

  const bank = await slot.lookup('bank');
  assert(bank.status === 'found' && bank.word === 'bank', 'bank is found');
  assert(bank.status === 'found' && bank.senses.some((sense) => sense.partOfSpeech === 'noun' && sense.meaning.length > 5), 'bank returns a noun meaning');
  assert(bank.status === 'found' && bank.source === 'Open English WordNet' && bank.version === '2025', 'result carries source and version');
  assert(opens === 1 && fileReads > 0, 'first lookup opens the dictionary once');

  assert(bank.status === 'found' && bank.senses.length <= 5, 'five-sense adapter cap is enforced');
  assert(bank.status === 'found' && bank.senses.every((sense) => !sense.examples || Array.isArray(sense.examples)), 'rich examples are arrays');
  assert(bank.status === 'found' && bank.senses.every((sense) => !sense.synonyms || Array.isArray(sense.synonyms)), 'rich synonyms are arrays');
  assert(bank.status === 'found' && (!bank.pronunciations || bank.pronunciations.every((text) => typeof text === 'string')), 'pronunciations contain text only');

  const run = await slot.lookup('run');
  assert(run.status === 'found' && run.word === 'run', 'run is found');
  const running = await slot.lookup('running');
  assert(running.status === 'found' && running.senses.length > 0, 'running returns real dictionary senses');
  const mice = await slot.lookup('mice');
  assert(mice.status === 'found' && mice.senses.length > 0, 'mice returns real dictionary senses');
  const absent = await slot.lookup('qzxvbn');
  assert(absent.status === 'not-found', 'a missing word remains not-found');
  assert(opens === 1, 'subsequent lookups reuse the opened dictionary');
  console.log(`DICTIONARY SLOT TEST OK: ${checks} checks`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
