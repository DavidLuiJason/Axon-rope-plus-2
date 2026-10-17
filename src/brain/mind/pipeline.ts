/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B1 staged Mind API, compatible with the existing Brain contract.
 */
import type { BrainProvider, BrainReply, BrainRequest, PlannedSource } from '../types';
import type { BrainSources } from '../brain';
import { PLANNED_SOURCES } from '../brain';
import { createLegacyExecutor } from './legacy';
import { createStages } from './stages';
import type { MindContext, MindTrace, Utterance } from './types';

export function createMind(options: { providers: BrainProvider[]; fallback: BrainProvider; planned?: PlannedSource[]; now?: () => number }) {
  const now = options.now ?? Date.now;
  let sequence = 0;
  const nextId = () => `utterance-${++sequence}`;
  const executor = createLegacyExecutor(options.providers, options.fallback);
  const stages = createStages(executor, now, nextId);

  async function askWithTrace(request: BrainRequest): Promise<{ reply: BrainReply; trace: MindTrace }> {
    const utterance: Utterance = { id: '', text: request.text, place: request.place, at: 0 };
    let context: MindContext = { utterance, entries: [] };
    for (const stage of stages) {
      try {
        context = await stage.run(context);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        context = { ...context, entries: [...context.entries, { stage: stage.id, state: 'not-built', note: `stage failed: ${message}` }] };
      }
    }
    const reply = context.reply ?? (await executor.run(request));
    return { reply, trace: { utterance: context.utterance, entries: context.entries } };
  }

  return {
    async ask(request: BrainRequest): Promise<BrainReply> { return (await askWithTrace(request)).reply; },
    sources(): BrainSources {
      return { connected: [...options.providers, options.fallback].map((provider) => provider.status()), planned: [...(options.planned ?? PLANNED_SOURCES)] };
    },
    askWithTrace,
  };
}

export type Mind = ReturnType<typeof createMind>;
