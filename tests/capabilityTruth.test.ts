/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase C1 — capability registry is the source of truth for chat abilities.
 */
import { registerCapability, listCapabilities, listChatActions, getCapability } from '../src/capabilities';
import type { ChatAction } from '../src/capabilities/types';
import { registerAxonToolsCapability } from '../src/capabilities/registerAxonTools';
import { registerSettingsCapability } from '../src/capabilities/registerSettings';
import { registerAxonSourceCapability } from '../src/capabilities/registerAxonSource';
import { registerInterfaceCaptureCapability } from '../src/capabilities/registerInterfaceCapture';
import { registerBackgroundProofCapability } from '../src/capabilities/registerBackgroundProof';
import { registerDictionaryCapability } from '../src/capabilities/registerDictionary';
import { registerPlannedCapabilities } from '../src/capabilities/registerPlanned';
import { registerTaughtMeaningsCapability } from '../src/capabilities/registerTaughtMeanings';
import { registerPlannedMediaCapabilities } from '../src/capabilities/registerPlannedMedia';
import { BRAIN_COMMANDS, BRAIN_PROVIDER_IDS } from '../src/brain';
import { answerAbilityQuestion, answerRequestFallback, describeAbilities } from '../src/brain/abilities';
import { PLANNED_SOURCES } from '../src/brain/brain';
import { LOCAL_RULE_IDS } from '../src/brain/localRules';
import { parseTeach } from '../src/brain/lexicon';
import { createDictionaryProvider } from '../src/brain/knowledge/dictionaryProvider';
import { getAxonEngine } from '../src/kernel/axonEngine';

