/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B1 stage implementations. Understanding beyond placeholder structure is deferred.
 */
import type { BrainProvider, BrainRequest } from '../types';
import { maskCodeRegions } from '../symbols/protect';
import { classifySymbolRoles } from '../symbols/symbolRoles';
import type { MindContext, MindStage, Segment, StageId, StageState } from './types';
import { createLegacyExecutor } from './legacy';
import { dictionarySlot } from '../knowledge/dictionarySlot';
import { createAnalyzer } from './analysis/analyze';

function withEntry(context: MindContext, stage: StageId, state: StageState, note: string, patch: Partial<MindContext> = {}): MindContext {
  return { ...context, ...patch, entries: [...context.entries, { stage, state, note }] };
}

function makeSegments(text: string): { segments: Segment[]; note: string } {
  try {
    const protectedText = maskCodeRegions(text);
    if (protectedText.unsure) return { segments: [{ kind: 'language', text, start: 0, end: text.length }], note: 'code-region protection was unsure; treated as language' };
    const regions: Array<{ start: number; end: number; text: string }> = protectedText.regions.map((region) => ({ start: region.start, end: region.end, text: region.text }));
    const quoteStack: number[] = [];
    for (const mark of classifySymbolRoles(text)) {
      if (mark.role === 'quote_open') quoteStack.push(mark.index);
      else if (mark.role === 'quote_close' && quoteStack.length) {
        const start = quoteStack.pop()!;
        const end = mark.index + mark.symbol.length;
        regions.push({ start, end, text: text.slice(start, end) });
      }
    }
    regions.sort((a, b) => a.start - b.start || a.end - b.end);
    const material: Array<{ start: number; end: number; text: string }> = [];
    for (const region of regions) {
      const previous = material[material.length - 1];
      if (previous && region.start <= previous.end) {
        previous.end = Math.max(previous.end, region.end);
        previous.text = text.slice(previous.start, previous.end);
      } else material.push({ ...region });
    }
    if (!material.length) return { segments: [{ kind: 'language', text, start: 0, end: text.length }], note: 'existing protection found no material region' };
    const segments: Segment[] = [];
    let cursor = 0;
    for (const region of material) {
      if (region.start > cursor) segments.push({ kind: 'language', text: text.slice(cursor, region.start), start: cursor, end: region.start });
      segments.push({ kind: 'material', text: region.text, start: region.start, end: region.end });
      cursor = region.end;
    }
    if (cursor < text.length) segments.push({ kind: 'language', text: text.slice(cursor), start: cursor, end: text.length });
    return { segments, note: 'existing code and quote protection separated material' };
  } catch {
    return { segments: [{ kind: 'language', text, start: 0, end: text.length }], note: 'code-region protection unavailable; treated as language' };
  }
}

export function createStages(executor: ReturnType<typeof createLegacyExecutor>, now: () => number, nextId: () => string): MindStage[] {
  function intake(context: MindContext): MindContext {
    const utterance = { id: nextId(), text: context.utterance.text, place: context.utterance.place, at: now() };
    return withEntry(context, 'intake', 'ran', 'request captured', { utterance });
  }
  function reading(context: MindContext): MindContext {
    const read = makeSegments(context.utterance.text);
    return withEntry(context, 'reading', 'ran', read.note, { analysis: { segments: read.segments, tokens: [] } });
  }
  async function analysis(context: MindContext): Promise<MindContext> {
    const analyze = createAnalyzer(dictionarySlot, { maxLookups: 64, maxPhraseWords: 5 });
    const segments = context.analysis?.segments ?? [{ kind: 'language' as const, text: context.utterance.text, start: 0, end: context.utterance.text.length }];
    const result = await analyze(segments);
    if (!result.ok) return withEntry(context, 'analysis', 'ran', `analysis unavailable: ${result.error}`, { analysis: { segments, tokens: [] } });
    const note = `dictionary analysis; ${result.metrics.lookupCalls} lookups, ${result.metrics.cacheHits} cache hits${result.metrics.budgetExhausted ? ', budget exhausted' : ''}`;
    return withEntry(context, 'analysis', 'ran', note, { analysis: { segments, tokens: result.tokens, metrics: result.metrics } });
  }
  function meaning(context: MindContext): MindContext {
    return withEntry(context, 'meaning', 'not-built', 'not built: speech acts arrive in B3', { frame: { act: 'unknown', confidence: 0 } });
  }
  function resolution(context: MindContext): MindContext {
    return withEntry(context, 'resolution', 'not-built', 'not built: concept resolution arrives in B4');
  }
  function dialogue(context: MindContext): MindContext {
    return withEntry(context, 'dialogue', 'not-built', 'not built: dialogue state arrives in B5');
  }
  function planning(context: MindContext): MindContext {
    return withEntry(context, 'planning', 'not-built', 'not built: planning arrives in B6');
  }
  async function execution(context: MindContext): Promise<MindContext> {
    const request: BrainRequest = { text: context.utterance.text, place: context.utterance.place };
    const reply = await executor.run(request);
    return withEntry(context, 'execution', 'ran', 'legacy executor preserves current provider order and fallback', { reply });
  }
  function verification(context: MindContext): MindContext {
    return withEntry(context, 'verification', 'not-built', 'not built: verification arrives in B6');
  }
  function response(context: MindContext): MindContext {
    return withEntry(context, 'response', 'passed-through', 'B1 passes the legacy reply through unchanged');
  }
  return [
    { id: 'intake', run: async (context) => intake(context) },
    { id: 'reading', run: async (context) => reading(context) },
    { id: 'analysis', run: async (context) => analysis(context) },
    { id: 'meaning', run: async (context) => meaning(context) },
    { id: 'resolution', run: async (context) => resolution(context) },
    { id: 'dialogue', run: async (context) => dialogue(context) },
    { id: 'planning', run: async (context) => planning(context) },
    { id: 'execution', run: execution },
    { id: 'verification', run: async (context) => verification(context) },
    { id: 'response', run: async (context) => response(context) },
  ];
}
