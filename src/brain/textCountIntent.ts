/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Text Counter, flexible reading (Tier 1: offline, no model, no network).
 * Reads rephrasings and whole sentences: other word order, filler words, and
 * text that is quoted, placed after a colon, or placed before the instruction.
 */

import type { Understanding } from './types';
import { protectCodeRegions, restoreProtectedText } from './symbols/protect';

type Unit = 'words' | 'characters' | 'letters' | 'lines';

export const TEXT_QUESTION =
  'What text should I count? Paste or type it and send it. (Say "cancel" to stop.)';

export const TEXT_KEYWORDS = [
  'word', 'words', 'character', 'characters', 'char', 'chars', 'letter', 'letters', 'line', 'lines',
];

const UNIT = /\b(words?|characters?|chars?|letters?|lines?)\b/i;
const CUE = /\b(?:count|tally|how many|number of|total|calculate|measure)\b/i;
const QUOTED = /"([^"]+)"|\u201c([^\u201d]+)\u201d|(?:^|[\s(])'([^']+)'(?=$|[\s.,;:!?)])|\u2018([^\u2019]+)\u2019/;
const TEXT_IS = /\b(?:my|the|this)?\s*(?:text|sentence|paragraph|message|passage|note)\s+(?:is|reads|says)\s*:?\s*/i;
const TRAIL =
  /(?:([.!?;,\n])\s*|\s+(?:and|then|now)\s+)((?:please\s+)?(?:(?:can|could)\s+you\s+)?(?:(?:count|tally|calculate|measure|tell\s+me|give\s+me|show\s+me|how\s+many)|(?:words?|characters?|chars?|letters?|lines?)\s+(?:count|total))\b[^.!?\n]*)\s*[.!?]*\s*$/i;
const BARE_TRAIL = /\s+((?:please\s+)?(?:count|tally)\s+(?:the\s+)?(?:words?|characters?|chars?|letters?|lines?))\s*[.!?]*$/i;
const AFTER =
  /^\s*(?:(?:are|is|do|does|there|total|count|counts|number|tally|amount|altogether)\s+)*(?:in|of|for|from|inside|within)\b\s*([\s\S]*)$/i;
