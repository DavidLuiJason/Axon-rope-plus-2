/** Dictionary provider tests: explicit lookup intent only, with no side effects for other messages. */
import type { BrainRequest } from '../src/brain/types';
import { createBrain } from '../src/brain/brain';
import { createFoundation } from '../src/brain/foundation';
import { createLocalRules } from '../src/brain/localRules';
import { TEXT_COUNT_COMMAND } from '../src/brain/textCountCommand';
import { createAxonEngine } from '../src/kernel/axonEngine';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { PLANNED_SOURCES } from '../src/brain/brain';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { KnowledgeLookupResult, KnowledgeSlot } from '../src/brain/knowledge/slot';
import { createDictionaryProvider, DEFAULT_MEANINGS_SHOWN } from '../src/brain/knowledge/dictionaryProvider';

let checks = 0;
function assert(condition: boolean, message: string): void {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${message}`);
}
const ask = (text: string): BrainRequest => ({ text, place: 'chat' });

function fakeSlot(mode: 'normal' | 'error' = 'normal') {
  const calls: string[] = [];
  const slot: KnowledgeSlot = {
    status: () => ({ ready: true, source: 'Open English WordNet', version: '2025' }),
    async lookup(word): Promise<KnowledgeLookupResult> {
      calls.push(word);
      if (mode === 'error') return { status: 'error', word, message: 'file failed its check', source: 'Open English WordNet', version: '2025' };
      if (word.toLowerCase() !== 'bank') return { status: 'not-found', word, source: 'Open English WordNet', version: '2025' };
      return {
        status: 'found', word: 'bank', source: 'Open English WordNet', version: '2025',
        senses: [
          { partOfSpeech: 'noun', meaning: 'The land alongside a river.', example: 'They sat on the bank.' },
          { partOfSpeech: 'verb', meaning: 'To rely on or count on something.' },
          { partOfSpeech: 'noun', meaning: 'A place where money is kept.' },
          { partOfSpeech: 'noun', meaning: 'A fourth sense that must be shown.' },
          { partOfSpeech: 'noun', meaning: 'A fifth sense that must be shown.' },
          { partOfSpeech: 'noun', meaning: 'A sixth sense that must not be shown.' },
        ],
      };
    },
    credits: () => ({ source: 'Open English WordNet', version: '2025' }),
  };
  return { slot, calls };
}

async function main(): Promise<void> {
  const { slot, calls } = fakeSlot();
  const provider = createDictionaryProvider(slot);
  assert(provider.id === 'english-dictionary', 'provider has a stable id');
  assert(provider.holdsConversation() === false, 'provider never holds a conversation');
  assert(provider.status().ready, 'status reports readiness without lookup');
  assert(calls.length === 0, 'status does not look up or open dictionary data');

  const accepted = [
    'define bank', 'DEFINE BANK!', 'what does bank mean?', 'meaning of bank',
    'definition of bank', 'what is the definition of bank', 'what is the meaning of bank?',
  ];
  for (const message of accepted) {
    const reply = await provider.handle(ask(message));
    assert(reply !== null && reply.source === 'english-dictionary', `clear lookup accepted: ${message}`);
    assert(reply !== null && reply.content.includes('Open English WordNet 2025'), `source line included: ${message}`);
  }
  const bank = await provider.handle(ask('define bank'));
  assert(bank !== null && bank.content.includes('1. noun: The land alongside a river.'), 'reply shows numbered senses and part of speech');
  assert(bank !== null && bank.content.includes('2. verb: To rely on or count on something.'), 'reply includes the second sense');
  assert(bank !== null && bank.content.includes('4. noun: A fourth sense') && bank.content.includes('5. noun: A fifth sense') && !bank.content.includes('sixth sense'), 'reply shows exactly five senses');
  assert(bank !== null && bank.content.includes('Example: They sat on the bank.'), 'reply can include a short example');

  const unknown = await provider.handle(ask('define qzxvbn'));
  assert(unknown !== null && unknown.content.includes('I do not have that word'), 'unknown word is reported honestly');
  assert(unknown !== null && unknown.content.includes('Open English WordNet 2025'), 'unknown reply names its source');

  const errorFake = fakeSlot('error');
  const errorReply = await createDictionaryProvider(errorFake.slot).handle(ask('define bank'));
  assert(errorReply !== null && errorReply.content.toLowerCase().includes('error'), 'lookup failure is described as an error');
  assert(errorReply !== null && !errorReply.content.toLowerCase().includes('do not have that word'), 'lookup error is not confused with not-found');

  assert(DEFAULT_MEANINGS_SHOWN === 5, 'default display cap is five meanings');

  const mustNotTake = [
    // Existing help, text-count, and command phrases.
    'hello', 'help', 'what can you do', 'what do you do', 'what tools do you have',
    'what commands do you have', 'What can you do?', 'what tools do you have?',
    'count words', 'count words in hello brave new world', 'Count the characters of Good morning',
    'how many words are in the quick brown fox', 'how many lines in a b',
    'please count letters in abc def', 'can you count words in: one two',
    'count words: red green blue', 'word count: red green', 'character count of hi there',
    'count words in "quoted text here"', 'count words in this text: alpha beta',
    'count words in line one\nline two', 'count chars in abc',
    'how many characters are in this sentence?', 'word count', 'word count: a b',
    'count lines in x\ny', 'count the words in "a b"', 'count the terms in "a b c"',
    'count me in', 'can you count in French?', 'how many words can you write', 'what is a word',
    'count on me', 'count', 'describe axon ui', 'how many words are in this text',
    // Every teaching/list/forget style represented by the current lexicon tests.
    'remember that tally means count', 'Remember "terms" means "words".',
    'when I say tokens, I mean words', 'define tally as count',
    'learn that brb stands for be right back', 'show my meanings', 'what have I taught you',
    'what words have I taught you?', 'forget tally', 'forget everything I taught you',
    'forget it', 'forget that', 'forget all', 'forget all meanings',
    'tally means count', 'remember that tally means count\nsecond line',
    'remember to call mum', 'I mean what I say', 'when I say hello you say hi back to me',
    'what time is it', 'how are you today', 'what is 1 plus 1', 'the word means nothing here',
    '', '   ', 'define', 'forget', 'help', 'yes', 'no', 'cancel', 'okay',
    // Normal sentences that merely contain "define" are not lookup commands.
    'I define bank as an example in this sentence.',
    'The word define appears in this sentence.',
    'Can you define bank for me?',
    'We need to define the problem before solving it.',
  ];
  const callsBeforeIgnored = calls.length;
  for (const message of mustNotTake) {
    const reply = await provider.handle(ask(message));
    assert(reply === null, `not a dictionary request: ${message}`);
  }
  assert(calls.length === callsBeforeIgnored, 'ignored messages never touch the slot');

  // Brain-level proof with production ordering: local rules first, dictionary second.
  const DIR = process.env.DICT_DIR ?? './public/dictionary/en';
  let opens = 0;
  let fileReads = 0;
  const diskSlot = createDictionarySlot(async () => {
    opens += 1;
    return Dictionary.open({
      read: async (path: string) => {
        fileReads += 1;
        return readFile(join(DIR, path), 'utf8');
      },
      hash: (text) => createHash('sha256').update(text, 'utf8').digest('hex'),
    });
  });
  const localRules = createLocalRules({
    commands: [TEXT_COUNT_COMMAND],
    engine: createAxonEngine(),
    planned: PLANNED_SOURCES,
  });
  const realProvider = createDictionaryProvider(diskSlot);
  const brain = createBrain([localRules, realProvider], createFoundation());
  brain.sources();
  assert(opens === 0 && fileReads === 0, 'brain source listing does not open/read the dictionary');
  const command = await brain.ask(ask('count words in one two three'));
  assert(command.source === 'local-rules' && command.content.startsWith('That text has 3 words.'), 'existing text-count command still wins unchanged');
  assert(opens === 0 && fileReads === 0, 'ordinary commands do not read dictionary files');
  const realBank = await brain.ask(ask('define bank'));
  assert(realBank.source === 'english-dictionary' && realBank.content.includes('Open English WordNet 2025'), 'define bank reaches the real dictionary provider');
  assert(realBank.content.toLowerCase().includes('bank') && !realBank.content.includes('The knowledge data failed'), 'real bank lookup returns a meaning');
  assert(opens === 1 && fileReads > 0, 'dictionary files are first read only after a lookup message');
  const realUnknown = await brain.ask(ask('define qzxvbn'));
  assert(realUnknown.source === 'english-dictionary' && realUnknown.content.includes('I do not have that word'), 'real unknown word is reported honestly');
  console.log(`DICTIONARY PROVIDER TEST OK: ${checks} checks`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
