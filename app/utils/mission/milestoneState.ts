/**
 * Pure milestone-state helpers.
 *
 * These functions are tested independently and used by mission pages to
 * derive button states from volume + threshold, without hitting the store.
 * Used both server-side (from API-derived state) and client-side (for live
 * re-derivation after a `mission.progress.updated` socket event).
 */

import type { MilestoneState, MilestoneProgress } from '~/types/mission/recharge'

/**
 * Derive the locked/claimable state for a single milestone.
 *
 * Volume must equal or exceed the threshold for the milestone to be claimable.
 * Does not handle 'claimed' — that comes from the server and must be preserved.
 */
export function deriveMilestoneState(netVolume: number, threshold: number): MilestoneState {
  return netVolume >= threshold ? 'claimable' : 'locked'
}

/**
 * Re-derive all milestone states from fresh volume (e.g. after a socket event).
 *
 * Claimed milestones are preserved — claim state is authoritative from the server
 * and cannot be derived from volume alone.
 *
 * Returns a new array — does not mutate the input milestones.
 */
export function rederiveMilestoneStates(
  milestones: MilestoneProgress[],
  netVolume: number,
): MilestoneProgress[] {
  return milestones.map(m => ({
    ...m,
    state: m.state === 'claimed' ? 'claimed' : deriveMilestoneState(netVolume, m.threshold),
  }))
}
