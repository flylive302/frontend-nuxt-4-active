// ========================================
// Owner Income Types — cycle-centric owner/admin page
// ========================================
// agency-member-income-runs epic: `GET user/agency/income/overview` +
// `GET user/agency/income/cycles/{number}`. A cycle is the global Run N window
// (every member's run shares it). Diamond figures are exact integers computed
// by the same repository the reseller panel uses, so the numbers agree.

import type { IncomeAgency, IncomeTotals } from './income'

/**
 * One global cycle (Run N). `start` inclusive, `end` exclusive (ISO 8601).
 * `label` is display-ready, e.g. "Run 5 · Aug 11 – Aug 20".
 */
export interface OwnerIncomeCycle {
  number: number
  start: string
  end: string
  in_progress: boolean
  label: string
}

/**
 * Page bootstrap: the managed agency plus every cycle it had a run in (and the
 * in-progress cycle whenever that list is non-empty), newest first.
 * `default_cycle` is null only when `cycles` is empty (agency never had a run).
 */
export interface OwnerIncomeOverview {
  agency: IncomeAgency
  default_cycle: number | null
  cycles: OwnerIncomeCycle[]
}

/**
 * Members block for a cycle: sums over the whole roster for the window
 * (members who left included, owner excluded).
 */
export interface OwnerIncomeMembersTotals extends IncomeTotals {
  members_count: number
  left_count: number
}

/**
 * Owner block for a cycle. `earned = owner_cut + own_hosting`.
 */
export interface OwnerIncomeOwnerTotals extends IncomeTotals {
  owner_cut: number
  own_hosting: number
}

/**
 * One cycle's heroes. `owner` is absent (not null) unless the requester is the
 * agency owner — the server never sends it to admins.
 */
export interface OwnerIncomeCycleSummary {
  cycle: OwnerIncomeCycle
  members: OwnerIncomeMembersTotals
  owner?: OwnerIncomeOwnerTotals
}
