// Minimal, dependency-free ZIP reader for AXON integrity checks. ZIP64 and encrypted
// entries are deliberately rejected rather than silently misread.
import { inflateRawSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

export function readZip(input) {
  const bytes = Buffer.isBuffer(input) ? input : readFileSync(input);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP end-of-central-directory missing');
  const count = bytes.readUInt16LE(eocd + 10);
  const offset = bytes.readUInt32LE(eocd + 16);
  if (count === 0xffff || offset === 0xffffffff) throw new Error('ZIP64 not supported');
  const entries = new Map();
  let cursor = offset;
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP central directory');
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const compressed = bytes.readUInt32LE(cursor + 20);
    const uncompressed = bytes.readUInt32LE(cursor + 24);
    const nameLen = bytes.readUInt16LE(cursor + 28);
    const extraLen = bytes.readUInt16LE(cursor + 30);
    const commentLen = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');
    cursor += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..') || name.split('/').includes('') || name.includes('\0')) {
      throw new Error(`Unsafe ZIP path: ${name}`);
    }
    if (entries.has(name)) throw new Error(`Duplicate ZIP path: ${name}`);
    if (flags & 1 || ![0, 8].includes(method)) throw new Error(`Unsupported ZIP encoding: ${name}`);
    if (bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid ZIP entry: ${name}`);
    const localNameLen = bytes.readUInt16LE(localOffset + 26);
    const localExtraLen = bytes.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const payload = bytes.subarray(start, start + compressed);
    if (payload.length !== compressed) throw new Error(`Truncated ZIP entry: ${name}`);
    const data = method === 0 ? payload : inflateRawSync(payload);
    if (data.length !== uncompressed) throw new Error(`Wrong ZIP entry length: ${name}`);
    entries.set(name, data);
  }
  return entries;
}
