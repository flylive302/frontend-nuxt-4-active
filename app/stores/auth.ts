// ========================================
// Auth Store
// ========================================

import { defineStore } from 'pinia'
import type { BootstrapUser } from '~/types/user/bootstrap'

export const useAuthStore = defineStore('auth', () => {
  // ========================================
  // State
  // ========================================

  const user = ref<BootstrapUser | null>(null)
  const token = ref<string | null>(null)
  const msabToken = ref<string | null>(null)
  const status = ref<'idle' | 'loading' | 'authenticated' | 'unauthenticated'>('idle')

  // ========================================
  // Getters
  // ========================================

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  // ========================================
  // Actions
  // ========================================

  /**
   * Update the authenticated user.
   */
  function setUser(newUser: BootstrapUser | null) {
    user.value = newUser
    status.value = newUser ? 'authenticated' : 'unauthenticated'
  }

  /**
   * Set authentication token and sync with cookie.
   */
  function setToken(newToken: string | null) {
    token.value = newToken
    const cookie = useCookie('sanctum_token')
    cookie.value = newToken
  }

  /**
   * Set the MSAB audio server JWT.
   */
  function setMsabToken(newToken: string | null) {
    msabToken.value = newToken
  }

  /**
   * Log out the current user.
   */
  function logout() {
    setUser(null)
    setToken(null)
    setMsabToken(null)
    status.value = 'unauthenticated'
    navigateTo('/log-in')
  }

  /**
   * Update user balance from realtime event.
   */
  function updateBalance(balance: {
    coins: string
    diamonds: string
    wealth_xp: string
    charm_xp: string
  }) {
    if (user.value) {
      user.value = {
        ...user.value,
        coins: balance.coins,
        diamonds: balance.diamonds,
        wealth_xp: balance.wealth_xp,
        charm_xp: balance.charm_xp,
      }
    }
  }

  /**
   * Patch specific balance fields without requiring all values.
   * Use this when only a subset of balance fields changes (e.g., reward claims).
   */
  function patchBalance(partial: Partial<Pick<BootstrapUser, 'coins' | 'diamonds' | 'wealth_xp' | 'charm_xp'>>) {
    if (user.value) {
      user.value = {
        ...user.value,
        ...partial,
      }
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
    if (user.value) {
      user.value = {
        ...user.value,
        vip_level: vip.vip_level,
        vip_level_id: vip.vip_level_id,
        vip_expires_at: vip.vip_expires_at,
      }
    }
  }

  /**
   * Patch profile fields from a realtime `user:profile_updated` event.
   * Merges only the supplied fields into the current user, leaving everything else intact.
   */
  function patchProfile(partial: Partial<BootstrapUser>) {
    if (user.value) {
      user.value = { ...user.value, ...partial }
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    user,
    token,
    msabToken,
    status,
    isAuthenticated,
    setUser,
    setToken,
    setMsabToken,
    logout,
    updateBalance,
    patchBalance,
    patchVip,
    patchProfile,
  }
}, {
  persist: {
    pick: ['token', 'msabToken'],
  },
})
