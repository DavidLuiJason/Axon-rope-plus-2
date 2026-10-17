/** Pure find/replace engine. Positions are UTF-16 offsets, matching JavaScript string indexing. */
export const FIND_REPLACE_LIMITS = Object.freeze({ maxInputCharacters: 200_000, maxPatternCharacters: 500, maxReportedPositions: 1_000 });
export type FindReplaceOptions = { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean; replaceAll?: boolean };
export type MatchPosition = { start: number; end: number };
export type FindReplaceResult = { ok: true; text: string; matchCount: number; positions: MatchPosition[] } | { ok: false; error: 'too-large' | 'invalid-pattern' | 'unsafe-pattern' | 'invalid-input' };
export const FIND_REPLACE_TYPES = Object.freeze({ options: ['caseSensitive', 'wholeWord', 'regex', 'replaceAll'] as const, position: ['start', 'end'] as const });

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function nextCodePointIndex(text: string, index: number): number {
  if (index >= text.length) return index + 1;
  const cp = text.codePointAt(index);
  return index + (cp !== undefined && cp > 0xffff ? 2 : 1);
}
function riskyRegex(pattern: string): boolean {
  // Reject common nested/unbounded quantified groups that can trigger catastrophic backtracking.
  return /\([^)]*(?:[+*]|\|)[^)]*\)[+*{]/.test(pattern) || /(?:\.\*|\.\+){2,}/.test(pattern);
}
export function findReplace(text: string, pattern: string, replacement: string, options: FindReplaceOptions = {}): FindReplaceResult {
  if (typeof text !== 'string' || typeof pattern !== 'string' || typeof replacement !== 'string' || options === null || typeof options !== 'object') return { ok: false, error: 'invalid-input' };
  if (text.length > FIND_REPLACE_LIMITS.maxInputCharacters || pattern.length > FIND_REPLACE_LIMITS.maxPatternCharacters) return { ok: false, error: 'too-large' };
  if (!pattern) return { ok: true, text, matchCount: 0, positions: [] };
  if (options.regex && riskyRegex(pattern)) return { ok: false, error: 'unsafe-pattern' };
  let source = options.regex ? pattern : escapeRegExp(pattern);
  if (options.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
  let re: RegExp;
  try { re = new RegExp(source, `${options.caseSensitive ? '' : 'i'}${options.replaceAll ? 'g' : ''}u`); }
  catch { return { ok: false, error: 'invalid-pattern' }; }
  const positions: MatchPosition[] = [];
  const pieces: string[] = [];
  let matchCount = 0;
  let lastEnd = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    matchCount += 1;
    if (positions.length < FIND_REPLACE_LIMITS.maxReportedPositions) positions.push({ start, end });
    pieces.push(text.slice(lastEnd, start), replacement);
    lastEnd = end;
    if (!options.replaceAll) break;
    if (match[0].length === 0) {
      const next = nextCodePointIndex(text, re.lastIndex);
      if (next > text.length) { re.lastIndex = text.length + 1; break; }
      re.lastIndex = next;
    }
  }
  if (matchCount === 0) return { ok: true, text, matchCount: 0, positions: [] };
  pieces.push(text.slice(lastEnd));
  return { ok: true, text: pieces.join(''), matchCount, positions };
}
