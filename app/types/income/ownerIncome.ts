// ========================================
// Owner Income Types — cycle-centric owner/admin page
// ========================================
// agency-member-income-runs epic: `GET user/agency/income/overview` +
// `GET user/agency/income/cycles/{number}`. A cycle is the global Run N window
// (every member's run shares it). Diamond figures are exact integers computed
// by the same repository the reseller panel uses, so the numbers agree.

import type {
  AgencyRun,
  IncomeAgency,
  IncomeTotals,
  RunDeduction,
  RunDetailMilestone,
  RunExchange,
} from './income'

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

// ========================================
// Members list — `GET user/agency/income/cycles/{number}/members`
// ========================================

/** Server-side sort keys (validated by the API; anything else is a 422). */
export type OwnerIncomeMemberSort = 'income' | 'earned' | 'exchanged' | 'deducted' | 'xp' | 'name'

export type OwnerIncomeSortDirection = 'asc' | 'desc'

/**
 * One roster row for the cycle (owner never a row). `left` = had a run here in
 * the cycle but is not an active member now. A current member with no run in
 * the cycle has `run_id: null`, `current_tier: 0` and zero figures.
 * `income = earned − exchanged − deducted`.
 */
export interface OwnerIncomeMemberRow extends IncomeTotals {
  user_id: number
  name: string
  avatar_url: string | null
  signature: string | null
  left: boolean
  run_id: number | null
  current_tier: number
  accumulated_xp: number
}

/** Page-number pagination, 30 per page; no total (a COUNT would re-run every aggregate). */
export interface OwnerIncomeMembersMeta {
  page: number
  per_page: number
  has_more: boolean
}

export interface OwnerIncomeMembersPage {
  members: OwnerIncomeMemberRow[]
  meta: OwnerIncomeMembersMeta
}

/**
 * Client-side list state for one cycle. `page` = last loaded page (0 = none);
 * `sort` / `direction` / `search` are the APPLIED query (search is committed
 * after the debounce). `loadingPage` = the page in flight, null when idle.
 * `requestId` = the latest request issued for this list; a response carrying
 * any other id is stale (superseded by a new query or a reset) and is dropped.
 */
export interface OwnerIncomeMemberList {
  rows: OwnerIncomeMemberRow[]
  page: number
  hasMore: boolean
  sort: OwnerIncomeMemberSort
  direction: OwnerIncomeSortDirection
  search: string
  loadingPage: number | null
  error: string | null
  requestId: number
}

// ========================================
// Member sheet — `GET user/agency/income/cycles/{number}/members/{user}`
// ========================================

/** The tapped member, as on their list row. */
export type OwnerIncomeSheetMember = Pick<OwnerIncomeMemberRow, 'user_id' | 'name' | 'avatar_url' | 'signature' | 'left'>

/**
 * Run header: the `AgencyRun` fields of the member run detail, without the
 * ladder (it carries the owner's per-tier reward, which admins must not see).
 */
export type OwnerIncomeSheetRun = Pick<
  AgencyRun,
  'id' | 'status' | 'status_label' | 'status_color' | 'started_at' | 'ends_at' | 'accumulated_xp' | 'current_tier'
>

/**
 * One member's newest run in this agency for the cycle. `totals`, `milestones`,
 * `exchanges` and `deductions` are exactly the member's own
 * `GET user/income/runs/{run}` values for the same run. The server 404s for a
 * member not in the cycle's roster or with no run in it.
 */
export interface OwnerIncomeMemberSheet {
  member: OwnerIncomeSheetMember
  run: OwnerIncomeSheetRun
  totals: IncomeTotals
  milestones: RunDetailMilestone[]
  exchanges: RunExchange[]
  deductions: RunDeduction[]
}

/** The sheet currently open: the cycle it was opened on + the tapped row. */
export interface OwnerIncomeOpenMember {
  cycle: number
  member: OwnerIncomeSheetMember
}
