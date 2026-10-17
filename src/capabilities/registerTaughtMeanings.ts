/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase C2 — declare the real local taught-meaning rules in the capability registry.
 */

import { registerCapability } from './registry';

export function registerTaughtMeaningsCapability(): void {
  registerCapability({
    id: 'cap.taught-meanings',
    displayName: 'Taught Meanings',
    contractVersion: '1.0.0',
    implementationVersion: '1.0.0',
    chatActions: [
      {
        id: 'act.taught-meanings.teach',
        purpose: 'Teach AXON what a word or phrase means',
        examples: [
          'remember that tally means count',
          'learn that tokens means words',
          'define tally as count',
        ],
        status: 'available',
        link: { ruleId: 'teach' },
      },
      {
        id: 'act.taught-meanings.list',
        purpose: 'List the meanings you have taught AXON',
        examples: ['what have I taught you', 'show my taught meanings', 'list my words'],
        status: 'available',
        link: { ruleId: 'list' },
      },
      {
        id: 'act.taught-meanings.forget',
        purpose: 'Forget a meaning you taught AXON',
        examples: ['forget tally', 'forget the meaning of tally'],
        status: 'available',
        link: { ruleId: 'forget' },
      },
      {
        id: 'act.taught-meanings.forget-all',
        purpose: 'Forget all meanings you taught AXON',
        examples: ['forget everything I taught you', 'forget all'],
        status: 'available',
        link: { ruleId: 'forget-all' },
      },
    ],
  });
}
