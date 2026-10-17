/**
 * Flexible matcher tests (BR2): rephrasings of the Text Counter, ordinary
 * messages that must not trigger anything, "Did you mean" confirmation,
 * and a capacity test with 1,000 simulated tools.
 */
import { createAxonEngine } from '../src/kernel/axonEngine';
import { TEXT_COUNT_COMMAND } from '../src/brain/textCountCommand';
import { createLocalRules, PENDING_TTL_MS } from '../src/brain/localRules';
import { createMatcher, RUN_AT } from '../src/brain/matcher';
import { PLANNED_SOURCES } from '../src/brain/brain';
import type { CommandDef } from '../src/brain/types';

let checks = 0;
function assert(cond: boolean, msg: string) {
  checks += 1;
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const RE: Array<[string, string, string]> = [
  ['how many words does this have: the quick brown fox', 'the quick brown fox', 'words'],
  ['tell me the word total of the quick brown fox', 'the quick brown fox', 'words'],
  ['I need the character count for hello world', 'hello world', 'characters'],
  ["words in 'good morning'?", 'good morning', 'words'],
  ['my text is the quick brown fox. count the lines', 'the quick brown fox.', 'lines'],
  ['how many words are in this text: one two three', 'one two three', 'words'],
  ['what is the word count of: alpha beta', 'alpha beta', 'words'],
  ['give me the number of characters in "hello there"', 'hello there', 'characters'],
  ['could you tell me how many letters are in banana', 'banana', 'letters'],
  ['please count the lines in this: a\nb\nc', 'a\nb\nc', 'lines'],
  ['total number of words in good night moon', 'good night moon', 'words'],
  ['Hello world. How many characters?', 'Hello world.', 'characters'],
  ['"one two three four" how many words is that', 'one two three four', 'words'],
  ['calculate the character count of: abc def', 'abc def', 'characters'],
  ['I want the letter count for "hello"', 'hello', 'letters'],
  ['what is the number of words in: red green blue', 'red green blue', 'words'],
  ['tally the words in sun moon stars', 'sun moon stars', 'words'],
  ['hey, can you count how many words are in: nice day today', 'nice day today', 'words'],
  ['my text is: red green blue, tell me how many words', 'red green blue', 'words'],
  ['here is my text: hello big world. count the words', 'hello big world.', 'words'],
  ['the sentence is "a b c" and I need the word count', 'a b c', 'words'],
  ['word total for: one two', 'one two', 'words'],
  ['count the characters of hello', 'hello', 'characters'],
  ['how many chars in "abc"', 'abc', 'characters'],
  ['line count of: x\ny', 'x\ny', 'lines'],
  ['Give me a character count for: some text here', 'some text here', 'characters'],
  ['measure the words in: one two three', 'one two three', 'words'],
  ['count the words in “curly quotes here”', 'curly quotes here', 'words'],
  ['how many lines does the following text have: p\nq', 'p\nq', 'lines'],
  ['quick brown fox jumps. how many letters', 'quick brown fox jumps.', 'letters'],
  ['I need a word count: finish the job', 'finish the job', 'words'],
  ['total characters in: ab cd', 'ab cd', 'characters'],
  ['what is the total number of letters in apple', 'apple', 'letters'],
  ["how many words in 'it's fine here'", "it's fine here", 'words'],
  ['please, count the lines of: l1\nl2\nl3', 'l1\nl2\nl3', 'lines'],
  ['text: alpha beta gamma. count words', 'alpha beta gamma.', 'words'],
  ['Could you check how many words are in "to be or not to be"?', 'to be or not to be', 'words'],
  ['count the number of characters in: 12345', '12345', 'characters'],
  ['how many letters in the word: banana', 'banana', 'letters'],
  ['need the word count of sunny day outside', 'sunny day outside', 'words'],
  ['tell me the total lines in: first\nsecond', 'first\nsecond', 'lines'],
  ['give me the number of words for this: green apple', 'green apple', 'words'],
  ['it reads: go home now. word count please', 'go home now.', 'words'],
];

const NOT: string[] = [
  'hello', 'good morning AXON', 'thanks a lot', 'what time is it', 'who are you',
  'tell me a joke', 'what is the capital of France', 'I counted three apples yesterday',
  'what is the longest word in English', 'I love this app', 'how are you today',
  'write me a poem about the sea', 'remind me to call mum', 'what is photosynthesis',
  'I have 3 lines of code to write', 'the word of the day is serendipity', 'open the settings',
  'explain how a for loop works', 'how many people live in Nigeria', 'what is 12 times 8',
  'my favourite character is Naruto', 'translate good night into French', 'I need a break',
  'line up the tasks for tomorrow', 'letters from home made me smile', 'she said a few kind words',
  'is the app running in the background', 'summarize this article for me', 'what is the total cost',
  'how many minutes until noon', 'how many times did she say "words"', "what does the word 'ephemeral' mean", 'I love the word "serendipity"',
];

const MUST_NOT_RUN: string[] = [
  'how many lines does a sonnet usually have?',
  'how many words does a novel have',
  'what is the number of letters in the alphabet?',
  'how many characters does the Bible have?',
  'what is the total word count of Hamlet?',
];

const ask = (text: string) => ({ text, place: 'chat' as const });

async function main() {
  const one = createMatcher([TEXT_COUNT_COMMAND]);

  // 1. Rephrasings resolve to the right text and unit.
  for (const [message, text, unit] of RE) {
    const r = one.find(message);
    assert(r !== null && r.command.id === 'text-count', `rephrasing found: ${message}`);
    assert(r !== null && r.score >= RUN_AT, `rephrasing runs, not asks: ${message}`);
    assert(r !== null && r.input.text === text, `text extracted: ${message} -> ${JSON.stringify(r?.input.text)}`);
    assert(r !== null && r.input.unit === unit, `unit extracted: ${message}`);
  }
  assert(RE.length >= 40, 'corpus has at least 40 rephrasings');

  // 2. Ordinary messages trigger nothing, through the real rules.
  const engine = createAxonEngine();
  const clock = { t: 1_000 };
  const rules = createLocalRules({ commands: [TEXT_COUNT_COMMAND], engine, planned: PLANNED_SOURCES, now: () => clock.t });
  for (const message of NOT) {
    assert(one.find(message) === null, `matcher ignores: ${message}`);
    assert((await rules.handle(ask(message))) === null, `rules ignore: ${message}`);
  }
  assert(NOT.length >= 30, 'corpus has at least 30 ordinary messages');
  for (const message of MUST_NOT_RUN) {
    const r = one.find(message);
    assert(r === null || r.score < RUN_AT, `never runs by itself: ${message}`);
    rules.reset();
    const reply = await rules.handle(ask(message));
    assert(reply === null || !reply.content.includes('Ran as task'), `no task ran: ${message}`);
  }

  // 3. A flexible phrasing runs through the rules and says which tier read it.
  rules.reset();
  const ran = await rules.handle(ask('tell me the word total of one two three'));
  assert(ran !== null && ran.content.includes('3 words'), 'flexible phrasing runs and counts');
  assert(ran !== null && ran.content.includes('Tier 1'), 'reply names the tier');
  assert(ran !== null && ran.taskId !== undefined, 'a kernel task ran');

  // 4. Middle score: "Did you mean", then yes, then the text.
  rules.reset();
  const sug = await rules.handle(ask('how many words do I have'));
  assert(sug !== null && sug.content.startsWith('Did you mean:') && !sug.content.includes('Ran as task'), 'asks Did you mean');
  assert(rules.holdsConversation(), 'suggestion holds the conversation');
  const q = await rules.handle(ask('yes'));
  assert(q !== null && q.content.includes('What text should I count'), 'yes leads to the text question');
  const done = await rules.handle(ask('red green blue'));
  assert(done !== null && done.content.includes('3 words') && done.taskId !== undefined, 'text answer runs the task');

  // 5. "no", another message, and expiry all drop the suggestion.
  rules.reset();
  await rules.handle(ask('how many words do I have'));
  const no = await rules.handle(ask('no'));
  assert(no !== null && no.content.includes('cancelled'), 'no cancels');
  assert(!rules.holdsConversation(), 'nothing left open after no');
  await rules.handle(ask('how many words do I have'));
  assert((await rules.handle(ask('what time is it'))) === null, 'another message drops the suggestion');
  await rules.handle(ask('how many words do I have'));
  clock.t += PENDING_TTL_MS + 1;
  assert(!rules.holdsConversation(), 'suggestion expires');
  assert((await rules.handle(ask('yes'))) === null, 'yes after expiry runs nothing');

  // 6. Exact old phrasings still work first.
  rules.reset();
  const old = await rules.handle(ask('count words in hello brave new world'));
  assert(old !== null && old.content.includes('4 words') && !old.content.includes('Tier 1'), 'exact phrasing unchanged');

  // 6a. The instruction is never counted as part of the text.
  const SEP: Array<[string, string, string]> = [
    ['count the words in this text hello brave new world', 'hello brave new world', 'words'],
    ['count the words in this text\n\nhello brave new world', 'hello brave new world', 'words'],
    ['Count the words in this text:\nhello brave new world', 'hello brave new world', 'words'],
    ['count words in the following text hello brave new world', 'hello brave new world', 'words'],
    ['count the number of words in this text hello brave new world', 'hello brave new world', 'words'],
    ['count the words\nhello brave new world', 'hello brave new world', 'words'],
    ['how many characters in this paragraph abc def', 'abc def', 'characters'],
    ['count the lines\nsay "hi" to me\nthen go', 'say "hi" to me\nthen go', 'lines'],
    ['count the words in this text this is nice', 'this is nice', 'words'],
    ['hello brave new world\ncount the words', 'hello brave new world', 'words'],
  ];
  for (const [message, text, unit] of SEP) {
    const r = one.find(message);
    assert(r !== null && r.score >= RUN_AT && r.input.text === text && r.input.unit === unit, `instruction not counted: ${JSON.stringify(message)} -> ${JSON.stringify(r?.input)}`);
    const exact = TEXT_COUNT_COMMAND.match(message);
    assert(exact === null || (!exact.ask && exact.input.text === text), `exact path agrees: ${JSON.stringify(message)}`);
  }
  rules.reset();
  const sepRun = await rules.handle(ask('count the words in this text hello brave new world'));
  assert(sepRun !== null && sepRun.content.includes('4 words'), 'run counts only the text: 4 words');

  // 6b. Thresholds and best-score choice.
  const stub = (id: string, score: number): CommandDef => ({
    id, actionId: id, title: id, examples: [id], keywords: ['shared'],
    match: () => null, fill: (p) => p, describe: () => id,
    understand: () => ({ score, input: {}, summary: id }),
  });
  assert(createMatcher([stub('low', 0.3)]).find('shared') === null, 'a score below the ask level is ignored');
  assert(createMatcher([stub('mid', 0.6)]).find('shared')?.command.id === 'mid', 'a middle score is returned');
  assert(createMatcher([stub('a', 0.6), stub('b', 0.9)]).find('shared')?.command.id === 'b', 'higher score wins (order 1)');
  assert(createMatcher([stub('b', 0.9), stub('a', 0.6)]).find('shared')?.command.id === 'b', 'higher score wins (order 2)');

  // 7. Capacity: 1,000 simulated tools plus the Text Counter.
  const sims: CommandDef[] = [];
  for (let i = 0; i < 1000; i += 1) {
    const key = `simtool${i}`;
    sims.push({
      id: `sim-${i}`, actionId: `sim.${i}`, title: `Sim ${i}`, examples: [`run ${key}`],
      match: () => null,
      fill: (p) => p,
      describe: () => 'sim',
      keywords: [key, `alias${i}`],
      understand: (m) => (m.toLowerCase().includes(key + ' ') || m.toLowerCase().endsWith(key) ? { score: 1, input: { i }, summary: key } : null),
    });
  }
  const big = createMatcher([...sims, TEXT_COUNT_COMMAND]);
  assert(big.size === 1001, 'all 1,001 tools indexed');
  const started = Date.now();
  let rounds = 0;
  for (let i = 0; i < 1000; i += 1) {
    const hit = big.find(`please run simtool${i} now`);
    assert(hit !== null && hit.command.id === `sim-${i}`, `right tool wins: ${i}`);
    rounds += 1;
  }
  for (let i = 0; i < 200; i += 1) {
    const hit = big.find('how many words are in: red green blue');
    assert(hit !== null && hit.command.id === 'text-count', 'Text Counter still wins among 1,001 tools');
    assert(big.find('what time is it today') === null, 'ordinary message still ignored among 1,001 tools');
    rounds += 2;
  }
  const elapsed = Date.now() - started;
  const BUDGET_MS = 1500;
  console.log(`  capacity: ${rounds} matches over 1,001 tools in ${elapsed} ms (budget ${BUDGET_MS} ms)`);
  assert(elapsed < BUDGET_MS, `capacity budget kept: ${elapsed} ms < ${BUDGET_MS} ms`);

  console.log(`MATCHER TESTS PASSED: ${checks} checks`);
}

let timer: ReturnType<typeof setTimeout> | undefined;
const watchdog = new Promise<never>((_, reject) => {
  timer = setTimeout(() => reject(new Error('FAIL: matcher tests hung (a promise never settled)')), 20000);
});

Promise.race([main(), watchdog]).then(
  () => {
    clearTimeout(timer);
  },
  (err) => {
    clearTimeout(timer);
    console.error(err);
    throw err;
  }
);
