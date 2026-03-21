// ========================================
// User Store
// ========================================
// Handles user profile mutations from realtime events.
// Separated from auth store per ARCHITECTURE.md:
// "If a store has refs from 3+ unrelated concerns, split it."
// Auth store owns token/session state; this store owns user profile mutations.

import { defineStore } from 'pinia'
import type { BootstrapUser } from '~/types/user/bootstrap'

export const useUserStore = defineStore('user', () => {
  // ========================================
  // Dependencies
  // ========================================

  const authStore = useAuthStore()

  // ========================================
  // Helpers
  // ========================================

  /**
   * Safely get the current user from auth store.
   */
  function getUser(): BootstrapUser | null {
    return authStore.user
  }

  // ========================================
  // Actions
  // ========================================

  /**
   * Update user balance from realtime event.
   */
  function updateBalance(balance: {
    coins: string
    diamonds: string
    wealth_xp: string
    charm_xp: string
  }) {
    const user = getUser()
    if (user) {
      authStore.setUser({
        ...user,
        coins: balance.coins,
        diamonds: balance.diamonds,
        wealth_xp: balance.wealth_xp,
        charm_xp: balance.charm_xp,
      })
    }
  }

  /**
   * Patch specific balance fields without requiring all values.
   * Use this when only a subset of balance fields changes (e.g., reward claims).
   */
  function patchBalance(partial: Partial<Pick<BootstrapUser, 'coins' | 'diamonds' | 'wealth_xp' | 'charm_xp'>>) {
    const user = getUser()
    if (user) {
      authStore.setUser({
        ...user,
        ...partial,
      })
    }
  }

  /**
   * Update VIP level from realtime event.
   */
  function patchVip(vip: {
    vip_level: number
    vip_level_id: number | null
    vip_expires_at: string | null
  }) {
    const user = getUser()
    if (user) {
      authStore.setUser({
        ...user,
        vip_level: vip.vip_level,
        vip_level_id: vip.vip_level_id,
        vip_expires_at: vip.vip_expires_at,
      })
    }
  }

  /**
   * Patch profile fields from a realtime `user:profile_updated` event.
   * Merges only the supplied fields into the current user, leaving everything else intact.
   */
  function patchProfile(partial: Partial<BootstrapUser>) {
    const user = getUser()
    if (user) {
      authStore.setUser({ ...user, ...partial })
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    updateBalance,
    patchBalance,
    patchVip,
    patchProfile,
  }
})
