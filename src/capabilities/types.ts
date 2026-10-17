/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Capability contract — Stage 2
 *
 * A capability is an architectural unit declared in the registry. It is NOT
 * the same as a React component being mounted. Mounting a UI surface does
 * not register a capability; registration is an explicit function call only.
 */

/** The current chat-access status of a registered action. */
export type ChatActionStatus = 'available' | 'needs-screen' | 'needs-permission' | 'not-built';

/** An input a chat action may need before it can run. */
export interface ChatActionInput {
  name: string;
  kind: 'text' | 'choice' | 'file' | 'yes-no';
  choices?: string[];
  prompt?: string;
}

/** One user-facing action declared by a capability. */
export interface ChatAction {
  id: string;
  purpose: string;
  examples: string[];
  status: ChatActionStatus;
  inputs?: ChatActionInput[];
  link?: { commandId?: string; actionId?: string; providerId?: string; ruleId?: string };
  note?: string;
}

/**
 * Capability metadata contract.
 *
 * Required fields have named consumers: the registry (id lookup, listing)
 * and future Stage 4 screen migration (displayName, versions).
 */
export interface Capability {
  /**
   * Immutable capability identity. Must never equal `displayName`.
   * Example: "cap.test-example"
   */
  id: string;

  /**
   * Human-readable label. May change without changing `id`.
   */
  displayName: string;

  /**
   * Semver of the capability *metadata schema / API contract* this entry
   * conforms to (not the implementation build version).
   */
  contractVersion: string;

  /**
   * Semver of this capability's own implementation/build. Separate from
   * `contractVersion`.
   */
  implementationVersion: string;

  /**
   * ADVISORY ONLY — documentation of declared permission names.
   * No enforcement exists in this stage; do not treat as security control.
   */
  permissions?: string[];

  /**
   * ADVISORY ONLY — documentation of declared resource needs.
   * No enforcement exists in this stage; do not treat as a resource manager.
   */
  resourceNeeds?: string[];

  /**
   * ADVISORY ONLY — declares what user data this capability owns.
   * "noUserData" means it stores nothing of the user's. The Data Pack contract
   * (a later stage) will widen this; nothing enforces it yet.
   */
  dataProvider?: 'noUserData';

  /** Chat actions that truthfully describe this capability's user-facing work. */
  chatActions?: ChatAction[];

  /** Plain reason this capability has no chat action. */
  noChatAction?: string;
}
