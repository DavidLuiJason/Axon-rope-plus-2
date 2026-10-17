/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase C2 — scripted chat turns for registered action inputs and choices.
 */

import { registerCapability } from '../src/capabilities';
import { createAskingProvider } from '../src/brain/asking';
import type { ActionDef } from '../src/kernel/types';

let checks = 0;
function assert(condition: boolean, message: string): void {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  OK: ${message}`);
}

const actionDefinition: Pick<ActionDef, 'inputFields'> = {
  inputFields: [
    { name: 'images', type: 'string', required: true, prompt: 'Which images should I use?' },
    { name: 'style', type: 'string', required: true, prompt: 'Choose a style.' },
    { name: 'size', type: 'string', required: true, prompt: 'What size should it be?' },
  ],
};

function provider(onComplete: (values: Record<string, unknown>) => void = () => {}) {
  return createAskingProvider({
    actionId: 'act.test.ask-choices',
    actionDefinition,
    onComplete,
  });
}

async function turn(p: ReturnType<typeof provider>, text: string) {
  const result = await p.handle({ text, place: 'chat' });
  assert(result !== null, `turn "${text}" is handled while a question is open`);
  return result!.content;
}

async function main() {
  registerCapability({
    id: 'cap.test.ask-choices',
    displayName: 'Ask Choices Test',
    contractVersion: '1.0.0',
    implementationVersion: '0.0.0-test',
    chatActions: [{
      id: 'act.test.ask-choices',
      purpose: 'Make a test collage',
      examples: ['make a test collage'],
      status: 'available',
      link: { ruleId: 'test-ask-choices' },
      inputs: [
        { name: 'images', kind: 'file', prompt: 'Which images should I use?' },
        { name: 'style', kind: 'choice', choices: ['grid', 'mosaic'], prompt: 'Choose a style.' },
        { name: 'size', kind: 'text', prompt: 'What size should it be?' },
      ],
    }],
  });

  registerCapability({
    id: 'cap.test.ask-yes-no',
    displayName: 'Ask Yes No Test',
    contractVersion: '1.0.0',
    implementationVersion: '0.0.0-test',
    chatActions: [{
      id: 'act.test.ask-yes-no',
      purpose: 'Confirm a test action',
      examples: ['confirm a test action'],
      status: 'available',
      link: { ruleId: 'test-ask-yes-no' },
      inputs: [{ name: 'confirm', kind: 'yes-no', prompt: 'Continue?' }],
    }],
  });

  console.log('-- yes-no answers');
  const yesNoResults: Record<string, unknown>[] = [];
  const yesNoDefinition: Pick<ActionDef, 'inputFields'> = {
    inputFields: [{ name: 'confirm', type: 'boolean', required: true, prompt: 'Continue?' }],
  };
  for (const [answer, expected] of [['yes', true], ['y', true], ['no', false], ['n', false]] as const) {
    const yesNo = createAskingProvider({
      actionId: 'act.test.ask-yes-no',
      actionDefinition: yesNoDefinition,
      onComplete: (values) => { yesNoResults.push(values); },
    });
    yesNo.begin();
    await yesNo.handle({ text: answer, place: 'chat' });
    assert(yesNoResults[yesNoResults.length - 1]?.confirm === expected, `yes-no answer "${answer}" is accepted`);
  }

  console.log('-- normal run and numbered choice');
  const completed: { current: Record<string, unknown> | null } = { current: null };
  const completedValues = (): Record<string, unknown> | null => completed.current;
  let p = provider((values) => { completed.current = values; });
  const first = p.begin();
  assert(first?.content === 'Which images should I use?' && p.holdsConversation(), 'begin asks for the first input and opens the conversation');
  const styleQuestion = await turn(p, 'photo-a.png');
  assert(styleQuestion.includes('1. grid') && styleQuestion.includes('2. mosaic'), 'choice question lists numbered options');
  await turn(p, '2');
  await turn(p, 'large');
  assert(!p.holdsConversation(), 'holdsConversation closes after all inputs are collected');
  assert(completedValues()?.images === 'photo-a.png' && completedValues()?.style === 'mosaic' && completedValues()?.size === 'large', 'numbered choice and values reach the callback');

  console.log('-- choice name, any case');
  completed.current = null;
  p = provider((values) => { completed.current = values; });
  p.begin();
  await turn(p, 'image-set');
  await turn(p, 'GRID');
  await turn(p, 'medium');
  assert(completedValues()?.style === 'grid', 'choice accepts the name case-insensitively');

  console.log('-- wrong answer repeats choices');
  p = provider();
  p.begin();
  await turn(p, 'image-set');
  const wrong = await turn(p, 'diagonal');
  assert(wrong.includes('I did not understand that answer.') && wrong.includes('1. grid') && wrong.includes('2. mosaic'), 'wrong choice repeats the question and choices');

  console.log('-- three wrong answers offer cancellation');
  p = provider();
  p.begin();
  await turn(p, 'image-set');
  await turn(p, 'invalid one');
  await turn(p, 'invalid two');
  const thirdWrong = await turn(p, 'invalid three');
  assert(thirdWrong.includes('You can also say "cancel"'), 'third consecutive wrong answer offers cancel');

  console.log('-- cancel in the middle');
  p = provider();
  p.begin();
  await turn(p, 'image-set');
  const cancelled = await turn(p, 'cancel');
  assert(cancelled === 'Okay, cancelled. Nothing was run.' && !p.holdsConversation(), 'cancel closes cleanly with one confirming line');
  assert(await p.handle({ text: 'grid', place: 'chat' }) === null, 'cancelled provider no longer handles messages');

  console.log('-- start over resets to the first input');
  completed.current = null;
  p = provider((values) => { completed.current = values; });
  p.begin();
  await turn(p, 'first-image');
  await turn(p, 'mosaic');
  const restarted = await turn(p, 'start over');
  assert(restarted.startsWith('Starting over. Which images should I use?'), 'start over returns to the first question');
  assert(Object.keys(p.values()).length === 0, 'start over clears collected values');
  await turn(p, 'second-image');
  await turn(p, '1');
  await turn(p, 'small');
  assert(completedValues()?.images === 'second-image' && completedValues()?.style === 'grid' && completedValues()?.size === 'small', 'run after restart uses only the new answers');

  console.log(`=== askChoices tests passed: ${checks} checks ===`);
}

main().catch((error) => {
  console.error(error);
  throw error;
});
