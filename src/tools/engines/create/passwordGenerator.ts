export type EngineResult<T> = { ok: true } & T | { ok: false; error: string };
export type RandomBelow = (maxExclusive: number) => number;

export interface PasswordOptions {
  length: number;
  lower?: boolean;
  upper?: boolean;
  digits?: boolean;
  symbols?: boolean;
  excludeLookAlikes?: boolean;
}
export interface PasswordOutput { password: string; entropyBits: number; }

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/\\|~`\'"<>';

export function cryptoRandomBelow(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000) {
    throw new Error('invalid-random-bound');
  }
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('crypto-unavailable');
  const range = 0x100000000;
  const limit = Math.floor(range / maxExclusive) * maxExclusive;
  const word = new Uint32Array(1);
  let value = 0;
  do {
    cryptoApi.getRandomValues(word);
    value = word[0];
  } while (value >= limit);
  return value % maxExclusive;
}

function validRandom(random: RandomBelow, max: number): number | null {
  try {
    const n = random(max);
    return Number.isSafeInteger(n) && n >= 0 && n < max ? n : null;
  } catch {
    return null;
  }
}

export function passwordGenerator(
  options: PasswordOptions,
  random: RandomBelow = cryptoRandomBelow
): EngineResult<PasswordOutput> {
  try {
    if (!options || typeof options !== 'object') return { ok: false, error: 'invalid-options' };
    const { length, excludeLookAlikes = false } = options;
    if (!Number.isInteger(length) || length < 4 || length > 128) return { ok: false, error: 'invalid-length' };
    const selected = [
      options.lower ? LOWER : '',
      options.upper ? UPPER : '',
      options.digits ? DIGITS : '',
      options.symbols ? SYMBOLS : '',
    ];
    if (!selected.some(Boolean)) return { ok: false, error: 'no-character-sets' };
    const lookalikes = new Set('0O1lI|'.split(''));
    const sets = selected.map((set) => excludeLookAlikes ? [...set].filter((c) => !lookalikes.has(c)).join('') : set).filter(Boolean);
    if (sets.some((set) => set.length === 0)) return { ok: false, error: 'empty-character-set' };
    const alphabet = [...new Set(sets.join(''))];
    if (length < sets.length) return { ok: false, error: 'length-too-short-for-sets' };
    const chars: string[] = [];
    for (const set of sets) {
      const n = validRandom(random, set.length);
      if (n === null) return { ok: false, error: 'random-source-invalid' };
      chars.push(set[n]);
    }
    while (chars.length < length) {
      const n = validRandom(random, alphabet.length);
      if (n === null) return { ok: false, error: 'random-source-invalid' };
      chars.push(alphabet[n]);
    }
    for (let i = chars.length - 1; i > 0; i--) {
      const n = validRandom(random, i + 1);
      if (n === null) return { ok: false, error: 'random-source-invalid' };
      [chars[i], chars[n]] = [chars[n], chars[i]];
    }
    return { ok: true, password: chars.join(''), entropyBits: length * Math.log2(alphabet.length) };
  } catch {
    return { ok: false, error: 'invalid-options' };
  }
}
