/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public B1 Mind surface.
 */
export { createMind, type Mind } from './pipeline';
export { LEGACY_REGISTER, createLegacyExecutor, type LegacyEntry } from './legacy';
export type { StageId, StageState, Utterance, Segment, Token, Analysis, SpeechAct, Frame, TraceEntry, MindTrace, MindContext, MindStage } from './types';
