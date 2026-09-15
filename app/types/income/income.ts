// ========================================
// Income Types — agency-XP per-run milestone model
// ========================================
// See backend issue 05 "Delivered contract". Numbers are native `agency_xp`
// (no display multiplier).

/**
 * Lifecycle of an agency-XP run.
 */
export type AgencyRunStatus = 'active' | 'closed' | 'cancelled'

// ========================================
// Run + Ladder
// ========================================

/**
 * One tier of a run's snapshotted milestone ladder.
 */
export interface LadderTier {
  tier: number
  required_xp: number
  member_diamond_reward: number
  owner_diamond_reward: number
  crossed: boolean
  is_active: boolean
}

/**
 * A member's agency-XP run with its full tier ladder.
 */
export interface AgencyRun {
  id: number
  status: AgencyRunStatus
  status_label: string
  status_color: string
  accumulated_xp: number
  current_tier: number
  band_floor: number | null
  band_ceiling: number | null
  progress_percentage: number | null
  started_at: string
  ends_at: string
  refunded_coins: number
  refunded_at: string | null
  ladder: LadderTier[]
  created_at: string
}

// ========================================
// Run-centric income page (member-income-runs epic)
// ========================================
// `GET user/income/overview` + `GET user/income/runs/{run}`. Diamond figures are
// exact integers; Exchanged/Deducted are attributed to a run by the reseller
// panel's cycle-window rules, so member and reseller totals always agree.

/**
 * The agency a run (or the member right now) belongs to.
 */
export interface IncomeAgency {
  id: number
  name: string
  logo_url: string | null
}

/**
 * Per-run (or lifetime) money figures. `income = earned − exchanged − deducted`.
 */
export interface IncomeTotals {
  earned: number
  exchanged: number
  deducted: number
  income: number
}

/**
 * One run inside the overview's grouped run selector.
 */
export interface OverviewRun {
  id: number
  status: AgencyRunStatus
  status_label: string
  status_color: string
  started_at: string
  ends_at: string
  label: string
  has_unclaimed: boolean
}

/**
 * A group of runs earned under one agency, newest run first.
 */
export interface OverviewAgencyGroup extends IncomeAgency {
  runs: OverviewRun[]
}

/**
 * `GET user/income/overview` payload. Groups are ordered by their most recent run.
 */
export interface IncomeOverview {
  lifetime: IncomeTotals & { completed_runs: number }
  current_agency: IncomeAgency | null
  active_run_id: number | null
  unclaimed_runs_count: number
  agencies: OverviewAgencyGroup[]
}

/**
 * A crossed milestone on the run detail, ordered by tier.
 */
export interface RunDetailMilestone {
  tier: number
  required_xp: number
  member_diamond_reward: number
  crossed_at: string | null
  member_reward_claimed: boolean
}

/**
 * A self-exchange of diamonds to coins attributed to the run.
 */
export interface RunExchange {
  id: number
  at: string
  diamonds: number
  coins_received: number
}

/**
 * A reseller deduction (diamonds taken for a cash payout) attributed to the run.
 */
export interface RunDeduction {
  id: number
  at: string
  diamonds: number
  cash_paid: number
  cash_currency: string
}

/**
 * `GET user/income/runs/{run}` payload. Carries every `AgencyRun` field, so the
 * active run's detail can also feed the ladder/progress components and the
 * milestone-drain celebration.
 */
export interface RunDetail extends AgencyRun {
  agency: IncomeAgency
  totals: IncomeTotals
  milestones: RunDetailMilestone[]
  exchanges: RunExchange[]
  deductions: RunDeduction[]
}

// ========================================
// Realtime payloads (store mutators consume these)
// ========================================

export interface XpProgressUpdate {
  run_id: number
  accumulated_xp: number
  current_tier: number
  progress_percentage: number | null
}

export interface MilestoneCrossedUpdate {
  run_id: number
  current_tier: number
}

// ========================================
// Claim
// ========================================

export interface ClaimResult {
  claimed_count: number
  claimed_tiers: number[]
  diamonds_claimed: number
}
