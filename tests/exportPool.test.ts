import { mapPool } from '../src/services/exportPool';
let checks = 0;
function ok(cond: boolean, msg: string) { checks++; if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
(async () => {
  // 1. order is kept although later items finish first
  const items = Array.from({ length: 60 }, (_, i) => i);
  const out = await mapPool(items, 8, async (n) => { await sleep((60 - n) % 7); return n * 2; });
  ok(out.length === 60 && out.every((v, i) => v === i * 2), 'results keep the input order');
  // 2. never more than the limit in flight, and the limit is really used
  let flying = 0, peak = 0;
  await mapPool(items, 5, async () => { flying++; peak = Math.max(peak, flying); await sleep(3); flying--; });
  ok(peak === 5, `peak in flight is exactly the limit (got ${peak})`);
  // 3. progress counts up to total
  const seen: number[] = [];
  await mapPool(items, 4, async (n) => n, (d, t) => { ok(t === 60, 'total reported'); seen.push(d); });
  ok(seen.length === 60 && seen[59] === 60 && seen.every((v, i) => v === i + 1), 'progress counts 1..60');
  // 4. first error stops new work and is thrown
  let started = 0;
  let threw = false;
  try { await mapPool(items, 3, async (n) => { started++; await sleep(1); if (n === 10) throw new Error('boom'); return n; }); }
  catch (e) { threw = (e as Error).message === 'boom'; }
  ok(threw, 'error is thrown');
  ok(started < 60, `work stops after an error (started ${started} of 60)`);
  // 5. empty list and bad limit
  ok((await mapPool([], 4, async () => 1)).length === 0, 'empty list');
  let bad = false; try { await mapPool([1], 0, async () => 1); } catch { bad = true; }
  ok(bad, 'limit 0 refused');
  // 6. speed model: 3,346 files at 40 ms each (a slow preview) one by one vs 16 at a time
  const files = Array.from({ length: 334 }, (_, i) => i); // 1/10 scale to keep the test fast
  const t0 = Date.now(); await mapPool(files, 1, async () => { await sleep(4); });
  const serial = Date.now() - t0;
  const t1 = Date.now(); await mapPool(files, 16, async () => { await sleep(4); });
  const pooled = Date.now() - t1;
  ok(pooled * 6 < serial, `16 at a time is at least 6x faster (serial ${serial} ms, pooled ${pooled} ms)`);
  console.log(`EXPORT POOL TEST OK: ${checks} checks (serial ${serial} ms vs pooled ${pooled} ms on the model)`);
})();
