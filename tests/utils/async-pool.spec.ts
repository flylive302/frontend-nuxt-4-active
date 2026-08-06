import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from '~/utils/async-pool';

// A promise plus its own resolver, so a test can decide exactly when a task
// settles instead of guessing with setTimeout/fake timers.
function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('runWithConcurrency', () => {
  it('runs every item exactly once and returns only after all have finished', async () => {
    const seen: number[] = [];
    const items = [10, 20, 30, 40, 50];

    await runWithConcurrency(items, 2, async (item) => {
      seen.push(item);
    });

    expect(seen.slice().sort((a, b) => a - b)).toEqual(items);
  });

  it('never exceeds the limit', async () => {
    // Live counter, not just a tally: it catches a runner that lets a burst
    // spike above `limit` even if it settles back down before the end.
    const items = Array.from({ length: 10 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;

    await runWithConcurrency(items, 3, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight--;
    });

    expect(maxInFlight).toBe(3);
  });

  it('is actually parallel, not serial', async () => {
    // A serial-in-disguise runner would still pass a "never exceeds the
    // limit" check, so this proves the workers are genuinely concurrent: all
    // 5 must start before any one of them is allowed to finish.
    const items = [0, 1, 2, 3, 4];
    const started: number[] = [];
    const deferreds = items.map(() => createDeferred());

    const run = runWithConcurrency(items, 5, async (item) => {
      started.push(item);
      await deferreds[item]!.promise;
    });

    expect(started.length).toBe(5);

    deferreds.forEach((d) => d.resolve());
    await run;
  });

  it('does not strand the queue behind a slow item', async () => {
    const items = [0, 1, 2, 3];
    const completed: number[] = [];
    const slow = createDeferred();

    const run = runWithConcurrency(items, 2, async (item) => {
      if (item === 0) {
        // Item 0 hangs on purpose; its worker must not block the other
        // worker from draining the rest of the queue.
        await slow.promise;
      }
      completed.push(item);
    });

    // Flush enough microtask turns for the non-hanging worker to drain
    // items 1-3 while item 0 is still pending.
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
    expect(completed).toEqual([1, 2, 3]);

    slow.resolve();
    await run;

    expect(completed).toEqual([1, 2, 3, 0]);
  });

  it('spawns no more workers than there are items when the limit exceeds items.length', async () => {
    const items = [0, 1, 2];
    let inFlight = 0;
    let maxInFlight = 0;

    await runWithConcurrency(items, 10, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight--;
    });

    expect(maxInFlight).toBe(3);
  });

  it('falls back to serial execution for a limit of 0 or -1, and still processes every item', async () => {
    // `Math.max(1, ...)` is a deliberate clamp: a bad limit degrades to
    // serial instead of spawning zero workers and hanging forever.
    for (const limit of [0, -1]) {
      const items = [0, 1, 2, 3];
      const seen: number[] = [];
      let inFlight = 0;
      let maxInFlight = 0;

      await runWithConcurrency(items, limit, async (item) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight--;
        seen.push(item);
      });

      expect(maxInFlight).toBe(1);
      expect(seen.slice().sort((a, b) => a - b)).toEqual(items);
    }
  });

  it('resolves immediately and never calls the task for an empty array', async () => {
    let called = false;

    await runWithConcurrency([], 3, async () => {
      called = true;
    });

    expect(called).toBe(false);
  });

  it('passes each task the index matching its position in the input array', async () => {
    const items = ['a', 'b', 'c'];
    const seenIndices: number[] = [];

    await runWithConcurrency(items, 1, async (item, index) => {
      expect(items[index]).toBe(item);
      seenIndices.push(index);
    });

    expect(seenIndices.slice().sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });
});
