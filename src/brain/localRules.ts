/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local rules: the first source of the Brain. Deterministic commands that run
 * as real tasks on the execution kernel, follow-up questions for missing
 * inputs, and an honest "what can you do" answer built from what is registered.
 * Language memory (stage LM1): when a lexicon is given, the owner can teach
 * meanings ("remember that tally means count"), list them and forget them, and
 * a message the matcher cannot read is read a second time with the meanings
 * applied. A meaning never changes the text to be counted.
 */

import type { TaskEngine } from '../kernel/taskEngine';
import type { PlannedSource } from './types';
import { createMatcher, RUN_AT } from './matcher';
import type { Reading } from './matcher';
import { applyMeanings, parseTeach } from './lexicon';
import type { TeachRequest, UserLexicon } from './lexicon';
import type { BrainProvider, BrainReply, BrainRequest, CommandDef } from './types';
import { CANCEL_WORDS } from './followUpWords';

/** Stable ids for the user-facing teaching rules implemented by parseTeach. */
export const LOCAL_RULE_IDS = ['teach', 'list', 'forget', 'forget-all'] as const;

/** How long a follow-up question stays open. */
export const PENDING_TTL_MS = 120_000;

const YES_WORDS = new Set(['yes', 'y', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'correct', 'do it']);
const HELP = /^(?:help|what can you do|what do you do|what tools do you have|what commands (?:do you have|can i use))\s*[?.!]*$/i;

interface Suggestion {
  command: CommandDef;
  input: Record<string, unknown>;
  ask?: { field: string; question: string };
  note?: string;
  askedAt: number;
}

interface Pending {
  command: CommandDef;
  input: Record<string, unknown>;
  field: string;
  askedAt: number;
}

export interface LocalRulesOptions {
  commands: CommandDef[];
  engine: TaskEngine;
  planned: PlannedSource[];
  now?: () => number;
  /** Built-in and taught meanings. Without it AXON reads messages exactly as written. */
  lexicon?: UserLexicon;
  /** Optional registry-backed self-description and ability-question handler. */
  abilities?: { describe(): string; answer(text: string): string | null };
}

