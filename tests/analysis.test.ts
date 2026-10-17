import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import type { KnowledgeSlot } from '../src/brain/knowledge/slot';
import { createAnalyzer } from '../src/brain/mind/analysis/analyze';
import type { Segment, MindContext } from '../src/brain/mind/types';
import { createStages } from '../src/brain/mind/stages';
import { createLegacyExecutor } from '../src/brain/mind/legacy';
import type { BrainProvider, BrainReply, BrainRequest, SourceStatus } from '../src/brain/types';

let checks = 0;
function assert(condition: boolean, message: string): void { checks += 1; if (!condition) throw new Error(`FAIL: ${message}`); }
const DIR = process.env.DICT_DIR ?? './public/dictionary/en';
const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

async function realSlot(): Promise<KnowledgeSlot> {
  return createDictionarySlot(async () => Dictionary.open({
    read: async (path: string) => readFile(join(DIR, path), 'utf8'),
    hash: sha,
  }));
}

async function main(): Promise<void> {
  const slot = await realSlot();
  const fixture = JSON.parse(await readFile('./tests/fixtures/analysis100.json', 'utf8')) as { sentences: string[] };
  assert(fixture.sentences.length === 100, 'fixture contains 100 sentences');
  assert(new Set(fixture.sentences).size === 100, 'fixture sentences are distinct');
  const analyze = createAnalyzer(slot, { maxLookups: 64, maxPhraseWords: 5 });
  let totalTokens = 0;
  let maxLookupsSeen = 0;
  let knownWords = 0;
  let unknownWords = 0;
  let notCheckedWords = 0;
  let exhaustedSentences = 0;
  let ordinaryWords = 0;
  let ordinaryNotChecked = 0;
  const start = performance.now();
  for (let i = 0; i < fixture.sentences.length; i += 1) {
    const text = fixture.sentences[i] ?? '';
    const segments: Segment[] = [{ kind: 'language', text, start: 0, end: text.length }];
    const result = await analyze(segments);
    assert(result.ok, `real dictionary analysis succeeds for fixture ${i + 1}`);
    if (!result.ok) continue;
    totalTokens += result.tokens.length;
    knownWords += result.tokens.filter((token) => token.knowledge === 'known').length;
    unknownWords += result.tokens.filter((token) => token.knowledge === 'unknown').length;
    notCheckedWords += result.tokens.filter((token) => token.knowledge === 'not-checked').length;
    if (result.metrics.budgetExhausted) exhaustedSentences += 1;
    if (text.split(/\s+/u).filter(Boolean).length <= 20) { ordinaryWords += result.tokens.length; ordinaryNotChecked += result.tokens.filter((token) => token.knowledge === 'not-checked').length; }
    maxLookupsSeen = Math.max(maxLookupsSeen, result.metrics.lookupCalls);
    assert(result.metrics.lookupCalls <= result.metrics.budget, `fixture ${i + 1} respects distinct-key budget`);
    assert(result.tokens.every((token) => token.start >= 0 && token.end > token.start && text.slice(token.start, token.end) === token.surface), `fixture ${i + 1} preserves token offsets`);
  }
  const elapsed = performance.now() - start;
  assert(totalTokens > 300, 'real corpus produced substantial token coverage');
  assert(maxLookupsSeen <= 64, 'maximum distinct-key budget is bounded');
  assert(ordinaryWords === 0 || ordinaryNotChecked / ordinaryWords <= 0.05, 'not-checked share is at most 5% for fixture sentences of up to 20 words');
  console.log(`ANALYSIS100: 100 sentences; known ${knownWords}, unknown ${unknownWords}, not-checked ${notCheckedWords}; exhausted ${exhaustedSentences}; ${elapsed.toFixed(2)} ms total, ${(elapsed / 100).toFixed(3)} ms/message on this machine; max ${maxLookupsSeen} distinct-key budget units/message`);

  const lemma = await analyze([{ kind: 'language', text: 'running mice went unknownwordzxq', start: 0, end: 33 }]);
  assert(lemma.ok, 'lemma sample analysis succeeds');
  if (lemma.ok) {
    assert(lemma.tokens[0]?.lemma.toLowerCase() === 'running', 'running preserves its real dictionary headword as primary lemma');
    assert(Boolean(lemma.tokens[0]?.alternativeLemmas?.some((value) => value.toLowerCase() === 'run')), 'running records the dictionary-backed verb lemma run as an alternative');
    assert(lemma.tokens.some((token) => token.surface === 'unknownwordzxq' && token.knowledge === 'unknown'), 'unknown word is explicit and never guessed');
  }

  const quoteText = 'Read "running mice" then `git status` 🧠';
  const segments: Segment[] = [
    { kind: 'language', text: 'Read ', start: 0, end: 5 },
    { kind: 'material', text: '"running mice"', start: 5, end: 19 },
    { kind: 'language', text: ' then ', start: 19, end: 25 },
    { kind: 'material', text: '`git status`', start: 25, end: 37 },
    { kind: 'language', text: ' 🧠', start: 37, end: quoteText.length },
  ];
  const protectedResult = await analyze(segments);
  assert(protectedResult.ok, 'material protection sample succeeds');
  if (protectedResult.ok) {
    assert(!protectedResult.tokens.some((token) => token.surface === 'running' || token.surface === 'mice' || token.surface === 'git' || token.surface === 'status'), 'material words are not tokenized or interpreted');
    assert(segments.filter((segment) => segment.kind === 'material').map((segment) => segment.text).join('|') === '"running mice"|`git status`', 'material segment text remains unchanged');
  }

  const budgeted = createAnalyzer(slot, { maxLookups: 2, maxPhraseWords: 5 });
  const budgetText = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet';
  const budgetResult = await budgeted([{ kind: 'language', text: budgetText, start: 0, end: budgetText.length }]);
  assert(budgetResult.ok, 'budget-limited analysis returns a typed result');
  if (budgetResult.ok) {
    assert(budgetResult.metrics.lookupCalls <= 2, 'hard budget prevents excess slot lookups');
    assert(budgetResult.metrics.budgetExhausted, 'budget exhaustion is recorded');
    assert(budgetResult.tokens.some((token) => token.knowledge === 'not-checked'), 'unprocessed words are marked not-checked rather than unknown');
  }

  const longText = Array.from({ length: 180 }, (_, index) => `word${index}long`).join(' ');
  const veryLong = await budgeted([{ kind: 'language', text: longText, start: 0, end: longText.length }]);
  assert(veryLong.ok, 'very long message returns cleanly');
  if (veryLong.ok) {
    assert(veryLong.metrics.budgetUnits === 2, 'very long message stops at the distinct-key budget');
    assert(veryLong.tokens.slice(2).every((token) => token.knowledge === 'not-checked'), 'words after the direct-lookup budget are marked not-checked');
  }

  const countingSlot = await realSlot();
  let calls = 0;
  const counted: KnowledgeSlot = {
    status: () => countingSlot.status(),
    credits: () => countingSlot.credits(),
    lookup: async (word) => { calls += 1; return countingSlot.lookup(word); },
  };
  const cached = createAnalyzer(counted, { maxLookups: 24 });
  const repeated = await cached([{ kind: 'language', text: 'bank bank bank bank bank bank', start: 0, end: 29 }]);
  assert(repeated.ok, 'repeated word cache sample succeeds');
  if (repeated.ok) {
    assert(repeated.metrics.cacheHits > 0, 'message cache records cache hits');
    assert(calls === repeated.metrics.lookupCalls, 'cache hits do not call the slot again');
  }

  const deterministicA = await analyze([{ kind: 'language', text: 'running mice', start: 0, end: 12 }]);
  const deterministicB = await analyze([{ kind: 'language', text: 'running mice', start: 0, end: 12 }]);
  assert(JSON.stringify(deterministicA) === JSON.stringify(deterministicB), 'same input yields identical analysis output');
  const empty = await analyze([{ kind: 'language', text: '', start: 0, end: 0 }]);
  assert(empty.ok && empty.tokens.length === 0, 'empty input returns no tokens');
  const invalid = await analyze([{ kind: 'language', text: 'bad', start: -1, end: 2 }]);
  assert(!invalid.ok && invalid.error === 'invalid-input', 'invalid offsets return a typed error');
  const emoji = await analyze([{ kind: 'language', text: 'hi 🧠 👩‍💻 there', start: 0, end: 14 }]);
  assert(emoji.ok && emoji.tokens.some((token) => token.surface === 'hi') && emoji.tokens.some((token) => token.surface === 'there'), 'Unicode and emoji do not crash tokenization');

  const fixedProvider: BrainProvider = {
    id: 'analysis-proof', label: 'analysis proof', status: (): SourceStatus => ({ id: 'analysis-proof', label: 'analysis proof', ready: true, note: '' }),
    holdsConversation: () => false,
    handle: async (request: BrainRequest): Promise<BrainReply> => ({ source: 'analysis-proof', content: `unchanged:${request.text}` }),
  };
  const fallback: BrainProvider = { ...fixedProvider, id: 'analysis-fallback', label: 'analysis fallback', status: (): SourceStatus => ({ id: 'analysis-fallback', label: 'analysis fallback', ready: true, note: '' }), handle: async (): Promise<BrainReply> => ({ source: 'analysis-fallback', content: 'fallback' }) };
  const executor = createLegacyExecutor([fixedProvider], fallback);
  const request: BrainRequest = { text: 'running mice', place: 'chat' };
  const baselineReply = await executor.run(request);
  const stages = createStages(executor, () => 1, () => 'analysis-proof-id');
  let context: MindContext = { utterance: { id: 'analysis-proof-id', text: request.text, place: request.place, at: 1 }, entries: [] };
  context = await stages[1]!.run(context);
  context = await stages[2]!.run(context);
  context = await stages[7]!.run(context);
  assert(JSON.stringify(context.reply) === JSON.stringify(baselineReply), 'analysis adds context without changing the legacy reply');

  console.log(`ANALYSIS TEST OK: ${checks} checks`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
