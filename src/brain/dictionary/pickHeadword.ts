import type { DictEntry } from './types';

export interface HeadwordSource {
  leafKeys(): string[];
  headwordsOf(leaf: string): Promise<{ word: string; entries: DictEntry[] }[]>;
}
export interface PickHeadwordOptions {
  dictionary: HeadwordSource;
  seed: string;
  mode: 'day' | 'random';
}
export type PickHeadwordResult = { ok: true; word: string } | { ok: false; error: 'invalid-input' | 'none-found' | 'reader-error' };

/** FNV-1a over UTF-8 bytes, with 32-bit unsigned overflow. */
export function fnv1a(seed: string): number {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(seed)) {
    h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  }
  return h;
}

export async function pickHeadword(options: PickHeadwordOptions): Promise<PickHeadwordResult> {
  try {
    if (!options || typeof options.seed !== 'string' || !options.seed ||
        (options.mode !== 'day' && options.mode !== 'random') ||
        !options.dictionary || typeof options.dictionary.leafKeys !== 'function' ||
        typeof options.dictionary.headwordsOf !== 'function' ||
        (options.mode === 'day' && !/^\d{4}-\d{2}-\d{2}$/.test(options.seed))) {
      return { ok: false, error: 'invalid-input' };
    }
    const leaves = options.dictionary.leafKeys();
    if (!Array.isArray(leaves) || !leaves.length) return { ok: false, error: 'none-found' };
    const start = fnv1a(options.seed) % leaves.length;
    for (let offset = 0; offset < Math.min(60, leaves.length); offset++) {
      const leaf = leaves[(start + offset) % leaves.length];
      const words = (await options.dictionary.headwordsOf(leaf))
        .filter(({ word, entries }) => typeof word === 'string' &&
          new RegExp(`^[a-z]{${options.mode === 'day' ? 5 : 3},}$`).test(word) &&
          Array.isArray(entries) && entries.some((entry) => Array.isArray(entry.senses) &&
            entry.senses.some((sense) => typeof sense.definition === 'string' && !!sense.definition.trim() &&
              (options.mode !== 'day' || (Array.isArray(sense.examples) && sense.examples.some((ex) => typeof ex === 'string' && !!ex.trim()))))))
        .map(({ word }) => word).sort();
      if (words.length) return { ok: true, word: words[fnv1a(`${options.seed}:${leaf}`) % words.length] };
    }
    return { ok: false, error: 'none-found' };
  } catch {
    return { ok: false, error: 'reader-error' };
  }
}
