import type { BrainRequest } from '../src/brain/types';
import type { KnowledgeLookupResult, KnowledgeSlot } from '../src/brain/knowledge/slot';
import { createDictionaryProvider } from '../src/brain/knowledge/dictionaryProvider';
let checks = 0;
function assert(condition: boolean, message: string): void { checks++; if (!condition) throw new Error(`FAIL: ${message}`); }
const ask = (text: string): BrainRequest => ({ text, place: 'chat' });
function fakeSlot() {
  const calls: string[] = [];
  const slot: KnowledgeSlot = {
    status: () => ({ ready: true, source: 'Open English WordNet', version: '2025' }),
    async lookup(word): Promise<KnowledgeLookupResult> {
      calls.push(word);
      return word.toLowerCase() === 'bank'
        ? { status: 'found', word: 'bank', source: 'Open English WordNet', version: '2025', senses: [{ partOfSpeech: 'noun', meaning: 'A financial institution.', example: 'She went to the bank.' }] }
        : { status: 'not-found', word, source: 'Open English WordNet', version: '2025' };
    },
    credits: () => ({ source: 'Open English WordNet', version: '2025' }),
  };
  return { slot, calls };
}
async function main(): Promise<void> {
  const { slot, calls } = fakeSlot();
  const provider = createDictionaryProvider(slot);
  for (const phrase of ['define the word bank', 'define the term bank', 'define the meaning of bank', 'define the definition of bank', 'what does the word bank mean', 'what does the term bank mean', 'meaning of bank', 'definition of bank', 'what is the meaning of bank', 'what is the definition of bank', 'define bank']) {
    const reply = await provider.handle(ask(phrase));
    assert(reply !== null && reply.content.includes('bank'), `lookup phrase resolves bank: ${phrase}`);
    assert(calls[calls.length - 1] === 'bank', `lookup target is bank: ${phrase}`);
  }
  for (const phrase of ['define the', 'define', 'I need to define my goals', 'define bank as money', 'define bank means money', 'define bank stands for money', 'the word means nothing here']) {
    const before = calls.length;
    const reply = await provider.handle(ask(phrase));
    assert(reply === null && calls.length === before, `non-lookup phrase stays local: ${phrase}`);
  }
  console.log(`DICTIONARY POLISH TEST OK: ${checks} checks`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
