/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase C2 — a pure-TS follow-up provider for collecting registered action inputs.
 * This is deliberately not wired into the app router until C3.
 */

import { listChatActions } from '../capabilities';
import type { ChatAction, ChatActionInput } from '../capabilities/types';
import { followUpQuestions } from '../kernel/actionSchema';
import type { ActionDef, FieldSpec } from '../kernel/types';
import type { BrainProvider, BrainReply, BrainRequest } from './types';
import { CANCEL_WORDS } from './followUpWords';

export interface AskingProviderOptions {
  actionId: string;
  actionDefinition: Pick<ActionDef, 'inputFields'>;
  onComplete(values: Record<string, unknown>): void | Promise<void>;
}

function normalized(text: string): string {
  return text.trim().toLowerCase().replace(/[.!?]+$/, '').trim();
}

function choiceValue(input: ChatActionInput, text: string): string | null {
  const value = normalized(text);
  const choices = input.choices ?? [];
  const number = /^\d+$/.test(value) ? Number(value) : 0;
  if (number >= 1 && number <= choices.length) return choices[number - 1];
  return choices.find((choice) => choice.toLowerCase() === value) ?? null;
}

function parseAnswer(input: ChatActionInput, field: FieldSpec, text: string): { ok: true; value: unknown } | { ok: false } {
  if (input.kind === 'choice') {
    const choice = choiceValue(input, text);
    return choice === null ? { ok: false } : { ok: true, value: choice };
  }
  if (input.kind === 'yes-no' || field.type === 'boolean') {
    const value = normalized(text);
    if (['yes', 'y'].includes(value)) return { ok: true, value: true };
    if (['no', 'n'].includes(value)) return { ok: true, value: false };
    return { ok: false };
  }
  if (field.type === 'number') {
    const value = Number(text.trim());
    return Number.isFinite(value) && text.trim() !== ''
      ? { ok: true, value }
      : { ok: false };
  }
  const value = text.trim();
  return value ? { ok: true, value } : { ok: false };
}

export function createAskingProvider(options: AskingProviderOptions): BrainProvider & {
  begin(): BrainReply | null;
  reset(): void;
  values(): Record<string, unknown>;
} {
  const registered = listChatActions().find(({ action }) => action.id === options.actionId);
  const action: ChatAction | undefined = registered?.action;
  const fields = [...options.actionDefinition.inputFields];
  const inputByName = new Map((action?.inputs ?? []).map((input) => [input.name, input]));
  const questions = followUpQuestions({ inputFields: fields }, fields.map((field) => field.name));
  const fieldByName = new Map(fields.map((field) => [field.name, field]));
  let active = false;
  let index = 0;
  let wrongInRow = 0;
  let collected: Record<string, unknown> = {};

  function holdsConversation(): boolean {
    return active;
  }

  function reply(content: string): BrainReply {
    return { content, source: 'asking' };
  }

  function currentInput(): ChatActionInput | undefined {
    return action?.inputs?.find((input) => input.name === fields[index]?.name);
  }

  function question(): string {
    const field = fields[index];
    const input = currentInput();
    const prompt = input?.prompt ?? field?.prompt ?? questions[index] ?? `Please provide ${field?.name ?? 'the input'}.`;
    if (input?.kind !== 'choice') return prompt;
    return `${prompt}\n${(input.choices ?? []).map((choice, i) => `${i + 1}. ${choice}`).join('\n')}`;
  }

  function reset(): void {
    active = false;
    index = 0;
    wrongInRow = 0;
    collected = {};
  }

  return {
    id: 'asking',
    label: 'Action input questions',
    status() {
      return { id: 'asking', label: 'Action input questions', ready: true, note: 'C2 follow-up provider; not wired into the app' };
    },
    holdsConversation,
    begin(): BrainReply | null {
      if (!action || action.status !== 'available' || !action.inputs?.length || fields.length === 0) return null;
      if (fields.some((field) => !inputByName.has(field.name))) return null;
      if ((action.inputs ?? []).some((input) => !fieldByName.has(input.name))) return null;
      active = true;
      index = 0;
      wrongInRow = 0;
      collected = {};
      return reply(question());
    },
    values(): Record<string, unknown> {
      return { ...collected };
    },
    reset,
    async handle(request: BrainRequest): Promise<BrainReply | null> {
      if (!active) return null;
      const text = request.text.trim();
      const lower = normalized(text);
      if (lower === 'start over') {
        index = 0;
        wrongInRow = 0;
        collected = {};
        return reply(`Starting over. ${question()}`);
      }

      const field = fields[index];
      const input = currentInput();
      if (!field || !input) {
        reset();
        return reply('I could not continue because the registered action inputs did not match.');
      }

      const parsed = parseAnswer(input, field, text);
      const cancellationIsAValidAnswer =
        (input.kind === 'yes-no' && ['no', 'n'].includes(lower)) ||
        (input.kind === 'choice' && choiceValue(input, text) !== null);
      if (CANCEL_WORDS.has(lower) && !cancellationIsAValidAnswer) {
        reset();
        return reply('Okay, cancelled. Nothing was run.');
      }
      if (!parsed.ok) {
        wrongInRow += 1;
        const offer = wrongInRow >= 3 ? '\nYou can also say "cancel" to stop.' : '';
        return reply(`I did not understand that answer.\n${question()}${offer}`);
      }

      collected[field.name] = parsed.value;
      wrongInRow = 0;
      index += 1;
      if (index < fields.length) return reply(question());

      const result = { ...collected };
      active = false;
      await options.onComplete(result);
      return reply('All inputs are collected.');
    },
  };
}
