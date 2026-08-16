/**
 * Re-pin planner (aws-production 21).
 *
 * When a Room is moved to a different MSAB instance (a drain, ticket 20, or a
 * health failure re-pin, ticket 18), the client must follow it. The DECISION —
 * re-pin or not, to which address, within what audio-gap budget — lives here as
 * a pure function, alongside the other transport planners: no sockets, no
 * WebRTC, no Vue reactivity. The lifecycle composable executes the returned
 * plan and owns no decision logic.
 *
 * The permitted-trigger list is EXHAUSTIVE: drain and health failure only.
 * Never for load balancing, never for packing, never speculatively.
 */
import {
  REPIN_BASE_BUDGET_MS,
  REPIN_CONSUME_BATCH_BUDGET_MS,
  ROOM_RECONSUME_CONCURRENCY,
} from '~/constants/room';

/**
 * Why the caller believes the Room may have moved. Only the first two may
 * produce a re-pin; the rest exist so refusal is a typed, tested branch rather
 * than a convention.
 */
export type RepinTrigger =
  | 'drain'
  | 'health-failure'
  | 'load-balance'
  | 'pack'
  | 'speculative';

export interface RepinPlanInput {
  trigger: RepinTrigger;
  /** Address the client is (or was last) connected to; null when unknown, e.g. after a teardown. */
  currentUrl: string | null;
  /** The Room's authoritative address after a metadata refresh (already dev-resolved); null when absent. */
  nextUrl: string | null;
  /** Producers that must be re-consumed after the move — sizes the budget. */
  speakerCount: number;
}

export type RepinPlan =
  | { repin: true; targetUrl: string; budgetMs: number }
  | { repin: false; reason: 'trigger-not-permitted' | 'no-target' | 'address-unchanged' };

/**
 * Budget per speaker count, against the post-affinity-04 CONCURRENT consume
 * shape: base + one round-trip window per batch of ROOM_RECONSUME_CONCURRENCY.
 * See the constants' doc block for the derivation.
 */
export function repinBudgetMs(speakerCount: number): number {
  const batches = Math.ceil(Math.max(0, speakerCount) / ROOM_RECONSUME_CONCURRENCY);
  return REPIN_BASE_BUDGET_MS + batches * REPIN_CONSUME_BATCH_BUDGET_MS;
}

export function planRoomRepin(input: RepinPlanInput): RepinPlan {
  const { trigger, currentUrl, nextUrl, speakerCount } = input;

  if (trigger !== 'drain' && trigger !== 'health-failure') {
    return { repin: false, reason: 'trigger-not-permitted' };
  }

  // No authoritative target (dev, or missing hosting_url — joinRoom already
  // logs that regression loudly): nothing to follow.
  if (!nextUrl) {
    return { repin: false, reason: 'no-target' };
  }

  if (currentUrl === nextUrl) {
    return { repin: false, reason: 'address-unchanged' };
  }

  return { repin: true, targetUrl: nextUrl, budgetMs: repinBudgetMs(speakerCount) };
}
