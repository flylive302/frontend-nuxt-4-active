/**
 * Level-Up Watermark Store
 *
 * Per-device "seen" watermark for page-gated celebration modals
 * (level-up-celebrations epic, ticket 04). Replaces the old app-wide
 * level-up queue: the wealth/charm level pages compare the level derived
 * from in-memory XP against these watermarks to decide what's new.
 *
 * `milestoneSeen` (agency-run id → highest tier seen) is included now,
 * unused by this ticket, for a sibling agency-milestone ticket — keeps
 * this store above the "never fewer than ~3 refs" splitting threshold.
 *
 * Stores = ref + computed + setters ONLY (no API, no toast, no cross-store calls).
 */
import { defineStore } from 'pinia'

export const useLevelUpWatermarkStore = defineStore('levelUpWatermarkStore', () => {
  // ========================================
  // State
  // ========================================

  /**
   * Highest wealth level already shown to this device.
   * `null` means "never drained on this device" — distinct from 0 ("drained
   * while still level 0"), which is what lets the first-ever visit collapse a
   * veteran's whole history into a single summary instead of replaying it.
   */
  const wealthLevelSeen = ref<number | null>(null)

  /** Highest charm level already shown to this device. `null` = never drained. */
  const charmLevelSeen = ref<number | null>(null)

  /** Highest agency-milestone tier already shown, keyed by agency run id. */
  const milestoneSeen = ref<Record<string, number>>({})

  // ========================================
  // Setters
  // ========================================

  function setWealthLevelSeen(level: number): void {
    wealthLevelSeen.value = level
  }

  function setCharmLevelSeen(level: number): void {
    charmLevelSeen.value = level
  }

  function setMilestoneSeen(runId: string, tier: number): void {
    milestoneSeen.value[runId] = tier
  }

  /**
   * Record the seen tier for `runId` and drop every other run's entry in one
   * atomic replacement. Agency runs are short 10-day cycles, so only the
   * active run's mark is worth persisting — this keeps the localStorage map
   * from growing unbounded across a member's run history.
   */
  function setMilestoneSeenExclusive(runId: string, tier: number): void {
    milestoneSeen.value = { [runId]: tier }
  }

  function $reset(): void {
    wealthLevelSeen.value = null
    charmLevelSeen.value = null
    milestoneSeen.value = {}
  }

  // ========================================
  // Return
  // ========================================

  return {
    wealthLevelSeen,
    charmLevelSeen,
    milestoneSeen,
    setWealthLevelSeen,
    setCharmLevelSeen,
    setMilestoneSeen,
    setMilestoneSeenExclusive,
    $reset,
  }
}, {
  // storage: localStorage, from the nuxt.config default. This was an implicit
  // COOKIE until 2026-08-22 — see that file's note before changing it.
  persist: {
    pick: ['wealthLevelSeen', 'charmLevelSeen', 'milestoneSeen'],
  },
})
