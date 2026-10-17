/**
 * Reading the dictionary files in the app (DICT-I1).
 * The files are plain assets of the web build, so the same relative address works in the
 * browser and inside the Android app.
 */
import type { ReadText } from './types';

export function createFetchReader(baseUrl: string): ReadText {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return async (path: string) => {
    const res = await fetch(base + path);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    return res.text();
  };
}

/** True when this phone or browser can compute a SHA-256 (needs a secure context). */
export function canHash(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined' && typeof TextEncoder !== 'undefined';
}

/** SHA-256 of the exact text, as lowercase hex. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
