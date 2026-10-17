/**
 * Shard keys for the dictionary (DICT-C2).
 * The rule must stay identical to norm()/key_of() in reshard_dictionary.py.
 */
export const MAX_KEY_DEPTH = 4;

/** Lowercase, split accents off and drop them, every other character becomes "_". */
export function normalizeForKey(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^a-z0-9]/gu, '_');
}

/** The first n characters of the normalised word, padded with "_" when shorter. */
export function keyOf(word: string, n: number): string {
  return normalizeForKey(word).slice(0, n).padEnd(n, '_');
}
