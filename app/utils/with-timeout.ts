/**
 * Promise timeout backstop.
 *
 * Races a promise against a hard deadline. If the promise has not settled by
 * `ms`, the returned promise rejects with a labelled timeout error. The timer
 * is always cleared (even on success) so it never leaks.
 *
 * Used to bound the guarded room-lifecycle operations (join / rebuild) so the
 * `isJoining` / `isRecovering` flags always reset in `finally` — a single
 * predictable ceiling instead of relying on every nested await staying bounded.
 * Mirrors the timer-cleanup style of `createEmitAsync` in `~/utils/socket.ts`.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  }) as Promise<T>;
}