const HAVE = /^\s*(?:do|does)\s+(.+?)\s+(?:have|contain|include|hold)\s*[?.!]*\s*$/i;
const LABEL =
  /^(?:(?:here(?:'s| is)|my|the|this|it|following)\s+)*(?:text|sentence|paragraph|message|passage|note|following)?(?:\s*(?:is|reads|says))?\s*[:\-]\s*/i;
const LEAD =
  /^(?:here(?:'s| is)\s+)?(?:(?:this|that|my|the following|following)\s+(?:text|sentence|paragraph|message|passage|note)|(?:the\s+)?following|below)(?:\s+(?:is|reads|says))?\s*[:\-]?\s*/i;
const DEICTIC = new Set([
  'this', 'that', 'it', 'this text', 'that text', 'the text', 'my text', 'this sentence', 'this message',
  'this paragraph', 'my message', 'my sentence', 'my paragraph', 'the above', 'above', 'the following',
  'following', 'the following text', 'this one', 'that one',
]);

interface Located {
  kind: 'quoted' | 'colon' | 'is' | 'after' | 'trailing' | 'none';
  instruction: string;
  payload?: string;
  deictic?: boolean;
}

function isDeictic(s: string): boolean {
  return DEICTIC.has(s.trim().toLowerCase().replace(/[?.!]+$/, '').replace(/\s+/g, ' '));
}

function splitTrailing(s: string): { payload: string; clause: string } | null {
  const m = TRAIL.exec(s);
  if (m && UNIT.test(m[2])) {
    const keep = m[1] && '.!?'.includes(m[1]) ? m[1] : '';
    return { payload: s.slice(0, m.index) + keep, clause: m[2] };
  }
  const b = BARE_TRAIL.exec(s);
  if (b) return { payload: s.slice(0, b.index), clause: b[1] };
  return null;
}

/** True when a line is only an instruction (a cue and a unit, with no text of its own after them). */
function isInstructionLine(line: string): boolean {
  if (!UNIT.test(line) || !CUE.test(line)) return false;
  if (/:\s*\S/.test(line)) return false;
  for (const m of line.matchAll(new RegExp(UNIT.source, 'gi'))) {
    const a = AFTER.exec(line.slice((m.index ?? 0) + m[0].length));
    if (a && a[1].trim() !== '' && !isDeictic(a[1])) return false;
  }
  return true;
}

function locate(message: string): Located {
  const s = message.trim();

  // An instruction on its own first line: everything below it is the text.
  const nl = s.indexOf('\n');
  if (nl > 0 && s.slice(nl + 1).trim() !== '' && isInstructionLine(s.slice(0, nl))) {
    return { kind: 'colon', instruction: s.slice(0, nl), payload: s.slice(nl + 1) };
  }

  const q = QUOTED.exec(s);
  if (q) {
    const text = q[1] ?? q[2] ?? q[3] ?? q[4] ?? '';
    return { kind: 'quoted', instruction: `${s.slice(0, q.index)} ${s.slice(q.index + q[0].length)}`, payload: text };
  }

  const colon = s.indexOf(':');
  if (colon > 0) {
    const before = s.slice(0, colon);
    if (UNIT.test(before) && CUE.test(before)) {
      return { kind: 'colon', instruction: before, payload: s.slice(colon + 1) };
    }
  }

  const t = TEXT_IS.exec(s);
  if (t) {
    const rest = s.slice(t.index + t[0].length);
    const tr = splitTrailing(rest);
    if (tr) return { kind: 'is', instruction: `${s.slice(0, t.index)} ${tr.clause}`, payload: tr.payload };
    return { kind: 'is', instruction: s.slice(0, t.index), payload: rest };
  }

  for (const m of s.matchAll(new RegExp(UNIT.source, 'gi'))) {
    const end = (m.index ?? 0) + m[0].length;
    const rest = s.slice(end);
    const a = AFTER.exec(rest);
    if (a && a[1].trim() !== '') {
      const head = s.slice(0, end + a[0].length - a[1].length);
      return isDeictic(a[1])
        ? { kind: 'after', instruction: head, deictic: true }
        : { kind: 'after', instruction: head, payload: a[1] };
    }
    const h = HAVE.exec(rest);
    if (h) {
      return isDeictic(h[1])
        ? { kind: 'after', instruction: s.slice(0, end), deictic: true }
        : { kind: 'none', instruction: s };
    }
  }

  const tr = splitTrailing(s);
  if (tr && tr.payload.trim() !== '') return { kind: 'trailing', instruction: tr.clause, payload: tr.payload };

  return { kind: 'none', instruction: s };
}

/** Removes a leading label such as "this text:" or "the following text", then surrounding quotes. */
export function cleanPayload(raw: string): string {
  const trimmed = raw.trim();
  const labelled = trimmed.replace(LABEL, '');
  const stripped = (labelled !== trimmed ? labelled : trimmed.replace(LEAD, '')).trim();
  const unlabelled = /^[?.!:\-\s]*$/.test(stripped) ? '' : stripped;
  const pairs: Array<[string, string]> = [['"', '"'], ["'", "'"], ['\u201c', '\u201d'], ['\u2018', '\u2019']];
  for (const [open, close] of pairs) {
    if (unlabelled.length >= 2 && unlabelled.startsWith(open) && unlabelled.endsWith(close)) {
      return unlabelled.slice(1, -1);
    }
  }
  return unlabelled;
}

function toUnit(word: string): Unit {
  const w = word.toLowerCase();
  if (w.startsWith('word')) return 'words';
  if (w.startsWith('char')) return 'characters';
  if (w.startsWith('letter')) return 'letters';
  return 'lines';
}

/**
 * Score 1 means a cue, a unit and the text were all found: run it. 0.75 means
 * cue and unit but no usable text: ask "Did you mean". Anything else is null.
 */
function understandTextCountPlain(message: string): Understanding | null {
  const loc = locate(message);
  const unitMatch = UNIT.exec(loc.instruction);
  if (!unitMatch) return null;

  let payload = loc.payload === undefined ? undefined : cleanPayload(loc.payload);
  // A short unquoted question ("how many lines in a sonnet?") is not text to count.
  const weak = loc.kind === 'after' && payload !== undefined && /\?\s*$/.test(payload);
  if (weak) payload = undefined;

  const implicit =
    loc.kind === 'quoted' &&
    /^\s*(?:the\s+)?(?:words?|characters?|chars?|letters?|lines?)\s+(?:in|of)\s*[?.!\s]*$/i.test(loc.instruction);
  if (!CUE.test(loc.instruction) && !implicit) return null;

  const unit = toUnit(unitMatch[1]);
  const hasText = payload !== undefined && payload !== '';
  const input: Record<string, unknown> = hasText ? { text: payload, unit } : { unit };
  const known = hasText || loc.deictic === true;
  return {
    score: known ? 1 : 0.75,
    input,
    ...(hasText ? {} : { ask: { field: 'text', question: TEXT_QUESTION } }),
    summary: `count the ${unit} in ${hasText ? 'the text you gave' : 'some text'}`,
  };
}


/** Interpret a text-count request while shielding detected code from intent parsing. */
export function understandTextCount(message: string): Understanding | null {
  const protectedText = protectCodeRegions(message);
  const originalLocation = locate(message);
  const payloadUnsure = originalLocation.payload !== undefined && protectCodeRegions(originalLocation.payload).unsure;
  const result = understandTextCountPlain(protectedText.text);
  if (!result) return result;
  if (result.input && typeof result.input === 'object' && 'text' in result.input && typeof result.input.text === 'string') {
    result.input.text = restoreProtectedText(result.input.text, protectedText);
  }
  if (protectedText.unsure || payloadUnsure) result.summary += ' (I could not tell whether part of the text is code, so I counted all of it as ordinary text.)';
  return result;
}
