/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Language memory (stage LM1). Two layers that are kept apart on purpose:
 * 1. Built-in meanings: part of the AXON system. They ship with the app and
 *    belong to nobody.
 * 2. Taught meanings: the owner's own data. They live only in this phone's
 *    storage, never in the source code, and a copy of the app handed to
 *    someone else starts with none of them.
 * A meaning says "when this word or phrase appears, read it as that". It is
 * applied once (no chains), never inside double quotes, and only decides how
 * AXON reads an instruction; it cannot make AXON do something it has no tool for.
 */

export interface Meaning {
  from: string;
  to: string;
}

export interface TaughtMeaning extends Meaning {
  taughtAt: number;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const USER_LEXICON_KEY = 'axon.lexicon.user.v1';
export const MAX_USER_MEANINGS = 500;
export const MAX_FROM_LENGTH = 40;
export const MAX_TO_LENGTH = 80;

/** A small seed. The real dictionary is a later stage. */
export const BASE_MEANINGS: Meaning[] = [
  { from: 'tokens', to: 'words' },
  { from: 'symbols', to: 'characters' },
  { from: 'glyphs', to: 'characters' },
  { from: 'rows', to: 'lines' },
  { from: 'enumerate', to: 'count' },
  { from: 'work out', to: 'count' },
];

/** Words that steer a conversation. They may never be re-defined. */
const RESERVED = new Set(['yes', 'y', 'no', 'cancel', 'stop', 'help', 'ok', 'okay', 'nevermind']);

const QUOTE_PAIRS: Array<[string, string]> = [
  ['"', '"'],
  ['\u201c', '\u201d'],
  ['\u2018', '\u2019'],
  ["'", "'"],
];

export function normalizeTerm(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim().replace(/[.,;:!?]+$/, '').trim();
  for (let i = 0; i < 2; i += 1) {
    for (const [open, close] of QUOTE_PAIRS) {
      if (s.length >= 2 && s.startsWith(open) && s.endsWith(close)) s = s.slice(1, -1).trim();
    }
  }
  return s.replace(/[.,;:!?]+$/, '').trim();
}

export type Validated = { ok: true; from: string; to: string } | { ok: false; reason: string };

export function validateMeaning(fromRaw: string, toRaw: string): Validated {
  const from = normalizeTerm(fromRaw).toLowerCase();
  const to = normalizeTerm(toRaw);
  if (from === '' || to === '') return { ok: false, reason: 'I need both the word and what it means.' };
  if (from.length > MAX_FROM_LENGTH) return { ok: false, reason: `The word or phrase is too long (limit ${MAX_FROM_LENGTH} characters).` };
  if (to.length > MAX_TO_LENGTH) return { ok: false, reason: `The meaning is too long (limit ${MAX_TO_LENGTH} characters).` };
  if (!/^[\p{L}\p{N}][\p{L}\p{N}'\- ]*$/u.test(from) || from.split(' ').length > 4) {
    return { ok: false, reason: 'A taught word must be one to four plain words, with no symbols.' };
  }
  if (from === to.toLowerCase()) return { ok: false, reason: 'That word already means itself.' };
  if (RESERVED.has(from)) return { ok: false, reason: `"${from}" steers our conversation, so I will not redefine it.` };
  return { ok: true, from, to };
}

/** Built-in meanings first; a taught meaning for the same word replaces the built-in one. */
export function mergeMeanings(base: Meaning[], taught: Meaning[]): Meaning[] {
  const map = new Map<string, Meaning>();
  for (const m of base) map.set(m.from.toLowerCase(), { from: m.from.toLowerCase(), to: m.to });
  for (const m of taught) map.set(m.from.toLowerCase(), { from: m.from.toLowerCase(), to: m.to });
  return [...map.values()];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const QUOTED_SPAN = /"[^"]*"|\u201c[^\u201d]*\u201d/g;

/**
 * Rewrites the message once, outside double quotes, replacing whole words or
 * phrases (longest first). Returns the new text and which meanings were used.
 */
export function applyMeanings(message: string, meanings: Meaning[]): { text: string; used: Meaning[] } {
  if (meanings.length === 0) return { text: message, used: [] };
  const sorted = [...meanings].sort((a, b) => b.from.length - a.from.length);
  const byFrom = new Map(sorted.map((m) => [m.from.toLowerCase(), m]));
  const alternatives = sorted.map((m) => escapeRegExp(m.from).replace(/ /g, '\\s+')).join('|');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, 'giu');
  const used: Meaning[] = [];
  const rewrite = (part: string) =>
    part.replace(pattern, (hit) => {
      const m = byFrom.get(hit.toLowerCase().replace(/\s+/g, ' '));
      if (!m) return hit;
      if (!used.includes(m)) used.push(m);
      return m.to;
    });
  let out = '';
  let last = 0;
  for (const q of message.matchAll(QUOTED_SPAN)) {
    const at = q.index ?? 0;
    out += rewrite(message.slice(last, at)) + q[0];
    last = at + q[0].length;
  }
  out += rewrite(message.slice(last));
  return { text: out, used };
}

export type TeachRequest =
  | { kind: 'teach'; from: string; to: string }
  | { kind: 'list' }
  | { kind: 'forget'; from: string }
  | { kind: 'forget-all' };

const TEACH_A =
  /^(?:please\s+)?(?:remember|learn|note)(?:\s+that)?\s+(.+?)\s+(?:means|mean|stands\s+for|is\s+the\s+same\s+as|=)\s+(.+?)\s*[.!]*$/i;
const TEACH_B =
  /^(?:when|if)\s+i\s+(?:say|type|write)\s+(.+?)[,;]?\s+(?:i\s+mean|it\s+means|read\s+it\s+as|treat\s+it\s+as)\s+(.+?)\s*[.!]*$/i;
const TEACH_C = /^(?:please\s+)?define\s+(.+?)\s+as\s+(.+?)\s*[.!]*$/i;
const LIST_A = /^(?:what|which)(?:\s+\w+){0,2}\s+(?:have\s+i|did\s+i)\s+(?:taught|teach)(?:\s+you)?\s*[?.!]*$/i;
const LIST_B = /^(?:show|list)\s+(?:my\s+)?(?:taught\s+)?(?:meanings|words|vocabulary|dictionary)\s*[?.!]*$/i;
const FORGET_ALL = /^(?:please\s+)?forget\s+(?:everything|all)(?:\s+(?:that\s+)?(?:i(?:'ve)?\s+)?(?:taught|told)(?:\s+you)?)?\s*[.!]*$/i;
const FORGET = /^(?:please\s+)?forget\s+(?:the\s+(?:meaning|word)\s+(?:of\s+)?)?(.+?)\s*[.!]*$/i;
const NOT_A_TERM = new Set(['it', 'that', 'this', 'them', 'those']);

/** Recognises the owner teaching, listing or removing a meaning. Anything else is null. */
export function parseTeach(message: string): TeachRequest | null {
  const s = message.trim();
  if (s === '' || s.includes('\n')) return null;
  for (const re of [TEACH_A, TEACH_B, TEACH_C]) {
    const m = re.exec(s);
    if (m) return { kind: 'teach', from: m[1], to: m[2] };
  }
  if (LIST_A.test(s) || LIST_B.test(s)) return { kind: 'list' };
  if (FORGET_ALL.test(s)) return { kind: 'forget-all' };
  const f = FORGET.exec(s);
  if (f) {
    const term = normalizeTerm(f[1]).toLowerCase();
    if (term !== '' && !NOT_A_TERM.has(term)) return { kind: 'forget', from: term };
  }
  return null;
}

export type TeachResult =
  | { ok: true; from: string; to: string; replaced: string | null }
  | { ok: false; reason: string };

export interface UserLexicon {
  taught(): TaughtMeaning[];
  /** Built-in plus taught, ready for applyMeanings. */
  meanings(): Meaning[];
  isBuiltIn(from: string): boolean;
  teach(fromRaw: string, toRaw: string): TeachResult;
  forget(fromRaw: string): boolean;
  forgetAll(): number;
  exportJson(): string;
  importJson(json: string): { ok: boolean; added: number; reason?: string };
}

function parseEntries(raw: string | null): { entries: TaughtMeaning[]; corrupt: boolean } {
  if (raw === null) return { entries: [], corrupt: false };
  try {
    const data: unknown = JSON.parse(raw);
    const list = (data as { entries?: unknown } | null)?.entries;
    if (!Array.isArray(list)) return { entries: [], corrupt: true };
    const entries: TaughtMeaning[] = [];
    for (const e of list) {
      const rec = e as Partial<TaughtMeaning> | null;
      if (!rec || typeof rec.from !== 'string' || typeof rec.to !== 'string') continue;
      const v = validateMeaning(rec.from, rec.to);
      if (!v.ok) continue;
      if (entries.some((x) => x.from === v.from)) continue;
      entries.push({ from: v.from, to: v.to, taughtAt: typeof rec.taughtAt === 'number' ? rec.taughtAt : 0 });
    }
    return { entries, corrupt: false };
  } catch {
    return { entries: [], corrupt: true };
  }
}

/**
 * The owner's taught meanings. `store` is the phone's storage (null keeps them
 * in memory only). Storage failures never break AXON; unreadable stored data
 * is copied aside before anything is written over it.
 */
export function createUserLexicon(
  store: KeyValueStore | null,
  now: () => number = Date.now,
  base: Meaning[] = BASE_MEANINGS
): UserLexicon {
  let raw: string | null = null;
  try {
    raw = store ? store.getItem(USER_LEXICON_KEY) : null;
  } catch {
    raw = null;
  }
  const loaded = parseEntries(raw);
  let entries = loaded.entries;
  let quarantined = !loaded.corrupt;

  function save(): void {
    if (!store) return;
    try {
      if (!quarantined && raw !== null) {
        store.setItem(`${USER_LEXICON_KEY}.unreadable`, raw);
        quarantined = true;
      }
      store.setItem(USER_LEXICON_KEY, JSON.stringify({ schemaVersion: 1, entries }));
    } catch {
      // Storage full or blocked: the meanings stay in memory for this session.
    }
  }

  const lexicon: UserLexicon = {
    taught: () => entries.map((e) => ({ ...e })),
    meanings: () => mergeMeanings(base, entries),
    isBuiltIn: (from) => base.some((m) => m.from.toLowerCase() === normalizeTerm(from).toLowerCase()),
    teach(fromRaw, toRaw) {
      const v = validateMeaning(fromRaw, toRaw);
      if (!v.ok) return v;
      const at = entries.findIndex((e) => e.from === v.from);
      if (at < 0 && entries.length >= MAX_USER_MEANINGS) {
        return { ok: false, reason: `I can hold ${MAX_USER_MEANINGS} taught meanings. Forget one first.` };
      }
      const replaced = at >= 0 ? entries[at].to : null;
      const next: TaughtMeaning = { from: v.from, to: v.to, taughtAt: now() };
      entries = at >= 0 ? entries.map((e, i) => (i === at ? next : e)) : [...entries, next];
      save();
      return { ok: true, from: v.from, to: v.to, replaced };
    },
    forget(fromRaw) {
      const from = normalizeTerm(fromRaw).toLowerCase();
      const before = entries.length;
      entries = entries.filter((e) => e.from !== from);
      if (entries.length === before) return false;
      save();
      return true;
    },
    forgetAll() {
      const n = entries.length;
      if (n === 0) return 0;
      entries = [];
      save();
      return n;
    },
    exportJson: () => JSON.stringify({ schemaVersion: 1, kind: 'axon-taught-meanings', entries }, null, 2),
    importJson(json) {
      const parsed = parseEntries(json);
      if (parsed.corrupt) return { ok: false, added: 0, reason: 'That file is not AXON taught meanings.' };
      let added = 0;
      for (const e of parsed.entries) {
        const r = lexicon.teach(e.from, e.to);
        if (r.ok) added += 1;
      }
      return { ok: true, added };
    },
  };
  return lexicon;
}
