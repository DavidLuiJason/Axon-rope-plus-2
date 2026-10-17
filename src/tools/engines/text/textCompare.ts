export const TEXT_COMPARE_MODES = ['line', 'word'] as const;
export type TextCompareMode = typeof TEXT_COMPARE_MODES[number];
export type TextDiffType = 'same' | 'add' | 'remove';
export type TextDiffPart = { type: TextDiffType; text: string };
export type TextCompareCounts = { same: number; add: number; remove: number };
export const TEXT_COMPARE_LIMITS = Object.freeze({ maxLines: 5_000, maxCharacters: 100_000 });
export const TEXT_COMPARE_TYPES = Object.freeze({ mode: TEXT_COMPARE_MODES, part: ['type', 'text'] as const, counts: 'Counts are the number of line or word tokens in each type, independent of how adjacent parts are coalesced.' });
export type TextCompareResult = { ok: true; mode: TextCompareMode; differences: TextDiffPart[]; counts: TextCompareCounts } | { ok: false; error: 'too-large' | 'invalid-input' | 'invalid-mode' };
function tokens(text: string, mode: TextCompareMode): string[] {
  if (text.length === 0) return [];
  if (mode === 'word') return text.match(/\s+|[^\s]+/gu) ?? [];
  return text.match(/[^\r\n]*(?:\r\n|\n|\r)|[^\r\n]+$/gu) ?? [];
}
function append(parts: TextDiffPart[], type: TextDiffType, text: string): void {
  if (!text) return;
  const previous = parts[parts.length - 1];
  if (previous?.type === type) previous.text += text;
  else parts.push({ type, text });
}
/** Myers shortest-edit-script algorithm; memory grows with edit distance, not the full LCS matrix. */
function diff(a: string[], b: string[], mode: TextCompareMode, finalBreakMismatch: boolean): { differences: TextDiffPart[]; counts: TextCompareCounts } {
  const key = (token: string): string => mode === 'line' ? token.replace(/\r\n$|[\r\n]$/u, '') : token;
  const counts: TextCompareCounts = { same: 0, add: 0, remove: 0 };
  const n = a.length, m = b.length, max = n + m;
  const trace: Map<number, number>[] = [];
  let v = new Map<number, number>([[1, 0]]);
  let foundD = 0;
  outer: for (let d = 0; d <= max; d += 1) {
    trace.push(new Map(v));
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1))) x = v.get(k + 1) ?? 0;
      else x = (v.get(k - 1) ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && key(a[x]) === key(b[y]) && !(finalBreakMismatch && x === n - 1 && y === m - 1)) { x += 1; y += 1; }
      v.set(k, x);
      if (x >= n && y >= m) { foundD = d; break outer; }
    }
  }
  let x = n, y = m;
  const reversed: TextDiffPart[] = [];
  for (let d = foundD; d >= 0; d -= 1) {
    const previous = trace[d];
    const k = x - y;
    const previousK = k === -d || (k !== d && (previous.get(k - 1) ?? -1) < (previous.get(k + 1) ?? -1)) ? k + 1 : k - 1;
    const previousX = d === 0 ? 0 : (previous.get(previousK) ?? 0);
    const previousY = previousX - previousK;
    while (x > previousX && y > previousY) { reversed.push({ type: 'same', text: b[y - 1] }); x -= 1; y -= 1; }
    if (d > 0) {
      if (x === previousX) { reversed.push({ type: 'add', text: b[y - 1] }); y -= 1; }
      else { reversed.push({ type: 'remove', text: a[x - 1] }); x -= 1; }
    }
  }
  const result: TextDiffPart[] = [];
  for (let i = reversed.length - 1; i >= 0; i -= 1) {
    const part = reversed[i];
    counts[part.type] += 1;
    append(result, part.type, part.text);
  }
  return { differences: result, counts };
}
export function textCompare(original: string, revised: string, mode: TextCompareMode = 'line'): TextCompareResult {
  if (typeof original !== 'string' || typeof revised !== 'string') return { ok: false, error: 'invalid-input' };
  if (typeof mode !== 'string' || !(TEXT_COMPARE_MODES as readonly string[]).includes(mode)) return { ok: false, error: 'invalid-mode' };
  if (original.length + revised.length > TEXT_COMPARE_LIMITS.maxCharacters) return { ok: false, error: 'too-large' };
  const a = tokens(original, mode), b = tokens(revised, mode);
  if (mode === 'line' && (original.split(/\r\n|\n|\r/).length > TEXT_COMPARE_LIMITS.maxLines || revised.split(/\r\n|\n|\r/).length > TEXT_COMPARE_LIMITS.maxLines)) return { ok: false, error: 'too-large' };
  const finalBreakMismatch = mode === 'line' && a.length > 0 && b.length > 0 &&
    /[\r\n]$/u.test(a[a.length - 1]) !== /[\r\n]$/u.test(b[b.length - 1]);
  const { differences, counts } = diff(a, b, mode, finalBreakMismatch);
  return { ok: true, mode, differences, counts };
}
