/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 4B — register AXON Tools as a real capability.
 * Declarative architecture only: no UI mount coupling, no behavior change
 * to AxonToolsScreen.tsx.
 */

import { registerCapability, getCapability } from './registry';
import type { ChatAction } from './types';

const AXON_TOOLS_CAPABILITY = {
  id: 'cap.axon-tools',
  displayName: 'AXON Tools',
  contractVersion: '1.0.0',
  implementationVersion: '1.0.0',
  noChatAction: 'The Text Tools child capability owns the registered chat action.',
} as const;

/**
 * Text Tools: the text actions that run on the execution kernel (today: Text Counter).
 * Matches the kernel capability id "text-tools". Stores no user data.
 */
const TEXT_TOOLS_CAPABILITY = {
  id: 'cap.text-tools',
  displayName: 'Text Tools',
  contractVersion: '1.0.0',
  implementationVersion: '1.0.0',
  dataProvider: 'noUserData',
  chatActions: [{
    id: 'act.text-counter',
    purpose: 'Count text',
    examples: [
      'count words in hello brave new world',
      'how many characters are in good morning',
      'count lines',
    ],
    status: 'available',
    link: { commandId: 'text-count', actionId: 'text.count' },
  }] as ChatAction[],
} as const;

/**
 * Register the AXON Tools capability, and the Text Tools capability that lives
 * inside it, at app startup.
 * Call once — not from AxonToolsScreen mount/unmount.
 */
export function registerAxonToolsCapability(): void {
  registerCapability({ ...AXON_TOOLS_CAPABILITY });
  registerCapability({ ...TEXT_TOOLS_CAPABILITY });
  console.log(
    '[AXON capability registry] AXON Tools registered:',
    getCapability('cap.axon-tools')
  );
  console.log(
    '[AXON capability registry] Text Tools registered:',
    getCapability('cap.text-tools')
  );
}
