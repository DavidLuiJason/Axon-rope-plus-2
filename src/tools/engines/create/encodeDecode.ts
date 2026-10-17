import type { EngineResult } from './passwordGenerator';

export type Encoding = 'base64' | 'base64url' | 'url' | 'html' | 'hex' | 'binary' | 'rot13';
export function encodeDecode(mode: 'encode' | 'decode', format: Encoding, input: string): EngineResult<{ value: string }> {
  if (typeof input !== 'string') return { ok: false, error: 'invalid-input' };
  if (mode !== 'encode' && mode !== 'decode') return { ok: false, error: 'invalid-mode' };
  try {
    if (!['base64', 'base64url', 'url', 'html', 'hex', 'binary', 'rot13'].includes(format)) return { ok: false, error: 'unsupported-format' };
    if (mode === 'encode') {
      switch (format) {
        case 'base64': return { ok: true, value: bytesToBase64(new TextEncoder().encode(input)) };
        case 'base64url': return { ok: true, value: bytesToBase64(new TextEncoder().encode(input)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '') };
        case 'url': return { ok: true, value: encodeURIComponent(input) };
        case 'html': return { ok: true, value: input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') };
        case 'hex': return { ok: true, value: [...new TextEncoder().encode(input)].map((b) => b.toString(16).padStart(2, '0')).join('') };
        case 'binary': return { ok: true, value: [...new TextEncoder().encode(input)].map((b) => b.toString(2).padStart(8, '0')).join(' ') };
        case 'rot13': return { ok: true, value: rot13(input) };
      }
    } else {
      switch (format) {
        case 'base64': {
          // Pasted Base64 often has line breaks or spaces and may lack the final '=' padding: accept both.
          const compact = input.replace(/\s+/g, '');
          if (compact.length % 4 === 1) return { ok: false, error: 'invalid-base64' };
          const padded = compact.includes('=') ? compact : compact + '='.repeat((4 - compact.length % 4) % 4); // explicit padding must be complete and correct
          return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(padded)) };
        }
        case 'base64url': {
          if (!/^[A-Za-z0-9_-]*$/.test(input) || input.length % 4 === 1) return { ok: false, error: 'invalid-base64' };
          const normal = input.replace(/-/g, '+').replace(/_/g, '/');
          return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(normal + '='.repeat((4 - normal.length % 4) % 4))) };
        }
        case 'url': return { ok: true, value: decodeURIComponent(input.replace(/\+/g, '%20')) };
        case 'html': return decodeHtml(input);
        case 'hex': {
          if (input.length % 2 || !/^(?:[0-9a-fA-F]{2})*$/.test(input)) return { ok: false, error: 'invalid-hex' };
          const bytes = new Uint8Array(input.length / 2);
          for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(input.slice(i * 2, i * 2 + 2), 16);
          return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
        }
        case 'binary': {
          if (input.trim() === '') return { ok: true, value: '' };
          const parts = input.trim().split(/\s+/);
          if (!parts.every((p) => /^[01]{8}$/.test(p))) return { ok: false, error: 'invalid-binary' };
          return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(parts.map((p) => parseInt(p, 2)))) };
        }
        case 'rot13': return { ok: true, value: rot13(input) };
      }
    }
  } catch {
    return { ok: false, error: mode === 'decode' ? 'invalid-encoded-input' : 'encoding-failed' };
  }
  return { ok: false, error: 'unsupported-format' };
}
function rot13(value: string): string {
  return value.replace(/[a-zA-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() <= 'm' ? 13 : -13)));
}
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], hasB = i + 1 < bytes.length, hasC = i + 2 < bytes.length;
    const b = hasB ? bytes[i + 1] : 0, c = hasC ? bytes[i + 2] : 0;
    out += BASE64[a >> 2] + BASE64[((a & 3) << 4) | (b >> 4)] + (hasB ? BASE64[((b & 15) << 2) | (c >> 6)] : '=') + (hasC ? BASE64[c & 63] : '=');
  }
  return out;
}
function base64ToBytes(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('invalid-base64');
  const clean = value.replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0, bits = 0;
  for (const char of clean) {
    const n = BASE64.indexOf(char);
    if (n < 0) throw new Error('invalid-base64');
    buffer = (buffer << 6) | n;
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >> bits) & 255); }
  }
  return Uint8Array.from(bytes);
}
function decodeHtml(input: string): EngineResult<{ value: string }> {
  let bad = false;
  const value = input.replace(/&(#(?:x[0-9a-f]+|\d+)|amp|lt|gt|quot|apos|#39);/gi, (entity) => {
    const key = entity.slice(1, -1);
    if (/^#x/i.test(key)) {
      const cp = parseInt(key.slice(2), 16);
      if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) { bad = true; return entity; }
      return String.fromCodePoint(cp);
    }
    if (/^#\d+$/.test(key)) {
      const cp = Number(key.slice(1));
      if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) { bad = true; return entity; }
      return String.fromCodePoint(cp);
    }
    const map: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
    return map[key.toLowerCase()] ?? entity;
  });
  return bad ? { ok: false, error: 'invalid-html-entity' } : { ok: true, value };
}
