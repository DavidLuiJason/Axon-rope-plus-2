export const CASE_CONVERT_MODES = ['UPPER', 'lower', 'Title', 'Sentence', 'camelCase', 'PascalCase', 'snake_case', 'kebab-case', 'CONSTANT_CASE'] as const;
export type CaseConvertMode = typeof CASE_CONVERT_MODES[number];
export const CASE_CONVERT_LIMITS = Object.freeze({ maxInputCharacters: 200_000 });
export type CaseConvertResult = { ok: true; text: string } | { ok: false; error: 'too-large' | 'invalid-mode' | 'invalid-input' };
export const CASE_CONVERT_TYPES = Object.freeze({ mode: CASE_CONVERT_MODES, apostrophes: 'Apostrophes split words; they are removed in joined identifier modes and preserved in Title/Sentence modes.', numbers: 'Digits are preserved. A digit/lowercase-to-uppercase boundary splits (2FAST becomes 2_fast); digits are never capitalized.' });
function wordsOf(text: string): string[] {
  const separated = text
    .replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, '$1 $2')
    .replace(/([\p{Lu}])([\p{Lu}][\p{Ll}])/gu, '$1 $2')
    .replace(/[’']/gu, ' ');
  return separated.match(/[\p{L}\p{N}]+/gu) ?? [];
}
function upperFirst(word: string): string { const chars = Array.from(word); return chars.length ? chars[0].toLocaleUpperCase() + chars.slice(1).join('').toLocaleLowerCase() : ''; }
export function caseConvert(text: string, mode: CaseConvertMode): CaseConvertResult {
  if (typeof text !== 'string' || typeof mode !== 'string') return { ok: false, error: 'invalid-input' };
  if (text.length > CASE_CONVERT_LIMITS.maxInputCharacters) return { ok: false, error: 'too-large' };
  if (!(CASE_CONVERT_MODES as readonly string[]).includes(mode)) return { ok: false, error: 'invalid-mode' };
  if (mode === 'UPPER') return { ok: true, text: text.toLocaleUpperCase() };
  if (mode === 'lower') return { ok: true, text: text.toLocaleLowerCase() };
  if (mode === 'Sentence') {
    const lower = text.toLocaleLowerCase();
    return { ok: true, text: lower.replace(/(^|[.!?。！？]\s+)([\p{Ll}])/gu, (_m, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase()) };
  }
  if (mode === 'Title') return { ok: true, text: text.replace(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu, (w) => upperFirst(w)) };
  const words = wordsOf(text);
  const lower = words.map((w) => w.toLocaleLowerCase());
  switch (mode) {
    case 'camelCase': return { ok: true, text: lower.map((w, i) => i === 0 ? w : upperFirst(w)).join('') };
    case 'PascalCase': return { ok: true, text: lower.map(upperFirst).join('') };
    case 'snake_case': return { ok: true, text: lower.join('_') };
    case 'kebab-case': return { ok: true, text: lower.join('-') };
    case 'CONSTANT_CASE': return { ok: true, text: lower.map((w) => w.toLocaleUpperCase()).join('_') };
    default: return { ok: false, error: 'invalid-mode' };
  }
}
