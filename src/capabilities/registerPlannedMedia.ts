/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase C2 — declare planned media and AI-instruction actions without claiming they exist.
 */

import { registerCapability } from './registry';

const PLANNED_MEDIA = [
  {
    name: 'collage',
    displayName: 'Picture Collage',
    purpose: 'Make a collage from pictures with a style choice',
  },
  {
    name: 'video-download',
    displayName: 'Video Download',
    purpose: 'Download a video from a pasted link',
  },
  {
    name: 'picture-convert',
    displayName: 'Picture Conversion',
    purpose: 'Turn a picture into a table (CSV) or code (SVG)',
  },
  {
    name: 'text-to-speech',
    displayName: 'Text to Speech',
    purpose: 'Turn text into speech with a voice choice',
  },
  {
    name: 'speech-to-text',
    displayName: 'Speech to Text',
    purpose: 'Turn speech or audio into text',
  },
  {
    name: 'ai-instructions',
    displayName: 'AI Tool Instructions',
    purpose: 'Write exact, unambiguous instructions for another AI tool',
  },
] as const;

export function registerPlannedMediaCapabilities(): void {
  for (const planned of PLANNED_MEDIA) {
    registerCapability({
      id: `cap.planned.${planned.name}`,
      displayName: planned.displayName,
      contractVersion: '1.0.0',
      implementationVersion: '0.0.0-planned',
      chatActions: [{
        id: `act.planned.${planned.name}`,
        purpose: planned.purpose,
        examples: [planned.purpose],
        status: 'not-built',
      }],
    });
  }
}
