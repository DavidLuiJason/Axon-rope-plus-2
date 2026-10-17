import { passwordGenerator } from '../src/tools/engines/create/passwordGenerator';
import { pickRandom, shuffle, coinFlip, rollDice, randomInteger, splitTeams } from '../src/tools/engines/create/randomPicker';
import { encodeDecode } from '../src/tools/engines/create/encodeDecode';
import { hashChecksum } from '../src/tools/engines/create/hashChecksum';

let checks = 0;
function assert(cond: boolean, msg: string) {
  checks += 1;
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}
function seeded(values: number[]): (max: number) => number {
  let i = 0;
  return (max) => {
    const value = values[i++ % values.length];
    return value % max;
  };
}
function value<T extends { ok: boolean; value?: unknown }>(result: T): unknown {
  return result.ok ? result.value : undefined;
}

async function main() {
  console.log('-- password generator');
  const password = passwordGenerator({ length: 12, lower: true, upper: true, digits: true, symbols: true }, seeded([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]));
  assert(password.ok && password.password.length === 12, 'generates requested password length deterministically');
  assert(password.ok && /[a-z]/.test(password.password) && /[A-Z]/.test(password.password) && /\d/.test(password.password) && /[!@#$%^&*()\-_=+\[\]{};:,.?/\\|~`'"><]/.test(password.password), 'guarantees at least one character from every chosen set');
  assert(password.ok && password.entropyBits > 0, 'returns a positive entropy estimate');
  const noLook = passwordGenerator({ length: 32, lower: true, upper: true, digits: true, excludeLookAlikes: true }, seeded([1,2,3,4,5,6]));
  assert(noLook.ok && !/[0O1lI|]/.test(noLook.password), 'drops look-alike characters from selected sets');
  assert(!passwordGenerator({ length: 3, lower: true }).ok, 'rejects length below four');
  assert(!passwordGenerator({ length: 129, lower: true }).ok, 'rejects length above 128');
  assert(!passwordGenerator({ length: 8 }).ok, 'requires at least one selected character set');
  assert(!passwordGenerator({ length: 8, lower: true }, () => 999).ok, 'rejects an invalid random source result');
  assert(!passwordGenerator(null as never).ok, 'returns error for null options');
  assert(passwordGenerator({ length: 128, lower: true, upper: true }, seeded([0,1,2])).ok, 'handles maximum password length');

  console.log('-- random picker');
  const picked = pickRandom(['a','b','c','d'], 3, false, seeded([2,0,0]));
  assert(picked.ok && picked.values.join('') === 'cab', 'picks distinct values in deterministic order');
  const repeated = pickRandom(['x'], 5, true, seeded([0]));
  assert(repeated.ok && repeated.values.join('') === 'xxxxx', 'allows repeated picks');
  assert(!pickRandom([1], 2, false, seeded([0])).ok, 'rejects too many picks without repeats');
  assert(pickRandom([], 0, false, seeded([0])).ok, 'allows zero picks from an empty list');
  const mixed = shuffle([1,2,3], seeded([0,0]));
  assert(mixed.ok && mixed.values.join(',') === '2,3,1', 'shuffles deterministically');
  assert(coinFlip(seeded([0])).ok && (coinFlip(seeded([1])).ok), 'coin flip accepts both deterministic outcomes');
  const dice = rollDice('3d6', seeded([0,5,2]));
  assert(dice.ok && dice.rolls.join(',') === '1,6,3' && dice.total === 10, 'rolls NdM dice and totals them');
  assert(!rollDice('d6', seeded([0])).ok, 'rejects malformed dice notation');
  assert(randomInteger(-2, 2, seeded([0])).ok && randomInteger(-2, 2, seeded([4])).ok, 'random integer includes both range endpoints');
  const teams = splitTeams([1,2,3,4,5], 2, seeded([0,1,0,1]));
  assert(teams.ok && teams.teams.length === 2 && teams.teams.flat().sort().join(',') === '1,2,3,4,5', 'splits all items into teams without loss');
  assert(!splitTeams([1], 0, seeded([0])).ok, 'rejects invalid team count');

  console.log('-- encoders');
  const unicode = 'AXON 🧠 café';
  for (const format of ['base64','base64url','url','html','hex','binary','rot13'] as const) {
    const encoded = encodeDecode('encode', format, unicode);
    const decoded = encoded.ok ? encodeDecode('decode', format, encoded.value) : encoded;
    assert(decoded.ok && decoded.value === unicode, `${format} round-trips Unicode and emoji`);
  }
  assert(value(encodeDecode('encode', 'base64', 'abc')) === 'YWJj', 'Base64 known encoding for abc');
  assert(value(encodeDecode('encode', 'base64url', 'f')) === 'Zg', 'URL-safe Base64 omits padding');
  assert(value(encodeDecode('encode', 'rot13', 'The quick brown fox')) === 'Gur dhvpx oebja sbk', 'ROT13 known vector');
  assert(!encodeDecode('decode', 'base64', '%%%').ok, 'bad Base64 returns an error');
  assert(!encodeDecode('decode', 'base64url', 'a').ok, 'bad URL-safe Base64 returns an error');
  assert(!encodeDecode('decode', 'url', '%ZZ').ok, 'bad URL encoding returns an error');
  assert(!encodeDecode('decode', 'hex', 'abc').ok, 'odd-length hex returns an error');
  assert(!encodeDecode('decode', 'binary', '010').ok, 'bad binary returns an error');
  assert(value(encodeDecode('decode', 'html', '&amp;&lt;&#x1F9E0;')) === '&<🧠', 'decodes named and numeric HTML entities');
  assert(value(encodeDecode('encode', 'hex', '')) === '', 'encodes empty input');
  assert(!encodeDecode('decode', 'base64', '////').ok, 'rejects non-UTF-8 Base64 bytes for text decoding');

  assert(value(encodeDecode('decode', 'base64', 'YWJj\nZGVm')) === 'abcdef', 'Base64 decode accepts pasted line breaks');
  assert(value(encodeDecode('decode', 'base64', 'YWJjZA')) === 'abcd', 'Base64 decode accepts missing padding');
  assert(value(encodeDecode('decode', 'base64', '  YWJj  ')) === 'abc', 'Base64 decode ignores surrounding spaces');
  assert(!encodeDecode('decode', 'base64', 'YWJjZA=').ok, 'Base64 decode rejects incomplete explicit padding');
  assert(!encodeDecode('decode', 'base64', 'YWJjZ').ok, 'Base64 decode rejects an impossible length');

  console.log('-- fast distinct picking');
  {
    const reference = <T,>(items: T[], count: number, random: (max: number) => number): T[] => { const pool = [...items], out: T[] = []; for (let i = 0; i < count; i++) { const k = random(pool.length); out.push(pool[k]); pool.splice(k, 1); } return out; };
    let state = 7; const lcg = (max: number): number => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return Math.floor((state / 0x100000000) * max); };
    let same = true;
    for (let round = 0; round < 300 && same; round++) {
      const n = round % 41, c = (round * 7) % (n + 1), items = Array.from({ length: n }, (_, i) => i);
      state = round + 1; const fast = pickRandom(items, c, false, lcg); state = round + 1; const slow = reference(items, c, lcg);
      same = fast.ok && JSON.stringify(fast.values) === JSON.stringify(slow);
    }
    assert(same, 'distinct picking gives exactly the same result as picking from a shrinking list (300 seeded cases)');
    const all = pickRandom([1,2,3,4], 4, false, () => 0);
    assert(all.ok && all.values.join('') === '1234', 'always picking the first remaining item keeps the original order');
    const last = pickRandom([1,2,3,4], 4, false, (max) => max - 1);
    assert(last.ok && last.values.join('') === '4321', 'always picking the last remaining item reverses the order');
    const big = Array.from({ length: 100000 }, (_, i) => i);
    const started = Date.now();
    const many = pickRandom(big, 100000, false);
    assert(many.ok && new Set(many.values).size === 100000, 'picks 100,000 distinct items from 100,000 without repeats');
    assert(Date.now() - started < 2000, 'picking 100,000 of 100,000 stays fast (well under the old quadratic time)');
  }

  console.log('-- published hash/checksum vectors');
  const vectors = [
    { input: '', md5: 'd41d8cd98f00b204e9800998ecf8427e', sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709', sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', sha384: '38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b', sha512: 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e', crc32: '00000000' },
    { input: 'abc', md5: '900150983cd24fb0d6963f7d28e17f72', sha1: 'a9993e364706816aba3e25717850c26c9cd0d89d', sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', sha384: 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7', sha512: 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f', crc32: '352441c2' },
    { input: 'The quick brown fox jumps over the lazy dog', md5: '9e107d9d372bb6826bd81d3542a419d6', sha1: '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12', sha256: 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592', sha384: 'ca737f1014a48f4c0b6dd43cb177b0afd9e5169367544c494011e3317dbf9a509cb1e5dc1e85a941bbee3d7f2afbc9b1', sha512: '07e547d9586f6a73f73fbac0435ed76951218fb7d0c8d788a309d785436bbb642e93a252a954f23912547d1e8a3b5ed6e1bfd7097821233fa0538f3db854fee6', crc32: '414fa339' }
  ];
  for (const v of vectors) {
    const md5 = await hashChecksum(v.input, 'MD5');
    const sha1 = await hashChecksum(v.input, 'SHA-1');
    const sha256 = await hashChecksum(v.input, 'SHA-256');
    const sha384 = await hashChecksum(v.input, 'SHA-384');
    const sha512 = await hashChecksum(v.input, 'SHA-512');
    const crc = await hashChecksum(v.input, 'CRC32');
    assert(md5.ok && md5.hex === v.md5, `MD5 vector ${JSON.stringify(v.input)}`);
    assert(sha1.ok && sha1.hex === v.sha1, `SHA-1 vector ${JSON.stringify(v.input)}`);
    assert(sha256.ok && sha256.hex === v.sha256, `SHA-256 vector ${JSON.stringify(v.input)}`);
    assert(sha384.ok && sha384.hex === v.sha384, `SHA-384 vector ${JSON.stringify(v.input)}`);
    assert(sha512.ok && sha512.hex === v.sha512, `SHA-512 vector ${JSON.stringify(v.input)}`);
    assert(crc.ok && crc.hex === v.crc32, `CRC32 vector ${JSON.stringify(v.input)}`);
  }
  const emoji = await hashChecksum('🧠', 'SHA-256');
  const emojiBytes = await hashChecksum(new TextEncoder().encode('🧠'), 'SHA-256');
  assert(emoji.ok && emojiBytes.ok && emoji.hex === emojiBytes.hex, 'string and byte input hash identical UTF-8 data');
  assert(!(await hashChecksum('abc', 'SHA-256', {} as never)).ok, 'missing crypto digest returns an error');
  assert((await hashChecksum('x'.repeat(1_000_000), 'CRC32')).ok, 'handles large text input');
  console.log(`=== toolsCreate checks: ${checks} ===`);
}
main().catch((error) => { console.error(error); throw error; });
