/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B1 golden transcript: production wiring, fresh brain and lexicon per message.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createMind } from '../src/brain/mind';
import { createFoundation } from '../src/brain/foundation';
import { createUserLexicon, type KeyValueStore } from '../src/brain/lexicon';
import { createLocalRules } from '../src/brain/localRules';
import { createDictionaryProvider } from '../src/brain/knowledge/dictionaryProvider';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { Dictionary } from '../src/brain/dictionary';
import { TEXT_COUNT_COMMAND } from '../src/brain/textCountCommand';
import { PLANNED_SOURCES } from '../src/brain/brain';
import { createAxonEngine } from '../src/kernel/axonEngine';
import { answerAbilityQuestion, answerRequestFallback, describeAbilities } from '../src/brain/abilities';
import { registerSettingsCapability } from '../src/capabilities/registerSettings';
import { registerAxonToolsCapability } from '../src/capabilities/registerAxonTools';
import { registerAxonSourceCapability } from '../src/capabilities/registerAxonSource';
import { registerInterfaceCaptureCapability } from '../src/capabilities/registerInterfaceCapture';
import { registerBackgroundProofCapability } from '../src/capabilities/registerBackgroundProof';
import { registerDictionaryCapability } from '../src/capabilities/registerDictionary';
import { registerPlannedCapabilities } from '../src/capabilities/registerPlanned';
import { registerTaughtMeaningsCapability } from '../src/capabilities/registerTaughtMeanings';
import { registerPlannedMediaCapabilities } from '../src/capabilities/registerPlannedMedia';

interface Fixture { message: string; reply: Record<string, unknown> }
const DIR = process.env.DICT_DIR ?? './public/dictionary/en';
const fixedNow = () => 1700000000000;

registerSettingsCapability();
registerAxonToolsCapability();
registerAxonSourceCapability();
registerInterfaceCaptureCapability();
registerBackgroundProofCapability();
registerDictionaryCapability();
registerPlannedCapabilities();
registerTaughtMeaningsCapability();
registerPlannedMediaCapabilities();

function memory(): KeyValueStore {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
}

function createFreshBrain() {
  const localRules = createLocalRules({
    commands: [TEXT_COUNT_COMMAND],
    engine: createAxonEngine({ now: fixedNow }),
    planned: PLANNED_SOURCES,
    lexicon: createUserLexicon(memory(), fixedNow),
    now: fixedNow,
    abilities: { describe: () => describeAbilities({ lexiconExists: true }), answer: answerAbilityQuestion },
  });
  const slot = createDictionarySlot(async () => Dictionary.open({
    read: async (path: string) => readFile(join(DIR, path), 'utf8'),
    hash: (value: string) => createHash('sha256').update(value, 'utf8').digest('hex'),
  }));
  return createMind({
    providers: [localRules, createDictionaryProvider(slot)],
    fallback: createFoundation({ abilities: { answerRequestFallback } }),
    planned: PLANNED_SOURCES,
    now: fixedNow,
  });
}

function equal(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }

async function main(): Promise<void> {
  const fixture = JSON.parse(await readFile('tests/fixtures/brainGolden.json', 'utf8')) as Fixture[];
  let checks = 0;
  for (const item of fixture) {
    const reply = await createFreshBrain().ask({ text: item.message, place: 'chat' });
    const keys = [...new Set([...Object.keys(item.reply), ...Object.keys(reply)])].sort();
    for (const field of keys) {
      const expectedHas = Object.prototype.hasOwnProperty.call(item.reply, field);
      const actualHas = Object.prototype.hasOwnProperty.call(reply, field);
      if (expectedHas !== actualHas || !equal((item.reply as Record<string, unknown>)[field], (reply as unknown as Record<string, unknown>)[field])) {
        throw new Error(`Golden mismatch for message ${JSON.stringify(item.message)} at field ${field}: expected ${JSON.stringify((item.reply as Record<string, unknown>)[field])}, got ${JSON.stringify((reply as unknown as Record<string, unknown>)[field])}`);
      }
      checks++;
    }
  }
  console.log(`B1 brain golden transcript passed: ${fixture.length} messages, ${checks} field checks`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
