// ========================================
// Achievement Modals Composable
// ========================================

import type { BadgeEarnedPayload, UserLevelUpPayload } from '~/types/room/socket-events'

// ========================================
// Types
// ========================================

export interface BadgeModalData {
  badgeId: number
  badgeName: string
  badgeImage: string
  category: 'wealth' | 'charm' | 'room' | 'special'
  context: string
}

export interface LevelUpModalData {
  type: 'wealth' | 'charm'
  previousLevel: number
  newLevel: number
  currentXp: string
}

export interface IncomeTargetModalData {
  tier: number
  memberReward: number
  ownerReward: number
  isOwnerView: boolean
}

type PendingModal =
  | { type: 'badge'; data: BadgeModalData }
  | { type: 'levelUp'; data: LevelUpModalData }
  | { type: 'incomeTarget'; data: IncomeTargetModalData }

// ========================================
// State (module-level singleton)
// ========================================
// ARCHITECTURE EXCEPTION: Module-level refs used intentionally.
// This state is ephemeral (modal open/close queue), not persisted,
// and requires singleton semantics across all callers within a session.
// A store would add unnecessary overhead for transient UI state and
// would violate the "never create a store with fewer than ~3 refs
// and ~2 functions" splitting rule (ARCHITECTURE.md).

const badgeModalOpen = ref(false)
const badgeModalData = ref<BadgeModalData | null>(null)

const levelUpModalOpen = ref(false)
const levelUpModalData = ref<LevelUpModalData | null>(null)

const incomeTargetModalOpen = ref(false)
const incomeTargetModalData = ref<IncomeTargetModalData | null>(null)

// Queue for modals waiting to be shown
const pendingModals = ref<PendingModal[]>([])

// ========================================
// Composable
// ========================================

/**
 * Composable for showing achievement celebration modals.
 * Uses module-level state for singleton pattern across components.
 * Modals queue until gift playback finishes (if user is in a room).
 */
export function useAchievementModals() {
  // ========================================
  // Queue Management
  // ========================================

  /**
   * Check if modals can be shown right now.
   * Returns true if user is not in a room, OR if in room and no gifts playing.
   */
  function canShowModal(): boolean {
    const roomStore = useRoomStore()
    const giftStore = useGiftStore()

    // If not in a room, always allow modals
    if (!roomStore.currentRoom) return true

    // If in room, only allow when no gifts are playing
    return !giftStore.isPlaying
  }

  /**
   * Check if any achievement modal is currently open.
   */
  function isAnyModalOpen(): boolean {
    return badgeModalOpen.value || levelUpModalOpen.value || incomeTargetModalOpen.value
  }

  /**
   * Process the pending modal queue.
   * Shows the next modal if conditions allow.
   */
  function processQueue(): void {
    // Don't show if conditions not met or another modal is open
    if (!canShowModal() || isAnyModalOpen()) return
    if (pendingModals.value.length === 0) return

    const next = pendingModals.value.shift()!
    showModalByType(next)
  }

  /**
   * Show a modal by its type from the queue.
   */
  function showModalByType(modal: PendingModal): void {
    switch (modal.type) {
      case 'badge':
        badgeModalData.value = modal.data
        badgeModalOpen.value = true
        break
      case 'levelUp':
        levelUpModalData.value = modal.data
        levelUpModalOpen.value = true
        break
      case 'incomeTarget':
        incomeTargetModalData.value = modal.data
        incomeTargetModalOpen.value = true
        break
    }
  }

  /**
   * Enqueue a modal and try to show it immediately if conditions allow.
   */
  function enqueueModal(modal: PendingModal): void {
    pendingModals.value.push(modal)
    processQueue()
  }

  // Watch for gift playback to finish, then process queue
  const giftStore = useGiftStore()
  watch(
    () => giftStore.isPlaying,
    (isPlaying) => {
      if (!isPlaying) {
        // Delay slightly to ensure clean transition after gift animation
        setTimeout(processQueue, 100)
      }
    }
  )

  // ========================================
  // Badge Modal
  // ========================================

  /**
   * Show badge earned modal with animation.
   * Queues if gift playback is in progress.
   */
  function showBadgeEarned(payload: BadgeEarnedPayload): void {
    const data: BadgeModalData = {
      badgeId: payload.badge_id,
      badgeName: payload.badge_name,
      badgeImage: payload.badge_image,
      category: payload.category,
      context: payload.context,
    }
    enqueueModal({ type: 'badge', data })
  }

  function closeBadgeModal(): void {
    badgeModalOpen.value = false
    // Clear data after animation completes
    setTimeout(() => {
      badgeModalData.value = null
      // Process queue after modal closes
      processQueue()
    }, 300)
  }

  // ========================================
  // Level Up Modal
  // ========================================

  /**
   * Show level up modal with celebration animation.
   * Queues if gift playback is in progress.
   */
  function showLevelUp(payload: UserLevelUpPayload): void {
    const data: LevelUpModalData = {
      type: payload.type,
      previousLevel: payload.previous_level,
      newLevel: payload.new_level,
      currentXp: payload.current_xp,
    }
    enqueueModal({ type: 'levelUp', data })
  }

  function closeLevelUpModal(): void {
    levelUpModalOpen.value = false
    // Clear data after animation completes
    setTimeout(() => {
      levelUpModalData.value = null
      // Process queue after modal closes
      processQueue()
    }, 300)
  }

  // ========================================
  // Agency Milestone Crossed Modal
  // ========================================

  /**
   * Show the milestone-crossed celebration modal.
   * Used for agency-XP run milestone crossings (member or owner view).
   * Queues if gift playback is in progress.
   */
  function showMilestoneCrossed(data: IncomeTargetModalData): void {
    enqueueModal({ type: 'incomeTarget', data })
  }

  function closeIncomeTargetModal(): void {
    incomeTargetModalOpen.value = false
    // Clear data after animation completes
    setTimeout(() => {
      incomeTargetModalData.value = null
      // Process queue after modal closes
      processQueue()
    }, 300)
  }

  // ========================================
  // Return
  // ========================================

  return {
    // Badge modal state
    badgeModalOpen: readonly(badgeModalOpen),
    badgeModalData: readonly(badgeModalData),
    showBadgeEarned,
    closeBadgeModal,

    // Level up modal state
    levelUpModalOpen: readonly(levelUpModalOpen),
    levelUpModalData: readonly(levelUpModalData),
    showLevelUp,
    closeLevelUpModal,

    // Income target modal state
    incomeTargetModalOpen: readonly(incomeTargetModalOpen),
    incomeTargetModalData: readonly(incomeTargetModalData),
    showMilestoneCrossed,
    closeIncomeTargetModal,

    // Queue utilities (exposed for testing)
    pendingModals: readonly(pendingModals),
    processQueue,
  }
}

