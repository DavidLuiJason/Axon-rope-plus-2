/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * English dictionary adapter for the knowledge slot. The production dictionary
 * is opened only after the first lookup; tests can inject the same Dictionary
 * class with a disk reader without changing the production loader.
 */
import type { Dictionary } from '../dictionary';
import { createKnowledgeSlot, type KnowledgeBackend, type KnowledgeSlot } from './slot';

export const MAX_SENSES = 5;
const SOURCE = 'Open English WordNet';
const VERSION = '2025';
const LICENSE = 'Creative Commons Attribution 4.0 International; derived from Princeton WordNet';
const ATTRIBUTION = 'Open English WordNet 2025, derived from Princeton WordNet. Keep the full attribution and licence files with the dictionary data.';

type OpenDictionary = () => Promise<Dictionary>;

/** Creates a slot; the default getter defers importing/opening the app dictionary until lookup. */
export function createDictionarySlot(openDictionary?: OpenDictionary): KnowledgeSlot {
  let opening: Promise<Dictionary> | null = null;

  const open = (): Promise<Dictionary> => {
    if (!opening) {
      opening = (openDictionary
        ? openDictionary()
        : import('../dictionaryAccess').then(({ getDictionary }) => getDictionary())
      ).catch((error: unknown) => {
        opening = null;
        throw error;
      });
    }
    return opening;
  };

  const backend: KnowledgeBackend = {
    status: () => ({
      ready: true,
      source: SOURCE,
      version: VERSION,
      note: 'English dictionary opens on the first lookup',
    }),

    async lookup(query: string) {
      const dictionary = await open();
      const result = await dictionary.lookup(query);
      if (!result.found) return { status: 'not-found', word: query };

      const senses = result.matches.flatMap((match) =>
        match.entries.flatMap((entry) =>
          entry.senses.map((sense) => ({
            partOfSpeech: entry.pos,
            meaning: sense.definition ?? sense.more_definitions?.[0] ?? '',
            ...(sense.examples?.[0] ? { example: sense.examples[0] } : {}),
            ...(sense.synonyms ? { synonyms: [...sense.synonyms] } : {}),
            ...((sense.examples || sense.more_definitions) ? { examples: [...(sense.examples ?? []), ...(sense.more_definitions ?? [])] } : {}),
          })),
        ),
      ).filter((sense) => sense.meaning.trim().length > 0).slice(0, MAX_SENSES);

      if (senses.length === 0) {
        const first = result.matches[0];
        const pos = first?.entries[0]?.pos ?? 'unknown';
        senses.push({ partOfSpeech: pos, meaning: 'No definition is recorded for this entry.' });
      }
      const pronunciations = [...new Set(result.matches.flatMap((match) =>
        match.entries.flatMap((entry) => (entry.pronunciations ?? []).map((item) => item.text)),
      ))];
      return { status: 'found', word: result.matches[0]?.word ?? query, senses,
        ...(pronunciations.length ? { pronunciations } : {}),
      };
    },

    credits: () => ({
      source: SOURCE,
      version: VERSION,
      license: LICENSE,
      attribution: ATTRIBUTION,
    }),
  };

  return createKnowledgeSlot(backend);
}

/** Shared production slot. Creating it does not read or open any dictionary files. */
export const dictionarySlot = createDictionarySlot();
