/**
 * English dictionary loader (DICT-C2).
 *
 * Reads the shard files written by reshard_dictionary.py through an injected reader,
 * so it works the same on the phone and in tests. Loads only the small file a lookup
 * needs, keeps the most recent files in memory, and can check every file by hash.
 * It refuses to open a dictionary whose ATTRIBUTION.txt is missing.
 */
import { MAX_KEY_DEPTH, keyOf } from './keys';
import { lemmaCandidates } from './morphology';
import type {
  DictEntry,
  DictionaryInfo,
  DictionaryOptions,
  LookupResult,
  Match,
  ReadText,
  SenseRelations,
  Via,
} from './types';

export class DictionaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DictionaryError';
  }
}

interface Manifest {
  version: number;
  source: { label?: string; version?: string; url?: string; license?: string };
  headwords: number;
  entries: number;
  senses: number;
  files: Record<string, { bytes: number; sha256: string }>;
}

interface CoreShard {
  data: Record<string, DictEntry[]>;
  /** lowercase word -> headwords that lowercase to it */
  lower: Map<string, string[]>;
}

type RelShard = Record<string, Array<Array<{ r?: Record<string, string[]>; s?: Record<string, string[]> } | 0>>>;

const DEFAULT_CACHE = 24;
const VIA_ORDER: Record<Via, number> = { exact: 0, case: 1, irregular: 2, 'form-index': 3, rule: 4 };

