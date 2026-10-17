/** Knowledge-slot contract tests. Uses a tiny fake source; no dictionary files are opened. */
import { createKnowledgeSlot, type KnowledgeBackend } from '../src/brain/knowledge/slot';

let checks = 0;
function assert(condition: boolean, message: string): void {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const credits = {
  source: 'Fake English Source',
  version: 'test-1',
  license: 'Test licence',
};

function fakeBackend(overrides: Partial<KnowledgeBackend> = {}): KnowledgeBackend {
  return {
    status: () => ({ ready: true, source: credits.source, version: credits.version }),
    async lookup(word) {
      if (word === 'missing-data') throw new Error('data file is missing');
      if (word === 'bad-hash') throw new Error('file failed its check: core/test.json');
      if (word.toLowerCase() !== 'bank') return { status: 'not-found', word };
      return {
        status: 'found',
        word: 'bank',
        senses: [{ partOfSpeech: 'noun', meaning: 'The land beside a river.' }],
      };
    },
    credits: () => credits,
    ...overrides,
  };
}

async function main(): Promise<void> {
  let reads = 0;
  const backend = fakeBackend({
    async lookup(word) {
      reads += 1;
      if (word === 'missing-data') throw new Error('data file is missing');
      if (word === 'bad-hash') throw new Error('file failed its check: core/test.json');
      if (word.toLowerCase() !== 'bank') return { status: 'not-found', word };
      return { status: 'found', word: 'bank', senses: [{ partOfSpeech: 'noun', meaning: 'The land beside a river.' }] };
    },
  });
  const slot = createKnowledgeSlot(backend);
  assert(slot.status().ready, 'status reports the source state');
  assert(reads === 0, 'status does not read or load source data');

  const found = await slot.lookup('bank');
  assert(found.status === 'found' && found.word === 'bank', 'exact match is found');
  assert(found.status === 'found' && found.senses[0]?.partOfSpeech === 'noun', 'found result carries part of speech');
  assert(found.status === 'found' && found.source === credits.source && found.version === credits.version, 'found result names source and version');

  assert(found.status === 'found' && found.senses[0]?.examples === undefined, 'optional rich fields remain optional');

  const missing = await slot.lookup('not-a-word');
  assert(missing.status === 'not-found', 'a genuine missing word is not-found');

  const noData = await slot.lookup('missing-data');
  assert(noData.status === 'error' && noData.message.includes('missing'), 'missing data is an error, not not-found');
  const badHash = await slot.lookup('bad-hash');
  assert(badHash.status === 'error' && badHash.message.includes('integrity check') && !badHash.message.includes('core/test.json'), 'hash failure is an error, not not-found');

  assert(JSON.stringify(slot.credits()) === JSON.stringify(credits), 'credits are returned without loading the source');
  assert(reads === 4, 'only lookup calls touched the source');
  console.log(`KNOWLEDGE SLOT TEST OK: ${checks} checks`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
