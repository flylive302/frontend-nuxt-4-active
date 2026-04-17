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
  /** Populated by force-disconnect event; consumed by /blocked page */
  const suspensionInfo = ref<{ reason: string; until: string | null } | null>(null)

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
    const cookie = useCookie('sanctum_token', {
      maxAge: 90 * 24 * 60 * 60, // 90 days — matches backend Sanctum expiration
      secure: true,
      sameSite: 'lax',
      path: '/',
    })
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
   * State-only — navigation belongs in the composable REACT stage.
   */
  function logout() {
    setUser(null)
    setToken(null)
    setMsabToken(null)
    status.value = 'unauthenticated'
    suspensionInfo.value = null
  }

  /**
   * Store suspension details from a force-disconnect event.
   * The /blocked page reads this to display reason and countdown.
   */
  function setSuspensionInfo(info: { reason: string; until: string | null }) {
    suspensionInfo.value = info
  }

  // ========================================
  // Return
  // ========================================

  return {
    user,
    token,
    msabToken,
    status,
    suspensionInfo,
    isAuthenticated,
    setUser,
    setToken,
    setMsabToken,
    logout,
    setSuspensionInfo,
  }
}, {
  persist: {
    pick: ['token', 'msabToken'],
  },
})
