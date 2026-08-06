/**
 * Bounded-concurrency task runner.
 *
 * Runs `task` over `items` with at most `limit` calls in flight at any moment.
 * Sequential depth drops from `items.length` to `ceil(items.length / limit)`
 * while the burst stays bounded — unbounded parallelism trades a slow recovery
 * for one that can fail all at once.
 *
 * Nothing here touches Vue reactivity, stores, or the socket: it is a pure
 * scheduling primitive (`app/utils/` layer rules).
 *
 * ⛔ **`task` MUST NOT reject.** This runner deliberately has no per-item
 * `catch`, so a rejection propagates through `Promise.all` and abandons the
 * caller while the other workers keep draining the queue in the background —
 * an unhandled rejection plus a half-finished batch. Callers handle their own
 * failures inside `task`, which is also the only place with enough context to
 * decide whether one failed item should be fatal. Swallowing errors here
 * instead would hide the failures the caller needs to log.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  // Never spawn more workers than there is work, and never fewer than one —
  // a caller passing 0 or a negative limit gets serial execution, not a hang.
  const workerCount = Math.max(1, Math.min(Math.trunc(limit), items.length));

  // Shared cursor rather than pre-sliced chunks: a slow item then delays only
  // its own worker instead of stranding a whole chunk behind it.
  let cursor = 0;

  // Safe without a lock — JS is single-threaded and there is no `await`
  // between reading `cursor` and incrementing it, so two workers can never
  // claim the same index.
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++;
      await task(items[index]!, index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}
