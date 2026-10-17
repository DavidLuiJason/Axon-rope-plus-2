/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 4C — register AXON Source as a real capability.
 * Declarative architecture only: no UI mount coupling, no behavior change
 * to AxonSourceScreen.tsx or sourceService.ts.
 * Known open issue (out of scope): production fallback fakes file size/mtime.
 */

import { registerCapability, getCapability } from './registry';
import type { ChatAction } from './types';

const AXON_SOURCE_CAPABILITY = {
  id: 'cap.axon-source',
  displayName: 'AXON Source',
  contractVersion: '1.0.0',
  implementationVersion: '1.0.0',
  chatActions: [{
    id: 'act.axon-source.export',
    purpose: 'Export the AXON source project',
    examples: ['export the source'],
    status: 'needs-screen',
    note: 'export is on the Source screen; asking for it by chat is stage C3',
  }] as ChatAction[],
} as const;

/**
 * Register the AXON Source capability at app startup.
 * Call once — not from AxonSourceScreen mount/unmount.
 */
export function registerAxonSourceCapability(): void {
  registerCapability({ ...AXON_SOURCE_CAPABILITY });
  console.log(
    '[AXON capability registry] AXON Source registered:',
    getCapability('cap.axon-source')
  );
}
