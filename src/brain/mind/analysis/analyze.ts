import { lemmaCandidates } from '../../dictionary/morphology';
import type { KnowledgeLookupResult, KnowledgeSlot } from '../../knowledge/slot';
import type { Segment, Token } from '../types';

export interface AnalysisOptions {
  maxLookups?: number;
  maxPhraseWords?: number;
}

export interface AnalysisMetrics {
  lookupCalls: number;
  cacheHits: number;
  budget: number;
  budgetExhausted: boolean;
  budgetUnits: number;
}

export interface AnalysisResult {
  tokens: Token[];
  metrics: AnalysisMetrics;
  ok: true;
}

export interface AnalysisFailure {
  ok: false;
  error: 'invalid-input' | 'knowledge-error';
}

export type AnalysisOutcome = AnalysisResult | AnalysisFailure;

interface Lexeme { surface: string; start: number; end: number; segmentIndex: number }

function codePointWidth(code: number): number { return code > 0xffff ? 2 : 1; }

function isLetterOrDigit(code: number): boolean {
  if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) return true;
  if (code < 128) return false;
  if (code === 0x00a0 || code === 0x1680 || code === 0x3000) return false;
  if ((code >= 0x2000 && code <= 0x206f) || (code >= 0x2190 && code <= 0x2bff) || (code >= 0x1f000 && code <= 0x1faff)) return false;
  if ((code >= 0xd800 && code <= 0xdfff) || (code >= 0xfe00 && code <= 0xfe0f)) return false;
  return true;
}

function isJoiner(code: number): boolean { return code === 39 || code === 0x2019 || code === 45 || code === 0x2010 || code === 0x2011; }

function tokenizeSegments(segments: Segment[]): Lexeme[] {
  const out: Lexeme[] = [];
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const segment = segments[segmentIndex];
    if (!segment || segment.kind !== 'language') continue;
    let i = 0;
    while (i < segment.text.length) {
      let code = segment.text.codePointAt(i) ?? 0;
      const width = codePointWidth(code);
      if (!isLetterOrDigit(code)) { i += width; continue; }
      const start = i;
      i += width;
      while (i < segment.text.length) {
        code = segment.text.codePointAt(i) ?? 0;
        const nextWidth = codePointWidth(code);
        if (isLetterOrDigit(code)) { i += nextWidth; continue; }
        if (isJoiner(code) && i + nextWidth < segment.text.length) {
          const after = segment.text.codePointAt(i + nextWidth) ?? 0;
          if (isLetterOrDigit(after)) { i += nextWidth; continue; }
        }
        break;
      }
      out.push({ surface: segment.text.slice(start, i), start: segment.start + start, end: segment.start + i, segmentIndex });
    }
  }
  return out;
}

function normalized(value: string): string { return value.normalize('NFC').toLowerCase(); }
function resultFound(result: KnowledgeLookupResult): result is Extract<KnowledgeLookupResult, { status: 'found' }> { return result.status === 'found'; }

