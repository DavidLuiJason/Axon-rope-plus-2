/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B1 legacy-handler register and compatibility executor.
 */
import type { BrainProvider, BrainReply, BrainRequest } from '../types';

export interface LegacyEntry { providerId: string; retireAt: 'B4' | 'B5' | 'B6'; reason: string }

export const LEGACY_REGISTER: LegacyEntry[] = [
  { providerId: 'local-rules', retireAt: 'B4', reason: 'Existing command and registry matching remains active until concept resolution replaces it.' },
  { providerId: 'english-dictionary', retireAt: 'B4', reason: 'Existing dictionary phrase matching remains active until concept resolution replaces it.' },
  { providerId: 'local-rules', retireAt: 'B5', reason: 'Taught-meaning handling is part of local rules and remains until dialogue state replaces it.' },
  { providerId: 'foundation', retireAt: 'B6', reason: 'Honest fallback remains until planning and response stages replace it.' },
];

export function createLegacyExecutor(providers: BrainProvider[], fallback: BrainProvider): { run(request: BrainRequest): Promise<BrainReply> } {
  async function tryProvider(provider: BrainProvider, request: BrainRequest): Promise<BrainReply | null> {
    try { return await provider.handle(request); } catch { return null; }
  }
  return {
    async run(request: BrainRequest): Promise<BrainReply> {
      if (request.text.trim() !== '') {
        const holder = providers.find((provider) => provider.holdsConversation());
        if (holder) {
          const reply = await tryProvider(holder, request);
          if (reply) return reply;
        }
        for (const provider of providers) {
          const reply = await tryProvider(provider, request);
          if (reply) return reply;
        }
      }
      const last = await tryProvider(fallback, request);
      return last ?? { content: 'I could not produce an answer to that.', source: fallback.id };
    },
  };
}
