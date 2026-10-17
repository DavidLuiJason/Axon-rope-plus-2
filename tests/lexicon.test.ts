/**
 * Language memory tests (LM1): teaching, forgetting, applying meanings,
 * keeping taught meanings apart from the system, and the Brain using them.
 */
import { createAxonEngine } from '../src/kernel/axonEngine';
import { TEXT_COUNT_COMMAND } from '../src/brain/textCountCommand';
import { createLocalRules } from '../src/brain/localRules';
import { PLANNED_SOURCES } from '../src/brain/brain';
import { getAxonBrain, getUserLexicon } from '../src/brain';
import {
  BASE_MEANINGS,
  MAX_USER_MEANINGS,
  USER_LEXICON_KEY,
  applyMeanings,
  createUserLexicon,
  mergeMeanings,
  normalizeTerm,
  parseTeach,
  validateMeaning,
} from '../src/brain/lexicon';
import type { KeyValueStore } from '../src/brain/lexicon';

let checks = 0;
function assert(cond: boolean, msg: string) {
  checks += 1;
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function fakeStore(initial?: Record<string, string>) {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  const store: KeyValueStore & { data: Map<string, string> } = {
    data,
    getItem: (k) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
  return store;
}

const ask = (text: string) => ({ text, place: 'chat' as const });

async function main() {
  // 1. Cleaning and checking a taught word.
  assert(normalizeTerm('  "Tally"  ') === 'Tally', 'quotes and spaces removed');
  assert(normalizeTerm('\u201ctally\u201d.') === 'tally', 'curly quotes and a final full stop removed');
  assert(normalizeTerm('a   b') === 'a b', 'inner spaces collapsed');
  const good = validateMeaning('Tally', 'count');
  assert(good.ok && good.from === 'tally' && good.to === 'count', 'word is lower-cased, meaning kept as typed');
  assert(!validateMeaning('', 'count').ok, 'empty word refused');
  assert(!validateMeaning('tally', '').ok, 'empty meaning refused');
  assert(!validateMeaning('tally', 'Tally').ok, 'a word cannot mean itself');
  assert(!validateMeaning('yes', 'count').ok, 'reserved word yes refused');
  assert(!validateMeaning('cancel', 'count').ok, 'reserved word cancel refused');
  assert(!validateMeaning('a'.repeat(41), 'count').ok, 'too long word refused');
  assert(!validateMeaning('tally', 'x'.repeat(81)).ok, 'too long meaning refused');
  assert(!validateMeaning('one two three four five', 'count').ok, 'more than four words refused');
  assert(!validateMeaning('ta$ly', 'count').ok, 'symbols in the word refused');
  const joined = validateMeaning('tally', 'a\nb');
  assert(joined.ok && joined.to === 'a b', 'a meaning typed on two lines is kept on one line');
  assert(validateMeaning("what's up", 'hello').ok, 'an apostrophe is allowed');
  assert(validateMeaning('caf\u00e9', 'coffee shop').ok, 'letters outside English are allowed');

  // 2. Recognising teaching, listing and forgetting.
  const t1 = parseTeach('remember that tally means count');
  assert(t1 !== null && t1.kind === 'teach' && t1.from === 'tally' && t1.to === 'count', 'remember that X means Y');
  const t2 = parseTeach('Remember "terms" means "words".');
  assert(t2 !== null && t2.kind === 'teach' && normalizeTerm(t2.from) === 'terms' && normalizeTerm(t2.to) === 'words', 'quoted teaching');
  const t3 = parseTeach('when I say tokens, I mean words');
  assert(t3 !== null && t3.kind === 'teach' && t3.from === 'tokens' && t3.to === 'words', 'when I say X I mean Y');
  const t4 = parseTeach('define tally as count');
  assert(t4 !== null && t4.kind === 'teach' && t4.from === 'tally', 'define X as Y');
  const t5 = parseTeach('learn that brb stands for be right back');
  assert(t5 !== null && t5.kind === 'teach' && t5.from === 'brb' && t5.to === 'be right back', 'stands for');
  assert(parseTeach('what have I taught you')?.kind === 'list', 'list: what have I taught you');
  assert(parseTeach('what words have I taught you?')?.kind === 'list', 'list: what words have I taught you');
  assert(parseTeach('show my meanings')?.kind === 'list', 'list: show my meanings');
  assert(parseTeach('forget tally')?.kind === 'forget', 'forget one');
  assert(parseTeach('forget everything I taught you')?.kind === 'forget-all', 'forget all');
  assert(parseTeach('forget all')?.kind === 'forget-all', 'forget all, short');
  const NOT_TEACHING = [
    'forget it', 'forget that', 'hello', 'what time is it', 'count the words in "a b"', 'tally means count',
    'remember to call mum', 'I mean what I say', 'what does tally mean', 'how are you today',
    'what is 1 plus 1', 'the word means nothing here', 'when I say hello you say hi back to me',
    'remember that tally means count\nsecond line', '', '   ', 'define', 'forget', 'help', 'yes', 'no',
  ];
  for (const m of NOT_TEACHING) assert(parseTeach(m) === null, `not teaching: ${JSON.stringify(m)}`);

  // 3. Applying meanings.
  const base: typeof BASE_MEANINGS = [
    { from: 'tokens', to: 'words' },
    { from: 'work out', to: 'count' },
  ];
  assert(applyMeanings('how many tokens', base).text === 'how many words', 'whole word replaced');
  assert(applyMeanings('How many TOKENS', base).text === 'How many words', 'case ignored');
  assert(applyMeanings('mytokens and tokensx', base).text === 'mytokens and tokensx', 'only whole words change');
  assert(applyMeanings('work   out the tokens', base).text === 'count the words', 'a phrase matches across extra spaces');
  assert(applyMeanings('count tokens in "tokens tokens"', base).text === 'count words in "tokens tokens"', 'double quotes are protected');
  assert(applyMeanings('count tokens in \u201ctokens\u201d now tokens', base).text === 'count words in \u201ctokens\u201d now words', 'curly quotes are protected');
  assert(applyMeanings('nothing to change', base).used.length === 0, 'unused meanings are not reported');
  assert(applyMeanings('tokens tokens', base).used.length === 1, 'a meaning is reported once');
  const chain = applyMeanings('a b', [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }]);
  assert(chain.text === 'b c', 'applied once: no chains');
  const longest = applyMeanings('work out now', [{ from: 'work', to: 'job' }, { from: 'work out', to: 'count' }]);
  assert(longest.text === 'count now', 'the longest phrase wins');
  assert(applyMeanings('anything', []).text === 'anything', 'no meanings, no change');
  assert(applyMeanings('caf\u00e9 time', [{ from: 'caf\u00e9', to: 'coffee' }]).text === 'coffee time', 'non-English letters match as whole words');
  assert(applyMeanings('x (y) z', [{ from: 'y', to: 'q' }]).text === 'x (q) z', 'punctuation around a word is kept');
  const merged = mergeMeanings(base, [{ from: 'tokens', to: 'letters' }, { from: 'extra', to: 'more' }]);
  assert(merged.find((m) => m.from === 'tokens')?.to === 'letters', 'a taught meaning replaces the built-in one');
  assert(merged.length === 3, 'merge keeps every distinct word once');

  // 4. The owner's data: store, restore, export, separation.
  const store = fakeStore();
  const mine = createUserLexicon(store, () => 5);
  assert(mine.taught().length === 0, 'starts with nothing taught');
  assert(mine.meanings().length === BASE_MEANINGS.length, 'built-in meanings are there from the start');
  const saved = mine.teach('Tally', 'count');
  assert(saved.ok && saved.replaced === null, 'teaching works');
  assert(mine.taught()[0].from === 'tally' && mine.taught()[0].taughtAt === 5, 'taught meaning recorded with its time');
  assert(store.data.has(USER_LEXICON_KEY), 'written to the phone storage under its own key');
  const again = mine.teach('tally', 'count up');
  assert(again.ok && again.replaced === 'count' && mine.taught().length === 1, 'teaching the same word updates it');
  const restored = createUserLexicon(store);
  assert(restored.taught().length === 1 && restored.taught()[0].to === 'count up', 'a new session reads it back');
  const stranger = createUserLexicon(fakeStore());
  assert(stranger.taught().length === 0, 'a copy of the app on another phone starts with none of my meanings');
  assert(stranger.meanings().length === BASE_MEANINGS.length, 'but it still has the system meanings');
  assert(JSON.stringify(BASE_MEANINGS).includes('tally') === false, 'my meanings are not inside the shipped system data');
  assert(mine.isBuiltIn('tokens') && !mine.isBuiltIn('tally'), 'built-in and taught are told apart');
  assert(mine.forget('tally') && mine.taught().length === 0, 'forget removes it');
  assert(!mine.forget('tally'), 'forgetting twice says nothing was there');
  assert(!mine.forget('tokens'), 'a built-in meaning cannot be forgotten');
  mine.teach('aaa', 'count');
  mine.teach('bbb', 'words');
  const exported = mine.exportJson();
  assert(mine.forgetAll() === 2 && mine.taught().length === 0, 'forget all');
  const back = createUserLexicon(fakeStore());
  const imp = back.importJson(exported);
  assert(imp.ok && imp.added === 2 && back.taught().length === 2, 'export then import restores');
  assert(!back.importJson('not json').ok, 'junk is not imported');
  assert(!back.importJson('{"entries":"no"}').ok, 'wrong shape is not imported');
  assert(back.importJson('{"entries":[{"from":"yes","to":"count"},{"from":"ok1","to":"words"}]}').added === 1, 'import skips invalid entries');

  // 5. Damaged stored data is kept aside, never silently destroyed.
  const damaged = fakeStore({ [USER_LEXICON_KEY]: '{broken' });
  const fresh = createUserLexicon(damaged);
  assert(fresh.taught().length === 0, 'damaged data reads as empty');
  assert(damaged.data.get(USER_LEXICON_KEY) === '{broken', 'reading does not overwrite it');
  fresh.teach('tally', 'count');
  assert(damaged.data.get(`${USER_LEXICON_KEY}.unreadable`) === '{broken', 'the damaged text is copied aside before a write');
  assert(createUserLexicon(damaged).taught().length === 1, 'then the new data is readable');

  const dup = fakeStore({
    [USER_LEXICON_KEY]: JSON.stringify({ entries: [{ from: 'Tally', to: 'count', taughtAt: 1 }, { from: 'tally', to: 'words', taughtAt: 2 }, { from: 'ok2', to: 'lines' }] }),
  });
  const duplicated = createUserLexicon(dup);
  assert(duplicated.taught().length === 2 && duplicated.taught()[0].to === 'count', 'duplicate words in stored data load once (first wins)');

  // 6. Storage that fails never breaks the lexicon.
  const hostile: KeyValueStore = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('full');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };
  const survivor = createUserLexicon(hostile);
  assert(survivor.teach('tally', 'count').ok, 'teaching works even when storage fails');
  assert(survivor.taught().length === 1, 'and is kept for this session');
  const memoryOnly = createUserLexicon(null);
  assert(memoryOnly.teach('tally', 'count').ok && memoryOnly.taught().length === 1, 'no storage: memory only');

  // 7. A limit on how many may be taught.
  const capped = createUserLexicon(null);
  for (let i = 0; i < MAX_USER_MEANINGS; i += 1) assert(capped.teach(`word${i}`, 'count').ok, `teach ${i}`);
  assert(!capped.teach('one more', 'count').ok, 'the limit is enforced');
  assert(capped.teach('word0', 'words').ok, 'but an existing word can still be updated');

  // 8. The Brain: teach, use, list, forget; and a meaning never changes counted text.
  const lex = createUserLexicon(fakeStore());
  const engine = createAxonEngine();
  const clock = { t: 1_000 };
  const rules = createLocalRules({ commands: [TEXT_COUNT_COMMAND], engine, planned: PLANNED_SOURCES, now: () => clock.t, lexicon: lex });

  const before = await rules.handle(ask('count the terms in "a b c"'));
  assert(before === null, 'before teaching, terms is not understood and is passed on');
  const taught = await rules.handle(ask('remember that terms means words'));
  assert(taught !== null && taught.content.startsWith('Saved.') && taught.taskId === undefined, 'teaching is answered and runs no task');
  assert(taught !== null && taught.source === 'local-rules', 'the reply names its source');
  const used = await rules.handle(ask('count the terms in "a b c"'));
  assert(used !== null && used.content.includes('3 words'), 'a taught meaning is used');
  assert(used !== null && used.content.includes('Meaning used: "terms" = "words".'), 'the reply says which meaning was used');
  assert(used !== null && used.taskId !== undefined, 'a real kernel task ran');
  const builtin = await rules.handle(ask('how many tokens are in "x y"'));
  assert(builtin !== null && builtin.content.includes('2 words') && builtin.content.includes('"tokens" = "words"'), 'a built-in meaning is used and named');
  const plainStill = await rules.handle(ask('count the words in "a b c d"'));
  assert(plainStill !== null && plainStill.content.includes('4 words') && !plainStill.content.includes('Meaning used'), 'plain messages are read as before, with no meaning note');

  await rules.handle(ask('remember that fox means dog'));
  const safe = await rules.handle(ask('count the words in the quick fox'));
  assert(safe !== null && safe.content.includes('3 words'), 'a taught word inside the text is counted as typed');
  const guarded = await rules.handle(ask('enumerate the tokens in the quick fox'));
  assert(guarded === null, 'when a meaning would change the counted text, AXON passes it on instead of counting a changed text');
  const quotedFox = await rules.handle(ask('enumerate the tokens in "fox fox"'));
  assert(quotedFox !== null && quotedFox.content.includes('2 words'), 'quoted text is never changed');

  const list = await rules.handle(ask('what have I taught you'));
  assert(list !== null && list.content.includes('"terms" means "words"') && list.content.includes('"fox" means "dog"'), 'list shows what was taught');
  assert(list !== null && !list.content.includes('tokens'), 'list shows only the owner\'s own data');
  const gone = await rules.handle(ask('forget fox'));
  assert(gone !== null && gone.content.startsWith('Done.'), 'forget answered');
  const builtinForget = await rules.handle(ask('forget tokens'));
  assert(builtinForget !== null && builtinForget.content.includes('built-in'), 'a built-in meaning is explained, not removed');
  const nothing = await rules.handle(ask('forget banana'));
  assert(nothing !== null && nothing.content.includes('nothing to forget'), 'forgetting something never taught says so');
  const refused = await rules.handle(ask('remember that yes means count'));
  assert(refused !== null && refused.content.startsWith('I did not save that.'), 'a refused lesson is explained');
  const noneTaught = createLocalRules({ commands: [TEXT_COUNT_COMMAND], engine, planned: PLANNED_SOURCES, lexicon: createUserLexicon(null) });
  const empty = await noneTaught.handle(ask('what have I taught you'));
  assert(empty !== null && empty.content.includes('not taught me anything'), 'an empty list is said honestly');
  const wipe = await rules.handle(ask('forget everything I taught you'));
  assert(wipe !== null && wipe.content.includes('forgot all'), 'forget all answered');
  assert(lex.taught().length === 0, 'and the data is gone');

  // 9. Teaching never hijacks an answer to a follow-up question.
  rules.reset();
  const q = await rules.handle(ask('count the words'));
  assert(q !== null && q.content.includes('What text should I count'), 'follow-up question asked');
  const swallowed = await rules.handle(ask('remember that a means b'));
  assert(swallowed !== null && swallowed.content.includes('5 words') && lex.taught().length === 0, 'an answer to a question is text, even if it looks like teaching');

  // 10. A "Did you mean" can come from a taught meaning too.
  await rules.handle(ask('remember that talley means count'));
  const dym = await rules.handle(ask('talley the words'));
  assert(dym !== null && dym.content.startsWith('Did you mean:') && !dym.content.includes('Ran as task'), 'a taught meaning can lead to "Did you mean"');
  assert((await rules.handle(ask('no')))?.content.includes('cancelled') === true, 'and no cancels it');

  // 10b. When the taught reading is surer than the plain one, it wins.
  const plainOnly = createLocalRules({ commands: [TEXT_COUNT_COMMAND], engine, planned: PLANNED_SOURCES, lexicon: createUserLexicon(null) });
  const unsure = await plainOnly.handle(ask('how many words do I have'));
  assert(unsure !== null && unsure.content.startsWith('Did you mean:'), 'plain reading alone is only a guess');
  plainOnly.reset();
  await plainOnly.handle(ask('remember that do i have means are in this'));
  const surer = await plainOnly.handle(ask('how many words do I have'));
  assert(surer !== null && surer.content.includes('What text should I count'), 'the surer taught reading wins and asks for the text');

  // 10c. The real Brain is wired to the lexicon (no phone storage here, so memory only).
  const brain = getAxonBrain();
  const wired = await brain.ask(ask('remember that zzz means count'));
  assert(wired.source === 'local-rules' && wired.content.startsWith('Saved.'), 'the app Brain accepts teaching');
  assert(getUserLexicon().taught().some((m) => m.from === 'zzz'), 'and keeps it in the user lexicon');
  const wiredUse = await brain.ask(ask('zzz the words in "a b c"'));
  assert(wiredUse.content.includes('3 words'), 'and uses it');

  // 11. Help mentions teaching only when teaching exists; no lexicon, no change.
  const help = await rules.handle(ask('help'));
  assert(help !== null && help.content.includes('remember that tally means count'), 'help explains how to teach');
  const bare = createLocalRules({ commands: [TEXT_COUNT_COMMAND], engine, planned: PLANNED_SOURCES });
  const bareHelp = await bare.handle(ask('help'));
  assert(bareHelp !== null && !bareHelp.content.includes('teach'), 'without a lexicon help is unchanged');
  assert((await bare.handle(ask('remember that tally means count'))) === null, 'without a lexicon teaching is not handled');
  assert((await bare.handle(ask('count the terms in "a b"'))) === null, 'without a lexicon messages are read exactly as written');

  console.log(`LEXICON TESTS PASSED: ${checks} checks`);
}

let timer: ReturnType<typeof setTimeout> | undefined;
const watchdog = new Promise<never>((_, reject) => {
  timer = setTimeout(() => reject(new Error('FAIL: lexicon tests hung (a promise never settled)')), 20000);
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
