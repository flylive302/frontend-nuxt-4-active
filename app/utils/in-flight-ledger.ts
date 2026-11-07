/**
 * In-flight spend ledger (gift-cashback-latency 06).
 *
 * Tracks the coin cost of lucky taps that were emitted but whose ack has not
 * arrived yet, so the local affordability GATE can be net of them. Framework-
 * free on purpose: a plain Map, no Vue reactivity and no store — the next tap's
 * GATE reads `total` synchronously, and nothing renders it, so reactivity would
 * only add per-tap cost on low-end phones.
 */

export interface InFlightLedger {
  /** Record `cost` for `id`. Re-reserving an id replaces its cost (no double count). */
  reserve(id: string, cost: number): void;
  /** Drop `id`'s cost. A no-op for an unknown or already-released id. */
  release(id: string): void;
  /** Sum of all reserved costs. */
  readonly total: number;
}

export function createInFlightLedger(): InFlightLedger {
  const costs = new Map<string, number>();

  return {
    reserve(id: string, cost: number): void {
      costs.set(id, cost);
    },
    release(id: string): void {
      costs.delete(id);
    },
    get total(): number {
      let sum = 0;
      for (const cost of costs.values()) sum += cost;
      return sum;
    },
  };
}