let checks = 0;
function assert(condition: boolean, message: string): void {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  OK: ${message}`);
}

function main(): void {
  registerAxonToolsCapability();
  registerSettingsCapability();
  registerAxonSourceCapability();
  registerInterfaceCaptureCapability();
  registerBackgroundProofCapability();
  registerDictionaryCapability();
  registerPlannedCapabilities();
  registerTaughtMeaningsCapability();
  registerPlannedMediaCapabilities();

  const actions = listChatActions();
  const ids = actions.map(({ action }) => action.id);
  const kernelActions = getAxonEngine().listActions();
  const commandIds = new Set(BRAIN_COMMANDS.map((command) => command.id));
  const commandActionIds = new Map(BRAIN_COMMANDS.map((command) => [command.id, command.actionId]));
  const providerIds = new Set(BRAIN_PROVIDER_IDS);
  const kernelActionIds = new Set(kernelActions.map((action) => action.id));

  console.log('-- implementation links');
  for (const command of BRAIN_COMMANDS) {
    const registered = actions.find(({ action }) => action.link?.commandId === command.id);
    assert(registered !== undefined, `command ${command.id} has a registry action`);
    assert(registered?.action.link?.actionId === commandActionIds.get(command.id), `command ${command.id} links to its exact kernel action`);
  }
  for (const providerId of BRAIN_PROVIDER_IDS) {
    assert(actions.some(({ action }) => action.link?.providerId === providerId), `provider ${providerId} has a registry action`);
  }
  for (const kernelAction of kernelActions) {
    assert(actions.some(({ action }) => action.link?.actionId === kernelAction.id), `kernel action ${kernelAction.id} has a registry action`);
  }
  assert(createDictionaryProvider().id === BRAIN_PROVIDER_IDS[0], 'provider id comes from the real dictionary provider');
  for (const { action } of actions) {
    if (action.link?.commandId) assert(commandIds.has(action.link.commandId), `link command ${action.link.commandId} exists`);
    if (action.link?.providerId) assert(providerIds.has(action.link.providerId), `link provider ${action.link.providerId} exists`);
    if (action.link?.actionId) assert(kernelActionIds.has(action.link.actionId), `link kernel action ${action.link.actionId} exists`);
  }

  console.log('-- status/link truth rules');
  for (const { action } of actions) {
    if (action.status === 'available') assert(!!action.link, `available action ${action.id} has a link`);
    if (action.status === 'not-built') assert(!action.link, `not-built action ${action.id} has no link`);
    if (action.link?.ruleId) assert(LOCAL_RULE_IDS.includes(action.link.ruleId as typeof LOCAL_RULE_IDS[number]), `rule link ${action.link.ruleId} names a real local rule`);
  }
  for (const ruleId of LOCAL_RULE_IDS) {
    assert(actions.some(({ action }) => action.link?.ruleId === ruleId), `user-facing local rule ${ruleId} has a registry action`);
  }
  const textCounter = actions.find(({ action }) => action.id === 'act.text-counter')!.action;
  assert(textCounter.status === 'available', 'the registered Text Counter remains available');
  let mutatedTextCounterRejected = false;
  try {
    registerCapability({
      id: 'cap.test-text-counter-mutation',
      displayName: 'Text Counter Mutation',
      contractVersion: '1.0.0',
      implementationVersion: '0.0.0-test',
      chatActions: [{ ...textCounter, id: 'act.test-text-counter-mutation', status: 'not-built' }],
    });
  } catch (error) {
    mutatedTextCounterRejected = error instanceof Error && error.message.includes('not-built action must not have an implementation link');
  }
  assert(mutatedTextCounterRejected, 'marking a linked Text Counter action not-built fails the truth test');

  console.log('-- taught-meaning examples match the real parser');
  const taughtActions = actions.filter(({ capabilityId }) => capabilityId === 'cap.taught-meanings');
  for (const { action } of taughtActions) {
    for (const example of action.examples) {
      const parsed = parseTeach(example);
      assert(parsed !== null, `taught-meaning example is accepted by parseTeach: ${example}`);
      const expectedKind = action.link?.ruleId;
      assert(parsed?.kind === expectedKind, `example maps to its real rule id ${expectedKind}: ${example}`);
    }
  }

  console.log('-- planned media actions');
  const mediaIds = ['collage', 'video-download', 'picture-convert', 'text-to-speech', 'speech-to-text', 'ai-instructions'];
  for (const name of mediaIds) {
    const plannedMedia = actions.find(({ action }) => action.id === `act.planned.${name}`)?.action;
    assert(plannedMedia !== undefined && plannedMedia.status === 'not-built' && !plannedMedia.link, `planned media ${name} is registered as not-built with no link`);
  }

  console.log('-- planned actions and unique identities');
  for (const planned of PLANNED_SOURCES) {
    const action = actions.find(({ capabilityId }) => capabilityId === `cap.planned.${planned.id}`)?.action;
    assert(action !== undefined, `planned source ${planned.id} has an action`);
    assert(action?.id === `act.planned.${planned.id}` && action.status === 'not-built', `planned source ${planned.id} is honestly not built`);
  }
  assert(new Set(ids).size === ids.length, 'chat action ids are unique across the entire registry');

  console.log('-- registry-backed description');
  const description = describeAbilities({ lexiconExists: true });
  for (const { action } of actions.filter(({ action }) => action.status === 'available' || action.status === 'not-built')) {
    assert(description.includes(action.purpose), `description includes registered purpose: ${action.purpose}`);
  }
  for (const { action } of actions) {
    assert(description.includes(action.purpose), `description only describes registered action purpose: ${action.purpose}`);
  }
  assert(description.startsWith('Here is what I can run right now:'), 'description keeps the established opening');
  assert(description.includes('Not connected yet:') && description.includes('I will not guess at anything I cannot do.'), 'description keeps the honest disconnected wording');
  assert(!/Not connected yet:.*-\s/m.test(description), 'not-connected wording is a normal sentence without leading dashes');
  assert(description.includes('Teach AXON what a word or phrase means') && !description.includes('You can teach me words:'), 'taught meanings are listed through the registry instead of a separate hint');
  assert(description.endsWith('Source: AXON capability registry.'), 'description names the capability registry as its source');
  assert(description.includes('Background Proof: proof only') && description.includes('Interface Capture: shell only'), 'description explains the two capabilities without chat actions');
  for (const purpose of [
    'Make a collage from pictures with a style choice',
    'Download a video from a pasted link',
    'Turn a picture into a table (CSV) or code (SVG)',
    'Turn text into speech with a voice choice',
    'Turn speech or audio into text',
    'Write exact, unambiguous instructions for another AI tool',
  ]) assert(description.includes(purpose), `description names planned media truthfully: ${purpose}`);

  console.log('-- questions do not steal dictionary requests');
  assert(answerAbilityQuestion('define the word bank') === null, 'dictionary phrase "define the word bank" is not an ability question');
  assert(answerAbilityQuestion('define bank') === null, 'dictionary phrase "define bank" is not an ability question');
  const unknown = answerAbilityQuestion('can you make a collage?');
  assert(unknown === 'Not built yet: Make a collage from pictures with a style choice.', 'the registered planned collage request is honestly marked not built');
  assert(answerAbilityQuestion('could you remember that tally means count') === null, 'teach requests are not mistaken for ability questions');
  assert(answerAbilityQuestion('could you count this random thing')?.includes('nothing registered') === true, 'less than half of request content words does not match an action');
  assert(answerRequestFallback('can you count words in hello brave new world') === 'That sounds like: Count text. Try: "count words in hello brave new world".', 'fallback identifies an available action with the prescribed wording');
  assert(answerRequestFallback('can you open settings').startsWith('This needs a screen: Open AXON Settings.') && answerRequestFallback('can you open settings').includes('asking for it by chat is not yet implemented'), 'fallback reports needs-screen status and its note');
  assert(answerRequestFallback('could you make a collage?') === 'Not built yet: Make a collage from pictures with a style choice.', 'fallback reports not-built status');
  assert(answerRequestFallback('please teleport a moon') === 'I do not have a way to do that, and I will not guess. Ask me "what can you do" to see everything I have registered.', 'fallback gives the prescribed honest no-match answer');
  assert(answerRequestFallback('could you remember that tally means count').startsWith('I do not have a way to do that'), 'fallback does not reinterpret a teach request as an action');

  console.log('-- adding an action changes the answer without changing abilities.ts');
  const dummyAction: ChatAction = {
    id: 'act.test-pattern',
    purpose: 'Make a kaleidoscope pattern from supplied images',
    examples: ['make a kaleidoscope pattern'],
    status: 'not-built',
    inputs: [{ name: 'style', kind: 'choice', choices: ['grid', 'mosaic'] }],
  };
  registerCapability({
    id: 'cap.test-pattern',
    displayName: 'Test Pattern',
    contractVersion: '1.0.0',
    implementationVersion: '0.0.0-test',
    chatActions: [dummyAction],
  });
  const afterRegistration = answerAbilityQuestion('can you make a kaleidoscope pattern?');
  assert(afterRegistration === 'Not built yet: Make a kaleidoscope pattern from supplied images.', 'a registry-only dummy action changes the answer to Not built yet');
  assert(getCapability('cap.test-pattern') !== undefined && listCapabilities().some((capability) => capability.id === 'cap.test-pattern'), 'the dummy capability is registered');
  dummyAction.examples[0] = 'mutated source example';
  dummyAction.inputs![0].choices![0] = 'mutated source choice';
  const copiedDummy = listChatActions().find(({ action }) => action.id === 'act.test-pattern')?.action;
  assert(copiedDummy?.examples[0] === 'make a kaleidoscope pattern' && copiedDummy.inputs?.[0].choices?.[0] === 'grid', 'registration deep-copies examples and nested input choices');

  console.log('-- registry copies and validation');
  const dictionary = getCapability('cap.english-dictionary');
  if (dictionary?.chatActions?.[0]) {
    dictionary.chatActions[0].examples[0] = 'mutated caller copy';
  }
  assert(listChatActions().find(({ capabilityId }) => capabilityId === 'cap.english-dictionary')?.action.examples[0] === 'define bank', 'nested registry data cannot be mutated by callers');
  let duplicateRejected = false;
  try {
    registerCapability({
      id: 'cap.duplicate-test',
      displayName: 'Duplicate Test',
      contractVersion: '1.0.0',
      implementationVersion: '1.0.0',
      chatActions: [{ id: 'act.text-counter', purpose: 'duplicate', examples: ['duplicate'], status: 'available', link: { ruleId: 'duplicate-test' } }],
    });
  } catch (error) {
    duplicateRejected = error instanceof Error && error.message.includes('duplicate chat action id: act.text-counter');
  }
  assert(duplicateRejected, 'duplicate action ids fail with a clear registry error');
  let availableWithoutLinkRejected = false;
  try {
    registerCapability({
      id: 'cap.invalid-available',
      displayName: 'Invalid Available',
      contractVersion: '1.0.0',
      implementationVersion: '1.0.0',
      chatActions: [{ id: 'act.invalid-available', purpose: 'invalid', examples: ['invalid'], status: 'available' }],
    });
  } catch (error) {
    availableWithoutLinkRejected = error instanceof Error && error.message.includes('available action must have an implementation link');
  }
  assert(availableWithoutLinkRejected, 'available action without a link is rejected clearly');
  let notBuiltWithLinkRejected = false;
  try {
    registerCapability({
      id: 'cap.invalid-not-built',
      displayName: 'Invalid Not Built',
      contractVersion: '1.0.0',
      implementationVersion: '1.0.0',
      chatActions: [{ id: 'act.invalid-not-built', purpose: 'invalid', examples: ['invalid'], status: 'not-built', link: { ruleId: 'test' } }],
    });
  } catch (error) {
    notBuiltWithLinkRejected = error instanceof Error && error.message.includes('not-built action must not have an implementation link');
  }
  assert(notBuiltWithLinkRejected, 'not-built action with a link is rejected clearly');

  console.log(`=== capability truth tests passed: ${checks} checks ===`);
}

main();
