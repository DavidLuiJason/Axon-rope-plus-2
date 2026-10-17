/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The roadmap size law (owner, 2026-10-16): docs/ROADMAP.md never exceeds 40,000 characters,
 * and the compression must never drop a law, a rule or the Standard Prompt Preamble.
 * The full history lives in docs/archive and is never required reading.
 */
import { readFileSync, existsSync } from 'node:fs';

const CAP = 40000;
const WARN = 38000;
const text = readFileSync('docs/ROADMAP.md', 'utf8');
let checks = 0;

function assert(condition: boolean, message: string): void {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${message}`);
}

assert(text.length <= CAP, `the roadmap holds ${text.length} characters; the cap is ${CAP}`);
if (text.length > WARN) console.log(`NOTE: the roadmap is above ${WARN} characters (${text.length}); compress before adding.`);

for (let n = 1; n <= 13; n += 1) {
  assert(text.includes(`**FL${n} `), `Foundation Law FL${n} is present`);
}
for (let n = 1; n <= 13; n += 1) {
  assert(text.includes(`${n}. **`), `Building Rule ${n} is present`);
}
const required = [
  'Before you do anything: read the AXON roadmap (all of it, not a part)',
  'Never add a fixed phrase list to the brain (FL13).',
  'Two-Strike Rule',
  'Foundation Check',
  'Top-View Check',
  'LAW CHECK',
  'SIZE LAW',
  'docs/archive/AXON_ROADMAP_V15_1.md',
  'Image | Video | Audio',
  'From picker and a To picker',
];
for (const phrase of required) assert(text.includes(phrase), `the roadmap still contains: ${phrase}`);
assert(existsSync('docs/archive/AXON_ROADMAP_V15_1.md'), 'the archive of the full v15.1 roadmap exists');

console.log(`=== roadmap size tests passed: ${checks} checks (${text.length} of ${CAP} characters) ===`);
