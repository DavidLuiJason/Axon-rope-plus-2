/** Shapes of the converted English dictionary (written by convert_oewn.py and reshard_dictionary.py). */
export interface DictSense {
  synset: string;
  pos_tag: string;
  definition?: string;
  more_definitions?: string[];
  examples?: string[];
  synonyms?: string[];
}

export interface DictEntry {
  id: string;
  /** noun, verb, adjective, adverb */
  pos: string;
  /** n, v, a, s (adjective satellite), r */
  pos_tag: string;
  senses: DictSense[];
  pronunciations?: { text: string; variety: string | null }[];
  forms?: string[];
}

export type RelationMap = Record<string, string[]>;

export interface SenseRelations {
  relations?: RelationMap;
  sense_relations?: RelationMap;
}

/** How a word was found. Earlier values are stronger evidence. */
export type Via = 'exact' | 'case' | 'irregular' | 'form-index' | 'rule';

export interface Match {
  /** The dictionary headword that was found. */
  word: string;
  via: Via;
  /** The rule that produced the base form, for irregular and rule matches. */
  rule?: string;
  /** Parts of speech (n, v, a, r) the query could be, for irregular and rule matches. */
  pos?: string[];
  entries: DictEntry[];
}

export interface LookupResult {
  query: string;
  found: boolean;
  matches: Match[];
}

/** Reads one text file of the dictionary, for example "core/ab.json". Supplied by the app or a test. */
export type ReadText = (path: string) => Promise<string>;

export interface DictionaryOptions {
  read: ReadText;
  /** How many shard files stay in memory. Default 24. */
  cacheFiles?: number;
  /** When given, every file is checked against the manifest hash before use. Receives the exact text. */
  hash?: (text: string) => Promise<string> | string;
}

export interface DictionaryInfo {
  label: string;
  version: string;
  url: string;
  license: string;
  headwords: number;
  entries: number;
  senses: number;
  files: number;
}
