/** AXON W1a: versioned, injected, bounded personal word book. */
export const WORD_BOOK_KEY = 'axon.wordbook.v1';
export const WORD_BOOK_SCHEMA_VERSION = 1;
export interface WordBookStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface HistoryItem { word: string; count: number; lastAt: number }
export interface WordBookData { schemaVersion: 1; history: HistoryItem[]; bookmarks: string[]; notes: Record<string, string> }
export type Result<T extends object = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string; recoveredKey?: string };
export interface WordBookOptions { storage?: WordBookStorage; clock?: () => number }
const empty = (): WordBookData => ({ schemaVersion: 1, history: [], bookmarks: [], notes: {} });
const memory = (): WordBookStorage => {
  const map = new Map<string, string>();
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); } };
};
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const normalize = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const w = v.trim().toLowerCase().normalize('NFC');
  return w && w.length <= 256 && !/[\u0000-\u001f\u007f]/u.test(w) ? w : null;
};
const length = (s: string) => Array.from(s).length;
function validate(v: unknown): WordBookData | null {
  if (!object(v) || v.schemaVersion !== 1 || !Array.isArray(v.history) || !Array.isArray(v.bookmarks) || !object(v.notes)) return null;
  if (v.history.length > 500 || v.bookmarks.length > 1000 || Object.keys(v.notes).length > 500) return null;
  const hs = new Set<string>();
  for (const h of v.history) {
    if (!object(h) || typeof h.word !== 'string' || normalize(h.word) !== h.word || hs.has(h.word) || !Number.isSafeInteger(h.count) || (h.count as number) < 1 || typeof h.lastAt !== 'number' || !Number.isFinite(h.lastAt)) return null;
    hs.add(h.word);
  }
  const bs = new Set<string>();
  for (const b of v.bookmarks) {
    if (typeof b !== 'string' || normalize(b) !== b || bs.has(b)) return null;
    bs.add(b);
  }
  // Entries, not `notes[k] = note`: a note on the word "__proto__" must stay data and survive a reload (assignment would set the prototype and lose it).
  const noteEntries: [string, string][] = [];
  for (const [k, note] of Object.entries(v.notes)) {
    if (normalize(k) !== k || typeof note !== 'string' || length(note) > 1000) return null;
    noteEntries.push([k, note]);
  }
  const notes = Object.fromEntries(noteEntries) as Record<string, string>;
  return { schemaVersion: 1, history: v.history.map(h => ({ word: h.word as string, count: h.count as number, lastAt: h.lastAt as number })), bookmarks: [...v.bookmarks], notes };
}
/** Future versions can be handled here, without silently interpreting their fields as v1. */
export function migrateWordBook(_value: unknown): WordBookData | null { return null; }
export function createWordBook(options: WordBookOptions = {}) {
  const storage = options.storage ?? memory();
  const clock = options.clock ?? (() => 0);
  let data = empty();
  let issue: { error: string; recoveredKey?: string } | null = null;
  try {
    const raw = storage.getItem(WORD_BOOK_KEY);
    if (raw !== null) {
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      const valid = validate(parsed) ?? migrateWordBook(parsed);
      if (valid) data = valid;
      else {
        const recoveredKey = `${WORD_BOOK_KEY}.recovery.${hash(raw)}`;
        try { storage.setItem(recoveredKey, raw); issue = { error: 'invalid-stored-data', recoveredKey }; }
        catch { issue = { error: 'recovery-write-failed' }; }
      }
    }
  } catch { issue = { error: 'storage-read-failed' }; }
  const status = (): Result => issue ? { ok: false, ...issue } : { ok: true };
  const persist = (next: WordBookData): Result => {
    try { storage.setItem(WORD_BOOK_KEY, JSON.stringify(next)); data = next; issue = null; return { ok: true }; }
    catch { return { ok: false, error: 'storage-write-failed' }; }
  };
  const word = (input: unknown) => normalize(input);
  return {
    status,
    recordLookup(input: unknown): Result<{ entry: HistoryItem }> {
      const w = word(input); if (!w) return { ok: false, error: 'invalid-word' };
      let at: number; try { at = clock(); } catch { return { ok: false, error: 'clock-failed' }; }
      if (!Number.isFinite(at)) return { ok: false, error: 'invalid-time' };
      const prior = data.history.find(h => h.word === w);
      if (prior && prior.count === Number.MAX_SAFE_INTEGER) return { ok: false, error: 'count-limit' };
      const entry = { word: w, count: (prior?.count ?? 0) + 1, lastAt: at };
      const history = [...data.history.filter(h => h.word !== w), entry].sort((a, b) => b.lastAt - a.lastAt).slice(0, 500);
      const result = persist({ ...data, history }); if (result.ok === false) return result; return { ok: true, entry: { ...entry } };
    },
    addBookmark(input: unknown): Result {
      const w = word(input); if (!w) return { ok: false, error: 'invalid-word' };
      if (data.bookmarks.includes(w)) return { ok: true };
      if (data.bookmarks.length >= 1000) return { ok: false, error: 'bookmark-limit' };
      return persist({ ...data, bookmarks: [...data.bookmarks, w] });
    },
    removeBookmark(input: unknown): Result { const w = word(input); return w ? persist({ ...data, bookmarks: data.bookmarks.filter(b => b !== w) }) : { ok: false, error: 'invalid-word' }; },
    isBookmarked(input: unknown): Result<{ value: boolean }> { const w = word(input); return w ? { ok: true, value: data.bookmarks.includes(w) } : { ok: false, error: 'invalid-word' }; },
    listBookmarks(): { ok: true; bookmarks: string[] } { return { ok: true, bookmarks: [...data.bookmarks] }; },
    setNote(input: unknown, note: unknown): Result {
      const w = word(input); if (!w) return { ok: false, error: 'invalid-word' };
      if (typeof note !== 'string') return { ok: false, error: 'invalid-note' };
      if (length(note) > 1000) return { ok: false, error: 'note-length-limit' };
      if (!own(data.notes, w) && Object.keys(data.notes).length >= 500) return { ok: false, error: 'note-limit' };
      return persist({ ...data, notes: { ...data.notes, [w]: note } });
    },
    getNote(input: unknown): Result<{ note: string | null }> { const w = word(input); return w ? { ok: true, note: own(data.notes, w) ? data.notes[w] : null } : { ok: false, error: 'invalid-word' }; },
    removeNote(input: unknown): Result { const w = word(input); if (!w) return { ok: false, error: 'invalid-word' }; const notes = { ...data.notes }; delete notes[w]; return persist({ ...data, notes }); },
    listHistory(): { ok: true; history: HistoryItem[] } { return { ok: true, history: data.history.map(h => ({ ...h })).sort((a, b) => b.lastAt - a.lastAt) }; },
    exportData(): Result<{ text: string }> { try { return { ok: true, text: JSON.stringify(data) }; } catch { return { ok: false, error: 'export-failed' }; } },
    importData(text: unknown): Result {
      if (typeof text !== 'string') return { ok: false, error: 'invalid-import' };
      try { const parsed: unknown = JSON.parse(text); const valid = validate(parsed); return valid ? persist(valid) : { ok: false, error: 'invalid-import' }; }
      catch { return { ok: false, error: 'invalid-import' }; }
    },
    eraseAll(): Result { try { storage.removeItem(WORD_BOOK_KEY); data = empty(); issue = null; return { ok: true }; } catch { return { ok: false, error: 'storage-remove-failed' }; } },
  };
}
function hash(s: string): string { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
