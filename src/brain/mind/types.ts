/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON Mind B1: typed structure for the staged brain pipeline.
 */
import type { BrainReply, Place } from '../types';

export type StageId = 'intake' | 'reading' | 'analysis' | 'meaning' | 'resolution' | 'dialogue' | 'planning' | 'execution' | 'verification' | 'response';
export type StageState = 'ran' | 'passed-through' | 'not-built';
export interface Utterance { id: string; text: string; place: Place; at: number }
export interface Segment { kind: 'language' | 'material'; text: string; start: number; end: number }
export interface Token {
  surface: string;
  lemma: string;
  alternativeLemmas?: string[];
  start: number;
  end: number;
  knowledge?: 'known' | 'unknown' | 'not-checked';
  partsOfSpeech?: string[];
  synsetIds?: string[];
  morphology?: { via: 'irregular' | 'rule'; rule: string };
  entry?: { surface: string; start: number; end: number };
}
export interface Analysis {
  segments: Segment[];
  tokens: Token[];
  metrics?: { lookupCalls: number; cacheHits: number; budget: number; budgetExhausted: boolean; budgetUnits?: number };
}
export type SpeechAct = 'unknown';
export interface Frame { act: SpeechAct; confidence: number }
export interface TraceEntry { stage: StageId; state: StageState; note: string }
export interface MindTrace { utterance: Utterance; entries: TraceEntry[] }
export interface MindContext { utterance: Utterance; analysis?: Analysis; frame?: Frame; reply?: BrainReply; entries: TraceEntry[] }
export interface MindStage { id: StageId; run(context: MindContext): Promise<MindContext> }
