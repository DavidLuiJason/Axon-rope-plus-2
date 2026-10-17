/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Picture set for the Image Editor: which pictures are open, which one is being edited,
 * and each picture's own edit history. Pure TypeScript, no DOM, no React.
 * The screen keeps the actual picture data (files) in its own map keyed by id; this file
 * only knows ids, names and histories, so it stays tiny and testable.
 * Phone safety (Rule 8): at most MAX_PICTURES are open at once; the screen decodes only
 * the active picture and keeps the others as small previews.
 */

import { type EditHistory, emptyHistory } from './history';

export const MAX_PICTURES = 8;

export interface PictureEntry {
  id: string;
  name: string;
  history: EditHistory;
}

export interface PictureSet {
  items: PictureEntry[];
  activeId: string | null;
  /** Counter that makes ids that are never reused inside one session. */
  nextSeq: number;
}

export function emptySet(): PictureSet {
  return { items: [], activeId: null, nextSeq: 1 };
}

export function activeEntry(set: PictureSet): PictureEntry | null {
  if (set.activeId === null) return null;
  return set.items.find((p) => p.id === set.activeId) ?? null;
}

export function hasPicture(set: PictureSet): boolean {
  return set.items.length > 0;
}

export function roomLeft(set: PictureSet): number {
  return Math.max(0, MAX_PICTURES - set.items.length);
}

/**
 * Add pictures by name. Pictures beyond the limit are refused (counted in `refused`).
 * The first picture added to an empty set becomes active; later additions keep the
 * current active picture unless `activateNew` is true (then the last added one is active).
 */
export function addPictures(
  set: PictureSet,
  names: readonly string[],
  activateNew = false
): { set: PictureSet; addedIds: string[]; refused: number } {
  const room = roomLeft(set);
  const accepted = names.slice(0, room);
  const refused = names.length - accepted.length;
  let seq = set.nextSeq;
  const added: PictureEntry[] = accepted.map((name) => {
    const entry: PictureEntry = { id: `p${seq}`, name, history: emptyHistory() };
    seq += 1;
    return entry;
  });
  const items = [...set.items, ...added];
  let activeId = set.activeId;
  if (added.length > 0 && (activeId === null || activateNew)) {
    activeId = added[added.length - 1].id;
  }
  return {
    set: { items, activeId, nextSeq: seq },
    addedIds: added.map((p) => p.id),
    refused,
  };
}

/** Make a picture active. An unknown id changes nothing. */
export function selectPicture(set: PictureSet, id: string): PictureSet {
  if (!set.items.some((p) => p.id === id)) return set;
  return { ...set, activeId: id };
}

/**
 * Remove one or several pictures. If the active one is removed, the picture that now sits
 * at its place becomes active (or the one before it, or none when the set is empty).
 */
export function removePictures(set: PictureSet, ids: readonly string[]): PictureSet {
  const drop = new Set(ids);
  if (!set.items.some((p) => drop.has(p.id))) return set;
  const activeIndex = set.items.findIndex((p) => p.id === set.activeId);
  const items = set.items.filter((p) => !drop.has(p.id));
  let activeId = set.activeId;
  if (activeId === null || drop.has(activeId)) {
    if (items.length === 0) {
      activeId = null;
    } else {
      // Items before the old active position that survived shift the index back.
      let before = 0;
      for (let i = 0; i < activeIndex; i += 1) {
        if (!drop.has(set.items[i].id)) before += 1;
      }
      activeId = items[Math.min(before, items.length - 1)].id;
    }
  }
  return { items, activeId, nextSeq: set.nextSeq };
}

/** Replace a picture with another file: same place and id, new name, history cleared. */
export function replacePicture(set: PictureSet, id: string, newName: string): PictureSet {
  if (!set.items.some((p) => p.id === id)) return set;
  return {
    ...set,
    items: set.items.map((p) =>
      p.id === id ? { id: p.id, name: newName, history: emptyHistory() } : p
    ),
  };
}

/** Store a new history for one picture (after an edit, undo, redo or reset). */
export function setHistory(set: PictureSet, id: string, history: EditHistory): PictureSet {
  if (!set.items.some((p) => p.id === id)) return set;
  return {
    ...set,
    items: set.items.map((p) => (p.id === id ? { ...p, history } : p)),
  };
}

/** Move a picture to a new position (for ordering, e.g. a future collage). */
export function movePicture(set: PictureSet, id: string, toIndex: number): PictureSet {
  const from = set.items.findIndex((p) => p.id === id);
  if (from < 0) return set;
  const to = Math.max(0, Math.min(set.items.length - 1, Math.trunc(toIndex)));
  if (to === from) return set;
  const items = [...set.items];
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved);
  return { ...set, items };
}
