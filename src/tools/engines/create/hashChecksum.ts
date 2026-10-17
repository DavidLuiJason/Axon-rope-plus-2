import type { EngineResult } from './passwordGenerator';

export type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512' | 'CRC32';
export interface DigestProvider { subtle: { digest(algorithm: string, data: BufferSource): Promise<ArrayBuffer> } }
export type HashInput = string | Uint8Array;
export async function hashChecksum(input: HashInput, algorithm: HashAlgorithm, cryptoProvider: DigestProvider | undefined = globalThis.crypto): Promise<EngineResult<{ hex: string }>> {
  if (typeof input !== 'string' && !(input instanceof Uint8Array)) return { ok: false, error: 'invalid-input' };
  if (!['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512', 'CRC32'].includes(algorithm)) return { ok: false, error: 'unsupported-algorithm' };
  try {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
    let digest: Uint8Array;
    if (algorithm === 'MD5') digest = md5(bytes);
    else if (algorithm === 'CRC32') {
      const crc = crc32(bytes);
      return { ok: true, hex: crc.toString(16).padStart(8, '0') };
    } else {
      if (!cryptoProvider?.subtle?.digest) return { ok: false, error: 'crypto-unavailable' };
      digest = new Uint8Array(await cryptoProvider.subtle.digest(algorithm, bytes));
    }
    return { ok: true, hex: [...digest].map((b) => b.toString(16).padStart(2, '0')).join('') };
  } catch { return { ok: false, error: 'hash-failed' }; }
}
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function md5(input: Uint8Array): Uint8Array {
  const length = input.length;
  const paddedLength = Math.ceil((length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(input); data[length] = 0x80;
  const bitLength = length * 8;
  const view = new DataView(data.buffer);
  view.setUint32(paddedLength - 8, bitLength >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true);
  const shifts = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let offset = 0; offset < paddedLength; offset += 64) {
    let a = a0, b = b0, c = c0, d = d0;
    const words = Array.from({ length: 16 }, (_, i) => view.getUint32(offset + i * 4, true));
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const sum = (a + f + K[i] + words[g]) >>> 0;
      const rotated = ((sum << shifts[i]) | (sum >>> (32 - shifts[i]))) >>> 0;
      [a, d, c, b] = [d, c, b, (b + rotated) >>> 0];
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  const out = new Uint8Array(16), outView = new DataView(out.buffer);
  [a0,b0,c0,d0].forEach((v,i) => outView.setUint32(i*4, v, true));
  return out;
}
