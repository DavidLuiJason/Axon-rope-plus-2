/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase C1 — declare the English dictionary as a chat-accessible capability.
 */

import { registerCapability } from './registry';

export function registerDictionaryCapability(): void {
  registerCapability({
    id: 'cap.english-dictionary',
    displayName: 'English Dictionary',
    contractVersion: '1.0.0',
    implementationVersion: '1.0.0',
    dataProvider: 'noUserData',
    chatActions: [{
      id: 'act.english-dictionary.lookup',
      purpose: 'Look up an English word or short phrase in the dictionary',
      examples: [
        'define bank',
        'what does bank mean',
        'meaning of bank',
        'definition of bank',
        'what is the meaning of bank',
        'what is the definition of bank',
      ],
      status: 'available',
      link: { providerId: 'english-dictionary' },
    }],
  });
}
