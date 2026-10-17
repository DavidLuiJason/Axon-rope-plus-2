// Director's acceptance test for N6 / SYM1. Owner-approved, written BEFORE the code. Do not edit.
// Run from the project root: tsx tests/symbols.test.ts
import { readFileSync } from 'node:fs';
import { detectCodeRegions } from '../src/brain/symbols/codeRegions';
import { readPunctuation } from '../src/brain/symbols/readPunctuation';
import { maskCodeRegions } from '../src/brain/symbols/protect';
import { understandTextCount } from '../src/brain/textCountIntent';
import { TEXT_COUNT_COMMAND } from '../src/brain/textCountCommand';
import { countText } from '../src/kernel/textCount';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const set = read('tests/fixtures/sym1-written-set.json');
const base = read('tests/fixtures/sym1-baseline.json').results as Record<string, any>;
const UNSURE_SENTENCE = '(I could not tell whether part of the text is code, so I counted all of it as ordinary text.)';
const UNSURE_NOTE = '\n\nNote: I could not tell whether part of the text is code, so I counted all of it as ordinary text.';
const codeNote = (n: number) => `\n\nNote: I found ${n} code ${n === 1 ? 'part' : 'parts'} and counted ${n === 1 ? 'it' : 'them'} exactly as written. I changed nothing.`;
const fails: string[] = [];
let checks = 0;
const ok = (c: boolean, label: string) => { checks++; if (!c) fails.push(label); };
const show = (v: unknown) => String(JSON.stringify(v)).slice(0, 120);
const rt = (v: unknown) => JSON.parse(JSON.stringify(v ?? null));

for (const s of set.codeSamples) {
  const r = detectCodeRegions(s.text);
  ok(JSON.stringify(r.regions.map((x) => x.text)) === JSON.stringify(s.regions) && r.unsure === false, `(a) regions ${s.id}: got ${show(r.regions.map((x) => x.text))} unsure ${r.unsure}`);
  ok(r.regions.every((x, i) => s.text.slice(x.start, x.end) === x.text && (i === 0 || r.regions[i - 1].end <= x.start)), `(a) offsets ${s.id}`);
  const m = maskCodeRegions(s.text);
  ok(m.restore(m.masked) === s.text, `(f) restore ${s.id}`);
  ok(s.regions.every((x: string) => !m.masked.includes(x)), `(f) masked ${s.id}`);
  if (s.regions.length === 1 && s.regions[0] === s.text) ok(/^[\uE000-\uE0FF]+$/.test(m.masked), `(f) placeholder is private-use only ${s.id}`);
  if (s.passThrough) {
    const u: any = understandTextCount('Count the words in this: ' + s.text);
    ok(!!u && u.input.text === s.text, `(d) understand ${s.id}: got ${show(u && u.input && u.input.text)}`);
    const mt: any = TEXT_COUNT_COMMAND.match('Count the words in: ' + s.text);
    ok(!!mt && mt.input.text === s.text, `(d) match ${s.id}: got ${show(mt && mt.input && mt.input.text)}`);
    const u2: any = understandTextCount(s.text + '\nCount the words.');
    ok(!!u2 && u2.input.text === s.text, `(d) trailing ${s.id}: got ${show(u2 && u2.input && u2.input.text)}`);
  }
}
for (const s of set.ordinarySamples) {
  const r = detectCodeRegions(s.text);
  ok(r.regions.length === 0 && r.unsure === s.unsure, `(b) ordinary ${s.id}: regions ${r.regions.length} unsure ${r.unsure}`);
}
for (const s of set.punctuationSamples) {
  const marks = readPunctuation(s.text).marks;
  ok(JSON.stringify(marks.map((x) => [x.text, x.role])) === JSON.stringify(s.marks), `(c) punctuation ${s.id}: got ${show(marks.map((x) => [x.text, x.role]))}`);
  ok(marks.every((x) => s.text.slice(x.start, x.end) === x.text && x.confidence >= 0 && x.confidence <= 1), `(c) offsets ${s.id}`);
}
// (e) the baseline recorded from the ORIGINAL code
const unsureTexts = set.ordinarySamples.filter((s: any) => s.unsure).map((s: any) => s.text);
for (const [msg, old] of Object.entries(base)) {
  const u = understandTextCount(msg);
  const mt: any = TEXT_COUNT_COMMAND.match(msg);
  const text = mt && mt.input && mt.input.text;
  const d = typeof text === 'string' ? TEXT_COUNT_COMMAND.describe(countText(text), mt.input) : null;
  const exp = rt(old);
  if (unsureTexts.some((t: string) => msg.includes(t))) {
    if (exp.u) exp.u.summary += ' ' + UNSURE_SENTENCE;
    if (exp.d !== null) exp.d += UNSURE_NOTE;
  }
  ok(JSON.stringify(rt(u)) === JSON.stringify(exp.u), `(e) understand unchanged: ${show(msg.slice(0, 50))}`);
  ok(JSON.stringify(rt(mt)) === JSON.stringify(exp.mt), `(e) match unchanged: ${show(msg.slice(0, 50))}`);
  ok(JSON.stringify(d) === JSON.stringify(exp.d), `(e) describe unchanged: ${show(msg.slice(0, 50))}`);
}
// (d2) the visible note
for (const id of ['C04', 'C12']) {
  const s = set.codeSamples.find((x: any) => x.id === id);
  const mt: any = TEXT_COUNT_COMMAND.match('Count the words in: ' + s.text);
  const d = mt ? TEXT_COUNT_COMMAND.describe(countText(mt.input.text), mt.input) : '';
  ok(d.endsWith(codeNote(s.regions.length)), `(d2) code note ${id}: tail ${show(d.slice(-110))}`);
}
// (g) robustness
const t0 = Date.now();
for (const x of ['', '`', '```\nabc', '('.repeat(20000), 'plain words '.repeat(83000)]) {
  try { detectCodeRegions(x); readPunctuation(x); const m = maskCodeRegions(x); m.restore(m.masked); ok(true, ''); } catch (e) { ok(false, `(g) threw on ${show(x.slice(0, 10))}`); }
}
ok(Date.now() - t0 < 4000, `(g) speed ${Date.now() - t0} ms`);
if (fails.length) { console.log(`SYMBOLS TEST FAILED: ${fails.length} of ${checks} checks`); fails.forEach((f) => console.log(' - ' + f)); process.exit(1); }
console.log(`SYMBOLS TEST OK: ${checks} checks`);
