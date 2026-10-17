import { cryptoRandomBelow, type RandomBelow, type EngineResult } from './passwordGenerator';

export type RandomPickerOutput<T> = { values: T[] };
function pickIndex(random: RandomBelow, max: number): number | null {
  try {
    const n = random(max);
    return Number.isSafeInteger(n) && n >= 0 && n < max ? n : null;
  } catch { return null; }
}
export function pickRandom<T>(items: readonly T[], count = 1, repeats = false, random: RandomBelow = cryptoRandomBelow): EngineResult<RandomPickerOutput<T>> {
  if (!Array.isArray(items)) return { ok: false, error: 'invalid-list' };
  if (!Number.isInteger(count) || count < 0) return { ok: false, error: 'invalid-count' };
  if (!repeats && count > items.length) return { ok: false, error: 'not-enough-items' };
  if (count > 100000) return { ok: false, error: 'count-too-large' };
  if (count > 0 && items.length === 0) return { ok: false, error: 'empty-list' };
  const values: T[] = [];
  if (repeats) {
    for (let i = 0; i < count; i++) {
      const index = pickIndex(random, items.length);
      if (index === null) return { ok: false, error: 'random-source-invalid' };
      values.push(items[index]);
    }
    return { ok: true, values };
  }
  // Without repeats: the random value is an index into the items still left, in their original order.
  // A Fenwick tree finds the k-th remaining item in O(log n), so picking many items stays fast on a phone
  // (the earlier splice approach was O(n) per pick and took seconds for 100,000 items).
  const n = items.length;
  const tree = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) { tree[i] += 1; const parent = i + (i & -i); if (parent <= n) tree[parent] += tree[i]; }
  let top = 1; while (top * 2 <= n) top *= 2;
  for (let i = 0; i < count; i++) {
    const remaining = n - i;
    const k = pickIndex(random, remaining);
    if (k === null) return { ok: false, error: 'random-source-invalid' };
    let position = 0, left = k;
    for (let step = top; step > 0; step >>= 1) {
      const next = position + step;
      if (next <= n && tree[next] <= left) { position = next; left -= tree[next]; }
    }
    // position is the 0-based index of the chosen item (the k-th still present)
    values.push(items[position]);
    for (let j = position + 1; j <= n; j += j & -j) tree[j] -= 1;
  }
  return { ok: true, values };
}
export function shuffle<T>(items: readonly T[], random: RandomBelow = cryptoRandomBelow): EngineResult<RandomPickerOutput<T>> {
  if (!Array.isArray(items)) return { ok: false, error: 'invalid-list' };
  const values = [...items];
  for (let i = values.length - 1; i > 0; i--) {
    const j = pickIndex(random, i + 1);
    if (j === null) return { ok: false, error: 'random-source-invalid' };
    [values[i], values[j]] = [values[j], values[i]];
  }
  return { ok: true, values };
}
export function coinFlip(random: RandomBelow = cryptoRandomBelow): EngineResult<{ result: 'heads' | 'tails' }> {
  const n = pickIndex(random, 2);
  return n === null ? { ok: false, error: 'random-source-invalid' } : { ok: true, result: n === 0 ? 'heads' : 'tails' };
}
export function rollDice(notation: string, random: RandomBelow = cryptoRandomBelow): EngineResult<{ rolls: number[]; total: number }> {
  if (typeof notation !== 'string') return { ok: false, error: 'invalid-dice' };
  const match = /^(\d{1,4})d(\d{1,9})$/i.exec(notation.trim());
  if (!match) return { ok: false, error: 'invalid-dice' };
  const count = Number(match[1]), sides = Number(match[2]);
  if (count < 1 || count > 1000 || sides < 1 || sides > 1000000000) return { ok: false, error: 'invalid-dice' };
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    const n = pickIndex(random, sides);
    if (n === null) return { ok: false, error: 'random-source-invalid' };
    rolls.push(n + 1);
  }
  return { ok: true, rolls, total: rolls.reduce((a, b) => a + b, 0) };
}
export function randomInteger(min: number, max: number, random: RandomBelow = cryptoRandomBelow): EngineResult<{ value: number }> {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) return { ok: false, error: 'invalid-range' };
  const span = max - min + 1;
  if (!Number.isSafeInteger(span) || span < 1 || span > 0x100000000) return { ok: false, error: 'range-too-large' };
  const n = pickIndex(random, span);
  return n === null ? { ok: false, error: 'random-source-invalid' } : { ok: true, value: min + n };
}
export function splitTeams<T>(items: readonly T[], teamCount: number, random: RandomBelow = cryptoRandomBelow): EngineResult<{ teams: T[][] }> {
  if (!Array.isArray(items)) return { ok: false, error: 'invalid-list' };
  if (!Number.isInteger(teamCount) || teamCount < 1 || teamCount > Math.max(items.length, 1)) return { ok: false, error: 'invalid-team-count' };
  const shuffled = shuffle(items, random);
  if (!shuffled.ok) return shuffled;
  const teams = Array.from({ length: teamCount }, () => [] as T[]);
  shuffled.values.forEach((item, i) => teams[i % teamCount].push(item));
  return { ok: true, teams };
}
