/** AXON export speed helper (pure code, no dependencies).
 * Runs `worker` over `items` with at most `limit` jobs in flight, and returns the
 * results in the SAME ORDER as `items`, so the exported ZIP is identical whatever
 * order the downloads finish in. Stops at the first error (nothing half-saved).
 * `onDone(done, total)` is called after each finished item.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onDone?: (done: number, total: number) => void,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('mapPool: limit must be a whole number of at least 1');
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  let failed = false;
  async function lane(): Promise<void> {
    while (!failed) {
      const index = next++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
      done++;
      onDone?.(done, items.length);
    }
  }
  const lanes = Array.from({ length: Math.min(limit, items.length) }, () => lane());
  await Promise.all(lanes);
  return results;
}
