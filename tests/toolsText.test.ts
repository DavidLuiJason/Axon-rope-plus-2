import { findReplace, FIND_REPLACE_LIMITS, caseConvert, CASE_CONVERT_MODES, textCleaner, sortLines, textCompare, TEXT_COMPARE_LIMITS } from '../src/tools/engines/text';
let checks = 0;
function assert(condition: boolean, message: string): void {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  OK: ${message}`);
}
function main(): void {
  console.log('-- find and replace');
  const literal = findReplace('Cat cat dog', 'cat', 'dog', { replaceAll: true });
  assert(literal.ok && literal.text === 'dog dog dog' && literal.matchCount === 2, 'literal replace is case-insensitive by default');
  const whole = findReplace('cat scatter cat', 'cat', 'x', { wholeWord: true, replaceAll: true });
  assert(whole.ok && whole.text === 'x scatter x', 'whole-word mode excludes embedded matches');
  const first = findReplace('a a a', 'a', 'b');
  assert(first.ok && first.text === 'b a a' && first.matchCount === 1, 'first-only is the default');
  const regex = findReplace('a1 a2', 'a\\d', 'X', { regex: true, replaceAll: true });
  assert(regex.ok && regex.text === 'X X' && regex.positions[1].start === 3, 'regex matches and UTF-16 positions are reported');
  const zero = findReplace('ab', '(?=.)', '-', { regex: true, replaceAll: true });
  assert(zero.ok && zero.text === '-a-b' && zero.matchCount === 2, 'zero-length regex matches advance without looping');
  const invalid = findReplace('abc', '[', 'x', { regex: true });
  assert(!invalid.ok && invalid.error === 'invalid-pattern', 'invalid regex returns an error code');
  const unsafe = findReplace('a'.repeat(1000) + '!', '(a|aa)+$', 'x', { regex: true });
  assert(!unsafe.ok && unsafe.error === 'unsafe-pattern', 'common catastrophic-backtracking patterns are refused');
  const noMatch = findReplace('', 'x', 'y');
  assert(noMatch.ok && noMatch.text === '' && noMatch.matchCount === 0, 'empty input is valid');
  assert(!findReplace('x'.repeat(FIND_REPLACE_LIMITS.maxInputCharacters + 1), 'x', 'y').ok, 'oversized input is rejected');
  assert(!findReplace('x', 'a'.repeat(501), 'y').ok, 'oversized pattern is rejected');
  assert(findReplace('😀a😀', '😀', 'x', { replaceAll: true }).ok, 'emoji literal search works');

  console.log('-- case conversion');
  assert(caseConvert('hELLO WORLD', 'UPPER').ok && (caseConvert('hELLO WORLD', 'UPPER') as {ok:true;text:string}).text === 'HELLO WORLD', 'upper mode works');
  assert(caseConvert('hello WORLD', 'Title').ok && (caseConvert('hello WORLD', 'Title') as {ok:true;text:string}).text === 'Hello World', 'Title mode capitalizes words');
  assert(caseConvert('hello, WORLD!', 'Sentence').ok && (caseConvert('hello, WORLD!', 'Sentence') as {ok:true;text:string}).text === 'Hello, world!', 'Sentence mode capitalizes sentence starts');
  assert(caseConvert("don't stop 2FAST", 'snake_case').ok && (caseConvert("don't stop 2FAST", 'snake_case') as {ok:true;text:string}).text === 'don_t_stop_2_fast', 'identifier modes split apostrophes and camel boundaries while preserving numbers');
  assert(caseConvert('😀 café', 'PascalCase').ok && (caseConvert('😀 café', 'PascalCase') as {ok:true;text:string}).text === 'Café', 'Unicode letters and emoji are handled');
  assert(!caseConvert('x', 'wrong' as never).ok, 'unknown case mode is rejected');
  assert(!caseConvert('x'.repeat(200_001), 'lower').ok, 'oversized case conversion is rejected');
  assert(CASE_CONVERT_MODES.length === 9, 'all nine requested case modes are exported');

  console.log('-- text cleaner');
  const cleaned = textCleaner('  hi   there  \r\n\r\n“yes”—ok\u200B', { normalizeLineEndings: true, trimEachLine: true, collapseRepeatedSpaces: true, removeBlankLines: true, straightenQuotesAndDashes: true, removeZeroWidth: true });
  assert(cleaned.ok && cleaned.text === 'hi there\n"yes"-ok', 'independent cleaner switches compose in order');
  assert(cleaned.ok && cleaned.counts.normalizeLineEndings === 2 && cleaned.counts.removeZeroWidth === 1, 'cleaner returns per-switch counts');
  const untouched = textCleaner('  x  ');
  assert(untouched.ok && untouched.text === '  x  ', 'all cleaner switches default off');
  assert(!textCleaner('x'.repeat(200_001)).ok, 'cleaner rejects oversized input');
  assert(textCleaner('').ok, 'empty text is valid');
  assert(!textCleaner('x', null as never).ok, 'invalid options are rejected');

  console.log('-- line sorting');
  const ascending = sortLines('b\na\nA', { mode: 'ascending' });
  assert(ascending.ok && ascending.text === 'A\na\nb', 'ascending order is stable and code-point based');
  const natural = sortLines('item10\nitem2\nitem1', { mode: 'natural' });
  assert(natural.ok && natural.text === 'item1\nitem2\nitem10', 'natural sort orders embedded numbers numerically');
  const leadingZeros = sortLines('v02\nv2\nv10', { mode: 'natural' });
  assert(leadingZeros.ok && leadingZeros.text === 'v2\nv02\nv10', 'natural sort deterministically breaks numeric ties by digit width');
  const length = sortLines('bbb\na\ncc', { mode: 'by-length' });
  assert(length.ok && length.text === 'a\ncc\nbbb', 'length sort is stable');
  const reverse = sortLines('a\nb\nc', { mode: 'reverse' });
  assert(reverse.ok && reverse.text === 'c\nb\na', 'reverse mode reverses line order');
  const dedupe = sortLines('A\na\n\nb', { ignoreCase: true, removeDuplicates: true, ignoreBlankLines: true });
  assert(dedupe.ok && dedupe.text === 'A\nb', 'deduplication and blank-line filtering work');
  const shuffled = sortLines('a\nb\nc', { mode: 'shuffle' }, () => 0);
  assert(shuffled.ok && shuffled.text === 'b\nc\na', 'shuffle uses injected deterministic randomness');
  assert(!sortLines('a', { mode: 'shuffle' }).ok, 'shuffle without injected randomness fails honestly');
  assert(!sortLines('x'.repeat(200_001)).ok, 'sort rejects oversized input');
  assert(!sortLines('a', { mode: 'nonsense' as never }).ok, 'unknown sort mode is rejected');
  assert(sortLines('').ok, 'empty line input is valid');

  console.log('-- text compare');
  const lineDiff = textCompare('one\ntwo\n', 'one\nthree\n');
  assert(lineDiff.ok && lineDiff.differences.map((p) => p.type + ':' + p.text).join('|') === 'same:one\n|remove:two\n|add:three\n', 'line diff identifies same, removed and added lines');
  assert(lineDiff.ok && lineDiff.counts.same === 1 && lineDiff.counts.remove === 1 && lineDiff.counts.add === 1, 'diff counts line tokens by type');
  const wordDiff = textCompare('hello world', 'hello brave world', 'word');
  assert(wordDiff.ok && wordDiff.differences.map((p) => p.type).join(',') === 'same,add,same', 'word diff preserves whitespace and marks insertion');
  const identical = textCompare('😀 ok', '😀 ok', 'word');
  assert(identical.ok && identical.differences.length === 1 && identical.differences[0].type === 'same', 'identical Unicode text produces one same part');
  assert(textCompare('', '').ok, 'empty comparisons are valid');
  const finalBreak = textCompare('x\ny', 'x\ny\n', 'line');
  assert(finalBreak.ok && finalBreak.counts.same >= 1 && finalBreak.differences[0].text === 'x\n', 'final newline difference keeps earlier line unchanged');
  const shifted = textCompare('a\nb\nc', 'a\nc\nd', 'line');
  assert(shifted.ok && shifted.counts.same === 2 && shifted.counts.add === 1 && shifted.counts.remove === 1, 'line diff matches shared middle line without final newline');
  const endings = textCompare('a\r\nb\r\n', 'a\nb\n', 'line');
  assert(endings.ok && endings.counts.add === 0 && endings.counts.remove === 0 && endings.differences[0].text === 'a\nb\n', 'CRLF and LF compare equal and same uses revised endings');
  const blank = textCompare('', '', 'line');
  assert(blank.ok && blank.counts.same === 0 && blank.counts.add === 0 && blank.counts.remove === 0, 'empty versus empty has zero tokens');
  const oneEmpty = textCompare('', 'hello', 'line');
  assert(oneEmpty.ok && oneEmpty.counts.add === 1 && oneEmpty.counts.remove === 0, 'one empty side reports one added line');

  assert(!textCompare('x'.repeat(TEXT_COMPARE_LIMITS.maxCharacters), 'x').ok, 'comparison character cap is enforced');
  assert(!textCompare('x', 'y', 'bad' as never).ok, 'unknown compare mode is rejected');
  const tooManyLines = Array.from({ length: 5_001 }, () => 'x').join('\n');
  assert(!textCompare(tooManyLines, tooManyLines).ok, 'line cap is enforced');
  assert(!textCompare(null as never, 'x').ok, 'invalid comparison input is rejected');
  console.log(`toolsText.test.ts: ${checks} checks`);
}
main();