export function createLocalRules(options: LocalRulesOptions): BrainProvider & {
  abilities(): string[];
  reset(): void;
} {
  const { commands, engine, planned, lexicon } = options;
  const now = options.now ?? Date.now;
  const matcher = createMatcher(commands);
  let pending: Pending | null = null;
  let suggestion: Suggestion | null = null;

  const SOURCE = 'local-rules';

  function reply(content: string, taskId?: string): BrainReply {
    return { content, source: SOURCE, ...(taskId ? { taskId } : {}) };
  }

  function isOpen(): boolean {
    return pending !== null && now() - pending.askedAt <= PENDING_TTL_MS;
  }

  function suggestionOpen(): boolean {
    return suggestion !== null && now() - suggestion.askedAt <= PENDING_TTL_MS;
  }

  function abilities(): string[] {
    return commands.map((c) => c.title);
  }

  function teachNote(used: Array<{ from: string; to: string }>): string {
    const parts = used.map((m) => `"${m.from}" = "${m.to}"`).join(', ');
    return `Meaning used: ${parts}.`;
  }

  function readWithMeanings(text: string): (Reading & { note: string }) | null {
    if (!lexicon) return null;
    const { text: rewritten, used } = applyMeanings(text, lexicon.meanings());
    if (used.length === 0) return null;
    const reading = matcher.find(rewritten);
    if (!reading) return null;
    // A meaning must never alter the text being counted.
    const payload = reading.input.text;
    if (typeof payload === 'string' && !text.includes(payload)) return null;
    return { ...reading, note: teachNote(used) };
  }

  function handleTeach(request: TeachRequest): BrainReply {
    if (!lexicon) return reply('I cannot keep taught meanings in this build.');
    if (request.kind === 'teach') {
      const result = lexicon.teach(request.from, request.to);
      if (!result.ok) return reply(`I did not save that. ${result.reason}`);
      const changed = result.replaced !== null && result.replaced !== result.to;
      return reply(
        `${changed ? 'Updated' : 'Saved'}. When you say "${result.from}" I will read it as "${result.to}". ` +
          `This stays on this phone as your own data. It only helps if "${result.to}" is something I already understand; ` +
          `it cannot give me a tool I do not have. Say "what have I taught you" to see your list or "forget ${result.from}" to remove it.`
      );
    }
    if (request.kind === 'list') {
      const mine = lexicon.taught();
      if (mine.length === 0) {
        return reply('You have not taught me anything yet. Try: "remember that tally means count".');
      }
      const lines = mine.map((m, i) => `${i + 1}. "${m.from}" means "${m.to}"`);
      return reply(`Here is what you taught me:\n\n${lines.join('\n')}`);
    }
    if (request.kind === 'forget-all') {
      const n = lexicon.forgetAll();
      return reply(n === 0 ? 'You had not taught me anything, so nothing was removed.' : `Done. I forgot all ${n} thing${n === 1 ? '' : 's'} you taught me. My built-in meanings are untouched.`);
    }
    if (lexicon.forget(request.from)) return reply(`Done. I forgot "${request.from}".`);
    return reply(
      lexicon.isBuiltIn(request.from)
        ? `"${request.from}" is one of my built-in meanings, not something you taught me, so I cannot remove it.`
        : `You have not taught me "${request.from}", so there was nothing to forget.`
    );
  }

  function helpReply(): BrainReply {
    if (options.abilities) return reply(options.abilities.describe());
    const lines = commands.map(
      (c, i) => `${i + 1}. ${c.title}. Try: "${c.examples[0]}".`
    );
    const notConnected = planned.map((p) => p.label).join(', ');
    return reply(
      `Here is what I can run right now:\n\n${lines.join('\n')}\n\n` +
        `Not connected yet: ${notConnected}. ` +
        `I will not guess at anything I cannot do.` +
        (lexicon ? '\n\nYou can teach me words: say "remember that tally means count".' : '')
    );
  }

  async function run(
    command: CommandDef,
    input: Record<string, unknown>,
    flexible = false,
    note?: string
  ): Promise<BrainReply> {
    const submitted = await engine.submit(command.actionId, input);
    if (!submitted.ok) {
      const why =
        submitted.reason === 'insufficient-resources'
          ? `This device cannot do that right now: ${(submitted.blockers ?? []).join('; ')}.`
          : `I could not start that (${submitted.reason}).`;
      return reply(why);
    }
    const done = await engine.whenDone(submitted.task.id);
    if (done.state !== 'COMPLETED') {
      return reply(
        `That did not finish. Task ${done.id} ended ${done.state}${done.error ? `: ${done.error}` : ''}.`,
        done.id
      );
    }
    const ms =
      done.startedAt !== undefined && done.endedAt !== undefined
        ? Math.max(0, done.endedAt - done.startedAt)
        : 0;
    return reply(
      `${command.describe(done.output, input)}\n\nRan as task ${done.id}: ${done.state} in ${ms} ms, ` +
        `from your exact input.` +
        (flexible ? '\nUnderstood by: flexible local matcher (Tier 1, offline, no model).' : '') +
        (note ? `\n${note}` : ''),
      done.id
    );
  }

  return {
    id: SOURCE,
    label: 'AXON local rules',

    status() {
      return {
        id: SOURCE,
        label: 'AXON local rules',
        ready: true,
        note: `${commands.length} command${commands.length === 1 ? '' : 's'} registered`,
      };
    },

    holdsConversation: () => isOpen() || suggestionOpen(),

    abilities,

    reset() {
      pending = null;
      suggestion = null;
    },

    async handle(request: BrainRequest): Promise<BrainReply | null> {
      const text = request.text.trim();
      if (text === '') return null;
      const open = isOpen() ? pending : null;
      if (!open) pending = null;

      if (open && CANCEL_WORDS.has(text.toLowerCase())) {
        pending = null;
        return reply('Okay, cancelled. Nothing was run.');
      }

      if (HELP.test(text)) return helpReply();

      if (!open && lexicon) {
        const teach = parseTeach(text);
        if (teach) {
          suggestion = null;
          return handleTeach(teach);
        }
      }

      if (suggestion) {
        const offered = suggestionOpen() ? suggestion : null;
        suggestion = null;
        if (offered) {
          const lower = text.toLowerCase().replace(/[.!]+$/, '');
          if (YES_WORDS.has(lower)) {
            if (offered.ask) {
              pending = { command: offered.command, input: offered.input, field: offered.ask.field, askedAt: now() };
              return reply(offered.ask.question);
            }
            return run(offered.command, offered.input, true, offered.note);
          }
          if (CANCEL_WORDS.has(lower)) return reply('Okay, cancelled. Nothing was run.');
        }
      }

      for (const command of commands) {
        const match = command.match(text);
        if (!match) continue;
        if (match.ask) {
          pending = { command, input: match.input, field: match.ask.field, askedAt: now() };
          return reply(match.ask.question);
        }
        pending = null;
        return run(command, match.input);
      }

      if (open) {
        const input = open.command.fill(open.input, open.field, text);
        pending = null;
        return run(open.command, input);
      }

      const abilityAnswer = options.abilities?.answer(text);
      if (abilityAnswer !== null && abilityAnswer !== undefined) return reply(abilityAnswer);

      const plain = matcher.find(text);
      const taught = readWithMeanings(text);
      const reading: (Reading & { note?: string }) | null =
        taught && (!plain || taught.score > plain.score) ? taught : plain;
      if (reading) {
        if (reading.score >= RUN_AT) {
          if (reading.ask) {
            pending = { command: reading.command, input: reading.input, field: reading.ask.field, askedAt: now() };
            return reply(reading.ask.question);
          }
          return run(reading.command, reading.input, true, reading.note);
        }
        suggestion = { command: reading.command, input: reading.input, ask: reading.ask, note: reading.note, askedAt: now() };
        return reply(`Did you mean: ${reading.summary}? Say "yes" to go ahead or "no" to cancel. Nothing has been run.`);
      }

      return null;
    },
  };
}