/** Own property only: a query such as "constructor" or "__proto__" must never reach Object.prototype. */
function own<V>(obj: Record<string, V>, key: string): V | undefined {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

function cleanQuery(q: string): string {
  return q.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Keeps the most recently used values; evicts the oldest. */
class Lru<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  get(k: string): V | undefined {
    const v = this.map.get(k);
    if (v !== undefined) { this.map.delete(k); this.map.set(k, v); }
    return v;
  }
  set(k: string, v: V): void {
    this.map.delete(k);
    this.map.set(k, v);
    while (this.map.size > this.max) {
      const first = this.map.keys().next();
      if (first.done) break;
      this.map.delete(first.value);
    }
  }
  delete(k: string): void { this.map.delete(k); }
}

export class Dictionary {
  private core: Lru<Promise<CoreShard>>;
  private rel: Lru<Promise<RelShard>>;
  private forms: Promise<Record<string, string[]>> | null = null;

  private constructor(
    private readonly read: ReadText,
    private readonly manifest: Manifest,
    private readonly leaves: Set<string>,
    private readonly hash: DictionaryOptions['hash'],
    cacheFiles: number,
  ) {
    this.core = new Lru(cacheFiles);
    this.rel = new Lru(Math.max(4, Math.floor(cacheFiles / 3)));
  }

  /** Opens the dictionary. Throws DictionaryError if the manifest, index or credits are missing or wrong. */
  static async open(options: DictionaryOptions): Promise<Dictionary> {
    const { read } = options;
    let manifest: Manifest;
    let leaves: string[];
    try {
      manifest = JSON.parse(await read('manifest.json')) as Manifest;
      const index = JSON.parse(await read('index.json')) as { version: number; leaves: string[] };
      if (manifest.version !== 1 || index.version !== 1) throw new DictionaryError('unsupported dictionary version');
      leaves = index.leaves;
    } catch (e) {
      if (e instanceof DictionaryError) throw e;
      throw new DictionaryError(`cannot open the dictionary: ${(e as Error).message}`);
    }
    try {
      const credit = await read('ATTRIBUTION.txt');
      if (!credit.includes('Princeton')) throw new Error('attribution text is incomplete');
    } catch (e) {
      throw new DictionaryError(`the dictionary is not opened without its credits: ${(e as Error).message}`);
    }
    const d = new Dictionary(read, manifest, new Set(leaves), options.hash, options.cacheFiles ?? DEFAULT_CACHE);
    if (options.hash) {
      const idx = await read('index.json');
      await d.check('index.json', idx);
    }
    return d;
  }

  info(): DictionaryInfo {
    const s = this.manifest.source;
    return {
      label: s.label ?? '', version: s.version ?? '', url: s.url ?? '', license: s.license ?? '',
      headwords: this.manifest.headwords, entries: this.manifest.entries, senses: this.manifest.senses,
      files: Object.keys(this.manifest.files).length,
    };
  }

  /** Sorted leaf metadata; callers receive an independent array. */
  leafKeys(): string[] {
    return [...this.leaves].sort();
  }

  /** Lists a verified leaf. Entries are read-only by contract; arrays are copies. */
  async headwordsOf(leaf: string): Promise<{ word: string; entries: DictEntry[] }[]> {
    if (!this.leaves.has(leaf)) throw new DictionaryError(`unknown leaf: ${leaf}`);
    const shard = await this.loadCore(leaf);
    return Object.keys(shard.data).sort().map((word) => ({ word, entries: [...shard.data[word]] }));
  }

  /** The credit text that must be shown in the app. */
  attribution(): Promise<string> {
    return this.read('ATTRIBUTION.txt');
  }

  private async check(path: string, text: string): Promise<void> {
    if (!this.hash) return;
    const want = this.manifest.files[path]?.sha256;
    if (!want) throw new DictionaryError(`file not listed in the manifest: ${path}`);
    const got = await this.hash(text);
    if (got !== want) throw new DictionaryError(`file failed its check: ${path}`);
  }

  /** The shard key a word lives in, or null if the index has none. */
  leafOf(word: string): string | null {
    for (let n = 1; n <= MAX_KEY_DEPTH; n += 1) {
      const k = keyOf(word, n);
      if (this.leaves.has(k)) return k;
    }
    return null;
  }

  private loadCore(leaf: string): Promise<CoreShard> {
    const cached = this.core.get(leaf);
    if (cached) return cached;
    const path = `core/${leaf}.json`;
    const p = (async () => {
      const text = await this.read(path);
      await this.check(path, text);
      const data = JSON.parse(text) as Record<string, DictEntry[]>;
      const lower = new Map<string, string[]>();
      for (const w of Object.keys(data)) {
        const l = w.toLowerCase();
        const list = lower.get(l);
        if (list) list.push(w); else lower.set(l, [w]);
      }
      return { data, lower };
    })();
    this.core.set(leaf, p);
    p.catch(() => this.core.delete(leaf));
    return p;
  }

  private async entriesFor(word: string): Promise<{ word: string; entries: DictEntry[] }[]> {
    const leaf = this.leafOf(word);
    if (!leaf) return [];
    const shard = await this.loadCore(leaf);
    const exact = own(shard.data, word);
    if (exact) return [{ word, entries: exact }];
    const variants = shard.lower.get(word.toLowerCase()) ?? [];
    return variants.map((w) => ({ word: w, entries: own(shard.data, w) ?? [] }));
  }

  /** True if the word (any capitalisation) is a headword. */
  async has(word: string): Promise<boolean> {
    return (await this.entriesFor(cleanQuery(word))).length > 0;
  }

  private loadForms(): Promise<Record<string, string[]>> {
    if (!this.forms) {
      this.forms = (async () => {
        const text = await this.read('forms.json');
        await this.check('forms.json', text);
        return JSON.parse(text) as Record<string, string[]>;
      })();
      this.forms.catch(() => { this.forms = null; });
    }
    return this.forms;
  }

  /**
   * Finds a word. Order of matches: the word itself (exact, then other capitalisation),
   * irregular forms, the dictionary's own form list, then suffix rules.
   * Every returned match really exists in the dictionary; nothing is guessed.
   */
  async lookup(query: string): Promise<LookupResult> {
    const q = cleanQuery(query);
    const result: LookupResult = { query: q, found: false, matches: [] };
    if (!q) return result;
    const matches: Match[] = [];
    const taken = new Set<string>();

    const direct = await this.entriesFor(q);
    for (const m of direct) {
      matches.push({ word: m.word, via: m.word === q ? 'exact' : 'case', entries: m.entries });
      taken.add(m.word);
    }

    // inflection is applied to the last word, so "African clawed frogs" finds "African clawed frog"
    const space = q.lastIndexOf(' ');
    const head = space >= 0 ? q.slice(0, space + 1) : '';
    const last = space >= 0 ? q.slice(space + 1) : q;

    const byBase = new Map<string, { via: Via; rule: string; pos: Set<string> }>();
    const addBase = (base: string, via: Via, rule: string, pos?: string) => {
      const prev = byBase.get(base);
      if (!prev) byBase.set(base, { via, rule, pos: new Set(pos ? [pos] : []) });
      else {
        if (pos) prev.pos.add(pos);
        if (VIA_ORDER[via] < VIA_ORDER[prev.via]) { prev.via = via; prev.rule = rule; }
      }
    };
    for (const c of lemmaCandidates(last)) addBase(head + c.base, c.via, c.rule, c.pos);
    const forms = await this.loadForms();
    for (const key of new Set([q, q.toLowerCase()])) {
      for (const h of own(forms, key) ?? []) addBase(h, 'form-index', 'listed alternate form');
    }

    const ordered = [...byBase.entries()].sort((a, b) => VIA_ORDER[a[1].via] - VIA_ORDER[b[1].via]);
    for (const [base, info] of ordered) {
      for (const m of await this.entriesFor(base)) {
        if (taken.has(m.word)) continue;
        let entries = m.entries;
        if (info.pos.size > 0) {
          entries = entries.filter((e) => info.pos.has(e.pos_tag === 's' ? 'a' : e.pos_tag));
          if (entries.length === 0) continue;
        }
        taken.add(m.word);
        matches.push({
          word: m.word, via: info.via, rule: info.rule, entries,
          ...(info.pos.size > 0 ? { pos: [...info.pos].sort() } : {}),
        });
      }
    }
    matches.sort((a, b) => VIA_ORDER[a.via] - VIA_ORDER[b.via]);
    result.matches = matches;
    result.found = matches.length > 0;
    return result;
  }

  /**
   * Word links for a headword, aligned to its entries and senses as returned by lookup
   * (entries in file order, senses in file order). Loads the small relations file on demand.
   */
  async relations(word: string): Promise<SenseRelations[][]> {
    const leaf = this.leafOf(word);
    if (!leaf) return [];
    const shard = await this.loadCore(leaf);
    const entries = own(shard.data, word);
    if (!entries) return [];
    let rel: RelShard = {};
    if (this.manifest.files[`rel/${leaf}.json`]) {
      let p = this.rel.get(leaf);
      if (!p) {
        const path = `rel/${leaf}.json`;
        p = (async () => {
          const text = await this.read(path);
          await this.check(path, text);
          return JSON.parse(text) as RelShard;
        })();
        this.rel.set(leaf, p);
        p.catch(() => this.rel.delete(leaf));
      }
      rel = await p;
    }
    const mine = own(rel, word);
    return entries.map((e, i) =>
      e.senses.map((_, j) => {
        const r = mine?.[i]?.[j];
        if (!r) return {};
        const out: SenseRelations = {};
        if (r.r) out.relations = r.r;
        if (r.s) out.sense_relations = r.s;
        return out;
      }),
    );
  }
}