export function createAnalyzer(slot: KnowledgeSlot, options: AnalysisOptions = {}) {
  // Until KnowledgeSlot reports physical reads, each distinct normalized lookup
  // key is the documented conservative budget unit (see needs.ts).
  const maxLookups = Number.isFinite(options.maxLookups) && (options.maxLookups ?? 0) >= 0 ? Math.floor(options.maxLookups ?? 64) : 64;
  const maxPhraseWords = Number.isFinite(options.maxPhraseWords) && (options.maxPhraseWords ?? 0) >= 2 ? Math.floor(options.maxPhraseWords ?? 5) : 5;

  return async function analyze(segments: Segment[]): Promise<AnalysisOutcome> {
    if (!Array.isArray(segments) || segments.some((segment) => !segment || typeof segment.text !== 'string' || (segment.kind !== 'language' && segment.kind !== 'material') || !Number.isInteger(segment.start) || !Number.isInteger(segment.end) || segment.start < 0 || segment.end < segment.start)) return { ok: false, error: 'invalid-input' };
    const lexemes = tokenizeSegments(segments);
    const tokens: Token[] = lexemes.map((item) => ({ surface: item.surface, lemma: item.surface, start: item.start, end: item.end, knowledge: 'not-checked' }));
    const cache = new Map<string, KnowledgeLookupResult>();
    const budgetKeys = new Set<string>();
    let lookupCalls = 0;
    let cacheHits = 0;
    let budgetExhausted = false;

    const lookup = async (query: string): Promise<KnowledgeLookupResult | null> => {
      const key = normalized(query);
      const cached = cache.get(key);
      if (cached) { cacheHits += 1; return cached; }
      if (!budgetKeys.has(key) && budgetKeys.size >= maxLookups) { budgetExhausted = true; return null; }
      budgetKeys.add(key);
      lookupCalls += 1;
      try {
        const value = await slot.lookup(query);
        cache.set(key, value);
        return value;
      } catch {
        return { status: 'error', word: query, message: 'knowledge lookup failed', source: 'knowledge slot', version: 'unknown' };
      }
    };

    const posOf = (found: Extract<KnowledgeLookupResult, { status: 'found' }>): string[] => [...new Set(found.senses.map((sense) => sense.partOfSpeech).filter((value): value is string => Boolean(value)))];

    try {
      // Pass 1: every surface word gets its direct dictionary lookup before any
      // morphology guesses or phrase windows can consume the message budget.
      const direct: Array<KnowledgeLookupResult | null> = [];
      for (let i = 0; i < lexemes.length; i += 1) {
        const item = lexemes[i];
        if (!item) { direct.push(null); continue; }
        const found = await lookup(item.surface);
        if (found?.status === 'error') return { ok: false, error: 'knowledge-error' };
        direct.push(found);
        if (found?.status === 'found') {
          const token = tokens[i];
          if (token) {
            token.lemma = found.word;
            token.knowledge = 'known';
            const pos = posOf(found);
            if (pos.length) token.partsOfSpeech = pos;
          }
        } else if (found && found.status === 'not-found') {
          const token = tokens[i];
          if (token) token.knowledge = 'unknown';
        }
      }

      // Pass 2: dictionary-backed morphology, including alternate verb lemma
      // evidence when an exact headword (e.g. the noun "running") also exists.
      for (let i = 0; i < lexemes.length; i += 1) {
        const item = lexemes[i];
        const token = tokens[i];
        const original = direct[i];
        if (!item || !token || !original || original.status === 'error') continue;
        const candidates = lemmaCandidates(item.surface);
        let primary: { base: string; via: 'irregular' | 'rule'; rule: string; pos: string } | undefined;
        const alternatives: string[] = [];
        for (const candidate of candidates) {
          const candidateResult = await lookup(candidate.base);
          if (candidateResult === null) break;
          if (candidateResult.status === 'error') return { ok: false, error: 'knowledge-error' };
          if (candidateResult.status !== 'found') continue;
          const isHeadword = candidateResult.word.toLowerCase() === candidate.base.toLowerCase();
          const hasCandidatePos = candidateResult.senses.some((sense) => sense.partOfSpeech.toLowerCase().startsWith(candidate.pos));
          if (!(isHeadword && hasCandidatePos) && !(original.status === 'found' && isHeadword && candidate.pos === 'v')) continue;
          if (original.status === 'not-found' && !primary) primary = { base: candidateResult.word, via: candidate.via, rule: candidate.rule, pos: candidate.pos };
          else if (original.status === 'found' && isHeadword && candidateResult.word.toLowerCase() !== original.word.toLowerCase() && !alternatives.some((value) => value.toLowerCase() === candidateResult.word.toLowerCase())) alternatives.push(candidateResult.word);
          if (primary && original.status === 'not-found') break;
        }
        if (primary) {
          token.lemma = primary.base;
          token.knowledge = 'known';
          token.morphology = { via: primary.via, rule: primary.rule };
          token.partsOfSpeech = [primary.pos];
        } else if (alternatives.length) token.alternativeLemmas = alternatives;
      }

      // Pass 3: phrases only after every surface word and its morphology have
      // had priority. Only attempt windows beginning with a known word.
      const phraseAt = new Map<number, { endToken: number; surface: string; lemma: string; pos?: string[] }>();
      for (let i = 0; i < lexemes.length; i += 1) {
        if (tokens[i]?.knowledge !== 'known') continue;
        const max = Math.min(maxPhraseWords, lexemes.length - i);
        for (let count = max; count >= 2; count -= 1) {
          let contiguous = true;
          for (let j = i + 1; j < i + count; j += 1) {
            if (lexemes[j]?.segmentIndex !== lexemes[i]?.segmentIndex) { contiguous = false; break; }
            const currentSegment = segments[lexemes[j]?.segmentIndex ?? 0];
            const between = currentSegment ? currentSegment.text.slice((lexemes[j - 1]?.end ?? currentSegment.start) - currentSegment.start, (lexemes[j]?.start ?? currentSegment.start) - currentSegment.start) : '';
            if (between && Array.from(between).some((ch) => isLetterOrDigit(ch.codePointAt(0) ?? 0))) { contiguous = false; break; }
          }
          if (!contiguous) continue;
          const words = lexemes.slice(i, i + count).map((x) => x.surface);
          const found = await lookup(words.join(' '));
          if (found === null) break;
          if (found.status === 'error') return { ok: false, error: 'knowledge-error' };
          if (resultFound(found)) {
            const pos = posOf(found);
            phraseAt.set(i, { endToken: i + count - 1, surface: words.join(' '), lemma: found.word, ...(pos.length ? { pos } : {}) });
            break;
          }
        }
      }
      for (const [i, phrase] of phraseAt) {
        const token = tokens[i];
        if (!token) continue;
        token.lemma = phrase.lemma;
        token.knowledge = 'known';
        token.entry = { surface: phrase.surface, start: lexemes[i]?.start ?? token.start, end: lexemes[phrase.endToken]?.end ?? token.end };
        if (phrase.pos) token.partsOfSpeech = phrase.pos;
      }
      // A not-found word stays unknown unless budget ended before morphology
      // could finish; words never directly looked up remain not-checked.
      for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];
        if (token?.knowledge === 'not-checked' && direct[i] === null && !budgetExhausted) token.knowledge = 'unknown';
      }
      return { ok: true, tokens, metrics: { lookupCalls, cacheHits, budget: maxLookups, budgetExhausted, budgetUnits: budgetKeys.size } };
    } catch {
      return { ok: false, error: 'knowledge-error' };
    }
  };
}
