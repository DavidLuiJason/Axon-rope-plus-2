/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public entry for the capability system (Stage 2).
 */

export type { Capability, ChatAction, ChatActionInput, ChatActionStatus } from './types';
export {
  registerCapability,
  getCapability,
  listCapabilities,
  listChatActions,
  getRegistrySnapshot,
} from './registry';
