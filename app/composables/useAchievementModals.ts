// ========================================
// Achievement Modals Composable
// ========================================

import type { BadgeEarnedPayload, UserLevelUpPayload, IncomeTargetCompletedPayload } from '~/types/socket-events'

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
  targetName: string
  tier: string
  memberReward: number
  ownerReward: number
  isOwnerView: boolean
}

// ========================================
// State (module-level singleton)
// ========================================

const badgeModalOpen = ref(false)
const badgeModalData = ref<BadgeModalData | null>(null)

const levelUpModalOpen = ref(false)
const levelUpModalData = ref<LevelUpModalData | null>(null)

const incomeTargetModalOpen = ref(false)
const incomeTargetModalData = ref<IncomeTargetModalData | null>(null)

// ========================================
// Composable
// ========================================

/**
 * Composable for showing achievement celebration modals.
 * Uses module-level state for singleton pattern across components.
 */
export function useAchievementModals() {
  // ========================================
  // Badge Modal
  // ========================================

  /**
   * Show badge earned modal with animation.
   */
  function showBadgeEarned(payload: BadgeEarnedPayload): void {
    badgeModalData.value = {
      badgeId: payload.badge_id,
      badgeName: payload.badge_name,
      badgeImage: payload.badge_image,
      category: payload.category,
      context: payload.context,
    }
    badgeModalOpen.value = true

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      closeBadgeModal()
    }, 4000)
  }

  function closeBadgeModal(): void {
    badgeModalOpen.value = false
    // Clear data after animation completes
    setTimeout(() => {
      badgeModalData.value = null
    }, 300)
  }

  // ========================================
  // Level Up Modal
  // ========================================

  /**
   * Show level up modal with celebration animation.
   */
  function showLevelUp(payload: UserLevelUpPayload): void {
    levelUpModalData.value = {
      type: payload.type,
      previousLevel: payload.previous_level,
      newLevel: payload.new_level,
      currentXp: payload.current_xp,
    }
    levelUpModalOpen.value = true

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      closeLevelUpModal()
    }, 4000)
  }

  function closeLevelUpModal(): void {
    levelUpModalOpen.value = false
    // Clear data after animation completes
    setTimeout(() => {
      levelUpModalData.value = null
    }, 300)
  }

  // ========================================
  // Income Target Completion Modal
  // ========================================

  /**
   * Show income target completion modal with celebration.
   * Used for agency income tier completions.
   */
  function showIncomeTargetCompleted(payload: IncomeTargetCompletedPayload, isOwnerView = false): void {
    incomeTargetModalData.value = {
      targetName: payload.name,
      tier: payload.tier,
      memberReward: payload.member_reward,
      ownerReward: payload.owner_reward,
      isOwnerView,
    }
    incomeTargetModalOpen.value = true

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      closeIncomeTargetModal()
    }, 4000)
  }

  function closeIncomeTargetModal(): void {
    incomeTargetModalOpen.value = false
    // Clear data after animation completes
    setTimeout(() => {
      incomeTargetModalData.value = null
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
    showIncomeTargetCompleted,
    closeIncomeTargetModal,
  }
}
