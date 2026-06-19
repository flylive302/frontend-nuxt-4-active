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
 * A single crossed-milestone record (snapshot view).
 */
export interface RunMilestone {
  tier: number
  required_xp: number
  member_diamond_reward: number
  owner_diamond_reward: number
  member_reward_claimed: boolean
  crossed_at: string | null
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

/**
 * A run snapshot — the run plus its crossed-milestone records (claim state).
 */
export interface RunSnapshot extends AgencyRun {
  milestones: RunMilestone[]
}

/**
 * A closed run as a date-range option for the history dropdown.
 */
export interface RunOption {
  run_id: number
  status: AgencyRunStatus
  status_label: string
  started_at: string
  ends_at: string
  label: string
}

// ========================================
// Stats summary
// ========================================

/**
 * Compact active-run view returned inline with the stats summary.
 */
export interface CompactRun {
  run_id: number
  accumulated_xp: number
  current_tier: number
  band_floor: number | null
  band_ceiling: number | null
  progress_percentage: number | null
  ends_at: string
}

/**
 * Lifetime income summary for the member.
 */
export interface IncomeStats {
  summary: {
    total_diamonds: number
    completed_runs: number
    has_active_run: boolean
  }
  active_run: CompactRun | null
  total_diamonds_earned: number
  completed_runs: number
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
