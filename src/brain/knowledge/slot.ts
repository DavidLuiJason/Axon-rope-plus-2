/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stable boundary between AXON's brain and any knowledge source. Physical storage
 * details (shards, packs and paths) deliberately do not cross this boundary.
 */

export interface KnowledgeSense {
  partOfSpeech: string;
  meaning: string;
  example?: string;
  synonyms?: string[];
  examples?: string[];
}

export interface KnowledgeCredits {
  source: string;
  version: string;
  license?: string;
  attribution?: string;
}

export interface KnowledgeSlotStatus {
  ready: boolean;
  source: string;
  version: string;
  note?: string;
}

export type KnowledgeLookupResult =
  | {
      status: 'found';
      word: string;
      senses: KnowledgeSense[];
      pronunciations?: string[];
      source: string;
      version: string;
    }
  | {
      status: 'not-found';
      word: string;
      source: string;
      version: string;
    }
  | {
      status: 'error';
      word: string;
      message: string;
      source: string;
      version: string;
    };

/** A backend supplies meaning data; exceptions are kept distinct from missing words. */
export interface KnowledgeBackend {
  status(): KnowledgeSlotStatus;
  lookup(word: string): Promise<
    | { status: 'found'; word: string; senses: KnowledgeSense[]; pronunciations?: string[] }
    | { status: 'not-found'; word: string }
  >;
  credits(): KnowledgeCredits;
}

/** The one interface the brain uses for any searchable knowledge source. */
export interface KnowledgeSlot {
  /** Must be metadata-only: it must not open the source or read its data. */
  status(): KnowledgeSlotStatus;
  /** Errors opening, reading or verifying data are returned as status='error'. */
  lookup(word: string): Promise<KnowledgeLookupResult>;
  /** Static source/licence metadata; must not open the source. */
  credits(): KnowledgeCredits;
}

/** Error details are intentionally reduced to stable messages; storage paths never cross the slot. */
function safeErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  if (/hash|integrity|failed its check|file failed/i.test(detail)) return 'The knowledge data failed its integrity check.';
  if (/missing|enoent|cannot open|not found/i.test(detail)) return 'The knowledge data is missing or could not be opened.';
  return 'The knowledge source could not be read.';
}

/** Adds the common error boundary while leaving source-specific reading to adapters. */
export function createKnowledgeSlot(backend: KnowledgeBackend): KnowledgeSlot {
  return {
    status: () => backend.status(),
    async lookup(word: string): Promise<KnowledgeLookupResult> {
      const source = backend.status();
      try {
        const result = await backend.lookup(word);
        if (result.status === 'not-found') {
          return { status: 'not-found', word: result.word, source: source.source, version: source.version };
        }
        return {
          status: 'found',
          word: result.word,
          senses: result.senses,
          ...(result.pronunciations ? { pronunciations: result.pronunciations } : {}),
          source: source.source,
          version: source.version,
        };
      } catch (error) {
        return {
          status: 'error',
          word,
          message: safeErrorMessage(error),
          source: source.source,
          version: source.version,
        };
      }
    },
    credits: () => backend.credits(),
  };
}
