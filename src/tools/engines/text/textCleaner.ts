export type TextCleanerOptions = { trimEachLine?: boolean; collapseRepeatedSpaces?: boolean; removeBlankLines?: boolean; collapseBlankLines?: boolean; straightenQuotesAndDashes?: boolean; removeZeroWidth?: boolean; normalizeLineEndings?: boolean };
export type TextCleanerCounts = Record<keyof TextCleanerOptions, number>;
export const TEXT_CLEANER_LIMITS = Object.freeze({ maxInputCharacters: 200_000 });
export const TEXT_CLEANER_TYPES = Object.freeze({ options: ['trimEachLine', 'collapseRepeatedSpaces', 'removeBlankLines', 'collapseBlankLines', 'straightenQuotesAndDashes', 'removeZeroWidth', 'normalizeLineEndings'] as const, counts: 'Each count is the number of replacements/removals or lines affected by that switch.' });
export type TextCleanerResult = { ok: true; text: string; counts: TextCleanerCounts } | { ok: false; error: 'too-large' | 'invalid-input' };
export function textCleaner(text: string, options: TextCleanerOptions = {}): TextCleanerResult {
  if (typeof text !== 'string' || options === null || typeof options !== 'object') return { ok: false, error: 'invalid-input' };
  if (text.length > TEXT_CLEANER_LIMITS.maxInputCharacters) return { ok: false, error: 'too-large' };
  const counts: TextCleanerCounts = { trimEachLine: 0, collapseRepeatedSpaces: 0, removeBlankLines: 0, collapseBlankLines: 0, straightenQuotesAndDashes: 0, removeZeroWidth: 0, normalizeLineEndings: 0 };
  let out = text;
  if (options.normalizeLineEndings) {
    out = out.replace(/\r\n|\r|\u0085|\u2028|\u2029/g, (m) => { counts.normalizeLineEndings += 1; return '\n'; });
  }
  if (options.removeZeroWidth) out = out.replace(/[\u200B-\u200D\u2060\uFEFF]/g, () => { counts.removeZeroWidth += 1; return ''; });
  if (options.straightenQuotesAndDashes) out = out.replace(/[“”„‟‘’‚‛—–]/g, (m) => { counts.straightenQuotesAndDashes += 1; if ('“”„‟'.includes(m)) return '"'; if ('‘’‚‛'.includes(m)) return "'"; return '-'; });
  let lines = out.split('\n');
  if (options.trimEachLine) lines = lines.map((line) => { const next = line.trim(); if (next !== line) counts.trimEachLine += 1; return next; });
  if (options.collapseRepeatedSpaces) lines = lines.map((line) => line.replace(/ {2,}/g, (m) => { counts.collapseRepeatedSpaces += m.length - 1; return ' '; }));
  if (options.removeBlankLines) lines = lines.filter((line) => { const blank = line.trim().length === 0; if (blank) counts.removeBlankLines += 1; return !blank; });
  if (options.collapseBlankLines) {
    const next: string[] = [];
    for (const line of lines) {
      if (line.trim() === '' && next.length && next[next.length - 1].trim() === '') { counts.collapseBlankLines += 1; continue; }
      next.push(line);
    }
    lines = next;
  }
  return { ok: true, text: lines.join('\n'), counts };
}
