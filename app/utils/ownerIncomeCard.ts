/**
 * Owner Income Card Helpers
 *
 * Pure helpers for the owner/admin Member Income card, list and sheet
 * components (agency-member-income-runs epic, Phase 2). Extracted so the
 * mode-driven decisions — tappability, the Gift-coins source, milestone row
 * keys — are unit-testable without mounting a component (this repo has no DOM
 * test environment).
 *
 * Names are deliberately `ownerIncome…`-prefixed: `app/utils/` is
 * auto-imported app-wide, and a generic name here can silently shadow a
 * same-named export elsewhere.
 */

import type { OwnerIncomeSheetMilestone, OwnerIncomeWindowKind } from '~/types/income/ownerIncome'

// ========================================
// Tappability
// ========================================

/**
 * Whether a member row opens the sheet. Run mode: only rows with a run this
 * cycle (`run_id !== null`). Range mode: always — a range spans several runs,
 * so `run_id` is always null there and must not be read for this decision.
 */
export function isOwnerIncomeMemberTappable(windowKind: OwnerIncomeWindowKind, runId: number | null): boolean {
  return windowKind === 'range' ? true : runId !== null
}

// ========================================
// Gift coins source
// ========================================

/**
 * Where the Gift coins figure for a member sheet comes from: run mode reads
 * `run.accumulated_xp`, range mode reads `totals.gift_coins` (0 when absent —
 * a roster member with no activity still gets a zero, not a missing line).
 */
export function ownerIncomeSheetGiftCoins(
  windowKind: OwnerIncomeWindowKind,
  runAccumulatedXp: number | null,
  totalsGiftCoins: number | null | undefined
): number {
  if (windowKind === 'run') return runAccumulatedXp ?? 0
  return totalsGiftCoins ?? 0
}

// ========================================
// Milestone row keys
// ========================================

/**
 * A unique `:key` for a milestone row. In range mode tiers repeat across the
 * several runs a range spans, so `tier` alone collides — key on the run too.
 */
export function ownerIncomeMilestoneKey(milestone: OwnerIncomeSheetMilestone): string {
  return `${milestone.run_id ?? 'run'}:${milestone.tier}`
}
