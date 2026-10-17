/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const BUILD_CONFIRMED_KEY = 'axon.build.confirmed.v1';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadConfirmed(store: KeyValueStore | null): Set<string> {
  if (!store) {
    return new Set<string>();
  }
  try {
    const raw = store.getItem(BUILD_CONFIRMED_KEY);
    if (!raw) {
      return new Set<string>();
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return new Set<string>();
    }
    if (parsed.version !== 1) {
      return new Set<string>();
    }
    if (!Array.isArray(parsed.ids)) {
      return new Set<string>();
    }

    const result = new Set<string>();
    for (const item of parsed.ids) {
      if (typeof item === 'string') {
        result.add(item);
        if (result.size >= 500) {
          break;
        }
      }
    }
    return result;
  } catch {
    return new Set<string>();
  }
}

export function saveConfirmed(store: KeyValueStore | null, ids: Set<string>): void {
  if (!store) {
    return;
  }
  try {
    const idArray: string[] = [];
    for (const id of ids) {
      if (typeof id === 'string') {
        idArray.push(id);
        if (idArray.length >= 500) {
          break;
        }
      }
    }
    const data = {
      version: 1,
      ids: idArray,
    };
    store.setItem(BUILD_CONFIRMED_KEY, JSON.stringify(data));
  } catch {
    // a missing or failing store is silently ignored
  }
}

export function toggleConfirmed(ids: Set<string>, id: string): Set<string> {
  const next = new Set<string>(ids);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}
