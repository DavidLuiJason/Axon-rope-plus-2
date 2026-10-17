export const SORT_LINE_MODES = ['ascending', 'descending', 'by-length', 'natural', 'reverse', 'shuffle'] as const;
export type SortLineMode = typeof SORT_LINE_MODES[number];
export type SortLinesOptions = { mode?: SortLineMode; ignoreCase?: boolean; removeDuplicates?: boolean; ignoreBlankLines?: boolean };
export type RandomFunction = () => number;
export const SORT_LINES_LIMITS = Object.freeze({ maxInputCharacters: 200_000, maxLines: 20_000 });
export const SORT_LINES_TYPES = Object.freeze({ mode: SORT_LINE_MODES, random: 'shuffle requires an injected random function returning a number in [0, 1); absent or invalid randomness returns invalid-random.' });
export type SortLinesResult = { ok: true; text: string; lineCount: number } | { ok: false; error: 'too-large' | 'invalid-input' | 'invalid-mode' | 'invalid-random' };
export function sortLines(text: string, options: SortLinesOptions = {}, random?: RandomFunction): SortLinesResult {
  if (typeof text !== 'string' || options === null || typeof options !== 'object') return { ok: false, error: 'invalid-input' };
  if (text.length > SORT_LINES_LIMITS.maxInputCharacters) return { ok: false, error: 'too-large' };
  const mode = options.mode ?? 'ascending';
  if (!(SORT_LINE_MODES as readonly string[]).includes(mode)) return { ok: false, error: 'invalid-mode' };
  let lines = text.split(/\r\n|\n|\r/).map((value, index) => ({ value, index }));
  if (lines.length > SORT_LINES_LIMITS.maxLines) return { ok: false, error: 'too-large' };
  if (options.ignoreBlankLines) lines = lines.filter((line) => line.value.trim() !== '');
  if (options.removeDuplicates) {
    const seen = new Set<string>();
    lines = lines.filter(({ value }) => { const key = options.ignoreCase ? value.toLocaleLowerCase() : value; if (seen.has(key)) return false; seen.add(key); return true; });
  }
  const cmp = (a: string, b: string): number => {
    const left = options.ignoreCase ? a.toLocaleLowerCase() : a;
    const right = options.ignoreCase ? b.toLocaleLowerCase() : b;
    return left < right ? -1 : left > right ? 1 : 0;
  };
  const naturalCompare = (a: string, b: string): number => {
    const left = options.ignoreCase ? a.toLocaleLowerCase() : a;
    const right = options.ignoreCase ? b.toLocaleLowerCase() : b;
    const leftParts = left.match(/\d+|\D+/gu) ?? [];
    const rightParts = right.match(/\d+|\D+/gu) ?? [];
    const length = Math.min(leftParts.length, rightParts.length);
    for (let i = 0; i < length; i += 1) {
      const x = leftParts[i], y = rightParts[i];
      const xDigits = /^\d+$/u.test(x), yDigits = /^\d+$/u.test(y);
      let result = 0;
      if (xDigits && yDigits) {
        const nx = x.replace(/^0+(?=\d)/u, ''), ny = y.replace(/^0+(?=\d)/u, '');
        result = nx.length - ny.length || (nx < ny ? -1 : nx > ny ? 1 : 0) || x.length - y.length;
      } else result = x < y ? -1 : x > y ? 1 : 0;
      if (result !== 0) return result;
    }
    return leftParts.length - rightParts.length;
  };
  if (mode === 'reverse') lines.reverse();
  else if (mode === 'shuffle') {
    if (typeof random !== 'function') return { ok: false, error: 'invalid-random' };
    for (let i = lines.length - 1; i > 0; i -= 1) {
      const value = random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) return { ok: false, error: 'invalid-random' };
      const j = Math.floor(value * (i + 1)); [lines[i], lines[j]] = [lines[j], lines[i]];
    }
  } else {
    lines.sort((a, b) => {
      let result = mode === 'by-length' ? Array.from(a.value).length - Array.from(b.value).length : mode === 'natural' ? naturalCompare(a.value, b.value) : cmp(a.value, b.value);
      if (mode === 'descending') result *= -1;
      return result || a.index - b.index;
    });
  }
  return { ok: true, text: lines.map((line) => line.value).join('\n'), lineCount: lines.length };
}
