/**
 * Keyed single-flight (room-page-runtime-audit 01).
 *
 * Coalesces concurrent async starts of the SAME key into one run: the first
 * caller runs `run(key)`, every later caller with an equal key gets the same
 * in-flight promise back. A different key is NOT queued — it runs immediately
 * (the caller decides what to do about the previous key; here the broadcast
 * HLS player's `start()` calls `stop()` first).
 *
 * Pure, no reactivity, no DOM — unit-tested directly; the HLS player only
 * wires it in.
 */
export interface KeyedSingleFlight<K> {
  /** Run (or join) the in-flight run for `key`. */
  start: (key: K) => Promise<void>;
  /** Forget the in-flight run (e.g. on stop/teardown). Does not cancel it. */
  clear: () => void;
  /** The key currently in flight, or null. */
  inFlightKey: () => K | null;
}

export function createKeyedSingleFlight<K>(run: (key: K) => Promise<void>): KeyedSingleFlight<K> {
  let key: K | null = null;
  let promise: Promise<void> | null = null;

  return {
    start(k: K): Promise<void> {
      if (promise && key === k) return promise;
      key = k;
      const p = run(k).finally(() => {
        // Only release if this run is still the current one — a newer
        // `start(other)` or `clear()` may already have replaced it.
        if (promise === p) {
          promise = null;
          key = null;
        }
      });
      promise = p;
      return p;
    },
    clear(): void {
      promise = null;
      key = null;
    },
    inFlightKey: () => key,
  };
}
