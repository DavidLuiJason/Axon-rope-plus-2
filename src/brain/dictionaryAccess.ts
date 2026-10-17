/**
 * The one place the app opens the English dictionary (DICT-I1).
 * It opens only when something asks for it, never at app start, and keeps the result.
 */
import { Dictionary } from './dictionary';
import { canHash, createFetchReader, sha256Hex } from './dictionary/fetchReader';

export const DICTIONARY_FOLDER = `${import.meta.env.BASE_URL}dictionary/en`;

let opening: Promise<Dictionary> | null = null;

/** Opens the dictionary on first use. If opening fails, the next call tries again. */
export function getDictionary(): Promise<Dictionary> {
  if (!opening) {
    opening = Dictionary.open({
      read: createFetchReader(DICTIONARY_FOLDER),
      ...(canHash() ? { hash: sha256Hex } : {}),
    });
    opening.catch(() => {
      opening = null;
    });
  }
  return opening;
}
