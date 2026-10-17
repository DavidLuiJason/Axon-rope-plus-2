/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Text Counter as a Brain command: which phrasings it understands and how
 * its result is described. It matches only known phrasings; anything else is
 * not a command.
 */

import type { TextCounts } from '../kernel/textCount';
import type { CommandDef, CommandMatch } from './types';
import { cleanPayload, TEXT_KEYWORDS, TEXT_QUESTION, understandTextCount } from './textCountIntent';
import { protectCodeRegions, restoreProtectedText } from './symbols/protect';
import { detectCodeRegions } from './symbols/codeRegions';

export { TEXT_QUESTION };

type Unit = 'words' | 'characters' | 'letters' | 'lines' | 'all';

const UNIT = '(words?|characters?|chars?|letters?|lines?)';
const LEAD = '(?:please\\s+|can you\\s+|could you\\s+)?';

const PATTERNS: RegExp[] = [
  // count words in <text> / count the characters of <text>
  new RegExp(`^${LEAD}count\\s+(?:the\\s+)?${UNIT}\\s+(?:in|of)\\b\\s*([\\s\\S]*)$`, 'i'),
  // how many words are in <text> / how many lines in <text>
  new RegExp(`^${LEAD}how\\s+many\\s+${UNIT}\\s+(?:(?:are|is|do|does)\\s+)?(?:there\\s+)?(?:in|of)\\b\\s*([\\s\\S]*)$`, 'i'),
  // count words / count words: <text>
  new RegExp(`^${LEAD}count\\s+(?:the\\s+)?${UNIT}\\s*(?:[:\\-]\\s*([\\s\\S]*))?$`, 'i'),
  // word count / word count: <text> / character count of <text>
  new RegExp(`^${LEAD}(word|character|char|letter|line)\\s+count\\b\\s*(?:of|in|for)?\\s*[:\\-]?\\s*([\\s\\S]*)$`, 'i'),
];

const uncertainInputs = new WeakSet<object>();

const DEICTIC = new Set([
  'this', 'this text', 'this sentence', 'this message', 'this paragraph',
  'that', 'that text', 'the text', 'the following', 'the following text',
  'following', 'following text', 'it', 'the above', 'above',
]);

function toUnit(word: string | undefined): Unit {
  if (!word) return 'all';
  const w = word.toLowerCase();
  if (w.startsWith('word')) return 'words';
  if (w.startsWith('char')) return 'characters';
  if (w.startsWith('letter')) return 'letters';
  if (w.startsWith('line')) return 'lines';
  return 'all';
}

function stripQuotes(text: string): string {
  const pairs: Array<[string, string]> = [['"', '"'], ["'", "'"], ['\u201c', '\u201d'], ['\u2018', '\u2019']];
  for (const [open, close] of pairs) {
    if (text.length >= 2 && text.startsWith(open) && text.endsWith(close)) {
      return text.slice(1, -1);
    }
  }
  return text;
}

/** Removes a leading ":" or a label such as "this text:" or "the following text", then the quotes. */
function cleanText(raw: string): string {
  return cleanPayload(raw.replace(/^\s*:\s*/, ''));
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const TEXT_COUNT_COMMAND: CommandDef = {
  id: 'text-count',
  actionId: 'text.count',
  title: 'Count text',
  keywords: TEXT_KEYWORDS,
  understand: understandTextCount,
  examples: [
    'count words in hello brave new world',
    'how many characters are in good morning',
    'count lines',
  ],

  match(message: string): CommandMatch | null {
    const protectedText = protectCodeRegions(message);
    const uncertainOriginal = protectedText.unsure || /:\s*\S[^\n]*\n(?: {4,}|\t)\S/m.test(message);
    for (const pattern of PATTERNS) {
      const m = pattern.exec(protectedText.text.trim());
      if (!m) continue;
      const unit = toUnit(m[1]);
      const cleaned = cleanText(m[2] ?? '');
      const missing = cleaned === '' || DEICTIC.has(cleaned.toLowerCase().replace(/[?.!]+$/, ''));
      if (missing) {
        const input = { unit };
        if (uncertainOriginal) uncertainInputs.add(input);
        return { input, ask: { field: 'text', question: TEXT_QUESTION } };
      }
      const input = { text: restoreProtectedText(cleaned, protectedText), unit };
      if (uncertainOriginal || detectCodeRegions(input.text).unsure) uncertainInputs.add(input);
      return { input };
    }
    return null;
  },

  fill(partial, field, answer) {
    return { ...partial, [field]: stripQuotes(answer.trim()) };
  },

  describe(output, input) {
    const c = output as TextCounts;
    const unit = input.unit as Unit;
    const details =
      `Words: ${c.words}\n` +
      `Characters: ${c.characters} (${c.charactersNoSpaces} without spaces)\n` +
      `Letters: ${c.letters}\n` +
      `Lines: ${c.lines}`;
    let headline: string;
    switch (unit) {
      case 'words':
        headline = `That text has ${plural(c.words, 'word', 'words')}.`;
        break;
      case 'characters':
        headline = `That text has ${plural(c.characters, 'character', 'characters')} (${c.charactersNoSpaces} without spaces).`;
        break;
      case 'letters':
        headline = `That text has ${plural(c.letters, 'letter', 'letters')}.`;
        break;
      case 'lines':
        headline = `That text has ${plural(c.lines, 'line', 'lines')}.`;
        break;
      default:
        headline = 'Here are the counts for that text:';
    }
    const text = typeof input.text === 'string' ? input.text : '';
    const code = detectCodeRegions(text);
    const note = code.regions.length
      ? `\n\nNote: I found ${code.regions.length} code ${code.regions.length === 1 ? 'part' : 'parts'} and counted ${code.regions.length === 1 ? 'it' : 'them'} exactly as written. I changed nothing.`
      : (code.unsure || uncertainInputs.has(input))
        ? `\n\nNote: I could not tell whether part of the text is code, so I counted all of it as ordinary text.`
        : '';
    return `${headline}\n\n${details}${note}`;
  },
};
