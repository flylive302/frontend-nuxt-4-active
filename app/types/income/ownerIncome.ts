// ========================================
// Owner Income Types — window-centric owner/admin page
// ========================================
// agency-member-income-runs epic: `GET user/agency/income/overview` plus two
// sibling endpoint families for the two window kinds a report can be run for:
//
//   run    → `income/cycles/{number}…`            (Run N, the Phase 1 window)
//   range  → `income/range…?from&to`              (custom UTC day range, Phase 2)
//
// Both families answer the same shapes; every response carries a `window`
// object describing which one was served. Diamond figures are exact integers
// computed by the same repository the reseller panel uses, so the numbers
// agree. Range endpoints 404 until the operator enables them — the overview's
// `ranges_enabled` is the only flag the client is allowed to read.

import type {
  AgencyRun,
  IncomeAgency,
  IncomeTotals,
  RunDeduction,
  RunDetailMilestone,
  RunExchange,
} from './income'

// ========================================
// Window
// ========================================

export type OwnerIncomeWindowKind = 'run' | 'range'

/**
 * The window a response was served for. `from` / `to` are ISO 8601 **instants**
 * (inclusive), NOT calendar days — never build a store key or a picker value
 * from them, use the selection that was requested. `number` is the run number
 * in run mode and `null` in range mode.
 */
export interface OwnerIncomeWindow {
  kind: OwnerIncomeWindowKind
  from: string
  to: string
  label: string
  number: number | null
  in_progress: boolean
}

/**
 * Bounds the custom-date picker must respect, published on the overview and
 * enforced by the same resolver the API's 422 reads — so the picker and the
 * server can never disagree. Days are `YYYY-MM-DD` (UTC). `max_span_days`
 * counts BOTH ends, so `from === to` is a span of 1.
 */
export interface OwnerIncomeRangeLimits {
  min_day: string
  max_day: string
  max_span_days: number
}

/**
 * What the client asked for — the single source the store key, the request URL
 * and the retry path are all derived from. A range's days are `YYYY-MM-DD`.
 */
export type OwnerIncomeWindowSelection =
  | { kind: 'run'; number: number }
  | { kind: 'range'; from: string; to: string }

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
 * `ranges_enabled` false means every `income/range…` endpoint 404s — the
 * Custom dates entry must be hidden entirely, not merely disabled.
 */
export interface OwnerIncomeOverview {
  agency: IncomeAgency
  default_cycle: number | null
  cycles: OwnerIncomeCycle[]
  ranges_enabled: boolean
  range_limits: OwnerIncomeRangeLimits
}

/**
 * Members block for a window: sums over the whole roster for it (members who
 * left included, owner excluded). `gift_coins` is the coin value of gifts the
 * roster received in the window (the figure the code stores as agency XP).
 */
export interface OwnerIncomeMembersTotals extends IncomeTotals {
  members_count: number
  left_count: number
  gift_coins: number
}

/**
 * Owner block for a window. `earned = owner_cut + own_hosting`; `gift_coins`
 * is the owner's own hosting gift coins.
 */
export interface OwnerIncomeOwnerTotals extends IncomeTotals {
  owner_cut: number
  own_hosting: number
  gift_coins: number
}

/**
 * One window's heroes. `owner` is absent (not null) unless the requester is the
 * agency owner — the server never sends it to admins. The response also
 * carries a legacy `cycle` object; the client reads `window` only, because
 * `cycle.number` is null for a range.
 */
export interface OwnerIncomeWindowSummary {
  window: OwnerIncomeWindow
  members: OwnerIncomeMembersTotals
  owner?: OwnerIncomeOwnerTotals
}

// ========================================
// Members list — `…/members`
// ========================================

/** Server-side sort keys (validated by the API; anything else is a 422). */
export type OwnerIncomeMemberSort = 'income' | 'earned' | 'exchanged' | 'deducted' | 'xp' | 'name'

export type OwnerIncomeSortDirection = 'asc' | 'desc'

/**
 * One roster row for the window (owner never a row). `left` = had a run here in
 * the window but is not an active member now. `income = earned − exchanged −
 * deducted`.
 *
 * Run mode: a current member with no run in the cycle has `run_id: null`,
 * `current_tier: 0` and zero figures, and has no sheet to open.
 * Range mode: `run_id` and `current_tier` are ALWAYS null (a range spans
 * several runs) — never read `run_id` to decide whether a row is tappable, use
 * the window kind.
 */
export interface OwnerIncomeMemberRow extends IncomeTotals {
  user_id: number
  name: string
  avatar_url: string | null
  signature: string | null
  left: boolean
  run_id: number | null
  current_tier: number | null
  accumulated_xp: number
  gift_coins: number
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
 * Client-side list state for one window. `page` = last loaded page (0 = none);
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
// Member sheet — `…/members/{user}`
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
 * A crossed milestone on the sheet. In range mode the server adds `run_id`,
 * because tiers repeat across the runs a range spans — `tier` alone is not a
 * unique key there.
 */
export interface OwnerIncomeSheetMilestone extends RunDetailMilestone {
  run_id?: number
}

/**
 * One member's figures for the open window.
 *
 * Run mode: `run` is the member's newest run in this agency for the cycle and
 * `totals` is exactly their own `GET user/income/runs/{run}` money — gift coins
 * live on `run.accumulated_xp`. The server 404s for a member not in the cycle's
 * roster or with no run in it.
 *
 * Range mode: `run` is explicitly `null` (a range spans several runs) and
 * `totals` carries `gift_coins` instead. A roster member with no activity at
 * all in the range gets an all-zero sheet rather than a 404.
 */
export interface OwnerIncomeMemberSheet {
  member: OwnerIncomeSheetMember
  run: OwnerIncomeSheetRun | null
  totals: IncomeTotals & { gift_coins?: number }
  milestones: OwnerIncomeSheetMilestone[]
  exchanges: RunExchange[]
  deductions: RunDeduction[]
}

/** The sheet currently open: the window it was opened on + the tapped row. */
export interface OwnerIncomeOpenMember {
  window: OwnerIncomeWindowSelection
  member: OwnerIncomeSheetMember
}
