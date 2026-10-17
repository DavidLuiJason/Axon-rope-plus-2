/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Capability registry — Stage 2
 *
 * Stores capability *metadata* only. No business logic, no React lifecycle
 * coupling. Registration is always an explicit `registerCapability` call —
 * never automatic discovery and never implied by component mount/unmount.
 */

import type { Capability, ChatAction, ChatActionInput } from './types';

const byId = new Map<string, Capability>();

function copyInput(input: ChatActionInput): ChatActionInput {
  return { ...input, ...(input.choices ? { choices: [...input.choices] } : {}) };
}

function copyAction(action: ChatAction): ChatAction {
  return {
    ...action,
    examples: [...action.examples],
    ...(action.inputs ? { inputs: action.inputs.map(copyInput) } : {}),
    ...(action.link ? { link: { ...action.link } } : {}),
  };
}

function copyCapability(capability: Capability): Capability {
  return {
    ...capability,
    ...(capability.permissions ? { permissions: [...capability.permissions] } : {}),
    ...(capability.resourceNeeds ? { resourceNeeds: [...capability.resourceNeeds] } : {}),
    ...(capability.chatActions ? { chatActions: capability.chatActions.map(copyAction) } : {}),
  };
}

function assertValidMetadata(meta: Capability): void {
  if (!meta.id || typeof meta.id !== 'string') {
    throw new Error('[AXON capability registry] id is required and must be a non-empty string');
  }
  if (!meta.displayName || typeof meta.displayName !== 'string') {
    throw new Error(
      `[AXON capability registry] displayName is required (id=${meta.id})`
    );
  }
  if (meta.id === meta.displayName) {
    throw new Error(
      `[AXON capability registry] id must never equal displayName (got "${meta.id}")`
    );
  }
  if (!meta.contractVersion || typeof meta.contractVersion !== 'string') {
    throw new Error(
      `[AXON capability registry] contractVersion is required (id=${meta.id})`
    );
  }
  if (!meta.implementationVersion || typeof meta.implementationVersion !== 'string') {
    throw new Error(
      `[AXON capability registry] implementationVersion is required (id=${meta.id})`
    );
  }
  if (meta.chatActions !== undefined) {
    const localIds = new Set<string>();
    for (const action of meta.chatActions) {
      if (typeof action.id !== 'string' || action.id.trim() === '') {
        throw new Error(`[AXON capability registry] chat action id must be non-empty (capability=${meta.id})`);
      }
      if (typeof action.purpose !== 'string' || action.purpose.trim() === '') {
        throw new Error(`[AXON capability registry] chat action purpose must be non-empty (action=${action.id})`);
      }
      if (!Array.isArray(action.examples) || action.examples.length === 0 ||
          action.examples.some((example) => typeof example !== 'string' || example.trim() === '')) {
        throw new Error(`[AXON capability registry] chat action needs at least one non-empty example (action=${action.id})`);
      }
      if (action.status === 'not-built' && action.link) {
        throw new Error(
          `[AXON capability registry] not-built action must not have an implementation link: ${action.id}`
        );
      }
      if (action.status === 'available' &&
          (!action.link || !Object.values(action.link).some((value) => typeof value === 'string' && value.trim() !== ''))) {
        throw new Error(
          `[AXON capability registry] available action must have an implementation link: ${action.id}`
        );
      }
      if (localIds.has(action.id) || Array.from(byId.values()).some((registered) =>
        registered.chatActions?.some((existing) => existing.id === action.id))) {
        throw new Error(`[AXON capability registry] duplicate chat action id: ${action.id}`);
      }
      localIds.add(action.id);
    }
  }
}

/**
 * Explicitly register a capability. Rejects duplicate ids and invalid metadata.
 * Does not run capability logic and does not mount UI.
 */
export function registerCapability(meta: Capability): void {
  assertValidMetadata(meta);
  if (byId.has(meta.id)) {
    throw new Error(
      `[AXON capability registry] capability already registered: ${meta.id}`
    );
  }
  byId.set(meta.id, copyCapability(meta));
}

/** Look up one capability by immutable id. */
export function getCapability(id: string): Capability | undefined {
  const found = byId.get(id);
  return found ? copyCapability(found) : undefined;
}

/** List all registered capabilities (deep copies of current registry contents). */
export function listCapabilities(): Capability[] {
  return Array.from(byId.values()).map(copyCapability);
}

/** Flatten the registered chat actions without exposing mutable registry data. */
export function listChatActions(): Array<{ capabilityId: string; capabilityName: string; action: ChatAction }> {
  return Array.from(byId.values()).flatMap((capability) =>
    (capability.chatActions ?? []).map((action) => ({
      capabilityId: capability.id,
      capabilityName: capability.displayName,
      action: copyAction(action),
    }))
  );
}

/**
 * Read-only snapshot for verification / debugging.
 * Prefer listCapabilities() for normal reads.
 */
export function getRegistrySnapshot(): ReadonlyArray<Readonly<Capability>> {
  return listCapabilities();
}
