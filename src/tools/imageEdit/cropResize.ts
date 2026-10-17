/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Crop and resize arithmetic for the Image Editor. Pure TypeScript, no DOM, no React.
 * All sizes are whole pixels. Phone safety (Rule 8): no result is larger than MAX_SIDE
 * on its longer side.
 */

export const MAX_SIDE = 4096;
export const MIN_CROP = 8;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Crop shapes offered on screen. `ratio` is width divided by height; null means free. */
export const CROP_SHAPES: readonly { id: string; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
];

function whole(n: number): number {
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Keep a crop rectangle inside the picture and at least MIN_CROP wide and high. */
export function clampCrop(rect: Rect, srcWidth: number, srcHeight: number): Rect {
  const minW = Math.min(MIN_CROP, srcWidth);
  const minH = Math.min(MIN_CROP, srcHeight);
  const width = Math.max(minW, Math.min(srcWidth, whole(rect.width)));
  const height = Math.max(minH, Math.min(srcHeight, whole(rect.height)));
  const x = Math.max(0, Math.min(srcWidth - width, whole(rect.x)));
  const y = Math.max(0, Math.min(srcHeight - height, whole(rect.y)));
  return { x, y, width, height };
}

/** The largest centred crop of a given shape; a null ratio gives the whole picture. */
export function cropForShape(srcWidth: number, srcHeight: number, ratio: number | null): Rect {
  if (ratio === null || !(ratio > 0)) {
    return { x: 0, y: 0, width: srcWidth, height: srcHeight };
  }
  let width = srcWidth;
  let height = Math.round(width / ratio);
  if (height > srcHeight) {
    height = srcHeight;
    width = Math.round(height * ratio);
  }
  return clampCrop(
    {
      x: Math.floor((srcWidth - width) / 2),
      y: Math.floor((srcHeight - height) / 2),
      width,
      height,
    },
    srcWidth,
    srcHeight
  );
}

export type ResizeRequest =
  | { mode: 'percent'; value: number }
  | { mode: 'width'; value: number }
  | { mode: 'height'; value: number }
  | { mode: 'exact'; width: number; height: number };

/**
 * Work out the new size. Percent, width and height keep the shape of the picture;
 * exact does not. The result is limited to MAX_SIDE on the longer side (keeping shape
 * for the first three, scaling both for exact) and is never below 1 pixel.
 * `limited` is true when the limit changed the answer, so the screen can say so.
 */
export function resizeTo(
  srcWidth: number,
  srcHeight: number,
  req: ResizeRequest
): { width: number; height: number; limited: boolean } {
  let w: number;
  let h: number;
  if (req.mode === 'percent') {
    const f = Math.max(0, req.value) / 100;
    w = srcWidth * f;
    h = srcHeight * f;
  } else if (req.mode === 'width') {
    w = Math.max(0, req.value);
    h = srcWidth > 0 ? (srcHeight * w) / srcWidth : 0;
  } else if (req.mode === 'height') {
    h = Math.max(0, req.value);
    w = srcHeight > 0 ? (srcWidth * h) / srcHeight : 0;
  } else {
    w = Math.max(0, req.width);
    h = Math.max(0, req.height);
  }
  let limited = false;
  const longer = Math.max(w, h);
  if (longer > MAX_SIDE) {
    const f = MAX_SIDE / longer;
    w *= f;
    h *= f;
    limited = true;
  }
  return {
    width: Math.max(1, whole(w)),
    height: Math.max(1, whole(h)),
    limited,
  };
}
