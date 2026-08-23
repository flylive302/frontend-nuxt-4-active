/**
 * Frame batching primitives.
 *
 * A gift burst delivers hundreds of socket events per second; writing
 * reactive state on every one re-renders the same components hundreds of
 * times per second. These helpers fold "N writes per second" into "one write
 * per frame" (or per `ms`) without changing the final value.
 *
 * Framework-free: no Vue, no stores. Scheduling falls back to a microtask
 * where `requestAnimationFrame` is unavailable (tests, workers).
 */

export interface FrameCoalescer {
  /** Request a flush on the next frame. Idempotent while one is pending. */
  schedule(): void;
  /** Flush synchronously now (and cancel the pending frame). */
  flushNow(): void;
  /** Drop the pending flush without running it. */
  cancel(): void;
  /** True while a flush is scheduled. */
  readonly pending: boolean;
}

type Scheduler = (cb: () => void) => () => void;

const defaultScheduler: Scheduler = (cb) => {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(() => cb());
    return () => cancelAnimationFrame(id);
  }
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled) cb();
  });
  return () => {
    cancelled = true;
  };
};

/** Run `flush` at most once per frame, no matter how often `schedule` is called. */
export function createFrameCoalescer(flush: () => void, scheduler: Scheduler = defaultScheduler): FrameCoalescer {
  let cancelPending: (() => void) | null = null;

  const run = (): void => {
    cancelPending = null;
    flush();
  };

  return {
    schedule(): void {
      if (cancelPending) return;
      cancelPending = scheduler(run);
    },
    flushNow(): void {
      if (!cancelPending) return;
      cancelPending();
      run();
    },
    cancel(): void {
      cancelPending?.();
      cancelPending = null;
    },
    get pending(): boolean {
      return cancelPending !== null;
    },
  };
}

/**
 * Trailing-edge throttle that always delivers the LATEST argument: the first
 * call fires immediately, later calls inside the window collapse into one
 * trailing call with the most recent value.
 */
export function createTrailingThrottle<T>(fn: (latest: T) => void, ms: number): (value: T) => void {
  let lastRun = -Infinity;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: T;

  return (value: T): void => {
    latest = value;
    const now = Date.now();
    if (now - lastRun >= ms && timer === null) {
      lastRun = now;
      fn(latest);
      return;
    }
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      lastRun = Date.now();
      fn(latest);
    }, Math.max(0, ms - (now - lastRun)));
  };
}
