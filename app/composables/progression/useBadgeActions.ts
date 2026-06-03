// ========================================
// Badge Actions Composable (Action / Orchestrator Role)
// ========================================
// Handles mutating badge actions with GATE → EXECUTE → REACT pipeline.

import type { EquippedBadge, UserBadge } from '~/types/progression/badge'
import { audioSocketRef } from '~/composables/room/useAudioSocket'
import { createLogger } from '~/utils/logger'

const log = createLogger('[BadgeActions]')

// ========================================
// Arrangement Builder (pure helper)
// ========================================

type ArrangementOp =
  | { type: 'equip'; slotPosition: number; badgeId: number; imageUrl: string | null }
  | { type: 'unequip'; slotPosition: number }
  | { type: 'reorder'; fromSlot: number; toSlot: number }

/**
 * Builds a new EquippedBadge arrangement from the current one plus an operation.
 * Pure function — no side effects.
 */
export function buildArrangement(current: EquippedBadge[], op: ArrangementOp): EquippedBadge[] {
  if (op.type === 'equip') {
    const filtered = current.filter(
      e => e.slot_position !== op.slotPosition && e.badge_id !== op.badgeId,
    )
    return [...filtered, { slot_position: op.slotPosition, badge_id: op.badgeId, image_url: op.imageUrl }]
  }
  if (op.type === 'unequip') {
    return current.filter(e => e.slot_position !== op.slotPosition)
  }
  // reorder: swap badge_ids between two slots
  return current.map(e => {
    if (e.slot_position === op.fromSlot) return { ...e, slot_position: op.toSlot }
    if (e.slot_position === op.toSlot) return { ...e, slot_position: op.fromSlot }
    return e
  })
}

/**
 * Composable for badge actions (mutations).
 *
 * Responsibilities (ARCHITECTURE.md - Action/Orchestrator role):
 * - GATE: validate preconditions
 * - EXECUTE: optimistic store update + PUT /user/equipped-badges
 * - REACT: settle with server response, toast on error, rollback on failure
 */
export function useBadgeActions() {
  const toast = useToast()
  const store = useBadgesStore()
  const { api, normalizeError } = useApi()

  function emitProfileSync(fields: import('~/types/user/profile-sync').ProfileSyncFields): void {
    try {
      if (!audioSocketRef.value?.connected) return
      audioSocketRef.value.emit('user:profileSync', { profile: fields })
    } catch { /* silent — Laravel SyncProfileToMsab provides fallback */ }
  }

  // ========================================
  // Private Helpers
  // ========================================

  function findBadgeImageUrl(badgeId: number): string | null {
    const inCatalog = store.catalog.items.find(b => b.id === badgeId)
    if (inCatalog) return inCatalog.image_url
    const inUserBadges = store.userBadges.items.find(ub => ub.badge.id === badgeId)
    return inUserBadges?.badge.image_url ?? null
  }

  function toPutBody(arrangement: EquippedBadge[]): Array<{ slot_position: number; badge_id: number }> {
    return arrangement.map(e => ({ slot_position: e.slot_position, badge_id: e.badge_id }))
  }

  async function applyArrangement(
    snapshot: EquippedBadge[],
    optimistic: EquippedBadge[],
  ): Promise<void> {
    store.setEquippedBadges(optimistic)
    try {
      const response = await api<{ data: EquippedBadge[] }>('/user/equipped-badges', {
        method: 'PUT',
        body: toPutBody(optimistic),
      })
      store.setEquippedBadges(response.data)
      // REACT: propagate final arrangement to all rooms the user is currently in
      emitProfileSync({ equipped_badges: response.data })
    } catch (err) {
      log.warn('PUT /user/equipped-badges failed — rolling back', err)
      store.setEquippedBadges(snapshot)
      const normalized = normalizeError(err)
      toast.add({
        title: 'Failed to update badges',
        description: normalized.message,
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
    }
  }

  // ========================================
  // Equip
  // ========================================

  /**
   * Equip a badge into a slot.
   *
   * GATE: badge must be owned; slot must be within limit.
   * EXECUTE: optimistic update + PUT.
   * REACT: settle with server response, rollback + toast on failure.
   */
  async function equip(slotPosition: number, badgeId: number): Promise<void> {
    // GATE
    if (slotPosition < 1 || slotPosition > store.badgeSlotLimit) {
      toast.add({
        title: 'Invalid slot',
        description: `Slot ${slotPosition} is outside your limit of ${store.badgeSlotLimit} slots.`,
        color: 'error',
      })
      return
    }
    const isOwned = store.userBadges.items.some(ub => ub.badge.id === badgeId)
    if (!isOwned) {
      toast.add({ title: 'Badge not owned', description: 'You have not earned this badge.', color: 'error' })
      return
    }

    // EXECUTE
    const snapshot = [...store.equippedBadges]
    const imageUrl = findBadgeImageUrl(badgeId)
    const optimistic = buildArrangement(snapshot, { type: 'equip', slotPosition, badgeId, imageUrl })
    await applyArrangement(snapshot, optimistic)
  }

  // ========================================
  // Unequip
  // ========================================

  /**
   * Remove a badge from a slot.
   *
   * GATE: slot must be occupied.
   * EXECUTE: optimistic update + PUT.
   * REACT: settle, rollback + toast on failure.
   */
  async function unequip(slotPosition: number): Promise<void> {
    // GATE
    const occupied = store.equippedBadges.find(e => e.slot_position === slotPosition)
    if (!occupied) {
      return
    }

    // EXECUTE
    const snapshot = [...store.equippedBadges]
    const optimistic = buildArrangement(snapshot, { type: 'unequip', slotPosition })
    await applyArrangement(snapshot, optimistic)
  }

  // ========================================
  // Reorder
  // ========================================

  /**
   * Swap two occupied slots.
   *
   * GATE: both slots must be occupied.
   * EXECUTE: optimistic update + PUT.
   * REACT: settle, rollback + toast on failure.
   */
  async function reorder(fromSlot: number, toSlot: number): Promise<void> {
    // GATE
    const fromBadge = store.equippedBadges.find(e => e.slot_position === fromSlot)
    const toBadge = store.equippedBadges.find(e => e.slot_position === toSlot)
    if (!fromBadge || !toBadge) {
      return
    }

    // EXECUTE
    const snapshot = [...store.equippedBadges]
    const optimistic = buildArrangement(snapshot, { type: 'reorder', fromSlot, toSlot })
    await applyArrangement(snapshot, optimistic)
  }

  // ========================================
  // Badge Earned Handler
  // ========================================

  /**
   * Handle a real-time badge earned event.
   * Called from the events layer.
   */
  function onBadgeEarned(userBadge: UserBadge): void {
    store.addUserBadge(userBadge)
    store.incrementStatsTotal()
    toast.add({
      title: 'New Badge Earned!',
      description: userBadge.badge.name,
      color: 'success',
      icon: 'i-lucide-award',
    })
  }

  // ========================================
  // Return
  // ========================================

  return {
    equip,
    unequip,
    reorder,
    onBadgeEarned,
  }
}
