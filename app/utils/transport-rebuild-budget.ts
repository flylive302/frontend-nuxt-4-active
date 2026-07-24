/**
 * Transport-exhaustion auto-rebuild budget (audio-pipe-observability 10).
 *
 * Pure decision helper for the loop guard around terminal transport failure.
 * A transport rebuild resolves on transport *creation* while the consumer
 * connects ICE lazily, so a client with a genuinely broken audio path
 * (`attempts-exhausted`: TURN/UDP unreachable) re-fails after every rebuild.
 * Unbounded auto-rebuild would then loop — churning a healthy socket, flickering
 * seats, and emitting a fresh Sentry event per cycle.
 *
 * The rule: allow `maxAuto` auto-rebuilds per cooldown *window of health*. The
 * window is measured from the LAST exhaustion's handling completion (the caller
 * stamps `lastAt` after the rebuild attempt finishes), so it captures how long
 * the fresh transport actually survived — not the rebuild's own duration. Only a
 * transport that stayed healthy for a full window earns a fresh auto-rebuild;
 * anything re-failing sooner routes to the manual "Reconnect" affordance.
 */
export interface TransportRebuildBudget {
  /** Auto-rebuilds already spent in the current window. */
  attempt: number;
  /** Timestamp (ms) the previous exhaustion finished being handled. */
  lastAt: number;
}

export interface TransportRebuildDecision {
  /** Whether the caller should drive one auto-rebuild now. */
  autoRebuild: boolean;
  /** Budget to carry forward (caller updates `lastAt` at handling completion). */
  next: TransportRebuildBudget;
}

/**
 * Decide whether this exhaustion gets an auto-rebuild.
 *
 * @param budget  current attempt count + last-handled timestamp
 * @param now     current time (ms)
 * @param cooldownMs  window of health that resets the budget
 * @param maxAuto  auto-rebuilds allowed per window
 */
export function evaluateTransportRebuild(
  budget: TransportRebuildBudget,
  now: number,
  cooldownMs: number,
  maxAuto: number,
): TransportRebuildDecision {
  // Reset the budget only if the fresh transport stayed healthy for a full
  // window since the last exhaustion was handled (i.e. audio recovered).
  const windowElapsed = now - budget.lastAt > cooldownMs;
  const attempt = windowElapsed ? 0 : budget.attempt;

  const autoRebuild = attempt < maxAuto;
  return {
    autoRebuild,
    next: {
      attempt: autoRebuild ? attempt + 1 : attempt,
      lastAt: budget.lastAt,
    },
  };
}
