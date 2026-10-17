/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase C1 — declare planned Brain sources without claiming they are built.
 * The ids and labels mirror PLANNED_SOURCES; this module does not import Brain.
 */

import { registerCapability } from './registry';

const PLANNED_CAPABILITIES = [
  { id: 'api-keys', label: 'your API keys', purpose: 'your API keys' },
  { id: 'web-search', label: 'web search', purpose: 'web search' },
  { id: 'ai-apps', label: 'other AI apps and sites', purpose: 'other AI apps and sites' },
  { id: 'local-model', label: 'a local model', purpose: 'a local model' },
  { id: 'local-files', label: 'your local files', purpose: 'your local files' },
] as const;

export function registerPlannedCapabilities(): void {
  for (const planned of PLANNED_CAPABILITIES) {
    registerCapability({
      id: `cap.planned.${planned.id}`,
      displayName: planned.label,
      contractVersion: '1.0.0',
      implementationVersion: '0.0.0-planned',
      chatActions: [{
        id: `act.planned.${planned.id}`,
        purpose: planned.purpose,
        examples: [planned.label],
        status: 'not-built',
      }],
    });
  }
}
