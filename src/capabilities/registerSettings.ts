/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 4A — register Settings as a real capability.
 * Declarative architecture only: no UI mount coupling, no behavior change
 * to SettingsModal.tsx.
 */

import { registerCapability, getCapability } from './registry';
import type { ChatAction } from './types';

const SETTINGS_CAPABILITY = {
  id: 'cap.settings',
  displayName: 'Settings',
  contractVersion: '1.0.0',
  implementationVersion: '1.0.0',
  chatActions: [{
    id: 'act.settings.open',
    purpose: 'Open AXON Settings',
    examples: ['open settings'],
    status: 'needs-screen',
    note: 'Settings is on the Settings screen; asking for it by chat is not yet implemented',
  }] as ChatAction[],
} as const;

/**
 * Register the Settings capability at app startup.
 * Call once — not from SettingsModal mount/unmount.
 */
export function registerSettingsCapability(): void {
  registerCapability({ ...SETTINGS_CAPABILITY });
  console.log(
    '[AXON capability registry] Settings registered:',
    getCapability('cap.settings')
  );
}
